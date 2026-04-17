import type { FastifyPluginAsync } from 'fastify'
import rawBody from 'fastify-raw-body'
import Stripe from 'stripe'
import { GOLD_COIN_PACKS } from '@red-handed/shared'
import { env } from '../config/env'
import { prisma } from '../config/prisma'

// Lazily constructed so the API can boot without Stripe configured (staging
// tier before keys are provisioned, local dev, CI). Routes that need it call
// getStripe() and surface a 503 when it's unset.
let stripeClient: Stripe | null = null
function getStripe(): Stripe | null {
  if (stripeClient) return stripeClient
  if (!env.STRIPE_SECRET_KEY) return null
  stripeClient = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  return stripeClient
}

// Maps a pack id to its per-environment Stripe Price. Test and live modes have
// different IDs, so this is env-driven instead of baked into the shared pack list.
function stripePriceIdFor(packId: string): string | undefined {
  switch (packId) {
    case 'pack_500':  return env.STRIPE_PRICE_ID_PACK_500
    case 'pack_1500': return env.STRIPE_PRICE_ID_PACK_1500
    case 'pack_5000': return env.STRIPE_PRICE_ID_PACK_5000
    default:          return undefined
  }
}

export const shopRoutes: FastifyPluginAsync = async (fastify) => {
  // Register raw-body capture scoped to this plugin. `global: false` keeps the
  // default JSON parser in effect for every other route — only the webhook opts
  // in via `config: { rawBody: true }`. Stripe signature verification requires
  // the exact bytes Stripe sent, so this must run before any JSON parsing.
  await fastify.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: false,
    runFirst: true,
  })

  // ── GET /api/shop/packs ────────────────────────────────────────────────────
  // Public pack catalogue. Stripe price IDs are intentionally omitted from the
  // response — the client only needs display data, the server resolves the
  // price at checkout time.
  fastify.get('/packs', async () => {
    return {
      packs: GOLD_COIN_PACKS.map((p) => ({
        id: p.id,
        amount: p.amount,
        bonus: p.bonus,
        priceCents: p.priceCents,
        currency: p.currency,
      })),
    }
  })

  // ── POST /api/shop/packs/:id/checkout ──────────────────────────────────────
  // Creates a Stripe Checkout session and records a pending Purchase. The
  // client is expected to follow the returned `url` to Stripe's hosted page.
  fastify.post<{ Params: { id: string } }>(
    '/packs/:id/checkout',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const stripe = getStripe()
      if (!stripe) {
        return reply.status(503).send({ error: 'Payments are not configured' })
      }

      const userId = (req.user as { sub: string }).sub
      const packId = req.params.id
      const pack = GOLD_COIN_PACKS.find((p) => p.id === packId)
      if (!pack) {
        return reply.status(404).send({ error: 'Unknown pack' })
      }
      const priceId = stripePriceIdFor(packId)
      if (!priceId) {
        req.log.error({ packId }, 'Stripe price id not configured for pack')
        return reply.status(503).send({ error: 'Pack is temporarily unavailable' })
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: env.STRIPE_SUCCESS_URL,
        cancel_url: env.STRIPE_CANCEL_URL,
        client_reference_id: userId,
        metadata: { userId, packId },
        // Stripe will send the account's default billing email on the receipt;
        // we don't pass customer_email so returning users can reuse saved cards.
      })

      // Stamp the pending row *before* returning so the webhook has something
      // to flip to `completed` even if the client never hits the success URL.
      await prisma.purchase.create({
        data: {
          userId,
          packId,
          goldCoins: pack.amount + pack.bonus,
          priceCents: pack.priceCents,
          currency: pack.currency,
          stripeSessionId: session.id,
          status: 'pending',
        },
      })

      req.log.info({ userId, packId, sessionId: session.id }, 'checkout session created')
      return { url: session.url, sessionId: session.id }
    },
  )

  // ── POST /api/shop/webhook ─────────────────────────────────────────────────
  // Stripe webhook. No auth — Stripe authenticates via the signature header.
  // MUST consume the raw body; the default JSON parser would mutate bytes and
  // break signature verification.
  fastify.post(
    '/webhook',
    { config: { rawBody: true } },
    async (req, reply) => {
      const stripe = getStripe()
      if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
        return reply.status(503).send({ error: 'Webhook not configured' })
      }

      const signature = req.headers['stripe-signature']
      if (!signature || typeof signature !== 'string') {
        return reply.status(400).send({ error: 'Missing signature' })
      }

      const raw = (req as unknown as { rawBody: Buffer }).rawBody
      if (!raw) {
        req.log.error('Webhook raw body missing — plugin misconfigured')
        return reply.status(400).send({ error: 'Bad request' })
      }

      let event: Stripe.Event
      try {
        event = stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET)
      } catch (err) {
        req.log.warn({ err }, 'Stripe webhook signature verification failed')
        return reply.status(400).send({ error: 'Invalid signature' })
      }

      req.log.info({ type: event.type, id: event.id }, 'stripe webhook received')

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session
        await creditPurchase(req.log, session.id)
      } else if (event.type === 'checkout.session.expired') {
        const session = event.data.object as Stripe.Checkout.Session
        await prisma.purchase.updateMany({
          where: { stripeSessionId: session.id, status: 'pending' },
          data: { status: 'failed' },
        })
      }
      // Other events (payment_intent.*, charge.refunded, ...) are ignored for
      // the MVP one-time-purchase flow.

      return reply.status(200).send({ received: true })
    },
  )

  // ── GET /api/shop/purchases ────────────────────────────────────────────────
  fastify.get(
    '/purchases',
    { onRequest: [fastify.authenticate] },
    async (req) => {
      const userId = (req.user as { sub: string }).sub
      const purchases = await prisma.purchase.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      return { purchases }
    },
  )
}

// Credits the user's goldCoins for a completed Stripe Checkout session. Safe
// to call multiple times for the same session — the webhook can be retried by
// Stripe on network blips. Uses a transaction so the balance update and the
// status flip land atomically.
async function creditPurchase(
  log: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void },
  sessionId: string,
) {
  await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({ where: { stripeSessionId: sessionId } })
    if (!purchase) {
      log.warn({ sessionId }, 'webhook for unknown session — ignoring')
      return
    }
    if (purchase.status === 'completed') {
      log.info({ sessionId }, 'webhook replay — already credited')
      return
    }
    await tx.user.update({
      where: { id: purchase.userId },
      data: { goldCoins: { increment: purchase.goldCoins } },
    })
    await tx.purchase.update({
      where: { id: purchase.id },
      data: { status: 'completed' },
    })
    log.info(
      { sessionId, userId: purchase.userId, goldCoins: purchase.goldCoins },
      'purchase credited',
    )
  })
}
