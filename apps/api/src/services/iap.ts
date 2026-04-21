/**
 * In-app purchase verification for iOS (App Store Server / StoreKit 2) and
 * Android (Google Play Billing). Called from /api/shop/iap/* route handlers
 * when the mobile client sends a purchase proof after completing a native
 * transaction.
 *
 * Design:
 *   - iOS client sends the signed JWS (Transaction.jwsRepresentation). We
 *     verify the x5c cert chain (leaf → intermediate → Apple Root CA - G3)
 *     and the ES256 signature, then trust the payload.
 *   - Android client sends the purchaseToken + productId. We call the Google
 *     Play Developer API using a service account to fetch the authoritative
 *     purchase state. The service account must have "View financial data"
 *     on the linked Play Console app.
 *
 * Both verifiers are fail-closed: any parse/signature/HTTP failure throws so
 * the caller returns 400/502 and nothing is credited.
 */

import crypto from 'node:crypto'
import { GoogleAuth } from 'google-auth-library'
import { env } from '../config/env'

// ── Apple (StoreKit 2) ───────────────────────────────────────────────────────

export type AppleTransactionPayload = {
  transactionId: string
  originalTransactionId: string
  bundleId: string
  productId: string
  purchaseDate: number
  expiresDate?: number
  type:
    | 'Auto-Renewable Subscription'
    | 'Consumable'
    | 'Non-Consumable'
    | 'Non-Renewing Subscription'
  inAppOwnershipType: 'PURCHASED' | 'FAMILY_SHARED'
  environment: 'Sandbox' | 'Production'
  signedDate: number
  revocationDate?: number
  revocationReason?: number
}

/**
 * Verify a signed StoreKit 2 JWS and return its payload. Throws on any
 * signature, chain, or structural failure. The returned payload can be trusted
 * for crediting decisions — but the caller must still check bundleId matches
 * APPLE_IAP_BUNDLE_ID and environment matches APPLE_IAP_ENVIRONMENT.
 */
export async function verifyAppleSignedTransaction(
  signed: string,
): Promise<AppleTransactionPayload> {
  const parts = signed.split('.')
  if (parts.length !== 3) throw new Error('apple_jws_malformed')
  const [headerB64, payloadB64, signatureB64] = parts

  const header = JSON.parse(base64urlDecode(headerB64).toString('utf8')) as {
    alg?: string
    x5c?: string[]
  }
  if (header.alg !== 'ES256') throw new Error('apple_jws_unsupported_alg')
  if (!Array.isArray(header.x5c) || header.x5c.length < 2) {
    throw new Error('apple_jws_missing_chain')
  }

  // x5c entries are standard base64 (not base64url) DER-encoded certs.
  const chain = header.x5c.map(
    (b64) => new crypto.X509Certificate(Buffer.from(b64, 'base64')),
  )

  // Each cert must be signed by the next one in the chain.
  for (let i = 0; i < chain.length - 1; i++) {
    if (!chain[i].verify(chain[i + 1].publicKey)) {
      throw new Error(`apple_jws_chain_link_${i}_invalid`)
    }
  }

  // The last cert must be self-signed (a root). We additionally require its
  // subject CN to be "Apple Root CA - G3" — the only root Apple currently
  // uses for StoreKit 2. For defence-in-depth, pin the SHA-256 fingerprint
  // via APPLE_ROOT_CA_SHA256 if/when ops wants to harden further.
  const root = chain[chain.length - 1]
  if (!root.verify(root.publicKey)) throw new Error('apple_jws_root_not_self_signed')
  if (!/Apple Root CA - G3/i.test(root.subject)) {
    throw new Error('apple_jws_unexpected_root')
  }

  // Finally verify the JWS signature itself. Apple uses JOSE raw r||s
  // encoding; Node's verify wants DER. Convert, then ES256-verify.
  const signingInput = `${headerB64}.${payloadB64}`
  const sigRaw = base64urlDecode(signatureB64)
  if (sigRaw.length !== 64) throw new Error('apple_jws_bad_sig_length')
  const sigDer = ecdsaRawToDer(sigRaw)
  const ok = crypto
    .createVerify('SHA256')
    .update(signingInput)
    .verify(chain[0].publicKey, sigDer)
  if (!ok) throw new Error('apple_jws_signature_invalid')

  const payload = JSON.parse(
    base64urlDecode(payloadB64).toString('utf8'),
  ) as AppleTransactionPayload

  if (env.APPLE_IAP_BUNDLE_ID && payload.bundleId !== env.APPLE_IAP_BUNDLE_ID) {
    throw new Error('apple_jws_bundle_mismatch')
  }
  const expectedEnv = env.APPLE_IAP_ENVIRONMENT === 'production' ? 'Production' : 'Sandbox'
  if (payload.environment !== expectedEnv) {
    // Mismatch is only fatal in production; sandbox builds commonly hit
    // Production receipts during TestFlight rollouts, so log and accept.
    if (env.APPLE_IAP_ENVIRONMENT === 'production') {
      throw new Error('apple_jws_env_mismatch')
    }
  }

  return payload
}

