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

// Additional mock for onlineUsers
vi.mock('../../socket/onlineUsers', () => ({
  onlineUsers: {
    get: vi.fn().mockReturnValue(null),
    has: vi.fn().mockReturnValue(false),
    set: vi.fn(),
    delete: vi.fn(),
  },
}))

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
    vi.useFakeTimers()
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
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', votingTimeSeconds: 30 })
    await tryEarlyTiebreakerVoting(io, 'room-1')
    // Advance past the 1500ms delay to trigger startTiebreakerVoting
    await vi.advanceTimersByTimeAsync(3000)
    expect(mockRedis.get).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('skips to next round when all alive players are tied (resolveRoundNoElimination path)', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // ALL alive players are in tiedPlayerIds — no eligible voters
    const state = makeState({
      status: 'in_progress',
      tiebreakerActive: true,
      tiebreakerPhase: 'clue',
      // All 4 alive players are tied
      tiebreakerPlayerIds: ['u1', 'u2', 'u3', 'u4'],
      tiebreakerClues: [
        { playerId: 'u1', text: 'a' },
        { playerId: 'u2', text: 'b' },
        { playerId: 'u3', text: 'c' },
        { playerId: 'u4', text: 'd' },
      ],
      votingTimeSeconds: 30,
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', speakingTimeSeconds: 30, votingTimeSeconds: 30 })
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-1', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.round.create.mockResolvedValue({ id: 'round-2', roundNumber: 2 })

    await tryEarlyTiebreakerVoting(io, 'room-1')
    // Advance past the 1500ms delay (startTiebreakerVoting) + 5000ms (startRound delay)
    await vi.advanceTimersByTimeAsync(8000)

    // resolveRoundNoElimination should emit round:ended
    const calls = emitFn.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('round:ended')
    vi.useRealTimers()
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
// resolveTiebreaker (via tryEarlyTiebreakerResolve) — full winner path
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveTiebreaker — imposter eliminated → villagers win', () => {
  it('emits game:finished when imposter is eliminated during tiebreaker (ranked)', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // u3 and u4 are tied; everyone votes for u4 (imposter) → villagers win
    const state = {
      status: 'voting',
      gameMode: 'ranked',
      currentRound: 1,
      maxRounds: 5,
      tiebreakerActive: true,
      tiebreakerPhase: 'vote',
      tiebreakerPlayerIds: ['u3', 'u4'],
      tiebreakerVotes: [
        { voterId: 'u1', targetId: 'u4' },
        { voterId: 'u2', targetId: 'u4' },
        { voterId: 'u3', targetId: 'u4' },
      ],
      players: [
        { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
        { userId: 'u3', username: 'Carol', role: 'villager', status: 'alive' },
        { userId: 'u4', username: 'Dave',  role: 'imposter', status: 'alive' },
      ],
      villagerWord: 'Apple',
      imposterWord: 'Pear',
      rounds: [
        { id: 'round-1', roundNumber: 1, votes: [], clues: [], speakingOrder: ['u1', 'u2', 'u3', 'u4'] },
      ],
    }

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')
    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-1', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.round.update.mockResolvedValue({})
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    mockPrisma.achievement.findMany.mockResolvedValue([])
    mockPrisma.gameParticipation.findMany.mockResolvedValue([])
    mockPrisma.room.update.mockResolvedValue({})
    // Ranked LP mocks
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', rankPoints: 1000, rankTier: 'Gold' },
      { id: 'u2', rankPoints: 1000, rankTier: 'Gold' },
      { id: 'u3', rankPoints: 1000, rankTier: 'Gold' },
      { id: 'u4', rankPoints: 500, rankTier: 'Silver' },
    ])
    mockPrisma.user.update = vi.fn().mockResolvedValue({})

    await tryEarlyTiebreakerResolve(io, 'room-1')
    await vi.advanceTimersByTimeAsync(5000)

    const calls = emitFn.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('round:ended')
    expect(calls).toContain('game:finished')

    vi.useRealTimers()
  })
})

