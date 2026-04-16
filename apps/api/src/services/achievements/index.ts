// Central achievement dispatcher. Every route / socket handler that wants to
// fire unlock checks calls evaluateEvent() with an event type and a partial
// context (userId + any event-specific fields). We build the full stats struct
// once, then run every registered evaluator for that event type against it.
//
// unlockAchievements() persists the new rows, emits socket notifications,
// and recurses via evaluateEvent('achievement_unlocked', ...) so meta
// achievements ("unlock 100 achievements") trigger without any extra wiring.
// Recursion is capped at depth 3 to cover at most three chained tiers.

import { prisma } from '../../config/prisma'
import { childLogger } from '../../config/logger'
import { onlineUsers } from '../../socket/onlineUsers'
import { buildUserStats } from './statsCache'
import { EVALUATORS_BY_EVENT } from './registry'

const log = childLogger('achievements')
import type {
  EventContext,
  EventType,
  Evaluator,
  GameEndCtx,
  IO,
  SimpleCtx,
  SocialCtx,
  DailyLoginCtx,
  UserStats,
} from './types'

// ─── Context partial helpers ────────────────────────────────────────────────

interface BasePartial {
  userId: string
}

// A partial context is whatever the caller supplies minus the fields that
// evaluateEvent() will fill in (stats, now, type). We let callers pass any
// extra keys for the specific event (e.g. role, isWinner, newStreakCount).
type EventPartial =
  | ({ userId: string } & Partial<Omit<GameEndCtx, 'stats' | 'now' | 'type' | 'userId'>>)
  | ({ userId: string } & Partial<Omit<SocialCtx, 'stats' | 'now' | 'type' | 'userId'>>)
  | ({ userId: string } & Partial<Omit<DailyLoginCtx, 'stats' | 'now' | 'type' | 'userId'>>)
  | ({ userId: string } & Partial<Omit<SimpleCtx, 'stats' | 'now' | 'type' | 'userId'>>)

function buildCtx(
  type: EventType,
  partial: BasePartial & Record<string, unknown>,
  stats: UserStats,
): EventContext {
  return {
    type,
    now: new Date(),
    stats,
    ...partial,
  } as unknown as EventContext
}

// ─── evaluateEvent ──────────────────────────────────────────────────────────

/**
 * Run every registered evaluator matching `event` against a freshly-built
 * stats struct, upsert the newly-fired rows, and fan out the socket event.
 *
 * @param io         Socket.IO server (nullable for tests / offline flows)
 * @param event      Which event fired
 * @param partial    Event-specific context payload; must include `userId`
 * @param depth      Internal — guards against meta cascades running forever
 */
export async function evaluateEvent(
  io: IO | null,
  event: EventType,
  partial: BasePartial & Record<string, unknown>,
  depth = 0,
): Promise<string[]> {
  if (depth > 3) return [] // depth cap for meta cascades
  const candidates = EVALUATORS_BY_EVENT[event]
  if (!candidates || candidates.length === 0) return []

  const userId = partial.userId
  if (!userId) return []

  try {
    // 1. Fetch stats + already-unlocked keys in parallel.
    const [stats, alreadyUnlocked] = await Promise.all([
      buildUserStats(userId),
      prisma.userAchievement.findMany({
        where: { userId },
        select: { achievement: { select: { key: true } } },
      }),
    ])
    const unlockedKeys = new Set(alreadyUnlocked.map((u) => u.achievement.key))

    // 2. Build the context once; evaluators all read from the frozen struct.
    const ctx = buildCtx(event, partial, stats)

    // 3. Run each candidate evaluator, collect firing keys that are not yet unlocked.
    const firing: string[] = []
    for (const evl of candidates) {
      if (unlockedKeys.has(evl.key)) continue
      try {
        const ok = await evl.check(ctx)
        if (ok) firing.push(evl.key)
      } catch {
        // Skip a bad evaluator — don't fail the whole dispatch.
      }
    }

    if (firing.length === 0) return []

    // 4. Unlock + emit + cascade.
    return await unlockAchievements(io, userId, firing, depth)
  } catch (err) {
    // Never let achievement evaluation throw out to the caller.
    log.error({ err, event, userId }, 'evaluateEvent failed')
    return []
  }
}

// ─── unlockAchievements ─────────────────────────────────────────────────────

/**
 * Persists `claimedAt: null` unlocks, emits `achievement:unlocked` to the
 * affected user's connected socket, and recursively fires the
 * `achievement_unlocked` event for meta cascades.
 *
 * @returns list of keys that were actually newly unlocked (ignoring duplicates)
 */
export async function unlockAchievements(
  io: IO | null,
  userId: string,
  keys: string[],
  depth = 0,
): Promise<string[]> {
  if (keys.length === 0) return []

  // Look up the Achievement rows for the firing keys — we need their ids for
  // the UserAchievement upserts and their metadata for the socket event.
  const achievements = await prisma.achievement.findMany({
    where: { key: { in: keys } },
  })
  if (achievements.length === 0) return []

  const unlockedKeys: string[] = []
  for (const ach of achievements) {
    try {
      // Idempotent insert — the @@unique([userId, achievementId]) catches
      // any race where two events fire at once. `claimedAt` stays null until
      // the user clicks claim.
      const created = await prisma.userAchievement.create({
        data: {
          userId,
          achievementId: ach.id,
          claimedAt: null,
        },
      })
      if (created) unlockedKeys.push(ach.key)
    } catch {
      // already unlocked — ignore
    }
  }

  if (unlockedKeys.length === 0) return []

  log.info({ userId, keys: unlockedKeys, count: unlockedKeys.length }, 'achievements unlocked')

  // Emit socket notifications so the web client can show a toast + invalidate
  // the achievements query. We deliver directly to the user's connected
  // socket (if any) rather than broadcasting.
  if (io) {
    const socketId = onlineUsers.get(userId)
    if (socketId) {
      for (const key of unlockedKeys) {
        const ach = achievements.find((a) => a.key === key)
        if (!ach) continue
        io.to(socketId).emit('achievement:unlocked', {
          key: ach.key,
          name: ach.name,
          icon: ach.icon,
          difficulty: ach.difficulty,
          category: ach.category,
          starsReward: ach.coinReward,
          xpReward: ach.xpReward,
        })
      }
    }
  }

  // Cascade — meta evaluators (collector_N, claimant_N) listen on
  // `achievement_unlocked` and may fire their own unlocks. Depth-capped.
  if (depth < 3) {
    await evaluateEvent(io, 'achievement_unlocked', { userId }, depth + 1)
  }

  return unlockedKeys
}

// Re-export registry primitives so callers can import from one place.
export { DEFAULT_ACHIEVEMENTS, EVALUATORS, REGISTRY_STATS } from './registry'
