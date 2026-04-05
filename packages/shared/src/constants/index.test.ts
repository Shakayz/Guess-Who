import { describe, it, expect } from 'vitest'
import {
  RANK_TIERS,
  RANK_CONFIG,
  MATCHMAKING_CONFIG,
  LP_REWARDS,
  DEFAULT_ROOM_SETTINGS,
  HONOR_TYPES,
  SUPPORTED_LOCALES,
  COIN_REWARDS,
  LP_DECAY,
} from './index'

// ─── RANK_TIERS ─────────────────────────────────────────────────────────────

describe('RANK_TIERS', () => {
  it('has exactly 7 tiers', () => {
    expect(RANK_TIERS).toHaveLength(7)
  })

  it('starts with wooden and ends with grandmaster', () => {
    expect(RANK_TIERS[0]).toBe('wooden')
    expect(RANK_TIERS[6]).toBe('grandmaster')
  })

  it('contains all expected tier names', () => {
    const expected = ['wooden', 'bronze', 'silver', 'gold', 'diamond', 'master', 'grandmaster']
    expect([...RANK_TIERS]).toEqual(expected)
  })

  it('is in ascending order of prestige', () => {
    // Verify ordering matches the LP thresholds in RANK_CONFIG
    for (let i = 0; i < RANK_TIERS.length - 1; i++) {
      const currentLP = RANK_CONFIG[RANK_TIERS[i]].lpRequired
      const nextLP = RANK_CONFIG[RANK_TIERS[i + 1]].lpRequired
      expect(currentLP).toBeLessThan(nextLP)
    }
  })
})

// ─── RANK_CONFIG ────────────────────────────────────────────────────────────

describe('RANK_CONFIG', () => {
  it('has a config entry for every tier', () => {
    for (const tier of RANK_TIERS) {
      expect(RANK_CONFIG).toHaveProperty(tier)
    }
  })

  it('each entry has label, color, icon, and lpRequired', () => {
    for (const tier of RANK_TIERS) {
      const config = RANK_CONFIG[tier]
      expect(typeof config.label).toBe('string')
      expect(config.label.length).toBeGreaterThan(0)
      expect(typeof config.color).toBe('string')
      expect(config.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(typeof config.icon).toBe('string')
      expect(typeof config.lpRequired).toBe('number')
    }
  })

  it('lpRequired values are strictly increasing', () => {
    const values = RANK_TIERS.map((t) => RANK_CONFIG[t].lpRequired)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1])
    }
  })

  it('grandmaster lpRequired is Infinity', () => {
    expect(RANK_CONFIG.grandmaster.lpRequired).toBe(Infinity)
  })

  it('wooden lpRequired starts at 100', () => {
    expect(RANK_CONFIG.wooden.lpRequired).toBe(100)
  })
})

// ─── MATCHMAKING_CONFIG ─────────────────────────────────────────────────────

describe('MATCHMAKING_CONFIG', () => {
  it('has sensible IDEAL_PLAYERS value', () => {
    expect(MATCHMAKING_CONFIG.IDEAL_PLAYERS).toBeGreaterThanOrEqual(4)
    expect(MATCHMAKING_CONFIG.IDEAL_PLAYERS).toBeLessThanOrEqual(20)
  })

  it('MIN_PLAYERS is at least 2', () => {
    expect(MATCHMAKING_CONFIG.MIN_PLAYERS).toBeGreaterThanOrEqual(2)
  })

  it('MIN_PLAYERS is less than or equal to IDEAL_PLAYERS', () => {
    expect(MATCHMAKING_CONFIG.MIN_PLAYERS).toBeLessThanOrEqual(MATCHMAKING_CONFIG.IDEAL_PLAYERS)
  })

  it('MAX_WAIT_SECONDS is a positive number', () => {
    expect(MATCHMAKING_CONFIG.MAX_WAIT_SECONDS).toBeGreaterThan(0)
  })

  it('TICK_INTERVAL_MS is a positive number', () => {
    expect(MATCHMAKING_CONFIG.TICK_INTERVAL_MS).toBeGreaterThan(0)
  })

  it('THRESHOLDS is a non-empty array', () => {
    expect(MATCHMAKING_CONFIG.THRESHOLDS.length).toBeGreaterThan(0)
  })

  it('THRESHOLDS are ordered by increasing "after" values', () => {
    const thresholds = MATCHMAKING_CONFIG.THRESHOLDS
    for (let i = 1; i < thresholds.length; i++) {
      expect(thresholds[i].after).toBeGreaterThan(thresholds[i - 1].after)
    }
  })

  it('THRESHOLDS have decreasing minPlayers as time increases', () => {
    const thresholds = MATCHMAKING_CONFIG.THRESHOLDS
    for (let i = 1; i < thresholds.length; i++) {
      expect(thresholds[i].minPlayers).toBeLessThanOrEqual(thresholds[i - 1].minPlayers)
    }
  })

  it('first threshold starts at 0 seconds', () => {
    expect(MATCHMAKING_CONFIG.THRESHOLDS[0].after).toBe(0)
  })

  it('last threshold minPlayers matches MIN_PLAYERS', () => {
    const last = MATCHMAKING_CONFIG.THRESHOLDS[MATCHMAKING_CONFIG.THRESHOLDS.length - 1]
    expect(last.minPlayers).toBe(MATCHMAKING_CONFIG.MIN_PLAYERS)
  })
})

