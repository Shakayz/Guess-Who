/**
 * Native in-app purchase adapter. Dispatches to StoreKit 2 on iOS and Google
 * Play Billing on Android via react-native-iap, then POSTs the resulting
 * transaction proof to /api/shop/iap/* for server-side verification.
 *
 * Single entry point — shop.tsx never touches react-native-iap directly.
 *
 * Flow (per purchase):
 *   1. ensureConnection() — init once, attach purchase/error listeners.
 *   2. purchaseCoinPack / subscribePremium slots a `pending` promise, then
 *      fires requestPurchase / requestSubscription.
 *   3. The OS presents the native payment sheet.
 *   4. On success, the purchaseUpdatedListener fires with the Purchase:
 *        - iOS: verificationResultIOS is the StoreKit 2 JWS — posted to
 *          /api/shop/iap/apple/verify.
 *        - Android: purchaseToken + productId are posted to
 *          /api/shop/iap/google/verify/product (consumable) or
 *          /api/shop/iap/google/verify/subscription (premium).
 *      After the server credits the user we call finishTransaction to
 *      acknowledge/consume, then resolve the pending promise.
 *   5. On cancel / error the purchaseErrorListener rejects the pending
 *      promise with IAPCancelledError / IAPVerificationError.
 *
 * A transaction can also arrive out-of-band (e.g. Ask-to-Buy approval after
 * the app restarts). The listener handles those too — it's just that no
 * caller-facing promise gets resolved; the entitlement is applied silently.
 */

import { Platform, Linking } from 'react-native'
import type { EmitterSubscription } from 'react-native'
import Constants from 'expo-constants'
import type * as RNIapType from 'react-native-iap'
import type { CoinPack, PremiumPlan } from '@red-handed/shared'
import { api } from './api'
import { createLogger } from './logger'

const log = createLogger('iap')

// Expo Go doesn't bundle react-native-iap — importing it at module scope would
// red-screen the app. Lazy-require so Expo Go keeps working; all purchase
// entry points throw IAPNotImplementedError there.
const isExpoGo = Constants.appOwnership === 'expo'
let RNIap: typeof RNIapType | null = null
if (!isExpoGo) {
  try {
    RNIap = require('react-native-iap')
  } catch (e: any) {
    log.warn('iap module failed to load', { message: e?.message })
  }
}

export class IAPNotImplementedError extends Error {
  readonly code = 'iap_not_implemented'
  constructor() {
    super('Native in-app purchases are not available on this platform.')
  }
}

export class IAPCancelledError extends Error {
  readonly code = 'iap_cancelled'
  constructor() {
    super('Purchase cancelled')
  }
}

export class IAPVerificationError extends Error {
  readonly code = 'iap_verification_failed'
  constructor(message: string) {
    super(message)
  }
}

export type PurchaseResult =
  | { status: 'credited'; starCoins: number }
  | { status: 'premium_extended'; premiumUntil: string; planId: string }

// ── Connection + listener lifecycle ──────────────────────────────────────────
// A single pending slot is sufficient: the UI disables every purchase button
// while one is in flight, so we never have two user-initiated purchases
// concurrently. Out-of-band purchases (Ask-to-Buy, restore) land in the
// listener with `pending === null` and are handled silently.

type Pending = {
  /** iOS/Android SKU we're waiting on. Matched against purchase.productId. */
  sku: string
  /** Present for Android premium purchases — used by the verify endpoint to
   *  disambiguate monthly vs yearly base plan. */
  basePlanId?: string
  /** Whether this is a consumable (coin pack). Decides finishTransaction mode
   *  and which verify endpoint to call on Android. */
  isConsumable: boolean
  resolve: (r: PurchaseResult) => void
  reject: (e: Error) => void
}

let pending: Pending | null = null
let connected = false
let purchaseSub: EmitterSubscription | null = null
let errorSub: EmitterSubscription | null = null

async function ensureConnection(): Promise<void> {
  if (connected) return
  if (!RNIap || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
    throw new IAPNotImplementedError()
  }
  await RNIap.initConnection()
  // Flush any purchases that the Play Billing library cached as pending
  // during a previous crash/kill. No-op on iOS.
  if (Platform.OS === 'android') {
    try {
      await RNIap.flushFailedPurchasesCachedAsPendingAndroid()
    } catch (err) {
      log.warn('flushFailedPurchases failed', { error: (err as Error)?.message })
    }
  }
  purchaseSub = RNIap.purchaseUpdatedListener(handlePurchase)
  errorSub = RNIap.purchaseErrorListener(handleError)
  connected = true
  log.info('iap connection established')
}

