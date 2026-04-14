import { describe, it, expect } from 'vitest'

import {
  DEFAULT_ACHIEVEMENTS,
  EVALUATORS,
  EVALUATORS_BY_EVENT,
  REGISTRY_STATS,
} from '../../services/achievements/registry'
import { DIFFICULTY_ORDER } from '../../services/achievements/types'

describe('DEFAULT_ACHIEVEMENTS', () => {
  it('has at least 100 entries (registry was rewritten to hold >400)', () => {
    expect(DEFAULT_ACHIEVEMENTS.length).toBeGreaterThan(100)
  })

  it('has unique keys (deduplication runs at module load)', () => {
    const keys = DEFAULT_ACHIEVEMENTS.map((d) => d.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every entry has required fields populated', () => {
    for (const d of DEFAULT_ACHIEVEMENTS) {
      expect(d.key.length).toBeGreaterThan(0)
      expect(d.name.length).toBeGreaterThan(0)
      expect(d.description.length).toBeGreaterThan(0)
      expect(d.icon.length).toBeGreaterThan(0)
      expect(typeof d.xpReward).toBe('number')
      expect(d.xpReward).toBeGreaterThan(0)
      expect(typeof d.coinReward).toBe('number')
      expect(d.coinReward).toBeGreaterThanOrEqual(0)
    }
  })

  it('every entry uses a known difficulty and category', () => {
    const validCategories = new Set([
      'gameplay',
      'imposter',
      'detective',
      'social',
      'ranked',
      'milestones',
      'secret',
      'special_role',
      'economy',
      'meta',
    ])
    for (const d of DEFAULT_ACHIEVEMENTS) {
      expect(DIFFICULTY_ORDER[d.difficulty]).toBeTypeOf('number')
      expect(validCategories.has(d.category)).toBe(true)
    }
  })

  it('is a frozen array', () => {
    expect(Object.isFrozen(DEFAULT_ACHIEVEMENTS)).toBe(true)
  })
})

describe('EVALUATORS', () => {
  it('has at least one evaluator', () => {
    expect(EVALUATORS.length).toBeGreaterThan(0)
  })

  it('every evaluator key matches a known achievement def', () => {
    const defKeys = new Set(DEFAULT_ACHIEVEMENTS.map((d) => d.key))
    const orphans = EVALUATORS.filter((ev) => !defKeys.has(ev.key))
    expect(orphans.map((o) => o.key)).toEqual([])
  })

  it('every evaluator has a check function', () => {
    for (const ev of EVALUATORS) {
      expect(typeof ev.check).toBe('function')
    }
  })

  it('is a frozen array', () => {
    expect(Object.isFrozen(EVALUATORS)).toBe(true)
  })
})

describe('EVALUATORS_BY_EVENT', () => {
  it('contains one bucket per supported event type', () => {
    const events = [
      'game_end',
      'friend_added',
      'honor_given',
      'honor_received',
      'dm_sent',
      'gift_sent',
      'gift_received',
      'daily_login',
      'shop_purchase',
      'cosmetic_equipped',
      'word_pack_created',
      'avatar_changed',
      'level_up',
      'rank_changed',
      'achievement_unlocked',
      'achievement_claimed',
    ] as const
    for (const e of events) {
      expect(Array.isArray(EVALUATORS_BY_EVENT[e])).toBe(true)
    }
  })

  it('the union of every bucket equals EVALUATORS', () => {
    const total = Object.values(EVALUATORS_BY_EVENT).reduce((s, b) => s + b.length, 0)
    expect(total).toBe(EVALUATORS.length)
  })

  it('game_end has at least one evaluator', () => {
    expect(EVALUATORS_BY_EVENT.game_end.length).toBeGreaterThan(0)
  })
})

describe('REGISTRY_STATS', () => {
  it('totalAchievements equals DEFAULT_ACHIEVEMENTS.length', () => {
    expect(REGISTRY_STATS.totalAchievements).toBe(DEFAULT_ACHIEVEMENTS.length)
  })

  it('totalEvaluators equals EVALUATORS.length', () => {
    expect(REGISTRY_STATS.totalEvaluators).toBe(EVALUATORS.length)
  })

  it('byCategory sums match totalAchievements', () => {
    const sum = Object.values(REGISTRY_STATS.byCategory).reduce((a, b) => a + b, 0)
    expect(sum).toBe(REGISTRY_STATS.totalAchievements)
  })

  it('byDifficulty sums match totalAchievements', () => {
    const sum = Object.values(REGISTRY_STATS.byDifficulty).reduce((a, b) => a + b, 0)
    expect(sum).toBe(REGISTRY_STATS.totalAchievements)
  })

  it('is frozen so the boot log cannot mutate it', () => {
    expect(Object.isFrozen(REGISTRY_STATS)).toBe(true)
  })
})
