import type { FastifyPluginAsync } from 'fastify'
import type { FastifyBaseLogger } from 'fastify'
import rawBody from 'fastify-raw-body'
import Stripe from 'stripe'
import { COIN_PACKS, PREMIUM_PLANS } from '@red-handed/shared'
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

// Same split for premium subscriptions. Monthly and yearly are separate Stripe
// Prices under the same product — the interval is encoded in the Price itself.
function stripePremiumPriceIdFor(planId: string): string | undefined {
  switch (planId) {
    case 'monthly': return env.STRIPE_PRICE_ID_PREMIUM_MONTHLY
    case 'yearly':  return env.STRIPE_PRICE_ID_PREMIUM_YEARLY
    default:        return undefined
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
      packs: COIN_PACKS.map((p) => ({
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
      const pack = COIN_PACKS.find((p) => p.id === packId)
      if (!pack) {
        return reply.status(404).send({ error: 'Unknown pack' })
      }
      const priceId = stripePriceIdFor(packId)
      if (!priceId) {
        req.log.error({ packId }, 'Stripe price id not configured for pack')
        return reply.status(503).send({ error: 'Pack is temporarily unavailable' })
      }

      // Stripe + Prisma can both throw here (invalid price id, wrong-mode key,
      // DB constraint). Without this catch, Fastify returns a generic 500
      // "Internal Server Error" and the shop page shows that raw to the user —
      // we want the real reason in the server log and a safer message on screen.
      let session: Stripe.Checkout.Session
      try {
        session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: env.STRIPE_SUCCESS_URL,
          cancel_url: env.STRIPE_CANCEL_URL,
          client_reference_id: userId,
          metadata: { userId, packId },
          // Stripe will send the account's default billing email on the receipt;
          // we don't pass customer_email so returning users can reuse saved cards.
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        req.log.error(
          { err, userId, packId, priceId, successUrl: env.STRIPE_SUCCESS_URL, cancelUrl: env.STRIPE_CANCEL_URL },
          'stripe.checkout.sessions.create failed',
        )
        return reply.status(502).send({ error: `Checkout unavailable: ${message}` })
      }

      // Stamp the pending row *before* returning so the webhook has something
      // to flip to `completed` even if the client never hits the success URL.
      try {
        await prisma.purchase.create({
          data: {
            userId,
            packId,
            starCoins: pack.amount + pack.bonus,
            priceCents: pack.priceCents,
            currency: pack.currency,
            stripeSessionId: session.id,
            status: 'pending',
          },
        })
      } catch (err) {
        req.log.error({ err, userId, packId, sessionId: session.id }, 'purchase row create failed')
        return reply.status(500).send({ error: 'Could not record purchase — please retry.' })
      }

      req.log.info({ userId, packId, sessionId: session.id }, 'checkout session created')
      return { url: session.url, sessionId: session.id }
    },
  )

  // ── POST /api/shop/premium/checkout ────────────────────────────────────────
  // Kicks off a Stripe Checkout session in subscription mode for the Premium
  // monthly/yearly plan. Reuses the caller's existing Stripe customer when we
  // have one (saved card, unified billing history) and stamps its id on
  // `User.stripeCustomerId` the first time Stripe creates one so future
  // renewals can be correlated back to the user without an email lookup.
  fastify.post<{ Params: { planId: string } }>(
    '/premium/checkout/:planId',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const stripe = getStripe()
      if (!stripe) {
        return reply.status(503).send({ error: 'Payments are not configured' })
      }

      const userId = (req.user as { sub: string }).sub
      const planId = req.params.planId
      const plan = PREMIUM_PLANS.find((p) => p.id === planId)
      if (!plan) {
        return reply.status(404).send({ error: 'Unknown plan' })
      }
      const priceId = stripePremiumPriceIdFor(planId)
      if (!priceId) {
        req.log.error({ planId }, 'Stripe price id not configured for premium plan')
        return reply.status(503).send({ error: 'Plan is temporarily unavailable' })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, stripeCustomerId: true, premiumUntil: true },
      })
      if (!user) return reply.status(404).send({ error: 'User not found' })

      // Block double-subscribing while a current one is still active. The
      // client should route active subscribers to the billing portal instead.
      if (user.premiumUntil && user.premiumUntil.getTime() > Date.now()) {
        return reply.status(409).send({ error: 'already_premium', premiumUntil: user.premiumUntil })
      }

      // Land back on the Shop's Premium tab so the user sees the "You are
      // Premium" state + Manage Subscription CTA right away.
      const origin = env.STRIPE_SUCCESS_URL.split('/shop')[0].split('/premium')[0]
      const premiumSuccessUrl = `${origin}/shop?tab=premium&checkout=success`
      const premiumCancelUrl  = `${origin}/shop?tab=premium&checkout=canceled`
      let session: Stripe.Checkout.Session
      try {
        session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: premiumSuccessUrl,
          cancel_url: premiumCancelUrl,
          client_reference_id: userId,
          // Bind the Stripe customer up-front so renewals stamp the same id.
          // First-time subscribers will have Stripe create the customer and
          // the webhook writes the id back to User.stripeCustomerId.
          ...(user.stripeCustomerId
            ? { customer: user.stripeCustomerId }
            : { customer_email: user.email }),
          metadata: { userId, planId },
          subscription_data: {
            metadata: { userId, planId },
          },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        req.log.error(
          { err, userId, planId, priceId },
          'stripe.checkout.sessions.create (subscription) failed',
        )
        return reply.status(502).send({ error: `Checkout unavailable: ${message}` })
      }

      req.log.info({ userId, planId, sessionId: session.id }, 'premium checkout session created')
      return { url: session.url, sessionId: session.id }
    },
  )

  // ── POST /api/shop/premium/portal ──────────────────────────────────────────
  // Opens the Stripe-hosted Billing Portal so the customer can update card /
  // view invoices / cancel. Requires an existing stripeCustomerId — callers
  // who've never subscribed get 400 and should be pointed at /premium/checkout.
  fastify.post(
    '/premium/portal',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const stripe = getStripe()
      if (!stripe) {
        return reply.status(503).send({ error: 'Payments are not configured' })
      }

      const userId = (req.user as { sub: string }).sub
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      })
      if (!user?.stripeCustomerId) {
        return reply.status(400).send({ error: 'no_subscription' })
      }

      try {
        const session = await stripe.billingPortal.sessions.create({
          customer: user.stripeCustomerId,
          return_url: env.STRIPE_PORTAL_RETURN_URL,
        })
        return { url: session.url }
      } catch (err) {
        req.log.error({ err, userId }, 'stripe billing portal session failed')
        return reply.status(502).send({ error: 'Could not open billing portal' })
      }
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
        if (session.mode === 'subscription') {
          await applySubscriptionFromCheckout(stripe, req.log, session)
        } else {
          await creditPurchase(req.log, session.id)
        }
      } else if (event.type === 'checkout.session.expired') {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') {
          await prisma.purchase.updateMany({
            where: { stripeSessionId: session.id, status: 'pending' },
            data: { status: 'failed' },
          })
        }
      } else if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated'
      ) {
        const sub = event.data.object as Stripe.Subscription
        await applySubscription(req.log, sub)
      } else if (event.type === 'customer.subscription.deleted') {
        // Immediate cancellation (admin / dispute / failed renewal after grace).
        // We don't backdate — the paid period has already ended by the time
        // Stripe fires this, so collapse `premiumUntil` to now.
        const sub = event.data.object as Stripe.Subscription
        await prisma.user.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { premiumUntil: new Date() },
        })
        req.log.info({ subscriptionId: sub.id }, 'subscription deleted — entitlement revoked')
      } else if (event.type === 'invoice.paid') {
        // Renewal path — the subscription's current_period_end has advanced.
        // We re-sync via applySubscription so premiumUntil matches whatever
        // Stripe now says, even if subscription.updated is delayed.
        const invoice = event.data.object as Stripe.Invoice
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
        if (subId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subId)
            await applySubscription(req.log, sub)
          } catch (err) {
            req.log.error({ err, subId }, 'failed to re-sync subscription after invoice.paid')
          }
        }
      }

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