// ─── LP_REWARDS ─────────────────────────────────────────────────────────────

describe('LP_REWARDS', () => {
  it('has VILLAGER_WIN key', () => {
    expect(LP_REWARDS).toHaveProperty('VILLAGER_WIN')
  })

  it('has VILLAGER_LOSS key', () => {
    expect(LP_REWARDS).toHaveProperty('VILLAGER_LOSS')
  })

  it('has IMPOSTER_WIN key', () => {
    expect(LP_REWARDS).toHaveProperty('IMPOSTER_WIN')
  })

  it('has IMPOSTER_LOSS key', () => {
    expect(LP_REWARDS).toHaveProperty('IMPOSTER_LOSS')
  })

  it('has SURVIVAL_IMPOSTER_WIN key', () => {
    expect(LP_REWARDS).toHaveProperty('SURVIVAL_IMPOSTER_WIN')
  })

  it('has SURVIVAL_VILLAGER_LOSS key', () => {
    expect(LP_REWARDS).toHaveProperty('SURVIVAL_VILLAGER_LOSS')
  })

  it('win rewards are positive', () => {
    expect(LP_REWARDS.VILLAGER_WIN).toBeGreaterThan(0)
    expect(LP_REWARDS.IMPOSTER_WIN).toBeGreaterThan(0)
    expect(LP_REWARDS.SURVIVAL_IMPOSTER_WIN).toBeGreaterThan(0)
  })

  it('loss penalties are negative', () => {
    expect(LP_REWARDS.VILLAGER_LOSS).toBeLessThan(0)
    expect(LP_REWARDS.IMPOSTER_LOSS).toBeLessThan(0)
    expect(LP_REWARDS.SURVIVAL_VILLAGER_LOSS).toBeLessThan(0)
  })

  it('imposter win reward is higher than villager win reward', () => {
    expect(LP_REWARDS.IMPOSTER_WIN).toBeGreaterThan(LP_REWARDS.VILLAGER_WIN)
  })

  it('all values are integers', () => {
    for (const value of Object.values(LP_REWARDS)) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })
})

// ─── DEFAULT_ROOM_SETTINGS ──────────────────────────────────────────────────

describe('DEFAULT_ROOM_SETTINGS', () => {
  it('has maxPlayers of 10', () => {
    expect(DEFAULT_ROOM_SETTINGS.maxPlayers).toBe(10)
  })

  it('has minPlayers of 3', () => {
    expect(DEFAULT_ROOM_SETTINGS.minPlayers).toBe(3)
  })

  it('minPlayers is less than maxPlayers', () => {
    expect(DEFAULT_ROOM_SETTINGS.minPlayers).toBeLessThan(DEFAULT_ROOM_SETTINGS.maxPlayers)
  })

  it('has imposterCount of 2', () => {
    expect(DEFAULT_ROOM_SETTINGS.imposterCount).toBe(2)
  })

  it('has positive speakingTimeSeconds', () => {
    expect(DEFAULT_ROOM_SETTINGS.speakingTimeSeconds).toBeGreaterThan(0)
  })

  it('has positive votingTimeSeconds', () => {
    expect(DEFAULT_ROOM_SETTINGS.votingTimeSeconds).toBeGreaterThan(0)
  })

  it('has a wordPackId', () => {
    expect(typeof DEFAULT_ROOM_SETTINGS.wordPackId).toBe('string')
    expect(DEFAULT_ROOM_SETTINGS.wordPackId.length).toBeGreaterThan(0)
  })

  it('defaults to public (isPrivate = false)', () => {
    expect(DEFAULT_ROOM_SETTINGS.isPrivate).toBe(false)
  })

  it('defaults to English language', () => {
    expect(DEFAULT_ROOM_SETTINGS.language).toBe('en')
  })

  it('defaults to normal game mode', () => {
    expect(DEFAULT_ROOM_SETTINGS.gameMode).toBe('normal')
  })

  it('defaults to empty categories array', () => {
    expect(DEFAULT_ROOM_SETTINGS.categories).toEqual([])
  })
})
