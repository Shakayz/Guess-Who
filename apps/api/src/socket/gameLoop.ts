import type { Server } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { getMostVoted, getTiedPlayerIds, checkWinCondition, computeRankUpdate, LP_REWARDS } from '@imposter/shared'
import type { RankTier } from '@imposter/shared'
import { redis } from '../config/redis'
import { prisma } from '../config/prisma'
import { onlineUsers } from './onlineUsers'

type IO = Server<ClientToServerEvents, ServerToClientEvents>

// Per-room active timers
const roomTimers = new Map<string, NodeJS.Timeout>()

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
    enableDetective:   state.enableDetective ?? false,
    enableDoubleAgent: state.enableDoubleAgent ?? false,
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
  const isImposter = role === 'imposter' || role === 'double_agent'
  if (winner === 'villagers') {
    return isImposter ? LP_REWARDS.IMPOSTER_LOSS : LP_REWARDS.VILLAGER_WIN
  }
  return isImposter ? LP_REWARDS.IMPOSTER_WIN : LP_REWARDS.VILLAGER_LOSS
}

function getSurvivalLpDelta(role: string): number {
  const isImposter = role === 'imposter' || role === 'double_agent'
  return isImposter ? LP_REWARDS.SURVIVAL_IMPOSTER_WIN : LP_REWARDS.SURVIVAL_VILLAGER_LOSS
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
  getLpDelta: (role: string) => number,
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
        ? LP_REWARDS.IMPOSTER_LOSS
        : getLpDelta(player.role ?? '')
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
      }
    })
  )
}

// ─── Entry point called after game:start ─────────────────────────────────────

