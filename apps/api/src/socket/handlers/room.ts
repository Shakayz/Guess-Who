import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'

export function registerRoomHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
  socket.on('room:join', async ({ roomCode }) => {
    const room = await prisma.room.findUnique({ where: { code: roomCode } })
    if (!room) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' })
      return
    }
    await socket.join(`room:${room.id}`)
    const stateRaw = await redis.get(`room:${room.id}:state`)
    const state = stateRaw ? JSON.parse(stateRaw) : { players: [], status: 'waiting' }
    io.to(`room:${room.id}`).emit('room:updated', { ...room, ...state } as any)
  })

  socket.on('room:leave', async () => {
    const rooms = [...socket.rooms].filter((r) => r.startsWith('room:'))
    for (const room of rooms) {
      await socket.leave(room)
    }
  })
}
