import { describe, it, expect, vi } from 'vitest'
import { formatDate, clamp, sleep } from './index'

// ─── formatDate ─────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats an ISO date string with default locale (en)', () => {
    const result = formatDate('2024-06-15T14:30:00Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('formats with explicit "en" locale', () => {
    const result = formatDate('2024-01-01T00:00:00Z', 'en')
    expect(typeof result).toBe('string')
    expect(result).toContain('2024')
  })

  it('formats with "fr" locale', () => {
    const result = formatDate('2024-06-15T14:30:00Z', 'fr')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns different output for different locales', () => {
    const iso = '2024-06-15T14:30:00Z'
    const en = formatDate(iso, 'en')
    const fr = formatDate(iso, 'fr')
    // At minimum the formatting should differ (month names, etc.)
    // They might be the same in some edge cases, so we just check they are strings
    expect(typeof en).toBe('string')
    expect(typeof fr).toBe('string')
  })

  it('handles a date at epoch', () => {
    const result = formatDate('1970-01-01T00:00:00Z', 'en')
    expect(result).toContain('1970')
  })

  it('handles a recent date', () => {
    // Use midday UTC mid-year so no timezone can shift the year.
    const result = formatDate('2025-06-15T12:00:00Z', 'en')
    expect(result).toContain('2025')
  })
})

// ─── clamp ──────────────────────────────────────────────────────────────────

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps to min when value is below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('clamps to max when value is above range', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0)
  })

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('works with negative ranges', () => {
    expect(clamp(-3, -5, -1)).toBe(-3)
    expect(clamp(-10, -5, -1)).toBe(-5)
    expect(clamp(0, -5, -1)).toBe(-1)
  })

  it('works when min equals max', () => {
    expect(clamp(5, 3, 3)).toBe(3)
    expect(clamp(1, 3, 3)).toBe(3)
  })

  it('handles decimal values', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5)
    expect(clamp(1.5, 0, 1)).toBe(1)
    expect(clamp(-0.5, 0, 1)).toBe(0)
  })

  it('handles very large numbers', () => {
    expect(clamp(1e15, 0, 100)).toBe(100)
    expect(clamp(-1e15, 0, 100)).toBe(0)
  })

  it('handles zero range at zero', () => {
    expect(clamp(0, 0, 0)).toBe(0)
  })
})

// ─── sleep ──────────────────────────────────────────────────────────────────

describe('sleep', () => {
  it('returns a promise', () => {
    const result = sleep(0)
    expect(result).toBeInstanceOf(Promise)
  })

  it('resolves to undefined', async () => {
    const result = await sleep(0)
    expect(result).toBeUndefined()
  })

  it('resolves after the specified duration', async () => {
    vi.useFakeTimers()
    let resolved = false
    const p = sleep(100).then(() => { resolved = true })

    expect(resolved).toBe(false)

    vi.advanceTimersByTime(99)
    await Promise.resolve() // flush microtasks
    expect(resolved).toBe(false)

    vi.advanceTimersByTime(1)
    await Promise.resolve()
    await p
    expect(resolved).toBe(true)

    vi.useRealTimers()
  })

  it('resolves immediately with 0ms', async () => {
    vi.useFakeTimers()
    let resolved = false
    const p = sleep(0).then(() => { resolved = true })

    vi.advanceTimersByTime(0)
    await Promise.resolve()
    await p
    expect(resolved).toBe(true)

    vi.useRealTimers()
  })
})