export async function startRound(
  io: IO,
  roomId: string,
  speakingTimeSeconds: number,
  votingTimeSeconds: number,
) {
  clearRoomTimer(roomId)
  await startCluePhase(io, roomId, speakingTimeSeconds, votingTimeSeconds)
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
  } catch (err) { console.error('[cluePhase] timeout error:', err) } }, speakingTimeSeconds * 1000)
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
    // Small delay so the last clue is visible before transitioning
    const t = setTimeout(async () => {
      roomTimers.delete(roomId)
      await startVoting(io, roomId, state.votingTimeSeconds ?? 30)
    }, 1500)
    roomTimers.set(roomId, t)
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

  const timer = setTimeout(async () => { try {
    roomTimers.delete(roomId)
    await resolveRound(io, roomId)
  } catch (err) { console.error('[resolveRound] timeout error:', err) } }, votingTimeSeconds * 1000)
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
    // Store timer so it can be cancelled if needed, preventing double-resolution
    const t = setTimeout(() => {
      roomTimers.delete(roomId)
      resolveRound(io, roomId)
    }, 1500)
    roomTimers.set(roomId, t)
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

  // Find most-voted player (by userId)
  const mostVotedId = getMostVoted(currentRound.votes ?? [])
  let eliminatedRole: string | null = null

  if (mostVotedId) {
    const player = state.players.find((p: any) => p.userId === mostVotedId)
    if (player) {
      player.status = 'eliminated'
      eliminatedRole = player.role ?? null
    }
    currentRound.eliminatedPlayerId = mostVotedId
    currentRound.eliminatedRole = eliminatedRole
  } else {
    // Tie vote — start tiebreaker clue phase for tied players
    const tiedPlayerIds = getTiedPlayerIds(currentRound.votes ?? [])
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
      }).catch((err: any) => console.error('[tie-votes] persist error:', err))
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

  // Add word reveal from DB
  const dbRound = await prisma.round.findUnique({ where: { id: currentRound.id } }).catch(() => null)
  currentRound.wordReveal = dbRound
    ? { villagerWord: dbRound.villagerWord, imposterWord: dbRound.imposterWord }
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
    }).catch((err: any) => console.error('[votes] persist error:', err))
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

  const roundPayload = buildRoundPayload(currentRound)

  // Check win condition
  const winner = checkWinCondition(state.players as any)

  if (winner) {
    state.status = 'finished'
    await saveState(roomId, state)
    await prisma.room.update({ where: { id: roomId }, data: { status: 'finished' } }).catch(() => {})
    const finishedGame = await prisma.game.findFirst({ where: { roomId }, orderBy: { startedAt: 'desc' } }).catch(() => null)
    if (finishedGame) {
      await prisma.game.update({ where: { id: finishedGame.id }, data: { winnerTeam: winner, endedAt: new Date() } }).catch(() => {})
    }

    io.to(`room:${roomId}`).emit('round:ended', { round: roundPayload as any })

    // ── Achievement triggers ─────────────────────────────────────────────────
    const unlockedByPlayer = await checkAndUnlockAchievements(io, roomId, winner, state, finishedGame?.id ?? null)

    const isRanked = state.gameMode === 'ranked'

    // ── Persist LP per-role + sync rankTier ──────────────────────────────────
    if (isRanked) {
      await applyRankedLP(io, roomId, state.players, (role) => getWinLpDelta(role, winner))
    }
    // Representative delta for the broadcast RewardSummary (villager perspective)
    const lpChange = isRanked ? (winner === 'villagers' ? LP_REWARDS.VILLAGER_WIN : LP_REWARDS.VILLAGER_LOSS) : 0

    const rewards = {
      starCoinsEarned: winner === 'villagers' ? 50 : 80,
      xpEarned: 120,
      lpChange,
      achievements: [],
    }
    setTimeout(async () => { try {
      io.to(`room:${roomId}`).emit('game:finished', {
        winner,
        finalRound: roundPayload as any,
        rewards,
      })
      await resetRoomAfterGame(roomId, state)
    } catch (err) { console.error('[game:finished] emit error:', err) } }, 3000)
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
      state.status = 'finished'
      await saveState(roomId, state)
      await prisma.room.update({ where: { id: roomId }, data: { status: 'finished' } }).catch(() => {})
      if (game) {
        await prisma.game.update({ where: { id: game.id }, data: { winnerTeam: 'draw', endedAt: new Date() } }).catch(() => {})
      }
      io.to(`room:${roomId}`).emit('round:ended', { round: roundPayload as any })
      const drawRewards = { starCoinsEarned: 20, xpEarned: 60, lpChange: 0, achievements: [] }
      setTimeout(async () => { try {
        io.to(`room:${roomId}`).emit('game:finished', { winner: 'draw' as any, finalRound: roundPayload as any, rewards: drawRewards })
        await resetRoomAfterGame(roomId, state)
      } catch (err) { console.error('[draw:game:finished] emit error:', err) } }, 3000)
      return
    }

    // Imposters win if they survive all rounds (only when a round limit is set)
    // Re-check win condition first — all imposters may have been eliminated this final round
    if (maxRounds > 0 && nextRoundNumber > maxRounds) {
      const finalWinner = checkWinCondition(state.players as any)
      if (finalWinner && finalWinner !== 'imposters') {
        // Villagers won on the last round — fall through to normal winner logic above
        // by re-invoking the winner branch inline
        state.status = 'finished'
        await saveState(roomId, state)
        await prisma.room.update({ where: { id: roomId }, data: { status: 'finished' } }).catch(() => {})
        if (game) {
          await prisma.game.update({ where: { id: game.id }, data: { winnerTeam: finalWinner, endedAt: new Date() } }).catch(() => {})
        }
        io.to(`room:${roomId}`).emit('round:ended', { round: roundPayload as any })
        await checkAndUnlockAchievements(io, roomId, finalWinner, state, game?.id ?? null)
        const isRankedFinal = state.gameMode === 'ranked'
        if (isRankedFinal) {
          await applyRankedLP(io, roomId, state.players, (role) => getWinLpDelta(role, finalWinner))
        }
        const lpChangeFinal = isRankedFinal ? LP_REWARDS.VILLAGER_WIN : 0
        setTimeout(async () => { try {
          io.to(`room:${roomId}`).emit('game:finished', { winner: finalWinner, finalRound: roundPayload as any, rewards: { starCoinsEarned: 50, xpEarned: 120, lpChange: lpChangeFinal, achievements: [] } })
          await resetRoomAfterGame(roomId, state)
        } catch (err) { console.error('[game:finished] emit error:', err) } }, 3000)
        return
      }

      state.status = 'finished'
      await saveState(roomId, state)
      await prisma.room.update({ where: { id: roomId }, data: { status: 'finished' } }).catch(() => {})
      io.to(`room:${roomId}`).emit('round:ended', { round: roundPayload as any })
      const isRankedSurvival = state.gameMode === 'ranked'

      // ── Persist LP per-role + sync rankTier (survival win) ─────────────────
      if (isRankedSurvival) {
        await applyRankedLP(io, roomId, state.players, (role) => getSurvivalLpDelta(role))
      }
      const survivalLpChange = isRankedSurvival ? LP_REWARDS.SURVIVAL_VILLAGER_LOSS : 0
      const rewards = { starCoinsEarned: 80, xpEarned: 120, lpChange: survivalLpChange, achievements: [] }
      setTimeout(async () => { try {
        io.to(`room:${roomId}`).emit('game:finished', { winner: 'imposters', finalRound: roundPayload as any, rewards })
        await resetRoomAfterGame(roomId, state)
      } catch (err) { console.error('[game:finished] emit error:', err) } }, 3000)
      return
    }
    const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
    const nextSpeakingOrder: string[] = alivePlayers.map((p: any) => p.userId)

    const nextDbRound = await prisma.round.create({
      data: {
        gameId: game.id,
        roundNumber: nextRoundNumber,
        villagerWord: dbRound?.villagerWord ?? '',
        imposterWord: dbRound?.imposterWord ?? '',
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

    io.to(`room:${roomId}`).emit('round:ended', {
      round: roundPayload as any,
      nextRound: nextRoundPayload as any,
    })

    // Start next round after 5s reveal
    setTimeout(async () => { try {
      await startRound(io, roomId, room.speakingTimeSeconds, room.votingTimeSeconds)
    } catch (err) { console.error('[startRound] timeout error:', err) } }, 5000)
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
  } catch (err) { console.error('[tiebreakerClue] timeout error:', err) } }, speakingTimeSeconds * 1000)
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
  } catch (err) { console.error('[tiebreakerVoting] timeout error:', err) } }, votingTimeSeconds * 1000)
  roomTimers.set(roomId, timer)
}

