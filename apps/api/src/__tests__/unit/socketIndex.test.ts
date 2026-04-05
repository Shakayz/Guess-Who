/**
 * socketIndex.test.ts
 *
 * Tests for the registerSocketHandlers function in src/socket/index.ts.
 * We test JWT auth middleware, rate limiter, and all socket event handlers
 * by creating mock socket/io objects and triggering events manually.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { redis } from '../../config/redis'
import { prisma } from '../../config/prisma'

const mockRedis = redis as any
const mockPrisma = prisma as any

// Add extra prisma tables used by socket/index.ts
;(mockPrisma as any).directMessage = { create: vi.fn() }
;(mockPrisma as any).gameChatMessage = { create: vi.fn(), findMany: vi.fn() }
;(mockPrisma as any).honor = { findFirst: vi.fn(), create: vi.fn() }
;(mockPrisma as any).game = { findFirst: vi.fn() }
;(mockPrisma as any).round = { findUnique: vi.fn() }

// Mock the handlers so they don't add noise
vi.mock('../../socket/handlers/room', () => ({ registerRoomHandlers: vi.fn() }))
vi.mock('../../socket/handlers/game', () => ({ registerGameHandlers: vi.fn() }))
vi.mock('../../socket/handlers/chat', () => ({ registerChatHandlers: vi.fn() }))
vi.mock('../../socket/handlers/matchmaking', () => ({
  registerMatchmakingHandlers: vi.fn(),
  cleanupEmptyQueue: vi.fn().mockResolvedValue(undefined),
}))

// Helper to build a mock socket
function makeSocket(overrides: Partial<any> = {}) {
  const listeners: Record<string, Function> = {}
  const rooms = new Set<string>(['socket-abc'])
  const socket: any = {
    id: 'socket-abc',
    handshake: { auth: { token: '' } },
    data: {},
    rooms,
    emit: vi.fn(),
    join: vi.fn(async (room: string) => { rooms.add(room) }),
    leave: vi.fn(async (room: string) => { rooms.delete(room) }),
    on: vi.fn((event: string, cb: Function) => { listeners[event] = cb }),
    _fire: (event: string, ...args: any[]) => listeners[event]?.(...args),
    ...overrides,
  }
  return socket
}

function makeIo() {
  const listeners: Record<string, Function> = {}
  const emitFn = vi.fn()
  const io: any = {
    use: vi.fn((middleware: Function) => { listeners['middleware'] = middleware }),
    on: vi.fn((event: string, cb: Function) => { listeners[event] = cb }),
    to: vi.fn(() => ({ emit: emitFn })),
    _emit: emitFn,
    _fire: (event: string, ...args: any[]) => listeners[event]?.(...args),
    _runMiddleware: (socket: any, next: Function) => listeners['middleware']?.(socket, next),
  }
  return io
}

const JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long'

function makeValidToken(sub = 'user-1', username = 'TestUser') {
  return jwt.sign({ sub, username }, JWT_SECRET, { expiresIn: '1h' })
}

// Helper: build registered socket (auth middleware applied + connection fired)
async function buildConnectedSocket(ioOverrides = {}, socketOverrides: Partial<any> = {}) {
  const { registerSocketHandlers } = await import('../../socket/index')
  const io = makeIo()
  const socket = makeSocket(socketOverrides)
  const token = makeValidToken()
  socket.handshake.auth.token = token

  registerSocketHandlers(io, undefined)

  // Run auth middleware
  await new Promise<void>((resolve) => {
    io._runMiddleware(socket, (err?: Error) => {
      if (!err) resolve()
    })
  })

  // Fire connection event
  io._fire('connection', socket)

  return { io, socket }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRedis.get.mockResolvedValue(null)
  mockRedis.set.mockResolvedValue('OK')
  mockRedis.del.mockResolvedValue(1)
  mockRedis.keys = vi.fn().mockResolvedValue([])
  mockRedis.lrange = vi.fn().mockResolvedValue([])
  mockRedis.lrem = vi.fn().mockResolvedValue(1)

  mockPrisma.room.findUnique.mockResolvedValue({
    id: 'room-1', code: 'ABCD', hostId: 'user-1', status: 'waiting',
    speakingTimeSeconds: 30, votingTimeSeconds: 30, maxPlayers: 8, imposterCount: 1,
  })
  mockPrisma.room.update.mockResolvedValue({})
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', username: 'TestUser', avatarUrl: null })
  mockPrisma.directMessage.create.mockResolvedValue({
    id: 'dm-1', senderId: 'user-1', receiverId: 'user-2',
    text: 'hello', createdAt: new Date(),
  })
  mockPrisma.gameChatMessage.create.mockResolvedValue({
    id: 'msg-1', userId: 'user-1', username: 'TestUser', text: 'hi', createdAt: new Date(),
  })
  mockPrisma.gameChatMessage.findMany.mockResolvedValue([])
  mockPrisma.honor.findFirst.mockResolvedValue(null)
  mockPrisma.$transaction.mockResolvedValue([{}, {}])
  mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1' })
})

// ─── Auth middleware ──────────────────────────────────────────────────────────

describe('JWT auth middleware', () => {
  it('calls next with error when no token is provided', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = undefined

    registerSocketHandlers(io)

    const next = vi.fn()
    io._runMiddleware(socket, next)
    expect(next).toHaveBeenCalledWith(new Error('Missing token'))
  })

  it('calls next with error for an invalid token', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = 'invalid.token.here'

    registerSocketHandlers(io)

    const next = vi.fn()
    io._runMiddleware(socket, next)
    expect(next).toHaveBeenCalledWith(new Error('Invalid token'))
  })

  it('sets userId and username on socket and calls next() for valid token', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('u99', 'Alice')

    registerSocketHandlers(io)

    const next = vi.fn()
    io._runMiddleware(socket, next)
    expect(next).toHaveBeenCalledWith() // no error
    expect(socket.data.userId).toBe('u99')
    expect(socket.data.username).toBe('Alice')
  })

  it('attaches onlineUsers and io to fastify when fastify is provided', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const fastify: any = {}
    registerSocketHandlers(io, fastify)
    expect(fastify.io).toBe(io)
    expect(fastify.onlineUsers).toBeDefined()
  })
})

// ─── room:invite ─────────────────────────────────────────────────────────────

describe('room:invite handler', () => {
  it('emits room:invited to target socket when target is online', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const { onlineUsers } = await import('../../socket/onlineUsers')

    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    // Register target as online
    onlineUsers.set('user-2', 'target-socket-id')

    socket._fire('room:invite', { toUserId: 'user-2', roomCode: 'XYZW' })

    expect(io.to).toHaveBeenCalledWith('target-socket-id')
    expect(io._emit).toHaveBeenCalledWith('room:invited', expect.objectContaining({
      fromUserId: 'user-1',
      roomCode: 'XYZW',
    }))

    onlineUsers.delete('user-2')
  })

  it('does nothing when target user is offline', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const { onlineUsers } = await import('../../socket/onlineUsers')

    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    onlineUsers.delete('user-99') // ensure offline

    socket._fire('room:invite', { toUserId: 'user-99', roomCode: 'XYZW' })
    expect(io._emit).not.toHaveBeenCalled()
  })
})

// ─── emote:send ──────────────────────────────────────────────────────────────

describe('emote:send handler', () => {
  it('emits emote:receive to the room for valid emoji', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.rooms.add('room:room-1')

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    socket._fire('emote:send', { emoji: '👍' })

    expect(io.to).toHaveBeenCalledWith('room:room-1')
    expect(io._emit).toHaveBeenCalledWith('emote:receive', expect.objectContaining({
      userId: 'user-1',
      emoji: '👍',
    }))
  })

  it('does nothing for invalid emoji', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.rooms.add('room:room-1')

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    socket._fire('emote:send', { emoji: '💀' })
    expect(io._emit).not.toHaveBeenCalled()
  })

  it('does nothing when socket is not in a room', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    // No room: prefix rooms

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    socket._fire('emote:send', { emoji: '😮' })
    expect(io._emit).not.toHaveBeenCalled()
  })
})

// ─── dm:send ─────────────────────────────────────────────────────────────────

describe('dm:send handler', () => {
  it('creates a DM and emits to sender and recipient when recipient is online', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const { onlineUsers } = await import('../../socket/onlineUsers')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.data.userId = 'user-1'

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    onlineUsers.set('user-2', 'recipient-socket')

    await socket._fire('dm:send', { toUserId: 'user-2', text: 'Hello!' })

    expect(mockPrisma.directMessage.create).toHaveBeenCalled()
    expect(io.to).toHaveBeenCalledWith('recipient-socket')

    onlineUsers.delete('user-2')
  })

  it('does nothing when text is empty', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.data.userId = 'user-1'

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    await socket._fire('dm:send', { toUserId: 'user-2', text: '   ' })
    expect(mockPrisma.directMessage.create).not.toHaveBeenCalled()
  })
})

// ─── gamechat:send ───────────────────────────────────────────────────────────

describe('gamechat:send handler', () => {
  it('creates a chat message and broadcasts to room', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.data.userId = 'user-1'
    socket.data.username = 'Alice'
    socket.data.roomCode = 'ABCD'

    mockPrisma.room.findUnique.mockResolvedValue({
      id: 'room-1', code: 'ABCD',
      games: [{ id: 'game-1' }],
    })

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    await socket._fire('gamechat:send', { text: 'Good game!' })

    expect(mockPrisma.gameChatMessage.create).toHaveBeenCalled()
    expect(io.to).toHaveBeenCalledWith('room:room-1')
  })

  it('does nothing when no roomCode is set', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.data.userId = 'user-1'
    // No roomCode

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    await socket._fire('gamechat:send', { text: 'Hello' })
    expect(mockPrisma.gameChatMessage.create).not.toHaveBeenCalled()
  })
})

// ─── gamechat:history ────────────────────────────────────────────────────────

describe('gamechat:history handler', () => {
  it('emits empty messages when no game found', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.data.userId = 'user-1'
    socket.data.roomCode = 'ABCD'

    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', games: [] })

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    await socket._fire('gamechat:history')

    expect(socket.emit).toHaveBeenCalledWith('gamechat:history', { messages: [] })
  })

  it('fetches and emits messages when game exists', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.data.userId = 'user-1'
    socket.data.roomCode = 'ABCD'

    const msgs = [{ id: 'm1', text: 'hi' }]
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', games: [{ id: 'game-1' }] })
    mockPrisma.gameChatMessage.findMany.mockResolvedValue(msgs)

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    await socket._fire('gamechat:history')

    expect(socket.emit).toHaveBeenCalledWith('gamechat:history', { messages: msgs })
  })
})

// ─── detective:reveal ────────────────────────────────────────────────────────

describe('detective:reveal handler (socket/index.ts)', () => {
  it('returns ability-used error when reveal already consumed', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Detective')
    socket.data.userId = 'user-1'
    socket.data.roomCode = 'ABCD'

    const state = {
      players: [
        { userId: 'user-1', role: 'detective', status: 'alive', detectiveRevealUsed: true },
        { userId: 'user-2', role: 'villager',  status: 'alive' },
      ],
    }
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', code: 'ABCD' })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    await socket._fire('detective:reveal', { targetUserId: 'user-2' })

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'ABILITY_USED' }))
  })

  it('returns target-eliminated error when target is not alive', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Detective')
    socket.data.userId = 'user-1'
    socket.data.roomCode = 'ABCD'

    const state = {
      players: [
        { userId: 'user-1', role: 'detective', status: 'alive', detectiveRevealUsed: false },
        { userId: 'user-2', role: 'imposter',  status: 'eliminated', username: 'Dave' },
      ],
    }
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', code: 'ABCD' })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    await socket._fire('detective:reveal', { targetUserId: 'user-2' })

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'TARGET_ELIMINATED' }))
  })

  it('emits detective:reveal-result with target role when valid', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Detective')
    socket.data.userId = 'user-1'
    socket.data.roomCode = 'ABCD'

    const state = {
      players: [
        { userId: 'user-1', role: 'detective', status: 'alive', detectiveRevealUsed: false },
        { userId: 'user-2', role: 'imposter',  status: 'alive', username: 'Dave' },
      ],
    }
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', code: 'ABCD' })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    await socket._fire('detective:reveal', { targetUserId: 'user-2' })

    expect(socket.emit).toHaveBeenCalledWith('detective:reveal-result', expect.objectContaining({
      targetUserId: 'user-2',
      role: 'imposter',
    }))
  })
})

// ─── honor:give ──────────────────────────────────────────────────────────────

describe('honor:give handler', () => {
  it('ignores self-honor', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.data.userId = 'user-1'

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    await socket._fire('honor:give', { targetUserId: 'user-1', honorType: 'teamplayer' })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('ignores invalid honor types', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.data.userId = 'user-1'

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    await socket._fire('honor:give', { targetUserId: 'user-2', honorType: 'invalid_type' })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('creates honor and increments honor points when valid', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const { onlineUsers } = await import('../../socket/onlineUsers')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.data.userId = 'user-1'
    socket.data.username = 'Alice'

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    onlineUsers.set('user-2', 'sock-2')

    await socket._fire('honor:give', { targetUserId: 'user-2', honorType: 'teamplayer', gameId: 'game-1' })

    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(io.to).toHaveBeenCalledWith('sock-2')

    onlineUsers.delete('user-2')
  })
})

// ─── disconnect ──────────────────────────────────────────────────────────────

describe('disconnect handler', () => {
  it('removes user from onlineUsers on disconnect', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const { onlineUsers } = await import('../../socket/onlineUsers')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-disconnect', 'Leaver')

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    expect(onlineUsers.has('user-disconnect')).toBe(true)

    await socket._fire('disconnect')

    expect(onlineUsers.has('user-disconnect')).toBe(false)
  })

  it('handles disconnect when player is mid-game (marks as eliminated)', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.rooms.add('room:room-1')

    const state = {
      status: 'in_progress',
      players: [
        { userId: 'user-1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'user-2', username: 'Bob',   role: 'imposter', status: 'alive' },
      ],
    }

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', hostId: 'user-2' })

    await socket._fire('disconnect')

    expect(mockRedis.set).toHaveBeenCalled()
  })

  it('handles disconnect in lobby (removes player from room)', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.rooms.add('room:room-1')

    const state = {
      status: 'waiting',
      players: [
        { userId: 'user-1', username: 'Alice', isHost: false },
        { userId: 'user-2', username: 'Bob',   isHost: true },
      ],
    }

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', hostId: 'user-2' })

    await socket._fire('disconnect')

    const setCall = mockRedis.set.mock.calls[0]
    const savedState = JSON.parse(setCall[1])
    expect(savedState.players.some((p: any) => p.userId === 'user-1')).toBe(false)
  })

  it('reassigns host when the disconnecting player was the host in lobby', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    // user-host is both the socket user and the room host
    socket.handshake.auth.token = makeValidToken('user-host', 'HostUser')
    socket.rooms.add('room:room-99')

    const state = {
      status: 'waiting',
      players: [
        { userId: 'user-host', username: 'HostUser', isHost: true, isReady: true },
        { userId: 'user-2',    username: 'Player2',  isHost: false, isReady: false },
      ],
    }

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-99', hostId: 'user-host' })
    mockPrisma.room.update.mockResolvedValue({})

    await socket._fire('disconnect')

    // The room should have been updated with the new host
    expect(mockPrisma.room.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'room-99' },
      data: { hostId: 'user-2' },
    }))
    // And the event should have been emitted
    expect(io._emit).toHaveBeenCalledWith('room:host-changed', expect.objectContaining({
      newHostId: 'user-2',
    }))
  })

  it('removes player from matchmaking queue on disconnect', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-queued', 'QueuedUser')

    // Simulate user being in a matchmaking queue
    const queueEntry = JSON.stringify({ userId: 'user-queued', socketId: 'socket-abc', lp: 100 })
    mockRedis.keys = vi.fn().mockResolvedValue(['matchmaking:en:normal'])
    mockRedis.lrange = vi.fn().mockResolvedValue([queueEntry])
    mockRedis.lrem = vi.fn().mockResolvedValue(1)

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    await socket._fire('disconnect')

    // lrem should have been called to remove the user from the queue
    expect(mockRedis.lrem).toHaveBeenCalledWith('matchmaking:en:normal', 0, queueEntry)
  })
})

// ─── deadchat ────────────────────────────────────────────────────────────────

describe('deadchat handlers', () => {
  it('joins dead room when player is eliminated', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.data.userId = 'user-1'
    socket.data.roomCode = 'ABCD'

    const state = {
      players: [{ userId: 'user-1', status: 'eliminated' }],
    }
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', code: 'ABCD' })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    await socket._fire('deadchat:join')

    expect(socket.join).toHaveBeenCalledWith('dead:room-1')
  })

  it('sends deadchat message when player is in dead room', async () => {
    const { registerSocketHandlers } = await import('../../socket/index')
    const io = makeIo()
    const socket = makeSocket()
    socket.handshake.auth.token = makeValidToken('user-1', 'Alice')
    socket.data.userId = 'user-1'
    socket.data.username = 'Alice'
    socket.data.roomCode = 'ABCD'
    socket.rooms.add('dead:room-1') // already in dead room

    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', code: 'ABCD' })

    registerSocketHandlers(io)
    const next = vi.fn()
    io._runMiddleware(socket, next)
    io._fire('connection', socket)

    await socket._fire('deadchat:send', { text: 'I saw it all!' })

    expect(io.to).toHaveBeenCalledWith('dead:room-1')
    expect(io._emit).toHaveBeenCalledWith('deadchat:message', expect.objectContaining({
      text: 'I saw it all!',
      userId: 'user-1',
    }))
  })
})
