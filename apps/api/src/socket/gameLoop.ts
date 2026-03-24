import type { Server } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { getMostVoted, checkWinCondition } from '@imposter/shared'
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
  if (!stateRaw) return
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
  io.to(`room:${roomId}`).emit('round:speaking-turn', { playerId, timeSeconds: speakingTimeSeconds })

  const timer = setTimeout(async () => {
    roomTimers.delete(roomId)
    await advanceSpeaker(io, roomId, speakerIndex + 1, speakingTimeSeconds, votingTimeSeconds)
  }, speakingTimeSeconds * 1000)
  roomTimers.set(roomId, timer)
}

// ─── Voting phase ─────────────────────────────────────────────────────────────

async function startVoting(io: IO, roomId: string, votingTimeSeconds: number) {
  const stateRaw = await redis.get(`room:${roomId}:state`)
  if (!stateRaw) return
  const state = JSON.parse(stateRaw)
  state.status = 'voting'
  await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)

  const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
  io.to(`room:${roomId}`).emit('round:voting-started', { timeSeconds: votingTimeSeconds, players: alivePlayers })

  const timer = setTimeout(async () => {
    roomTimers.delete(roomId)
    await resolveRound(io, roomId)
  }, votingTimeSeconds * 1000)
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
    await resolveRound(io, roomId)
  }
}

// ─── Round resolution ─────────────────────────────────────────────────────────

async function resolveRound(io: IO, roomId: string) {
  const stateRaw = await redis.get(`room:${roomId}:state`)
  if (!stateRaw) return
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
    currentRound.eliminatedPlayerId = null
    currentRound.eliminatedRole = null
  }

  // Add word reveal from DB
  const dbRound = await prisma.round.findUnique({ where: { id: currentRound.id } }).catch(() => null)
  currentRound.wordReveal = dbRound
    ? { villagerWord: dbRound.villagerWord, imposterWord: dbRound.imposterWord }
    : null

  // Update DB round with elimination and mark participation as not survived
  if (mostVotedId && dbRound) {
    await prisma.round.update({
      where: { id: dbRound.id },
      data: { eliminatedId: mostVotedId },
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

    const rewards = {
      starCoinsEarned: winner === 'villagers' ? 50 : 80,
      xpEarned: 120,
      lpChange: winner === 'villagers' ? 18 : -15,
      achievements: [],
    }
    setTimeout(() => {
      io.to(`room:${roomId}`).emit('game:finished', {
        winner,
        finalRound: roundPayload as any,
        rewards,
      })
    }, 3000)
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
    const maxRounds = state.maxRounds ?? 5

    // Imposters win if they survive all rounds without being eliminated
    if (nextRoundNumber > maxRounds) {
      state.status = 'finished'
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
      await prisma.room.update({ where: { id: roomId }, data: { status: 'finished' } }).catch(() => {})
      io.to(`room:${roomId}`).emit('round:ended', { round: roundPayload as any })
      const rewards = { starCoinsEarned: 80, xpEarned: 120, lpChange: -15, achievements: [] }
      setTimeout(() => {
        io.to(`room:${roomId}`).emit('game:finished', { winner: 'imposters', finalRound: roundPayload as any, rewards })
      }, 3000)
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
    setTimeout(async () => {
      await startRound(io, roomId, room.speakingTimeSeconds, room.votingTimeSeconds)
    }, 5000)
  }
}