/** All alive players were tied — no one can vote. End round with no elimination, start next. */
async function resolveRoundNoElimination(io: IO, roomId: string, state: any) {
  const currentRound = state.rounds?.[state.currentRound - 1]
  const roundPayload = currentRound ? buildRoundPayload(currentRound) : null

  const room = await prisma.room.findUnique({ where: { id: roomId } }).catch(() => null)
  const game = await prisma.game.findFirst({ where: { roomId }, orderBy: { startedAt: 'desc' } }).catch(() => null)
  if (!room || !game) return

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
      imposterWord: dbRound?.imposterWord ?? '',
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
  } catch (err) { console.error('[tiebreaker:noVoters:startRound] error:', err) } }, 5000)
}

async function resolveTiebreaker(io: IO, roomId: string) {
  const state = await getState(roomId)
  if (!state) return

  const tiebreakerVotes: any[] = state.tiebreakerVotes ?? []
  const tiedPlayerIds: string[] = state.tiebreakerPlayerIds ?? []

  // Clear tiebreaker state
  state.tiebreakerActive = false
  state.tiebreakerPhase = null
  state.status = 'in_progress'

  // Find who to eliminate from tiebreaker votes
  let eliminatedId: string | null = null
  if (tiebreakerVotes.length > 0) {
    const tally: Record<string, number> = {}
    for (const v of tiebreakerVotes) {
      tally[v.targetId] = (tally[v.targetId] ?? 0) + 1
    }
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
    if (sorted.length === 1 || sorted[0][1] !== sorted[1][1]) {
      eliminatedId = sorted[0][0]
    }
  }

  const currentRound = state.rounds?.[state.currentRound - 1]

  if (eliminatedId) {
    const player = state.players.find((p: any) => p.userId === eliminatedId)
    if (player) {
      player.status = 'eliminated'
      if (currentRound) {
        currentRound.eliminatedPlayerId = eliminatedId
        currentRound.eliminatedRole = player.role ?? null
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

  await saveState(roomId, state)

  // Check win condition
  const winner = checkWinCondition(state.players as any)
  const roundPayload = currentRound ? buildRoundPayload(currentRound) : null

  if (winner) {
    state.status = 'finished'
    await saveState(roomId, state)
    await prisma.room.update({ where: { id: roomId }, data: { status: 'finished' } }).catch(() => {})
    const game = await prisma.game.findFirst({ where: { roomId }, orderBy: { startedAt: 'desc' } }).catch(() => null)
    if (game) {
      await prisma.game.update({ where: { id: game.id }, data: { winnerTeam: winner, endedAt: new Date() } }).catch(() => {})
    }
    if (roundPayload) io.to(`room:${roomId}`).emit('round:ended', { round: roundPayload as any })
    const isRanked = state.gameMode === 'ranked'
    if (isRanked) {
      await applyRankedLP(io, roomId, state.players, (role) => getWinLpDelta(role, winner))
    }
    const lpChange = isRanked ? (winner === 'villagers' ? LP_REWARDS.VILLAGER_WIN : LP_REWARDS.VILLAGER_LOSS) : 0
    const rewards = { starCoinsEarned: winner === 'villagers' ? 50 : 80, xpEarned: 120, lpChange, achievements: [] }
    setTimeout(async () => { try {
      io.to(`room:${roomId}`).emit('game:finished', { winner, finalRound: roundPayload as any, rewards })
      await resetRoomAfterGame(roomId, state)
    } catch (err) { console.error('[tiebreaker:game:finished] emit error:', err) } }, 3000)
  } else {
    // No winner yet — start next round
    const room = await prisma.room.findUnique({ where: { id: roomId } }).catch(() => null)
    const game = await prisma.game.findFirst({ where: { roomId }, orderBy: { startedAt: 'desc' } }).catch(() => null)
    if (!room || !game) return

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
        imposterWord: dbRound?.imposterWord ?? '',
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
    } catch (err) { console.error('[tiebreaker:startRound] error:', err) } }, 5000)
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
    const t = setTimeout(async () => {
      roomTimers.delete(roomId)
      await startTiebreakerVoting(io, roomId)
    }, 1500)
    roomTimers.set(roomId, t)
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
    const t = setTimeout(async () => {
      roomTimers.delete(roomId)
      await resolveTiebreaker(io, roomId)
    }, 1500)
    roomTimers.set(roomId, t)
  }
}

