import type { FastifyPluginAsync } from 'fastify'
import {
  COIN_PACKS,
  IAP_PRODUCT_IDS,
  coinPackFromIapProductId,
} from '@red-handed/shared'
import { env } from '../config/env'
import { prisma } from '../config/prisma'

/**
 * Mobile In-App Purchase verification routes.
 *
 * - POST /api/shop/iap/ios/verify     — verifies an App Store receipt, credits coins / flips Premium.
 * - POST /api/shop/iap/android/verify — verifies a Play Billing purchaseToken, credits coins / flips Premium.
 *
 * Apple and Google require all digital-goods purchases inside the iOS/Android
 * apps to go through their own billing systems (App Review 3.1.1 and Google
 * Play Payments Policy). The mobile client uses StoreKit / Play Billing to
 * take the purchase, then hands us the receipt / purchaseToken here so we can
 * confirm it's real before granting star coins or flipping the premium flag.
 *
 * Both routes are idempotent — replaying the same receipt returns the same
 * outcome without double-crediting. The `storeTransactionId` unique column on
 * the Purchase table is the dedup key.
 */

// Apple verifyReceipt endpoints. Production receipts verify at the "buy"
// URL; Apple returns status 21007 when a sandbox receipt hits prod, at which
// point we re-POST to the sandbox URL.
const APPLE_PROD_URL = 'https://buy.itunes.apple.com/verifyReceipt'
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt'

const SUB_IDS = Object.values(IAP_PRODUCT_IDS.subscriptions) as string[]
const SEASON_PASS_ID = IAP_PRODUCT_IDS.nonConsumables.season_pass

type CreditResult = {
  productId: string
  starCoinsCredited?: number
  premium?: boolean
  seasonPass?: boolean
}

export const iapRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /api/shop/iap/ios/verify ────────────────────────────────────────
  fastify.post<{
    Body: {
      productId: string
      receipt: string
      transactionId?: string
      originalTransactionId?: string
    }
  }>(
    '/ios/verify',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const userId = (req.user as { sub: string }).sub
      const { productId, receipt, transactionId } = req.body || ({} as any)
      if (!productId || !receipt) {
        return reply.status(400).send({ error: 'productId and receipt are required' })
      }

      const verified = await verifyAppleReceipt(receipt, env.APPLE_IAP_USE_SANDBOX)
      if (!verified.ok) {
        req.log.warn({ status: verified.status, productId }, 'Apple receipt verification failed')
        return reply.status(400).send({ error: `Receipt verification failed (status ${verified.status})` })
      }

      // Apple sends every transaction in `in_app` (one-time) and latest
      // subscription entries in `latest_receipt_info`. We match on the
      // productId the client said it bought and on the exact transactionId
      // when provided so replay attacks can't credit a different row.
      const candidates: any[] = [
        ...(verified.body?.receipt?.in_app ?? []),
        ...(verified.body?.latest_receipt_info ?? []),
      ]
      const tx = candidates.find((t) =>
        t.product_id === productId
        && (!transactionId || t.transaction_id === transactionId),
      )
      if (!tx) {
        req.log.warn({ productId, transactionId }, 'Matching transaction not found in receipt')
        return reply.status(400).send({ error: 'Transaction not found in receipt' })
      }

      const storeTxId = tx.original_transaction_id || tx.transaction_id
      const environment: 'sandbox' | 'production' =
        verified.body?.environment?.toLowerCase() === 'sandbox' ? 'sandbox' : 'production'

      const credit = await creditForProduct(req.log, {
        userId,
        productId,
        platform: 'ios',
        storeTransactionId: storeTxId,
        environment,
        expiresAt: tx.expires_date_ms ? new Date(Number(tx.expires_date_ms)) : null,
      })
      return credit
    },
  )

  // ── POST /api/shop/iap/android/verify ────────────────────────────────────
  fastify.post<{
    Body: {
      productId: string
      purchaseToken: string
      packageName?: string
      orderId?: string
      isSubscription?: boolean
    }
  }>(
    '/android/verify',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const userId = (req.user as { sub: string }).sub
      const { productId, purchaseToken, packageName, orderId, isSubscription } = req.body || ({} as any)
      if (!productId || !purchaseToken) {
        return reply.status(400).send({ error: 'productId and purchaseToken are required' })
      }
      const pkg = packageName || env.GOOGLE_PLAY_PACKAGE_NAME
      if (!pkg) {
        return reply.status(503).send({ error: 'Play package name not configured on the server' })
      }

      const verified = await verifyGooglePurchase({
        packageName: pkg,
        productId,
        purchaseToken,
        isSubscription: Boolean(isSubscription) || SUB_IDS.includes(productId),
      })
      if (!verified.ok) {
        req.log.warn({ productId, message: verified.error }, 'Google purchase verification failed')
        return reply.status(400).send({ error: verified.error ?? 'Purchase verification failed' })
      }

      const storeTxId = orderId || verified.data?.orderId || purchaseToken
      const expiresAt = verified.data?.expiryTimeMillis
        ? new Date(Number(verified.data.expiryTimeMillis))
        : null

      const credit = await creditForProduct(req.log, {
        userId,
        productId,
        platform: 'android',
        storeTransactionId: storeTxId,
        environment: verified.data?.purchaseType === 0 ? 'sandbox' : 'production',
        expiresAt,
      })
      return credit
    },
  )
}

