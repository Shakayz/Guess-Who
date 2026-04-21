/**
 * fonts.test.ts
 *
 * Pins the WORDMARK_FONT platform selection + useBrandFonts() contract.
 * Two regressions this catches:
 *   - Someone swaps in a web-only font name that silently falls back on
 *     native, breaking the brand look.
 *   - useBrandFonts returns a "loading" state the root layout isn't ready
 *     to handle, holding the splash screen forever.
 *
 * We swap Platform.select on a per-test basis so we can verify each branch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

function mockPlatform(os: 'ios' | 'android' | 'web') {
  vi.doMock('react-native', () => ({
    Platform: {
      OS: os,
      // Match RN's real select behavior: return the platform key, or `default` fallback.
      select: (spec: Record<string, unknown>) => {
        if (os in spec) return spec[os]
        return spec.default
      },
    },
  }))
}

beforeEach(() => {
  vi.resetModules()
  vi.doUnmock('react-native')
})

describe('WORDMARK_FONT', () => {
  it('uses Georgia on iOS (closest built-in serif)', async () => {
    mockPlatform('ios')
    const { WORDMARK_FONT } = await import('../lib/fonts')
    expect(WORDMARK_FONT).toBe('Georgia')
  })

  it('uses system "serif" on Android', async () => {
    mockPlatform('android')
    const { WORDMARK_FONT } = await import('../lib/fonts')
    expect(WORDMARK_FONT).toBe('serif')
  })

  it('falls back to "serif" on any other platform (Expo web)', async () => {
    mockPlatform('web')
    const { WORDMARK_FONT } = await import('../lib/fonts')
    expect(WORDMARK_FONT).toBe('serif')
  })

  it('is never null/undefined — the `!` assertion in lib/fonts.ts is valid', async () => {
    mockPlatform('ios')
    const { WORDMARK_FONT } = await import('../lib/fonts')
    expect(WORDMARK_FONT).toBeTruthy()
  })
})

describe('useBrandFonts', () => {
  it('returns {loaded: true, error: null} so the root layout can release the splash immediately', async () => {
    mockPlatform('ios')
    const { useBrandFonts } = await import('../lib/fonts')
    const result = useBrandFonts()
    expect(result).toEqual({ loaded: true, error: null })
  })

  it('never reports an error until real font loading is wired up', async () => {
    mockPlatform('android')
    const { useBrandFonts } = await import('../lib/fonts')
    expect(useBrandFonts().error).toBeNull()
  })
})
