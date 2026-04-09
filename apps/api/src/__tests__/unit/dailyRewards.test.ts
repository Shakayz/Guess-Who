import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/config/prisma'
import {
  computeStreakTransition,
  applyGameEndRewards,
  DAILY_COST,
  DAILY_BONUS,
  STREAK_BONUS,
  STREAK_INTERVAL,
  utcDayKey,
} from '@/services/dailyRewards'

// ─── Pure streak-transition logic ─────────────────────────────────────────────
// These tests don't touch the database — they exercise the math that decides
// whether a bonus is owed and how the streak counter moves.

describe('computeStreakTransition', () => {
  const noon = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

  it('credits daily bonus + starts streak at 1 on the first-ever play', () => {
    const now = noon('2026-04-09')
    const t = computeStreakTransition(null, 0, now)
    expect(t.dailyBonusEarned).toBe(DAILY_BONUS)
    expect(t.streakBonusEarned).toBe(0)
    expect(t.newStreakCount).toBe(1)
    expect(t.shouldPersist).toBe(true)
  })

  it('gives no bonus when the user already played today (UTC)', () => {
    const prev = noon('2026-04-09')
    const now = new Date('2026-04-09T23:58:00.000Z')
    const t = computeStreakTransition(prev, 3, now)
    expect(t.dailyBonusEarned).toBe(0)
    expect(t.streakBonusEarned).toBe(0)
    expect(t.newStreakCount).toBe(3) // unchanged
    expect(t.shouldPersist).toBe(false)
  })

  it('increments streak on a consecutive UTC day', () => {
    const prev = noon('2026-04-09')
    const now = noon('2026-04-10')
    const t = computeStreakTransition(prev, 3, now)
    expect(t.dailyBonusEarned).toBe(DAILY_BONUS)
    expect(t.streakBonusEarned).toBe(0)
    expect(t.newStreakCount).toBe(4)
    expect(t.shouldPersist).toBe(true)
  })

  it('resets streak to 1 when there is a gap of 2+ days', () => {
    const prev = noon('2026-04-09')
    const now = noon('2026-04-12') // 3-day gap
    const t = computeStreakTransition(prev, 5, now)
    expect(t.dailyBonusEarned).toBe(DAILY_BONUS)
    expect(t.streakBonusEarned).toBe(0)
    expect(t.newStreakCount).toBe(1)
    expect(t.shouldPersist).toBe(true)
  })

  it(`awards streak bonus when the streak hits ${STREAK_INTERVAL} days`, () => {
    const prev = noon('2026-04-09')
    const now = noon('2026-04-10')
    const t = computeStreakTransition(prev, STREAK_INTERVAL - 1, now)
    expect(t.dailyBonusEarned).toBe(DAILY_BONUS)
    expect(t.streakBonusEarned).toBe(STREAK_BONUS)
    expect(t.newStreakCount).toBe(STREAK_INTERVAL)
    expect(t.shouldPersist).toBe(true)
  })

  it(`re-awards streak bonus at every multiple of ${STREAK_INTERVAL} (14, 21, …)`, () => {
    const prev = noon('2026-04-09')
    const now = noon('2026-04-10')
    const t = computeStreakTransition(prev, 13, now)
    expect(t.streakBonusEarned).toBe(STREAK_BONUS)
    expect(t.newStreakCount).toBe(14)
  })

  it('does not award streak bonus on non-multiples of the interval', () => {
    const prev = noon('2026-04-09')
    const now = noon('2026-04-10')
    const t = computeStreakTransition(prev, 5, now)
    expect(t.streakBonusEarned).toBe(0)
    expect(t.newStreakCount).toBe(6)
  })

  it('handles the midnight UTC edge: play at 23:59:59Z then 00:00:01Z next day', () => {
    const prev = new Date('2026-04-09T23:59:59.000Z')
    const now = new Date('2026-04-10T00:00:01.000Z')
    const t = computeStreakTransition(prev, 2, now)
    expect(t.dailyBonusEarned).toBe(DAILY_BONUS)
    expect(t.newStreakCount).toBe(3)
  })
})

describe('utcDayKey', () => {
  it('formats a date as YYYY-MM-DD in UTC regardless of local tz', () => {
    expect(utcDayKey(new Date('2026-04-09T00:00:00.000Z'))).toBe('2026-04-09')
    expect(utcDayKey(new Date('2026-04-09T23:59:59.999Z'))).toBe('2026-04-09')
    expect(utcDayKey(new Date('2026-04-10T00:00:00.000Z'))).toBe('2026-04-10')
  })
})

