import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/prisma'

export const seasonPassRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate)

  // GET /api/season-pass/current — current active season pass + user progress
  fastify.get('/current', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const now = new Date()

    const season = await prisma.seasonPass.findFirst({
      where: { startDate: { lte: now }, endDate: { gte: now } },
      include: {
        tiers: { orderBy: { tierNumber: 'asc' } },
      },
    })

    if (!season) return reply.send(null)

    const [user, claims] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { seasonXp: true } }),
      prisma.seasonPassClaim.findMany({
        where: { userId, seasonTier: { seasonPassId: season.id } },
        select: { seasonTierId: true },
      }),
    ])

    const claimedTierIds = new Set(claims.map((c) => c.seasonTierId))

    return reply.send({
      ...season,
      userXp: user?.seasonXp ?? 0,
      tiers: season.tiers.map((t) => ({
        ...t,
        claimed: claimedTierIds.has(t.id),
        unlocked: (user?.seasonXp ?? 0) >= t.xpRequired,
      })),
    })
  })

  // POST /api/season-pass/claim/:tierId — claim a tier reward
  fastify.post('/claim/:tierId', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const { tierId } = req.params as { tierId: string }

    const tier = await prisma.seasonTier.findUnique({
      where: { id: tierId },
      include: { seasonPass: true },
    })
    if (!tier) return reply.status(404).send({ error: 'Tier not found' })

    // Check season is active
    const now = new Date()
    if (tier.seasonPass.startDate > now || tier.seasonPass.endDate < now) {
      return reply.status(400).send({ error: 'Season is not active' })
    }

    // Check user has enough XP
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { seasonXp: true, goldCoins: true } })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    if (user.seasonXp < tier.xpRequired) {
      return reply.status(400).send({ error: 'Not enough season XP' })
    }

    // Check not already claimed
    const existing = await prisma.seasonPassClaim.findUnique({
      where: { userId_seasonTierId: { userId, seasonTierId: tierId } },
    })
    if (existing) return reply.status(409).send({ error: 'Already claimed' })

    // Award reward (goldCoins rewards disabled until premium is ready)
    await prisma.$transaction(async (tx) => {
      await tx.seasonPassClaim.create({ data: { userId, seasonTierId: tierId } })
      if (tier.rewardType === 'starCoins') {
        await tx.user.update({ where: { id: userId }, data: { starCoins: { increment: parseInt(tier.rewardValue) } } })
      } else if (tier.rewardType === 'goldCoins') {
        // TODO: re-enable when premium is ready
        // await tx.user.update({ where: { id: userId }, data: { goldCoins: { increment: parseInt(tier.rewardValue) } } })
      } else if (tier.rewardType === 'cosmetic') {
        await tx.userCosmetic.upsert({
          where: { userId_cosmeticId: { userId, cosmeticId: tier.rewardValue } },
          update: {},
          create: { userId, cosmeticId: tier.rewardValue },
        })
      }
    })

    return reply.send({ success: true, rewardType: tier.rewardType, rewardValue: tier.rewardValue })
  })
}
