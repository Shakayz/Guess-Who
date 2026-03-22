import type { Server } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { redis } from '../config/redis'
import { registerRoomHandlers } from './handlers/room'
import { registerGameHandlers } from './handlers/game'
import { registerChatHandlers } from './handlers/chat'

export function registerSocketHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  // Auth middleware — verify JWT from handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error('Missing token'))
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; username: string }
      ;(socket as any).userId = payload.sub
      ;(socket as any).username = payload.username
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', async (socket) => {
    const userId: string = (socket as any).userId
    console.log(`Socket connected: ${socket.id} (user: ${userId})`)

    registerRoomHandlers(io, socket)
    registerGameHandlers(io, socket)
    registerChatHandlers(io, socket)

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`)
      // Remove player from any rooms they were in
      const roomKeys = [...socket.rooms].filter((r) => r.startsWith('room:'))
      for (const roomKey of roomKeys) {
        const roomId = roomKey.split(':')[1]
        const stateRaw = await redis.get(`room:${roomId}:state`)
        if (stateRaw) {
          const state = JSON.parse(stateRaw)
          state.players = state.players.filter((p: any) => p.userId !== userId)
          await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
          io.to(roomKey).emit('player:left', socket.id)
        }
      }
    })
  })
}
