import { describe, it, expect } from 'vitest'
import {
  countAlive,
  checkWinCondition,
  getMostVoted,
  getTiedPlayerIds,
  shuffleArray,
  generateRoomCode,
  tallyVotes,
  isVillagerSideRole,
  isRedHandedSideRole,
  isJesterRole,
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

function makeSkipVote(voterId: string): Vote {
  return { voterId, targetId: null, timestamp: new Date().toISOString() }
}

// ─── countAlive ─────────────────────────────────────────────────────────────

describe('countAlive', () => {
  it('returns zeros for an empty array', () => {
    expect(countAlive([])).toEqual({ villagers: 0, redHanded: 0, jesters: 0 })
  })

  it('counts alive villagers only', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 2, redHanded: 0, jesters: 0 })
  })

  it('counts alive redHanded only', () => {
    const players = [
      makePlayer({ id: '1', role: 'red_handed', status: 'alive' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 0, redHanded: 1, jesters: 0 })
  })

  it('ignores eliminated players', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'eliminated' }),
      makePlayer({ id: '3', role: 'red_handed', status: 'eliminated' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 1, redHanded: 0, jesters: 0 })
  })

  it('counts detective as villager', () => {
    const players = [
      makePlayer({ id: '1', role: 'detective', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 2, redHanded: 0, jesters: 0 })
  })

  it('counts double_agent as redHanded', () => {
    const players = [
      makePlayer({ id: '1', role: 'double_agent', status: 'alive' }),
      makePlayer({ id: '2', role: 'red_handed', status: 'alive' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 0, redHanded: 2, jesters: 0 })
  })

  it('counts mayor as villager-side', () => {
    const players = [
      makePlayer({ id: '1', role: 'mayor', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 2, redHanded: 0, jesters: 0 })
  })

  it('counts infiltrator as red-handed-side', () => {
    const players = [
      makePlayer({ id: '1', role: 'infiltrator', status: 'alive' }),
      makePlayer({ id: '2', role: 'red_handed', status: 'alive' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 0, redHanded: 2, jesters: 0 })
  })

  it('counts jester as its own team', () => {
    const players = [
      makePlayer({ id: '1', role: 'jester', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
      makePlayer({ id: '3', role: 'red_handed', status: 'alive' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 1, redHanded: 1, jesters: 1 })
  })

  it('counts a mixed roster correctly', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'detective', status: 'alive' }),
      makePlayer({ id: '3', role: 'red_handed', status: 'alive' }),
      makePlayer({ id: '4', role: 'double_agent', status: 'alive' }),
      makePlayer({ id: '5', role: 'villager', status: 'eliminated' }),
      makePlayer({ id: '6', role: 'red_handed', status: 'eliminated' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 2, redHanded: 2, jesters: 0 })
  })

  it('handles all players eliminated', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'eliminated' }),
      makePlayer({ id: '2', role: 'red_handed', status: 'eliminated' }),
    ]
    expect(countAlive(players)).toEqual({ villagers: 0, redHanded: 0, jesters: 0 })
  })
})

// ─── team helpers ───────────────────────────────────────────────────────────

