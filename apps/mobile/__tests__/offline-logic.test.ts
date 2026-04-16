import { describe, it, expect } from 'vitest'
import {
  OFFLINE_ROLE_REGISTRY,
  EVIL_OFFLINE_ROLES,
  isEvilOfflineRole,
  VILLAGER_OFFLINE_ROLES,
  RED_HANDED_OFFLINE_ROLES,
  NEUTRAL_OFFLINE_ROLES,
  ZERO_SPECIAL_COUNTS,
  computeMaxRoleCounts,
  maxRedHandedFor,
  clampRedHandedCount,
  getDefaultRedHandedCount,
} from '@red-handed/shared'

// Smoke-tests for the offline mode's core shared logic. The mobile app
// leans on these helpers for setup validation, so a regression here would
// silently break pass-and-play.

describe('offline role registry (mobile entry point)', () => {
  it('exposes every role with an iconEmoji, i18nLabelKey and colorToken', () => {
    for (const [role, def] of Object.entries(OFFLINE_ROLE_REGISTRY)) {
      expect(def.iconEmoji, `${role} should have iconEmoji`).toBeTruthy()
      expect(def.i18nLabelKey, `${role} should have i18nLabelKey`).toBeTruthy()
      expect(def.colorToken, `${role} should have colorToken`).toBeTruthy()
    }
  })

  it('every special role in the registry is categorised (villager / redHanded / neutral)', () => {
    const bucketed = new Set([
      ...VILLAGER_OFFLINE_ROLES,
      ...RED_HANDED_OFFLINE_ROLES,
      ...NEUTRAL_OFFLINE_ROLES,
    ])
    // The *_OFFLINE_ROLES lists enumerate SPECIAL roles only — base villager,
    // base redHanded, and the paired twin roles are intentionally absent.
    const BASE = new Set(['villager', 'red_handed', 'twinVillager', 'twinRedHanded'])
    const uncategorised = Object.keys(OFFLINE_ROLE_REGISTRY).filter((r) => {
      if (BASE.has(r)) return false
      return !bucketed.has(r as any)
    })
    expect(uncategorised).toEqual([])
  })

  it('isEvilOfflineRole matches EVIL_OFFLINE_ROLES', () => {
    for (const role of EVIL_OFFLINE_ROLES) {
      expect(isEvilOfflineRole(role)).toBe(true)
    }
    expect(isEvilOfflineRole('villager')).toBe(false)
    expect(isEvilOfflineRole('detective')).toBe(false)
    expect(isEvilOfflineRole('jester')).toBe(false)
  })

  it('maxRedHandedFor stays within the 1..6 band and grows with player count', () => {
    expect(maxRedHandedFor(3)).toBeGreaterThanOrEqual(1)
    expect(maxRedHandedFor(3)).toBeLessThanOrEqual(6)
    expect(maxRedHandedFor(20)).toBe(6)
    expect(maxRedHandedFor(9)).toBeGreaterThanOrEqual(maxRedHandedFor(3))
  })

  it('clampRedHandedCount clamps to [1, maxRedHandedFor(playerCount)]', () => {
    const playerCount = 6
    const max = maxRedHandedFor(playerCount)
    // Signature is (playerCount, requested).
    expect(clampRedHandedCount(playerCount, 0)).toBe(1)
    expect(clampRedHandedCount(playerCount, -5)).toBe(1)
    expect(clampRedHandedCount(playerCount, max + 99)).toBe(max)
    expect(clampRedHandedCount(playerCount, 1)).toBe(1)
  })

  it('getDefaultRedHandedCount returns ≥ 1 across the supported player range', () => {
    for (let p = 3; p <= 20; p++) {
      expect(getDefaultRedHandedCount(p)).toBeGreaterThanOrEqual(1)
    }
  })

  it('computeMaxRoleCounts returns non-negative caps with a zeroed special count', () => {
    const caps = computeMaxRoleCounts(10, 2, ZERO_SPECIAL_COUNTS)
    for (const [role, val] of Object.entries(caps)) {
      expect(val, `${role} cap`).toBeGreaterThanOrEqual(0)
    }
  })
})
