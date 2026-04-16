import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@red-handed/shared'
import { redis } from '../../config/redis'
import { childLogger } from '../../config/logger'
import { onlineUsers } from '../onlineUsers'

const log = childLogger('socket:voice')

// Per-socket signal-event rate limiter. WebRTC ICE candidate exchange can be
// chatty (~20–40 events during connection setup), so we allow a generous
// window. We track timestamps per (socketId, event) pair.
const voiceRateLimits = new WeakMap<object, Map<string, number[]>>()
function isRateLimited(socket: any, event: string, maxPerSecond: number): boolean {
  let events = voiceRateLimits.get(socket)
  if (!events) {
    events = new Map()
    voiceRateLimits.set(socket, events)
  }
  const now = Date.now()
  let timestamps = events.get(event) ?? []
  timestamps = timestamps.filter((t) => now - t < 1000)
  if (timestamps.length >= maxPerSecond) return true
  timestamps.push(now)
  events.set(event, timestamps)
  return false
}

/** Resolve the room id for the connected socket, if any. */
function currentRoomId(socket: Socket): string | null {
  const key = [...socket.rooms].find((r) => r.startsWith('room:'))
  return key ? key.split(':')[1] : null
}

const voiceKey = (roomId: string) => `room:${roomId}:voice`
const VOICE_TTL_SECONDS = 24 * 60 * 60

/**
 * Best-effort removal of a userId from a room's voice channel set.
 * Broadcasts `voice:peer-left` to remaining peers in the room.
 *
 * Exported so the central disconnect handler in `socket/index.ts` can clean up
 * voice state when a user drops without explicitly emitting `voice:leave`.
 */
export async function leaveVoiceChannel(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomId: string,
  userId: string,
): Promise<void> {
  try {
    const removed = await redis.srem(voiceKey(roomId), userId)
    if (removed > 0) {
      io.to(`room:${roomId}`).emit('voice:peer-left', { userId })
    }
  } catch (err) {
    log.error({ err, roomId, userId }, 'leaveVoiceChannel error')
  }
}

export function registerVoiceHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
  const userId: string = (socket as any).userId

  // ── Join the voice channel for the current room ──────────────────────────
  // Reply directly to the joining socket with the existing peer list, then
  // broadcast `voice:peer-joined` so existing peers know to initiate offers.
  socket.on('voice:join', async () => {
    if (isRateLimited(socket, 'voice:join', 2)) return
    const roomId = currentRoomId(socket)
    if (!roomId) return
    try {
      const existing = await redis.smembers(voiceKey(roomId))
      const peerUserIds = existing.filter((u) => u !== userId)
      await redis.sadd(voiceKey(roomId), userId)
      await redis.expire(voiceKey(roomId), VOICE_TTL_SECONDS)
      log.info({ userId, roomId, peerCount: peerUserIds.length }, 'voice:join')
      socket.emit('voice:peers', { peerUserIds })
      socket.to(`room:${roomId}`).emit('voice:peer-joined', { userId })
    } catch (err) {
      log.error({ err, userId, roomId }, 'voice:join error')
    }
  })

  // ── Leave the voice channel explicitly ───────────────────────────────────
  socket.on('voice:leave', async () => {
    const roomId = currentRoomId(socket)
    if (!roomId) return
    log.info({ userId, roomId }, 'voice:leave')
    await leaveVoiceChannel(io, roomId, userId)
  })

  // ── Forward an SDP offer/answer or ICE candidate to a single peer ────────
  // The server is signaling-only — it never inspects the `signal` payload.
  // We resolve the recipient via `onlineUsers` and require both peers to be in
  // the same room before forwarding (prevents cross-room voice leaks).
  socket.on('voice:signal', async (data) => {
    if (!data || typeof data.toUserId !== 'string') return
    if (isRateLimited(socket, 'voice:signal', 60)) return
    const roomId = currentRoomId(socket)
    if (!roomId) return
    const targetSocketId = onlineUsers.get(data.toUserId)
    if (!targetSocketId) return
    const targetSocket = io.sockets.sockets.get(targetSocketId)
    if (!targetSocket || !targetSocket.rooms.has(`room:${roomId}`)) return
    io.to(targetSocketId).emit('voice:signal', {
      fromUserId: userId,
      signal: data.signal,
    })
  })
}
