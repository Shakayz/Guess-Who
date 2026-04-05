import { describe, it, expect, vi } from 'vitest'
import {
  countAlive,
  checkWinCondition,
  getMostVoted,
  shuffleArray,
  generateRoomCode,
} from '@imposter/shared'
import type { Player, Vote } from '@imposter/shared'

// Re-import without mock for functional tests of game logic
vi.unmock('@imposter/shared')

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: overrides.id ?? `socket-${Math.random().toString(36).slice(2)}`,
    userId: overrides.userId ?? `user-${Math.random().toString(36).slice(2)}`,
    username: overrides.username ?? 'player',
    avatarUrl: null,
    role: overrides.role ?? 'villager',
    status: overrides.status ?? 'alive',
    isHost: overrides.isHost ?? false,
    isReady: overrides.isReady ?? true,
  }
}

describe('Game Flow - Functional Tests', () => {
  describe('Role Assignment', () => {
    it('shuffleArray randomizes player order', () => {
      const players = Array.from({ length: 20 }, (_, i) => makePlayer({ username: `p${i}` }))
      const shuffled = shuffleArray(players)

      // Length should be preserved
      expect(shuffled.length).toBe(players.length)

      // All original players should still be present
      const originalIds = new Set(players.map((p) => p.userId))
      const shuffledIds = new Set(shuffled.map((p) => p.userId))
      expect(shuffledIds).toEqual(originalIds)

      // With 20 players, it is astronomically unlikely that the order is unchanged
      const sameOrder = players.every((p, i) => p.userId === shuffled[i].userId)
      // This could theoretically fail, but the probability is 1/20! ~ 0
      expect(sameOrder).toBe(false)
    })

    it('assigns imposter and villager roles correctly', () => {
      const players = Array.from({ length: 8 }, (_, i) => makePlayer({ username: `p${i}` }))
      const shuffled = shuffleArray([...players])
      const imposterCount = 2

      shuffled.forEach((p, idx) => {
        p.role = idx < imposterCount ? 'imposter' : 'villager'
      })

      const imposters = shuffled.filter((p) => p.role === 'imposter')
      const villagers = shuffled.filter((p) => p.role === 'villager')

      expect(imposters.length).toBe(2)
      expect(villagers.length).toBe(6)
    })
  })

  describe('Speaking Phase', () => {
    it('each player gets a turn in the speaking order', () => {
      const players = Array.from({ length: 6 }, (_, i) =>
        makePlayer({ userId: `user-${i}`, username: `p${i}` }),
      )
      const speakingOrder = shuffleArray(players.map((p) => p.userId))

      expect(speakingOrder.length).toBe(6)
      expect(new Set(speakingOrder).size).toBe(6)
    })
  })

  describe('Voting Phase', () => {
    it('getMostVoted returns the player with the most votes', () => {
      const votes: Vote[] = [
        { voterId: 'user-1', targetId: 'user-3', timestamp: new Date().toISOString() },
        { voterId: 'user-2', targetId: 'user-3', timestamp: new Date().toISOString() },
        { voterId: 'user-3', targetId: 'user-1', timestamp: new Date().toISOString() },
        { voterId: 'user-4', targetId: 'user-3', timestamp: new Date().toISOString() },
      ]

      const result = getMostVoted(votes)
      expect(result).toBe('user-3')
    })

    it('getMostVoted returns null on a tie', () => {
      const votes: Vote[] = [
        { voterId: 'user-1', targetId: 'user-3', timestamp: new Date().toISOString() },
        { voterId: 'user-2', targetId: 'user-4', timestamp: new Date().toISOString() },
      ]

      const result = getMostVoted(votes)
      expect(result).toBeNull()
    })

    it('getMostVoted returns null with no votes', () => {
      const result = getMostVoted([])
      expect(result).toBeNull()
    })
  })

  describe('Elimination', () => {
    it('eliminating a player changes their status', () => {
      const players = [
        makePlayer({ userId: 'u1', role: 'villager' }),
        makePlayer({ userId: 'u2', role: 'imposter' }),
        makePlayer({ userId: 'u3', role: 'villager' }),
        makePlayer({ userId: 'u4', role: 'villager' }),
      ]

      // Simulate elimination
      const eliminatedId = 'u2'
      const player = players.find((p) => p.userId === eliminatedId)!
      player.status = 'eliminated'

      expect(player.status).toBe('eliminated')
      expect(players.filter((p) => p.status === 'alive').length).toBe(3)
    })
  })

  describe('Win Condition', () => {
    it('villagers win when all imposters are eliminated', () => {
      const players: Player[] = [
        makePlayer({ role: 'villager', status: 'alive' }),
        makePlayer({ role: 'villager', status: 'alive' }),
        makePlayer({ role: 'villager', status: 'alive' }),
        makePlayer({ role: 'imposter', status: 'eliminated' }),
        makePlayer({ role: 'imposter', status: 'eliminated' }),
      ]

      expect(checkWinCondition(players)).toBe('villagers')
    })

    it('imposters win when they equal or outnumber villagers', () => {
      const players: Player[] = [
        makePlayer({ role: 'villager', status: 'alive' }),
        makePlayer({ role: 'imposter', status: 'alive' }),
        makePlayer({ role: 'villager', status: 'eliminated' }),
        makePlayer({ role: 'villager', status: 'eliminated' }),
      ]

      expect(checkWinCondition(players)).toBe('imposters')
    })

    it('game continues when both sides have players and villagers outnumber', () => {
      const players: Player[] = [
        makePlayer({ role: 'villager', status: 'alive' }),
        makePlayer({ role: 'villager', status: 'alive' }),
        makePlayer({ role: 'villager', status: 'alive' }),
        makePlayer({ role: 'imposter', status: 'alive' }),
      ]

      expect(checkWinCondition(players)).toBeNull()
    })

    it('detectives count as villagers for win condition', () => {
      const players: Player[] = [
        makePlayer({ role: 'detective', status: 'alive' }),
        makePlayer({ role: 'villager', status: 'alive' }),
        makePlayer({ role: 'imposter', status: 'eliminated' }),
      ]

      expect(checkWinCondition(players)).toBe('villagers')
    })

    it('double_agent counts as imposter for win condition', () => {
      const players: Player[] = [
        makePlayer({ role: 'villager', status: 'alive' }),
        makePlayer({ role: 'double_agent', status: 'alive' }),
        makePlayer({ role: 'villager', status: 'eliminated' }),
      ]

      expect(checkWinCondition(players)).toBe('imposters')
    })
  })

  describe('Full Game Simulation', () => {
    it('simulates a complete game from start to villager victory', () => {
      // Setup: 6 players, 2 imposters
      const players: Player[] = [
        makePlayer({ userId: 'v1', username: 'alice', role: 'imposter', status: 'alive' }),
        makePlayer({ userId: 'v2', username: 'bob', role: 'imposter', status: 'alive' }),
        makePlayer({ userId: 'v3', username: 'carol', role: 'villager', status: 'alive' }),
        makePlayer({ userId: 'v4', username: 'dave', role: 'villager', status: 'alive' }),
        makePlayer({ userId: 'v5', username: 'eve', role: 'villager', status: 'alive' }),
        makePlayer({ userId: 'v6', username: 'frank', role: 'villager', status: 'alive' }),
      ]

      // Round 1: Speaking phase - each player speaks (order randomized)
      const round1Order = shuffleArray(players.filter((p) => p.status === 'alive').map((p) => p.userId))
      expect(round1Order.length).toBe(6)

      // Round 1: Voting - imposter v1 gets eliminated
      const round1Votes: Vote[] = [
        { voterId: 'v3', targetId: 'v1', timestamp: new Date().toISOString() },
        { voterId: 'v4', targetId: 'v1', timestamp: new Date().toISOString() },
        { voterId: 'v5', targetId: 'v1', timestamp: new Date().toISOString() },
        { voterId: 'v6', targetId: 'v2', timestamp: new Date().toISOString() },
        { voterId: 'v1', targetId: 'v3', timestamp: new Date().toISOString() },
        { voterId: 'v2', targetId: 'v3', timestamp: new Date().toISOString() },
      ]
      const eliminated1 = getMostVoted(round1Votes)
      expect(eliminated1).toBe('v1')
      players.find((p) => p.userId === eliminated1)!.status = 'eliminated'
      expect(checkWinCondition(players)).toBeNull() // Game continues: 4v vs 1i

      // Round 2: Voting - imposter v2 gets eliminated
      const round2Votes: Vote[] = [
        { voterId: 'v3', targetId: 'v2', timestamp: new Date().toISOString() },
        { voterId: 'v4', targetId: 'v2', timestamp: new Date().toISOString() },
        { voterId: 'v5', targetId: 'v2', timestamp: new Date().toISOString() },
        { voterId: 'v2', targetId: 'v6', timestamp: new Date().toISOString() },
        { voterId: 'v6', targetId: 'v4', timestamp: new Date().toISOString() },
      ]
      const eliminated2 = getMostVoted(round2Votes)
      expect(eliminated2).toBe('v2')
      players.find((p) => p.userId === eliminated2)!.status = 'eliminated'

      // All imposters eliminated
      expect(checkWinCondition(players)).toBe('villagers')
    })
  })
})