// ─── Word-said instant elimination ────────────────────────────────────────────

export async function eliminatePlayerForWord(
  io: IO,
  roomId: string,
  speakingTimeSeconds: number,
  votingTimeSeconds: number,
): Promise<void> {
  // Check if the elimination triggered a win condition (e.g. all imposters eliminated)
  const state = await getState(roomId)
  if (state) {
    const winner = checkWinCondition(state.players as any)
    if (winner) {
      clearRoomTimer(roomId)
      state.status = 'finished'
      await saveState(roomId, state)
      await prisma.room.update({ where: { id: roomId }, data: { status: 'finished' } }).catch(() => {})
      const game = await prisma.game.findFirst({ where: { roomId }, orderBy: { startedAt: 'desc' } }).catch(() => null)
      if (game) {
        await prisma.game.update({ where: { id: game.id }, data: { winnerTeam: winner, endedAt: new Date() } }).catch(() => {})
      }
      const currentRound = state.rounds?.[state.currentRound - 1]
      const roundPayload = currentRound ? buildRoundPayload(currentRound) : null
      if (roundPayload) io.to(`room:${roomId}`).emit('round:ended', { round: roundPayload as any })
      const isRanked = state.gameMode === 'ranked'
      if (isRanked) {
        await applyRankedLP(io, roomId, state.players, (role) => getWinLpDelta(role, winner))
      }
      const lpChange = isRanked ? getWinLpDelta('villager', winner) : 0
      const rewards = { starCoinsEarned: winner === 'villagers' ? 50 : 80, xpEarned: 120, lpChange, achievements: [] }
      setTimeout(async () => { try {
        io.to(`room:${roomId}`).emit('game:finished', { winner, finalRound: roundPayload as any, rewards })
        await resetRoomAfterGame(roomId, state)
      } catch (err) { console.error('[word-said:finished] error:', err) } }, 3000)
      return
    }
  }

  // No winner yet — after a short delay, check if all remaining alive players
  // have submitted clues and move to voting early if so.
  setTimeout(async () => { try {
    await tryEarlyVoting(io, roomId)
  } catch (err) { console.error('[word-said] tryEarlyVoting error:', err) } }, 3000)
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
  game: any,
): Promise<void> {
  state.status = 'finished'
  await saveState(roomId, state)
  await prisma.room.update({ where: { id: roomId }, data: { status: 'finished' } }).catch(() => {})

  if (game) {
    await prisma.game.update({
      where: { id: game.id },
      data:  { winnerTeam: winner, endedAt: new Date() },
    }).catch(() => {})
  }

  const roundPayload = currentRound ? buildRoundPayload(currentRound) : null

  if (roundPayload) {
    io.to(`room:${roomId}`).emit('round:ended', { round: roundPayload as any })
  }

  const isRanked = state.gameMode === 'ranked'
  if (isRanked) {
    await applyRankedLP(io, roomId, state.players, (role) => getWinLpDelta(role, winner))
  }

  const lpChange = isRanked ? (winner === 'villagers' ? LP_REWARDS.VILLAGER_WIN : LP_REWARDS.VILLAGER_LOSS) : 0
  const rewards = {
    starCoinsEarned: winner === 'villagers' ? 50 : 80,
    xpEarned: 120,
    lpChange,
    achievements: [],
  }

  setTimeout(async () => { try {
    io.to(`room:${roomId}`).emit('game:finished', {
      winner: winner as any,
      finalRound: roundPayload as any,
      rewards,
    })
    await resetRoomAfterGame(roomId, state)
  } catch (err) { console.error('[forfeit:game:finished] emit error:', err) } }, 3000)
}