async function handlePurchase(purchase: RNIapType.Purchase): Promise<void> {
  log.info('purchaseUpdated', {
    productId: purchase.productId,
    transactionId: purchase.transactionId,
    platform: Platform.OS,
  })

  const slot = pending
  // Only clear the slot once we're committed to handling this event. An
  // unrelated out-of-band purchase (different productId) shouldn't steal
  // the pending promise.
  const ownsSlot = slot !== null && slot.sku === purchase.productId
  if (ownsSlot) pending = null

  try {
    const result = await verifyOnServer(purchase, slot?.basePlanId)
    // Consumables need isConsumable: true so Android actually consumes and
    // iOS doesn't keep the transaction unfinished. Subscriptions pass false.
    const isConsumable = slot?.isConsumable ?? result.status === 'credited'
    await RNIap!.finishTransaction({ purchase, isConsumable })
    if (ownsSlot && slot) slot.resolve(result)
  } catch (err) {
    log.warn('purchase verification failed', { error: (err as Error)?.message })
    if (ownsSlot && slot) {
      slot.reject(
        err instanceof Error ? new IAPVerificationError(err.message) : new IAPVerificationError('verify_failed'),
      )
    }
    // Don't call finishTransaction on a verification failure — leaving the
    // transaction on the queue means the next app open retries (either via
    // getAvailablePurchases or automatic listener replay), which is the
    // safe path for a user who was charged but not credited.
  }
}

function handleError(err: RNIapType.PurchaseError): void {
  log.warn('purchaseError', { code: err.code, message: err.message })
  const slot = pending
  pending = null
  if (!slot) return
  if (err.code === 'E_USER_CANCELLED') {
    slot.reject(new IAPCancelledError())
  } else {
    slot.reject(new IAPVerificationError(err.message || err.code || 'purchase_error'))
  }
}

async function verifyOnServer(
  purchase: RNIapType.Purchase,
  androidBasePlanId: string | undefined,
): Promise<PurchaseResult> {
  if (Platform.OS === 'ios') {
    // verificationResultIOS carries the StoreKit 2 signed JWS — that's what
    // /api/shop/iap/apple/verify expects.
    const signed = purchase.verificationResultIOS
    if (!signed) throw new IAPVerificationError('missing_jws')
    return api.post<PurchaseResult>('/shop/iap/apple/verify', {
      signedTransaction: signed,
    })
  }
  if (Platform.OS === 'android') {
    const token = purchase.purchaseToken
    if (!token) throw new IAPVerificationError('missing_purchase_token')
    // The Premium subscription product uses a distinct id from coin packs,
    // so a substring match against the shared Premium product id is safe.
    const isSubscription = purchase.productId === PREMIUM_ANDROID_PRODUCT_ID
    if (isSubscription) {
      if (!androidBasePlanId) throw new IAPVerificationError('missing_base_plan_id')
      return api.post<PurchaseResult>('/shop/iap/google/verify/subscription', {
        productId: purchase.productId,
        purchaseToken: token,
        basePlanId: androidBasePlanId,
      })
    }
    return api.post<PurchaseResult>('/shop/iap/google/verify/product', {
      productId: purchase.productId,
      purchaseToken: token,
    })
  }
  throw new IAPNotImplementedError()
}

// Single Premium product id on Android — monthly/yearly are base plans under
// the same product. Mirrors the default in packages/shared/src/constants.
const PREMIUM_ANDROID_PRODUCT_ID = 'premium'

// ── Public API ───────────────────────────────────────────────────────────────

export function isIapAvailable(): boolean {
  return !!RNIap && (Platform.OS === 'ios' || Platform.OS === 'android')
}

export async function purchaseCoinPack(pack: CoinPack): Promise<PurchaseResult> {
  if (!isIapAvailable()) throw new IAPNotImplementedError()
  await ensureConnection()
  const sku = Platform.OS === 'ios' ? pack.iosProductId : pack.androidProductId

  return new Promise<PurchaseResult>((resolve, reject) => {
    pending = { sku, isConsumable: true, resolve, reject }
    const promise =
      Platform.OS === 'ios'
        ? RNIap!.requestPurchase({
            sku,
            andDangerouslyFinishTransactionAutomaticallyIOS: false,
          })
        : RNIap!.requestPurchase({ skus: [sku] })
    // requestPurchase resolves once the native sheet has accepted the
    // request, not when the transaction completes — the listener handles
    // the completion. We only care about the request-level rejection
    // (unconfigured SKU, network, etc).
    promise.catch((err) => {
      if (pending?.sku === sku) pending = null
      reject(err instanceof Error ? err : new IAPVerificationError(String(err)))
    })
  })
}

