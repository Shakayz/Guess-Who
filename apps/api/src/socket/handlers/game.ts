import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import pino from 'pino'
import { redis } from '../../config/redis'
import { prisma } from '../../config/prisma'
import { tryEarlyResolve, tryEarlyVoting, tryEarlyTiebreakerVoting, tryEarlyTiebreakerResolve, eliminatePlayerForWord } from '../gameLoop'

const log = pino({ name: 'socket:game' })

// Whole-word, case-insensitive match
function containsWord(text: string, word: string): boolean {
  if (!word) return false
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
  const escaped = normalize(word)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // escape regex special chars
    .replace(/\s+/g, '\\s+')
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(normalize(text))
}

export function registerGameHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
  const userId: string = (socket as any).userId

  socket.on('vote:cast', async (targetPlayerId) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith('room:'))?.split(':')[1]
    if (!roomId) return
    log.info({ userId, roomId, targetPlayerId }, 'vote:cast')

    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return
    const state = JSON.parse(stateRaw)

    const currentRound = state.rounds?.[state.currentRound - 1]
    if (!currentRound || state.status !== 'voting') return

    // ── Validate voter is alive ───────────────────────────────────────────────
    const voter = state.players.find((p: any) => p.userId === userId && p.status === 'alive')
    if (!voter) return

    // ── Cannot vote for yourself ──────────────────────────────────────────────
    if (targetPlayerId === userId) return

    // ── TIEBREAKER vote path ──────────────────────────────────────────────────
    if (state.tiebreakerActive && state.tiebreakerPhase === 'vote') {
      const tiebreakerPlayerIds: string[] = state.tiebreakerPlayerIds ?? []
      // Tied players cannot vote — only non-tied alive players decide
      if (tiebreakerPlayerIds.includes(userId)) return
      // Target must be one of the tied players
      if (!tiebreakerPlayerIds.includes(targetPlayerId)) return

      const tiebreakerVotes: any[] = state.tiebreakerVotes ?? []
      if (tiebreakerVotes.some((v: any) => v.voterId === userId)) return  // already voted

      tiebreakerVotes.push({ voterId: userId, targetId: targetPlayerId, timestamp: new Date().toISOString() })
      state.tiebreakerVotes = tiebreakerVotes
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)

      io.to(`room:${roomId}`).emit('round:vote-cast', { voterId: userId, hasVoted: true })
      const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
      const eligibleVoters = alivePlayers.filter((p: any) => !tiebreakerPlayerIds.includes(p.userId))
      io.to(`room:${roomId}`).emit('vote:update' as any, {
        voteCount: tiebreakerVotes.length,
        totalVoters: eligibleVoters.length,
      })
      await tryEarlyTiebreakerResolve(io, roomId)
      return
    }

    // ── Validate target exists and is alive ───────────────────────────────────
    const target = state.players.find((p: any) => p.userId === targetPlayerId && p.status === 'alive')
    if (!target) return

    // Record vote (by userId, one vote per player)
    const existingVote = currentRound.votes?.find((v: any) => v.voterId === userId)
    if (!existingVote) {
      currentRound.votes = [
        ...(currentRound.votes ?? []),
        { voterId: userId, targetId: targetPlayerId, timestamp: new Date().toISOString() },
      ]
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)
      io.to(`room:${roomId}`).emit('round:vote-cast', { voterId: userId, hasVoted: true })
      const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
      io.to(`room:${roomId}`).emit('vote:update' as any, {
        voteCount: currentRound.votes.length,
        totalVoters: alivePlayers.length,
      })
      // Resolve immediately if all alive players have voted
      await tryEarlyResolve(io, roomId)
    }
  })

  socket.on('clue:submit', async (text) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith('room:'))?.split(':')[1]
    if (!roomId) return

    // ── Validate clue text ────────────────────────────────────────────────────
    if (typeof text !== 'string') return
    const sanitized = text.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, '').trim().slice(0, 300)
    if (!sanitized) return
    log.info({ userId, roomId, textLength: sanitized.length }, 'clue:submit')

    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return
    const state = JSON.parse(stateRaw)

    const currentRound = state.rounds?.[state.currentRound - 1]
    if (!currentRound) return

    // ── TIEBREAKER clue path — only tied players can submit ──────────────────
    if (state.tiebreakerActive && state.tiebreakerPhase === 'clue') {
      const tiedIds: string[] = state.tiebreakerPlayerIds ?? []
      if (!tiedIds.includes(userId)) return  // non-tied player cannot submit

      const tiebreakerClues: any[] = state.tiebreakerClues ?? []
      if (tiebreakerClues.some((c: any) => c.playerId === userId)) return  // already submitted

      const player = state.players.find((p: any) => p.userId === userId && p.status === 'alive')
      if (!player) return

      const clue = {
        playerId: userId,
        text: sanitized,
        timestamp: new Date().toISOString(),
        flaggedForWord: false,
        flagVotes: [],
      }
      tiebreakerClues.push(clue)
      state.tiebreakerClues = tiebreakerClues
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)
      io.to(`room:${roomId}`).emit('round:clue-submitted', clue)
      await tryEarlyTiebreakerVoting(io, roomId)
      return
    }

    // ── Any alive player who hasn't submitted yet can submit a clue ─────────
    const clues: any[] = currentRound.clues ?? []
    if (clues.some((c: any) => c.playerId === userId)) return

    const player = state.players.find((p: any) => p.userId === userId && p.status === 'alive')
    if (!player) return

    const clue = {
      playerId: userId,
      text: sanitized,
      timestamp: new Date().toISOString(),
      flaggedForWord: false,
      flagVotes: [],
    }

    // ── Word detection — check BEFORE writing to Redis so we only write once ─
    const role: string = player.role ?? 'villager'
    const forbidden: string[] =
      role === 'double_agent' ? [state.villagerWord ?? '', state.imposterWord ?? ''] :
      (role === 'villager' || role === 'detective') ? [state.villagerWord ?? ''] :
      [state.imposterWord ?? '']

    const saidWord = forbidden.some((w) => containsWord(sanitized, w))

    if (saidWord) {
      log.warn({ userId, roomId, role: player.role }, 'clue:submit flagged: player said the word')
      clue.flaggedForWord = true
      player.status = 'eliminated'
      currentRound.eliminationReason = 'said_word'
      currentRound.eliminatedPlayerId = userId
      currentRound.eliminatedRole = player.role
    }

    // Single Redis write for both normal clue and word-said paths
    currentRound.clues = [...clues, clue]
    await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)

    io.to(`room:${roomId}`).emit('round:clue-submitted', clue)

    if (saidWord) {
      const username = player.username ?? (socket as any).username ?? userId.slice(0, 6)
      io.to(`room:${roomId}`).emit('round:word-said' as any, {
        playerId: userId,
        username,
        clueText: sanitized,
        role: player.role,
      })
      await eliminatePlayerForWord(io, roomId, 0, 0)
      return
    }

    // All alive players submitted? → move to voting early
    await tryEarlyVoting(io, roomId)
  })
}
