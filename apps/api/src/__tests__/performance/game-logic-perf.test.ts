import { describe, it, expect, vi } from 'vitest'
import {
  countAlive,
  getMostVoted,
  shuffleArray,
  generateRoomCode,
} from '@red-handed/shared'
import type { Player, Vote } from '@red-handed/shared'

// Use real implementations for performance tests
vi.unmock('@red-handed/shared')

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: overrides.id ?? `socket-${Math.random().toString(36).slice(2)}`,
    userId: overrides.userId ?? `user-${Math.random().toString(36).slice(2)}`,
    username: overrides.username ?? 'player',
    avatarUrl: null,
    role: overrides.role ?? 'villager',
    status: overrides.status ?? 'alive',
    isHost: false,
    isReady: true,
  }
}

describe('Game Logic - Performance Tests', () => {
  it('countAlive with 100 players completes in < 5ms', () => {
    const players: Player[] = Array.from({ length: 100 }, (_, i) =>
      makePlayer({
        role: i < 20 ? 'red_handed' : 'villager',
        status: i % 3 === 0 ? 'eliminated' : 'alive',
      }),
    )

    const start = performance.now()
    const result = countAlive(players)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(5)
    expect(result.villagers).toBeGreaterThan(0)
    expect(result.redHanded).toBeGreaterThan(0)
  })

  it('getMostVoted with 1000 votes completes in < 10ms', () => {
    const targetIds = Array.from({ length: 20 }, (_, i) => `user-${i}`)
    const votes: Vote[] = Array.from({ length: 1000 }, (_, i) => ({
      voterId: `voter-${i}`,
      targetId: targetIds[Math.floor(Math.random() * targetIds.length)],
      timestamp: new Date().toISOString(),
    }))

    const start = performance.now()
    const result = getMostVoted(votes)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(10)
    // Result should be a string or null (tie)
    expect(result === null || typeof result === 'string').toBe(true)
  })

  it('shuffleArray with 10000 items completes in < 50ms', () => {
    const items = Array.from({ length: 10000 }, (_, i) => i)

    const start = performance.now()
    const result = shuffleArray(items)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(50)
    expect(result.length).toBe(10000)
    // Verify all items are present
    expect(new Set(result).size).toBe(10000)
  })

  it('generateRoomCode 10000 times completes in < 500ms', () => {
    const codes = new Set<string>()

    const start = performance.now()
    for (let i = 0; i < 10000; i++) {
      codes.add(generateRoomCode())
    }
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(500)
    // Should generate mostly unique codes (6-char alphanumeric has large keyspace)
    expect(codes.size).toBeGreaterThan(9000)
  })

  it('countAlive scales linearly with player count', () => {
    const sizes = [100, 500, 1000]
    const times: number[] = []

    for (const size of sizes) {
      const players: Player[] = Array.from({ length: size }, (_, i) =>
        makePlayer({
          role: i < size / 5 ? 'red_handed' : 'villager',
          status: i % 4 === 0 ? 'eliminated' : 'alive',
        }),
      )

      const start = performance.now()
      for (let i = 0; i < 100; i++) {
        countAlive(players)
      }
      times.push(performance.now() - start)
    }

    // The ratio between the largest and smallest time should be roughly proportional
    // to the ratio of sizes (allowing generous margin for JIT warmup etc.)
    const ratio = times[2] / times[0]
    expect(ratio).toBeLessThan(50) // Very generous bound
  })
})