// ─── Economy constants sanity ─────────────────────────────────────────────────
// Lightweight check so a typo in the plan-agreed numbers can't slip through.

describe('economy constants', () => {
  it('matches the values agreed in the plan', () => {
    expect(DAILY_COST).toBe(10)
    expect(DAILY_BONUS).toBe(20)
    expect(STREAK_BONUS).toBe(100)
    expect(STREAK_INTERVAL).toBe(7)
  })
})

// ─── applyGameEndRewards: DB interaction ──────────────────────────────────────
// We mock prisma.$transaction to run the callback with a fake `tx` object so
// we can assert on the update payload without hitting a real database.

describe('applyGameEndRewards', () => {
  const mockPrismaUser = prisma.user as any
  const mockTx = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma as any).$transaction = vi.fn(async (fn: any) => fn(mockTx))
  })

  it('credits base + daily bonus on first-ever game and updates streak/lastPlayedAt', async () => {
    mockTx.user.findUnique.mockResolvedValue({
      lastPlayedAt: null,
      dailyStreakCount: 0,
    })
    mockTx.user.update.mockResolvedValue({})

    const now = new Date('2026-04-09T12:00:00.000Z')
    const result = await applyGameEndRewards('user-1', 50, now)

    expect(result).toEqual({
      baseStarCoinsEarned: 50,
      dailyBonusEarned: DAILY_BONUS,
      streakBonusEarned: 0,
      newStreakCount: 1,
    })
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        starCoins: { increment: 50 + DAILY_BONUS },
        lastPlayedAt: now,
        dailyStreakCount: 1,
      },
    })
  })

  it('credits only the base reward (no bonus) when the user already played today', async () => {
    const now = new Date('2026-04-09T18:00:00.000Z')
    mockTx.user.findUnique.mockResolvedValue({
      lastPlayedAt: new Date('2026-04-09T08:00:00.000Z'),
      dailyStreakCount: 4,
    })
    mockTx.user.update.mockResolvedValue({})

    const result = await applyGameEndRewards('user-1', 80, now)

    expect(result.dailyBonusEarned).toBe(0)
    expect(result.streakBonusEarned).toBe(0)
    expect(result.newStreakCount).toBe(4)
    // Streak/lastPlayedAt must NOT be touched when the day hasn't changed.
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { starCoins: { increment: 80 } },
    })
  })

  it('credits base + daily + streak bonus when the player hits day 7', async () => {
    mockTx.user.findUnique.mockResolvedValue({
      lastPlayedAt: new Date('2026-04-08T12:00:00.000Z'),
      dailyStreakCount: 6,
    })
    mockTx.user.update.mockResolvedValue({})

    const now = new Date('2026-04-09T12:00:00.000Z')
    const result = await applyGameEndRewards('user-1', 50, now)

    expect(result.dailyBonusEarned).toBe(DAILY_BONUS)
    expect(result.streakBonusEarned).toBe(STREAK_BONUS)
    expect(result.newStreakCount).toBe(7)
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        starCoins: { increment: 50 + DAILY_BONUS + STREAK_BONUS },
        lastPlayedAt: now,
        dailyStreakCount: 7,
      },
    })
  })

  it('returns zeroed rewards if the user is missing and does not throw', async () => {
    mockTx.user.findUnique.mockResolvedValue(null)

    const result = await applyGameEndRewards('ghost-user', 50)

    expect(result).toEqual({
      baseStarCoinsEarned: 0,
      dailyBonusEarned: 0,
      streakBonusEarned: 0,
      newStreakCount: 0,
    })
    expect(mockTx.user.update).not.toHaveBeenCalled()
  })

  it('swallows transaction errors and returns zeroed rewards', async () => {
    ;(prisma as any).$transaction = vi.fn(async () => {
      throw new Error('db down')
    })

    const result = await applyGameEndRewards('user-1', 50)

    expect(result).toEqual({
      baseStarCoinsEarned: 0,
      dailyBonusEarned: 0,
      streakBonusEarned: 0,
      newStreakCount: 0,
    })
    // Silence unused-var lint for the mocked user.
    expect(mockPrismaUser).toBeDefined()
  })
})
