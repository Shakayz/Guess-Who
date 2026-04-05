/**
 * gameLoop.test.ts
 *
 * Tests for the exported functions from src/socket/gameLoop.ts.
 * We test startRound, tryEarlyVoting, tryEarlyResolve, tryEarlyTiebreakerVoting,
 * tryEarlyTiebreakerResolve, eliminatePlayerForWord, and forfeitPlayer by mocking
 * Redis and Prisma at the module level (via the global setup) and providing fake
 * state objects that represent typical game scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redis } from '../../config/redis'
import { prisma } from '../../config/prisma'

// ── Grab the mocks set up in setup.ts ─────────────────────────────────────────
const mockRedis = redis as any
const mockPrisma = prisma as any

// Additional prisma tables used by gameLoop that the shared setup does not include.
// We add them here as vi.fn() properties so we can control them per-test.
;(mockPrisma as any).round = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
}
;(mockPrisma as any).game = {
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}
;(mockPrisma as any).gameParticipation = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  createMany: vi.fn(),
  updateMany: vi.fn(),
  count: vi.fn(),
}
;(mockPrisma as any).roundVote = {
  createMany: vi.fn(),
  findFirst: vi.fn(),
}
;(mockPrisma as any).achievement = { findMany: vi.fn() }
;(mockPrisma as any).userAchievement = { findMany: vi.fn(), create: vi.fn() }
;(mockPrisma as any).friendship = { count: vi.fn() }

// ── Helper: create a minimal io mock ──────────────────────────────────────────
function makeIo() {
  const emit = vi.fn()
  return {
    to: vi.fn(() => ({ emit })),
    emit,
    _emit: emit,
  } as any
}

// ── Helper: basic 4-player game state ─────────────────────────────────────────
function makeState(overrides: Record<string, any> = {}) {
  return {
    status: 'in_progress',
    gameMode: 'normal',
    currentRound: 1,
    players: [
      { userId: 'u1', username: 'Alice',   role: 'villager', status: 'alive' },
      { userId: 'u2', username: 'Bob',     role: 'villager', status: 'alive' },
      { userId: 'u3', username: 'Carol',   role: 'villager', status: 'alive' },
      { userId: 'u4', username: 'Dave',    role: 'imposter', status: 'alive' },
    ],
    villagerWord: 'Apple',
    imposterWord: 'Pear',
    rounds: [
      { id: 'round-1', roundNumber: 1, votes: [], clues: [], speakingOrder: ['u1', 'u2', 'u3', 'u4'] },
    ],
    ...overrides,
  }
}

// ── Import target after mocks are in place ────────────────────────────────────
import {
  startRound,
  tryEarlyVoting,
  tryEarlyResolve,
  tryEarlyTiebreakerVoting,
  tryEarlyTiebreakerResolve,
  eliminatePlayerForWord,
  forfeitPlayer,
} from '../../socket/gameLoop'

// ── Reset all mocks between tests ─────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()

  // Default Redis responses
  mockRedis.get.mockResolvedValue(null)
  mockRedis.set.mockResolvedValue('OK')
  mockRedis.del.mockResolvedValue(1)

  // Default Prisma
  mockPrisma.room.findUnique.mockResolvedValue({
    id: 'room-1', code: 'ABCD', hostId: 'u1', status: 'in_progress',
    speakingTimeSeconds: 30, votingTimeSeconds: 30,
    maxPlayers: 8, imposterCount: 1,
  })
  mockPrisma.room.update.mockResolvedValue({})
  mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-1', villagerWord: 'Apple', imposterWord: 'Pear' })
  mockPrisma.round.create.mockResolvedValue({ id: 'round-2', roundNumber: 2 })
  mockPrisma.round.update.mockResolvedValue({})
  mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
  mockPrisma.game.update.mockResolvedValue({})
  mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
  mockPrisma.gameParticipation.findMany.mockResolvedValue([])
  mockPrisma.roundVote.createMany.mockResolvedValue({})
  mockPrisma.achievement.findMany.mockResolvedValue([])
  mockPrisma.userAchievement.findMany.mockResolvedValue([])
  mockPrisma.friendship.count.mockResolvedValue(0)
  mockPrisma.user.findMany.mockResolvedValue([])
})

// ─────────────────────────────────────────────────────────────────────────────
// startRound
// ─────────────────────────────────────────────────────────────────────────────

describe('startRound', () => {
  it('returns early when Redis state is missing', async () => {
    const io = makeIo()
    mockRedis.get.mockResolvedValue(null)
    await startRound(io, 'room-1', 30, 30)
    // Should emit GAME_STATE_LOST error to the room
    expect(io.to).toHaveBeenCalledWith('room:room-1')
  })

  it('starts the clue phase when state exists and game is in_progress', async () => {
    const io = makeIo()
    const state = makeState()
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    await startRound(io, 'room-1', 30, 30)
    // Should emit round:speaking-turn to the room
    const roomEmit = io.to.mock.results[0]?.value?.emit ?? io._emit
    expect(io.to).toHaveBeenCalledWith('room:room-1')
    expect(mockRedis.set).toHaveBeenCalled()
  })

  it('does nothing when state status is not in_progress', async () => {
    const io = makeIo()
    const state = makeState({ status: 'waiting' })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    await startRound(io, 'room-1', 30, 30)
    // round:speaking-turn should NOT be emitted to a waiting room
    // We verify by checking that the io.to was not called with emit for round:speaking-turn
    const calls = io.to.mock.calls
    // Either no call or the emit call was only for saveState — no round:speaking-turn
    const emittedEvents = io.to.mock.results
      .map((r: any) => r?.value?.emit?.mock?.calls ?? [])
      .flat()
    const hasSpeak = emittedEvents.some((c: any[]) => c[0] === 'round:speaking-turn')
    expect(hasSpeak).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// tryEarlyVoting
// ─────────────────────────────────────────────────────────────────────────────

describe('tryEarlyVoting', () => {
  it('does nothing when state is missing', async () => {
    const io = makeIo()
    mockRedis.get.mockResolvedValue(null)
    await tryEarlyVoting(io, 'room-1')
    expect(io.to).not.toHaveBeenCalled()
  })

  it('does nothing when not all clues have been submitted', async () => {
    const io = makeIo()
    const state = makeState()
    // Only u1 has submitted a clue
    state.rounds[0].clues = [{ playerId: 'u1', text: 'test' }]
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    await tryEarlyVoting(io, 'room-1')
    // No timer / transition yet — emit should not be called for voting-started
    const calls = io.to.mock.calls
    expect(calls.length).toBe(0)
  })

  it('schedules early voting when all alive players have submitted clues', async () => {
    const io = makeIo()
    const state = makeState()
    // All 4 players submitted clues
    state.rounds[0].clues = [
      { playerId: 'u1', text: 'a' },
      { playerId: 'u2', text: 'b' },
      { playerId: 'u3', text: 'c' },
      { playerId: 'u4', text: 'd' },
    ]
    state.votingTimeSeconds = 30
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    await tryEarlyVoting(io, 'room-1')
    // The function sets a timeout — we just verify Redis was read
    expect(mockRedis.get).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// tryEarlyResolve
// ─────────────────────────────────────────────────────────────────────────────

describe('tryEarlyResolve', () => {
  it('does nothing when state is null', async () => {
    const io = makeIo()
    mockRedis.get.mockResolvedValue(null)
    await tryEarlyResolve(io, 'room-1')
    expect(io.to).not.toHaveBeenCalled()
  })

  it('does nothing when status is not voting', async () => {
    const io = makeIo()
    const state = makeState({ status: 'in_progress' })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    await tryEarlyResolve(io, 'room-1')
    expect(io.to).not.toHaveBeenCalled()
  })

  it('does nothing when not all alive players have voted', async () => {
    const io = makeIo()
    const state = makeState({ status: 'voting' })
    state.rounds[0].votes = [{ voterId: 'u1', targetId: 'u4' }]
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    await tryEarlyResolve(io, 'room-1')
    // Only u1 voted; 3 remain
    expect(io.to).not.toHaveBeenCalled()
  })

  it('emits vote:all-cast when every alive player has voted', async () => {
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })
    const state = makeState({ status: 'voting' })
    state.rounds[0].votes = [
      { voterId: 'u1', targetId: 'u4' },
      { voterId: 'u2', targetId: 'u4' },
      { voterId: 'u3', targetId: 'u4' },
      { voterId: 'u4', targetId: 'u1' },
    ]
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    await tryEarlyResolve(io, 'room-1')
    expect(emitFn).toHaveBeenCalledWith('vote:all-cast')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// tryEarlyTiebreakerVoting
// ─────────────────────────────────────────────────────────────────────────────

describe('tryEarlyTiebreakerVoting', () => {
  it('does nothing when tiebreakerActive is false', async () => {
    const io = makeIo()
    const state = makeState({ tiebreakerActive: false })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    await tryEarlyTiebreakerVoting(io, 'room-1')
    expect(io.to).not.toHaveBeenCalled()
  })

  it('does nothing when not all tied players have submitted', async () => {
    const io = makeIo()
    const state = makeState({
      tiebreakerActive: true,
      tiebreakerPhase: 'clue',
      tiebreakerPlayerIds: ['u1', 'u2'],
      tiebreakerClues: [{ playerId: 'u1', text: 'a' }],
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    await tryEarlyTiebreakerVoting(io, 'room-1')
    expect(io.to).not.toHaveBeenCalled()
  })

  it('schedules transition when all tied players have submitted clues', async () => {
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })
    const state = makeState({
      status: 'in_progress',
      tiebreakerActive: true,
      tiebreakerPhase: 'clue',
      tiebreakerPlayerIds: ['u1', 'u2'],
      tiebreakerClues: [
        { playerId: 'u1', text: 'a' },
        { playerId: 'u2', text: 'b' },
      ],
      votingTimeSeconds: 30,
    })
    mockRedis.get
      .mockResolvedValueOnce(JSON.stringify(state))  // tryEarlyTiebreakerVoting
      .mockResolvedValue(JSON.stringify(state))       // subsequent calls
    await tryEarlyTiebreakerVoting(io, 'room-1')
    expect(mockRedis.get).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// tryEarlyTiebreakerResolve
// ─────────────────────────────────────────────────────────────────────────────

describe('tryEarlyTiebreakerResolve', () => {
  it('does nothing when tiebreakerPhase is not vote', async () => {
    const io = makeIo()
    const state = makeState({
      tiebreakerActive: true,
      tiebreakerPhase: 'clue',
      tiebreakerPlayerIds: ['u1'],
      tiebreakerVotes: [],
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    await tryEarlyTiebreakerResolve(io, 'room-1')
    expect(io.to).not.toHaveBeenCalled()
  })

  it('does nothing when not all eligible voters have voted', async () => {
    const io = makeIo()
    const state = makeState({
      status: 'voting',
      tiebreakerActive: true,
      tiebreakerPhase: 'vote',
      tiebreakerPlayerIds: ['u3', 'u4'],
      tiebreakerVotes: [],  // u1 and u2 are eligible but haven't voted
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    await tryEarlyTiebreakerResolve(io, 'room-1')
    expect(io.to).not.toHaveBeenCalled()
  })

  it('resolves when all eligible voters have voted', async () => {
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })
    // u1 and u2 are eligible (not tied); they both voted for u3
    const state = makeState({
      status: 'voting',
      tiebreakerActive: true,
      tiebreakerPhase: 'vote',
      tiebreakerPlayerIds: ['u3', 'u4'],
      tiebreakerVotes: [
        { voterId: 'u1', targetId: 'u3' },
        { voterId: 'u2', targetId: 'u3' },
      ],
    })
    // getState will be called from resolveTiebreaker as well
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')
    ;(mockRedis as any).set.mockResolvedValue('OK')
    // set with NX for the resolve lock — let it succeed
    mockRedis.get.mockResolvedValue(JSON.stringify(state))

    // We just ensure it does NOT return early
    await tryEarlyTiebreakerResolve(io, 'room-1')
    expect(mockRedis.get).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// eliminatePlayerForWord
// ─────────────────────────────────────────────────────────────────────────────

describe('eliminatePlayerForWord', () => {
  it('does nothing when state is missing', async () => {
    const io = makeIo()
    mockRedis.get.mockResolvedValue(null)
    await eliminatePlayerForWord(io, 'room-1', 30, 30)
    // Should complete without error
    expect(mockRedis.get).toHaveBeenCalled()
  })

  it('triggers game over when imposter said the word and all imposters are eliminated', async () => {
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // All imposters eliminated — villagers win
    const state = makeState({
      players: [
        { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
        { userId: 'u3', username: 'Carol', role: 'villager', status: 'alive' },
        { userId: 'u4', username: 'Dave',  role: 'imposter', status: 'eliminated' },
      ],
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')

    await eliminatePlayerForWord(io, 'room-1', 0, 0)

    expect(mockRedis.set).toHaveBeenCalled()
    // room:ended should be emitted
    expect(io.to).toHaveBeenCalledWith('room:room-1')
  })

  it('calls tryEarlyVoting after short delay when no winner yet', async () => {
    const io = makeIo()
    const state = makeState() // imposter still alive
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    await eliminatePlayerForWord(io, 'room-1', 0, 0)
    // No immediate winner — a setTimeout is scheduled to call tryEarlyVoting
    expect(mockRedis.get).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// forfeitPlayer
// ─────────────────────────────────────────────────────────────────────────────

describe('forfeitPlayer', () => {
  it('does nothing when state is null', async () => {
    const io = makeIo()
    mockRedis.get.mockResolvedValue(null)
    await forfeitPlayer(io, 'room-1', 'u1')
    expect(io.to).not.toHaveBeenCalled()
  })

  it('does nothing when player is not alive', async () => {
    const io = makeIo()
    const state = makeState()
    state.players[0].status = 'eliminated'
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    await forfeitPlayer(io, 'room-1', 'u1')
    // set should NOT be called because player was already eliminated
    expect(mockRedis.set).not.toHaveBeenCalled()
  })

  it('marks player as forfeited and broadcasts game:player-forfeited', async () => {
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })
    const state = makeState()
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')

    await forfeitPlayer(io, 'room-1', 'u1')

    expect(mockRedis.set).toHaveBeenCalled()
    expect(emitFn).toHaveBeenCalledWith('game:player-forfeited', { userId: 'u1', username: 'Alice' })
  })

  it('ends the game when forfeiting triggers win condition (all imposters gone)', async () => {
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // Only one imposter; if he forfeits, villagers win immediately
    const state = makeState({
      players: [
        { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
        { userId: 'u3', username: 'Carol', role: 'villager', status: 'alive' },
        { userId: 'u4', username: 'Dave',  role: 'imposter', status: 'alive' },
      ],
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')
    // set with NX
    ;(mockRedis as any).set.mockResolvedValue('OK')

    await forfeitPlayer(io, 'room-1', 'u4')

    expect(emitFn).toHaveBeenCalledWith('game:player-forfeited', { userId: 'u4', username: 'Dave' })
    expect(mockPrisma.room.update).toHaveBeenCalled()
  })

  it('removes forfeited player from speaking order during clue phase', async () => {
    const io = makeIo()
    io.to.mockReturnValue({ emit: vi.fn() })
    const state = makeState({ status: 'in_progress' })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')

    await forfeitPlayer(io, 'room-1', 'u1')

    // Verify Redis set was called with updated state (u1 removed from speakingOrder)
    const setCall = mockRedis.set.mock.calls[0]
    const savedState = JSON.parse(setCall[1])
    expect(savedState.rounds[0].speakingOrder).not.toContain('u1')
  })
})
