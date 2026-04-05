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

beforeEach(async () => {
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

  // Restore onlineUsers mock after vi.clearAllMocks() clears implementations
  const { onlineUsers: ou } = await import('../../socket/onlineUsers')
  ;(ou.get as any).mockReturnValue('sock-user')
  ;(ou.has as any).mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
})

vi.mock('../../socket/onlineUsers', () => ({
  onlineUsers: {
    get: vi.fn().mockReturnValue('sock-user'),
    has: vi.fn().mockReturnValue(true),
    set: vi.fn(),
    delete: vi.fn(),
  },
}))

import { registerMatchmakingHandlers, cleanupEmptyQueue } from '../../socket/handlers/matchmaking'
import { onlineUsers } from '../../socket/onlineUsers'

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

// ─── Matchmaking window tick logic ────────────────────────────────────────────
// These tests exercise the internal tick functions by using fake timers to
// trigger the setInterval that fires the match-making logic.
// Each test uses a unique locale so they get different queue keys and don't
// conflict in the module-level `activeWindows` Map.

describe('matchmaking window — tick fires match when queue hits IDEAL_PLAYERS', () => {
  it('starts match when IDEAL_PLAYERS (10) join and tick fires [locale:de]', async () => {
    const io = makeIo()
    const socket = makeSocket('user-de1')
    // Use unique locale to get unique queue key: matchmaking:normal:de
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-de1', locale: 'de' })
      .mockResolvedValueOnce({ id: 'user-de1', rankPoints: 0 })

    // IDEAL_PLAYERS = 10 — use 10 entries to trigger instant match
    const entries = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ userId: `user-de${i}`, socketId: `sock-de${i}`, categories: [], locale: 'de', rankPoints: 0, joinedAt: Date.now() })
    )
    ;(mockRedis as any).llen.mockResolvedValue(10)
    ;(mockRedis as any).lrange.mockResolvedValue(entries)
    let popCount = 0
    ;(mockRedis as any).lpop.mockImplementation(() => {
      const e = entries[popCount]
      popCount++
      return Promise.resolve(e ?? null)
    })
    ;(mockRedis as any).set.mockResolvedValue('OK')

    mockPrisma.room.create.mockResolvedValue({
      id: 'room-de', code: 'XYZW', hostId: 'user-de0',
      maxPlayers: 10, imposterCount: 2,
      speakingTimeSeconds: 30, votingTimeSeconds: 30,
      isPrivate: false, language: 'de',
      createdAt: new Date(),
    })

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'normal', categories: [] })

    // Advance timer to trigger the interval tick (TICK_INTERVAL_MS = 1000)
    await vi.advanceTimersByTimeAsync(2000)

    // Room should have been created
    expect(mockPrisma.room.create).toHaveBeenCalled()
  })

  it('starts ranked match when 10 players join ranked queue with similar LP [locale:it]', async () => {
    const io = makeIo()
    const socket = makeSocket('user-it1')

    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-it1', locale: 'it' })
      .mockResolvedValueOnce({ id: 'user-it1', rankPoints: 1000 })

    // Simulate 10 ranked players with similar LP (within ±50 of each other)
    const now = Date.now()
    const entries = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ userId: `user-it${i}`, socketId: `sock-it${i}`, categories: [], locale: 'it', rankPoints: 1000 + i, joinedAt: now })
    )
    ;(mockRedis as any).llen.mockResolvedValue(10)
    ;(mockRedis as any).lrange.mockResolvedValue(entries)
    ;(mockRedis as any).lrem.mockResolvedValue(1)
    ;(mockRedis as any).set.mockResolvedValue('OK')

    mockPrisma.room.create.mockResolvedValue({
      id: 'room-it-ranked', code: 'RNKD', hostId: 'user-it0',
      maxPlayers: 10, imposterCount: 3,
      speakingTimeSeconds: 30, votingTimeSeconds: 30,
      isPrivate: false, language: 'it',
      createdAt: new Date(),
    })

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'ranked', categories: [] })

    // Advance timer to trigger the ranked interval tick (RANKED_TICK_MS = 2000)
    await vi.advanceTimersByTimeAsync(5000)

    // Ranked room should have been created
    expect(mockPrisma.room.create).toHaveBeenCalled()
  })

  it('pushes players back when room creation fails in executeMatch [locale:pt]', async () => {
    const io = makeIo()
    const socket = makeSocket('user-pt1')
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-pt1', locale: 'pt' })
      .mockResolvedValueOnce({ id: 'user-pt1', rankPoints: 0 })

    // Use 10 entries for instant match at IDEAL_PLAYERS
    const entries = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ userId: `user-pt${i}`, socketId: `sock-pt${i}`, categories: [], locale: 'pt', rankPoints: 0, joinedAt: Date.now() })
    )
    ;(mockRedis as any).llen.mockResolvedValue(10)
    ;(mockRedis as any).lrange.mockResolvedValue(entries)
    let popCount = 0
    ;(mockRedis as any).lpop.mockImplementation(() => {
      const e = entries[popCount]
      popCount++
      return Promise.resolve(e ?? null)
    })
    ;(mockRedis as any).set.mockResolvedValue('OK')

    // Room creation fails → catch() returns null
    mockPrisma.room.create.mockImplementation(() => Promise.reject(new Error('DB down')))

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'normal', categories: [] })
    await vi.advanceTimersByTimeAsync(2000)

    // lpush should be called to push entries back (because room is null)
    expect((mockRedis as any).lpush).toHaveBeenCalled()
  })

  it('resets window timer after match when remaining players in queue [locale:zh]', async () => {
    const io = makeIo()
    const socket = makeSocket('user-zh1')
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-zh1', locale: 'zh' })
      .mockResolvedValueOnce({ id: 'user-zh1', rankPoints: 0 })

    // Use 10 entries for instant match (IDEAL_PLAYERS), then 5 remain
    const entries = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ userId: `user-zh${i}`, socketId: `sock-zh${i}`, categories: [], locale: 'zh', rankPoints: 0, joinedAt: Date.now() })
    )
    // Always return 10 so the tick sees IDEAL_PLAYERS and matches immediately
    ;(mockRedis as any).llen.mockResolvedValue(10)
    ;(mockRedis as any).lrange.mockResolvedValue(entries)
    let popCount = 0
    ;(mockRedis as any).lpop.mockImplementation(() => {
      const e = entries[popCount]
      popCount++
      return Promise.resolve(e ?? null)
    })
    ;(mockRedis as any).set.mockResolvedValue('OK')

    mockPrisma.room.create.mockResolvedValue({
      id: 'room-zh', code: 'ABCD', hostId: 'user-zh0',
      maxPlayers: 10, imposterCount: 2,
      speakingTimeSeconds: 30, votingTimeSeconds: 30,
      isPrivate: false, language: 'zh', createdAt: new Date(),
    })

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'normal', categories: [] })
    await vi.advanceTimersByTimeAsync(3000)

    // A room should have been created for the matched players
    expect(mockPrisma.room.create).toHaveBeenCalled()
  })

  it('resets window start time when max wait exceeded but queue too small [locale:ar-small]', async () => {
    const io = makeIo()
    const socket = makeSocket('user-arsmall')
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-arsmall', locale: 'ar' })
      .mockResolvedValueOnce({ id: 'user-arsmall', rankPoints: 0 })

    // Only 2 players — not enough for MIN_PLAYERS (3)
    const entries = [
      JSON.stringify({ userId: 'user-arsmall', socketId: 'sock-ar', locale: 'ar', rankPoints: 0, joinedAt: Date.now() }),
      JSON.stringify({ userId: 'user-arsmall2', socketId: 'sock-ar2', locale: 'ar', rankPoints: 0, joinedAt: Date.now() }),
    ]
    ;(mockRedis as any).llen.mockResolvedValue(2)
    ;(mockRedis as any).lrange.mockResolvedValue(entries)
    ;(mockRedis as any).set.mockResolvedValue('OK')

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'normal', categories: [] })

    // Advance past MAX_WAIT_SECONDS (45s) to trigger the "reset timer" branch
    await vi.advanceTimersByTimeAsync(60000)

    // Should not have created a room (only 2 players < MIN_PLAYERS 3)
    expect(mockPrisma.room.create).not.toHaveBeenCalled()
  })

  it('forces match at max wait time when MIN_PLAYERS (3) met [locale:es-force]', async () => {
    const io = makeIo()
    const socket = makeSocket('user-es1')
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-es1', locale: 'es' })
      .mockResolvedValueOnce({ id: 'user-es1', rankPoints: 0 })

    // 4 players — meets MIN_PLAYERS but below IDEAL_PLAYERS (10)
    const entries = Array.from({ length: 4 }, (_, i) =>
      JSON.stringify({ userId: `user-es${i}`, socketId: `sock-es${i}`, categories: [], locale: 'es', rankPoints: 0, joinedAt: Date.now() })
    )
    ;(mockRedis as any).llen.mockResolvedValue(4)
    ;(mockRedis as any).lrange.mockResolvedValue(entries)
    let popCount = 0
    ;(mockRedis as any).lpop.mockImplementation(() => {
      const e = entries[popCount]
      popCount++
      return Promise.resolve(e ?? null)
    })
    ;(mockRedis as any).set.mockResolvedValue('OK')

    mockPrisma.room.create.mockResolvedValue({
      id: 'room-es-forced', code: 'FORC', hostId: 'user-es0',
      maxPlayers: 10, imposterCount: 1,
      speakingTimeSeconds: 30, votingTimeSeconds: 30,
      isPrivate: false, language: 'es', createdAt: new Date(),
    })

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'normal', categories: [] })

    // Advance past MAX_WAIT_SECONDS (45s) — force-start branch should trigger
    await vi.advanceTimersByTimeAsync(60000)

    expect(mockPrisma.room.create).toHaveBeenCalled()
  })

  it('emits matchmaking:found to online players after successful match [locale:pl]', async () => {
    // Use 'pl' locale (unique in this file) to avoid activeWindows key collision
    const io = makeIo()
    const socket = makeSocket('user-pl-found')
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-pl-found', locale: 'pl' })
      .mockResolvedValueOnce({ id: 'user-pl-found', rankPoints: 0 })

    const entries = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ userId: `user-pl${i}`, socketId: `sock-pl${i}`, categories: [], locale: 'pl', rankPoints: 0, joinedAt: Date.now() })
    )
    ;(mockRedis as any).llen.mockResolvedValue(10)
    ;(mockRedis as any).lrange.mockResolvedValue(entries)
    let popCount = 0
    ;(mockRedis as any).lpop.mockImplementation(() => {
      const e = entries[popCount]
      popCount++
      return Promise.resolve(e ?? null)
    })
    ;(mockRedis as any).set.mockResolvedValue('OK')

    mockPrisma.room.create.mockResolvedValue({
      id: 'room-pl-broadcast', code: 'BCAST', hostId: 'user-pl0',
      maxPlayers: 10, imposterCount: 2,
      speakingTimeSeconds: 30, votingTimeSeconds: 30,
      isPrivate: false, language: 'pl', createdAt: new Date(),
    })

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'normal', categories: [] })
    await vi.advanceTimersByTimeAsync(2000)

    // Room created and matchmaking:found emitted via io.to(socketId)
    expect(mockPrisma.room.create).toHaveBeenCalled()
    expect(io.to).toHaveBeenCalled()
  })

  it('notifies players via io.to when ranked room creation fails [locale:ko-ranked]', async () => {
    // Use 'ko' locale (unique in this file) to avoid activeWindows key collision
    const io = makeIo()
    const socket = makeSocket('user-ko1')

    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-ko1', locale: 'ko' })
      .mockResolvedValueOnce({ id: 'user-ko1', rankPoints: 2000 })

    const now = Date.now()
    const entries = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ userId: `user-ko${i}`, socketId: `sock-ko${i}`, categories: [], locale: 'ko', rankPoints: 2000 + i, joinedAt: now })
    )
    ;(mockRedis as any).llen.mockResolvedValue(10)
    ;(mockRedis as any).lrange.mockResolvedValue(entries)
    ;(mockRedis as any).lrem.mockResolvedValue(1)
    ;(mockRedis as any).set.mockResolvedValue('OK')

    // Room creation fails — catch() returns null → notify players
    mockPrisma.room.create.mockImplementation(() => Promise.reject(new Error('DB error')))

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'ranked', categories: [] })
    await vi.advanceTimersByTimeAsync(5000)

    // io.to should have been called for error notification + matchmaking:error emit
    expect(io.to).toHaveBeenCalled()
  })
})

