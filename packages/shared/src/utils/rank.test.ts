import { describe, it, expect } from 'vitest'
import { getTierFromLP, computeRankUpdate } from './rank'

// ─── getTierFromLP ──────────────────────────────────────────────────────────

describe('getTierFromLP', () => {
  it('returns "wooden" for LP 0', () => {
    expect(getTierFromLP(0)).toBe('wooden')
  })

  it('returns "wooden" for LP 99', () => {
    expect(getTierFromLP(99)).toBe('wooden')
  })

  it('returns "bronze" for LP 100', () => {
    expect(getTierFromLP(100)).toBe('bronze')
  })

  it('returns "bronze" for LP 199', () => {
    expect(getTierFromLP(199)).toBe('bronze')
  })

  it('returns "silver" for LP 200', () => {
    expect(getTierFromLP(200)).toBe('silver')
  })

  it('returns "silver" for LP 299', () => {
    expect(getTierFromLP(299)).toBe('silver')
  })

  it('returns "gold" for LP 300', () => {
    expect(getTierFromLP(300)).toBe('gold')
  })

  it('returns "gold" for LP 399', () => {
    expect(getTierFromLP(399)).toBe('gold')
  })

  it('returns "diamond" for LP 400', () => {
    expect(getTierFromLP(400)).toBe('diamond')
  })

  it('returns "master" for LP 500', () => {
    expect(getTierFromLP(500)).toBe('master')
  })

  it('returns "grandmaster" for LP 600', () => {
    expect(getTierFromLP(600)).toBe('grandmaster')
  })

  it('returns "grandmaster" for very high LP', () => {
    expect(getTierFromLP(9999)).toBe('grandmaster')
  })

  it('returns "wooden" for negative LP', () => {
    // Defensive: negative values should still resolve to lowest tier
    expect(getTierFromLP(-10)).toBe('wooden')
  })
})

// ─── computeRankUpdate ──────────────────────────────────────────────────────

describe('computeRankUpdate', () => {
  it('stays in same tier with small positive delta', () => {
    const result = computeRankUpdate(50, 10)
    expect(result).toEqual({
      newLP: 60,
      newTier: 'wooden',
      promoted: false,
      demoted: false,
    })
  })

  it('promotes from wooden to bronze at LP 100', () => {
    const result = computeRankUpdate(90, 10)
    expect(result).toEqual({
      newLP: 100,
      newTier: 'bronze',
      promoted: true,
      demoted: false,
    })
  })

  it('promotes from bronze to silver', () => {
    const result = computeRankUpdate(195, 10)
    expect(result).toEqual({
      newLP: 205,
      newTier: 'silver',
      promoted: true,
      demoted: false,
    })
  })

  it('demotes from bronze to wooden', () => {
    const result = computeRankUpdate(105, -10)
    expect(result).toEqual({
      newLP: 95,
      newTier: 'wooden',
      promoted: false,
      demoted: true,
    })
  })

  it('demotes from silver to bronze', () => {
    const result = computeRankUpdate(200, -5)
    expect(result).toEqual({
      newLP: 195,
      newTier: 'bronze',
      promoted: false,
      demoted: true,
    })
  })

  it('clamps LP to 0 minimum', () => {
    const result = computeRankUpdate(10, -50)
    expect(result.newLP).toBe(0)
    expect(result.newTier).toBe('wooden')
    expect(result.demoted).toBe(false) // was already wooden
  })

  it('clamps LP to 0 when already at 0', () => {
    const result = computeRankUpdate(0, -100)
    expect(result.newLP).toBe(0)
    expect(result.newTier).toBe('wooden')
    expect(result.promoted).toBe(false)
    expect(result.demoted).toBe(false)
  })

  it('promotes multiple tiers in one jump', () => {
    const result = computeRankUpdate(50, 300)
    expect(result.newLP).toBe(350)
    expect(result.newTier).toBe('gold')
    expect(result.promoted).toBe(true)
    expect(result.demoted).toBe(false)
  })

  it('demotes multiple tiers in one big loss', () => {
    const result = computeRankUpdate(400, -250)
    expect(result.newLP).toBe(150)
    expect(result.newTier).toBe('bronze')
    expect(result.promoted).toBe(false)
    expect(result.demoted).toBe(true)
  })

  it('no change with zero delta', () => {
    const result = computeRankUpdate(250, 0)
    expect(result).toEqual({
      newLP: 250,
      newTier: 'silver',
      promoted: false,
      demoted: false,
    })
  })

  it('handles promotion to grandmaster', () => {
    const result = computeRankUpdate(590, 20)
    expect(result.newLP).toBe(610)
    expect(result.newTier).toBe('grandmaster')
    expect(result.promoted).toBe(true)
  })

  it('handles demotion from grandmaster', () => {
    const result = computeRankUpdate(610, -15)
    expect(result.newLP).toBe(595)
    expect(result.newTier).toBe('master')
    expect(result.demoted).toBe(true)
  })

  it('stays in wooden with negative delta that does not go below 0', () => {
    const result = computeRankUpdate(50, -30)
    expect(result).toEqual({
      newLP: 20,
      newTier: 'wooden',
      promoted: false,
      demoted: false,
    })
  })
})
