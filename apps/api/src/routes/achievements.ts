import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/prisma'
import { DEFAULT_ACHIEVEMENTS, evaluateEvent, REGISTRY_STATS } from '../services/achievements'

// ─── Achievement routes ──────────────────────────────────────────────────────
// The legacy inline DEFAULT_ACHIEVEMENTS list has been moved to
// `services/achievements/registry.ts` where it combines every evaluator file
// into the full 400-entry catalogue.

// Re-export for legacy tests / imports.
export { DEFAULT_ACHIEVEMENTS }

// Include mythic in the sort order so new-tier cards render alongside diamond.
const DIFFICULTY_ORDER: Record<string, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
  diamond: 4,
  mythic: 5,
}

export const achievementRoutes: FastifyPluginAsync = async (fastify) => {
  // Seed / upsert every achievement definition at boot. Idempotent.
  for (const a of DEFAULT_ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where:  { key: a.key },
      update: {
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: a.category,
        difficulty: a.difficulty,
        xpReward: a.xpReward,
        coinReward: a.coinReward,
        isSecret: a.isSecret ?? false,
      },
      create: {
        key: a.key,
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: a.category,
        difficulty: a.difficulty,
        xpReward: a.xpReward,
        coinReward: a.coinReward,
        isSecret: a.isSecret ?? false,
      },
    }).catch(() => {})
  }

  // Orphan cleanup — remove rows whose keys were retired or renamed in a
  // registry rebalance. UserAchievement has no cascade on Achievement delete,
  // so we delete the user rows first. Without this, stale entries from a
  // previous registry version would keep showing up in the UI as "mystery"
  // achievements users couldn't progress on.
  try {
    const validKeys = new Set(DEFAULT_ACHIEVEMENTS.map((a) => a.key))
    const existing = await prisma.achievement.findMany({ select: { id: true, key: true } })
    const orphanIds = existing.filter((e) => !validKeys.has(e.key)).map((e) => e.id)
    if (orphanIds.length > 0) {
      await prisma.userAchievement.deleteMany({ where: { achievementId: { in: orphanIds } } })
      await prisma.achievement.deleteMany({ where: { id: { in: orphanIds } } })
      fastify.log.info({ removed: orphanIds.length }, '[achievements] removed orphaned keys')
    }
  } catch (err) {
    fastify.log.warn({ err }, '[achievements] orphan cleanup failed (non-fatal)')
  }

  fastify.log.info({
    total: REGISTRY_STATS.totalAchievements,
    byCategory: REGISTRY_STATS.byCategory,
    byDifficulty: REGISTRY_STATS.byDifficulty,
  }, '[achievements] registry seeded')

  // ── GET /api/achievements — full list with per-user unlock/claim state ─────
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub

    const [achievements, userAchievements] = await Promise.all([
      prisma.achievement.findMany({
        orderBy: [{ difficulty: 'asc' }, { category: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.userAchievement.findMany({ where: { userId } }),
    ])

    const unlockedMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua]))

    const result = achievements
      .map((a) => {
        const ua = unlockedMap.get(a.id)
        const unlocked = Boolean(ua)
        const claimed = Boolean(ua?.claimedAt)
        return {
          id: a.id,
          key: a.key,
          name: a.isSecret && !unlocked ? '???' : a.name,
          description: a.isSecret && !unlocked ? '???' : a.description,
          icon: a.isSecret && !unlocked ? '🔒' : a.icon,
          category: a.category,
          difficulty: a.difficulty,
          xpReward: a.xpReward,
          coinReward: a.coinReward,
          starsReward: a.coinReward, // alias used by the new UI
          isSecret: a.isSecret,
          unlocked,
          unlockedAt: ua?.unlockedAt ?? null,
          claimed,
          claimedAt: ua?.claimedAt ?? null,
        }
      })
      .sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 0) - (DIFFICULTY_ORDER[b.difficulty] ?? 0))

    return reply.send(result)
  })

  // ── GET /api/achievements/summary — cheap aggregate for the profile chip ───
  fastify.get('/summary', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const [total, userRows] = await Promise.all([
      prisma.achievement.count(),
      prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: { select: { coinReward: true } } },
      }),
    ])
    const unlocked = userRows.length
    const unclaimed = userRows.filter((r) => r.claimedAt === null)
    const unclaimedCount = unclaimed.length
    const unclaimedStars = unclaimed.reduce((sum, r) => sum + (r.achievement?.coinReward ?? 0), 0)
    return reply.send({ total, unlocked, unclaimedCount, unclaimedStars })
  })

  // ── GET /api/achievements/stats — legacy detailed breakdown ────────────────
  fastify.get('/stats', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub

    const [total, unlocked, byDifficulty, unlockedByDifficulty] = await Promise.all([
      prisma.achievement.count(),
      prisma.userAchievement.count({ where: { userId } }),
      prisma.achievement.groupBy({ by: ['difficulty'], _count: true }),
      prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: { select: { difficulty: true } } },
      }),
    ])

    const unlockedDiffCounts: Record<string, number> = {}
    for (const ua of unlockedByDifficulty) {
      const d = ua.achievement.difficulty
      unlockedDiffCounts[d] = (unlockedDiffCounts[d] ?? 0) + 1
    }

    return reply.send({
      total,
      unlocked,
      percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0,
      byDifficulty: byDifficulty.map((d) => ({
        difficulty: d.difficulty,
        total: d._count,
        unlocked: unlockedDiffCounts[d.difficulty] ?? 0,
      })),
    })
  })

  // ── POST /api/achievements/:key/claim — atomic claim ──────────────────────
  // Sets claimedAt to now and increments the user's starCoins in a single
  // transaction. Uses updateMany with a claimedAt:null filter so two concurrent
  // claim requests cannot both succeed (exactly one row will match).
  fastify.post('/:key/claim', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const { key } = req.params as { key: string }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const ach = await tx.achievement.findUnique({ where: { key } })
        if (!ach) {
          throw Object.assign(new Error('not_found'), { statusCode: 404 })
        }
        const now = new Date()
        const existing = await tx.userAchievement.findUnique({
          where: { userId_achievementId: { userId, achievementId: ach.id } },
        })
        if (!existing) {
          throw Object.assign(new Error('not_unlocked'), { statusCode: 409 })
        }
        if (existing.claimedAt) {
          throw Object.assign(new Error('already_claimed'), { statusCode: 409 })
        }
        const updated = await tx.userAchievement.updateMany({
          where: { userId, achievementId: ach.id, claimedAt: null },
          data:  { claimedAt: now },
        })
        if (updated.count !== 1) {
          throw Object.assign(new Error('already_claimed'), { statusCode: 409 })
        }
        const user = await tx.user.update({
          where: { id: userId },
          data:  { starCoins: { increment: ach.coinReward }, xp: { increment: ach.xpReward } },
          select: { starCoins: true, xp: true },
        })
        return { ach, now, newBalance: user.starCoins }
      })

      // Cascade — fires meta evaluators that listen on `achievement_claimed`.
      evaluateEvent((fastify as any).io ?? null, 'achievement_claimed', { userId }).catch(() => {})

      return reply.send({
        starsGranted: result.ach.coinReward,
        xpGranted: result.ach.xpReward,
        newBalance: result.newBalance,
        claimedAt: result.now,
        achievement: {
          key: result.ach.key,
          name: result.ach.name,
          icon: result.ach.icon,
          difficulty: result.ach.difficulty,
        },
      })
    } catch (err: any) {
      const status = err?.statusCode ?? 500
      const message = err?.message ?? 'internal_error'
      return reply.status(status).send({ error: message })
    }
  })
}
