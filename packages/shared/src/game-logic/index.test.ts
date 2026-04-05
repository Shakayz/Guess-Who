import { describe, it, expect } from 'vitest'
import {
  countAlive,
  checkWinCondition,
  getMostVoted,
  getTiedPlayerIds,
  shuffleArray,
  generateRoomCode,
} from './index'
import type { Player, Vote } from '../types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> & { id: string }): Player {
  return {
    userId: overrides.id,
    username: `player-${overrides.id}`,
    role: 'villager',
    status: 'alive',
    isHost: false,
    isReady: true,
    avatarUrl: null,
    honorGiven: false,
    ...overrides,
  }
}

function makeVote(voterId: string, targetId: string): Vote {
  return { voterId, targetId, timestamp: new Date().toISOString() }
}

// ─── countAlive ─────────────────────────────────────────────────────────────

describe('countAlive', () => {
  it('returns zeros for an empty array', () => {
    expect(countAlive([])).toEqual({ villagers: 0, imposters: 0 })
  })

  it('counts alive villagers only', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 2, imposters: 0 })
  })

  it('counts alive imposters only', () => {
    const players = [
      makePlayer({ id: '1', role: 'imposter', status: 'alive' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 0, imposters: 1 })
  })

  it('ignores eliminated players', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'eliminated' }),
      makePlayer({ id: '3', role: 'imposter', status: 'eliminated' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 1, imposters: 0 })
  })

  it('counts detective as villager', () => {
    const players = [
      makePlayer({ id: '1', role: 'detective', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 2, imposters: 0 })
  })

  it('counts double_agent as imposter', () => {
    const players = [
      makePlayer({ id: '1', role: 'double_agent', status: 'alive' }),
      makePlayer({ id: '2', role: 'imposter', status: 'alive' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 0, imposters: 2 })
  })

  it('counts a mixed roster correctly', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'detective', status: 'alive' }),
      makePlayer({ id: '3', role: 'imposter', status: 'alive' }),
      makePlayer({ id: '4', role: 'double_agent', status: 'alive' }),
      makePlayer({ id: '5', role: 'villager', status: 'eliminated' }),
      makePlayer({ id: '6', role: 'imposter', status: 'eliminated' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 2, imposters: 2 })
  })

  it('handles all players eliminated', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'eliminated' }),
      makePlayer({ id: '2', role: 'imposter', status: 'eliminated' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 0, imposters: 0 })
  })
})

// ─── checkWinCondition ──────────────────────────────────────────────────────

describe('checkWinCondition', () => {
  it('returns null for empty array', () => {
    expect(checkWinCondition([])).toBeNull()
  })

  it('returns null when both counts are zero', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'eliminated' }),
      makePlayer({ id: '2', role: 'imposter', status: 'eliminated' }),
    ]
    expect(checkWinCondition(players)).toBeNull()
  })

  it('returns "villagers" when all imposters are eliminated', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
      makePlayer({ id: '3', role: 'imposter', status: 'eliminated' }),
    ]
    expect(checkWinCondition(players)).toBe('villagers')
  })

  it('returns "imposters" when imposters equal villagers', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'imposter', status: 'alive' }),
    ]
    expect(checkWinCondition(players)).toBe('imposters')
  })

  it('returns "imposters" when imposters outnumber villagers', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'imposter', status: 'alive' }),
      makePlayer({ id: '3', role: 'imposter', status: 'alive' }),
    ]
    expect(checkWinCondition(players)).toBe('imposters')
  })

  it('returns null when game is still ongoing', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
      makePlayer({ id: '3', role: 'imposter', status: 'alive' }),
    ]
    expect(checkWinCondition(players)).toBeNull()
  })

  it('handles detective and double_agent roles correctly', () => {
    const players = [
      makePlayer({ id: '1', role: 'detective', status: 'alive' }),
      makePlayer({ id: '2', role: 'double_agent', status: 'alive' }),
    ]
    // 1 villager (detective), 1 imposter (double_agent) => imposters >= villagers
    expect(checkWinCondition(players)).toBe('imposters')
  })

  it('villagers win with detective alive and imposters gone', () => {
    const players = [
      makePlayer({ id: '1', role: 'detective', status: 'alive' }),
      makePlayer({ id: '2', role: 'double_agent', status: 'eliminated' }),
      makePlayer({ id: '3', role: 'imposter', status: 'eliminated' }),
    ]
    expect(checkWinCondition(players)).toBe('villagers')
  })

  it('returns null when only villagers exist and all alive', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
    ]
    // 0 imposters => villagers win
    expect(checkWinCondition(players)).toBe('villagers')
  })
})

// ─── getMostVoted ───────────────────────────────────────────────────────────

