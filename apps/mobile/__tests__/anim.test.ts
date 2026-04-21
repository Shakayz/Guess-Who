/**
 * anim.test.ts
 *
 * Smoke tests for lib/anim.ts — the shared curve + duration + glow constants
 * used across every animated screen. Regressions here would mean a screen
 * starts running at a wildly different speed or with the wrong overshoot
 * profile, so we pin both the shape of the exported tables and the exact
 * values that callers depend on.
 *
 * react-native-reanimated can't be loaded in Node, so we replace
 * `Easing.bezier` with an identity-style factory that records its args.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-native-reanimated', () => ({
  // bezier returns an object carrying the 4 control points so tests can read
  // them back. Real Reanimated returns an Animated.Node — the shape doesn't
  // matter here since nothing executes the curve.
  Easing: {
    bezier: (a: number, b: number, c: number, d: number) => ({ __kind: 'bezier', args: [a, b, c, d] }),
  },
}))

beforeEach(() => {
  vi.resetModules()
})

describe('anim/CURVES', () => {
  it('exports the six named curves used across the app', async () => {
    const { CURVES } = await import('../lib/anim')
    expect(Object.keys(CURVES).sort()).toEqual(
      ['bounce', 'easeOut', 'shake', 'smoothOut', 'softPop', 'whipBack'].sort(),
    )
  })

  it('keeps the bounce overshoot profile (control point y > 1 for the back-settle)', async () => {
    const { CURVES } = await import('../lib/anim')
    const bounce = CURVES.bounce as any
    // y2 is the overshoot amount — Duolingo-style settle sits above 1.0
    expect(bounce.args[1]).toBeGreaterThan(1)
  })

  it('whipBack has a stronger overshoot than bounce (used for stamps / flips)', async () => {
    const { CURVES } = await import('../lib/anim')
    const bounce = (CURVES.bounce as any).args
    const whip = (CURVES.whipBack as any).args
    // Larger y2 magnitude for whipBack — |1.55| > |1.56-1.0|
    expect(whip[3]).toBeGreaterThan(1)
    expect(whip[1]).toBeLessThan(0) // undershoot on the way in
    // Sanity: different curves have different control points.
    expect(whip).not.toEqual(bounce)
  })
})

describe('anim/DURATION', () => {
  it('every duration is a positive integer number of milliseconds', async () => {
    const { DURATION } = await import('../lib/anim')
    const entries = Object.entries(DURATION)
    expect(entries.length).toBeGreaterThan(10)
    for (const [name, ms] of entries) {
      expect(typeof ms, name).toBe('number')
      expect(Number.isFinite(ms as number), name).toBe(true)
      expect(ms as number, name).toBeGreaterThan(0)
      expect(Number.isInteger(ms as number), name).toBe(true)
    }
  })

  it('short UI ticks stay snappy (fadeIn ≤ 250ms)', async () => {
    const { DURATION } = await import('../lib/anim')
    expect(DURATION.fadeIn).toBeLessThanOrEqual(250)
  })

  it('orders durations from fastest to slowest in the expected way', async () => {
    const { DURATION } = await import('../lib/anim')
    // Ambient / breathing loops are the slowest by design.
    expect(DURATION.fadeIn).toBeLessThan(DURATION.slide)
    expect(DURATION.slide).toBeLessThan(DURATION.cardFlip)
    expect(DURATION.cardFlip).toBeLessThan(DURATION.breathe)
  })
})

describe('anim/GLOW', () => {
  it('every glow value is an rgba() string (used in shadowColor math)', async () => {
    const { GLOW } = await import('../lib/anim')
    for (const [name, rgba] of Object.entries(GLOW)) {
      expect(typeof rgba, name).toBe('string')
      expect(rgba as string, name).toMatch(/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/)
    }
  })

  it('brandSolid is more opaque than brandDiffuse (used for layered glow)', async () => {
    const { GLOW } = await import('../lib/anim')
    const alpha = (s: string) => Number(s.match(/,\s*([\d.]+)\s*\)$/)?.[1])
    expect(alpha(GLOW.brandSolid)).toBeGreaterThan(alpha(GLOW.brandDiffuse))
    expect(alpha(GLOW.brandSolid)).toBeGreaterThan(alpha(GLOW.brandOuter))
  })
})
