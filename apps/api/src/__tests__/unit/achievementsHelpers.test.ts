import { describe, it, expect } from 'vitest'

import {
  REWARD,
  TIERS_3,
  TIERS_4,
  TIERS_5,
  TIERS_6,
  merge,
  progression,
  single,
} from '../../services/achievements/evaluators/_helpers'
import type { EventContext, UserStats } from '../../services/achievements/types'

function emptyStats(): UserStats {
  return {
    totalGames: 0,
    totalWins: 0,
    totalRedHandedWins: 0,
    totalVillagerWins: 0,
    totalJesterWins: 0,
    survivedWins: 0,
    winsByRole: {},
    gamesByRole: {},
    friendCount: 0,
    honorGivenCount: 0,
    honorReceivedCount: 0,
    distinctHonorGivers: 0,
    dmSentCount: 0,
    giftSentCount: 0,
    giftReceivedCount: 0,
    starCoinsCurrent: 0,
    rankedGames: 0,
    rankedWins: 0,
    rankTier: 'wooden',
    rankPoints: 0,
    achievementsUnlockedCount: 0,
    achievementsClaimedCount: 0,
    dailyStreakCount: 0,
    wordPacksCreated: 0,
    languagesPlayed: 0,
    distinctWordPacks: 0,
  }
}

function friendCtx(friendCount: number): EventContext {
  return {
    type: 'friend_added',
    userId: 'u1',
    now: new Date(),
    stats: { ...emptyStats(), friendCount },
  }
}

describe('TIERS_*', () => {
  it('TIERS_3 produces three tiers bronze→gold', () => {
    const tiers = TIERS_3([1, 5, 10])
    expect(tiers.map((t) => t.n)).toEqual([1, 5, 10])
    expect(tiers.map((t) => t.difficulty)).toEqual(['bronze', 'silver', 'gold'])
    expect(tiers[0].stars).toBe(3)
    expect(tiers[2].stars).toBe(50)
  })

  it('TIERS_4 includes platinum', () => {
    const tiers = TIERS_4([1, 5, 10, 25])
    expect(tiers.map((t) => t.difficulty)).toEqual(['bronze', 'silver', 'gold', 'platinum'])
  })

  it('TIERS_5 includes diamond', () => {
    const tiers = TIERS_5([1, 5, 10, 25, 50])
    expect(tiers.at(-1)?.difficulty).toBe('diamond')
  })

  it('TIERS_6 includes mythic and caps at 1000 stars', () => {
    const tiers = TIERS_6([1, 5, 10, 25, 50, 100])
    expect(tiers.at(-1)?.difficulty).toBe('mythic')
    expect(tiers.at(-1)?.stars).toBe(1000)
  })

  it('no tier template pays more than 1000 stars', () => {
    const all = [
      ...TIERS_3([1, 2, 3]),
      ...TIERS_4([1, 2, 3, 4]),
      ...TIERS_5([1, 2, 3, 4, 5]),
      ...TIERS_6([1, 2, 3, 4, 5, 6]),
    ]
    for (const t of all) {
      expect(t.stars).toBeLessThanOrEqual(1000)
    }
  })

  it('tier thresholds flow through to every def.n', () => {
    const tiers = TIERS_6([1, 2, 3, 4, 5, 6])
    tiers.forEach((t, i) => expect(t.n).toBe(i + 1))
  })
})

