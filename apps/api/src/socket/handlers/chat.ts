import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@red-handed/shared'
import { childLogger } from '../../config/logger'
import { redis } from '../../config/redis'
import { eliminatePlayerForWord } from '../gameLoop'
import { containsWord, getForbiddenWords } from './game'

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
  socket.on('chat:send', async (text) => {
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

    // ── Word detection in chat — same rule as clue:submit. If an alive player
    // says their forbidden word (or any token of a multi-word name) anywhere
    // in chat, they're instantly eliminated and everyone sees why.
    try {
      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (!stateRaw) return
      const state = JSON.parse(stateRaw)
      if (state.status !== 'speaking' && state.status !== 'voting') return

      const player = state.players?.find((p: any) => p.userId === userId)
      if (!player || player.status !== 'alive') return

      const forbidden = getForbiddenWords(player.role, state)
      if (!forbidden.some((w: string) => containsWord(sanitized, w))) return

      log.warn({ userId, roomId, role: player.role }, 'chat:send flagged: player said the word')

      const currentRound = state.rounds?.[state.currentRound - 1]
      if (!currentRound) return

      player.status = 'eliminated'
      currentRound.eliminationReason = 'said_word'
      currentRound.eliminatedPlayerId = userId
      currentRound.eliminatedRole = player.role
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)

      const displayName = player.username ?? username ?? userId.slice(0, 6)

      // Broadcast the elimination-for-word event (same event the clue path uses,
      // so clients show the same overlay/animation).
      io.to(`room:${roomId}`).emit('round:word-said' as any, {
        playerId: userId,
        username: displayName,
        clueText: sanitized,
        role: player.role,
      })

      // Also post a system chat message so the reason is visible inline.
      io.to(`room:${roomId}`).emit('chat:message', {
        id: `${Date.now()}-sys-${userId}`,
        senderId: 'system',
        senderName: 'System',
        text: `${displayName} was eliminated for saying the word.`,
        timestamp: new Date().toISOString(),
        type: 'system' as const,
      })

      await eliminatePlayerForWord(io, roomId, 0, 0)
    } catch (err) {
      log.error({ err, userId, roomId }, 'chat word-detection error')
    }
  })
}
