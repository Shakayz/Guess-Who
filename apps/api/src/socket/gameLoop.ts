import type { Server } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@red-handed/shared'
import {
  getTiedPlayerIds,
  checkWinCondition,
  tallyVotes,
  isRedHandedSideRole,
  isVillagerSideRole,
  isJesterRole,
  isTwinRole,
  computeRankUpdate,
  LP_REWARDS,
  XP_REWARDS,
  LEVEL_CAP,
  levelFromXp,
  xpProgressInLevel,
} from '@red-handed/shared'
import { evaluateEvent } from '../services/achievements'

/** Final winner label used across all end-game branches. */
type Winner = 'villagers' | 'red_handed' | 'jester' | 'evil_twins' | 'draw'

/**
 * Server-side mirror of the `didWin` computation in ResultsPage.tsx:308. Used
 * to credit role-aware star rewards when a game ends. The evil-twins override
 * is important: a surviving twin whose partner died loses individually even
 * if their natural team won the round.
 */
function didPlayerWin(player: any, winner: Winner, allPlayers: any[]): boolean {
  if (winner === 'draw') return false
  const role = player.role
  const isRedHandedSide = isRedHandedSideRole(role)
  const isVillagerSide = isVillagerSideRole(role)
  const isJester = isJesterRole(role)
  const isTwin = isTwinRole(role)

  // Twin whose partner died loses individually.
  let twinPartnerDead = false
  if (isTwin && player.twinPartnerUserId) {
    const partner = allPlayers.find((p) => p.userId === player.twinPartnerUserId)
    twinPartnerDead = !!partner && partner.status !== 'alive'
  }

  return (
    (winner === 'villagers'  && isVillagerSide && !twinPartnerDead) ||
    (winner === 'red_handed'  && isRedHandedSide && !twinPartnerDead) ||
    (winner === 'jester'     && isJester) ||
    (winner === 'evil_twins' && isTwin)
  )
}

/** Role/winner-aware base star reward. Losers get a small consolation. */
function starCoinsForPlayer(winner: Winner, didWin: boolean): number {
  if (winner === 'draw') return 20
  if (!didWin) return 10
  if (winner === 'villagers')  return 50
  if (winner === 'red_handed')  return 80
  if (winner === 'jester')     return 60
  if (winner === 'evil_twins') return 90
  return 10
}
import type { RankTier } from '@red-handed/shared'
import { redis } from '../config/redis'
import { prisma } from '../config/prisma'
import { childLogger } from '../config/logger'
import { onlineUsers } from './onlineUsers'
import { sendPushNotifications, sendPushNotification } from '../services/push'
import { applyGameEndRewards, DAILY_COST } from '../services/dailyRewards'

const logger = childLogger('game-loop')

type IO = Server<ClientToServerEvents, ServerToClientEvents>

// Per-room active timers
const roomTimers = new Map<string, NodeJS.Timeout>()

const STALEMATE_ROUNDS = 3

/** Returns how many trailing rounds in a row had no elimination. */
function countConsecutiveNoElimRounds(rounds: any[]): number {
  let count = 0
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (!rounds[i].eliminatedPlayerId) count++
    else break
  }
  return count
}

function clearRoomTimer(roomId: string) {
  const t = roomTimers.get(roomId)
  if (t) {
    clearTimeout(t)
    roomTimers.delete(roomId)
  }
}

// ─── Room state reset after game ends ─────────────────────────────────────────

function buildResetState(state: any): any {
  return {
    status: 'waiting',
    gameMode:          state.gameMode,
    categories:        state.categories ?? [],
    maxRounds:         state.maxRounds ?? 0,
    detectiveCount:    state.detectiveCount   ?? (state.enableDetective ? 1 : 0),
    doubleAgentCount:  state.doubleAgentCount ?? (state.enableDoubleAgent ? 1 : 0),
    guardianCount:     state.guardianCount ?? 0,
    mayorCount:        state.mayorCount ?? 0,
    infiltratorCount:  state.infiltratorCount ?? 0,
    jesterCount:       state.jesterCount ?? 0,
    // Clear the player list — players rejoin via room:join when they
    // navigate back to the lobby. Keeping old players here causes
    // "ghost players" from the previous game to appear in the lobby.
    players: [],
    currentRound: 0,
    rounds: [],
  }
}

const REDIS_ROOM_TTL = 21600  // 6 hours (was 24h — no game lasts that long)

async function resetRoomAfterGame(roomId: string, state: any): Promise<void> {
  const resetState = buildResetState(state)
  await redis.set(`room:${roomId}:state`, JSON.stringify(resetState), 'EX', REDIS_ROOM_TTL)
  await prisma.room.update({ where: { id: roomId }, data: { status: 'waiting' } }).catch(() => {})
}

/** Shared helper to build the round payload sent to clients */
function buildRoundPayload(round: any) {
  return {
    id: round.id,
    roundNumber: round.roundNumber,
    speakingOrder: round.speakingOrder ?? [],
    clues: round.clues ?? [],
    votes: round.votes ?? [],
    eliminatedPlayerId: round.eliminatedPlayerId ?? null,
    eliminatedRole: round.eliminatedRole ?? null,
    eliminationReason: round.eliminationReason ?? undefined,
    wordReveal: round.wordReveal ?? null,
  }
}

/** Shared LP delta calculator — avoids 4x duplication */
function getWinLpDelta(role: string, winner: string): number {
  const r = role as any
  const isRedHanded = isRedHandedSideRole(r)
  const isJester = isJesterRole(r)
  const isTwin = isTwinRole(r)

  // Jester wins are only ranked from a lore standpoint — ranked mode does not
  // include jester roles, so this is defensive. We reuse the villager-loss
  // constant so a jester win doesn't leak extra LP into ranked stats.
  if (winner === 'jester') {
    return isJester ? LP_REWARDS.RED_HANDED_WIN : LP_REWARDS.VILLAGER_LOSS
  }
  // Evil twins co-win — both twins get red-handed-size LP gain; everyone else loses.
  if (winner === 'evil_twins') {
    return isTwin ? LP_REWARDS.RED_HANDED_WIN : LP_REWARDS.VILLAGER_LOSS
  }
  if (winner === 'villagers') {
    return isRedHanded ? LP_REWARDS.RED_HANDED_LOSS : LP_REWARDS.VILLAGER_WIN
  }
  return isRedHanded ? LP_REWARDS.RED_HANDED_WIN : LP_REWARDS.VILLAGER_LOSS
}

/**
 * Twin loss override: a surviving twin whose partner died at game end is an
 * individual LOSER even if their natural team won — because the twin pair
 * failed its co-win condition. Returns a fresh LP delta when override kicks
 * in, otherwise `null` (caller should use the base delta).
 */
function twinLossOverride(player: any, players: any[], winner: string): number | null {
  if (!isTwinRole(player.role)) return null
  if (winner === 'evil_twins') return null  // twin pair already won
  if (player.status !== 'alive') return null  // only applies to survivors
  const partner = players.find((p: any) => p.userId === player.twinPartnerUserId)
  if (partner && partner.status === 'alive') return null  // pair intact
  return LP_REWARDS.VILLAGER_LOSS
}

/**
 * Reset all per-round ability flags that expire at round end:
 *   - Mayor's double-vote active flag
 *   - Inverter's vote-flip active flag
 */
function resetAbilityFlagsAtRoundEnd(state: any): void {
  for (const p of state.players as any[]) {
    if (p.role === 'mayor' && p.mayorDoubleActive) p.mayorDoubleActive = false
    if (p.role === 'inverter' && p.inverterActive) p.inverterActive = false
  }
}

/**
 * Post-elimination bookkeeping that must run whenever a player is removed
 * from the alive pool (either via vote, tiebreaker, kamikaze target, or
 * judge's decision). This handles:
 *   - Corruptor death → free their corruption target
 *   - Revenant death → grant post-mortem voting window (2 rounds)
 */
function onPlayerEliminated(state: any, eliminatedUserId: string): void {
  const eliminated = state.players.find((p: any) => p.userId === eliminatedUserId)
  if (!eliminated) return

  // ── Corruptor death frees their target ──
  if (eliminated.role === 'corruptor' && eliminated.corruptorTargetUserId) {
    const target = state.players.find((p: any) => p.userId === eliminated.corruptorTargetUserId)
    if (target) target.corrupted = false
  }

  // ── Revenant gets post-mortem voting window ──
  if (eliminated.role === 'revenant') {
    eliminated.revenantVotesRemaining = 2
  }
}

/**
 * At the end of a round (including tiebreakers), decrement the post-mortem
 * vote counter for any already-eliminated revenants who voted this round.
 * When the counter reaches 0 they are "fully dead" and can access dead-chat.
 */
function tickRevenantVotes(state: any, currentRound: any): void {
  if (!currentRound) return
  const votersThisRound: string[] = [
    ...((currentRound.votes ?? []) as any[]).map((v: any) => v.voterId),
    ...((state.tiebreakerVotes ?? []) as any[]).map((v: any) => v.voterId),
  ]
  const voterSet = new Set(votersThisRound)
  for (const p of state.players as any[]) {
    if (
      p.role === 'revenant' &&
      p.status === 'eliminated' &&
      typeof p.revenantVotesRemaining === 'number' &&
      p.revenantVotesRemaining > 0 &&
      voterSet.has(p.userId)
    ) {
      p.revenantVotesRemaining -= 1
    }
  }
}

