import type { Server } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { getMostVoted, checkWinCondition, computeRankUpdate, LP_REWARDS } from '@imposter/shared'
import type { RankTier } from '@imposter/shared'
import { redis } from '../config/redis'
import { prisma } from '../config/prisma'

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
    players: state.players.map((p: any) => ({
      ...p,
      role:                 undefined,
      status:              'alive',
      isReady:             p.isHost,
      honorGiven:          false,
      detectiveRevealUsed: false,
    })),
    currentRound: 0,
    rounds: [],
  }
}

async function resetRoomAfterGame(roomId: string, state: any): Promise<void> {
  const resetState = buildResetState(state)
  await redis.set(`room:${roomId}:state`, JSON.stringify(resetState), 'EX', 86400)
  await prisma.room.update({ where: { id: roomId }, data: { status: 'waiting' } }).catch(() => {})
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

  const sockets = await io.in(`room:${roomId}`).fetchSockets().catch(() => [] as any[])

  await Promise.allSettled(
    players.map(async (player: any) => {
      const user = userMap.get(player.userId)
      if (!user) return

      const lpDelta            = getLpDelta(player.role ?? '')
      const { newLP, newTier, promoted, demoted } = computeRankUpdate(user.rankPoints, lpDelta)
      const oldTier            = user.rankTier as RankTier
      const tierChanged        = newTier !== oldTier

      await prisma.user.update({
        where: { id: player.userId },
        data:  { rankPoints: newLP, ...(tierChanged ? { rankTier: newTier } : {}) },
      })

      if (tierChanged) {
        const sock = sockets.find((s: any) => (s.data?.userId ?? s.userId) === player.userId)
        sock?.emit('rank:updated' as any, { oldTier, newTier, newLP, promoted })
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
  await advanceSpeaker(io, roomId, 0, speakingTimeSeconds, votingTimeSeconds)
}

// ─── Speaking phase ───────────────────────────────────────────────────────────

async function advanceSpeaker(
  io: IO,
  roomId: string,
  speakerIndex: number,
  speakingTimeSeconds: number,
  votingTimeSeconds: number,
) {
  const stateRaw = await redis.get(`room:${roomId}:state`)
  if (!stateRaw) {
    io.to(`room:${roomId}`).emit('error', { code: 'GAME_STATE_LOST', message: 'Game interrupted. Please reconnect.' })
    return
  }
  const state = JSON.parse(stateRaw)
  if (state.status !== 'in_progress') return

  const currentRound = state.rounds?.[state.currentRound - 1]
  if (!currentRound) return

  const order: string[] = currentRound.speakingOrder ?? []

  if (speakerIndex >= order.length) {
    // All speakers done → start voting
    await startVoting(io, roomId, votingTimeSeconds)
    return
  }

  const playerId = order[speakerIndex]
  io.to(`room:${roomId}`).emit('round:speaking-turn', { playerId, timeSeconds: speakingTimeSeconds, speakingOrder: order })

  const timer = setTimeout(async () => { try {
    roomTimers.delete(roomId)
    await advanceSpeaker(io, roomId, speakerIndex + 1, speakingTimeSeconds, votingTimeSeconds)
  } catch (err) { console.error('[advanceSpeaker] timeout error:', err) } }, speakingTimeSeconds * 1000)
  roomTimers.set(roomId, timer)
}

// ─── Voting phase ─────────────────────────────────────────────────────────────

async function startVoting(io: IO, roomId: string, votingTimeSeconds: number) {
  const stateRaw = await redis.get(`room:${roomId}:state`)
  if (!stateRaw) {
    io.to(`room:${roomId}`).emit('error', { code: 'GAME_STATE_LOST', message: 'Game interrupted. Please reconnect.' })
    return
  }
  const state = JSON.parse(stateRaw)
  state.status = 'voting'
  await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)

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
  const stateRaw = await redis.get(`room:${roomId}:state`)
  if (!stateRaw) return
  const state = JSON.parse(stateRaw)
  if (state.status !== 'voting') return

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
  const stateRaw = await redis.get(`room:${roomId}:state`)
  if (!stateRaw) {
    io.to(`room:${roomId}`).emit('error', { code: 'GAME_STATE_LOST', message: 'Game interrupted. Please reconnect.' })
    return
  }
  const state = JSON.parse(stateRaw)

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
    // Tie vote — notify players explicitly so UI can show a "no elimination" message
    currentRound.eliminatedPlayerId = null
    currentRound.eliminatedRole = null
    io.to(`room:${roomId}`).emit('vote:tie' as any, { message: 'Vote tied — no one is eliminated this round' })
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

  const roundPayload = {
    id: currentRound.id,
    roundNumber: currentRound.roundNumber,
    speakingOrder: currentRound.speakingOrder,
    clues: currentRound.clues ?? [],
    votes: currentRound.votes ?? [],
    eliminatedPlayerId: currentRound.eliminatedPlayerId ?? null,
    eliminatedRole: currentRound.eliminatedRole ?? null,
    wordReveal: currentRound.wordReveal ?? null,
  }

  // Check win condition
  const winner = checkWinCondition(state.players as any)

  if (winner) {
    state.status = 'finished'
    await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
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
      await applyRankedLP(io, roomId, state.players, (role) => {
        const isImposter = role === 'imposter' || role === 'double_agent'
        if (winner === 'villagers') {
          return isImposter ? LP_REWARDS.IMPOSTER_LOSS : LP_REWARDS.VILLAGER_WIN
        } else {
          return isImposter ? LP_REWARDS.IMPOSTER_WIN : LP_REWARDS.VILLAGER_LOSS
        }
      })
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

    // Imposters win if they survive all rounds (only when a round limit is set)
    // Re-check win condition first — all imposters may have been eliminated this final round
    if (maxRounds > 0 && nextRoundNumber > maxRounds) {
      const finalWinner = checkWinCondition(state.players as any)
      if (finalWinner && finalWinner !== 'imposters') {
        // Villagers won on the last round — fall through to normal winner logic above
        // by re-invoking the winner branch inline
        state.status = 'finished'
        await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
        await prisma.room.update({ where: { id: roomId }, data: { status: 'finished' } }).catch(() => {})
        if (game) {
          await prisma.game.update({ where: { id: game.id }, data: { winnerTeam: finalWinner, endedAt: new Date() } }).catch(() => {})
        }
        io.to(`room:${roomId}`).emit('round:ended', { round: roundPayload as any })
        await checkAndUnlockAchievements(io, roomId, finalWinner, state, game?.id ?? null)
        const isRankedFinal = state.gameMode === 'ranked'
        if (isRankedFinal) {
          await applyRankedLP(io, roomId, state.players, (role) => {
            const isImposter = role === 'imposter' || role === 'double_agent'
            return finalWinner === 'villagers'
              ? (isImposter ? LP_REWARDS.IMPOSTER_LOSS : LP_REWARDS.VILLAGER_WIN)
              : (isImposter ? LP_REWARDS.IMPOSTER_WIN : LP_REWARDS.VILLAGER_LOSS)
          })
        }
        const lpChangeFinal = isRankedFinal ? LP_REWARDS.VILLAGER_WIN : 0
        setTimeout(async () => { try {
          io.to(`room:${roomId}`).emit('game:finished', { winner: finalWinner, finalRound: roundPayload as any, rewards: { starCoinsEarned: 50, xpEarned: 120, lpChange: lpChangeFinal, achievements: [] } })
          await resetRoomAfterGame(roomId, state)
        } catch (err) { console.error('[game:finished] emit error:', err) } }, 3000)
        return
      }

      state.status = 'finished'
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
      await prisma.room.update({ where: { id: roomId }, data: { status: 'finished' } }).catch(() => {})
      io.to(`room:${roomId}`).emit('round:ended', { round: roundPayload as any })
      const isRankedSurvival = state.gameMode === 'ranked'

      // ── Persist LP per-role + sync rankTier (survival win) ─────────────────
      if (isRankedSurvival) {
        await applyRankedLP(io, roomId, state.players, (role) => {
          const isImposter = role === 'imposter' || role === 'double_agent'
          return isImposter ? LP_REWARDS.SURVIVAL_IMPOSTER_WIN : LP_REWARDS.SURVIVAL_VILLAGER_LOSS
        })
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
    state.status = 'in_progress'  // reset from 'voting' so advanceSpeaker can proceed
    state.rounds.push({
      id: nextDbRound.id,
      roundNumber: nextRoundNumber,
      votes: [],
      clues: [],
      speakingOrder: nextSpeakingOrder,
    })
    await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)

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

    // Online sockets in this room keyed by userId
    const socketMap = new Map<string, string>() // userId → socketId
    const sockets = await io.in(`room:${roomId}`).fetchSockets().catch(() => [] as any[])
    for (const s of sockets) {
      const uid = (s as any).data?.userId ?? (s as any).userId
      if (uid) socketMap.set(uid, s.id)
    }

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
      for (const key of toUnlock) {
        const achId = achMap.get(key)
        if (!achId) continue
        const already = await prisma.userAchievement.findFirst({ where: { userId, achievementId: achId } })
        if (already) continue
        await prisma.userAchievement.create({ data: { userId, achievementId: achId } }).catch(() => {})
        const ach = achievements.find((a) => a.key === key)
        if (ach) {
          const targetSocket = sockets.find((s: any) => (s.data?.userId ?? s.userId) === userId)
          if (targetSocket) {
            targetSocket.emit('achievement:unlocked' as any, { key: ach.key, name: ach.name, icon: ach.icon })
          }
        }
      }
    }
  } catch (err) {
    console.error('[achievements] error:', err)
  }
}
