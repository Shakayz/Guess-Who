/**
 * voiceHandler.test.ts
 *
 * Tests for src/socket/handlers/voice.ts — the WebRTC signaling relay used by
 * vocal mode. The server is signaling-only (it never inspects audio), so the
 * contract under test is:
 *   - voice:join → reply with `voice:peers`, add to Redis set, broadcast
 *     `voice:peer-joined` to the rest of the room
 *   - voice:leave → remove from Redis, broadcast `voice:peer-left`
 *   - voice:signal → forward opaque payload to the target socket *only* when
 *     both peers are in the same room (no cross-room leaks)
 *   - leaveVoiceChannel utility used by the central disconnect handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redis } from '../../config/redis'
import { onlineUsers } from '../../socket/onlineUsers'

const mockRedis = redis as any

// The shared setup.ts only declares the redis methods used by other tests
// (get/set/del). Voice handler uses set commands too — extend the mock here.
beforeEach(() => {
  vi.clearAllMocks()
  mockRedis.smembers = vi.fn().mockResolvedValue([])
  mockRedis.sadd = vi.fn().mockResolvedValue(1)
  mockRedis.srem = vi.fn().mockResolvedValue(1)
  mockRedis.expire = vi.fn().mockResolvedValue(1)
  onlineUsers.clear()
})

import { registerVoiceHandlers, leaveVoiceChannel } from '../../socket/handlers/voice'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeIo(targetSockets: Map<string, any> = new Map()) {
  const broadcastEmit = vi.fn()
  const directEmit = vi.fn()
  const to = vi.fn((_dest: string) => ({ emit: broadcastEmit }))
  return {
    to,
    sockets: { sockets: targetSockets },
    _broadcastEmit: broadcastEmit,
    _directEmit: directEmit,
    // Helper: route `io.to(socketId).emit(...)` calls so we can assert what
    // was sent to a specific socket vs. a room. Real socket.io does this
    // distinction implicitly; the mock has to be told.
    setupDirectEmit() {
      this.to.mockImplementation((dest: string) => {
        if (dest.startsWith('room:')) return { emit: this._broadcastEmit }
        return { emit: this._directEmit }
      })
    },
  } as any
}

function makeSocket(userId = 'u1', roomId: string | null = 'r1') {
  const listeners: Record<string, Function> = {}
  const rooms = new Set<string>(['socket-id'])
  if (roomId) rooms.add(`room:${roomId}`)
  const socket: any = {
    id: `sock-${userId}`,
    data: { userId },
    rooms,
    emit: vi.fn(),
    to: vi.fn((_dest: string) => ({ emit: vi.fn() })),
    on: vi.fn((event: string, cb: Function) => { listeners[event] = cb }),
    _fire: (event: string, ...args: any[]) => listeners[event]?.(...args),
    userId,
  }
  // Capture room-broadcast emits separately from direct emits so tests can
  // assert "broadcast to room :r1 except sender" semantics.
  const roomEmit = vi.fn()
  socket.to.mockImplementation((dest: string) => {
    if (dest === `room:${roomId}`) return { emit: roomEmit }
    return { emit: vi.fn() }
  })
  socket._roomEmit = roomEmit
  return socket
}

// ── voice:join ─────────────────────────────────────────────────────────────

describe('voice:join', () => {
  it('replies with the existing peer list, adds self to Redis, broadcasts join', async () => {
    mockRedis.smembers.mockResolvedValueOnce(['u2', 'u3'])
    const io = makeIo()
    const socket = makeSocket('u1', 'r1')
    registerVoiceHandlers(io, socket)

    await socket._fire('voice:join')

    // Existing peers excluded self
    expect(socket.emit).toHaveBeenCalledWith('voice:peers', { peerUserIds: ['u2', 'u3'] })
    expect(mockRedis.sadd).toHaveBeenCalledWith('room:r1:voice', 'u1')
    expect(mockRedis.expire).toHaveBeenCalledWith('room:r1:voice', 24 * 60 * 60)
    // Broadcast to the rest of the room (socket.to, not io.to → excludes sender)
    expect(socket.to).toHaveBeenCalledWith('room:r1')
    expect(socket._roomEmit).toHaveBeenCalledWith('voice:peer-joined', { userId: 'u1' })
  })

  it('filters self out of the existing peer list (recovery from stale Redis state)', async () => {
    mockRedis.smembers.mockResolvedValueOnce(['u1', 'u2'])
    const io = makeIo()
    const socket = makeSocket('u1', 'r1')
    registerVoiceHandlers(io, socket)

    await socket._fire('voice:join')

    expect(socket.emit).toHaveBeenCalledWith('voice:peers', { peerUserIds: ['u2'] })
  })

  it('does nothing when the socket is not in any room', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', null)
    registerVoiceHandlers(io, socket)

    await socket._fire('voice:join')

    expect(socket.emit).not.toHaveBeenCalled()
    expect(mockRedis.sadd).not.toHaveBeenCalled()
    expect(socket._roomEmit).not.toHaveBeenCalled()
  })
})

// ── voice:leave ────────────────────────────────────────────────────────────

describe('voice:leave', () => {
  it('removes from Redis and broadcasts peer-left to the room', async () => {
    mockRedis.srem.mockResolvedValueOnce(1)
    const io = makeIo()
    const socket = makeSocket('u1', 'r1')
    registerVoiceHandlers(io, socket)

    await socket._fire('voice:leave')

    expect(mockRedis.srem).toHaveBeenCalledWith('room:r1:voice', 'u1')
    expect(io.to).toHaveBeenCalledWith('room:r1')
    expect(io._broadcastEmit).toHaveBeenCalledWith('voice:peer-left', { userId: 'u1' })
  })

  it('does not broadcast peer-left when the user was not actually in the channel', async () => {
    // SREM returns 0 when the member wasn't in the set — guard against
    // duplicate "left" notifications which would confuse the client mesh.
    mockRedis.srem.mockResolvedValueOnce(0)
    const io = makeIo()
    const socket = makeSocket('u1', 'r1')
    registerVoiceHandlers(io, socket)

    await socket._fire('voice:leave')

    expect(io._broadcastEmit).not.toHaveBeenCalled()
  })

  it('is a no-op when the socket is not in any room', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', null)
    registerVoiceHandlers(io, socket)

    await socket._fire('voice:leave')

    expect(mockRedis.srem).not.toHaveBeenCalled()
  })
})

// ── voice:signal ───────────────────────────────────────────────────────────

describe('voice:signal', () => {
  it('forwards SDP offer to the target socket when both peers share a room', async () => {
    // Wire up a target socket that is in the same room as the sender.
    const targetSocket: any = { rooms: new Set(['sock-u2', 'room:r1']) }
    const io = makeIo(new Map([['sock-u2', targetSocket]]))
    io.setupDirectEmit()
    onlineUsers.set('u2', 'sock-u2')

    const socket = makeSocket('u1', 'r1')
    registerVoiceHandlers(io, socket)

    const sdp = { type: 'offer', sdp: 'v=0 ...' }
    await socket._fire('voice:signal', { toUserId: 'u2', signal: sdp })

    expect(io.to).toHaveBeenCalledWith('sock-u2')
    expect(io._directEmit).toHaveBeenCalledWith('voice:signal', {
      fromUserId: 'u1',
      signal: sdp,
    })
  })

  it('drops signals when the target user is offline', async () => {
    const io = makeIo(new Map())
    io.setupDirectEmit()
    // u2 not in onlineUsers
    const socket = makeSocket('u1', 'r1')
    registerVoiceHandlers(io, socket)

    await socket._fire('voice:signal', { toUserId: 'u2', signal: { candidate: {} } })

    expect(io._directEmit).not.toHaveBeenCalled()
  })

  it('drops signals when the target socket is in a DIFFERENT room (no cross-room leak)', async () => {
    // Target connected, but in another game room — the signal must not be
    // relayed, otherwise a malicious client could inject WebRTC offers into
    // arbitrary rooms.
    const targetSocket: any = { rooms: new Set(['sock-u2', 'room:other']) }
    const io = makeIo(new Map([['sock-u2', targetSocket]]))
    io.setupDirectEmit()
    onlineUsers.set('u2', 'sock-u2')

    const socket = makeSocket('u1', 'r1')
    registerVoiceHandlers(io, socket)

    await socket._fire('voice:signal', { toUserId: 'u2', signal: { type: 'offer', sdp: 'x' } })

    expect(io._directEmit).not.toHaveBeenCalled()
  })

  it('ignores malformed payloads without crashing', async () => {
    const io = makeIo()
    io.setupDirectEmit()
    const socket = makeSocket('u1', 'r1')
    registerVoiceHandlers(io, socket)

    await socket._fire('voice:signal', null)
    await socket._fire('voice:signal', {})
    await socket._fire('voice:signal', { toUserId: 42, signal: {} })

    expect(io._directEmit).not.toHaveBeenCalled()
  })

  it('rate-limits signal events at 60/sec per socket', async () => {
    const targetSocket: any = { rooms: new Set(['sock-u2', 'room:r1']) }
    const io = makeIo(new Map([['sock-u2', targetSocket]]))
    io.setupDirectEmit()
    onlineUsers.set('u2', 'sock-u2')

    const socket = makeSocket('u1', 'r1')
    registerVoiceHandlers(io, socket)

    // 60 within a single second should pass; the 61st should be dropped.
    for (let i = 0; i < 60; i++) {
      await socket._fire('voice:signal', { toUserId: 'u2', signal: { i } })
    }
    expect(io._directEmit).toHaveBeenCalledTimes(60)

    await socket._fire('voice:signal', { toUserId: 'u2', signal: { extra: true } })
    expect(io._directEmit).toHaveBeenCalledTimes(60)
  })
})

// ── leaveVoiceChannel utility (called from the disconnect path) ───────────

describe('leaveVoiceChannel', () => {
  it('removes user from Redis and broadcasts peer-left to the room', async () => {
    mockRedis.srem.mockResolvedValueOnce(1)
    const io = makeIo()

    await leaveVoiceChannel(io, 'r1', 'u1')

    expect(mockRedis.srem).toHaveBeenCalledWith('room:r1:voice', 'u1')
    expect(io.to).toHaveBeenCalledWith('room:r1')
    expect(io._broadcastEmit).toHaveBeenCalledWith('voice:peer-left', { userId: 'u1' })
  })

  it('does not broadcast when the user was not in the channel', async () => {
    mockRedis.srem.mockResolvedValueOnce(0)
    const io = makeIo()

    await leaveVoiceChannel(io, 'r1', 'u1')

    expect(io._broadcastEmit).not.toHaveBeenCalled()
  })

  it('swallows Redis errors so a flaky disconnect does not crash the server', async () => {
    mockRedis.srem.mockRejectedValueOnce(new Error('redis offline'))
    const io = makeIo()

    await expect(leaveVoiceChannel(io, 'r1', 'u1')).resolves.toBeUndefined()
    expect(io._broadcastEmit).not.toHaveBeenCalled()
  })
})
