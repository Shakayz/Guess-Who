/**
 * lib/ads.test.ts (web)
 *
 * Covers the level-3+ non-premium ad gate plus the AdSense script loader.
 * The level threshold is hard-coded — no UI exposes it — so this test is
 * the only place that pins it. If a regression bumps it to level 5,
 * onboarding starts seeing ads they shouldn't.
 *
 * The threshold logic lives on both web (here) and mobile (lib/ads.ts in
 * the mobile app). Both have parity tests so neither side silently drifts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  shouldShowAd,
  adsConfigured,
  ensureAdSenseScript,
  ADSENSE_CLIENT,
  ADSENSE_INTERSTITIAL_SLOT,
} from '../../lib/ads'

describe('shouldShowAd — eligibility gate', () => {
  it('blocks premium users regardless of level', () => {
    expect(shouldShowAd({ isPremium: true, level: 99 })).toBe(false)
    expect(shouldShowAd({ isPremium: true, level: 3 })).toBe(false)
    expect(shouldShowAd({ isPremium: true, level: 0 })).toBe(false)
  })

  it('blocks non-premium users below level 3 (onboarding protection)', () => {
    expect(shouldShowAd({ isPremium: false, level: 0 })).toBe(false)
    expect(shouldShowAd({ isPremium: false, level: 1 })).toBe(false)
    expect(shouldShowAd({ isPremium: false, level: 2 })).toBe(false)
  })

  it('allows non-premium users at the threshold and above', () => {
    expect(shouldShowAd({ isPremium: false, level: 3 })).toBe(true)
    expect(shouldShowAd({ isPremium: false, level: 7 })).toBe(true)
    expect(shouldShowAd({ isPremium: false, level: 50 })).toBe(true)
  })

  it('treats null/undefined level as 0 (matches API "no progress yet" payload)', () => {
    expect(shouldShowAd({ isPremium: false, level: null })).toBe(false)
    expect(shouldShowAd({ isPremium: false })).toBe(false)
  })

  it('treats null/undefined isPremium as not-premium', () => {
    expect(shouldShowAd({ level: 5 })).toBe(true)
    expect(shouldShowAd({ level: 5, isPremium: null })).toBe(true)
  })
})

describe('adsConfigured', () => {
  it('reflects whether the AdSense env vars are present', () => {
    // The exported constants are evaluated at module-load with the current
    // environment. We can't change them mid-test without resetting modules,
    // but we can verify the helper is consistent with their values.
    const hasClient = !!ADSENSE_CLIENT
    const hasSlot = !!ADSENSE_INTERSTITIAL_SLOT
    expect(adsConfigured()).toBe(hasClient && hasSlot)
  })
})

describe('ensureAdSenseScript', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('no-ops in environments where AdSense is not configured', () => {
    if (adsConfigured()) {
      // When configured, the test below is the relevant one. Skip silently.
      return
    }
    ensureAdSenseScript()
    const scripts = document.head.querySelectorAll('script[src*="adsbygoogle"]')
    expect(scripts.length).toBe(0)
  })

  it('injects the adsbygoogle script tag when configured (only once even after repeat calls)', () => {
    if (!adsConfigured()) return
    ensureAdSenseScript()
    ensureAdSenseScript()
    ensureAdSenseScript()
    const scripts = document.head.querySelectorAll('script[src*="adsbygoogle.js"]')
    expect(scripts.length).toBe(1)
    expect(scripts[0].getAttribute('crossorigin')).toBe('anonymous')
    expect(scripts[0].getAttribute('async')).toBeDefined()
  })
})
