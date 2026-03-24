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

    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return
    const state = JSON.parse(stateRaw)

    const currentRound = state.rounds?.[state.currentRound - 1]
    if (!currentRound) return

    const clue = {
      playerId: userId,
      text,
      timestamp: new Date().toISOString(),
      flaggedForWord: false,
      flagVotes: [],
    }
    currentRound.clues = [...(currentRound.clues ?? []), clue]
    await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
    io.to(`room:${roomId}`).emit('round:clue-submitted', clue)
  })
}
