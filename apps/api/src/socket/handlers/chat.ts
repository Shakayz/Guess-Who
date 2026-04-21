import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@red-handed/shared'
import { childLogger } from '../../config/logger'

const log = childLogger('socket:chat')

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

// Per-socket sliding-window rate limit for chat:send — max 5 messages / 5s.
const chatRate = new WeakMap<object, number[]>()
function isChatRateLimited(socket: object, max = 5, windowMs = 5000): boolean {
  const now = Date.now()
  const stamps = (chatRate.get(socket) ?? []).filter((t) => now - t < windowMs)
  if (stamps.length >= max) {
    chatRate.set(socket, stamps)
    return true
  }
  stamps.push(now)
  chatRate.set(socket, stamps)
  return false
}

export function registerChatHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
  socket.on('chat:send', (text) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith('room:'))?.split(':')[1]
    if (!roomId) return
    if (isChatRateLimited(socket)) return
    const sanitized = sanitizeText(text, 200)
    if (!sanitized) return
    const userId = (socket as any).userId as string | undefined
    const username = (socket as any).username as string | undefined
    if (!userId) return
    log.info({ userId, roomId, textLength: sanitized.length }, 'chat:send')

    const message = {
      id: `${Date.now()}-${userId}`,
      senderId: userId,
      senderName: username ?? 'Unknown',
      text: sanitized,
      timestamp: new Date().toISOString(),
      type: 'chat' as const,
    }
    io.to(`room:${roomId}`).emit('chat:message', message)
  })
}
