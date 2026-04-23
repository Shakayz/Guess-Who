import { Platform } from 'react-native'
import { IAP_PRODUCT_IDS, type IapProductId } from '@red-handed/shared'
import { api } from './api'
import { createLogger } from './logger'

const log = createLogger('iap')

// `react-native-iap` ships native code, so it only resolves inside a custom
// dev client or release build — not in Expo Go. We import it lazily so the JS
// bundle doesn't crash on startup when running in Expo Go, and so tests and
// the web typechecker don't trip on the native module.
type RNIap = typeof import('react-native-iap')
let rnIapModule: RNIap | null = null
let rnIapLoadError: Error | null = null

function loadRNIap(): RNIap | null {
  if (rnIapModule) return rnIapModule
  if (rnIapLoadError) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    rnIapModule = require('react-native-iap') as RNIap
    return rnIapModule
  } catch (err) {
    rnIapLoadError = err as Error
    log.warn('react-native-iap unavailable (Expo Go or module not installed)', {
      message: rnIapLoadError.message,
    })
    return null
  }
}

export type IapProduct = {
  productId: IapProductId
  title: string
  description: string
  localizedPrice: string
  currency: string
  priceAmount?: number
  type: 'consumable' | 'subscription' | 'non-consumable'
}

const COIN_IDS = Object.values(IAP_PRODUCT_IDS.coins) as IapProductId[]
const SUB_IDS  = Object.values(IAP_PRODUCT_IDS.subscriptions) as IapProductId[]
const NC_IDS   = Object.values(IAP_PRODUCT_IDS.nonConsumables) as IapProductId[]

let connected = false
let purchaseUpdateSub: { remove: () => void } | null = null
let purchaseErrorSub: { remove: () => void } | null = null

export type IapCreditResult = {
  productId: string
  starCoinsCredited?: number
  premium?: boolean
  seasonPass?: boolean
}

type Listeners = {
  onCredited?: (result: IapCreditResult) => void
  onError?: (err: Error) => void
}

let listeners: Listeners = {}

/**
 * Initialise the IAP connection and install a global purchase listener. Must
 * be called once after login (so server verification has a token). Safe to
 * call multiple times — subsequent calls are no-ops.
 */
export async function initIap(handlers: Listeners = {}): Promise<boolean> {
  listeners = { ...listeners, ...handlers }
  const iap = loadRNIap()
  if (!iap) return false
  if (connected) return true
  try {
    await iap.initConnection()
    connected = true

    purchaseUpdateSub = iap.purchaseUpdatedListener(async (purchase) => {
      try {
        const receipt = purchase.transactionReceipt
        if (!receipt) return
        log.info('purchase received', {
          productId: purchase.productId,
          platform: Platform.OS,
        })
        const credited = await verifyAndCredit(purchase)
        // Only finish the transaction once the server has acknowledged it,
        // otherwise a crash between verify + finish would lose the purchase.
        await iap.finishTransaction({ purchase, isConsumable: isConsumable(purchase.productId) })
        listeners.onCredited?.(credited)
      } catch (err) {
        log.error('purchase handling failed', { message: (err as Error).message })
        listeners.onError?.(err as Error)
      }
    })

    purchaseErrorSub = iap.purchaseErrorListener((error) => {
      // E_USER_CANCELLED is a normal cancel — downgrade noise.
      if (error.code === 'E_USER_CANCELLED') {
        log.debug('purchase cancelled by user')
        return
      }
      log.warn('purchase error', { code: error.code, message: error.message })
      listeners.onError?.(new Error(error.message))
    })

    return true
  } catch (err) {
    log.warn('initConnection failed', { message: (err as Error).message })
    return false
  }
}

/** Tear down IAP listeners and the native connection. Call on logout. */
export async function endIap(): Promise<void> {
  const iap = loadRNIap()
  if (!iap) return
  purchaseUpdateSub?.remove()
  purchaseErrorSub?.remove()
  purchaseUpdateSub = null
  purchaseErrorSub = null
  if (connected) {
    try { await iap.endConnection() } catch { /* ignore */ }
    connected = false
  }
}