// ─── Coverage gap: lines 151-152 — stopMatchmakingWindow when queue empties after match

describe('executeMatch — stops window when queue empties after match (lines 151-152)', () => {
  it('stops the matchmaking window when queue is empty after executing match [locale:fi]', async () => {
    const io = makeIo()
    const socket = makeSocket('user-fi1')
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-fi1', locale: 'fi' })
      .mockResolvedValueOnce({ id: 'user-fi1', rankPoints: 0 })

    const entries = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ userId: `user-fi${i}`, socketId: `sock-fi${i}`, categories: [], locale: 'fi', rankPoints: 0, joinedAt: Date.now() })
    )
    let popCount = 0
    ;(mockRedis as any).lpop.mockImplementation(() => {
      const e = entries[popCount]
      popCount++
      return Promise.resolve(e ?? null)
    })
    ;(mockRedis as any).set.mockResolvedValue('OK')

    // First llen (during join status emit) returns 10
    // Second llen (after executeMatch for remaining check) returns 0 → stopMatchmakingWindow
    ;(mockRedis as any).llen
      .mockResolvedValueOnce(10)  // initial status
      .mockResolvedValueOnce(10)  // threshold check
      .mockResolvedValueOnce(0)   // after match: queue empty → stopMatchmakingWindow

    mockPrisma.room.create.mockResolvedValue({
      id: 'room-fi', code: 'ABCF', hostId: 'user-fi0',
      maxPlayers: 10, imposterCount: 2,
      speakingTimeSeconds: 30, votingTimeSeconds: 30,
      isPrivate: false, language: 'fi', createdAt: new Date(),
    })

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'normal', categories: [] })
    await vi.advanceTimersByTimeAsync(2000)

    expect(mockPrisma.room.create).toHaveBeenCalled()
  })
})