// Binds the Stripe customer + subscription ids back to the user and stamps
// `premiumUntil` from the subscription's current_period_end. Called on
// `checkout.session.completed` for subscription-mode sessions. We read the
// userId from `client_reference_id` (canonical path) with `metadata.userId`
// as a fallback so an older session that lost the reference still resolves.
async function applySubscriptionFromCheckout(
  stripe: Stripe,
  log: FastifyBaseLogger,
  session: Stripe.Checkout.Session,
) {
  const userId = session.client_reference_id ?? (session.metadata?.userId as string | undefined)
  if (!userId) {
    log.warn({ sessionId: session.id }, 'subscription checkout without userId — ignoring')
    return
  }
  const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  if (!subId || !customerId) {
    log.warn({ sessionId: session.id }, 'subscription checkout missing ids — ignoring')
    return
  }

  // Retrieve the subscription so we have the authoritative current_period_end
  // even if metadata didn't round-trip through the Checkout session.
  const sub = await stripe.subscriptions.retrieve(subId)
  const premiumUntil = new Date(sub.current_period_end * 1000)

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
      premiumUntil,
    },
  })

  log.info(
    { userId, subscriptionId: subId, premiumUntil: premiumUntil.toISOString() },
    'premium subscription activated',
  )
}

// Generic sync from a Stripe Subscription → User. Used for subscription.created,
// subscription.updated and invoice.paid (renewal). Idempotent — safe to call
// multiple times for the same event. Resolves the user by stripeSubscriptionId
// first, then by metadata.userId, then by stripeCustomerId — in that order —
// so late-binding scenarios (e.g. the initial event fires before the checkout
// write has landed) still converge.
async function applySubscription(log: FastifyBaseLogger, sub: Stripe.Subscription) {
  const premiumUntil = new Date(sub.current_period_end * 1000)
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const metaUserId = sub.metadata?.userId as string | undefined

  // `cancel_at_period_end=true` is NOT an immediate revoke — the user keeps
  // premium until current_period_end. We only revoke on explicit deletion.
  // Past-due / unpaid subs also keep access until Stripe cancels them.
  const existingBySub = await prisma.user.findUnique({
    where: { stripeSubscriptionId: sub.id },
    select: { id: true },
  })
  const userId =
    existingBySub?.id ??
    metaUserId ??
    (await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    }))?.id

  if (!userId) {
    log.warn({ subscriptionId: sub.id, customerId }, 'subscription event for unknown user — ignoring')
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      premiumUntil,
    },
  })

  log.info(
    { userId, subscriptionId: sub.id, premiumUntil: premiumUntil.toISOString(), status: sub.status },
    'subscription synced',
  )
}

// Credits the user's starCoins for a completed Stripe Checkout session. Safe
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
      data: { starCoins: { increment: purchase.starCoins } },
    })
    await tx.purchase.update({
      where: { id: purchase.id },
      data: { status: 'completed' },
    })
    log.info(
      { sessionId, userId: purchase.userId, starCoins: purchase.starCoins },
      'purchase credited',
    )
  })
}
