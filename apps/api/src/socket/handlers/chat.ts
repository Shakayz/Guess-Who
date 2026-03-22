import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'

export function registerChatHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
  socket.on('chat:send', (text) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith('room:'))?.split(':')[1]
    if (!roomId || !text.trim() || text.length > 200) return

    const message = {
      id: `${Date.now()}-${socket.id}`,
      senderId: socket.id,
      senderName: (socket as any).username ?? 'Unknown',
      text: text.trim(),
      timestamp: new Date().toISOString(),
      type: 'chat' as const,
    }
    io.to(`room:${roomId}`).emit('chat:message', message)
  })
}