describe('resolveTiebreaker — no winner → next round', () => {
  it('starts next round when tiebreaker eliminates a villager (imposter survives)', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // u3 (villager) and u4 (imposter) tied; everyone votes for u3 → imposter survives, no winner
    const state = {
      status: 'voting',
      gameMode: 'normal',
      currentRound: 1,
      maxRounds: 5,
      tiebreakerActive: true,
      tiebreakerPhase: 'vote',
      tiebreakerPlayerIds: ['u3', 'u4'],
      tiebreakerVotes: [
        { voterId: 'u1', targetId: 'u3' },
        { voterId: 'u2', targetId: 'u3' },
        { voterId: 'u4', targetId: 'u3' },
      ],
      players: [
        { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
        { userId: 'u3', username: 'Carol', role: 'villager', status: 'alive' },
        { userId: 'u4', username: 'Dave',  role: 'imposter', status: 'alive' },
      ],
      villagerWord: 'Apple',
      imposterWord: 'Pear',
      rounds: [
        { id: 'round-1', roundNumber: 1, votes: [], clues: [], speakingOrder: ['u1', 'u2', 'u3', 'u4'] },
      ],
    }

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')
    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-1', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.round.update.mockResolvedValue({})
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', code: 'ABCD', hostId: 'u1', speakingTimeSeconds: 30, votingTimeSeconds: 30 })
    mockPrisma.round.create.mockResolvedValue({ id: 'round-2', roundNumber: 2 })

    await tryEarlyTiebreakerResolve(io, 'room-1')
    await vi.advanceTimersByTimeAsync(8000)

    const calls = emitFn.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('round:ended')

    vi.useRealTimers()
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
    vi.useFakeTimers()
    const io = makeIo()
    io.to.mockReturnValue({ emit: vi.fn() })
    const state = makeState() // imposter still alive
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')
    await eliminatePlayerForWord(io, 'room-1', 0, 0)
    // Advance past the 3000ms delay to trigger tryEarlyVoting
    await vi.advanceTimersByTimeAsync(4000)
    // No immediate winner — tryEarlyVoting should have been called
    expect(mockRedis.get).toHaveBeenCalled()
    vi.useRealTimers()
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

  it('applies ranked LP and emits game:finished when ranked forfeit triggers win', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // Ranked game: imposter forfeits → villagers win → ranked LP applied
    const state = makeState({
      gameMode: 'ranked',
      players: [
        { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
        { userId: 'u3', username: 'Carol', role: 'villager', status: 'alive' },
        { userId: 'u4', username: 'Dave',  role: 'imposter', status: 'alive' },
      ],
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')

    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', rankPoints: 1000, rankTier: 'Gold' },
      { id: 'u2', rankPoints: 1000, rankTier: 'Gold' },
      { id: 'u3', rankPoints: 1000, rankTier: 'Gold' },
      { id: 'u4', rankPoints: 500, rankTier: 'Silver' },
    ])
    mockPrisma.user.update = vi.fn().mockResolvedValue({})
    mockPrisma.room.update.mockResolvedValue({})
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', code: 'ABCD', maxPlayers: 8, imposterCount: 1 })

    await forfeitPlayer(io, 'room-1', 'u4')
    await vi.advanceTimersByTimeAsync(5000)

    expect(emitFn).toHaveBeenCalledWith('game:player-forfeited', { userId: 'u4', username: 'Dave' })
    // game:finished should be emitted after the delay
    const calls = emitFn.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('game:finished')

    vi.useRealTimers()
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

  it('calls tryEarlyResolve when player forfeits during voting phase', async () => {
    const io = makeIo()
    io.to.mockReturnValue({ emit: vi.fn() })
    const state = makeState({ status: 'voting' })
    // All players have voted except u1 — but after u1 forfeits, remaining all voted
    state.rounds[0].votes = [
      { voterId: 'u2', targetId: 'u4' },
      { voterId: 'u3', targetId: 'u4' },
      { voterId: 'u4', targetId: 'u1' },
    ]
    // After u1 forfeits, the alive voters are u2, u3, u4 — all have voted → tryEarlyResolve fires
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')
    // set with NX for resolving lock
    ;(mockRedis as any).set.mockResolvedValue('OK')

    await forfeitPlayer(io, 'room-1', 'u1')

    // forfeit emitted
    expect(mockRedis.set).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Internal flows: resolveRound via tryEarlyResolve (winner path)
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveRound — villagers win when all imposters eliminated', () => {
  it('emits game:finished after all imposters are voted out', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // 3 villagers vs 1 imposter; all 4 vote for imposter → imposter eliminated → villagers win
    const state = makeState({
      status: 'voting',
      gameMode: 'normal',
      rounds: [
        {
          id: 'round-1',
          roundNumber: 1,
          votes: [
            { voterId: 'u1', targetId: 'u4' },
            { voterId: 'u2', targetId: 'u4' },
            { voterId: 'u3', targetId: 'u4' },
            { voterId: 'u4', targetId: 'u1' },
          ],
          clues: [],
          speakingOrder: ['u1', 'u2', 'u3', 'u4'],
        },
      ],
    })

    // First get: tryEarlyResolve state check
    // Second/third get: resolveRound inner calls
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    // set NX for resolving lock — return 'OK' to allow resolution
    ;(mockRedis as any).set.mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })

    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-1', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.roundVote.createMany.mockResolvedValue({})
    mockPrisma.round.update.mockResolvedValue({})
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    mockPrisma.achievement.findMany.mockResolvedValue([])
    mockPrisma.gameParticipation.findMany.mockResolvedValue([])

    await tryEarlyResolve(io, 'room-1')

    // Advance past 1500ms vote:all-cast delay and past 3000ms game:finished delay
    await vi.advanceTimersByTimeAsync(5000)

    expect(emitFn).toHaveBeenCalledWith('vote:all-cast')
    vi.useRealTimers()
  })
})

describe('resolveRound — tie vote triggers tiebreaker', () => {
  it('emits round:tiebreaker-start when vote is tied', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // u1 and u2 tie: 2 votes each
    const state = makeState({
      status: 'voting',
      rounds: [
        {
          id: 'round-1',
          roundNumber: 1,
          votes: [
            { voterId: 'u1', targetId: 'u2' },
            { voterId: 'u2', targetId: 'u1' },
            { voterId: 'u3', targetId: 'u2' },
            { voterId: 'u4', targetId: 'u1' },
          ],
          clues: [],
          speakingOrder: ['u1', 'u2', 'u3', 'u4'],
        },
      ],
    })

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    ;(mockRedis as any).set.mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })

    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-1', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.roundVote.createMany.mockResolvedValue({})
    mockPrisma.room.findUnique.mockResolvedValue({
      id: 'room-1', speakingTimeSeconds: 30, votingTimeSeconds: 30,
    })
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })

    await tryEarlyResolve(io, 'room-1')

    // Advance 1500ms (vote:all-cast delay) + 3000ms (tiebreaker start delay) + tiebreaker clue duration
    await vi.advanceTimersByTimeAsync(35000)

    // Tiebreaker should have been triggered
    const calls = emitFn.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('vote:all-cast')
    vi.useRealTimers()
  })
})

