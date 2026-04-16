/**
 * gameHandler.test.ts
 *
 * Tests for src/socket/handlers/game.ts — vote:cast (normal + tiebreaker),
 * clue:submit (normal, tiebreaker, word-detection), and forfeit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redis } from '../../config/redis'
import { prisma } from '../../config/prisma'

const mockRedis = redis as any
const mockPrisma = prisma as any

// Mock gameLoop functions to avoid timer side-effects
vi.mock('../../socket/gameLoop', () => ({
  tryEarlyResolve: vi.fn().mockResolvedValue(undefined),
  tryEarlyVoting: vi.fn().mockResolvedValue(undefined),
  tryEarlyTiebreakerVoting: vi.fn().mockResolvedValue(undefined),
  tryEarlyTiebreakerResolve: vi.fn().mockResolvedValue(undefined),
  eliminatePlayerForWord: vi.fn().mockResolvedValue(undefined),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeIo() {
  const emitFn = vi.fn()
  return {
    to: vi.fn(() => ({ emit: emitFn })),
    _emit: emitFn,
  } as any
}

function makeSocket(userId = 'u1', extraRooms: string[] = []) {
  const listeners: Record<string, Function> = {}
  const rooms = new Set<string>(['socket-id', ...extraRooms])
  return {
    id: 'socket-id',
    data: { userId },
    rooms,
    emit: vi.fn(),
    on: vi.fn((event: string, cb: Function) => { listeners[event] = cb }),
    _fire: (event: string, ...args: any[]) => listeners[event]?.(...args),
    userId,
  } as any
}

function makeGameState(overrides: Record<string, any> = {}) {
  return {
    status: 'voting',
    currentRound: 1,
    villagerWord: 'Apple',
    redHandedWord: 'Pear',
    players: [
      { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
      { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
      { userId: 'u3', username: 'Carol', role: 'villager', status: 'alive' },
      { userId: 'u4', username: 'Dave',  role: 'red_handed', status: 'alive' },
    ],
    rounds: [
      { id: 'round-1', roundNumber: 1, votes: [], clues: [], speakingOrder: ['u1', 'u2', 'u3', 'u4'] },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRedis.get.mockResolvedValue(null)
  mockRedis.set.mockResolvedValue('OK')
  mockRedis.del.mockResolvedValue(1)
  mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', status: 'in_progress' })
})

import { registerGameHandlers } from '../../socket/handlers/game'

// ─── vote:cast — normal path ──────────────────────────────────────────────────

describe('vote:cast — normal vote', () => {
  it('does nothing when socket is not in a room', async () => {
    const io = makeIo()
    const socket = makeSocket('u1') // no room: room
    registerGameHandlers(io, socket)
    await socket._fire('vote:cast', 'u4')
    expect(mockRedis.get).not.toHaveBeenCalled()
  })

  it('does nothing when state is missing', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1'])
    mockRedis.get.mockResolvedValue(null)
    registerGameHandlers(io, socket)
    await socket._fire('vote:cast', 'u4')
    expect(io.to).not.toHaveBeenCalled()
  })

  it('does nothing when status is not voting', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1'])
    const state = makeGameState({ status: 'in_progress' })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('vote:cast', 'u4')
    expect(io.to).not.toHaveBeenCalled()
  })

  it('does nothing when voter is not alive', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1'])
    const state = makeGameState()
    state.players[0].status = 'eliminated' // u1 eliminated
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('vote:cast', 'u4')
    expect(io.to).not.toHaveBeenCalled()
  })

  it('does nothing when voting for self', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1'])
    const state = makeGameState()
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('vote:cast', 'u1')
    expect(io.to).not.toHaveBeenCalled()
  })

  it('records vote and emits round:vote-cast', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1'])
    const state = makeGameState()
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('vote:cast', 'u4')
    expect(mockRedis.set).toHaveBeenCalled()
    expect(io.to).toHaveBeenCalledWith('room:room-1')
    expect(io._emit).toHaveBeenCalledWith('round:vote-cast', { voterId: 'u1', hasVoted: true })
  })

  it('ignores duplicate vote from same voter', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1'])
    const state = makeGameState()
    state.rounds[0].votes = [{ voterId: 'u1', targetId: 'u4' }]
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('vote:cast', 'u4')
    // set should not be called since vote already exists
    expect(mockRedis.set).not.toHaveBeenCalled()
  })
})

// ─── vote:cast — tiebreaker path ─────────────────────────────────────────────

describe('vote:cast — tiebreaker vote', () => {
  const tiebreakerState = () => makeGameState({
    status: 'voting',
    tiebreakerActive: true,
    tiebreakerPhase: 'vote',
    tiebreakerPlayerIds: ['u3', 'u4'],
    tiebreakerVotes: [],
  })

  it('records tiebreaker vote from eligible voter', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1']) // u1 not tied — eligible
    const state = tiebreakerState()
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('vote:cast', 'u3')
    expect(mockRedis.set).toHaveBeenCalled()
    expect(io._emit).toHaveBeenCalledWith('round:vote-cast', { voterId: 'u1', hasVoted: true })
  })

  it('rejects vote from tied player', async () => {
    const io = makeIo()
    const socket = makeSocket('u3', ['room:room-1']) // u3 is tied
    const state = tiebreakerState()
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('vote:cast', 'u4')
    expect(mockRedis.set).not.toHaveBeenCalled()
  })

  it('rejects vote targeting a non-tied player', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1'])
    const state = tiebreakerState()
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('vote:cast', 'u2') // u2 not in tiebreaker
    expect(mockRedis.set).not.toHaveBeenCalled()
  })
})

// ─── clue:submit — normal path ────────────────────────────────────────────────

describe('clue:submit — normal', () => {
  const clueState = () => makeGameState({ status: 'in_progress' })

  it('does nothing when socket is not in a room', async () => {
    const io = makeIo()
    const socket = makeSocket('u1')
    registerGameHandlers(io, socket)
    await socket._fire('clue:submit', 'My clue')
    expect(mockRedis.get).not.toHaveBeenCalled()
  })

  it('does nothing for non-string text', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1'])
    const state = clueState()
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('clue:submit', 12345)
    expect(mockRedis.set).not.toHaveBeenCalled()
  })

  it('does nothing for empty/whitespace text', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1'])
    const state = clueState()
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('clue:submit', '   ')
    expect(mockRedis.set).not.toHaveBeenCalled()
  })

  it('records clue and emits round:clue-submitted', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1'])
    const state = clueState()
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('clue:submit', 'Something fruity')
    expect(mockRedis.set).toHaveBeenCalled()
    expect(io._emit).toHaveBeenCalledWith('round:clue-submitted', expect.objectContaining({
      playerId: 'u1',
      text: 'Something fruity',
    }))
  })

  it('ignores duplicate clue submission from same player', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1'])
    const state = clueState()
    state.rounds[0].clues = [{ playerId: 'u1', text: 'already submitted' }]
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('clue:submit', 'second attempt')
    expect(mockRedis.set).not.toHaveBeenCalled()
  })

  it('strips HTML tags from clue text', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1'])
    const state = clueState()
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('clue:submit', '<b>Bold</b> clue')
    const setCall = mockRedis.set.mock.calls[0]
    const savedState = JSON.parse(setCall[1])
    const clue = savedState.rounds[0].clues[0]
    expect(clue.text).not.toContain('<b>')
    expect(clue.text).toContain('Bold')
  })
})

// ─── clue:submit — word detection ─────────────────────────────────────────────

describe('clue:submit — word detection', () => {
  it('flags clue and eliminates villager who says the villager word', async () => {
    const { eliminatePlayerForWord } = await import('../../socket/gameLoop')
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1']) // u1 is villager
    const state = makeGameState({ status: 'in_progress' })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    // u1 is villager; villagerWord = 'Apple'
    await socket._fire('clue:submit', 'Apple is the answer')
    expect(eliminatePlayerForWord).toHaveBeenCalledWith(io, 'room-1', 0, 0)
    const setCall = mockRedis.set.mock.calls[0]
    const savedState = JSON.parse(setCall[1])
    const clue = savedState.rounds[0].clues[0]
    expect(clue.flaggedForWord).toBe(true)
  })

  it('flags clue and eliminates redHanded who says the redHanded word', async () => {
    const { eliminatePlayerForWord } = await import('../../socket/gameLoop')
    const io = makeIo()
    const socket = makeSocket('u4', ['room:room-1']) // u4 is redHanded
    const state = makeGameState({ status: 'in_progress' })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    // u4 is redHanded; redHandedWord = 'Pear'
    await socket._fire('clue:submit', 'Pear is delicious')
    expect(eliminatePlayerForWord).toHaveBeenCalled()
  })

  it('does not flag clue when word is not present', async () => {
    const { eliminatePlayerForWord } = await import('../../socket/gameLoop')
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1'])
    const state = makeGameState({ status: 'in_progress' })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('clue:submit', 'It is round and red')
    expect(eliminatePlayerForWord).not.toHaveBeenCalled()
    const setCall = mockRedis.set.mock.calls[0]
    const savedState = JSON.parse(setCall[1])
    expect(savedState.rounds[0].clues[0].flaggedForWord).toBe(false)
  })
})

// ─── clue:submit — tiebreaker path ────────────────────────────────────────────

describe('clue:submit — tiebreaker', () => {
  it('records tiebreaker clue from tied player', async () => {
    const { tryEarlyTiebreakerVoting } = await import('../../socket/gameLoop')
    const io = makeIo()
    const socket = makeSocket('u3', ['room:room-1']) // u3 is tied
    const state = makeGameState({
      status: 'in_progress',
      tiebreakerActive: true,
      tiebreakerPhase: 'clue',
      tiebreakerPlayerIds: ['u3', 'u4'],
      tiebreakerClues: [],
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('clue:submit', 'tiebreaker clue')
    expect(mockRedis.set).toHaveBeenCalled()
    expect(io._emit).toHaveBeenCalledWith('round:clue-submitted', expect.objectContaining({ playerId: 'u3' }))
    expect(tryEarlyTiebreakerVoting).toHaveBeenCalledWith(io, 'room-1')
  })

  it('rejects tiebreaker clue from non-tied player', async () => {
    const io = makeIo()
    const socket = makeSocket('u1', ['room:room-1']) // u1 not tied
    const state = makeGameState({
      status: 'in_progress',
      tiebreakerActive: true,
      tiebreakerPhase: 'clue',
      tiebreakerPlayerIds: ['u3', 'u4'],
      tiebreakerClues: [],
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    registerGameHandlers(io, socket)
    await socket._fire('clue:submit', 'sneaky clue')
    expect(mockRedis.set).not.toHaveBeenCalled()
  })
})
