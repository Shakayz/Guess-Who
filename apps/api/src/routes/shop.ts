import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/prisma'
// import { GOLD_COIN_PACKS } from '@imposter/shared'  // TODO: re-enable when premium is ready
// import { env } from '../config/env'                  // TODO: re-enable when premium is ready

export const shopRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Active routes (star-coin cosmetics) ─────────────────────────────────────

  fastify.get('/cosmetics', async (req, reply) => {
    const cosmetics = await prisma.cosmetic.findMany({ orderBy: { createdAt: 'desc' } })
    return reply.send(cosmetics)
  })

  fastify.post('/cosmetics/:id/purchase', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const payload = req.user as { sub: string }
    const cosmetic = await prisma.cosmetic.findUnique({ where: { id } })
    if (!cosmetic) return reply.status(404).send({ error: 'Cosmetic not found' })
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    // Only star-coin purchases allowed for now
    if (cosmetic.currency !== 'star') {
      return reply.status(400).send({ error: 'Gold coin purchases are temporarily disabled' })
    }

    const balance = user.starCoins
    if (balance < cosmetic.price) return reply.status(400).send({ error: 'Insufficient funds' })

    await prisma.$transaction([
      prisma.userCosmetic.create({ data: { userId: payload.sub, cosmeticId: id } }),
      prisma.user.update({
        where: { id: payload.sub },
        data: { starCoins: { decrement: cosmetic.price } },
      }),
    ])
    return reply.send({ success: true })
  })

  // ── Premium routes (disabled) ───────────────────────────────────────────────
  // TODO: re-enable all routes below when premium/monetization is ready

  // GET /api/shop/packs — gold coin packs listing
  fastify.get('/packs', async (_req, reply) => {
    return reply.status(503).send({ error: 'Gold coin packs are temporarily unavailable' })
  })

  // POST /api/shop/packs/:id/checkout — Stripe Checkout (disabled)
  fastify.post('/packs/:id/checkout', async (_req, reply) => {
    return reply.status(503).send({ error: 'Payment processing is temporarily disabled' })
  })

  // POST /api/shop/webhook — Stripe webhook (disabled)
  fastify.post('/webhook', async (_req, reply) => {
    return reply.status(503).send({ error: 'Webhook is temporarily disabled' })
  })

  // GET /api/shop/purchases — purchase history (disabled)
  fastify.get('/purchases', async (_req, reply) => {
    return reply.status(503).send({ error: 'Purchase history is temporarily unavailable' })
  })
}
