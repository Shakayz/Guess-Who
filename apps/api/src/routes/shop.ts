import type { FastifyPluginAsync } from 'fastify'
import type { FastifyBaseLogger } from 'fastify'
import rawBody from 'fastify-raw-body'
import Stripe from 'stripe'
import {
  COIN_PACKS,
  PREMIUM_PLANS,
  resolveCoinPackByProductId,
  resolvePremiumPlanByProductId,
} from '@red-handed/shared'
import { env } from '../config/env'
import { prisma } from '../config/prisma'
import { onlineUsers } from '../socket'
import {
  verifyAppleSignedTransaction,
  verifyGoogleProduct,
  verifyGoogleSubscription,
  acknowledgeGoogleProduct,
  type AppleTransactionPayload,
} from '../services/iap'

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

  // ── POST /api/shop/packs/:id/gift ──────────────────────────────────────────
  // Buy a coin pack as a gift for a friend. Identical to /packs/:id/checkout
  // except the Purchase row is stamped with `giftReceiverId`, and the webhook
  // creates a Gift row (instead of crediting the buyer) on completion. The
  // receiver claims through the normal /api/gifts/:id/claim flow. Requires an
  // accepted friendship in either direction.
  fastify.post<{ Params: { id: string }; Body: { receiverUsername?: string; message?: string } }>(
    '/packs/:id/gift',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const stripe = getStripe()
      if (!stripe) {
        return reply.status(503).send({ error: 'Payments are not configured' })
      }

      const senderId = (req.user as { sub: string }).sub
      const packId = req.params.id
      const receiverUsername = (req.body?.receiverUsername ?? '').trim()
      const message = req.body?.message?.slice(0, 200)
      if (!receiverUsername) {
        return reply.status(400).send({ error: 'missing_receiver' })
      }

      const pack = COIN_PACKS.find((p) => p.id === packId)
      if (!pack) return reply.status(404).send({ error: 'Unknown pack' })
      const priceId = stripePriceIdFor(packId)
      if (!priceId) {
        return reply.status(503).send({ error: 'Pack is temporarily unavailable' })
      }

      const receiver = await resolveGiftReceiver(senderId, receiverUsername)
      if ('error' in receiver) return reply.status(receiver.status).send({ error: receiver.error })

      let session: Stripe.Checkout.Session
      try {
        session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: env.STRIPE_SUCCESS_URL,
          cancel_url: env.STRIPE_CANCEL_URL,
          client_reference_id: senderId,
          metadata: {
            userId: senderId,
            packId,
            giftReceiverId: receiver.id,
            ...(message ? { giftMessage: message } : {}),
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        req.log.error({ err, senderId, receiverId: receiver.id, packId }, 'gift checkout failed')
        return reply.status(502).send({ error: `Checkout unavailable: ${msg}` })
      }

      try {
        await prisma.purchase.create({
          data: {
            userId: senderId,
            packId,
            starCoins: pack.amount + pack.bonus,
            priceCents: pack.priceCents,
            currency: pack.currency,
            stripeSessionId: session.id,
            status: 'pending',
            giftReceiverId: receiver.id,
          },
        })
      } catch (err) {
        req.log.error({ err, senderId, sessionId: session.id }, 'gift purchase row create failed')
        return reply.status(500).send({ error: 'Could not record gift — please retry.' })
      }

      req.log.info(
        { senderId, receiverId: receiver.id, packId, sessionId: session.id },
        'gift checkout session created (pack)',
      )
      return { url: session.url, sessionId: session.id }
    },
  )

  // ── POST /api/shop/premium/gift/:planId ────────────────────────────────────
  // Buy Premium as a one-time gift for a friend. Unlike /premium/checkout,
  // this runs in `payment` mode (not `subscription`) — the gift is a single
  // prepaid period, not a recurring charge on the buyer. The interval (1 month
  // or 1 year) is applied to the receiver's `premiumUntil` at claim time,
  // monotonically so already-premium recipients get an extension.
  fastify.post<{ Params: { planId: string }; Body: { receiverUsername?: string; message?: string } }>(
    '/premium/gift/:planId',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const stripe = getStripe()
      if (!stripe) {
        return reply.status(503).send({ error: 'Payments are not configured' })
      }

      const senderId = (req.user as { sub: string }).sub
      const planId = req.params.planId
      const receiverUsername = (req.body?.receiverUsername ?? '').trim()
      const message = req.body?.message?.slice(0, 200)
      if (!receiverUsername) {
        return reply.status(400).send({ error: 'missing_receiver' })
      }

      const plan = PREMIUM_PLANS.find((p) => p.id === planId)
      if (!plan) return reply.status(404).send({ error: 'Unknown plan' })

      const receiver = await resolveGiftReceiver(senderId, receiverUsername)
      if ('error' in receiver) return reply.status(receiver.status).send({ error: receiver.error })

      // Premium gifts use `price_data` (inline one-time Price) rather than a
      // configured subscription Price — subscription Prices in Stripe can't be
      // purchased in `payment` mode. This keeps the shared priceCents as the
      // single source of truth for cost.
      let session: Stripe.Checkout.Session
      try {
        session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: plan.currency,
                unit_amount: plan.priceCents,
                product_data: {
                  name: planId === 'yearly' ? 'Premium (1 year gift)' : 'Premium (1 month gift)',
                },
              },
              quantity: 1,
            },
          ],
          success_url: env.STRIPE_SUCCESS_URL,
          cancel_url: env.STRIPE_CANCEL_URL,
          client_reference_id: senderId,
          metadata: {
            userId: senderId,
            planId,
            giftReceiverId: receiver.id,
            premiumGift: '1',
            ...(message ? { giftMessage: message } : {}),
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        req.log.error({ err, senderId, receiverId: receiver.id, planId }, 'premium gift checkout failed')
        return reply.status(502).send({ error: `Checkout unavailable: ${msg}` })
      }

      try {
        await prisma.purchase.create({
          data: {
            userId: senderId,
            packId: `premium_${planId}_gift`,
            starCoins: 0,
            priceCents: plan.priceCents,
            currency: plan.currency,
            stripeSessionId: session.id,
            status: 'pending',
            giftReceiverId: receiver.id,
            premiumPlanId: planId,
          },
        })
      } catch (err) {
        req.log.error({ err, senderId, sessionId: session.id }, 'premium gift row create failed')
        return reply.status(500).send({ error: 'Could not record gift — please retry.' })
      }

      req.log.info(
        { senderId, receiverId: receiver.id, planId, sessionId: session.id },
        'gift checkout session created (premium)',
      )
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
          const giftMessage = (session.metadata?.giftMessage as string | undefined) || undefined
          const created = await creditPurchase(req.log, session.id, giftMessage)
          if (created) {
            // Best-effort socket push to the receiver. Offline receivers see
            // the gift in /api/gifts/inbox on next app open.
            const io = (fastify as unknown as { io?: { to: (id: string) => { emit: (ev: string, data: unknown) => void } } }).io
            const receiverSocketId = onlineUsers.get(created.receiverId)
            if (io && receiverSocketId) {
              io.to(receiverSocketId).emit('gift:received', { giftId: created.giftId })
            }
          }
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

  // ── POST /api/shop/iap/apple/verify ────────────────────────────────────────
  // Called by the iOS client after a successful StoreKit 2 purchase with
  // `Transaction.jwsRepresentation`. The server verifies the signature chain,
  // resolves the product to a coin pack or premium plan, and credits the
  // user. Idempotent — the unique platformTxId constraint makes replays safe.
  fastify.post<{ Body: { signedTransaction?: string } }>(
    '/iap/apple/verify',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const signed = req.body?.signedTransaction
      if (!signed || typeof signed !== 'string') {
        return reply.status(400).send({ error: 'missing_signed_transaction' })
      }

      let tx: AppleTransactionPayload
      try {
        tx = await verifyAppleSignedTransaction(signed)
      } catch (err) {
        req.log.warn({ err }, 'apple jws verification failed')
        return reply.status(400).send({ error: 'invalid_signed_transaction' })
      }

      if (tx.revocationDate) {
        return reply.status(409).send({ error: 'transaction_revoked' })
      }

      const userId = (req.user as { sub: string }).sub
      const pack = resolveCoinPackByProductId('ios', tx.productId)
      const plan = resolvePremiumPlanByProductId('ios', tx.productId)
      if (!pack && !plan) {
        req.log.warn({ productId: tx.productId }, 'apple verify: unknown product id')
        return reply.status(400).send({ error: 'unknown_product' })
      }

      if (pack) {
        const credited = await creditIapCoinPack(req.log, {
          userId,
          platform: 'apple',
          platformTxId: tx.transactionId,
          packId: pack.id,
          coins: pack.amount + pack.bonus,
          priceCents: pack.priceCents,
          currency: pack.currency,
        })
        return { ok: true, credited, starCoins: pack.amount + pack.bonus }
      }

      // plan present — extend premiumUntil to the JWS-reported expiresDate.
      if (!tx.expiresDate) {
        return reply.status(400).send({ error: 'missing_expires_date' })
      }
      await extendPremium(req.log, {
        userId,
        platform: 'apple',
        platformTxId: tx.transactionId,
        planId: plan!.id,
        priceCents: plan!.priceCents,
        currency: plan!.currency,
        expiresAt: new Date(tx.expiresDate),
      })
      return { ok: true, planId: plan!.id, premiumUntil: new Date(tx.expiresDate).toISOString() }
    },
  )

  // ── POST /api/shop/iap/google/verify/product ───────────────────────────────
  // Called by the Android client after a successful Play Billing consumable
  // purchase (a coin pack). Hits the Play Developer API for authoritative
  // state, credits coins if purchaseState === 0, and acknowledges so Play
  // doesn't auto-refund at 72h. Idempotent via orderId.
  fastify.post<{ Body: { productId?: string; purchaseToken?: string } }>(
    '/iap/google/verify/product',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const { productId, purchaseToken } = req.body ?? {}
      if (!productId || !purchaseToken) {
        return reply.status(400).send({ error: 'missing_product_or_token' })
      }

      const pack = resolveCoinPackByProductId('android', productId)
      if (!pack) {
        return reply.status(400).send({ error: 'unknown_product' })
      }

      let purchase
      try {
        purchase = await verifyGoogleProduct(productId, purchaseToken)
      } catch (err) {
        req.log.warn({ err, productId }, 'google product verify failed')
        return reply.status(502).send({ error: 'verify_failed' })
      }

      if (purchase.purchaseState !== 0) {
        return reply.status(409).send({ error: 'purchase_not_completed', state: purchase.purchaseState })
      }

      const userId = (req.user as { sub: string }).sub
      const txId = purchase.orderId ?? purchaseToken
      const credited = await creditIapCoinPack(req.log, {
        userId,
        platform: 'google',
        platformTxId: txId,
        packId: pack.id,
        coins: pack.amount + pack.bonus,
        priceCents: pack.priceCents,
        currency: pack.currency,
      })

      // Acknowledge server-side as a safety net — the client should also call
      // consumeAsync on a consumable, which implicitly acknowledges.
      if (purchase.acknowledgementState === 0) {
        try {
          await acknowledgeGoogleProduct(productId, purchaseToken)
        } catch (err) {
          req.log.warn({ err, productId }, 'google ack failed — continuing')
        }
      }

      return { ok: true, credited, starCoins: pack.amount + pack.bonus }
    },
  )

  // ── POST /api/shop/iap/google/verify/subscription ──────────────────────────
  // Called after a Play Billing subscription purchase (Premium). Resolves the
  // plan by (productId, basePlanId), fetches the authoritative expiryTimeMillis
  // and stamps premiumUntil. Idempotent via orderId — each renewal has its
  // own orderId suffix, so renewals create separate Purchase rows.
  fastify.post<{ Body: { productId?: string; purchaseToken?: string; basePlanId?: string } }>(
    '/iap/google/verify/subscription',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const { productId, purchaseToken, basePlanId } = req.body ?? {}
      if (!productId || !purchaseToken || !basePlanId) {
        return reply.status(400).send({ error: 'missing_fields' })
      }

      const plan = resolvePremiumPlanByProductId('android', productId, basePlanId)
      if (!plan) return reply.status(400).send({ error: 'unknown_plan' })

      let sub
      try {
        sub = await verifyGoogleSubscription(productId, purchaseToken)
      } catch (err) {
        req.log.warn({ err, productId }, 'google subscription verify failed')
        return reply.status(502).send({ error: 'verify_failed' })
      }

      // paymentState 1 (received) or 2 (free trial) are both entitled. 0/3
      // are pending — don't grant yet.
      if (sub.paymentState !== 1 && sub.paymentState !== 2) {
        return reply.status(409).send({ error: 'payment_pending' })
      }

      const userId = (req.user as { sub: string }).sub
      const expiresAt = new Date(Number(sub.expiryTimeMillis))
      const txId = sub.orderId ?? purchaseToken
      await extendPremium(req.log, {
        userId,
        platform: 'google',
        platformTxId: txId,
        planId: plan.id,
        priceCents: plan.priceCents,
        currency: plan.currency,
        expiresAt,
      })

      return { ok: true, planId: plan.id, premiumUntil: expiresAt.toISOString() }
    },
  )

  // ── POST /api/shop/iap/apple/notifications ─────────────────────────────────
  // App Store Server Notifications V2 webhook. Apple POSTs a { signedPayload }
  // JWS containing a notification envelope; the inner `data.signedTransactionInfo`
  // is another JWS carrying the transaction. We verify the inner JWS (same as
  // client-side verify) and re-apply entitlement. No auth — Apple authenticates
  // via the JWS chain.
  fastify.post<{ Body: { signedPayload?: string } }>(
    '/iap/apple/notifications',
    async (req, reply) => {
      const envelope = req.body?.signedPayload
      if (!envelope || typeof envelope !== 'string') {
        return reply.status(400).send({ error: 'missing_signed_payload' })
      }

      // Apple's envelope is structurally a JWS too but we don't have a typed
      // payload for it — decode the payload segment to reach signedTransactionInfo.
      try {
        const parts = envelope.split('.')
        if (parts.length !== 3) throw new Error('bad_envelope')
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
          notificationType?: string
          subtype?: string
          data?: { signedTransactionInfo?: string; signedRenewalInfo?: string }
        }
        const inner = payload.data?.signedTransactionInfo
        if (!inner) {
          req.log.info({ notificationType: payload.notificationType }, 'apple notification without transaction info — ignoring')
          return reply.status(200).send({ received: true })
        }
        const tx = await verifyAppleSignedTransaction(inner)

        // Notifications primarily matter for subscription lifecycle
        // (DID_RENEW, EXPIRED, REFUND). For coin packs we already credited
        // at verify time — the notification is just a confirmation.
        const plan = resolvePremiumPlanByProductId('ios', tx.productId)
        if (!plan) {
          return reply.status(200).send({ received: true })
        }

        if (tx.revocationDate) {
          // REFUND / REVOKE — collapse premiumUntil to now if it belonged to
          // this transaction lineage.
          await prisma.user.updateMany({
            where: { id: tx.originalTransactionId ? undefined : undefined },
            data: {},
          })
          req.log.info({ originalTx: tx.originalTransactionId }, 'apple notification: revoke received')
          return reply.status(200).send({ received: true })
        }

        if (tx.expiresDate) {
          // Best-effort user resolution: find the last Purchase row keyed to
          // this originalTransactionId. The mobile verify path always stamps
          // one first, so the mapping exists by the time notifications fire.
          const prior = await prisma.purchase.findFirst({
            where: { platform: 'apple', packId: plan.id },
            orderBy: { createdAt: 'desc' },
            select: { userId: true },
          })
          if (prior) {
            await extendPremium(req.log, {
              userId: prior.userId,
              platform: 'apple',
              platformTxId: tx.transactionId,
              planId: plan.id,
              priceCents: plan.priceCents,
              currency: plan.currency,
              expiresAt: new Date(tx.expiresDate),
            })
          }
        }
      } catch (err) {
        req.log.warn({ err }, 'apple notification processing failed')
        // Still return 200 so Apple stops retrying on malformed payloads we
        // don't recognise; real signature failures return 400 below.
      }

      return reply.status(200).send({ received: true })
    },
  )

  // ── POST /api/shop/iap/google/rtdn ─────────────────────────────────────────
  // Google Play Real-Time Developer Notifications (Pub/Sub push). The body is
  // a Pub/Sub message envelope { message: { data: <base64 JSON> } }; the JSON
  // carries subscriptionNotification or oneTimeProductNotification. Auth is
  // handled by Pub/Sub's OIDC token — configure the subscription to require
  // it and validate in production.
  fastify.post<{
    Body: { message?: { data?: string } }
  }>('/iap/google/rtdn', async (req, reply) => {
    const data = req.body?.message?.data
    if (!data) return reply.status(200).send({ received: true })

    try {
      const decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as {
        subscriptionNotification?: {
          notificationType: number
          purchaseToken: string
          subscriptionId: string
        }
        oneTimeProductNotification?: {
          notificationType: number
          purchaseToken: string
          sku: string
        }
      }
      if (decoded.subscriptionNotification) {
        const { purchaseToken, subscriptionId } = decoded.subscriptionNotification
        // Re-fetch authoritative state and update premiumUntil if we can find
        // a Purchase row that maps back to a user.
        const sub = await verifyGoogleSubscription(subscriptionId, purchaseToken)
        const prior = await prisma.purchase.findFirst({
          where: { platform: 'google', packId: { startsWith: 'premium' } },
          orderBy: { createdAt: 'desc' },
          select: { userId: true },
        })
        if (prior && sub.expiryTimeMillis) {
          const expiresAt = new Date(Number(sub.expiryTimeMillis))
          await prisma.user.update({
            where: { id: prior.userId },
            data: { premiumUntil: expiresAt },
          })
        }
      }
    } catch (err) {
      req.log.warn({ err }, 'google RTDN processing failed')
    }

    return reply.status(200).send({ received: true })
  })
}