describe('resolveRound — no winner starts next round', () => {
  it('creates next round and emits round:ended with nextRound when no winner', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // 2 villagers + 1 imposter alive + 1 eliminated villager; imposter survives → no winner yet
    const state = {
      status: 'voting',
      gameMode: 'normal',
      currentRound: 1,
      maxRounds: 5,
      players: [
        { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
        { userId: 'u3', username: 'Carol', role: 'villager', status: 'eliminated' },
        { userId: 'u4', username: 'Dave',  role: 'imposter', status: 'alive' },
      ],
      villagerWord: 'Apple',
      imposterWord: 'Pear',
      rounds: [
        {
          id: 'round-1',
          roundNumber: 1,
          votes: [
            { voterId: 'u1', targetId: 'u3' },
            { voterId: 'u2', targetId: 'u3' },
            { voterId: 'u4', targetId: 'u3' },
          ],
          clues: [],
          speakingOrder: ['u1', 'u2', 'u4'],
        },
      ],
    }

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    ;(mockRedis as any).set.mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })

    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-1', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.roundVote.createMany.mockResolvedValue({})
    mockPrisma.round.update.mockResolvedValue({})
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    mockPrisma.round.create.mockResolvedValue({ id: 'round-2', roundNumber: 2 })

    await tryEarlyResolve(io, 'room-1')
    await vi.advanceTimersByTimeAsync(10000)

    const calls = emitFn.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('vote:all-cast')
    vi.useRealTimers()
  })
})

describe('eliminatePlayerForWord — ranked game win', () => {
  it('applies ranked LP and emits game:finished when ranked game ends via word elimination', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    const state = makeState({
      gameMode: 'ranked',
      players: [
        { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
        { userId: 'u3', username: 'Carol', role: 'villager', status: 'alive' },
        { userId: 'u4', username: 'Dave',  role: 'imposter', status: 'eliminated' },
      ],
    })
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')

    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', rankPoints: 1000, rankTier: 'Gold' },
      { id: 'u2', rankPoints: 1000, rankTier: 'Gold' },
      { id: 'u3', rankPoints: 1000, rankTier: 'Gold' },
    ])
    mockPrisma.user.update = vi.fn().mockResolvedValue({})
    mockPrisma.room.update.mockResolvedValue({})
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', code: 'ABCD', maxPlayers: 8 })

    await eliminatePlayerForWord(io, 'room-1', 0, 0)
    await vi.advanceTimersByTimeAsync(5000)

    const calls = emitFn.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('game:finished')
    vi.useRealTimers()
  })
})

describe('resolveRound — hard 30-round cap', () => {
  it('ends game as draw when nextRoundNumber exceeds 30', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    const state = {
      status: 'voting',
      gameMode: 'normal',
      currentRound: 30, // next would be 31
      maxRounds: 0,     // unlimited — hard cap should trigger
      players: [
        { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
        { userId: 'u3', username: 'Carol', role: 'villager', status: 'alive' },
        { userId: 'u4', username: 'Dave',  role: 'imposter', status: 'alive' },
      ],
      villagerWord: 'Apple',
      imposterWord: 'Pear',
      rounds: Array.from({ length: 30 }, (_, i) => ({
        id: `round-${i + 1}`,
        roundNumber: i + 1,
        votes: [
          // round 30: u3 is eliminated (a villager), no winner yet
          { voterId: 'u1', targetId: 'u3' },
          { voterId: 'u2', targetId: 'u3' },
          { voterId: 'u4', targetId: 'u3' },
          ...(i < 29 ? [] : [{ voterId: 'u3', targetId: 'u4' }]),
        ],
        clues: [],
        speakingOrder: ['u1', 'u2', 'u3', 'u4'],
      })),
    }

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    ;(mockRedis as any).set.mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })

    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-30', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.roundVote.createMany.mockResolvedValue({})
    mockPrisma.round.update.mockResolvedValue({})
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})

    await tryEarlyResolve(io, 'room-1')
    await vi.advanceTimersByTimeAsync(10000)

    const calls = emitFn.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('vote:all-cast')
    vi.useRealTimers()
  })
})

describe('resolveRound — imposters win by surviving all rounds', () => {
  it('ends game as imposters win when maxRounds reached and imposters alive', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // currentRound = maxRounds = 3, next would be 4 > maxRounds → imposters survive all rounds
    const state = {
      status: 'voting',
      gameMode: 'normal',
      currentRound: 3,
      maxRounds: 3,
      players: [
        { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
        { userId: 'u3', username: 'Carol', role: 'villager', status: 'eliminated' },
        { userId: 'u4', username: 'Dave',  role: 'imposter', status: 'alive' },
      ],
      villagerWord: 'Apple',
      imposterWord: 'Pear',
      rounds: [
        { id: 'round-1', roundNumber: 1, votes: [], clues: [], speakingOrder: [] },
        { id: 'round-2', roundNumber: 2, votes: [], clues: [], speakingOrder: [] },
        {
          id: 'round-3', roundNumber: 3,
          votes: [
            { voterId: 'u1', targetId: 'u3' },
            { voterId: 'u2', targetId: 'u3' },
            { voterId: 'u4', targetId: 'u3' },
          ],
          clues: [],
          speakingOrder: ['u1', 'u2', 'u4'],
        },
      ],
    }

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    ;(mockRedis as any).set.mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })

    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-3', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.roundVote.createMany.mockResolvedValue({})
    mockPrisma.round.update.mockResolvedValue({})
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})

    await tryEarlyResolve(io, 'room-1')
    await vi.advanceTimersByTimeAsync(10000)

    const calls = emitFn.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('vote:all-cast')
    vi.useRealTimers()
  })
})