export async function subscribePremium(plan: PremiumPlan): Promise<PurchaseResult> {
  if (!isIapAvailable()) throw new IAPNotImplementedError()
  await ensureConnection()

  if (Platform.OS === 'ios') {
    const sku = plan.iosProductId
    return new Promise<PurchaseResult>((resolve, reject) => {
      pending = { sku, isConsumable: false, resolve, reject }
      RNIap!.requestSubscription({
        sku,
        andDangerouslyFinishTransactionAutomaticallyIOS: false,
      }).catch((err) => {
        if (pending?.sku === sku) pending = null
        reject(err instanceof Error ? err : new IAPVerificationError(String(err)))
      })
    })
  }

  // Android: subscription offers are base plans. We have to fetch the
  // subscription from the store, pick the base plan's offerToken, then call
  // requestSubscription with the [{ sku, offerToken }] tuple.
  const sku = plan.androidProductId
  const offerToken = await resolveAndroidOfferToken(sku, plan.androidBasePlanId)
  return new Promise<PurchaseResult>((resolve, reject) => {
    pending = { sku, basePlanId: plan.androidBasePlanId, isConsumable: false, resolve, reject }
    RNIap!.requestSubscription({
      sku,
      subscriptionOffers: [{ sku, offerToken }],
    }).catch((err) => {
      if (pending?.sku === sku) pending = null
      reject(err instanceof Error ? err : new IAPVerificationError(String(err)))
    })
  })
}

async function resolveAndroidOfferToken(
  productId: string,
  basePlanId: string,
): Promise<string> {
  const subs = await RNIap!.getSubscriptions({ skus: [productId] })
  const sub = subs.find((s) => s.productId === productId)
  if (!sub) throw new IAPVerificationError(`subscription_not_found:${productId}`)
  // `subscriptionOfferDetails` only exists on Android — typed narrow via cast
  // because RNIap's Subscription type is the union of SubscriptionAndroid |
  // SubscriptionIOS and the Android-only field isn't on the union.
  const offers = (sub as { subscriptionOfferDetails?: Array<{ basePlanId: string; offerToken: string }> })
    .subscriptionOfferDetails
  if (!offers || offers.length === 0) {
    throw new IAPVerificationError(`no_offers_for:${productId}`)
  }
  const matched = offers.find((o) => o.basePlanId === basePlanId)
  if (!matched) {
    throw new IAPVerificationError(`no_offer_for_base_plan:${basePlanId}`)
  }
  return matched.offerToken
}

/**
 * Opens the platform's subscription management UI. Apple / Google require
 * this be accessible from inside the app for subscribers — neither store
 * exposes a programmatic "cancel" call, so we deep-link to their settings.
 */
export async function openManageSubscription(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openURL('https://apps.apple.com/account/subscriptions')
    return
  }
  if (Platform.OS === 'android') {
    // Deep link to the specific product's management screen when we can; the
    // sku/package combo exists in Play Console.
    const pkg = 'com.redhanded.game'
    await Linking.openURL(
      `https://play.google.com/store/account/subscriptions?sku=${PREMIUM_ANDROID_PRODUCT_ID}&package=${pkg}`,
    )
    return
  }
  throw new IAPNotImplementedError()
}

/**
 * Re-entitle a user after a reinstall. Pulls the full history of active
 * purchases from the store and re-verifies each one on the server. Safe to
 * call multiple times — verification is idempotent thanks to the unique
 * platformTxId constraint on the Purchase table.
 */
export async function restorePurchases(): Promise<void> {
  if (!isIapAvailable()) throw new IAPNotImplementedError()
  await ensureConnection()
  const purchases = await RNIap!.getAvailablePurchases()
  log.info('restore: found purchases', { count: purchases.length })
  for (const purchase of purchases) {
    try {
      await verifyOnServer(purchase, undefined)
      await RNIap!.finishTransaction({ purchase, isConsumable: false })
    } catch (err) {
      log.warn('restore: verify failed for one purchase', {
        productId: purchase.productId,
        error: (err as Error)?.message,
      })
    }
  }
}

/**
 * Called from app teardown to release the native billing connection. The
 * listeners are torn down too so no ghost subscriptions linger.
 */
export async function shutdownIap(): Promise<void> {
  if (!connected || !RNIap) return
  purchaseSub?.remove()
  errorSub?.remove()
  purchaseSub = null
  errorSub = null
  try {
    await RNIap.endConnection()
  } catch (err) {
    log.warn('endConnection failed', { error: (err as Error)?.message })
  }
  connected = false
}
