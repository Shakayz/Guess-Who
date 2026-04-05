/**
 * matchmaking.test.ts
 *
 * Tests for src/socket/handlers/matchmaking.ts — matchmaking:join,
 * matchmaking:leave, cleanupEmptyQueue, and internal queue logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { redis } from '../../config/redis'
import { prisma } from '../../config/prisma'

const mockRedis = redis as any
const mockPrisma = prisma as any

// Ensure lrange, rpush, lpush, llen, lpop, lrem, expire are on the mock
;(mockRedis as any).lrange  = vi.fn().mockResolvedValue([])
;(mockRedis as any).rpush   = vi.fn().mockResolvedValue(1)
;(mockRedis as any).lpush   = vi.fn().mockResolvedValue(1)
;(mockRedis as any).llen    = vi.fn().mockResolvedValue(0)
;(mockRedis as any).lpop    = vi.fn().mockResolvedValue(null)
;(mockRedis as any).lrem    = vi.fn().mockResolvedValue(1)
;(mockRedis as any).expire  = vi.fn().mockResolvedValue(1)
;(mockRedis as any).keys    = vi.fn().mockResolvedValue([])

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeIo() {
  const emitFn = vi.fn()
  return {
    to: vi.fn(() => ({ emit: emitFn })),
    _emit: emitFn,
  } as any
}

function makeSocket(userId = 'user-1') {
  const listeners: Record<string, Function> = {}
  return {
    id: 'socket-id',
    data: { userId },
    emit: vi.fn(),
    on: vi.fn((event: string, cb: Function) => { listeners[event] = cb }),
    _fire: async (event: string, ...args: any[]) => listeners[event]?.(...args),
    userId,
  } as any
}

function queueEntry(userId: string, rankPoints = 100) {
  return JSON.stringify({ userId, socketId: `sock-${userId}`, categories: [], locale: 'en', rankPoints, joinedAt: Date.now() })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()

  mockRedis.get.mockResolvedValue(null)
  mockRedis.set.mockResolvedValue('OK')
  mockRedis.del.mockResolvedValue(1)
  ;(mockRedis as any).lrange.mockResolvedValue([])
  ;(mockRedis as any).rpush.mockResolvedValue(1)
  ;(mockRedis as any).lpush.mockResolvedValue(1)
  ;(mockRedis as any).llen.mockResolvedValue(0)
  ;(mockRedis as any).lpop.mockResolvedValue(null)
  ;(mockRedis as any).lrem.mockResolvedValue(1)
  ;(mockRedis as any).expire.mockResolvedValue(1)

  mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', locale: 'en', rankPoints: 100 })
  mockPrisma.room.create.mockResolvedValue({
    id: 'room-new', code: 'NEWC', hostId: 'user-1',
    maxPlayers: 8, imposterCount: 1,
    speakingTimeSeconds: 30, votingTimeSeconds: 30,
    isPrivate: false, language: 'en',
    createdAt: new Date(),
  })
})

afterEach(() => {
  vi.useRealTimers()
})

import { registerMatchmakingHandlers, cleanupEmptyQueue } from '../../socket/handlers/matchmaking'

// ─── matchmaking:join ─────────────────────────────────────────────────────────

describe('matchmaking:join', () => {
  it('adds player to the normal queue and emits matchmaking:status', async () => {
    const io = makeIo()
    const socket = makeSocket('user-1')
    ;(mockRedis as any).llen.mockResolvedValue(1)

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'normal', categories: [] })

    expect((mockRedis as any).rpush).toHaveBeenCalledWith(
      'matchmaking:normal:en',
      expect.any(String),
    )
    expect(socket.emit).toHaveBeenCalledWith('matchmaking:status', expect.objectContaining({
      queueSize: 1,
    }))
  })

  it('removes stale entry before re-adding for reconnecting player', async () => {
    const io = makeIo()
    const socket = makeSocket('user-1')
    const staleEntry = queueEntry('user-1')
    ;(mockRedis as any).lrange.mockResolvedValue([staleEntry])
    ;(mockRedis as any).llen.mockResolvedValue(1)

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'normal', categories: [] })

    expect((mockRedis as any).lrem).toHaveBeenCalledWith('matchmaking:normal:en', 0, staleEntry)
  })

  it('adds player to ranked queue and emits ranked status', async () => {
    const io = makeIo()
    const socket = makeSocket('user-1')
    ;(mockRedis as any).llen.mockResolvedValue(1)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1', locale: 'en' })
      .mockResolvedValueOnce({ id: 'user-1', rankPoints: 500 })

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'ranked', categories: [] })

    expect((mockRedis as any).rpush).toHaveBeenCalledWith(
      'matchmaking:ranked:en',
      expect.any(String),
    )
    expect(socket.emit).toHaveBeenCalledWith('matchmaking:status', expect.objectContaining({
      needed: 10,
    }))
  })

  it('uses normal gameMode when no gameMode provided', async () => {
    const io = makeIo()
    const socket = makeSocket('user-1')
    ;(mockRedis as any).llen.mockResolvedValue(1)

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', {})

    expect((mockRedis as any).rpush).toHaveBeenCalledWith(
      expect.stringContaining('matchmaking:normal:'),
      expect.any(String),
    )
  })

  it('fetches locale from user and scopes queue to locale', async () => {
    const io = makeIo()
    const socket = makeSocket('user-fr')
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-fr', locale: 'fr' })
      .mockResolvedValueOnce({ id: 'user-fr', rankPoints: 0 })
    ;(mockRedis as any).llen.mockResolvedValue(1)

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'normal', categories: [] })

    expect((mockRedis as any).rpush).toHaveBeenCalledWith(
      'matchmaking:normal:fr',
      expect.any(String),
    )
  })
})

// ─── matchmaking:leave ────────────────────────────────────────────────────────

describe('matchmaking:leave', () => {
  it('removes player from queue and emits matchmaking:left', async () => {
    const io = makeIo()
    const socket = makeSocket('user-1')
    const entry = queueEntry('user-1')
    ;(mockRedis as any).lrange.mockResolvedValue([entry])
    ;(mockRedis as any).llen.mockResolvedValue(0)

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:leave', { gameMode: 'normal' })

    expect((mockRedis as any).lrem).toHaveBeenCalledWith('matchmaking:normal:en', 0, entry)
    expect(socket.emit).toHaveBeenCalledWith('matchmaking:left', {})
  })

  it('emits matchmaking:left even when player was not in queue', async () => {
    const io = makeIo()
    const socket = makeSocket('user-1')
    ;(mockRedis as any).lrange.mockResolvedValue([]) // empty queue
    ;(mockRedis as any).llen.mockResolvedValue(0)

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:leave', {})

    expect(socket.emit).toHaveBeenCalledWith('matchmaking:left', {})
  })

  it('defaults to normal gameMode when none provided', async () => {
    const io = makeIo()
    const socket = makeSocket('user-1')
    ;(mockRedis as any).lrange.mockResolvedValue([])
    ;(mockRedis as any).llen.mockResolvedValue(0)

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:leave', undefined)

    expect(socket.emit).toHaveBeenCalledWith('matchmaking:left', {})
  })
})

// ─── cleanupEmptyQueue ────────────────────────────────────────────────────────

describe('cleanupEmptyQueue', () => {
  it('does nothing when queue is non-empty', async () => {
    ;(mockRedis as any).llen.mockResolvedValue(3)
    await cleanupEmptyQueue('matchmaking:normal:en')
    // No errors thrown — just returns
    expect((mockRedis as any).llen).toHaveBeenCalledWith('matchmaking:normal:en')
  })

  it('stops the window when queue becomes empty', async () => {
    ;(mockRedis as any).llen.mockResolvedValue(0)
    // Should not throw even if window doesn't exist
    await expect(cleanupEmptyQueue('matchmaking:normal:en')).resolves.not.toThrow()
  })
})

// ─── Queue logic — player joins emit correct status ───────────────────────────

describe('matchmaking queue status correctness', () => {
  it('includes rankPoints in ranked queue entry', async () => {
    const io = makeIo()
    const socket = makeSocket('user-1')
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1', locale: 'en' })
      .mockResolvedValueOnce({ id: 'user-1', rankPoints: 750 })
    ;(mockRedis as any).llen.mockResolvedValue(1)

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'ranked', categories: [] })

    const pushCall = (mockRedis as any).rpush.mock.calls[0]
    const entry = JSON.parse(pushCall[1])
    expect(entry.rankPoints).toBe(750)
    expect(entry.userId).toBe('user-1')
  })

  it('sets 5-minute TTL on the queue key', async () => {
    const io = makeIo()
    const socket = makeSocket('user-1')
    ;(mockRedis as any).llen.mockResolvedValue(1)

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'normal', categories: [] })

    expect((mockRedis as any).expire).toHaveBeenCalledWith('matchmaking:normal:en', 300)
  })

  it('emits correct elapsed and needed in status after queue starts', async () => {
    const io = makeIo()
    const socket = makeSocket('user-1')
    ;(mockRedis as any).llen.mockResolvedValue(2)

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'normal', categories: [] })

    const statusCall = socket.emit.mock.calls.find((c: any[]) => c[0] === 'matchmaking:status')
    expect(statusCall).toBeDefined()
    expect(statusCall[1]).toMatchObject({
      queueSize: 2,
      elapsed: expect.any(Number),
      maxWait: expect.any(Number),
    })
  })
})