// ─── Credit logic (shared by iOS + Android) ──────────────────────────────────

async function creditForProduct(
  log: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void },
  params: {
    userId: string
    productId: string
    platform: 'ios' | 'android'
    storeTransactionId: string
    environment: 'sandbox' | 'production'
    expiresAt: Date | null
  },
): Promise<CreditResult> {
  const { userId, productId, platform, storeTransactionId, environment, expiresAt } = params

  // Consumable coin pack?
  const pack = coinPackFromIapProductId(productId)
  if (pack) {
    return creditCoins({ log, userId, productId, platform, storeTransactionId, pack })
  }

  // Premium subscription?
  if (SUB_IDS.includes(productId)) {
    return creditSubscription({ log, userId, productId, platform, storeTransactionId, environment, expiresAt })
  }

  // Season pass unlock?
  if (productId === SEASON_PASS_ID) {
    return creditSeasonPass({ log, userId, productId, platform, storeTransactionId })
  }

  log.warn({ productId }, 'verified a receipt for an unknown product id')
  return { productId }
}

async function creditCoins(args: {
  log: { info: (o: unknown, m?: string) => void }
  userId: string
  productId: string
  platform: 'ios' | 'android'
  storeTransactionId: string
  pack: (typeof COIN_PACKS)[number]
}): Promise<CreditResult> {
  const { log, userId, productId, platform, storeTransactionId, pack } = args
  const total = pack.amount + pack.bonus

  return prisma.$transaction(async (tx) => {
    // Dedup on the store transaction id — Apple + Google can replay the
    // notification, and the client can also retry on flaky network.
    const existing = await tx.purchase.findUnique({ where: { storeTransactionId } })
    if (existing && existing.status === 'completed') {
      log.info({ storeTransactionId, userId }, 'coin purchase replay — already credited')
      return { productId, starCoinsCredited: 0 }
    }
    if (existing) {
      await tx.purchase.update({ where: { id: existing.id }, data: { status: 'completed' } })
    } else {
      await tx.purchase.create({
        data: {
          userId,
          packId: pack.id,
          starCoins: total,
          priceCents: pack.priceCents,
          currency: pack.currency,
          platform,
          productId,
          storeTransactionId,
          status: 'completed',
        },
      })
    }
    await tx.user.update({
      where: { id: userId },
      data: { starCoins: { increment: total } },
    })
    log.info({ userId, productId, total }, 'coin purchase credited via IAP')
    return { productId, starCoinsCredited: total }
  })
}

async function creditSubscription(args: {
  log: { info: (o: unknown, m?: string) => void }
  userId: string
  productId: string
  platform: 'ios' | 'android'
  storeTransactionId: string
  environment: 'sandbox' | 'production'
  expiresAt: Date | null
}): Promise<CreditResult> {
  const { log, userId, productId, platform, storeTransactionId, environment, expiresAt } = args
  await prisma.subscription.upsert({
    where: { storeSubscriptionId: storeTransactionId },
    update: {
      status: 'active',
      productId,
      expiresAt,
      environment,
      autoRenewing: true,
      lastVerifiedAt: new Date(),
    },
    create: {
      userId,
      platform,
      productId,
      storeSubscriptionId: storeTransactionId,
      status: 'active',
      expiresAt,
      environment,
      autoRenewing: true,
    },
  })
  await prisma.user.update({
    where: { id: userId },
    data: { premium: true, premiumUntil: expiresAt, premiumPlatform: platform },
  })
  log.info({ userId, productId, expiresAt }, 'subscription credited via IAP')
  return { productId, premium: true }
}