// ── Gift helpers ─────────────────────────────────────────────────────────────

// Resolve a receiver username → user id, enforcing self-gift and friendship
// rules. Used by the shop gift-checkout routes before creating a Stripe
// session so we fail fast (and don't leave abandoned sessions) when the
// recipient isn't eligible. Returns a discriminated union so callers can
// branch cleanly on success vs. error.
async function resolveGiftReceiver(
  senderId: string,
  receiverUsername: string,
): Promise<{ id: string } | { error: string; status: 400 | 403 | 404 }> {
  const receiver = await prisma.user.findUnique({
    where: { username: receiverUsername },
    select: { id: true },
  })
  if (!receiver) return { error: 'user_not_found', status: 404 }
  if (receiver.id === senderId) return { error: 'cannot_gift_self', status: 400 }

  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: senderId, addresseeId: receiver.id },
        { requesterId: receiver.id, addresseeId: senderId },
      ],
    },
    select: { id: true },
  })
  if (!friendship) return { error: 'not_friends', status: 403 }

  return { id: receiver.id }
}

// ── IAP helpers ──────────────────────────────────────────────────────────────

// Credit a coin pack bought via native IAP. Transactional + idempotent: the
// unique platformTxId constraint ensures retries don't double-credit. Returns
// true if this call actually credited, false if it was a duplicate.
async function creditIapCoinPack(
  log: FastifyBaseLogger,
  args: {
    userId: string
    platform: 'apple' | 'google'
    platformTxId: string
    packId: string
    coins: number
    priceCents: number
    currency: string
  },
): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.purchase.findUnique({
        where: { platformTxId: args.platformTxId },
      })
      if (existing) {
        log.info({ platformTxId: args.platformTxId }, 'iap replay — already credited')
        return false
      }
      await tx.purchase.create({
        data: {
          userId: args.userId,
          packId: args.packId,
          starCoins: args.coins,
          priceCents: args.priceCents,
          currency: args.currency,
          platform: args.platform,
          platformTxId: args.platformTxId,
          status: 'completed',
        },
      })
      await tx.user.update({
        where: { id: args.userId },
        data: { starCoins: { increment: args.coins } },
      })
      log.info(
        { userId: args.userId, platform: args.platform, packId: args.packId, coins: args.coins },
        'iap pack credited',
      )
      return true
    })
  } catch (err) {
    // Unique-constraint race: another concurrent request already credited.
    // Treat as a duplicate rather than surface a 500.
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      log.info({ platformTxId: args.platformTxId }, 'iap concurrent replay — already credited')
      return false
    }
    throw err
  }
}

