import { prisma } from '../config/prisma'
import { childLogger } from '../config/logger'

const log = childLogger('dailyRewards')

// ─── Economy constants ───────────────────────────────────────────────────────
// Kept in one place so the UI and the unit tests can reference them if needed.

/** Star cost to start (or join) an online game. Offline play is free. */
export const DAILY_COST = 10

/** Star bonus credited on the first finished online game of a UTC day. */
export const DAILY_BONUS = 20

/** Extra star bonus every time the streak hits a multiple of STREAK_INTERVAL. */
export const STREAK_BONUS = 100

/** Number of consecutive days that triggers STREAK_BONUS. */
export const STREAK_INTERVAL: number = 7

// ─── Day-key helpers (UTC) ───────────────────────────────────────────────────
// We intentionally use UTC instead of user timezone — keeps the server logic
// simple and tests deterministic. Documented in the plan.

/** Returns the UTC calendar day as "YYYY-MM-DD". */
export function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Returns true if the two dates fall on consecutive UTC calendar days. */
function isConsecutiveUtcDay(prev: Date, next: Date): boolean {
  const prevKey = utcDayKey(prev)
  const nextDate = new Date(next)
  nextDate.setUTCDate(nextDate.getUTCDate() - 1)
  return utcDayKey(nextDate) === prevKey
}

// ─── Core transition used by both the runtime and the unit tests ─────────────

export interface StreakTransition {
  /** 0 or DAILY_BONUS */
  dailyBonusEarned: number
  /** 0 or STREAK_BONUS */
  streakBonusEarned: number
  /** New rolling consecutive-day streak count */
  newStreakCount: number
  /** Whether we need to persist new streak/lastPlayedAt values */
  shouldPersist: boolean
}

/**
 * Pure function: given the previous lastPlayedAt + streak and a "now" value,
 * returns the transition to apply. Pulled out so it can be unit-tested without
 * touching the database.
 */
export function computeStreakTransition(
  prevLastPlayedAt: Date | null,
  prevStreakCount: number,
  now: Date,
): StreakTransition {
  if (!prevLastPlayedAt) {
    // First online game ever
    return {
      dailyBonusEarned: DAILY_BONUS,
      streakBonusEarned: STREAK_INTERVAL === 1 ? STREAK_BONUS : 0,
      newStreakCount: 1,
      shouldPersist: true,
    }
  }

  const prevKey = utcDayKey(prevLastPlayedAt)
  const nowKey = utcDayKey(now)

  if (prevKey === nowKey) {
    // Already played today — no bonus, no streak change.
    return {
      dailyBonusEarned: 0,
      streakBonusEarned: 0,
      newStreakCount: prevStreakCount,
      shouldPersist: false,
    }
  }

  const newStreak = isConsecutiveUtcDay(prevLastPlayedAt, now)
    ? prevStreakCount + 1
    : 1

  const streakBonus =
    newStreak > 0 && newStreak % STREAK_INTERVAL === 0 ? STREAK_BONUS : 0

  return {
    dailyBonusEarned: DAILY_BONUS,
    streakBonusEarned: streakBonus,
    newStreakCount: newStreak,
    shouldPersist: true,
  }
}

// ─── Runtime: credit a player's end-of-game rewards ──────────────────────────

export interface AppliedRewards {
  baseStarCoinsEarned: number
  dailyBonusEarned: number
  streakBonusEarned: number
  newStreakCount: number
}

/**
 * Credits a player's end-of-game rewards atomically in one transaction:
 *   - base starCoinsEarned (role/winner-aware, computed by the caller)
 *   - +DAILY_BONUS if this is the first finished online game of the UTC day
 *   - +STREAK_BONUS if the new streak hits a multiple of STREAK_INTERVAL
 *
 * Also updates `lastPlayedAt` and `dailyStreakCount` in the same transaction
 * so concurrent game endings for the same user can't double-credit the day.
 */
const ZERO_REWARDS: AppliedRewards = {
  baseStarCoinsEarned: 0,
  dailyBonusEarned: 0,
  streakBonusEarned: 0,
  newStreakCount: 0,
}

export async function applyGameEndRewards(
  userId: string,
  baseStarCoins: number,
  now: Date = new Date(),
): Promise<AppliedRewards> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { lastPlayedAt: true, dailyStreakCount: true },
      })

      if (!user) {
        log.warn({ userId }, 'applyGameEndRewards: user not found, skipping')
        return ZERO_REWARDS
      }

      const transition = computeStreakTransition(
        user.lastPlayedAt,
        user.dailyStreakCount,
        now,
      )

      const totalCredit =
        baseStarCoins + transition.dailyBonusEarned + transition.streakBonusEarned

      await tx.user.update({
        where: { id: userId },
        data: {
          starCoins: { increment: totalCredit },
          ...(transition.shouldPersist
            ? {
                lastPlayedAt: now,
                dailyStreakCount: transition.newStreakCount,
              }
            : {}),
        },
      })

      return {
        baseStarCoinsEarned: baseStarCoins,
        dailyBonusEarned: transition.dailyBonusEarned,
        streakBonusEarned: transition.streakBonusEarned,
        newStreakCount: transition.newStreakCount,
      }
    })
    // Defensive fallback — tests stub prisma.$transaction as a bare vi.fn()
    // that resolves to `undefined`; without this guard the per-player loop in
    // finishGameWithWinner would crash with "Cannot read properties of
    // undefined".
    return result ?? ZERO_REWARDS
  } catch (err) {
    log.error({ err, userId }, 'applyGameEndRewards transaction failed')
    return ZERO_REWARDS
  }
}
