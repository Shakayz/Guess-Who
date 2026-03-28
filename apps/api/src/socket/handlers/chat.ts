import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'

/** Strip HTML tags and trim whitespace to prevent XSS via stored/reflected content */
function sanitizeText(input: unknown, maxLen: number): string | null {
  if (typeof input !== 'string') return null
  const cleaned = input
    .replace(/<[^>]*>/g, '')       // Strip HTML tags
    .replace(/&[a-z]+;/gi, '')     // Strip HTML entities
    .trim()
    .slice(0, maxLen)
  return cleaned.length > 0 ? cleaned : null
}

export function registerChatHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
  socket.on('chat:send', (text) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith('room:'))?.split(':')[1]
    if (!roomId) return
    const sanitized = sanitizeText(text, 200)
    if (!sanitized) return

    const message = {
      id: `${Date.now()}-${socket.id}`,
      senderId: socket.id,
      senderName: (socket as any).username ?? 'Unknown',
      text: sanitized,
      timestamp: new Date().toISOString(),
      type: 'chat' as const,
    }
    io.to(`room:${roomId}`).emit('chat:message', message)
  })
}