async function creditSeasonPass(args: {
  log: { info: (o: unknown, m?: string) => void }
  userId: string
  productId: string
  platform: 'ios' | 'android'
  storeTransactionId: string
}): Promise<CreditResult> {
  const { log, userId, productId, platform, storeTransactionId } = args
  // Season pass is a non-consumable — we only need to mark it bought. A
  // Purchase row is still useful for analytics + refund tracking.
  await prisma.purchase.upsert({
    where: { storeTransactionId },
    update: { status: 'completed' },
    create: {
      userId,
      packId: 'season_pass',
      starCoins: 0,
      priceCents: 0,
      currency: 'usd',
      platform,
      productId,
      storeTransactionId,
      status: 'completed',
    },
  })
  log.info({ userId, productId }, 'season pass credited via IAP')
  return { productId, seasonPass: true }
}

// ─── Apple verifyReceipt ─────────────────────────────────────────────────────

type AppleVerifyResult =
  | { ok: true; body: any; status: 0 }
  | { ok: false; status: number; body?: any }

async function verifyAppleReceipt(receipt: string, useSandbox: boolean): Promise<AppleVerifyResult> {
  if (!env.APPLE_IAP_SHARED_SECRET) {
    return { ok: false, status: -1, body: { error: 'APPLE_IAP_SHARED_SECRET not set' } }
  }
  const body = {
    'receipt-data': receipt,
    password: env.APPLE_IAP_SHARED_SECRET,
    'exclude-old-transactions': false,
  }
  const first = await postJson(useSandbox ? APPLE_SANDBOX_URL : APPLE_PROD_URL, body)
  if (first?.status === 0) return { ok: true, body: first, status: 0 }
  // 21007 = "this receipt is from the test environment, but it was sent to
  // the production environment". Re-verify against sandbox.
  if (first?.status === 21007) {
    const retry = await postJson(APPLE_SANDBOX_URL, body)
    if (retry?.status === 0) return { ok: true, body: retry, status: 0 }
    return { ok: false, status: retry?.status ?? -1, body: retry }
  }
  return { ok: false, status: first?.status ?? -1, body: first }
}

async function postJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  try {
    return await res.json()
  } catch {
    return null
  }
}

// ─── Google Play purchase verification ───────────────────────────────────────

type GoogleVerifyResult =
  | { ok: true; data: any }
  | { ok: false; error?: string }

/**
 * Verify a Play Billing purchase via the Android Publisher API.
 *
 *   GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{pkg}/purchases/products/{sku}/tokens/{token}
 *   GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{pkg}/purchases/subscriptions/{sku}/tokens/{token}
 *
 * Auth is a Google service account OAuth2 access token with the
 * `androidpublisher` scope. The service account must be linked to the Play
 * Console project and granted "View financial data" + "Manage orders"
 * permissions on the app.
 */
async function verifyGooglePurchase(args: {
  packageName: string
  productId: string
  purchaseToken: string
  isSubscription: boolean
}): Promise<GoogleVerifyResult> {
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
    return { ok: false, error: 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not set' }
  }
  const token = await getGoogleAccessToken(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON)
  if (!token) return { ok: false, error: 'Could not obtain Google access token' }

  const kind = args.isSubscription ? 'subscriptions' : 'products'
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(args.packageName)}/purchases/${kind}/${encodeURIComponent(args.productId)}/tokens/${encodeURIComponent(args.purchaseToken)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, error: `Play API ${res.status}: ${text.slice(0, 200)}` }
  }
  const data = await res.json()
  // For products, purchaseState 0 = purchased, 1 = canceled, 2 = pending.
  // For subscriptions, an active sub has paymentState 1 (received) or 2 (free trial).
  if (!args.isSubscription) {
    if (data.purchaseState !== 0) {
      return { ok: false, error: `Product not in purchased state (purchaseState=${data.purchaseState})` }
    }
  } else {
    if (data.paymentState !== 1 && data.paymentState !== 2) {
      return { ok: false, error: `Subscription not active (paymentState=${data.paymentState})` }
    }
  }
  return { ok: true, data }
}

/**
 * Exchange a service-account JSON key for a short-lived OAuth2 access token.
 * Signs a JWT with RS256 and POSTs it to Google's token endpoint. Uses Node's
 * built-in `crypto` — no third-party dep needed.
 */
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string | null> {
  try {
    const sa = JSON.parse(serviceAccountJson) as {
      client_email: string
      private_key: string
      token_uri?: string
    }
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const claims = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }
    const { createSign } = await import('crypto')
    const b64url = (buf: Buffer | string) =>
      Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`
    const signer = createSign('RSA-SHA256')
    signer.update(signingInput)
    signer.end()
    const signature = signer.sign(sa.private_key).toString('base64')
      .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
    const jwt = `${signingInput}.${signature}`

    const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { access_token?: string }
    return json.access_token ?? null
  } catch {
    return null
  }
}