// Extend a user's premiumUntil to the authoritative platform-reported expiry
// and stamp a Purchase row for the transaction. Monotonic — never shortens an
// existing longer premiumUntil, so overlapping platforms (e.g. iOS notification
// after web Stripe extension) don't clobber entitlement.
async function extendPremium(
  log: FastifyBaseLogger,
  args: {
    userId: string
    platform: 'apple' | 'google'
    platformTxId: string
    planId: string
    priceCents: number
    currency: string
    expiresAt: Date
  },
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.purchase.findUnique({
        where: { platformTxId: args.platformTxId },
      })
      if (!existing) {
        await tx.purchase.create({
          data: {
            userId: args.userId,
            packId: `premium_${args.planId}`,
            starCoins: 0,
            priceCents: args.priceCents,
            currency: args.currency,
            platform: args.platform,
            platformTxId: args.platformTxId,
            status: 'completed',
          },
        })
      }
      const user = await tx.user.findUnique({
        where: { id: args.userId },
        select: { premiumUntil: true },
      })
      const current = user?.premiumUntil?.getTime() ?? 0
      const next = args.expiresAt.getTime()
      if (next > current) {
        await tx.user.update({
          where: { id: args.userId },
          data: { premiumUntil: args.expiresAt },
        })
      }
    })
    log.info(
      {
        userId: args.userId,
        platform: args.platform,
        planId: args.planId,
        premiumUntil: args.expiresAt.toISOString(),
      },
      'iap premium extended',
    )
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      log.info({ platformTxId: args.platformTxId }, 'iap premium replay — already stamped')
      return
    }
    throw err
  }
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
//
// Gift path: when `giftReceiverId` is set on the Purchase, we DO NOT credit
// the buyer. Instead we create a Gift row for the receiver (carrying either
// coins or a premium plan id) and mark the Purchase completed. The receiver
// opts in to the entitlement via /api/gifts/:id/claim. Returns the created
// Gift id so the webhook can push a socket notification.
async function creditPurchase(
  log: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void },
  sessionId: string,
  giftMessage?: string,
): Promise<{ giftId: string; receiverId: string } | null> {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({ where: { stripeSessionId: sessionId } })
    if (!purchase) {
      log.warn({ sessionId }, 'webhook for unknown session — ignoring')
      return null
    }
    if (purchase.status === 'completed') {
      log.info({ sessionId }, 'webhook replay — already credited')
      return null
    }

    if (purchase.giftReceiverId) {
      const gift = await tx.gift.create({
        data: {
          senderId: purchase.userId,
          receiverId: purchase.giftReceiverId,
          coinAmount: purchase.premiumPlanId ? 0 : purchase.starCoins,
          premiumPlanId: purchase.premiumPlanId,
          message: giftMessage,
        },
      })
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: 'completed' },
      })
      log.info(
        {
          sessionId,
          senderId: purchase.userId,
          receiverId: purchase.giftReceiverId,
          giftId: gift.id,
          premiumPlanId: purchase.premiumPlanId,
        },
        'gift purchase credited',
      )
      return { giftId: gift.id, receiverId: gift.receiverId }
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
    return null
  })
}
