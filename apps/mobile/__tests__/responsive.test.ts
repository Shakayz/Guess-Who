/**
 * responsive.test.ts
 *
 * The responsive helpers drive every adaptive layout on mobile. A regression
 * that flips tablet → phone (or portrait → landscape) would mean columns,
 * padding, and font scale all misfire silently. We pin the output for the
 * exact breakpoint matrix (≥768 is tablet, width > height is landscape).
 *
 * useResponsive() reads useWindowDimensions from react-native; we stub
 * both with a per-test `mockPlatform(dims)` helper.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

function mockDims(width: number, height: number) {
  vi.doMock('react-native', () => ({
    useWindowDimensions: () => ({ width, height }),
    Platform: { OS: 'ios', select: (s: Record<string, unknown>) => s.ios ?? s.default },
  }))
}

beforeEach(() => {
  vi.resetModules()
  vi.doUnmock('react-native')
})

describe('useResponsive — phone (width < 768)', () => {
  beforeEach(() => mockDims(390, 844)) // iPhone 14 portrait

  it('reports device=phone with the narrow-phone defaults', async () => {
    const { useResponsive } = await import('../lib/responsive')
    const r = useResponsive()
    expect(r.device).toBe('phone')
    expect(r.isTablet).toBe(false)
    expect(r.px).toBe(16)
    expect(r.gridCols).toBe(2)
    expect(r.gridItemWidth).toBe('47%')
    expect(r.fontScale).toBe(1)
    expect(r.tabBarHeight).toBe(60)
    expect(r.contentMax).toBe(390) // on phone, content fills the full width
  })

  it('reports landscape when width > height (even on phone)', async () => {
    vi.resetModules()
    mockDims(844, 390)
    const { useResponsive } = await import('../lib/responsive')
    expect(useResponsive().isLandscape).toBe(true)
  })
})

describe('useResponsive — tablet portrait (width ≥ 768)', () => {
  beforeEach(() => mockDims(820, 1180)) // iPad Air portrait

  it('reports device=tablet with the tablet defaults', async () => {
    const { useResponsive } = await import('../lib/responsive')
    const r = useResponsive()
    expect(r.device).toBe('tablet')
    expect(r.isTablet).toBe(true)
    expect(r.px).toBe(32)
    expect(r.fontScale).toBe(1.15)
    expect(r.tabBarHeight).toBe(72)
    // Tablet layouts cap content width so lines don't become uncomfortably long.
    expect(r.contentMax).toBe(600)
  })

  it('uses 3 columns in tablet portrait (not landscape)', async () => {
    const { useResponsive } = await import('../lib/responsive')
    const r = useResponsive()
    expect(r.isLandscape).toBe(false)
    expect(r.gridCols).toBe(3)
    expect(r.gridItemWidth).toBe('31%')
  })
})

describe('useResponsive — tablet landscape', () => {
  beforeEach(() => mockDims(1180, 820)) // iPad Air landscape

  it('bumps to 4 columns in landscape', async () => {
    const { useResponsive } = await import('../lib/responsive')
    const r = useResponsive()
    expect(r.isTablet).toBe(true)
    expect(r.isLandscape).toBe(true)
    expect(r.gridCols).toBe(4)
    expect(r.gridItemWidth).toBe('23%')
  })
})

describe('useResponsive — breakpoint boundary', () => {
  it('treats width=768 as tablet (inclusive lower bound)', async () => {
    mockDims(768, 1024)
    const { useResponsive } = await import('../lib/responsive')
    expect(useResponsive().isTablet).toBe(true)
  })

  it('treats width=767 as phone (exclusive upper bound of phone)', async () => {
    mockDims(767, 1024)
    const { useResponsive } = await import('../lib/responsive')
    expect(useResponsive().isTablet).toBe(false)
  })
})

describe('responsiveContentStyle', () => {
  beforeEach(() => mockDims(390, 844))

  it('returns an empty object on phone — content is not constrained', async () => {
    const { responsiveContentStyle } = await import('../lib/responsive')
    expect(responsiveContentStyle(false, 390)).toEqual({})
  })

  it('returns a centred max-width=700 style on tablet', async () => {
    const { responsiveContentStyle } = await import('../lib/responsive')
    const style = responsiveContentStyle(true, 820)
    expect(style).toEqual({
      maxWidth: 700,
      alignSelf: 'center',
      width: '100%',
    })
  })
})