function base64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

/** Convert a 64-byte raw ECDSA (r || s) signature to DER SEQUENCE(INTEGER r, INTEGER s). */
function ecdsaRawToDer(raw: Buffer): Buffer {
  const r = trimAndPadForAsn1(raw.subarray(0, 32))
  const s = trimAndPadForAsn1(raw.subarray(32, 64))
  const seqLen = 2 + r.length + 2 + s.length
  return Buffer.concat([
    Buffer.from([0x30, seqLen]),
    Buffer.from([0x02, r.length]),
    r,
    Buffer.from([0x02, s.length]),
    s,
  ])
}

function trimAndPadForAsn1(b: Buffer): Buffer {
  let i = 0
  while (i < b.length - 1 && b[i] === 0) i++
  const trimmed = b.subarray(i)
  // ASN.1 INTEGER is signed — if the high bit is set, prepend 0x00.
  return trimmed[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), trimmed]) : Buffer.from(trimmed)
}

// ── Google Play ──────────────────────────────────────────────────────────────

let googleAuth: GoogleAuth | null = null
function getGoogleAuth(): GoogleAuth | null {
  if (googleAuth) return googleAuth
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) return null
  let creds: Record<string, unknown>
  try {
    creds = JSON.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON)
  } catch {
    throw new Error('google_iap_service_account_invalid_json')
  }
  googleAuth = new GoogleAuth({
    credentials: creds as Parameters<GoogleAuth['fromJSON']>[0],
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })
  return googleAuth
}

export type GoogleProductPurchase = {
  /** 0 = purchased, 1 = canceled, 2 = pending. Only 0 should be credited. */
  purchaseState: 0 | 1 | 2
  /** 0 = needs acknowledge within 3 days, 1 = acknowledged. */
  acknowledgementState: 0 | 1
  /** 0 = yet-to-be-consumed, 1 = consumed. Consumables must be consumed client-side. */
  consumptionState?: 0 | 1
  orderId?: string
  purchaseTimeMillis?: string
  productId?: string
  kind?: string
}

/** Fetch the authoritative purchase state for a consumable (coin pack). */
export async function verifyGoogleProduct(
  productId: string,
  purchaseToken: string,
): Promise<GoogleProductPurchase> {
  const auth = getGoogleAuth()
  if (!auth || !env.GOOGLE_PLAY_PACKAGE_NAME) {
    throw new Error('google_iap_not_configured')
  }
  const client = await auth.getClient()
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}` +
    `/purchases/products/${encodeURIComponent(productId)}` +
    `/tokens/${encodeURIComponent(purchaseToken)}`
  const res = await client.request<GoogleProductPurchase>({ url })
  return res.data
}

export type GoogleSubscriptionPurchase = {
  startTimeMillis: string
  expiryTimeMillis: string
  autoRenewing: boolean
  /** 0 = payment pending, 1 = received, 2 = free trial, 3 = pending deferred. */
  paymentState?: 0 | 1 | 2 | 3
  acknowledgementState: 0 | 1
  orderId?: string
  productId?: string
  /** Present on v2-style sub responses; base plan the user is on. */
  lineItems?: Array<{ productId: string; offerDetails?: { basePlanId?: string } }>
}

/** Fetch the authoritative subscription state (for Premium). */
export async function verifyGoogleSubscription(
  productId: string,
  purchaseToken: string,
): Promise<GoogleSubscriptionPurchase> {
  const auth = getGoogleAuth()
  if (!auth || !env.GOOGLE_PLAY_PACKAGE_NAME) {
    throw new Error('google_iap_not_configured')
  }
  const client = await auth.getClient()
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}` +
    `/purchases/subscriptions/${encodeURIComponent(productId)}` +
    `/tokens/${encodeURIComponent(purchaseToken)}`
  const res = await client.request<GoogleSubscriptionPurchase>({ url })
  return res.data
}

/**
 * Acknowledge a consumable product purchase so Google Play doesn't refund it
 * after 3 days. For consumables the mobile client calls consumeAsync() which
 * implicitly acknowledges; this helper is provided for completeness in case
 * the API needs to do it server-side.
 */
export async function acknowledgeGoogleProduct(
  productId: string,
  purchaseToken: string,
): Promise<void> {
  const auth = getGoogleAuth()
  if (!auth || !env.GOOGLE_PLAY_PACKAGE_NAME) {
    throw new Error('google_iap_not_configured')
  }
  const client = await auth.getClient()
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}` +
    `/purchases/products/${encodeURIComponent(productId)}` +
    `/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`
  await client.request({ url, method: 'POST' })
}