function getSurvivalLpDelta(role: string): number {
  const isRedHanded = isRedHandedSideRole(role as any)
  return isRedHanded ? LP_REWARDS.SURVIVAL_RED_HANDED_WIN : LP_REWARDS.SURVIVAL_VILLAGER_LOSS
}

/** Fetch push tokens for a list of user IDs (only returns users with tokens set) */
async function getPushTokensForUsers(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, pushToken: { not: null } },
    select: { id: true, pushToken: true },
  }).catch(() => [])
  const map = new Map<string, string>()
  for (const u of users) {
    if (u.pushToken) map.set(u.id, u.pushToken)
  }
  return map
}

/** Read + parse Redis state with timer cleanup on loss */
async function getState(roomId: string): Promise<any | null> {
  const raw = await redis.get(`room:${roomId}:state`)
  if (!raw) {
    clearRoomTimer(roomId)
    return null
  }
  return JSON.parse(raw)
}

/** Write state back to Redis */
async function saveState(roomId: string, state: any): Promise<void> {
  await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', REDIS_ROOM_TTL)
}

// ─── LP helper — per-player role-based LP + rank sync ────────────────────────

async function applyRankedLP(
  io: IO,
  roomId: string,
  players: any[],
  getLpDelta: (player: any, allPlayers: any[]) => number,
): Promise<void> {
  const userIds: string[] = players.map((p: any) => p.userId)

  const users = await prisma.user.findMany({
    where:  { id: { in: userIds } },
    select: { id: true, rankPoints: true, rankTier: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  await Promise.allSettled(
    players.map(async (player: any) => {
      const user = userMap.get(player.userId)
      if (!user) return

      // Forfeited players always get the maximum loss, regardless of team result
      const lpDelta = player.status === 'forfeited'
        ? LP_REWARDS.RED_HANDED_LOSS
        : getLpDelta(player, players)
      const { newLP, newTier, promoted, demoted } = computeRankUpdate(user.rankPoints, lpDelta)
      const oldTier            = user.rankTier as RankTier
      const tierChanged        = newTier !== oldTier

      await prisma.user.update({
        where: { id: player.userId },
        data:  { rankPoints: newLP, ...(tierChanged ? { rankTier: newTier } : {}) },
      })

      if (tierChanged) {
        const socketId = onlineUsers.get(player.userId)
        if (socketId) io.to(socketId).emit('rank:updated' as any, { oldTier, newTier, newLP, promoted })
        // Fire rank_changed for tier-reached achievements
        await evaluateEvent(io, 'rank_changed', { userId: player.userId, newTier })
      }
    })
  )
}

// ─── XP / Level awarding (any game type) ─────────────────────────────────────

/**
 * After a game ends, give every (non-forfeited) player a chunk of lifetime XP,
 * recompute their level, flip hasPlayedRanked when relevant, and unlock any
 * level-milestone achievements they just crossed. Emits `level:up` to each
 * player who advanced.
 *
 * Computes XP per player from:
 *   - team result (win / loss / draw)
 *   - survival bonus
 *   - forfeited players get nothing
 */
async function applyXpAndLevel(
  io: IO,
  players: any[],
  winner: Winner,
  isRanked: boolean,
): Promise<void> {
  const userIds: string[] = players.map((p: any) => p.userId).filter(Boolean)
  if (userIds.length === 0) return

  const users = await prisma.user.findMany({
    where:  { id: { in: userIds } },
    select: { id: true, xp: true, level: true, hasPlayedRanked: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  await Promise.allSettled(
    players.map(async (player: any) => {
      const user = userMap.get(player.userId)
      if (!user) return
      if (player.status === 'forfeited') return  // forfeited → 0 XP

      // Determine win for this player based on role + team winner
      const role = player.role as any
      let isWinner =
        winner === 'draw'
          ? false
          : (winner === 'villagers' && isVillagerSideRole(role)) ||
            (winner === 'red_handed' && isRedHandedSideRole(role)) ||
            (winner === 'jester'    && isJesterRole(role)) ||
            (winner === 'evil_twins' && isTwinRole(role))
      // Twin loss override: a surviving twin whose partner died does NOT win
      // with their natural team — the pair failed the twin co-win condition.
      if (isWinner && twinLossOverride(player, players, winner) !== null) {
        isWinner = false
      }

      let xpGain: number
      if (winner === 'draw') xpGain = XP_REWARDS.DRAW
      else if (isWinner)     xpGain = XP_REWARDS.WIN
      else                   xpGain = XP_REWARDS.LOSS

      // Survival bonus: only awarded if the player survived to the end
      if (player.survived ?? player.status !== 'eliminated') {
        xpGain += XP_REWARDS.SURVIVAL_BONUS
      }

      const oldLevel = user.level
      // Cap so we never go past the absolute hard XP ceiling for level CAP
      const newXp = user.xp + xpGain
      const newLevel = Math.min(LEVEL_CAP, levelFromXp(newXp))
      const promoted = newLevel > oldLevel

      const dataToUpdate: Record<string, unknown> = { xp: newXp }
      if (promoted) dataToUpdate.level = newLevel
      if (isRanked && !user.hasPlayedRanked) dataToUpdate.hasPlayedRanked = true

      await prisma.user.update({
        where: { id: user.id },
        data: dataToUpdate,
      })

      // Notify the player about their XP gain + level progression
      const socketId = onlineUsers.get(user.id)
      if (socketId) {
        const progress = xpProgressInLevel(newXp)
        io.to(socketId).emit('level:xp' as any, {
          xpGained:    xpGain,
          totalXp:     newXp,
          level:       progress.level,
          xpInLevel:   progress.current,
          xpForNext:   progress.needed,
          leveledUp:   promoted,
          oldLevel,
          newLevel,
        })
      }

      // Fire level_up event so the achievement evaluator can unlock any
      // level_N thresholds the player just crossed.
      if (promoted) {
        await evaluateEvent(io, 'level_up', { userId: user.id, newLevel })
      }
    })
  )
}

// ─── Consolidated end-of-game path (used by every winner branch) ───────────

/**
 * Centralised end-of-game finalization. Called from every code path that
 * determines a final winner (standard vote resolution, tiebreaker,
 * said-word instant win, kamikaze/judge fallout, forfeit, round-cap, etc.).
 *
 * Emits `round:ended`, persists winner to DB, applies LP + XP,
 * then schedules the delayed `game:finished` broadcast + room reset.
 */
async function finishGameWithWinner(
  io: IO,
  roomId: string,
  state: any,
  winner: Winner,
  roundPayload: any,
): Promise<void> {
  logger.info({ roomId, winner }, '[finishGameWithWinner] finalising')

  state.status = 'finished'
  await saveState(roomId, state)
  // Snapshot the room row so we can know who paid for entry:
  // - matchmade / public rooms: every player paid 10 ⭐ at startGameForRoom
  // - private lobby: the host paid 10 ⭐ at lobby creation, joiners played free
  const roomRow = await prisma.room.findUnique({
    where: { id: roomId },
    select: { isPrivate: true, hostId: true },
  }).catch(() => null)
  const roomIsPrivate = roomRow?.isPrivate ?? false
  const roomHostId = roomRow?.hostId ?? null
  await prisma.room.update({ where: { id: roomId }, data: { status: 'finished' } }).catch(() => {})

  const finishedGame = await prisma.game.findFirst({ where: { roomId }, orderBy: { startedAt: 'desc' } }).catch(() => null)
  if (finishedGame) {
    await prisma.game.update({
      where: { id: finishedGame.id },
      data:  { winnerTeam: winner, endedAt: new Date() },
    }).catch(() => {})
  }

  // Push notification for all players
  const allPlayerIds = state.players.map((p: any) => p.userId)
  getPushTokensForUsers(allPlayerIds).then((tokenMap) => {
    if (tokenMap.size > 0) {
      const winnerLabel =
        winner === 'villagers'  ? 'Villagers' :
        winner === 'red_handed'  ? 'Imposters' :
        winner === 'jester'     ? 'The Jester' :
        winner === 'evil_twins' ? 'The Evil Twins' :
        'Draw'
      sendPushNotifications(
        Array.from(tokenMap.entries()).map(([, pushToken]) => ({
          pushToken,
          title: 'Game Over!',
          body: winner === 'draw' ? "It's a draw!" : `${winnerLabel} win!`,
          data: { type: 'game_finished', roomId, winner },
        })),
      ).catch((err) => logger.error({ err, roomId }, 'push: game finished notification error'))
    }
  }).catch(() => {})

  if (roundPayload) {
    io.to(`room:${roomId}`).emit('round:ended', { round: roundPayload as any })
  }

  // Achievement triggers — dispatched per-participant through the modular
  // evaluator registry. We fire even on draw so game-count progressions tick.
  try {
    const gameMode = (state.gameMode === 'ranked' ? 'ranked' :
                      state.gameMode === 'special' ? 'special' : 'normal') as 'normal' | 'special' | 'ranked'
    const playerCount = state.players.length
    const language = state.language ?? 'en'
    for (const p of state.players as any[]) {
      const role = p.role ?? ''
      const isRedHanded = isRedHandedSideRole(role)
      const isWinner = didPlayerWin(p, winner, state.players)
      const survived = p.status === 'alive'
      await evaluateEvent(io, 'game_end', {
        userId: p.userId,
        gameId: finishedGame?.id ?? null,
        role,
        survived,
        isWinner,
        isRedHanded,
        winner,
        gameMode,
        playerCount,
        language,
      })
    }
  } catch (err) {
    logger.error({ err }, '[achievements] evaluateEvent(game_end) failed')
  }

  const isRanked = state.gameMode === 'ranked'

  // Persist LP per-player role
  if (isRanked) {
    await applyRankedLP(io, roomId, state.players, (player, all) => {
      const baseDelta = getWinLpDelta(player.role ?? '', winner)
      const override = twinLossOverride(player, all, winner)
      return override !== null ? override : baseDelta
    })
  }
  // Award lifetime XP + recompute level
  await applyXpAndLevel(io, state.players, winner, isRanked)

  // Representative delta for broadcast RewardSummary (villager perspective)
  const lpChange = isRanked
    ? (winner === 'villagers' ? LP_REWARDS.VILLAGER_WIN : LP_REWARDS.VILLAGER_LOSS)
    : 0

  const xpEarned = winner === 'draw' ? 60 : 120

  // ── Per-player star credits ────────────────────────────────────────────────
  // Each player gets a role-aware base reward plus their individual daily /
  // streak bonus. Credits are atomic per player via applyGameEndRewards; if a
  // credit fails we still emit game:finished with zeroed bonuses so the UI
  // doesn't hang.
  const perPlayerRewards = new Map<
    string,
    { base: number; daily: number; streak: number; newStreakCount: number }
  >()
  for (const p of state.players) {
    const didWin = didPlayerWin(p, winner, state.players)
    const base = starCoinsForPlayer(winner, didWin)
    const applied = await applyGameEndRewards(p.userId, base)
    perPlayerRewards.set(p.userId, {
      base: applied.baseStarCoinsEarned,
      daily: applied.dailyBonusEarned,
      streak: applied.streakBonusEarned,
      newStreakCount: applied.newStreakCount,
    })
    // Fire daily_login achievement event if the streak actually ticked forward.
    if (applied.dailyBonusEarned > 0) {
      await evaluateEvent(io, 'daily_login', {
        userId: p.userId,
        newStreakCount: applied.newStreakCount,
      }).catch(() => {})
    }
  }

  // Resolve what each player actually paid for this game, so the Results
  // screen can display the full net breakdown (base reward, bonuses, and
  // the entry fee that was debited at start / lobby creation).
  const costForPlayer = (userId: string): number => {
    if (roomIsPrivate) {
      // Private lobby: host paid 10 ⭐ at POST /rooms, joiners played free.
      return userId === roomHostId ? DAILY_COST : 0
    }
    // Matchmade / public: everyone paid 10 ⭐ at startGameForRoom.
    return DAILY_COST
  }

  setTimeout(async () => { try {
    // Emit per-socket so each player sees their own bonus breakdown.
    let emittedToSomeone = false
    for (const p of state.players) {
      const sid = onlineUsers.get(p.userId)
      if (!sid) continue
      emittedToSomeone = true
      const r = perPlayerRewards.get(p.userId)
      const rewards = {
        starCoinsEarned: r?.base ?? 0,
        xpEarned,
        lpChange,
        achievements: [] as any[],
        dailyBonusEarned: r?.daily ?? 0,
        streakBonusEarned: r?.streak ?? 0,
        newStreakCount: r?.newStreakCount ?? 0,
        gameCostPaid: costForPlayer(p.userId),
      }
      io.to(sid).emit('game:finished', {
        winner: winner as any,
        finalRound: roundPayload as any,
        rewards,
      })
    }
    // Fallback: if nobody was online for a per-socket emit (everyone
    // disconnected, or socket mapping stale), broadcast to the room so
    // anyone still listening — or anyone who reconnects in time — gets the
    // result. The broadcast uses the first player's bonus breakdown as a
    // representative payload.
    if (!emittedToSomeone) {
      const firstPlayer = state.players[0]
      const r = firstPlayer ? perPlayerRewards.get(firstPlayer.userId) : undefined
      const fallbackRewards = {
        starCoinsEarned: r?.base ?? 0,
        xpEarned,
        lpChange,
        achievements: [] as any[],
        dailyBonusEarned: r?.daily ?? 0,
        streakBonusEarned: r?.streak ?? 0,
        newStreakCount: r?.newStreakCount ?? 0,
        gameCostPaid: firstPlayer ? costForPlayer(firstPlayer.userId) : 0,
      }
      io.to(`room:${roomId}`).emit('game:finished', {
        winner: winner as any,
        finalRound: roundPayload as any,
        rewards: fallbackRewards,
      })
    }
    await resetRoomAfterGame(roomId, state)
  } catch (err) { logger.error({ err }, '[finishGameWithWinner] emit error') } }, 3000)
}

// ─── Entry point called after game:start ─────────────────────────────────────

export async function startRound(
  io: IO,
  roomId: string,
  speakingTimeSeconds: number,
  votingTimeSeconds: number,
) {
  logger.info({ roomId }, 'starting round')
  clearRoomTimer(roomId)

  // Vocal mode (unranked only): instead of a single clue-phase window where
  // everyone types, iterate over each alive player and give them their own
  // per-player "speak out loud" turn. No text is submitted.
  const state = await getState(roomId)
  if (state?.vocalMode) {
    const perTurn = Math.min(60, Math.max(5, Number(state.vocalSpeakingTimeSeconds) || 10))
    await startVocalSpeakingPhase(io, roomId, perTurn, votingTimeSeconds)
    return
  }

  await startCluePhase(io, roomId, speakingTimeSeconds, votingTimeSeconds)
}

// ─── Vocal speaking phase (turn-based, no text) ──────────────────────────────
//
// Each alive player gets `perTurnSeconds` to speak out loud. The server
// iterates through the round's `speakingOrder` one player at a time, emitting
// `round:vocal-turn` for each speaker. When every speaker has finished (or the
// current speaker emits `vocal:skip-turn`), we advance to the voting phase.
//
// We also emit a `round:speaking-turn` event at the start so existing client
// code that keys off that event (phase reset, clue list clearing, etc.) still
// fires exactly once — but with the total vocal duration as the timer. The
// per-turn countdown is driven by the `round:vocal-turn` payloads.
async function startVocalSpeakingPhase(
  io: IO,
  roomId: string,
  perTurnSeconds: number,
  votingTimeSeconds: number,
) {
  const state = await getState(roomId)
  if (!state) {
    io.to(`room:${roomId}`).emit('error', { code: 'GAME_STATE_LOST', message: 'Game interrupted. Please reconnect.' })
    return
  }
  if (state.status !== 'in_progress') return

  const currentRound = state.rounds?.[state.currentRound - 1]
  if (!currentRound) return

  // Only alive players take a turn. Preserve the round's `speakingOrder`.
  const aliveIds = new Set(state.players.filter((p: any) => p.status === 'alive').map((p: any) => p.userId))
  const fullOrder: string[] = currentRound.speakingOrder ?? []
  const vocalOrder: string[] = fullOrder.filter((id) => aliveIds.has(id))

  // Edge case: no alive players — jump straight to voting so the game doesn't
  // stall. Should never happen in practice (checkWinCondition would have fired
  // first), but we guard anyway.
  if (vocalOrder.length === 0) {
    await startVoting(io, roomId, votingTimeSeconds)
    return
  }

  const totalSeconds = perTurnSeconds * vocalOrder.length

  // Phase-level state for sync/reconnect.
  state.currentSpeakerId = vocalOrder[0]
  state.phaseStartedAt = Date.now()
  state.phaseDurationSeconds = totalSeconds
  state.votingTimeSeconds = votingTimeSeconds
  state.vocalTurnIndex = 0
  state.vocalPerTurnSeconds = perTurnSeconds
  state.vocalSpeakingOrder = vocalOrder
  await saveState(roomId, state)

  // Fire the legacy clue-phase event so existing client listeners reset their
  // per-round UI state (clears previous clues, resets `hasSubmittedClue`, etc).
  io.to(`room:${roomId}`).emit('round:speaking-turn', {
    playerId: null,
    timeSeconds: totalSeconds,
    speakingOrder: vocalOrder,
  })

  // Kick off the first turn.
  await startVocalTurn(io, roomId, 0)
}

async function startVocalTurn(io: IO, roomId: string, index: number) {
  const state = await getState(roomId)
  if (!state || state.status !== 'in_progress') return
  const order: string[] = state.vocalSpeakingOrder ?? []
  const perTurnSeconds: number = state.vocalPerTurnSeconds ?? 10
  const votingTimeSeconds: number = state.votingTimeSeconds ?? 30

  // All turns done → move to voting.
  if (index >= order.length) {
    clearRoomTimer(roomId)
    await startVoting(io, roomId, votingTimeSeconds)
    return
  }

  const speakerId = order[index]
  state.vocalTurnIndex = index
  state.currentSpeakerId = speakerId
  state.phaseStartedAt = Date.now()
  await saveState(roomId, state)

  const totalRemaining = perTurnSeconds * (order.length - index)
  io.to(`room:${roomId}`).emit('round:vocal-turn', {
    speakerId,
    speakerIndex: index,
    totalSpeakers: order.length,
    perTurnSeconds,
    totalSeconds: totalRemaining,
    speakingOrder: order,
  })

  clearRoomTimer(roomId)
  const timer = setTimeout(async () => {
    try {
      roomTimers.delete(roomId)
      await startVocalTurn(io, roomId, index + 1)
    } catch (err) {
      logger.error({ err }, '[vocalTurn] timeout error')
    }
  }, perTurnSeconds * 1000)
  roomTimers.set(roomId, timer)
}

/**
 * Called from the `vocal:skip-turn` handler when the current speaker taps
 * "Done" before their timer runs out. Only the current speaker can skip their
 * own turn.
 */
export async function skipVocalTurn(io: IO, roomId: string, userId: string) {
  const state = await getState(roomId)
  if (!state || state.status !== 'in_progress') return
  if (!state.vocalMode) return
  const order: string[] = state.vocalSpeakingOrder ?? []
  const idx: number = typeof state.vocalTurnIndex === 'number' ? state.vocalTurnIndex : -1
  if (idx < 0 || idx >= order.length) return
  if (order[idx] !== userId) return // only the current speaker can skip
  clearRoomTimer(roomId)
  await startVocalTurn(io, roomId, idx + 1)
}

// ─── Clue phase (everyone submits simultaneously) ────────────────────────────

async function startCluePhase(
  io: IO,
  roomId: string,
  speakingTimeSeconds: number,
  votingTimeSeconds: number,
) {
  const state = await getState(roomId)
  if (!state) {
    io.to(`room:${roomId}`).emit('error', { code: 'GAME_STATE_LOST', message: 'Game interrupted. Please reconnect.' })
    return
  }
  if (state.status !== 'in_progress') return

  const currentRound = state.rounds?.[state.currentRound - 1]
  if (!currentRound) return

  const order: string[] = currentRound.speakingOrder ?? []

  // Track phase timing for sync/reconnect
  state.currentSpeakerId = null  // no individual speaker — everyone speaks at once
  state.phaseStartedAt = Date.now()
  state.phaseDurationSeconds = speakingTimeSeconds
  state.votingTimeSeconds = votingTimeSeconds  // store for tryEarlyVoting
  await saveState(roomId, state)

  // Notify all clients: everyone can submit their clue now
  io.to(`room:${roomId}`).emit('round:speaking-turn', { playerId: null, timeSeconds: speakingTimeSeconds, speakingOrder: order })

  const timer = setTimeout(async () => { try {
    roomTimers.delete(roomId)
    await startVoting(io, roomId, votingTimeSeconds)
  } catch (err) { logger.error({ err }, '[cluePhase] timeout error') } }, speakingTimeSeconds * 1000)
  roomTimers.set(roomId, timer)
}

// Called from clue:submit when all alive players have submitted
export async function tryEarlyVoting(io: IO, roomId: string) {
  const state = await getState(roomId)
  if (!state || state.status !== 'in_progress') return

  const currentRound = state.rounds?.[state.currentRound - 1]
  if (!currentRound) return

  const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
  const cluePlayerIds = new Set((currentRound.clues ?? []).map((c: any) => c.playerId))
  const allSubmitted = alivePlayers.every((p: any) => cluePlayerIds.has(p.userId))

  if (allSubmitted) {
    clearRoomTimer(roomId)
    // Transition directly to voting — no artificial delay when everyone is ready
    await startVoting(io, roomId, state.votingTimeSeconds ?? 30)
  }
}

// ─── Voting phase ─────────────────────────────────────────────────────────────

async function startVoting(io: IO, roomId: string, votingTimeSeconds: number) {
  const state = await getState(roomId)
  if (!state) {
    io.to(`room:${roomId}`).emit('error', { code: 'GAME_STATE_LOST', message: 'Game interrupted. Please reconnect.' })
    return
  }
  state.status = 'voting'
  state.currentSpeakerId = null
  state.phaseStartedAt = Date.now()
  state.phaseDurationSeconds = votingTimeSeconds
  await saveState(roomId, state)

  const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
  io.to(`room:${roomId}`).emit('round:voting-started', { timeSeconds: votingTimeSeconds, players: alivePlayers })

  // Push notification for voting phase
  const aliveUserIds = alivePlayers.map((p: any) => p.userId)
  getPushTokensForUsers(aliveUserIds).then((tokenMap) => {
    if (tokenMap.size > 0) {
      sendPushNotifications(
        Array.from(tokenMap.entries()).map(([userId, pushToken]) => ({
          pushToken,
          title: 'Time to Vote!',
          body: 'Cast your vote now.',
          data: { type: 'voting_phase', roomId },
        })),
      ).catch((err) => logger.error({ err, roomId }, 'push: voting notification error'))
    }
  }).catch(() => {})

  const timer = setTimeout(async () => { try {
    roomTimers.delete(roomId)
    await resolveRound(io, roomId)
  } catch (err) { logger.error({ err }, '[resolveRound] timeout error') } }, votingTimeSeconds * 1000)
  roomTimers.set(roomId, timer)
}

// Called from vote:cast when all alive players have voted
export async function tryEarlyResolve(io: IO, roomId: string) {
  const state = await getState(roomId)
  if (!state || state.status !== 'voting') return

  const currentRound = state.rounds?.[state.currentRound - 1]
  if (!currentRound) return

  const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
  const votes = currentRound.votes ?? []
  const voterIds = new Set(votes.map((v: any) => v.voterId))
  const allVoted = alivePlayers.every((p: any) => voterIds.has(p.userId))

  if (allVoted) {
    clearRoomTimer(roomId)
    io.to(`room:${roomId}`).emit('vote:all-cast' as any)
    // Resolve directly — no artificial delay when everyone has voted
    await resolveRound(io, roomId)
  }
}

// ─── Round resolution ─────────────────────────────────────────────────────────

async function resolveRound(io: IO, roomId: string) {
  // ── Atomic guard: prevent double-resolution race condition ───────────────────
  // (can happen when early-resolve timer and voting timer both fire near-simultaneously)
  const resolveKey = `room:${roomId}:resolving`
  const acquired = await (redis as any).set(resolveKey, '1', 'EX', 10, 'NX')
  if (!acquired) return
  try {
    await _resolveRound(io, roomId)
  } finally {
    await redis.del(resolveKey)
  }
}

async function _resolveRound(io: IO, roomId: string) {
  const state = await getState(roomId)
  if (!state) {
    io.to(`room:${roomId}`).emit('error', { code: 'GAME_STATE_LOST', message: 'Game interrupted. Please reconnect.' })
    return
  }

  const currentRound = state.rounds?.[state.currentRound - 1]
  if (!currentRound) return

  logger.info(
    {
      roomId,
      round: state.currentRound,
      voteCount: (currentRound.votes ?? []).length,
      aliveCount: (state.players as any[]).filter((p) => p.status === 'alive').length,
    },
    '[resolveRound] resolving round',
  )

  // Find most-voted player (by userId). Uses the weighted tally helper so the
  // Mayor's one-shot double vote + Corruptor silent drop + Inverter flip are honored.
  const { mostVotedId, tiedIds: weightedTiedIds, weightedTally, inverted } = tallyVotes(
    currentRound.votes ?? [],
    state.players,
  )
  logger.info(
    { roomId, round: state.currentRound, mostVotedId, weightedTiedIds, weightedTally, inverted },
    '[resolveRound] tally complete',
  )
  let eliminatedRole: string | null = null
  // Flag that the jester won this round; drives the immediate end-of-game path below.
  let jesterWonThisRound = false
  // Flag that the kamikaze was eliminated by vote and owes us a target pick.
  let kamikazePending = false

  if (mostVotedId) {
    const targetPlayer = state.players.find((p: any) => p.userId === mostVotedId)

    // ── Guardian protection check ──────────────────────────────────────────────
    if (targetPlayer && targetPlayer.guardianProtected) {
      // Protection triggered — cancel elimination
      logger.info(
        { roomId, protectedUserId: mostVotedId, round: state.currentRound },
        '[resolveRound] guardian protection triggered',
      )
      targetPlayer.guardianProtected = false
      currentRound.eliminatedPlayerId = null
      currentRound.eliminatedRole = null
      currentRound.guardianProtectionTriggered = true
      currentRound.guardianProtectedPlayerId = mostVotedId
      io.to(`room:${roomId}`).emit('guardian:protection-triggered' as any, {
        protectedUserId: mostVotedId,
        protectedUsername: targetPlayer.username,
      })
    } else {
      // Normal elimination
      if (targetPlayer) {
        targetPlayer.status = 'eliminated'
        eliminatedRole = targetPlayer.role ?? null
        logger.info(
          {
            roomId,
            round: state.currentRound,
            eliminatedUserId: mostVotedId,
            eliminatedRole,
            reason: 'vote',
          },
          '[resolveRound] player eliminated by vote',
        )
        // ── Post-elimination housekeeping (corruptor freeing, revenant start) ──
        onPlayerEliminated(state, mostVotedId)
        // ── Jester solo-win check ──
        // Eliminated by vote (not said_word) → jester wins alone immediately.
        if (targetPlayer.role === 'jester') {
          jesterWonThisRound = true
          logger.info({ roomId, jesterUserId: mostVotedId }, '[resolveRound] JESTER WIN — voted out')
        }
        // ── Kamikaze: gets one last target pick before we proceed ──
        if (targetPlayer.role === 'kamikaze') {
          kamikazePending = true
          logger.info({ roomId, kamikazeUserId: mostVotedId }, '[resolveRound] kamikaze pending target pick')
        }
      }
      currentRound.eliminatedPlayerId = mostVotedId
      currentRound.eliminatedRole = eliminatedRole

      // Push notification to eliminated player
      getPushTokensForUsers([mostVotedId]).then((tokenMap) => {
        const token = tokenMap.get(mostVotedId)
        if (token) {
          sendPushNotification(token, "You've been eliminated!", 'Better luck next time.', { type: 'eliminated', roomId }).catch(() => {})
        }
      }).catch(() => {})
    }
  } else {
    // Tie vote — start tiebreaker clue phase for tied players
    const tiedPlayerIds = weightedTiedIds.length > 0
      ? weightedTiedIds
      : getTiedPlayerIds(currentRound.votes ?? [])
    logger.info(
      { roomId, round: state.currentRound, tiedPlayerIds },
      '[resolveRound] tie detected — starting tiebreaker',
    )
    currentRound.eliminatedPlayerId = null
    currentRound.eliminatedRole = null

    // Persist votes to RoundVote table before tiebreaker
    const dbRoundForTie = await prisma.round.findUnique({ where: { id: currentRound.id } }).catch(() => null)
    if (dbRoundForTie && (currentRound.votes ?? []).length > 0) {
      await prisma.roundVote.createMany({
        data: (currentRound.votes as any[]).map((v: any) => ({
          roundId:  dbRoundForTie.id,
          voterId:  v.voterId,
          targetId: v.targetId,
        })),
        skipDuplicates: true,
      }).catch((err: any) => logger.error('[tie-votes] persist error:', err))
    }

    await saveState(roomId, state)

    // Start tiebreaker after a short reveal delay
    const roomForTie = await prisma.room.findUnique({ where: { id: roomId } }).catch(() => null)
    const tbSpeaking = roomForTie?.speakingTimeSeconds ?? 30
    const tbVoting   = roomForTie?.votingTimeSeconds ?? 30
    const t = setTimeout(async () => {
      roomTimers.delete(roomId)
      await startTiebreakerCluePhase(io, roomId, tiedPlayerIds, tbSpeaking, tbVoting)
    }, 3000)
    roomTimers.set(roomId, t)
    return   // Do NOT fall through to round:ended — tiebreaker handles that
  }

  // ── Kamikaze pending: stop here and wait for their target pick ─────────────
  // The kamikaze's elimination is already applied, and they owe a target
  // choice before the round truly ends. We persist the pending marker,
  // prompt the kamikaze via socket, and return without advancing.
  // The kamikaze:pick-target handler will call resolveKamikazeSelection()
  // which re-enters the round-finalisation flow.
  if (kamikazePending && mostVotedId) {
    state.kamikazePendingUserId = mostVotedId
    state.kamikazePendingRoundNumber = state.currentRound
    // Update DB so an eventual reconnect sees the elimination
    const dbRoundForKamikaze = await prisma.round.findUnique({ where: { id: currentRound.id } }).catch(() => null)
    if (dbRoundForKamikaze) {
      await prisma.round.update({
        where: { id: dbRoundForKamikaze.id },
        data: { eliminatedId: mostVotedId, eliminatedRole },
      }).catch(() => {})
    }
    await saveState(roomId, state)

    // Build a short-list of alive player IDs (kamikaze cannot pick themselves)
    const candidateIds = state.players
      .filter((p: any) => p.status === 'alive' && p.userId !== mostVotedId)
      .map((p: any) => p.userId)

    const KAMIKAZE_PICK_SECONDS = 15
    io.to(`room:${roomId}`).emit('kamikaze:select-prompt' as any, {
      candidateUserIds: candidateIds,
      timeSeconds: KAMIKAZE_PICK_SECONDS,
    })

    // Timeout: no choice → auto-pick random candidate (excluding kamikaze itself)
    clearRoomTimer(roomId)
    const t = setTimeout(async () => {
      roomTimers.delete(roomId)
      const fallback = candidateIds[Math.floor(Math.random() * candidateIds.length)]
      if (fallback) {
        await resolveKamikazeSelection(io, roomId, mostVotedId, fallback)
      }
    }, KAMIKAZE_PICK_SECONDS * 1000)
    roomTimers.set(roomId, t)
    return
  }

  // Add word reveal from DB
  const dbRound = await prisma.round.findUnique({ where: { id: currentRound.id } }).catch(() => null)
  currentRound.wordReveal = dbRound
    ? { villagerWord: dbRound.villagerWord, redHandedWord: dbRound.redHandedWord }
    : null

  // ── Persist votes to RoundVote table ────────────────────────────────────────
  if (dbRound && (currentRound.votes ?? []).length > 0) {
    await prisma.roundVote.createMany({
      data: (currentRound.votes as any[]).map((v: any) => ({
        roundId:  dbRound.id,
        voterId:  v.voterId,
        targetId: v.targetId,
      })),
      skipDuplicates: true,
    }).catch((err: any) => logger.error('[votes] persist error:', err))
  }

  // Update DB round with elimination and mark participation as not survived
  if (mostVotedId && dbRound) {
    await prisma.round.update({
      where: { id: dbRound.id },
      data: { eliminatedId: mostVotedId, eliminatedRole },
    }).catch(() => {})
    const game = await prisma.game.findFirst({ where: { roomId }, orderBy: { startedAt: 'desc' } }).catch(() => null)
    if (game) {
      await prisma.gameParticipation.updateMany({
        where: { gameId: game.id, userId: mostVotedId },
        data: { survived: false },
      }).catch(() => {})
    }
  }

  // ── Decrement revenant post-mortem vote counters ──
  tickRevenantVotes(state, currentRound)

  // ── Reset per-round ability flags (mayor double-vote + inverter flip) ─────
  resetAbilityFlagsAtRoundEnd(state)

  const roundPayload = buildRoundPayload(currentRound)

  // Check win condition. Jester solo-win short-circuits the standard check;
  // evil_twins override lives inside checkWinCondition itself.
  const winner: Winner | null =
    jesterWonThisRound ? 'jester' : checkWinCondition(state.players as any)

  if (winner) {
    logger.info({ roomId, round: state.currentRound, winner }, '[resolveRound] winner decided')
    await finishGameWithWinner(io, roomId, state, winner, roundPayload)
  } else {
    // Start next round
    const room = await prisma.room.findUnique({ where: { id: roomId } }).catch(() => null)
    if (!room) return

    const game = await prisma.game.findFirst({
      where: { roomId },
      orderBy: { startedAt: 'desc' },
    }).catch(() => null)
    if (!game) return

    const nextRoundNumber = state.currentRound + 1
    const maxRounds = state.maxRounds ?? 0   // 0 = unlimited
    const HARD_MAX_ROUNDS = 30               // Absolute cap — ends as a draw

    // ── Hard 30-round cap → draw ─────────────────────────────────────────────
    if (nextRoundNumber > HARD_MAX_ROUNDS) {
      await finishGameWithWinner(io, roomId, state, 'draw', roundPayload)
      return
    }

    // RedHanded win if they survive all rounds (only when a round limit is set)
    // Re-check win condition first — all redHanded may have been eliminated this final round
    if (maxRounds > 0 && nextRoundNumber > maxRounds) {
      const finalWinner = checkWinCondition(state.players as any)
      if (finalWinner && finalWinner !== 'red_handed') {
        await finishGameWithWinner(io, roomId, state, finalWinner, roundPayload)
        return
      }
      // Survival win for redHanded — uses the lighter survival LP rewards
      // instead of the standard delta. Inlined here to keep the special LP table.
      state.status = 'finished'
      await saveState(roomId, state)
      await prisma.room.update({ where: { id: roomId }, data: { status: 'finished' } }).catch(() => {})
      if (game) {
        await prisma.game.update({ where: { id: game.id }, data: { winnerTeam: 'red_handed', endedAt: new Date() } }).catch(() => {})
      }
      io.to(`room:${roomId}`).emit('round:ended', { round: roundPayload as any })
      const isRankedSurvival = state.gameMode === 'ranked'
      if (isRankedSurvival) {
        await applyRankedLP(io, roomId, state.players, (player) => getSurvivalLpDelta(player.role ?? ''))
      }
      await applyXpAndLevel(io, state.players, 'red_handed', isRankedSurvival)
      const survivalLpChange = isRankedSurvival ? LP_REWARDS.SURVIVAL_VILLAGER_LOSS : 0
      const rewards = { starCoinsEarned: 80, xpEarned: 120, lpChange: survivalLpChange, achievements: [] }
      setTimeout(async () => { try {
        io.to(`room:${roomId}`).emit('game:finished', { winner: 'red_handed', finalRound: roundPayload as any, rewards })
        await resetRoomAfterGame(roomId, state)
      } catch (err) { logger.error({ err }, '[survival:game:finished] emit error') } }, 3000)
      return
    }
    const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
    const nextSpeakingOrder: string[] = alivePlayers.map((p: any) => p.userId)

    const nextDbRound = await prisma.round.create({
      data: {
        gameId: game.id,
        roundNumber: nextRoundNumber,
        villagerWord: dbRound?.villagerWord ?? '',
        redHandedWord: dbRound?.redHandedWord ?? '',
      },
    }).catch(() => null)
    if (!nextDbRound) return

    state.currentRound = nextRoundNumber
    state.status = 'in_progress'  // reset from 'voting' so clue phase can proceed
    state.rounds.push({
      id: nextDbRound.id,
      roundNumber: nextRoundNumber,
      votes: [],
      clues: [],
      speakingOrder: nextSpeakingOrder,
    })
    await saveState(roomId, state)

    const nextRoundPayload = {
      id: nextDbRound.id,
      roundNumber: nextRoundNumber,
      speakingOrder: nextSpeakingOrder,
      clues: [],
      votes: [],
      eliminatedPlayerId: null,
      eliminatedRole: null,
      wordReveal: null,
    }

    // Strip wordReveal from mid-game round:ended — words are only revealed at game end
    io.to(`room:${roomId}`).emit('round:ended', {
      round: { ...roundPayload, wordReveal: null } as any,
      nextRound: nextRoundPayload as any,
    })

    // Start next round after 5s reveal
    setTimeout(async () => { try {
      await startRound(io, roomId, room.speakingTimeSeconds, room.votingTimeSeconds)
    } catch (err) { logger.error({ err }, '[startRound] timeout error') } }, 5000)
  }
}

// ─── Tiebreaker phase ─────────────────────────────────────────────────────────

async function startTiebreakerCluePhase(
  io: IO,
  roomId: string,
  tiedPlayerIds: string[],
  speakingTimeSeconds: number,
  votingTimeSeconds: number,
) {
  const state = await getState(roomId)
  if (!state) return

  state.tiebreakerActive = true
  state.tiebreakerPlayerIds = tiedPlayerIds
  state.tiebreakerPhase = 'clue'
  state.tiebreakerClues = []
  state.tiebreakerVotes = []
  state.status = 'in_progress'
  state.phaseStartedAt = Date.now()
  state.phaseDurationSeconds = speakingTimeSeconds
  state.votingTimeSeconds = votingTimeSeconds
  await saveState(roomId, state)

  const tiedPlayers = state.players.filter((p: any) => tiedPlayerIds.includes(p.userId))
  io.to(`room:${roomId}`).emit('round:tiebreaker-start' as any, {
    tiedPlayerIds,
    tiedUsernames: tiedPlayers.map((p: any) => p.username),
    timeSeconds: speakingTimeSeconds,
  })

  const timer = setTimeout(async () => { try {
    roomTimers.delete(roomId)
    await startTiebreakerVoting(io, roomId)
  } catch (err) { logger.error({ err }, '[tiebreakerClue] timeout error') } }, speakingTimeSeconds * 1000)
  roomTimers.set(roomId, timer)
}

async function startTiebreakerVoting(io: IO, roomId: string) {
  const state = await getState(roomId)
  if (!state) return

  const tiedPlayerIds: string[] = state.tiebreakerPlayerIds ?? []
  const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
  const eligibleVoters = alivePlayers.filter((p: any) => !tiedPlayerIds.includes(p.userId))

  // If ALL alive players are tied, no one can vote — skip to next round
  if (eligibleVoters.length === 0) {
    state.tiebreakerActive = false
    state.tiebreakerPhase = null
    state.tiebreakerPlayerIds = []
    state.tiebreakerVotes = []
    state.status = 'in_progress'
    await saveState(roomId, state)
    // Proceed to next round with no elimination (tie stands)
    await resolveRoundNoElimination(io, roomId, state)
    return
  }

  // ── Judge override ────────────────────────────────────────────────────────
  // If an alive judge exists who is NOT in the tied set, they decide unilaterally.
  // The tiebreaker clue phase already ran (so tied players had their say); now
  // instead of a normal vote, we prompt the judge to pick one of the tied players.
  // The judge cannot save themselves if they are in the tied set (falls through
  // to a normal tiebreaker vote in that case).
  const judge = alivePlayers.find((p: any) => p.role === 'judge' && !tiedPlayerIds.includes(p.userId))
  if (judge) {
    state.tiebreakerPhase = 'judge'
    state.status = 'in_progress'
    state.judgeDecisionPendingUserId = judge.userId
    state.phaseStartedAt = Date.now()
    const JUDGE_DECIDE_SECONDS = 20
    state.phaseDurationSeconds = JUDGE_DECIDE_SECONDS
    await saveState(roomId, state)

    const candidateUsernames = tiedPlayerIds.map((id: string) =>
      state.players.find((p: any) => p.userId === id)?.username ?? id,
    )
    const judgeSocketId = onlineUsers.get(judge.userId)
    if (judgeSocketId) {
      io.to(judgeSocketId).emit('judge:decide-prompt' as any, {
        candidateUserIds: tiedPlayerIds,
        candidateUsernames,
        timeSeconds: JUDGE_DECIDE_SECONDS,
      })
    }
    // Timeout: no decision → auto-pick a random tied player
    clearRoomTimer(roomId)
    const t = setTimeout(async () => {
      roomTimers.delete(roomId)
      const fallback = tiedPlayerIds[Math.floor(Math.random() * tiedPlayerIds.length)]
      if (fallback) await resolveJudgeDecision(io, roomId, judge.userId, fallback)
    }, JUDGE_DECIDE_SECONDS * 1000)
    roomTimers.set(roomId, t)
    return
  }

  state.tiebreakerPhase = 'vote'
  state.status = 'voting'
  state.phaseStartedAt = Date.now()
  const votingTimeSeconds = state.votingTimeSeconds ?? 30
  state.phaseDurationSeconds = votingTimeSeconds
  await saveState(roomId, state)

  io.to(`room:${roomId}`).emit('round:tiebreaker-voting' as any, {
    tiedPlayerIds,
    timeSeconds: votingTimeSeconds,
  })

  const timer = setTimeout(async () => { try {
    roomTimers.delete(roomId)
    await resolveTiebreaker(io, roomId)
  } catch (err) { logger.error({ err }, '[tiebreakerVoting] timeout error') } }, votingTimeSeconds * 1000)
  roomTimers.set(roomId, timer)
}

/** All alive players were tied — no one can vote. End round with no elimination, start next. */
async function resolveRoundNoElimination(io: IO, roomId: string, state: any) {
  const currentRound = state.rounds?.[state.currentRound - 1]
  const roundPayload = currentRound ? buildRoundPayload(currentRound) : null

  const room = await prisma.room.findUnique({ where: { id: roomId } }).catch(() => null)
  const game = await prisma.game.findFirst({ where: { roomId }, orderBy: { startedAt: 'desc' } }).catch(() => null)
  if (!room || !game) return

  // ── Stalemate check: 3 consecutive rounds with no elimination → draw ─────────
  if (countConsecutiveNoElimRounds(state.rounds) >= STALEMATE_ROUNDS) {
    await finishGameWithWinner(io, roomId, state, 'draw', roundPayload)
    return
  }

  const nextRoundNumber = state.currentRound + 1
  const dbRound = currentRound
    ? await prisma.round.findUnique({ where: { id: currentRound.id } }).catch(() => null)
    : null

  const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
  const nextSpeakingOrder: string[] = alivePlayers.map((p: any) => p.userId)
  const nextDbRound = await prisma.round.create({
    data: {
      gameId: game.id,
      roundNumber: nextRoundNumber,
      villagerWord: dbRound?.villagerWord ?? '',
      redHandedWord: dbRound?.redHandedWord ?? '',
    },
  }).catch(() => null)
  if (!nextDbRound) return

  state.currentRound = nextRoundNumber
  state.status = 'in_progress'
  state.rounds.push({
    id: nextDbRound.id,
    roundNumber: nextRoundNumber,
    votes: [],
    clues: [],
    speakingOrder: nextSpeakingOrder,
  })
  await saveState(roomId, state)

  const nextRoundPayload = {
    id: nextDbRound.id, roundNumber: nextRoundNumber, speakingOrder: nextSpeakingOrder,
    clues: [], votes: [], eliminatedPlayerId: null, eliminatedRole: null, wordReveal: null,
  }
  if (roundPayload) {
    io.to(`room:${roomId}`).emit('round:ended', { round: roundPayload as any, nextRound: nextRoundPayload as any })
  }
  setTimeout(async () => { try {
    await startRound(io, roomId, room.speakingTimeSeconds, room.votingTimeSeconds)
  } catch (err) { logger.error({ err }, '[tiebreaker:noVoters:startRound] error') } }, 5000)
}

async function resolveTiebreaker(io: IO, roomId: string) {
  const state = await getState(roomId)
  if (!state) return

  const tiebreakerVotes: any[] = state.tiebreakerVotes ?? []
  // (tiedPlayerIds no longer needed — tally honors them implicitly)

  // Clear tiebreaker state
  state.tiebreakerActive = false
  state.tiebreakerPhase = null
  state.status = 'in_progress'

  // Find who to eliminate from tiebreaker votes (honor mayor double-vote)
  const { mostVotedId: eliminatedId } = tallyVotes(tiebreakerVotes, state.players)

  await finalizeTiebreakerElimination(io, roomId, state, eliminatedId)
}

/**
 * Shared finalization for tiebreaker rounds — used by both the normal vote
 * path and the judge-decision path. Applies the elimination, runs housekeeping
 * (revenant tick, corruptor free, mayor/inverter flag reset), checks for
 * jester solo-win and kamikaze pending, and either ends the game via
 * finishGameWithWinner or advances to the next round.
 */
async function finalizeTiebreakerElimination(
  io: IO,
  roomId: string,
  state: any,
  eliminatedId: string | null,
): Promise<void> {
  let jesterWonTiebreaker = false
  let kamikazePending = false

  const currentRound = state.rounds?.[state.currentRound - 1]

  if (eliminatedId) {
    const player = state.players.find((p: any) => p.userId === eliminatedId)
    if (player) {
      player.status = 'eliminated'
      if (currentRound) {
        currentRound.eliminatedPlayerId = eliminatedId
        currentRound.eliminatedRole = player.role ?? null
      }
      // Housekeeping: corruptor free + revenant setup
      onPlayerEliminated(state, eliminatedId)
      if (player.role === 'jester') {
        jesterWonTiebreaker = true
        logger.info({ roomId, jesterUserId: eliminatedId }, '[tiebreaker] JESTER WIN — voted out in tiebreaker')
      }
      if (player.role === 'kamikaze') {
        kamikazePending = true
        logger.info({ roomId, kamikazeUserId: eliminatedId }, '[tiebreaker] kamikaze pending target pick')
      }
    }
    // Persist elimination to DB
    const dbRound = currentRound
      ? await prisma.round.findUnique({ where: { id: currentRound.id } }).catch(() => null)
      : null
    if (dbRound) {
      await prisma.round.update({
        where: { id: dbRound.id },
        data: { eliminatedId, eliminatedRole: currentRound?.eliminatedRole ?? null },
      }).catch(() => {})
    }
    const game = await prisma.game.findFirst({ where: { roomId }, orderBy: { startedAt: 'desc' } }).catch(() => null)
    if (game) {
      await prisma.gameParticipation.updateMany({
        where: { gameId: game.id, userId: eliminatedId },
        data: { survived: false },
      }).catch(() => {})
    }
  }

  // ── Kamikaze pending: stop here, prompt for their target pick ─────────────
  if (kamikazePending && eliminatedId) {
    state.kamikazePendingUserId = eliminatedId
    state.kamikazePendingRoundNumber = state.currentRound
    await saveState(roomId, state)

    const candidateIds = state.players
      .filter((p: any) => p.status === 'alive' && p.userId !== eliminatedId)
      .map((p: any) => p.userId)
    const KAMIKAZE_PICK_SECONDS = 15
    io.to(`room:${roomId}`).emit('kamikaze:select-prompt' as any, {
      candidateUserIds: candidateIds,
      timeSeconds: KAMIKAZE_PICK_SECONDS,
    })

    clearRoomTimer(roomId)
    const t = setTimeout(async () => {
      roomTimers.delete(roomId)
      const fallback = candidateIds[Math.floor(Math.random() * candidateIds.length)]
      if (fallback) await resolveKamikazeSelection(io, roomId, eliminatedId, fallback)
    }, KAMIKAZE_PICK_SECONDS * 1000)
    roomTimers.set(roomId, t)
    return
  }

  // Decrement revenant post-mortem vote counters
  tickRevenantVotes(state, currentRound)
  // Reset per-round ability flags (mayor double-vote + inverter flip)
  resetAbilityFlagsAtRoundEnd(state)
  await saveState(roomId, state)

  // Check win condition — jester short-circuit, then standard (+ evil_twins override)
  const winner: Winner | null =
    jesterWonTiebreaker ? 'jester' : checkWinCondition(state.players as any)
  const roundPayload = currentRound ? buildRoundPayload(currentRound) : null

  if (winner) {
    await finishGameWithWinner(io, roomId, state, winner, roundPayload)
  } else {
    // No winner yet — start next round
    const room = await prisma.room.findUnique({ where: { id: roomId } }).catch(() => null)
    const game = await prisma.game.findFirst({ where: { roomId }, orderBy: { startedAt: 'desc' } }).catch(() => null)
    if (!room || !game) return

    // ── Stalemate check: 3 consecutive rounds with no elimination → draw ───────
    if (countConsecutiveNoElimRounds(state.rounds) >= STALEMATE_ROUNDS) {
      await finishGameWithWinner(io, roomId, state, 'draw', roundPayload)
      return
    }

    const nextRoundNumber = state.currentRound + 1
    const dbRound = currentRound
      ? await prisma.round.findUnique({ where: { id: currentRound.id } }).catch(() => null)
      : null

    const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
    const nextSpeakingOrder: string[] = alivePlayers.map((p: any) => p.userId)
    const nextDbRound = await prisma.round.create({
      data: {
        gameId: game.id,
        roundNumber: nextRoundNumber,
        villagerWord: dbRound?.villagerWord ?? '',
        redHandedWord: dbRound?.redHandedWord ?? '',
      },
    }).catch(() => null)
    if (!nextDbRound) return

    state.currentRound = nextRoundNumber
    state.status = 'in_progress'
    state.rounds.push({
      id: nextDbRound.id,
      roundNumber: nextRoundNumber,
      votes: [],
      clues: [],
      speakingOrder: nextSpeakingOrder,
    })
    await saveState(roomId, state)

    const nextRoundPayload = {
      id: nextDbRound.id, roundNumber: nextRoundNumber, speakingOrder: nextSpeakingOrder,
      clues: [], votes: [], eliminatedPlayerId: null, eliminatedRole: null, wordReveal: null,
    }
    if (roundPayload) {
      // Strip wordReveal from mid-game round:ended — words are only revealed at game end
      io.to(`room:${roomId}`).emit('round:ended', { round: { ...roundPayload, wordReveal: null } as any, nextRound: nextRoundPayload as any })
    }
    setTimeout(async () => { try {
      await startRound(io, roomId, room.speakingTimeSeconds, room.votingTimeSeconds)
    } catch (err) { logger.error({ err }, '[tiebreaker:startRound] error') } }, 5000)
  }
}

export async function tryEarlyTiebreakerVoting(io: IO, roomId: string) {
  const state = await getState(roomId)
  if (!state || !state.tiebreakerActive || state.tiebreakerPhase !== 'clue') return

  const tiedPlayerIds: string[] = state.tiebreakerPlayerIds ?? []
  const tiebreakerClues: any[] = state.tiebreakerClues ?? []
  const submittedIds = new Set(tiebreakerClues.map((c: any) => c.playerId))
  const allSubmitted = tiedPlayerIds.every((id: string) => submittedIds.has(id))

  if (allSubmitted) {
    clearRoomTimer(roomId)
    // Transition directly — no artificial delay when all tied players are ready
    await startTiebreakerVoting(io, roomId)
  }
}

export async function tryEarlyTiebreakerResolve(io: IO, roomId: string) {
  const state = await getState(roomId)
  if (!state || !state.tiebreakerActive || state.tiebreakerPhase !== 'vote') return

  const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
  const tiedPlayerIds: string[] = state.tiebreakerPlayerIds ?? []
  const eligibleVoters = alivePlayers.filter((p: any) => !tiedPlayerIds.includes(p.userId))
  const tiebreakerVotes: any[] = state.tiebreakerVotes ?? []
  const voterIds = new Set(tiebreakerVotes.map((v: any) => v.voterId))
  const allVoted = eligibleVoters.every((p: any) => voterIds.has(p.userId))

  if (allVoted) {
    clearRoomTimer(roomId)
    // Resolve tiebreaker directly — no artificial delay when everyone has voted
    await resolveTiebreaker(io, roomId)
  }
}

// ─── Kamikaze target resolution ───────────────────────────────────────────────

/**
 * Called when the kamikaze has picked a target (or the timeout fallback fires).
 * The kamikaze itself is already eliminated at this point; we apply the target
 * elimination, run post-elimination housekeeping, then continue the round's
 * finalisation (win check → next round or game end).
 */
export async function resolveKamikazeSelection(
  io: IO,
  roomId: string,
  kamikazeUserId: string,
  targetUserId: string,
): Promise<void> {
  const state = await getState(roomId)
  if (!state) return
  // Idempotency: only resolve if we're still waiting on this exact kamikaze
  if (state.kamikazePendingUserId !== kamikazeUserId) return

  const currentRound = state.rounds?.[state.currentRound - 1]
  if (!currentRound) return

  const target = state.players.find((p: any) => p.userId === targetUserId && p.status === 'alive')
  if (!target) {
    // Target no longer valid — clear pending and continue without extra kill
    delete state.kamikazePendingUserId
    delete state.kamikazePendingRoundNumber
    await saveState(roomId, state)
    await continueRoundAfterKamikaze(io, roomId, state, currentRound)
    return
  }

  logger.info({ roomId, kamikazeUserId, targetUserId }, '[kamikaze] target eliminated')

  // Apply target elimination
  target.status = 'eliminated'
  onPlayerEliminated(state, targetUserId)

  // Record on the round — we extend eliminatedPlayerId semantics: the kamikaze
  // was already set as the primary eliminated, so we store the second kill on
  // a separate field so clients can reveal both.
  currentRound.kamikazeKilledUserId = targetUserId
  currentRound.kamikazeKilledRole = target.role ?? null

  const game = await prisma.game.findFirst({ where: { roomId }, orderBy: { startedAt: 'desc' } }).catch(() => null)
  if (game) {
    await prisma.gameParticipation.updateMany({
      where: { gameId: game.id, userId: targetUserId },
      data: { survived: false },
    }).catch(() => {})
  }

  delete state.kamikazePendingUserId
  delete state.kamikazePendingRoundNumber

  io.to(`room:${roomId}`).emit('kamikaze:target-chosen' as any, {
    kamikazeUserId,
    targetUserId,
    targetUsername: target.username,
  })

  await saveState(roomId, state)
  await continueRoundAfterKamikaze(io, roomId, state, currentRound)
}

/**
 * Continues `_resolveRound` flow after a kamikaze has finalised their target.
 * Mirrors the tail end of `_resolveRound`: revenant tick, flag reset, win
 * check, and either finishGameWithWinner or next-round advance.
 */
async function continueRoundAfterKamikaze(
  io: IO,
  roomId: string,
  state: any,
  currentRound: any,
): Promise<void> {
  // Pull word reveal from DB for game-end payloads
  const dbRound = await prisma.round.findUnique({ where: { id: currentRound.id } }).catch(() => null)
  currentRound.wordReveal = dbRound
    ? { villagerWord: dbRound.villagerWord, redHandedWord: dbRound.redHandedWord }
    : null

  // Persist this round's votes (kamikaze elimination came from a vote tally)
  if (dbRound && (currentRound.votes ?? []).length > 0) {
    await prisma.roundVote.createMany({
      data: (currentRound.votes as any[]).map((v: any) => ({
        roundId:  dbRound.id,
        voterId:  v.voterId,
        targetId: v.targetId,
      })),
      skipDuplicates: true,
    }).catch((err: any) => logger.error('[kamikaze:votes] persist error:', err))
  }

  tickRevenantVotes(state, currentRound)
  resetAbilityFlagsAtRoundEnd(state)
  await saveState(roomId, state)

  const roundPayload = buildRoundPayload(currentRound)
  const winner: Winner | null = checkWinCondition(state.players as any)

  if (winner) {
    await finishGameWithWinner(io, roomId, state, winner, roundPayload)
    return
  }

  // Advance to next round
  const room = await prisma.room.findUnique({ where: { id: roomId } }).catch(() => null)
  const game = await prisma.game.findFirst({ where: { roomId }, orderBy: { startedAt: 'desc' } }).catch(() => null)
  if (!room || !game) return

  const nextRoundNumber = state.currentRound + 1
  const HARD_MAX_ROUNDS = 30
  if (nextRoundNumber > HARD_MAX_ROUNDS) {
    await finishGameWithWinner(io, roomId, state, 'draw', roundPayload)
    return
  }

  const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
  const nextSpeakingOrder: string[] = alivePlayers.map((p: any) => p.userId)
  const nextDbRound = await prisma.round.create({
    data: {
      gameId: game.id,
      roundNumber: nextRoundNumber,
      villagerWord: dbRound?.villagerWord ?? '',
      redHandedWord: dbRound?.redHandedWord ?? '',
    },
  }).catch(() => null)
  if (!nextDbRound) return

  state.currentRound = nextRoundNumber
  state.status = 'in_progress'
  state.rounds.push({
    id: nextDbRound.id,
    roundNumber: nextRoundNumber,
    votes: [],
    clues: [],
    speakingOrder: nextSpeakingOrder,
  })
  await saveState(roomId, state)

  const nextRoundPayload = {
    id: nextDbRound.id, roundNumber: nextRoundNumber, speakingOrder: nextSpeakingOrder,
    clues: [], votes: [], eliminatedPlayerId: null, eliminatedRole: null, wordReveal: null,
  }
  io.to(`room:${roomId}`).emit('round:ended', {
    round: { ...roundPayload, wordReveal: null } as any,
    nextRound: nextRoundPayload as any,
  })
  setTimeout(async () => { try {
    await startRound(io, roomId, room.speakingTimeSeconds, room.votingTimeSeconds)
  } catch (err) { logger.error({ err }, '[kamikaze:startRound] error') } }, 5000)
}

// ─── Judge decision resolution ────────────────────────────────────────────────

/**
 * Called when the judge has picked which tied player to eliminate (or the
 * timeout fallback fires). Mirrors the tail end of `resolveTiebreaker` via
 * `finalizeTiebreakerElimination` so housekeeping/winner flow is identical.
 */
export async function resolveJudgeDecision(
  io: IO,
  roomId: string,
  judgeUserId: string,
  targetUserId: string,
): Promise<void> {
  const state = await getState(roomId)
  if (!state) return
  // Idempotency: only resolve if we're still waiting on this exact judge
  if (state.judgeDecisionPendingUserId !== judgeUserId) return

  const tiedPlayerIds: string[] = state.tiebreakerPlayerIds ?? []
  if (!tiedPlayerIds.includes(targetUserId)) return  // target must be a tied player

  logger.info({ roomId, judgeUserId, targetUserId }, '[judge] decision made')

  // Clear judge-pending marker and tiebreaker metadata
  delete state.judgeDecisionPendingUserId
  state.tiebreakerActive = false
  state.tiebreakerPhase = null

  // Broadcast decision so clients can surface the judge's call
  const target = state.players.find((p: any) => p.userId === targetUserId)
  io.to(`room:${roomId}`).emit('judge:decided' as any, {
    judgeUserId,
    targetUserId,
    targetUsername: target?.username ?? targetUserId,
  })

  // Re-use the tiebreaker finalisation helper
  await finalizeTiebreakerElimination(io, roomId, state, targetUserId)
}

// ─── Word-said instant elimination ────────────────────────────────────────────

export async function eliminatePlayerForWord(
  io: IO,
  roomId: string,
  speakingTimeSeconds: number,
  votingTimeSeconds: number,
): Promise<void> {
  // Check if the said-word elimination triggered a win condition
  const state = await getState(roomId)
  if (state) {
    // Housekeeping for whichever player just died from said_word — the
    // clue:submit handler has already set their status to 'eliminated' and
    // filled in eliminatedPlayerId on the current round.
    const currentRound = state.rounds?.[state.currentRound - 1]
    if (currentRound?.eliminatedPlayerId) {
      onPlayerEliminated(state, currentRound.eliminatedPlayerId)
      await saveState(roomId, state)
    }
    const winner: Winner | null = checkWinCondition(state.players as any)
    if (winner) {
      clearRoomTimer(roomId)
      const roundPayload = currentRound ? buildRoundPayload(currentRound) : null
      await finishGameWithWinner(io, roomId, state, winner, roundPayload)
      return
    }
  }

  // No winner yet — after a short delay, check if all remaining alive players
  // have submitted clues and move to voting early if so.
  setTimeout(async () => { try {
    await tryEarlyVoting(io, roomId)
  } catch (err) { logger.error({ err }, '[word-said] tryEarlyVoting error') } }, 3000)
}

// ─── Forfeit player ───────────────────────────────────────────────────────────

export async function forfeitPlayer(io: IO, roomId: string, userId: string): Promise<void> {
  const state = await getState(roomId)
  if (!state) return

  const player = state.players.find((p: any) => p.userId === userId)
  if (!player || player.status !== 'alive') return

  // Mark as forfeited (treated like eliminated for win condition but gets guaranteed LP loss)
  player.status = 'forfeited'

  const currentRound = state.rounds?.[state.currentRound - 1]
  const phase: string = state.status  // 'in_progress' | 'voting'

  if (currentRound && phase === 'in_progress') {
    // Remove from speaking order so they don't count for early-voting check
    const speakingOrder: string[] = currentRound.speakingOrder ?? []
    currentRound.speakingOrder = speakingOrder.filter((id: string) => id !== userId)
  }

  await saveState(roomId, state)

  // Mark as not survived in DB
  const game = await prisma.game.findFirst({ where: { roomId }, orderBy: { startedAt: 'desc' } }).catch(() => null)
  if (game) {
    await prisma.gameParticipation.updateMany({
      where: { gameId: game.id, userId },
      data:  { survived: false },
    }).catch(() => {})
  }

  // Broadcast forfeit to everyone in the room
  io.to(`room:${roomId}`).emit('game:player-forfeited', { userId, username: player.username })

  // Check if forfeit triggered a win condition
  const winner = checkWinCondition(state.players as any)
  if (winner) {
    clearRoomTimer(roomId)
    await _forfeitEndGame(io, roomId, state, winner, currentRound, game)
    return
  }

  // Handle phase-specific behaviour
  if (phase === 'in_progress') {
    // Check if all remaining alive players have submitted — move to voting early
    await tryEarlyVoting(io, roomId)
  } else if (phase === 'voting') {
    // Forfeited player can't vote — check if remaining alive players have all voted
    await tryEarlyResolve(io, roomId)
  }
}

async function _forfeitEndGame(
  io: IO,
  roomId: string,
  state: any,
  winner: string,
  currentRound: any,
  _game: any,
): Promise<void> {
  const roundPayload = currentRound ? buildRoundPayload(currentRound) : null
  await finishGameWithWinner(io, roomId, state, winner as Winner, roundPayload)
}

// ─── Achievement auto-triggers ────────────────────────────────────────────────
// Replaced in favour of the modular evaluator registry in
// ../services/achievements. Game-end unlocks are now dispatched from
// finishGameWithWinner() via evaluateEvent('game_end', ctx).