describe('getMostVoted', () => {
  it('returns null for empty votes', () => {
    expect(getMostVoted([])).toBeNull()
  })

  it('returns the only candidate when one vote exists', () => {
    const votes = [makeVote('a', 'b')]
    expect(getMostVoted(votes)).toBe('b')
  })

  it('returns the candidate with most votes', () => {
    const votes = [
      makeVote('a', 'x'),
      makeVote('b', 'x'),
      makeVote('c', 'y'),
    ]
    expect(getMostVoted(votes)).toBe('x')
  })

  it('returns null on a two-way tie', () => {
    const votes = [
      makeVote('a', 'x'),
      makeVote('b', 'y'),
    ]
    expect(getMostVoted(votes)).toBeNull()
  })

  it('returns null on a three-way tie', () => {
    const votes = [
      makeVote('a', 'x'),
      makeVote('b', 'y'),
      makeVote('c', 'z'),
    ]
    expect(getMostVoted(votes)).toBeNull()
  })

  it('returns winner when only top two are tied but one has more', () => {
    const votes = [
      makeVote('a', 'x'),
      makeVote('b', 'x'),
      makeVote('c', 'x'),
      makeVote('d', 'y'),
      makeVote('e', 'y'),
      makeVote('f', 'z'),
    ]
    expect(getMostVoted(votes)).toBe('x')
  })

  it('handles all votes for the same target', () => {
    const votes = [
      makeVote('a', 'x'),
      makeVote('b', 'x'),
      makeVote('c', 'x'),
    ]
    expect(getMostVoted(votes)).toBe('x')
  })
})

// ─── getTiedPlayerIds ───────────────────────────────────────────────────────

describe('getTiedPlayerIds', () => {
  it('returns empty array for no votes', () => {
    expect(getTiedPlayerIds([])).toEqual([])
  })

  it('returns single player when no tie', () => {
    const votes = [makeVote('a', 'x'), makeVote('b', 'x'), makeVote('c', 'y')]
    expect(getTiedPlayerIds(votes)).toEqual(['x'])
  })

  it('returns both players on a two-way tie', () => {
    const votes = [makeVote('a', 'x'), makeVote('b', 'y')]
    const result = getTiedPlayerIds(votes)
    expect(result).toHaveLength(2)
    expect(result).toContain('x')
    expect(result).toContain('y')
  })

  it('returns all players on a three-way tie', () => {
    const votes = [
      makeVote('a', 'x'),
      makeVote('b', 'y'),
      makeVote('c', 'z'),
    ]
    const result = getTiedPlayerIds(votes)
    expect(result).toHaveLength(3)
    expect(result).toContain('x')
    expect(result).toContain('y')
    expect(result).toContain('z')
  })

  it('returns only the top-tied players, not lower vote counts', () => {
    const votes = [
      makeVote('a', 'x'),
      makeVote('b', 'x'),
      makeVote('c', 'y'),
      makeVote('d', 'y'),
      makeVote('e', 'z'),
    ]
    const result = getTiedPlayerIds(votes)
    expect(result).toHaveLength(2)
    expect(result).toContain('x')
    expect(result).toContain('y')
    expect(result).not.toContain('z')
  })

  it('returns single player when only one vote exists', () => {
    const votes = [makeVote('a', 'x')]
    expect(getTiedPlayerIds(votes)).toEqual(['x'])
  })
})

// ─── shuffleArray ───────────────────────────────────────────────────────────

describe('shuffleArray', () => {
  it('returns empty array for empty input', () => {
    expect(shuffleArray([])).toEqual([])
  })

  it('returns a single-element array unchanged', () => {
    expect(shuffleArray([42])).toEqual([42])
  })

  it('does not mutate the original array', () => {
    const original = [1, 2, 3, 4, 5]
    const copy = [...original]
    shuffleArray(original)
    expect(original).toEqual(copy)
  })

  it('returns an array of the same length', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(shuffleArray(arr)).toHaveLength(arr.length)
  })

  it('contains the same elements', () => {
    const arr = [1, 2, 3, 4, 5]
    const shuffled = shuffleArray(arr)
    expect(shuffled.sort()).toEqual([...arr].sort())
  })

  it('works with string arrays', () => {
    const arr = ['a', 'b', 'c']
    const shuffled = shuffleArray(arr)
    expect(shuffled.sort()).toEqual([...arr].sort())
  })
})

// ─── generateRoomCode ───────────────────────────────────────────────────────

describe('generateRoomCode', () => {
  it('returns a string of length 6', () => {
    const code = generateRoomCode()
    expect(code).toHaveLength(6)
  })

  it('returns only uppercase alphanumeric characters', () => {
    // Run multiple times to increase confidence
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode()
      expect(code).toMatch(/^[A-Z0-9]+$/)
    }
  })

  it('generates different codes on successive calls', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 20; i++) {
      codes.add(generateRoomCode())
    }
    // With 36^6 possibilities, 20 codes should all be unique
    expect(codes.size).toBeGreaterThan(1)
  })

  it('returns a string (type check)', () => {
    expect(typeof generateRoomCode()).toBe('string')
  })
})