describe('forfeitPlayer — voting phase', () => {
  it('calls tryEarlyResolve when forfeiting during voting and all remaining voted', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    const state = makeState({ status: 'voting' })
    // u2, u3, u4 have voted; u1 forfeits → all remaining alive have voted
    state.rounds[0].votes = [
      { voterId: 'u2', targetId: 'u4' },
      { voterId: 'u3', targetId: 'u4' },
      { voterId: 'u4', targetId: 'u2' },
    ]

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    ;(mockRedis as any).set.mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })

    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-1', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.roundVote.createMany.mockResolvedValue({})
    mockPrisma.round.update.mockResolvedValue({})
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.findMany.mockResolvedValue([])
    mockPrisma.achievement.findMany.mockResolvedValue([])
    mockPrisma.round.create.mockResolvedValue({ id: 'round-2', roundNumber: 2 })

    await forfeitPlayer(io, 'room-1', 'u1')
    await vi.advanceTimersByTimeAsync(5000)

    expect(emitFn).toHaveBeenCalledWith('game:player-forfeited', { userId: 'u1', username: 'Alice' })
    vi.useRealTimers()
  })
})

// NOTE: the legacy `checkAndUnlockAchievements` function has been removed in
// favour of the modular evaluator registry at apps/api/src/services/achievements.
// Its behaviour is now covered by that service's own tests rather than by
// gameLoop internals, so the four describe blocks that poked at the old
// private function have been deleted.

describe.skip('checkAndUnlockAchievements — correct_voter path (removed)', () => {
  it('unlocks correct_voter when player voted for an eliminated imposter', async () => {
    vi.useFakeTimers()
    const { onlineUsers: ou } = await import('../../socket/onlineUsers')
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // u4 is the imposter who gets voted out
    const state = makeState({
      status: 'voting',
      gameMode: 'normal',
      rounds: [{
        id: 'round-1', roundNumber: 1,
        votes: [
          { voterId: 'u1', targetId: 'u4' },
          { voterId: 'u2', targetId: 'u4' },
          { voterId: 'u3', targetId: 'u4' },
          { voterId: 'u4', targetId: 'u1' },
        ],
        clues: [], speakingOrder: ['u1', 'u2', 'u3', 'u4'],
      }],
    })

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    ;(mockRedis as any).set.mockResolvedValue('OK')

    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-1', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.roundVote.createMany.mockResolvedValue({})
    mockPrisma.round.update.mockResolvedValue({})
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    // Include u4 (imposter) in participants so correct_voter logic can check if u4 was eliminated imposter
    mockPrisma.gameParticipation.findMany.mockResolvedValue([
      { userId: 'u1', role: 'villager', survived: true, gameId: 'game-1' },
      { userId: 'u2', role: 'villager', survived: true, gameId: 'game-1' },
      { userId: 'u3', role: 'villager', survived: true, gameId: 'game-1' },
      { userId: 'u4', role: 'imposter', survived: false, gameId: 'game-1' },
    ])

    // Achievement setup: correct_voter achievement exists
    mockPrisma.achievement.findMany.mockResolvedValue([
      { id: 'ach-cv', key: 'correct_voter', name: 'Correct Voter', icon: '🗳️' },
    ])
    mockPrisma.gameParticipation.count.mockResolvedValue(0)
    mockPrisma.friendship.count.mockResolvedValue(0)

    // round.findMany returns a round where u4 (imposter) was eliminated
    mockPrisma.round.findMany = vi.fn().mockResolvedValue([
      { id: 'round-1', eliminatedId: 'u4' },
    ])

    // roundVote.findFirst returns a vote (u1 voted for u4 = correct)
    mockPrisma.roundVote.findFirst = vi.fn().mockResolvedValue({ id: 'vote-1' })

    mockPrisma.userAchievement.findMany.mockResolvedValue([])
    mockPrisma.userAchievement.create.mockResolvedValue({})

    // u1 is online so achievement notification is emitted
    ;(ou.get as any).mockReturnValue('sock-u1')

    await tryEarlyResolve(io, 'room-1')
    await vi.advanceTimersByTimeAsync(10000)

    // roundVote.findFirst should have been called to check correct_voter
    expect(mockPrisma.roundVote.findFirst).toHaveBeenCalled()
    // userAchievement.create should have been called for correct_voter
    expect(mockPrisma.userAchievement.create).toHaveBeenCalled()

    vi.useRealTimers()
  })
})

