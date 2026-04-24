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
  /**
   * Always 0 — the +20 daily bonus moved to login (see `grantDailyLoginBonus`).
   * Kept on the payload so the `game:finished` wire shape and the reveal-card
   * prop don't break for clients on an older build; the reveal card hides the
   * row when the value is 0.
   */
  dailyBonusEarned: number
  streakBonusEarned: number
  newStreakCount: number
  /**
   * True when this game advanced the PLAY streak (first finished game of a
   * new UTC day). Drives the `daily_login` achievement event — which used to
   * be gated on `dailyBonusEarned > 0` back when that fired at game end.
   */
  streakTicked: boolean
}

/**
 * Credits a player's end-of-game rewards atomically in one transaction:
 *   - base starCoinsEarned (role/winner-aware, computed by the caller)
 *   - +STREAK_BONUS if the new streak hits a multiple of STREAK_INTERVAL
 *
 * Also updates `lastPlayedAt` and `dailyStreakCount` in the same transaction
 * so concurrent game endings for the same user can't double-advance the
 * streak. The +20 daily bonus is NOT credited here — see
 * `grantDailyLoginBonus`, which runs on `/auth/me`.
 */
const ZERO_REWARDS: AppliedRewards = {
  baseStarCoinsEarned: 0,
  dailyBonusEarned: 0,
  streakBonusEarned: 0,
  newStreakCount: 0,
  streakTicked: false,
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

      // Login grants the +20 bonus now, so game-end only credits base +
      // streak bonus. `transition.dailyBonusEarned` is still produced by the
      // pure function (it doubles as the "first play of a new UTC day"
      // signal) but we intentionally ignore it for the credit.
      const totalCredit = baseStarCoins + transition.streakBonusEarned

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
        dailyBonusEarned: 0,
        streakBonusEarned: transition.streakBonusEarned,
        newStreakCount: transition.newStreakCount,
        streakTicked: transition.shouldPersist,
      }
    })
    // Defensive fallback — tests stub prisma.$transaction as a bare vi.fn()
    // that resolves to `undefined`; without this guard the per-player loop in
    // finishGameWithWinner would crash with "Cannot read properties of
    // undefined".
    const applied = result ?? ZERO_REWARDS
    if (applied.streakBonusEarned > 0) {
      log.info(
        {
          userId,
          baseStarCoins: applied.baseStarCoinsEarned,
          streakBonus: applied.streakBonusEarned,
          newStreakCount: applied.newStreakCount,
        },
        'game-end rewards applied with streak bonus',
      )
    }
    return applied
  } catch (err) {
    log.error({ err, userId }, 'applyGameEndRewards transaction failed')
    return ZERO_REWARDS
  }
}

// ─── Login-based daily bonus ─────────────────────────────────────────────────

export interface LoginBonusResult {
  /** 0 or DAILY_BONUS */
  bonusGranted: number
}

/**
 * Credits the +20 daily login bonus the first time a user is seen on a given
 * UTC day. Designed to be called from `/auth/me` on every request — the
 * conditional `updateMany` makes it a no-op after the first call of the day,
 * and the WHERE clause is atomic so concurrent tabs can't double-credit.
 *
 * Separate from `applyGameEndRewards` so a player who's spent down to <10 ⭐
 * (below the entry fee) can still recover: logging in tomorrow credits +20
 * and unlocks play. The 7-day streak bonus remains tied to actually finishing
 * games and lives in `applyGameEndRewards`.
 */
export async function grantDailyLoginBonus(
  userId: string,
  now: Date = new Date(),
): Promise<LoginBonusResult> {
  try {
    // Start of the current UTC day. The WHERE clause credits the bonus iff
    // the user has never received it, OR the last receipt was on a prior day.
    const startOfDayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    )
    const res = await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [
          { lastDailyBonusAt: null },
          { lastDailyBonusAt: { lt: startOfDayUtc } },
        ],
      },
      data: {
        starCoins: { increment: DAILY_BONUS },
        lastDailyBonusAt: now,
      },
    })
    if (res.count > 0) {
      log.info({ userId, bonus: DAILY_BONUS }, 'daily login bonus credited')
      return { bonusGranted: DAILY_BONUS }
    }
    return { bonusGranted: 0 }
  } catch (err) {
    log.error({ err, userId }, 'grantDailyLoginBonus failed')
    return { bonusGranted: 0 }
  }
}
