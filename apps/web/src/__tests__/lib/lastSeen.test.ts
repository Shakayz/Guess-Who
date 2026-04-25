/**
 * lastSeen.test.ts
 *
 * Covers the relative-time formatter that the profile header and DM panel
 * use to render "last seen". The branching is purely date-arithmetic, so we
 * pin Date.now() to a known instant and feed in ISO strings at each
 * threshold to confirm the right i18n key + count is requested.
 *
 * The formatter delegates the actual translation to i18next, so we just
 * spy on `t()` and assert the *call shape* — the test is about routing,
 * not about the rendered string.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatLastSeen } from '../../lib/lastSeen'

const NOW = new Date('2026-04-25T12:00:00.000Z').getTime()

function makeT() {
  // Echo the (key, opts) tuple as the result so we can inspect both at the
  // call site in a single assertion.
  return vi.fn((key: string, opts?: Record<string, unknown>) =>
    opts && 'count' in opts ? `${key}|${opts.count}` : key,
  )
}

describe('formatLastSeen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" key when seen less than a minute ago', () => {
    const t = makeT()
    const iso = new Date(NOW - 30_000).toISOString() // 30 s ago
    expect(formatLastSeen(iso, t as any)).toBe('profile.lastSeenJustNow')
    expect(t).toHaveBeenCalledWith('profile.lastSeenJustNow')
  })

  it('returns the minutes key with count for under-an-hour absences', () => {
    const t = makeT()
    const iso = new Date(NOW - 5 * 60_000).toISOString()
    expect(formatLastSeen(iso, t as any)).toBe('profile.lastSeenMinutes|5')
    expect(t).toHaveBeenCalledWith('profile.lastSeenMinutes', { count: 5 })
  })

  it('returns the hours key when between 1 and 24 hours ago', () => {
    const t = makeT()
    const iso = new Date(NOW - 3 * 60 * 60_000).toISOString()
    expect(formatLastSeen(iso, t as any)).toBe('profile.lastSeenHours|3')
    expect(t).toHaveBeenCalledWith('profile.lastSeenHours', { count: 3 })
  })

  it('returns the days key when between 1 and 30 days ago', () => {
    const t = makeT()
    const iso = new Date(NOW - 5 * 24 * 60 * 60_000).toISOString()
    expect(formatLastSeen(iso, t as any)).toBe('profile.lastSeenDays|5')
    expect(t).toHaveBeenCalledWith('profile.lastSeenDays', { count: 5 })
  })

  it('returns "long ago" once the gap exceeds 30 days', () => {
    const t = makeT()
    const iso = new Date(NOW - 45 * 24 * 60 * 60_000).toISOString()
    expect(formatLastSeen(iso, t as any)).toBe('profile.lastSeenLongAgo')
    expect(t).toHaveBeenCalledWith('profile.lastSeenLongAgo')
  })

  it('rounds DOWN to the floor of the unit (59 min stays in the minutes bucket)', () => {
    const t = makeT()
    const iso = new Date(NOW - 59 * 60_000 - 30_000).toISOString()
    expect(formatLastSeen(iso, t as any)).toBe('profile.lastSeenMinutes|59')
  })

  it('boundary: exactly 60 minutes flips to the hours bucket', () => {
    const t = makeT()
    const iso = new Date(NOW - 60 * 60_000).toISOString()
    expect(formatLastSeen(iso, t as any)).toBe('profile.lastSeenHours|1')
  })

  it('boundary: exactly 24 hours flips to the days bucket', () => {
    const t = makeT()
    const iso = new Date(NOW - 24 * 60 * 60_000).toISOString()
    expect(formatLastSeen(iso, t as any)).toBe('profile.lastSeenDays|1')
  })

  it('boundary: exactly 30 days flips to the long-ago bucket', () => {
    const t = makeT()
    const iso = new Date(NOW - 30 * 24 * 60 * 60_000).toISOString()
    expect(formatLastSeen(iso, t as any)).toBe('profile.lastSeenLongAgo')
  })
})
