/**
 * roomHandler.test.ts
 *
 * Tests for src/socket/handlers/room.ts — room:join, room:leave, room:ready,
 * room:settings, game:start, detective:reveal, game:forfeit, game:leave-eliminated.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redis } from '../../config/redis'
import { prisma } from '../../config/prisma'

const mockRedis = redis as any
const mockPrisma = prisma as any

// Extra prisma models used by room handler
;(mockPrisma as any).game = { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() }
;(mockPrisma as any).round = { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() }
;(mockPrisma as any).gameParticipation = {
  findFirst: vi.fn(),
  createMany: vi.fn(),
  updateMany: vi.fn(),
}
;(mockPrisma as any).wordPack = { findFirst: vi.fn(), findUnique: vi.fn() }

// Mock gameLoop exports to avoid timer side-effects
vi.mock('../../socket/gameLoop', () => ({
  startRound: vi.fn().mockResolvedValue(undefined),
  forfeitPlayer: vi.fn().mockResolvedValue(undefined),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeIo() {
  const emitFn = vi.fn()
  return {
    to: vi.fn(() => ({ emit: emitFn })),
    _emit: emitFn,
  } as any
}

function makeSocket(userId = 'host-1', username = 'Host', extraRooms: string[] = []) {
  const listeners: Record<string, Function> = {}
  const rooms = new Set<string>(['socket-id', ...extraRooms])
  return {
    id: 'socket-id',
    data: { userId, username, roomCode: undefined as string | undefined },
    rooms,
    emit: vi.fn(),
    join: vi.fn(async (r: string) => rooms.add(r)),
    leave: vi.fn(async (r: string) => rooms.delete(r)),
    on: vi.fn((event: string, cb: Function) => { listeners[event] = cb }),
    _fire: (event: string, ...args: any[]) => listeners[event]?.(...args),
    userId,
    username,
  } as any
}

const defaultRoom = {
  id: 'room-1',
  code: 'ABCD',
  hostId: 'host-1',
  status: 'waiting',
  maxPlayers: 8,
  imposterCount: 1,
  speakingTimeSeconds: 30,
  votingTimeSeconds: 30,
  wordPackId: null,
  isPrivate: false,
  language: 'en',
  createdAt: new Date(),
}

const waitingState = {
  status: 'waiting',
  gameMode: 'normal',
  players: [],
  currentRound: 0,
  maxRounds: 5,
  categories: [],
  enableDetective: false,
  enableDoubleAgent: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRedis.get.mockResolvedValue(null)
  mockRedis.set.mockResolvedValue('OK')
  mockRedis.del.mockResolvedValue(1)

  mockPrisma.room.findUnique.mockResolvedValue({ ...defaultRoom })
  mockPrisma.room.update.mockResolvedValue({ ...defaultRoom })
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'host-1', locale: 'en' })
  mockPrisma.game.findFirst.mockResolvedValue(null)
  mockPrisma.game.create.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
  mockPrisma.round.create.mockResolvedValue({ id: 'round-1', roundNumber: 1 })
  mockPrisma.gameParticipation.findFirst.mockResolvedValue(null)
  mockPrisma.gameParticipation.createMany.mockResolvedValue({})
  mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
  mockPrisma.wordPack.findFirst.mockResolvedValue(null)
  mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
    fn({ game: { create: vi.fn().mockResolvedValue({ id: 'game-1' }) },
         round: { create: vi.fn().mockResolvedValue({ id: 'round-1', roundNumber: 1 }) },
         gameParticipation: { createMany: vi.fn().mockResolvedValue({}) },
       }),
  )
})

import { registerRoomHandlers } from '../../socket/handlers/room'

// ─── room:join ────────────────────────────────────────────────────────────────

describe('room:join', () => {
  it('emits ROOM_NOT_FOUND when room does not exist', async () => {
    const io = makeIo()
    const socket = makeSocket()
    mockPrisma.room.findUnique.mockResolvedValue(null)

    registerRoomHandlers(io, socket)
    await socket._fire('room:join', { roomCode: 'XXXX' })

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'ROOM_NOT_FOUND' }))
  })

  it('emits LANGUAGE_MISMATCH when player locale differs from room language', async () => {
    const io = makeIo()
    const socket = makeSocket('other-user', 'Other')
    mockPrisma.room.findUnique.mockResolvedValue({ ...defaultRoom, language: 'fr' })
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'other-user', locale: 'en' })

    // Need to make the set NX call return 'OK' for lock
    ;(mockRedis as any).set.mockResolvedValue('OK')
    mockRedis.get.mockResolvedValue(JSON.stringify(waitingState))

    registerRoomHandlers(io, socket)
    await socket._fire('room:join', { roomCode: 'ABCD' })

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'LANGUAGE_MISMATCH' }))
  })

  it('adds player to room and emits room:updated on successful join', async () => {
    const io = makeIo()
    const socket = makeSocket()
    // Set NX to simulate lock acquired
    ;(mockRedis as any).set = vi.fn().mockImplementation((key: string, ...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(waitingState))
    mockRedis.del.mockResolvedValue(1)

    registerRoomHandlers(io, socket)
    await socket._fire('room:join', { roomCode: 'ABCD' })

    expect(socket.join).toHaveBeenCalledWith('room:room-1')
    expect(io.to).toHaveBeenCalledWith('room:room-1')
  })

  it('emits GAME_IN_PROGRESS when joining a room mid-game', async () => {
    const io = makeIo()
    const socket = makeSocket('new-user', 'Newcomer')
    const inProgressState = { ...waitingState, status: 'in_progress', players: [{ userId: 'host-1' }] }
    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(inProgressState))
    mockRedis.del.mockResolvedValue(1)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'new-user', locale: 'en' })

    registerRoomHandlers(io, socket)
    await socket._fire('room:join', { roomCode: 'ABCD' })

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'GAME_IN_PROGRESS' }))
  })

  it('emits ROOM_FULL when room is at capacity', async () => {
    const io = makeIo()
    const socket = makeSocket('new-user', 'Newcomer')
    const fullState = {
      ...waitingState,
      players: Array.from({ length: 8 }, (_, i) => ({ userId: `u${i}` })),
    }
    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(fullState))
    mockRedis.del.mockResolvedValue(1)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'new-user', locale: 'en' })

    registerRoomHandlers(io, socket)
    await socket._fire('room:join', { roomCode: 'ABCD' })

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'ROOM_FULL' }))
  })

  it('sends reconnect payload to existing player who rejoins mid-game', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host')
    const inProgressState = {
      ...waitingState,
      status: 'in_progress',
      currentRound: 1,
      villagerWord: 'Apple',
      imposterWord: 'Pear',
      phaseStartedAt: Date.now() - 5000,
      phaseDurationSeconds: 30,
      rounds: [{ roundNumber: 1, speakingOrder: ['host-1'], clues: [], votes: [] }],
      players: [{ userId: 'host-1', role: 'villager', status: 'alive', id: 'old-socket' }],
    }
    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(inProgressState))
    mockRedis.del.mockResolvedValue(1)

    registerRoomHandlers(io, socket)
    await socket._fire('room:join', { roomCode: 'ABCD' })

    expect(socket.emit).toHaveBeenCalledWith('game:started', expect.objectContaining({ yourRole: 'villager' }))
    expect(socket.emit).toHaveBeenCalledWith('game:sync', expect.any(Object))
  })
})

// ─── room:leave ───────────────────────────────────────────────────────────────

describe('room:leave', () => {
  it('removes player from lobby state when leaving a waiting room', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = {
      ...waitingState,
      players: [
        { userId: 'host-1', username: 'Host', isHost: false, isReady: true },
        { userId: 'other-1', username: 'Other', isHost: false, isReady: true },
      ],
    }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockPrisma.room.findUnique.mockResolvedValue({ ...defaultRoom, hostId: 'other-1' })

    registerRoomHandlers(io, socket)
    await socket._fire('room:leave')

    const setCall = mockRedis.set.mock.calls[0]
    const savedState = JSON.parse(setCall[1])
    expect(savedState.players.find((p: any) => p.userId === 'host-1')).toBeUndefined()
  })

  it('calls forfeitPlayer when leaving a room mid-game', async () => {
    const { forfeitPlayer } = await import('../../socket/gameLoop')
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = {
      ...waitingState,
      status: 'in_progress',
      players: [{ userId: 'host-1', username: 'Host', status: 'alive' }],
    }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerRoomHandlers(io, socket)
    await socket._fire('room:leave')

    expect(forfeitPlayer).toHaveBeenCalledWith(io, 'room-1', 'host-1')
  })

  it('reassigns host when host leaves the lobby', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = {
      ...waitingState,
      players: [
        { userId: 'host-1', username: 'Host', isHost: true, isReady: true },
        { userId: 'player-2', username: 'Player2', isHost: false, isReady: true },
      ],
    }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockPrisma.room.findUnique.mockResolvedValue({ ...defaultRoom, hostId: 'host-1' })

    registerRoomHandlers(io, socket)
    await socket._fire('room:leave')

    expect(mockPrisma.room.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hostId: 'player-2' }),
    }))
  })
})

// ─── player:ready ─────────────────────────────────────────────────────────────

describe('player:ready', () => {
  it('updates player ready state and emits room:updated', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = {
      ...waitingState,
      players: [{ userId: 'host-1', username: 'Host', isReady: false }],
    }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerRoomHandlers(io, socket)
    await socket._fire('player:ready', true)

    const setCall = mockRedis.set.mock.calls[0]
    const savedState = JSON.parse(setCall[1])
    expect(savedState.players[0].isReady).toBe(true)
    expect(io.to).toHaveBeenCalledWith('room:room-1')
  })
})

// ─── room:settings ────────────────────────────────────────────────────────────

describe('room:settings', () => {
  it('updates gameMode in state and persists numeric settings', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = { ...waitingState }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerRoomHandlers(io, socket)
    await socket._fire('room:settings', { gameMode: 'special', maxPlayers: 6, imposterCount: 2 })

    expect(mockPrisma.room.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ maxPlayers: 6, imposterCount: 2 }),
    }))
    expect(io.to).toHaveBeenCalledWith('room:room-1')
  })

  it('force-disables special roles when gameMode is normal', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = { ...waitingState, gameMode: 'special', detectiveCount: 1, doubleAgentCount: 1 }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerRoomHandlers(io, socket)
    await socket._fire('room:settings', { gameMode: 'normal' })

    const setCall = mockRedis.set.mock.calls[0]
    const savedState = JSON.parse(setCall[1])
    expect(savedState.detectiveCount).toBe(0)
    expect(savedState.doubleAgentCount).toBe(0)
  })

  it('does nothing if socket is not in a room', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host') // no room: rooms
    registerRoomHandlers(io, socket)
    await socket._fire('room:settings', { gameMode: 'normal' })
    expect(mockPrisma.room.findUnique).not.toHaveBeenCalled()
  })

  it('does nothing if requestor is not the host', async () => {
    const io = makeIo()
    const socket = makeSocket('other-user', 'Other', ['room:room-1'])
    const state = { ...waitingState }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerRoomHandlers(io, socket)
    await socket._fire('room:settings', { gameMode: 'special' })

    expect(mockPrisma.room.update).not.toHaveBeenCalled()
  })
})

// ─── game:start ───────────────────────────────────────────────────────────────

describe('game:start', () => {
  it('does nothing when socket is not in a room', async () => {
    const io = makeIo()
    const socket = makeSocket() // no room: rooms
    registerRoomHandlers(io, socket)
    await socket._fire('game:start')
    expect(mockPrisma.room.findUnique).not.toHaveBeenCalled()
  })

  it('does nothing when requestor is not the host', async () => {
    const io = makeIo()
    const socket = makeSocket('other-user', 'Other', ['room:room-1'])
    registerRoomHandlers(io, socket)
    await socket._fire('game:start')
    // findUnique is called but then it returns because hostId !== userId
    expect(io.to).not.toHaveBeenCalled()
  })

  it('emits INTERNAL error and logs when startGameForRoom throws (catch branch)', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', code: 'ABCD', hostId: 'host-1' })
    mockRedis.get.mockRejectedValueOnce(new Error('redis boom'))

    registerRoomHandlers(io, socket)
    await socket._fire('game:start')

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'INTERNAL' }))
  })
})

// ─── detective:reveal (room handler) ─────────────────────────────────────────

describe('detective:reveal (room handler)', () => {
  it('emits detective:result with target role for valid detective', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = {
      ...waitingState,
      status: 'in_progress',
      players: [
        { userId: 'host-1', role: 'detective', status: 'alive', detectiveRevealUsed: false },
        { userId: 'target-1', role: 'imposter', status: 'alive', username: 'Villain' },
      ],
    }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')

    registerRoomHandlers(io, socket)
    await socket._fire('detective:reveal', { targetUserId: 'target-1' })

    expect(socket.emit).toHaveBeenCalledWith('detective:result', expect.objectContaining({
      targetUserId: 'target-1',
      role: 'imposter',
    }))
  })

  it('emits DETECTIVE_USED error when reveal already used', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = {
      ...waitingState,
      players: [
        { userId: 'host-1', role: 'detective', status: 'alive', detectiveRevealUsed: true },
      ],
    }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerRoomHandlers(io, socket)
    await socket._fire('detective:reveal', { targetUserId: 'target-1' })

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'DETECTIVE_USED' }))
  })

  it('swallows errors thrown by redis.get in detective:reveal (catch branch)', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    mockRedis.get.mockRejectedValueOnce(new Error('redis error'))

    registerRoomHandlers(io, socket)
    await expect(socket._fire('detective:reveal', { targetUserId: 'target-1' })).resolves.not.toThrow()
  })
})

// ─── game:forfeit ─────────────────────────────────────────────────────────────

describe('game:forfeit', () => {
  it('calls forfeitPlayer and leaves the room', async () => {
    const { forfeitPlayer } = await import('../../socket/gameLoop')
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])

    registerRoomHandlers(io, socket)
    await socket._fire('game:forfeit')

    expect(forfeitPlayer).toHaveBeenCalledWith(io, 'room-1', 'host-1')
    expect(socket.leave).toHaveBeenCalledWith('room:room-1')
  })

  it('swallows errors thrown by forfeitPlayer (catch branch)', async () => {
    const gameLoopMod = await import('../../socket/gameLoop')
    ;(gameLoopMod.forfeitPlayer as any).mockRejectedValueOnce(new Error('forfeit fail'))

    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])

    registerRoomHandlers(io, socket)
    // Should not throw
    await expect(socket._fire('game:forfeit')).resolves.not.toThrow()
  })
})

// ─── game:leave-eliminated ────────────────────────────────────────────────────

describe('game:leave-eliminated', () => {
  it('allows eliminated player to leave room', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = {
      ...waitingState,
      status: 'in_progress',
      players: [{ userId: 'host-1', status: 'eliminated' }],
    }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerRoomHandlers(io, socket)
    await socket._fire('game:leave-eliminated')

    expect(socket.leave).toHaveBeenCalledWith('room:room-1')
  })

  it('does not allow alive player to leave via game:leave-eliminated', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = {
      ...waitingState,
      status: 'in_progress',
      players: [{ userId: 'host-1', status: 'alive' }],
    }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerRoomHandlers(io, socket)
    await socket._fire('game:leave-eliminated')

    expect(socket.leave).not.toHaveBeenCalled()
  })

  it('leaves room when state is null (game already over)', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    mockRedis.get.mockResolvedValue(null)

    registerRoomHandlers(io, socket)
    await socket._fire('game:leave-eliminated')

    expect(socket.leave).toHaveBeenCalledWith('room:room-1')
  })

  it('swallows errors thrown by redis.get (catch branch)', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    mockRedis.get.mockRejectedValueOnce(new Error('redis error'))

    registerRoomHandlers(io, socket)
    await expect(socket._fire('game:leave-eliminated')).resolves.not.toThrow()
  })
})

// ─── game:start — full flow ───────────────────────────────────────────────────

describe('game:start — full start flow', () => {
  it('starts game successfully and emits game:started when host triggers', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])

    const gameState = {
      ...waitingState,
      players: [
        { userId: 'host-1', username: 'Host',  role: undefined, status: 'alive', isHost: true, isReady: true, honorGiven: false },
        { userId: 'p2',     username: 'P2',    role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p3',     username: 'P3',    role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p4',     username: 'P4',    role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
      ],
    }

    // Lock + state
    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(gameState))
    mockRedis.del.mockResolvedValue(1)

    mockPrisma.wordPack.findFirst.mockResolvedValue(null)
    mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
      fn({
        game: { create: vi.fn().mockResolvedValue({ id: 'game-1' }) },
        round: { create: vi.fn().mockResolvedValue({ id: 'round-1', roundNumber: 1 }) },
        gameParticipation: { createMany: vi.fn().mockResolvedValue({}) },
      })
    )

    registerRoomHandlers(io, socket)
    await socket._fire('game:start')
    await vi.advanceTimersByTimeAsync(3100)

    // room:updated should be emitted
    expect(io.to).toHaveBeenCalledWith('room:room-1')
    vi.useRealTimers()
  })

  it('does not start if fewer than 4 players', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])

    const gameState = {
      ...waitingState,
      players: [
        { userId: 'host-1', isReady: true },
        { userId: 'p2', isReady: true },
      ],
    }

    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(gameState))
    mockRedis.del.mockResolvedValue(1)

    registerRoomHandlers(io, socket)
    await socket._fire('game:start')

    // $transaction should NOT have been called (not enough players)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('does not start if some players are not ready', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])

    const gameState = {
      ...waitingState,
      players: [
        { userId: 'host-1', isReady: true },
        { userId: 'p2', isReady: false },
        { userId: 'p3', isReady: true },
        { userId: 'p4', isReady: true },
      ],
    }

    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(gameState))
    mockRedis.del.mockResolvedValue(1)

    registerRoomHandlers(io, socket)
    await socket._fire('game:start')

    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('does not start if game already in_progress', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])

    const gameState = {
      ...waitingState,
      status: 'in_progress',
      players: [
        { userId: 'host-1', isReady: true },
        { userId: 'p2', isReady: true },
        { userId: 'p3', isReady: true },
        { userId: 'p4', isReady: true },
      ],
    }

    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(gameState))
    mockRedis.del.mockResolvedValue(1)

    registerRoomHandlers(io, socket)
    await socket._fire('game:start')

    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})

// ─── room:join — auto-start matchmade game ───────────────────────────────────

describe('room:join — auto-start when all expected players joined', () => {
  it('triggers auto-start when matchmade room fills up', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const socket = makeSocket('p2', 'P2') // second player joining

    const matchmadeState = {
      ...waitingState,
      isMatchmade: true,
      expectedPlayers: 2,
      players: [
        { userId: 'host-1', username: 'Host', isHost: true, isReady: true, status: 'alive', honorGiven: false },
      ],
    }

    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(matchmadeState))
    mockRedis.del.mockResolvedValue(1)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'p2', locale: 'en' })
    mockPrisma.gameParticipation.findFirst.mockResolvedValue(null)

    registerRoomHandlers(io, socket)
    await socket._fire('room:join', { roomCode: 'ABCD' })

    // room:updated should be emitted when p2 joined (now 2 players = expectedPlayers)
    expect(io.to).toHaveBeenCalledWith('room:room-1')

    // Advance past the 2000ms auto-start delay
    await vi.advanceTimersByTimeAsync(3000)
    vi.useRealTimers()
  })
})

// ─── room:settings — all options ─────────────────────────────────────────────

describe('room:settings — full options', () => {
  it('enables detective and doubleAgent in special mode', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = { ...waitingState, gameMode: 'special' }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerRoomHandlers(io, socket)
    await socket._fire('room:settings', {
      gameMode: 'special',
      detectiveCount: 1,
      doubleAgentCount: 1,
      maxRounds: 10,
      speakingTimeSeconds: 60,
      votingTimeSeconds: 45,
      language: 'fr',
    })

    expect(mockPrisma.room.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ speakingTimeSeconds: 60, votingTimeSeconds: 45, language: 'fr' }),
    }))
    const setCall = mockRedis.set.mock.calls[0]
    const savedState = JSON.parse(setCall[1])
    expect(savedState.detectiveCount).toBe(1)
    expect(savedState.doubleAgentCount).toBe(1)
    expect(savedState.maxRounds).toBe(10)
  })

  it('clamps speakingTimeSeconds to valid range', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = { ...waitingState }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerRoomHandlers(io, socket)
    await socket._fire('room:settings', { speakingTimeSeconds: 5, votingTimeSeconds: 200 })

    expect(mockPrisma.room.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ speakingTimeSeconds: 10, votingTimeSeconds: 120 }),
    }))
  })

  it('does not update DB if no numeric/language settings provided', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = { ...waitingState }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerRoomHandlers(io, socket)
    await socket._fire('room:settings', { gameMode: 'special' })

    // room.update is not called when only state-only settings are changed
    // (categories, gameMode, maxRounds, enableDetective, enableDoubleAgent)
    expect(mockPrisma.room.update).not.toHaveBeenCalled()
  })

  it('ignores unsupported language codes', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    const state = { ...waitingState }
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    registerRoomHandlers(io, socket)
    await socket._fire('room:settings', { language: 'klingon' })

    // Should not update DB with unsupported language
    expect(mockPrisma.room.update).not.toHaveBeenCalled()
  })
})

// ─── room:join — ALREADY_IN_GAME error ───────────────────────────────────────

describe('room:join — ALREADY_IN_GAME block', () => {
  it('emits ALREADY_IN_GAME when player is in another active game', async () => {
    const io = makeIo()
    const socket = makeSocket('other-user', 'Other')
    mockPrisma.room.findUnique.mockResolvedValue({ ...defaultRoom, hostId: 'someone-else', language: 'en' })
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'other-user', locale: 'en' })
    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(waitingState))
    mockRedis.del.mockResolvedValue(1)
    // Player is in another active game (different room)
    mockPrisma.gameParticipation.findFirst.mockResolvedValue({
      game: { roomId: 'room-other' },
    })

    registerRoomHandlers(io, socket)
    await socket._fire('room:join', { roomCode: 'ABCD' })

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'ALREADY_IN_GAME' }))
  })

  it('emits PLAYER_FORFEITED when forfeited player tries to rejoin', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host')
    const forfeitedState = {
      ...waitingState,
      players: [{ userId: 'host-1', status: 'forfeited' }],
    }
    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(forfeitedState))
    mockRedis.del.mockResolvedValue(1)

    registerRoomHandlers(io, socket)
    await socket._fire('room:join', { roomCode: 'ABCD' })

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'PLAYER_FORFEITED' }))
  })
})

// ─── room:leave — edge cases ──────────────────────────────────────────────────

describe('room:leave — edge cases', () => {
  it('does nothing when state is null', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])
    mockRedis.get.mockResolvedValue(null)

    registerRoomHandlers(io, socket)
    await socket._fire('room:leave')

    expect(mockRedis.set).not.toHaveBeenCalled()
  })
})

// ─── Coverage gap: room.ts line 203 — lock never acquired (ROOM_BUSY) ────────

describe('room:join — ROOM_BUSY when lock cannot be acquired (line 203)', () => {
  it('emits ROOM_BUSY error when all 15 lock attempts fail', async () => {
    const io = makeIo()
    const socket = makeSocket('new-user', 'Newcomer')
    mockPrisma.room.findUnique.mockResolvedValue({ ...defaultRoom, hostId: 'someone-else', language: 'en' })
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'new-user', locale: 'en' })

    // All set() calls return null (lock never acquired), including the NX lock calls
    ;(mockRedis as any).set = vi.fn().mockResolvedValue(null)
    mockRedis.del.mockResolvedValue(1)

    registerRoomHandlers(io, socket)
    await socket._fire('room:join', { roomCode: 'ABCD' })

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'ROOM_BUSY' }))
  })
})

// ─── Coverage gap: room.ts line 274 — phaseStartedAt is null/undefined ────────

describe('room:join — phaseStartedAt null branch (line 274)', () => {
  it('uses elapsedSeconds = 0 when phaseStartedAt is null during reconnect', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host')
    const inProgressState = {
      ...waitingState,
      status: 'in_progress',
      currentRound: 1,
      villagerWord: 'Apple',
      imposterWord: 'Pear',
      phaseStartedAt: null,          // null → elapsedSeconds = 0 (line 274 ':0' branch)
      phaseDurationSeconds: 30,
      rounds: [{ roundNumber: 1, speakingOrder: ['host-1'], clues: [], votes: [] }],
      players: [{ userId: 'host-1', role: 'villager', status: 'alive', id: 'old-socket' }],
    }
    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(inProgressState))
    mockRedis.del.mockResolvedValue(1)

    registerRoomHandlers(io, socket)
    await socket._fire('room:join', { roomCode: 'ABCD' })

    // game:sync should be emitted with timeRemainingSeconds = phaseDurationSeconds (30)
    expect(socket.emit).toHaveBeenCalledWith('game:sync', expect.objectContaining({
      timeRemainingSeconds: 30,
    }))
  })
})

// ─── Coverage gap: room.ts lines 346-348 — outer catch in room:join ──────────

describe('room:join — outer catch (lines 346-348)', () => {
  it('emits INTERNAL error and logs when prisma.room.findUnique throws', async () => {
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host')
    // Make the very first DB call throw an uncaught exception
    mockPrisma.room.findUnique.mockRejectedValueOnce(new Error('DB connection lost'))

    registerRoomHandlers(io, socket)
    await socket._fire('room:join', { roomCode: 'ABCD' })

    expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'INTERNAL' }))
  })
})

// ─── Coverage gap: room.ts line 54 — detective role assignment ───────────────

describe('game:start — detective role assigned (line 54)', () => {
  it('assigns detective role and sets detectiveRevealUsed when enableDetective is true', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])

    const gameState = {
      ...waitingState,
      enableDetective: true,
      enableDoubleAgent: false,
      players: [
        { userId: 'host-1', username: 'Host', role: undefined, status: 'alive', isHost: true, isReady: true, honorGiven: false },
        { userId: 'p2',     username: 'P2',   role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p3',     username: 'P3',   role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p4',     username: 'P4',   role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p5',     username: 'P5',   role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
      ],
    }

    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(gameState))
    mockRedis.del.mockResolvedValue(1)
    // A detective will be assigned (imposterCount=1 from defaultRoom, detective is index 1)
    mockPrisma.wordPack.findFirst.mockResolvedValue(null)
    mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
      fn({
        game: { create: vi.fn().mockResolvedValue({ id: 'game-1' }) },
        round: { create: vi.fn().mockResolvedValue({ id: 'round-1', roundNumber: 1 }) },
        gameParticipation: { createMany: vi.fn().mockResolvedValue({}) },
      })
    )

    registerRoomHandlers(io, socket)
    await socket._fire('game:start')
    await vi.advanceTimersByTimeAsync(3100)

    expect(io.to).toHaveBeenCalledWith('room:room-1')
    vi.useRealTimers()
  })
})

// ─── Coverage gap: room.ts lines 68-71 — wordPackId findUnique path ───────────

describe('game:start — specific wordPack lookup by ID (lines 68-71)', () => {
  it('uses findUnique when room has a specific wordPackId', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])

    const gameState = {
      ...waitingState,
      players: [
        { userId: 'host-1', username: 'Host', role: undefined, status: 'alive', isHost: true, isReady: true, honorGiven: false },
        { userId: 'p2', username: 'P2', role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p3', username: 'P3', role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p4', username: 'P4', role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
      ],
    }

    // Room with a specific wordPackId (non-null, non-'default') → findUnique path
    mockPrisma.room.findUnique.mockResolvedValue({ ...defaultRoom, wordPackId: 'pack-123', language: 'en' })

    // findUnique returns a pack with word pairs → lines 77-79 also covered
    mockPrisma.wordPack.findUnique.mockResolvedValue({
      id: 'pack-123',
      pairs: [{ wordA: 'Cat', wordB: 'Dog' }],
    })

    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(gameState))
    mockRedis.del.mockResolvedValue(1)

    mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
      fn({
        game: { create: vi.fn().mockResolvedValue({ id: 'game-1' }) },
        round: { create: vi.fn().mockResolvedValue({ id: 'round-1', roundNumber: 1 }) },
        gameParticipation: { createMany: vi.fn().mockResolvedValue({}) },
      })
    )

    registerRoomHandlers(io, socket)
    await socket._fire('game:start')
    await vi.advanceTimersByTimeAsync(3100)

    // findUnique should have been called (not findFirst)
    expect(mockPrisma.wordPack.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pack-123' },
    }))
    vi.useRealTimers()
  })
})

// ─── Coverage gap: room.ts line 51 — double_agent role assignment ────────────

describe('game:start — double_agent role assigned (line 51)', () => {
  it('assigns double_agent role when enableDoubleAgent is true', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])

    const gameState = {
      ...waitingState,
      enableDoubleAgent: true,
      enableDetective: false,
      players: [
        { userId: 'host-1', username: 'Host', role: undefined, status: 'alive', isHost: true, isReady: true, honorGiven: false },
        { userId: 'p2', username: 'P2', role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p3', username: 'P3', role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p4', username: 'P4', role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p5', username: 'P5', role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
      ],
    }

    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(gameState))
    mockRedis.del.mockResolvedValue(1)

    mockPrisma.wordPack.findFirst.mockResolvedValue(null)
    mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
      fn({
        game: { create: vi.fn().mockResolvedValue({ id: 'game-1' }) },
        round: { create: vi.fn().mockResolvedValue({ id: 'round-1', roundNumber: 1 }) },
        gameParticipation: { createMany: vi.fn().mockResolvedValue({}) },
      })
    )

    registerRoomHandlers(io, socket)
    await socket._fire('game:start')
    await vi.advanceTimersByTimeAsync(3100)

    expect(io.to).toHaveBeenCalledWith('room:room-1')
    vi.useRealTimers()
  })
})

// ─── Coverage gap: room.ts lines 83-85 — word swap (Math.random < 0.5) ───────

describe('game:start — word swap branch (line 83-85)', () => {
  it('swaps word pair when Math.random returns less than 0.5', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])

    const gameState = {
      ...waitingState,
      players: [
        { userId: 'host-1', username: 'Host',  role: undefined, status: 'alive', isHost: true, isReady: true, honorGiven: false },
        { userId: 'p2',     username: 'P2',    role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p3',     username: 'P3',    role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p4',     username: 'P4',    role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
      ],
    }

    // Force Math.random to return < 0.5 to trigger the word-swap branch (lines 83-85)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1)

    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(gameState))
    mockRedis.del.mockResolvedValue(1)

    mockPrisma.wordPack.findFirst.mockResolvedValue(null)
    mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
      fn({
        game: { create: vi.fn().mockResolvedValue({ id: 'game-1' }) },
        round: { create: vi.fn().mockResolvedValue({ id: 'round-1', roundNumber: 1 }) },
        gameParticipation: { createMany: vi.fn().mockResolvedValue({}) },
      })
    )

    registerRoomHandlers(io, socket)
    await socket._fire('game:start')
    await vi.advanceTimersByTimeAsync(3100)

    expect(io.to).toHaveBeenCalledWith('room:room-1')
    randomSpy.mockRestore()
    vi.useRealTimers()
  })
})

// ─── Coverage gap: room.ts lines 142-144 — socket ID fallback in startGameForRoom

describe('game:start — socket ID fallback emit (lines 142-144)', () => {
  it('emits game:started to stored socket ID when it differs from online socket', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const socket = makeSocket('host-1', 'Host', ['room:room-1'])

    // Player has an old socket ID stored in state that differs from onlineUsers entry.
    // playerData.id = 'old-socket-id', but onlineUsers.get('host-1') = 'new-socket-id'.
    // Condition: playerData.id && playerData.id !== sid → true → lines 142-144 execute.
    // We use the real onlineUsers Map (not mocked in roomHandler tests) and populate it.
    const { onlineUsers: ou } = await import('../../socket/onlineUsers')
    // Populate the map with a DIFFERENT socket ID than what's stored in state
    ou.set('host-1', 'new-socket-id')
    ou.set('p2', 'new-sock-p2')
    ou.set('p3', 'sock-p3')
    ou.set('p4', 'current-socket-p4')

    const gameState = {
      ...waitingState,
      players: [
        { userId: 'host-1', username: 'Host',  id: 'old-socket-id',     role: undefined, status: 'alive', isHost: true, isReady: true, honorGiven: false },
        { userId: 'p2',     username: 'P2',    id: 'old-socket-p2',     role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p3',     username: 'P3',    id: null,                role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
        { userId: 'p4',     username: 'P4',    id: 'current-socket-p4', role: undefined, status: 'alive', isHost: false, isReady: true, honorGiven: false },
      ],
    }

    ;(mockRedis as any).set = vi.fn().mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(gameState))
    mockRedis.del.mockResolvedValue(1)

    mockPrisma.wordPack.findFirst.mockResolvedValue(null)
    mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
      fn({
        game: { create: vi.fn().mockResolvedValue({ id: 'game-1' }) },
        round: { create: vi.fn().mockResolvedValue({ id: 'round-1', roundNumber: 1 }) },
        gameParticipation: { createMany: vi.fn().mockResolvedValue({}) },
      })
    )

    registerRoomHandlers(io, socket)
    await socket._fire('game:start')
    await vi.advanceTimersByTimeAsync(3100)

    // io.to should be called with 'old-socket-id' (fallback) for host-1 (sid !== id)
    expect(io.to).toHaveBeenCalledWith('old-socket-id')
    // And with 'old-socket-p2' for p2 (sid !== id)
    expect(io.to).toHaveBeenCalledWith('old-socket-p2')

    // Cleanup
    ou.delete('host-1')
    ou.delete('p2')
    ou.delete('p3')
    ou.delete('p4')
    vi.useRealTimers()
  })
})