/** Fetch product metadata for the coin packs (consumables). */
export async function fetchCoinProducts(): Promise<IapProduct[]> {
  const iap = loadRNIap()
  if (!iap || !connected) return []
  try {
    const products = await iap.getProducts({ skus: COIN_IDS })
    return products.map(normaliseProduct('consumable'))
  } catch (err) {
    log.warn('getProducts(coins) failed', { message: (err as Error).message })
    return []
  }
}

/** Fetch subscription offers for the Premium tier. */
export async function fetchSubscriptionProducts(): Promise<IapProduct[]> {
  const iap = loadRNIap()
  if (!iap || !connected) return []
  try {
    const subs = await iap.getSubscriptions({ skus: SUB_IDS })
    return subs.map(normaliseProduct('subscription'))
  } catch (err) {
    log.warn('getSubscriptions failed', { message: (err as Error).message })
    return []
  }
}

/** Fetch non-consumables (e.g. the season pass unlock). */
export async function fetchNonConsumables(): Promise<IapProduct[]> {
  const iap = loadRNIap()
  if (!iap || !connected) return []
  try {
    const products = await iap.getProducts({ skus: NC_IDS })
    return products.map(normaliseProduct('non-consumable'))
  } catch (err) {
    log.warn('getProducts(non-consumables) failed', { message: (err as Error).message })
    return []
  }
}

/** Kick off a coin-pack purchase. Resolves when the store dialog is shown — the
 *  credit happens asynchronously via the global purchase listener. */
export async function buyCoinPack(productId: IapProductId): Promise<void> {
  const iap = loadRNIap()
  if (!iap || !connected) throw new Error('In-app purchases are unavailable on this build')
  await iap.requestPurchase({ sku: productId })
}

/** Kick off a Premium subscription. Same async-credit flow as coin packs. */
export async function buySubscription(productId: IapProductId): Promise<void> {
  const iap = loadRNIap()
  if (!iap || !connected) throw new Error('In-app purchases are unavailable on this build')
  await iap.requestSubscription({ sku: productId })
}

/**
 * Restore previous purchases (Premium, season pass). Required by App Store
 * review guidelines 3.1.1 — every subscription screen must expose a Restore
 * button.
 */
export async function restorePurchases(): Promise<IapCreditResult[]> {
  const iap = loadRNIap()
  if (!iap || !connected) return []
  try {
    const available = await iap.getAvailablePurchases()
    const results: IapCreditResult[] = []
    for (const purchase of available) {
      try {
        const credited = await verifyAndCredit(purchase)
        results.push(credited)
      } catch (err) {
        log.warn('restore verify failed', { productId: purchase.productId, message: (err as Error).message })
      }
    }
    return results
  } catch (err) {
    log.warn('restorePurchases failed', { message: (err as Error).message })
    return []
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isConsumable(productId: string): boolean {
  return (COIN_IDS as string[]).includes(productId)
}

function normaliseProduct(type: IapProduct['type']) {
  return (raw: any): IapProduct => ({
    productId: raw.productId,
    title: raw.title ?? raw.name ?? raw.productId,
    description: raw.description ?? '',
    localizedPrice: raw.localizedPrice ?? raw.price ?? '',
    currency: raw.currency ?? '',
    priceAmount: typeof raw.price === 'number' ? raw.price : parseFloat(raw.price) || undefined,
    type,
  })
}

/** Send the store receipt to the server for verification and coin/tier credit. */
async function verifyAndCredit(purchase: any): Promise<IapCreditResult> {
  const productId: string = purchase.productId
  if (Platform.OS === 'ios') {
    const receipt: string = purchase.transactionReceipt
    return api.post<IapCreditResult>('/shop/iap/ios/verify', {
      productId,
      receipt,
      transactionId: purchase.transactionId,
      originalTransactionId: purchase.originalTransactionIdentifierIOS,
    })
  }
  // Android — Play Billing gives us purchaseToken + packageName.
  const purchaseToken: string = purchase.purchaseToken
  return api.post<IapCreditResult>('/shop/iap/android/verify', {
    productId,
    purchaseToken,
    packageName: purchase.packageNameAndroid,
    orderId: purchase.transactionId,
    isSubscription: (SUB_IDS as string[]).includes(productId),
  })
}