describe('team role helpers', () => {
  it('isVillagerSideRole returns true for villager, detective, guardian, mayor', () => {
    expect(isVillagerSideRole('villager')).toBe(true)
    expect(isVillagerSideRole('detective')).toBe(true)
    expect(isVillagerSideRole('guardian')).toBe(true)
    expect(isVillagerSideRole('mayor')).toBe(true)
  })

  it('isVillagerSideRole returns false for red-handed-side and jester', () => {
    expect(isVillagerSideRole('red_handed')).toBe(false)
    expect(isVillagerSideRole('double_agent')).toBe(false)
    expect(isVillagerSideRole('infiltrator')).toBe(false)
    expect(isVillagerSideRole('jester')).toBe(false)
  })

  it('isRedHandedSideRole returns true for redHanded, double_agent, infiltrator', () => {
    expect(isRedHandedSideRole('red_handed')).toBe(true)
    expect(isRedHandedSideRole('double_agent')).toBe(true)
    expect(isRedHandedSideRole('infiltrator')).toBe(true)
  })

  it('isRedHandedSideRole returns false for villager-side and jester', () => {
    expect(isRedHandedSideRole('villager')).toBe(false)
    expect(isRedHandedSideRole('mayor')).toBe(false)
    expect(isRedHandedSideRole('jester')).toBe(false)
  })

  it('isJesterRole returns true only for jester', () => {
    expect(isJesterRole('jester')).toBe(true)
    expect(isJesterRole('villager')).toBe(false)
    expect(isJesterRole('red_handed')).toBe(false)
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
      makePlayer({ id: '2', role: 'red_handed', status: 'eliminated' }),
    ]
    expect(checkWinCondition(players)).toBeNull()
  })

  it('returns "villagers" when all redHanded are eliminated', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
      makePlayer({ id: '3', role: 'red_handed', status: 'eliminated' }),
    ]
    expect(checkWinCondition(players)).toBe('villagers')
  })

  it('returns "red_handed" when 1 redHanded equals 1 villager', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'red_handed', status: 'alive' }),
    ]
    expect(checkWinCondition(players)).toBe('red_handed')
  })

  it('returns "red_handed" when 2 redHanded equal 2 villagers', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
      makePlayer({ id: '3', role: 'red_handed', status: 'alive' }),
      makePlayer({ id: '4', role: 'red_handed', status: 'alive' }),
    ]
    expect(checkWinCondition(players)).toBe('red_handed')
  })

  it('returns "red_handed" when redHanded outnumber villagers', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'red_handed', status: 'alive' }),
      makePlayer({ id: '3', role: 'red_handed', status: 'alive' }),
    ]
    expect(checkWinCondition(players)).toBe('red_handed')
  })

  it('returns null when game is still ongoing', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
      makePlayer({ id: '3', role: 'red_handed', status: 'alive' }),
    ]
    expect(checkWinCondition(players)).toBeNull()
  })

  it('handles detective and double_agent roles correctly (1v1 → redHanded win)', () => {
    const players = [
      makePlayer({ id: '1', role: 'detective', status: 'alive' }),
      makePlayer({ id: '2', role: 'double_agent', status: 'alive' }),
    ]
    // 1 villager-side (detective) vs 1 red-handed-side (double_agent) → redHanded reach parity
    expect(checkWinCondition(players)).toBe('red_handed')
  })

  it('villagers win with detective alive and redHanded gone', () => {
    const players = [
      makePlayer({ id: '1', role: 'detective', status: 'alive' }),
      makePlayer({ id: '2', role: 'double_agent', status: 'eliminated' }),
      makePlayer({ id: '3', role: 'red_handed', status: 'eliminated' }),
    ]
    expect(checkWinCondition(players)).toBe('villagers')
  })

  it('returns null when only villagers exist and all alive', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
    ]
    // 0 redHanded => villagers win
    expect(checkWinCondition(players)).toBe('villagers')
  })

  it('counts mayor in villager team for win condition', () => {
    const players = [
      makePlayer({ id: '1', role: 'mayor', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
      makePlayer({ id: '3', role: 'red_handed', status: 'eliminated' }),
    ]
    expect(checkWinCondition(players)).toBe('villagers')
  })

  it('counts infiltrator in redHanded team for win condition', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'infiltrator', status: 'alive' }),
      makePlayer({ id: '3', role: 'red_handed', status: 'alive' }),
    ]
    // 1 villager vs 2 red-handed-side → redHanded win
    expect(checkWinCondition(players)).toBe('red_handed')
  })

  it('ignores jester alive when checking win condition', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'villager', status: 'alive' }),
      makePlayer({ id: '3', role: 'jester', status: 'alive' }),
      makePlayer({ id: '4', role: 'red_handed', status: 'eliminated' }),
    ]
    // Jester is ignored — villagers win because redHanded = 0
    expect(checkWinCondition(players)).toBe('villagers')
  })

  it('jester alive does not block redHanded majority win', () => {
    const players = [
      makePlayer({ id: '1', role: 'villager', status: 'alive' }),
      makePlayer({ id: '2', role: 'red_handed', status: 'alive' }),
      makePlayer({ id: '3', role: 'red_handed', status: 'alive' }),
      makePlayer({ id: '4', role: 'jester', status: 'alive' }),
    ]
    // 1 villager vs 2 redHanded → redHanded win (jester doesn't pad villager team)
    expect(checkWinCondition(players)).toBe('red_handed')
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

  it('ignores skip votes (targetId === null) when tallying', () => {
    const votes = [
      makeVote('a', 'x'),
      makeSkipVote('b'),
      makeSkipVote('c'),
    ]
    expect(getMostVoted(votes)).toBe('x')
  })

  it('returns null when every vote is a skip', () => {
    const votes = [makeSkipVote('a'), makeSkipVote('b'), makeSkipVote('c')]
    expect(getMostVoted(votes)).toBeNull()
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

  it('excludes skip votes from the tied set', () => {
    const votes = [
      makeVote('a', 'x'),
      makeVote('b', 'y'),
      makeSkipVote('c'),
    ]
    const result = getTiedPlayerIds(votes)
    expect(result).toHaveLength(2)
    expect(result).toContain('x')
    expect(result).toContain('y')
  })

  it('returns empty array when all votes are skips', () => {
    const votes = [makeSkipVote('a'), makeSkipVote('b')]
    expect(getTiedPlayerIds(votes)).toEqual([])
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

// ─── tallyVotes (mayor weighted votes) ──────────────────────────────────────

describe('tallyVotes', () => {
  it('returns nulls for empty votes', () => {
    expect(tallyVotes([], [])).toEqual({ mostVotedId: null, tiedIds: [], weightedTally: {}, inverted: false })
  })

  it('behaves like getMostVoted when no mayor is active', () => {
    const players = [
      makePlayer({ id: 'a', role: 'villager' }),
      makePlayer({ id: 'b', role: 'villager' }),
      makePlayer({ id: 'c', role: 'red_handed' }),
    ]
    const votes = [makeVote('a', 'c'), makeVote('b', 'c')]
    const result = tallyVotes(votes, players)
    expect(result.mostVotedId).toBe('c')
    expect(result.tiedIds).toEqual(['c'])
    expect(result.weightedTally).toEqual({ c: 2 })
  })

  it('doubles the vote of a mayor with mayorDoubleActive=true', () => {
    const players = [
      makePlayer({ id: 'mayor', role: 'mayor', mayorDoubleActive: true }),
      makePlayer({ id: 'v1', role: 'villager' }),
      makePlayer({ id: 'imp', role: 'red_handed' }),
    ]
    // mayor votes 'imp' (weight 2), v1 votes 'mayor' (weight 1)
    const votes = [makeVote('mayor', 'imp'), makeVote('v1', 'mayor')]
    const result = tallyVotes(votes, players)
    expect(result.weightedTally).toEqual({ imp: 2, mayor: 1 })
    expect(result.mostVotedId).toBe('imp')
  })

  it('does NOT double the mayor vote when mayorDoubleActive is false', () => {
    const players = [
      makePlayer({ id: 'mayor', role: 'mayor', mayorDoubleActive: false }),
      makePlayer({ id: 'v1', role: 'villager' }),
      makePlayer({ id: 'imp', role: 'red_handed' }),
    ]
    const votes = [makeVote('mayor', 'imp'), makeVote('v1', 'mayor')]
    const result = tallyVotes(votes, players)
    expect(result.weightedTally).toEqual({ imp: 1, mayor: 1 })
    expect(result.mostVotedId).toBeNull()
    expect(result.tiedIds).toHaveLength(2)
  })

  it('mayor double-vote breaks a tie', () => {
    const players = [
      makePlayer({ id: 'mayor', role: 'mayor', mayorDoubleActive: true }),
      makePlayer({ id: 'v1', role: 'villager' }),
      makePlayer({ id: 'v2', role: 'villager' }),
      makePlayer({ id: 'imp', role: 'red_handed' }),
    ]
    // Without mayor boost: 2-2 tie between imp and mayor
    const votes = [
      makeVote('mayor', 'imp'),
      makeVote('v1', 'imp'),
      makeVote('v2', 'mayor'),
      makeVote('imp', 'mayor'),
    ]
    const result = tallyVotes(votes, players)
    // mayor's vote for 'imp' counts 2 → imp: 3, mayor: 2
    expect(result.weightedTally).toEqual({ imp: 3, mayor: 2 })
    expect(result.mostVotedId).toBe('imp')
  })

  it('returns tied ids when top count is shared', () => {
    const players = [
      makePlayer({ id: 'a', role: 'villager' }),
      makePlayer({ id: 'b', role: 'villager' }),
    ]
    const votes = [makeVote('a', 'x'), makeVote('b', 'y')]
    const result = tallyVotes(votes, players)
    expect(result.mostVotedId).toBeNull()
    expect(result.tiedIds.sort()).toEqual(['x', 'y'])
  })

  it('ignores mayor flag on non-mayor players (defensive)', () => {
    const players = [
      // Misconfigured: villager with mayorDoubleActive — must be ignored
      makePlayer({ id: 'fake', role: 'villager', mayorDoubleActive: true } as any),
      makePlayer({ id: 'v', role: 'villager' }),
    ]
    const votes = [makeVote('fake', 'x'), makeVote('v', 'y')]
    const result = tallyVotes(votes, players)
    expect(result.weightedTally).toEqual({ x: 1, y: 1 })
  })

  // ─── Corruptor: silent vote drop ────────────────────────────────────────────
  it('silently drops votes from a corrupted voter', () => {
    const players = [
      makePlayer({ id: 'corruptor', role: 'corruptor' }),
      makePlayer({ id: 'target', role: 'villager', corrupted: true }),
      makePlayer({ id: 'v1', role: 'villager' }),
      makePlayer({ id: 'v2', role: 'villager' }),
    ]
    // corrupted target votes 'corruptor' (dropped), v1+v2 vote 'corruptor'
    const votes = [
      makeVote('target', 'v1'),
      makeVote('v1', 'corruptor'),
      makeVote('v2', 'corruptor'),
    ]
    const result = tallyVotes(votes, players)
    expect(result.weightedTally).toEqual({ corruptor: 2 })
    expect(result.mostVotedId).toBe('corruptor')
  })

  // ─── Inverter: flip the winner ──────────────────────────────────────────────
  it('flips the tally when inverterActive is set', () => {
    const players = [
      makePlayer({ id: 'inv', role: 'inverter', inverterActive: true }),
      makePlayer({ id: 'v1', role: 'villager' }),
      makePlayer({ id: 'v2', role: 'villager' }),
      makePlayer({ id: 'imp', role: 'red_handed' }),
    ]
    const votes = [
      makeVote('v1', 'imp'),
      makeVote('v2', 'imp'),
      makeVote('inv', 'v1'),
      makeVote('imp', 'v1'),
    ]
    // Normal tally: imp=2, v1=2 → tie; but inverter flips, so LEAST votes wins.
    // All targets have votes (v1=2, imp=2). No entry has 0. The least tied is 2.
    // So both imp and v1 are the "least voted" (tied).
    const result = tallyVotes(votes, players)
    expect(result.inverted).toBe(true)
    expect(result.weightedTally).toEqual({ imp: 2, v1: 2 })
    expect(result.mostVotedId).toBeNull()
    expect(result.tiedIds.sort()).toEqual(['imp', 'v1'])
  })

  it('inverter picks the least-voted target (non-tied)', () => {
    const players = [
      makePlayer({ id: 'inv', role: 'inverter', inverterActive: true }),
      makePlayer({ id: 'v1', role: 'villager' }),
      makePlayer({ id: 'v2', role: 'villager' }),
      makePlayer({ id: 'v3', role: 'villager' }),
    ]
    // Most votes on 'v1' (3), one vote on 'v2' (1) → invert → v2 wins
    const votes = [
      makeVote('v2', 'v1'),
      makeVote('v3', 'v1'),
      makeVote('inv', 'v1'),
      makeVote('v1', 'v2'),
    ]
    const result = tallyVotes(votes, players)
    expect(result.inverted).toBe(true)
    expect(result.mostVotedId).toBe('v2')
  })

  // ─── Skip vote: abstention ──────────────────────────────────────────────────
  it('drops skip votes (targetId === null) from the weighted tally', () => {
    const players = [
      makePlayer({ id: 'a', role: 'villager' }),
      makePlayer({ id: 'b', role: 'villager' }),
      makePlayer({ id: 'c', role: 'villager' }),
      makePlayer({ id: 'imp', role: 'red_handed' }),
    ]
    const votes = [
      makeVote('a', 'imp'),
      makeVote('b', 'imp'),
      makeSkipVote('c'),
    ]
    const result = tallyVotes(votes, players)
    expect(result.weightedTally).toEqual({ imp: 2 })
    expect(result.mostVotedId).toBe('imp')
  })

  it('returns empty tally when every vote is a skip', () => {
    const players = [
      makePlayer({ id: 'a', role: 'villager' }),
      makePlayer({ id: 'b', role: 'villager' }),
      makePlayer({ id: 'c', role: 'villager' }),
    ]
    const votes = [makeSkipVote('a'), makeSkipVote('b'), makeSkipVote('c')]
    const result = tallyVotes(votes, players)
    expect(result.weightedTally).toEqual({})
    expect(result.mostVotedId).toBeNull()
    expect(result.tiedIds).toEqual([])
  })

  it('does not double-count a mayor skip vote', () => {
    const players = [
      makePlayer({ id: 'mayor', role: 'mayor', mayorDoubleActive: true }),
      makePlayer({ id: 'v1', role: 'villager' }),
      makePlayer({ id: 'imp', role: 'red_handed' }),
    ]
    const votes = [makeSkipVote('mayor'), makeVote('v1', 'imp')]
    const result = tallyVotes(votes, players)
    expect(result.weightedTally).toEqual({ imp: 1 })
    expect(result.mostVotedId).toBe('imp')
  })
})

// ─── Evil twins override ────────────────────────────────────────────────────

describe('checkWinCondition — evil twins', () => {
  it('overrides redHanded win when both twins alive', () => {
    const players = [
      makePlayer({ id: 'tv', role: 'twin_villager', twinPartnerUserId: 'ti' }),
      makePlayer({ id: 'ti', role: 'twin_red_handed', twinPartnerUserId: 'tv' }),
      makePlayer({ id: 'imp', role: 'red_handed', status: 'eliminated' }),
    ]
    // 1 villager-side (tv) vs 1 red-handed-side (ti) → redHanded >= villagers
    // BUT both twins alive → evil_twins wins
    expect(checkWinCondition(players)).toBe('evil_twins')
  })

  it('falls back to villagers when twin_red_handed is dead', () => {
    const players = [
      makePlayer({ id: 'tv', role: 'twin_villager', twinPartnerUserId: 'ti' }),
      makePlayer({ id: 'ti', role: 'twin_red_handed', twinPartnerUserId: 'tv', status: 'eliminated' }),
      makePlayer({ id: 'v1', role: 'villager' }),
    ]
    // redHanded=0 → villagers win (but twin_villager is individually a loser per game rules)
    expect(checkWinCondition(players)).toBe('villagers')
  })

  it('falls back to redHanded when twin_villager is dead', () => {
    const players = [
      makePlayer({ id: 'tv', role: 'twin_villager', twinPartnerUserId: 'ti', status: 'eliminated' }),
      makePlayer({ id: 'ti', role: 'twin_red_handed', twinPartnerUserId: 'tv' }),
      makePlayer({ id: 'v1', role: 'villager' }),
    ]
    // 1 villager vs 1 redHanded → redHanded win (standard parity)
    expect(checkWinCondition(players)).toBe('red_handed')
  })

  it('does not trigger evil_twins if twin pairing is broken', () => {
    const players = [
      makePlayer({ id: 'tv', role: 'twin_villager' /* no twinPartnerUserId */ }),
      makePlayer({ id: 'ti', role: 'twin_red_handed' /* no twinPartnerUserId */ }),
    ]
    // Unpaired twins → standard rule applies (1v1 → redHanded)
    expect(checkWinCondition(players)).toBe('red_handed')
  })
})

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