// ─── Achievement auto-triggers ────────────────────────────────────────────────

async function checkAndUnlockAchievements(
  io: IO,
  roomId: string,
  winner: string,
  state: any,
  gameId: string | null,
) {
  try {
    const achievements = await prisma.achievement.findMany()
    const achMap = new Map(achievements.map((a) => [a.key, a.id]))

    const participants = gameId
      ? await prisma.gameParticipation.findMany({ where: { gameId } })
      : []

    // onlineUsers map (userId → socketId) used for direct delivery below

    for (const p of participants) {
      const userId = p.userId
      const isWinner =
        (winner === 'villagers' && (p.role === 'villager' || p.role === 'detective')) ||
        (winner === 'imposters' && (p.role === 'imposter' || p.role === 'double_agent'))
      const isImposter = p.role === 'imposter' || p.role === 'double_agent'
      const survived = p.survived

      // Gather stats for this user
      const [totalWins, imposterWins, totalGames, friends] = await Promise.all([
        prisma.gameParticipation.count({ where: { userId, game: { winnerTeam: { not: null } },
          OR: [{ role: 'villager', game: { winnerTeam: 'villagers' } },
               { role: 'detective', game: { winnerTeam: 'villagers' } },
               { role: 'imposter', game: { winnerTeam: 'imposters' } },
               { role: 'double_agent', game: { winnerTeam: 'imposters' } }] } }),
        prisma.gameParticipation.count({ where: { userId,
          OR: [{ role: 'imposter', game: { winnerTeam: 'imposters' } },
               { role: 'double_agent', game: { winnerTeam: 'imposters' } }] } }),
        prisma.gameParticipation.count({ where: { userId } }),
        prisma.friendship.count({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }], status: 'accepted' } }),
      ]).catch(() => [0, 0, 0, 0] as [number, number, number, number])

      const toUnlock: string[] = []

      if (isWinner && totalWins === 1) toUnlock.push('first_win')
      if (isImposter && isWinner && imposterWins === 1) toUnlock.push('first_imposter')
      if (isImposter && isWinner && survived) toUnlock.push('perfect_imposter')
      if (totalWins >= 10) toUnlock.push('ten_wins')
      if (imposterWins >= 10) toUnlock.push('imposter_x10')
      if (survived && isWinner) toUnlock.push('survivor')
      if (friends >= 5) toUnlock.push('social_butterfly')

      // Check correct_voter: batch query instead of N+1
      if (gameId) {
        const rounds = await prisma.round.findMany({
          where: { gameId, eliminatedId: { not: null } },
          select: { id: true, eliminatedId: true },
        })
        // Find rounds where an imposter was eliminated
        const imposterRoundIds = rounds
          .filter((r) => {
            const eliminated = participants.find((pp) => pp.userId === r.eliminatedId)
            return eliminated?.role === 'imposter' || eliminated?.role === 'double_agent'
          })
          .map((r) => ({ roundId: r.id, targetId: r.eliminatedId! }))

        if (imposterRoundIds.length > 0) {
          // Single query: did this player vote for any eliminated imposter?
          const correctVote = await prisma.roundVote.findFirst({
            where: {
              voterId: userId,
              OR: imposterRoundIds.map((ir) => ({
                roundId: ir.roundId,
                targetId: ir.targetId,
              })),
            },
          })
          if (correctVote) toUnlock.push('correct_voter')
        }
      }

      // Unlock and notify
      // Batch-check already unlocked for this user
      const alreadyUnlocked = new Set(
        (await prisma.userAchievement.findMany({
          where: { userId, achievementId: { in: toUnlock.map((k) => achMap.get(k)!).filter(Boolean) } },
          select: { achievementId: true },
        })).map((ua) => ua.achievementId)
      )

      for (const key of toUnlock) {
        const achId = achMap.get(key)
        if (!achId) continue
        if (alreadyUnlocked.has(achId)) continue
        await prisma.userAchievement.create({ data: { userId, achievementId: achId } }).catch(() => {})
        const ach = achievements.find((a) => a.key === key)
        if (ach) {
          const socketId = onlineUsers.get(userId)
          if (socketId) io.to(socketId).emit('achievement:unlocked' as any, { key: ach.key, name: ach.name, icon: ach.icon })
        }
      }
    }
  } catch (err) {
    console.error('[achievements] error:', err)
  }
}
