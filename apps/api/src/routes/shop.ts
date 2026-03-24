import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/prisma'
import { GOLD_COIN_PACKS } from '@imposter/shared'
import { env } from '../config/env'

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

  // POST /api/shop/packs/:id/checkout — create Stripe Checkout session
  fastify.post('/packs/:id/checkout', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const userId = (req.user as { sub: string }).sub

    const pack = GOLD_COIN_PACKS.find((p) => p.id === id)
    if (!pack) return reply.status(404).send({ error: 'Pack not found' })

    const STRIPE_SECRET_KEY = (env as any).STRIPE_SECRET_KEY
    if (!STRIPE_SECRET_KEY) {
      return reply.status(503).send({ error: 'Payment processing not configured' })
    }

    // Lazy-load stripe to keep startup clean when key not configured
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' as any })

    const totalCoins = pack.amount + pack.bonus
    const priceCents = Math.round(pack.price * 100)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: priceCents,
          product_data: {
            name: `${totalCoins} Gold Coins`,
            description: pack.bonus > 0 ? `${pack.amount} + ${pack.bonus} bonus coins` : `${pack.amount} Gold Coins`,
          },
        },
        quantity: 1,
      }],
      success_url: `${(env as any).APP_URL}/premium?payment=success`,
      cancel_url:  `${(env as any).APP_URL}/premium?payment=cancelled`,
      metadata: { userId, packId: id, goldCoins: String(totalCoins) },
    })

    // Record pending purchase
    await prisma.purchase.create({
      data: {
        userId,
        packId: id,
        goldCoins: totalCoins,
        priceCents,
        stripeSessionId: session.id,
        status: 'pending',
      },
    })

    return reply.send({ url: session.url })
  })

  // POST /api/shop/webhook — Stripe webhook to credit coins
  fastify.post('/webhook', { config: { rawBody: true } }, async (req, reply) => {
    const STRIPE_WEBHOOK_SECRET = (env as any).STRIPE_WEBHOOK_SECRET
    const STRIPE_SECRET_KEY = (env as any).STRIPE_SECRET_KEY
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      return reply.status(503).send({ error: 'Webhook not configured' })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' as any })

    const sig = req.headers['stripe-signature'] as string
    let event: any
    try {
      event = stripe.webhooks.constructEvent((req as any).rawBody, sig, STRIPE_WEBHOOK_SECRET)
    } catch {
      return reply.status(400).send({ error: 'Webhook signature verification failed' })
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const { userId, goldCoins } = session.metadata
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { goldCoins: { increment: parseInt(goldCoins) } } }),
        prisma.purchase.updateMany({ where: { stripeSessionId: session.id }, data: { status: 'completed' } }),
      ]).catch(() => {})
    }

    return reply.send({ received: true })
  })

  // GET /api/shop/purchases — purchase history for current user
  fastify.get('/purchases', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const purchases = await prisma.purchase.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(purchases)
  })
}
