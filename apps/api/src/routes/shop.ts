import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/prisma'
import { GOLD_COIN_PACKS } from '@imposter/shared'

export const shopRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/cosmetics', async (req, reply) => {
    const cosmetics = await prisma.cosmetic.findMany({ orderBy: { createdAt: 'desc' } })
    return reply.send(cosmetics)
  })

  fastify.get('/packs', async (_req, reply) => {
    return reply.send(GOLD_COIN_PACKS)
  })

  fastify.post('/cosmetics/:id/purchase', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const payload = req.user as { sub: string }
    const cosmetic = await prisma.cosmetic.findUnique({ where: { id } })
    if (!cosmetic) return reply.status(404).send({ error: 'Cosmetic not found' })
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const balance = cosmetic.currency === 'star' ? user.starCoins : user.goldCoins
    if (balance < cosmetic.price) return reply.status(400).send({ error: 'Insufficient funds' })

    await prisma.$transaction([
      prisma.userCosmetic.create({ data: { userId: payload.sub, cosmeticId: id } }),
      prisma.user.update({
        where: { id: payload.sub },
        data: cosmetic.currency === 'star'
          ? { starCoins: { decrement: cosmetic.price } }
          : { goldCoins: { decrement: cosmetic.price } },
      }),
    ])
    return reply.send({ success: true })
  })
}