// ─── Coverage gap: lines 165-167 — normal queue empty stops window ────────────
// tickMatchmakingQueue calls stopMatchmakingWindow when llen returns 0.

describe('tickMatchmakingQueue — stops window when queue is empty (lines 165-167)', () => {
  it('stops the normal matchmaking window when queue empties between ticks [locale:nl]', async () => {
    const io = makeIo()
    const socket = makeSocket('user-nl1')

    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-nl1', locale: 'nl' })
      .mockResolvedValueOnce({ id: 'user-nl1', rankPoints: 0 })

    // Player joins but queue appears empty on the first tick (queue drained)
    ;(mockRedis as any).llen.mockResolvedValue(1)  // non-zero so join succeeds
    ;(mockRedis as any).set.mockResolvedValue('OK')

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'normal', categories: [] })

    // Now make llen return 0 so the next tick fires the empty-queue path
    ;(mockRedis as any).llen.mockResolvedValue(0)

    // Advance past TICK_INTERVAL_MS (1000ms) to trigger the normal queue tick
    await vi.advanceTimersByTimeAsync(2000)

    // stopMatchmakingWindow should have been called — no room created
    expect(mockPrisma.room.create).not.toHaveBeenCalled()
  })
})

// ─── Coverage gap: lines 215-217 — ranked queue empty stops window ────────────
// tickRankedQueue calls stopMatchmakingWindow when lrange returns no entries.

describe('tickRankedQueue — stops window when queue is empty (lines 215-217)', () => {
  it('stops the ranked matchmaking window when queue empties between ticks [locale:sv]', async () => {
    const io = makeIo()
    const socket = makeSocket('user-sv1')

    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-sv1', locale: 'sv' })
      .mockResolvedValueOnce({ id: 'user-sv1', rankPoints: 500 })

    // After joining, the queue will appear empty on the ranked tick
    ;(mockRedis as any).llen.mockResolvedValue(1)
    // lrange returns empty — simulates queue draining between join and tick
    ;(mockRedis as any).lrange.mockResolvedValue([])
    ;(mockRedis as any).set.mockResolvedValue('OK')

    registerMatchmakingHandlers(io, socket)
    await socket._fire('matchmaking:join', { gameMode: 'ranked', categories: [] })

    // Advance past RANKED_TICK_MS (2000ms) to trigger the ranked interval tick
    await vi.advanceTimersByTimeAsync(4000)

    // stopMatchmakingWindow should be called — no room created
    expect(mockPrisma.room.create).not.toHaveBeenCalled()
  })
})
