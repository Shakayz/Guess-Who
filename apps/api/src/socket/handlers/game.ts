import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { redis } from '../../config/redis'
import { tryEarlyResolve } from '../gameLoop'

export function registerGameHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
  const userId: string = (socket as any).userId

  socket.on('vote:cast', async (targetPlayerId) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith('room:'))?.split(':')[1]
    if (!roomId) return

    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return
    const state = JSON.parse(stateRaw)

    const currentRound = state.rounds?.[state.currentRound - 1]
    if (!currentRound || state.status !== 'voting') return

    // ── Validate voter is alive ───────────────────────────────────────────────
    const voter = state.players.find((p: any) => p.userId === userId && p.status === 'alive')
    if (!voter) return

    // ── Validate target exists and is alive ───────────────────────────────────
    const target = state.players.find((p: any) => p.userId === targetPlayerId && p.status === 'alive')
    if (!target) return

    // ── Cannot vote for yourself ──────────────────────────────────────────────
    if (targetPlayerId === userId) return

    // Record vote (by userId, one vote per player)
    const existingVote = currentRound.votes?.find((v: any) => v.voterId === userId)
    if (!existingVote) {
      currentRound.votes = [
        ...(currentRound.votes ?? []),
        { voterId: userId, targetId: targetPlayerId, timestamp: new Date().toISOString() },
      ]
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
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

    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return
    const state = JSON.parse(stateRaw)

    const currentRound = state.rounds?.[state.currentRound - 1]
    if (!currentRound) return

    // ── Only the current speaker can submit a clue ────────────────────────────
    const speakingOrder: string[] = currentRound.speakingOrder ?? []
    const clues: any[] = currentRound.clues ?? []
    // The current speaker is the first player in speakingOrder who hasn't submitted yet
    const speakersWithClue = new Set(clues.map((c: any) => c.playerId))
    const currentSpeaker = speakingOrder.find((id: string) => !speakersWithClue.has(id))
    if (currentSpeaker !== userId) return

    const player = state.players.find((p: any) => p.userId === userId && p.status === 'alive')
    if (!player) return

    const clue = {
      playerId: userId,
      text: sanitized,
      timestamp: new Date().toISOString(),
      flaggedForWord: false,
      flagVotes: [],
    }
    currentRound.clues = [...(currentRound.clues ?? []), clue]
    await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
    io.to(`room:${roomId}`).emit('round:clue-submitted', clue)
  })
}