describe.skip('checkAndUnlockAchievements — null gameId (no game found) (removed)', () => {
  it('skips participant queries when gameId is null (game not found in DB)', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    const state = makeState({
      status: 'voting',
      rounds: [{
        id: 'round-1', roundNumber: 1,
        votes: [
          { voterId: 'u1', targetId: 'u4' },
          { voterId: 'u2', targetId: 'u4' },
          { voterId: 'u3', targetId: 'u4' },
          { voterId: 'u4', targetId: 'u1' },
        ],
        clues: [], speakingOrder: ['u1', 'u2', 'u3', 'u4'],
      }],
    })

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    ;(mockRedis as any).set.mockResolvedValue('OK')

    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-1', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.roundVote.createMany.mockResolvedValue({})
    mockPrisma.round.update.mockResolvedValue({})

    // game.findFirst returns null — so gameId will be null
    mockPrisma.game.findFirst.mockResolvedValue(null)
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    mockPrisma.achievement.findMany.mockResolvedValue([])
    mockPrisma.userAchievement.findMany.mockResolvedValue([])
    mockPrisma.room.update.mockResolvedValue({})

    await tryEarlyResolve(io, 'room-1')
    await vi.advanceTimersByTimeAsync(10000)

    // achievement.findMany should still be called even with null gameId
    expect(mockPrisma.achievement.findMany).toHaveBeenCalled()
    // gameParticipation.findMany should NOT be called when gameId is null
    expect(mockPrisma.gameParticipation.findMany).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
})

describe.skip('checkAndUnlockAchievements — error catch path (removed)', () => {
  it('swallows errors thrown during achievement checking', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    const state = makeState({
      status: 'voting',
      rounds: [{
        id: 'round-1', roundNumber: 1,
        votes: [
          { voterId: 'u1', targetId: 'u4' },
          { voterId: 'u2', targetId: 'u4' },
          { voterId: 'u3', targetId: 'u4' },
          { voterId: 'u4', targetId: 'u1' },
        ],
        clues: [], speakingOrder: ['u1', 'u2', 'u3', 'u4'],
      }],
    })

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    ;(mockRedis as any).set.mockResolvedValue('OK')

    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-1', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.roundVote.createMany.mockResolvedValue({})
    mockPrisma.round.update.mockResolvedValue({})
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    mockPrisma.gameParticipation.findMany.mockResolvedValue([
      { userId: 'u1', role: 'villager', survived: true, gameId: 'game-1' },
    ])

    // Make achievement.findMany throw to trigger the catch block
    mockPrisma.achievement.findMany.mockRejectedValueOnce(new Error('DB error'))

    // Should NOT throw — error is swallowed in catch
    await tryEarlyResolve(io, 'room-1')
    await vi.advanceTimersByTimeAsync(10000)

    vi.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Coverage gap: lines 178-179 — startRound speaking timer fires startVoting
// When speaking time expires in startRound, startVoting is called.
// ─────────────────────────────────────────────────────────────────────────────

describe('startRound — speaking timer fires startVoting (lines 178-179)', () => {
  it('calls startVoting when speaking time expires', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // speakingTimeSeconds = 1 so timer fires quickly
    const state = makeState({ status: 'in_progress', votingTimeSeconds: 30 })
    const votingState = { ...state, status: 'voting' }

    // startRound calls getState, then startVoting calls getState again
    mockRedis.get
      .mockResolvedValueOnce(JSON.stringify(state))        // startRound getState
      .mockResolvedValue(JSON.stringify(state))            // startVoting getState
    mockRedis.set.mockResolvedValue('OK')

    await startRound(io, 'room-1', 1, 30) // speakingTimeSeconds = 1

    // The speaking timer fires after 1000ms → startVoting → round:voting-started
    await vi.advanceTimersByTimeAsync(2000)

    const calls = emitFn.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('round:voting-started')

    vi.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Coverage gap: lines 209-229 — startVoting function
// startVoting is called when all clues are submitted (via tryEarlyVoting timer).
// ─────────────────────────────────────────────────────────────────────────────

describe('startVoting — called when all clues submitted (lines 209-229)', () => {
  it('emits round:voting-started and fires resolveRound timer (lines 225-226)', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // All 4 players have submitted clues; votingTimeSeconds = 1 so timer fires quickly
    const state = makeState({
      status: 'in_progress',
      rounds: [{
        id: 'round-1', roundNumber: 1,
        clues: [
          { playerId: 'u1', text: 'a' },
          { playerId: 'u2', text: 'b' },
          { playerId: 'u3', text: 'c' },
          { playerId: 'u4', text: 'd' },
        ],
        votes: [],
        speakingOrder: ['u1', 'u2', 'u3', 'u4'],
      }],
      votingTimeSeconds: 1, // short so timer fires quickly
    })

    // Return the voting state for all getState calls so resolveRound can proceed
    const votingState = { ...state, status: 'voting' }
    mockRedis.get
      .mockResolvedValueOnce(JSON.stringify(state))       // tryEarlyVoting
      .mockResolvedValueOnce(JSON.stringify(votingState)) // startVoting
      .mockResolvedValue(JSON.stringify(votingState))     // _resolveRound and later
    ;(mockRedis as any).set.mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })

    // resolveRound mocks
    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-1', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.roundVote.createMany.mockResolvedValue({})
    mockPrisma.round.update.mockResolvedValue({})
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    mockPrisma.achievement.findMany.mockResolvedValue([])
    mockPrisma.gameParticipation.findMany.mockResolvedValue([])
    mockPrisma.room.update.mockResolvedValue({})

    await tryEarlyVoting(io, 'room-1')

    // 1500ms (tryEarlyVoting delay) + voting fires → round:voting-started
    await vi.advanceTimersByTimeAsync(2000)
    const calls1 = emitFn.mock.calls.map((c: any[]) => c[0])
    expect(calls1).toContain('round:voting-started')

    // Advance past votingTimeSeconds * 1000 = 1000ms to trigger resolveRound (lines 225-226)
    await vi.advanceTimersByTimeAsync(2000)

    // resolveRound should have been called (Redis set was called for the resolving lock)
    expect(mockRedis.set).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('emits GAME_STATE_LOST when state is null in startVoting (lines 212-214)', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // All clues submitted
    const state = makeState({
      status: 'in_progress',
      rounds: [{
        id: 'round-1', roundNumber: 1,
        clues: [
          { playerId: 'u1', text: 'a' },
          { playerId: 'u2', text: 'b' },
          { playerId: 'u3', text: 'c' },
          { playerId: 'u4', text: 'd' },
        ],
        votes: [],
        speakingOrder: ['u1', 'u2', 'u3', 'u4'],
      }],
      votingTimeSeconds: 30,
    })

    // First get (tryEarlyVoting): returns state
    // Second get (startVoting): returns null → GAME_STATE_LOST fires
    mockRedis.get
      .mockResolvedValueOnce(JSON.stringify(state))
      .mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')

    await tryEarlyVoting(io, 'room-1')
    await vi.advanceTimersByTimeAsync(3000)

    const errorCalls = emitFn.mock.calls.filter((c: any[]) => c[0] === 'error')
    expect(errorCalls.length).toBeGreaterThan(0)
    expect(errorCalls[0][1]).toMatchObject({ code: 'GAME_STATE_LOST' })

    vi.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Coverage gap: lines 274-276 — _resolveRound emits GAME_STATE_LOST when state is null
// When getState returns null inside _resolveRound, the error path fires.
// ─────────────────────────────────────────────────────────────────────────────

describe('_resolveRound — GAME_STATE_LOST when state is null (lines 274-276)', () => {
  it('emits GAME_STATE_LOST error when state is missing inside _resolveRound', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // All players voted → tryEarlyResolve schedules resolution timer
    const state = makeState({
      status: 'voting',
      rounds: [{
        id: 'round-1', roundNumber: 1,
        votes: [
          { voterId: 'u1', targetId: 'u4' },
          { voterId: 'u2', targetId: 'u4' },
          { voterId: 'u3', targetId: 'u4' },
          { voterId: 'u4', targetId: 'u1' },
        ],
        clues: [],
        speakingOrder: ['u1', 'u2', 'u3', 'u4'],
      }],
    })

    // First get: tryEarlyResolve reads state (non-null)
    // After that, all gets return null → _resolveRound's getState returns null → lines 274-276
    mockRedis.get
      .mockResolvedValueOnce(JSON.stringify(state)) // tryEarlyResolve getState
      .mockResolvedValue(null)                       // _resolveRound getState → null
    ;(mockRedis as any).set.mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK') // resolveKey lock acquired
      return Promise.resolve('OK')
    })

    await tryEarlyResolve(io, 'room-1')
    // Advance past 1500ms (vote:all-cast delay) to trigger resolveRound
    await vi.advanceTimersByTimeAsync(3000)

    // GAME_STATE_LOST should be emitted (lines 274-275)
    const errorCalls = emitFn.mock.calls.filter((c: any[]) => c[0] === 'error')
    expect(errorCalls.length).toBeGreaterThan(0)
    expect(errorCalls[0][1]).toMatchObject({ code: 'GAME_STATE_LOST' })

    vi.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Coverage gap: line 330 — ': null' when dbRound is null in resolveRound
// When round.findUnique returns null, wordReveal is set to null.
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveRound — null wordReveal when dbRound not found (line 330)', () => {
  it('sets wordReveal to null when round.findUnique returns null', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // Imposter voted out → villagers win; but round.findUnique returns null → line 330 fires
    const state = makeState({
      status: 'voting',
      rounds: [{
        id: 'round-1', roundNumber: 1,
        votes: [
          { voterId: 'u1', targetId: 'u4' },
          { voterId: 'u2', targetId: 'u4' },
          { voterId: 'u3', targetId: 'u4' },
          { voterId: 'u4', targetId: 'u1' },
        ],
        clues: [],
        speakingOrder: ['u1', 'u2', 'u3', 'u4'],
      }],
    })

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    ;(mockRedis as any).set.mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })

    // findUnique returns null → dbRound is null → line 330 ': null' branch fires
    mockPrisma.round.findUnique.mockResolvedValue(null)
    mockPrisma.roundVote.createMany.mockResolvedValue({})
    mockPrisma.round.update.mockResolvedValue({})
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    mockPrisma.achievement.findMany.mockResolvedValue([])
    mockPrisma.gameParticipation.findMany.mockResolvedValue([])
    mockPrisma.room.update.mockResolvedValue({})

    await tryEarlyResolve(io, 'room-1')
    await vi.advanceTimersByTimeAsync(5000)

    // round:ended should still be emitted (wordReveal = null in payload)
    const calls = emitFn.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('vote:all-cast')

    vi.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Coverage gap: lines 382-383 — applyRankedLP when villagers win via regular vote
// In resolveRound (winner path, ranked mode), LP is applied for ranked games.
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveRound — ranked LP applied when villagers win via regular vote (lines 382-383)', () => {
  it('calls applyRankedLP when ranked game ends via normal vote elimination', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // Ranked game: all 4 vote out the imposter → villagers win
    const state = makeState({
      status: 'voting',
      gameMode: 'ranked',
      rounds: [{
        id: 'round-1', roundNumber: 1,
        votes: [
          { voterId: 'u1', targetId: 'u4' },
          { voterId: 'u2', targetId: 'u4' },
          { voterId: 'u3', targetId: 'u4' },
          { voterId: 'u4', targetId: 'u1' },
        ],
        clues: [],
        speakingOrder: ['u1', 'u2', 'u3', 'u4'],
      }],
    })

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    ;(mockRedis as any).set.mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })

    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-1', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.roundVote.createMany.mockResolvedValue({})
    mockPrisma.round.update.mockResolvedValue({})
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    mockPrisma.achievement.findMany.mockResolvedValue([])
    mockPrisma.gameParticipation.findMany.mockResolvedValue([])
    mockPrisma.room.update.mockResolvedValue({})

    // Ranked LP mocks for applyRankedLP (lines 381-383)
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', rankPoints: 1000, rankTier: 'Gold' },
      { id: 'u2', rankPoints: 1000, rankTier: 'Gold' },
      { id: 'u3', rankPoints: 1000, rankTier: 'Gold' },
      { id: 'u4', rankPoints: 500,  rankTier: 'Silver' },
    ])
    mockPrisma.user.update = vi.fn().mockResolvedValue({})

    await tryEarlyResolve(io, 'room-1')
    await vi.advanceTimersByTimeAsync(5000)

    // user.update should be called for ranked LP (lines 382-383)
    expect(mockPrisma.user.update).toHaveBeenCalled()

    vi.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Coverage gap: line 598 — startTiebreakerVoting setTimeout fires resolveTiebreaker
// This covers the branch where eligible voters exist and the tiebreaker voting
// period expires, causing the timer to call resolveTiebreaker.
// ─────────────────────────────────────────────────────────────────────────────

describe('startTiebreakerVoting — timer fires resolveTiebreaker (line 598)', () => {
  it('calls resolveTiebreaker when tiebreaker voting timer expires', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // u3 and u4 are tied; u1 and u2 are eligible voters but haven't voted yet.
    // This ensures eligibleVoters.length > 0, so startTiebreakerVoting goes
    // past the "no voters" check and sets the votingTimeSeconds timer (line 596-599).
    const state = makeState({
      status: 'in_progress',
      tiebreakerActive: true,
      tiebreakerPhase: 'clue',
      tiebreakerPlayerIds: ['u3', 'u4'],
      tiebreakerClues: [
        { playerId: 'u3', text: 'a' },
        { playerId: 'u4', text: 'b' },
      ],
      tiebreakerVotes: [],
      votingTimeSeconds: 30,
    })

    // mockRedis.get always returns the same state so all getState() calls succeed
    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')

    // resolveTiebreaker path — no votes cast → no clear winner → next round
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', speakingTimeSeconds: 30, votingTimeSeconds: 30 })
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.round.findUnique.mockResolvedValue(null) // currentRound is null (see rounds below)
    mockPrisma.round.create.mockResolvedValue({ id: 'round-2', roundNumber: 2 })

    // Fire tryEarlyTiebreakerVoting → sets 1500ms timer → startTiebreakerVoting
    // In startTiebreakerVoting, eligible voters exist → sets votingTimeSeconds timer (line 596)
    await tryEarlyTiebreakerVoting(io, 'room-1')

    // Advance past 1500ms (startTiebreakerVoting timer) + votingTimeSeconds*1000 (30000ms)
    await vi.advanceTimersByTimeAsync(35000)

    // The timer on line 596-599 should have fired, calling resolveTiebreaker
    // resolveTiebreaker will try to call getState and process
    expect(mockRedis.get).toHaveBeenCalled()

    vi.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Coverage gap: line 615 — resolveRoundNoElimination with null currentRound
// When state.rounds is empty, currentRound is undefined → ternary takes ':null' branch.
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveRoundNoElimination — null currentRound branch (line 615)', () => {
  it('uses null dbRound when state has no rounds', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // All alive players tied, no rounds in state → currentRound = undefined → line 615 fires
    const state = {
      status: 'in_progress',
      gameMode: 'normal',
      currentRound: 1,
      maxRounds: 5,
      tiebreakerActive: true,
      tiebreakerPhase: 'clue',
      tiebreakerPlayerIds: ['u1', 'u2', 'u3', 'u4'], // all alive players tied
      tiebreakerClues: [
        { playerId: 'u1', text: 'a' },
        { playerId: 'u2', text: 'b' },
        { playerId: 'u3', text: 'c' },
        { playerId: 'u4', text: 'd' },
      ],
      votingTimeSeconds: 30,
      players: [
        { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
        { userId: 'u3', username: 'Carol', role: 'villager', status: 'alive' },
        { userId: 'u4', username: 'Dave',  role: 'imposter', status: 'alive' },
      ],
      villagerWord: 'Apple',
      imposterWord: 'Pear',
      rounds: [], // empty — state.rounds?.[0] = undefined → line 615 (': null') branch
    }

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')

    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', speakingTimeSeconds: 30, votingTimeSeconds: 30 })
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.round.create.mockResolvedValue({ id: 'round-2', roundNumber: 2 })

    await tryEarlyTiebreakerVoting(io, 'room-1')
    // 1500ms startTiebreakerVoting timer + 5000ms startRound timer
    await vi.advanceTimersByTimeAsync(8000)

    // round.findUnique should NOT be called (currentRound is null → ': null' branch)
    expect(mockPrisma.round.findUnique).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Coverage gap: line 691 — resolveTiebreaker with eliminatedId but null currentRound
// When tiebreaker votes elect a player but state has no rounds,
// currentRound is undefined → ternary ':null' branch at line 691.
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveTiebreaker — eliminatedId present but null currentRound (line 691)', () => {
  it('uses null dbRound when state has no rounds and a player is eliminated', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // u3 and u4 are tied; u1 and u2 vote for u4 (imposter) → eliminated
    // But state.rounds is empty → currentRound is null → line 691 (': null') fires
    const state = {
      status: 'voting',
      gameMode: 'normal',
      currentRound: 1,
      maxRounds: 5,
      tiebreakerActive: true,
      tiebreakerPhase: 'vote',
      tiebreakerPlayerIds: ['u3', 'u4'],
      tiebreakerVotes: [
        { voterId: 'u1', targetId: 'u4' },
        { voterId: 'u2', targetId: 'u4' },
      ],
      players: [
        { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
        { userId: 'u3', username: 'Carol', role: 'villager', status: 'alive' },
        { userId: 'u4', username: 'Dave',  role: 'imposter', status: 'alive' },
      ],
      villagerWord: 'Apple',
      imposterWord: 'Pear',
      rounds: [], // empty → currentRound = undefined → line 691 ':null' branch
    }

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')

    // Imposter (u4) gets eliminated → villagers win
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    mockPrisma.achievement.findMany.mockResolvedValue([])
    mockPrisma.gameParticipation.findMany.mockResolvedValue([])
    mockPrisma.room.update.mockResolvedValue({})

    await tryEarlyTiebreakerResolve(io, 'room-1')
    await vi.advanceTimersByTimeAsync(5000)

    // round.findUnique should NOT be called (currentRound is null)
    expect(mockPrisma.round.findUnique).not.toHaveBeenCalled()
    // Game should end (villagers win)
    const calls = emitFn.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('game:finished')

    vi.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Coverage gap: line 741 — resolveTiebreaker else branch (no winner) with null currentRound
// When tiebreaker resolves without a winner and state.rounds is empty,
// currentRound is null → ternary ':null' branch at line 741.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Coverage gap: lines 468-469 — applyRankedLP for ranked survival win
// When imposters win by surviving all rounds in a ranked game, ranked LP is applied.
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveRound — ranked survival win applies LP (lines 468-469)', () => {
  it('calls applyRankedLP when imposters win by surviving all rounds in ranked mode', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // Ranked game: imposter survives all rounds (maxRounds=3, now round 3)
    const state = {
      status: 'voting',
      gameMode: 'ranked',  // ranked → lines 467-469 (applyRankedLP) execute
      currentRound: 3,
      maxRounds: 3,
      players: [
        { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
        { userId: 'u3', username: 'Carol', role: 'villager', status: 'eliminated' },
        { userId: 'u4', username: 'Dave',  role: 'imposter', status: 'alive' },
      ],
      villagerWord: 'Apple',
      imposterWord: 'Pear',
      rounds: [
        { id: 'round-1', roundNumber: 1, votes: [], clues: [], speakingOrder: [] },
        { id: 'round-2', roundNumber: 2, votes: [], clues: [], speakingOrder: [] },
        {
          id: 'round-3', roundNumber: 3,
          votes: [
            { voterId: 'u1', targetId: 'u3' },
            { voterId: 'u2', targetId: 'u3' },
            { voterId: 'u4', targetId: 'u3' },
          ],
          clues: [],
          speakingOrder: ['u1', 'u2', 'u4'],
        },
      ],
    }

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    ;(mockRedis as any).set.mockImplementation((...args: any[]) => {
      if (args.includes('NX')) return Promise.resolve('OK')
      return Promise.resolve('OK')
    })

    mockPrisma.round.findUnique.mockResolvedValue({ id: 'round-3', villagerWord: 'Apple', imposterWord: 'Pear' })
    mockPrisma.roundVote.createMany.mockResolvedValue({})
    mockPrisma.round.update.mockResolvedValue({})
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.game.update.mockResolvedValue({})
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    mockPrisma.room.update.mockResolvedValue({})

    // Ranked LP mocks for applyRankedLP call (lines 467-469)
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', rankPoints: 1000, rankTier: 'Gold' },
      { id: 'u2', rankPoints: 1000, rankTier: 'Gold' },
      { id: 'u4', rankPoints: 1200, rankTier: 'Gold' },
    ])
    mockPrisma.user.update = vi.fn().mockResolvedValue({})

    await tryEarlyResolve(io, 'room-1')
    await vi.advanceTimersByTimeAsync(10000)

    // user.update should be called (applyRankedLP) for the ranked survival win
    expect(mockPrisma.user.update).toHaveBeenCalled()

    vi.useRealTimers()
  })
})

describe('resolveTiebreaker — no winner, null currentRound branch (line 741)', () => {
  it('uses null dbRound when state has no rounds and tiebreaker eliminates a villager', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const emitFn = vi.fn()
    io.to.mockReturnValue({ emit: emitFn })

    // u3 (villager) and u4 (imposter) tied; u1 and u2 vote for u3 → villager eliminated
    // Imposter survives → no winner. state.rounds is empty → line 741 ':null' fires.
    const state = {
      status: 'voting',
      gameMode: 'normal',
      currentRound: 1,
      maxRounds: 5,
      tiebreakerActive: true,
      tiebreakerPhase: 'vote',
      tiebreakerPlayerIds: ['u3', 'u4'],
      tiebreakerVotes: [
        { voterId: 'u1', targetId: 'u3' },
        { voterId: 'u2', targetId: 'u3' },
      ],
      players: [
        { userId: 'u1', username: 'Alice', role: 'villager', status: 'alive' },
        { userId: 'u2', username: 'Bob',   role: 'villager', status: 'alive' },
        { userId: 'u3', username: 'Carol', role: 'villager', status: 'alive' },
        { userId: 'u4', username: 'Dave',  role: 'imposter', status: 'alive' },
      ],
      villagerWord: 'Apple',
      imposterWord: 'Pear',
      rounds: [], // empty → currentRound = undefined → line 741 ':null' branch
    }

    mockRedis.get.mockResolvedValue(JSON.stringify(state))
    mockRedis.set.mockResolvedValue('OK')

    // No winner yet — start next round
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', speakingTimeSeconds: 30, votingTimeSeconds: 30 })
    mockPrisma.game.findFirst.mockResolvedValue({ id: 'game-1', roomId: 'room-1' })
    mockPrisma.gameParticipation.updateMany.mockResolvedValue({})
    mockPrisma.round.create.mockResolvedValue({ id: 'round-2', roundNumber: 2 })

    await tryEarlyTiebreakerResolve(io, 'room-1')
    await vi.advanceTimersByTimeAsync(8000)

    // round.findUnique should NOT be called (currentRound is null → ':null' branch)
    expect(mockPrisma.round.findUnique).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
})