describe('REWARD', () => {
  it('has non-zero rewards for every difficulty', () => {
    for (const [diff, reward] of Object.entries(REWARD)) {
      expect(reward.stars).toBeGreaterThan(0)
      expect(reward.xp).toBeGreaterThan(0)
      expect(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic']).toContain(diff)
    }
  })

  it('reward difficulty ordering is strictly increasing', () => {
    const order = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic'] as const
    for (let i = 1; i < order.length; i++) {
      expect(REWARD[order[i]].stars).toBeGreaterThan(REWARD[order[i - 1]].stars)
      expect(REWARD[order[i]].xp).toBeGreaterThan(REWARD[order[i - 1]].xp)
    }
  })

  it('no single one-off achievement pays more than 1000 coins', () => {
    for (const reward of Object.values(REWARD)) {
      expect(reward.stars).toBeLessThanOrEqual(1000)
    }
  })
})

describe('progression', () => {
  it('produces one def + eval per tier', () => {
    const { defs, evals } = progression({
      keyPrefix: 'friends',
      category: 'social',
      icon: '👥',
      name: (n) => `Friends ×${n}`,
      description: (n) => `Befriend ${n} players`,
      event: 'friend_added',
      getCount: (s) => s.friendCount,
      tiers: TIERS_3([1, 5, 10]),
    })
    expect(defs).toHaveLength(3)
    expect(evals).toHaveLength(3)
    expect(defs.map((d) => d.key)).toEqual(['friends_1', 'friends_5', 'friends_10'])
  })

  it('each generated def carries the right rewards from the tier', () => {
    const { defs } = progression({
      keyPrefix: 'wins',
      category: 'gameplay',
      icon: '🏆',
      name: (n) => `Win ${n}`,
      description: (n) => `Win ${n} games`,
      event: 'game_end',
      getCount: (s) => s.totalWins,
      tiers: TIERS_3([1, 10, 100]),
    })
    expect(defs[0]).toMatchObject({ difficulty: 'bronze', xpReward: 5, coinReward: 3 })
    expect(defs[1]).toMatchObject({ difficulty: 'silver', xpReward: 20, coinReward: 15 })
    expect(defs[2]).toMatchObject({ difficulty: 'gold', xpReward: 55, coinReward: 50 })
  })

  it('evaluators return true once the threshold is met', async () => {
    const { evals } = progression({
      keyPrefix: 'friends',
      category: 'social',
      icon: '👥',
      name: (n) => `Friends ×${n}`,
      description: (n) => `Befriend ${n} players`,
      event: 'friend_added',
      getCount: (s) => s.friendCount,
      tiers: TIERS_3([1, 5, 10]),
    })
    const firstTier = evals[0]
    expect(await firstTier.check(friendCtx(0))).toBe(false)
    expect(await firstTier.check(friendCtx(1))).toBe(true)
    expect(await firstTier.check(friendCtx(999))).toBe(true)
  })

  it('supports isSecret passthrough', () => {
    const { defs } = progression({
      keyPrefix: 'secret_test',
      category: 'secret',
      icon: '🔐',
      name: () => 'Secret',
      description: () => 'Secret unlocked',
      event: 'game_end',
      getCount: () => 1,
      tiers: TIERS_3([1, 5, 10]),
      isSecret: true,
    })
    for (const def of defs) {
      expect(def.isSecret).toBe(true)
    }
  })
})

describe('single', () => {
  it('wraps one def + one evaluator', () => {
    const out = single(
      {
        key: 'solo',
        name: 'Solo',
        description: 'Win solo',
        icon: '🎯',
        category: 'gameplay',
        difficulty: 'gold',
        xpReward: 50,
        coinReward: 100,
      },
      'game_end',
      () => true,
    )
    expect(out.defs).toHaveLength(1)
    expect(out.evals).toHaveLength(1)
    expect(out.evals[0].key).toBe('solo')
    expect(out.evals[0].event).toBe('game_end')
  })
})

describe('merge', () => {
  it('flattens multiple {defs, evals} groups', () => {
    const a = single(
      { key: 'a', name: 'A', description: 'A', icon: '', category: 'gameplay', difficulty: 'bronze', xpReward: 1, coinReward: 1 },
      'game_end',
      () => true,
    )
    const b = single(
      { key: 'b', name: 'B', description: 'B', icon: '', category: 'gameplay', difficulty: 'bronze', xpReward: 1, coinReward: 1 },
      'game_end',
      () => false,
    )
    const merged = merge(a, b)
    expect(merged.defs.map((d) => d.key)).toEqual(['a', 'b'])
    expect(merged.evals.map((e) => e.key)).toEqual(['a', 'b'])
  })

  it('returns empty arrays when called with no groups', () => {
    const merged = merge()
    expect(merged.defs).toEqual([])
    expect(merged.evals).toEqual([])
  })
})
