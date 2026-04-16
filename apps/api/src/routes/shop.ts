import type { FastifyPluginAsync } from 'fastify'
// import { GOLD_COIN_PACKS } from '@imposter/shared'  // TODO: re-enable when premium is ready
// import { env } from '../config/env'                  // TODO: re-enable when premium is ready

export const shopRoutes: FastifyPluginAsync = async (fastify) => {
  // Cosmetics were removed from the game design — there are no avatars to
  // attach them to, so the shop no longer carries any item catalog.

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
