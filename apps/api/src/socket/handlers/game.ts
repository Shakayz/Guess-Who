import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { getMostVoted, checkWinCondition, shuffleArray } from '@imposter/shared'
import { redis } from '../../config/redis'
import { prisma } from '../../config/prisma'

export function registerGameHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
  socket.on('vote:cast', async (targetPlayerId) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith('room:'))?.split(':')[1]
    if (!roomId) return

    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return
    const state = JSON.parse(stateRaw)

    const currentRound = state.rounds?.[state.currentRound - 1]
    if (!currentRound || state.status !== 'voting') return

    // Record vote
    const existingVote = currentRound.votes?.find((v: any) => v.voterId === socket.id)
    if (!existingVote) {
      currentRound.votes = [...(currentRound.votes ?? []), { voterId: socket.id, targetId: targetPlayerId, timestamp: new Date().toISOString() }]
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
      io.to(`room:${roomId}`).emit('round:vote-cast', { voterId: socket.id, hasVoted: true })
    }
  })

  socket.on('clue:submit', async (text) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith('room:'))?.split(':')[1]
    if (!roomId) return

    const clue = {
      playerId: socket.id,
      text,
      timestamp: new Date().toISOString(),
      flaggedForWord: false,
      flagVotes: [],
    }
    io.to(`room:${roomId}`).emit('round:clue-submitted', clue)
  })
}
