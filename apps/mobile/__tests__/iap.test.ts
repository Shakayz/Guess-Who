/**
 * iap.test.ts
 *
 * Tests for lib/iap.ts — the react-native-iap adapter that turns a store
 * purchase into a verified server credit. The interesting bits:
 *
 *   - isIapAvailable() returns false on web (avoid crashing dev tools)
 *   - A web purchaseCoinPack rejects with IAPNotImplementedError
 *   - iOS happy path: purchaseUpdatedListener → /apple/verify → finishTransaction
 *   - Android happy path uses the product verify endpoint for consumables
 *   - Verification failure rejects the caller's promise AND leaves the
 *     transaction unfinished (so the next app open retries)
 *   - User cancel rejects with IAPCancelledError (no verify POST)
 *   - openManageSubscription() deep-links correctly per platform
 *
 * All network + react-native-iap calls are mocked so the tests run in Node.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CoinPack, PremiumPlan } from '@red-handed/shared'

;(globalThis as any).__DEV__ = false

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}))

const platformOsRef: { os: 'ios' | 'android' | 'web' } = { os: 'ios' }
const linkingOpenMock = vi.fn().mockResolvedValue(undefined)
vi.mock('react-native', () => ({
  Platform: {
    get OS() { return platformOsRef.os },
    select: (s: any) => s[platformOsRef.os] ?? s.default,
  },
  Linking: { openURL: (url: string) => linkingOpenMock(url) },
}))

// react-native-iap mock — each test wires the listener callbacks via the
// *Listener() functions so it can simulate a purchase landing in the queue.
const initConnectionMock = vi.fn().mockResolvedValue(undefined)
const endConnectionMock = vi.fn().mockResolvedValue(undefined)
const flushFailedAndroidMock = vi.fn().mockResolvedValue(undefined)
const finishTransactionMock = vi.fn().mockResolvedValue(undefined)
const getAvailablePurchasesMock = vi.fn().mockResolvedValue([])
const getSubscriptionsMock = vi.fn().mockResolvedValue([])
const requestPurchaseMock = vi.fn().mockResolvedValue(undefined)
const requestSubscriptionMock = vi.fn().mockResolvedValue(undefined)

let purchaseCallbacks: Array<(p: any) => void> = []
let errorCallbacks: Array<(e: any) => void> = []
const purchaseUpdatedListenerMock = vi.fn((cb: (p: any) => void) => {
  purchaseCallbacks.push(cb)
  return { remove: vi.fn(() => { purchaseCallbacks = purchaseCallbacks.filter((c) => c !== cb) }) }
})
const purchaseErrorListenerMock = vi.fn((cb: (e: any) => void) => {
  errorCallbacks.push(cb)
  return { remove: vi.fn(() => { errorCallbacks = errorCallbacks.filter((c) => c !== cb) }) }
})

vi.mock('react-native-iap', () => ({
  initConnection: initConnectionMock,
  endConnection: endConnectionMock,
  flushFailedPurchasesCachedAsPendingAndroid: flushFailedAndroidMock,
  finishTransaction: finishTransactionMock,
  getAvailablePurchases: getAvailablePurchasesMock,
  getSubscriptions: getSubscriptionsMock,
  requestPurchase: requestPurchaseMock,
  requestSubscription: requestSubscriptionMock,
  purchaseUpdatedListener: purchaseUpdatedListenerMock,
  purchaseErrorListener: purchaseErrorListenerMock,
}))

const apiPostMock = vi.fn()
vi.mock('../lib/api', () => ({
  api: {
    post: (path: string, body: unknown) => apiPostMock(path, body),
    get: vi.fn(),
  },
}))

beforeEach(() => {
  platformOsRef.os = 'ios'
  purchaseCallbacks = []
  errorCallbacks = []
  vi.resetModules()
  vi.clearAllMocks()
  // Defaults that most tests want — overridden per-test as needed.
  initConnectionMock.mockResolvedValue(undefined)
  endConnectionMock.mockResolvedValue(undefined)
  flushFailedAndroidMock.mockResolvedValue(undefined)
  finishTransactionMock.mockResolvedValue(undefined)
  getAvailablePurchasesMock.mockResolvedValue([])
  getSubscriptionsMock.mockResolvedValue([])
  requestPurchaseMock.mockResolvedValue(undefined)
  requestSubscriptionMock.mockResolvedValue(undefined)
})

const IOS_PACK: CoinPack = {
  id: 'pack_500',
  amount: 500,
  bonus: 0,
  priceCents: 499,
  currency: 'usd',
  iosProductId: 'com.redhanded.pack500',
  androidProductId: 'pack_500',
  stripePriceId: 'price_fake',
}

const IOS_PREMIUM: PremiumPlan = {
  id: 'yearly',
  priceCents: 4999,
  currency: 'usd',
  stripePriceId: 'price_premium_yearly',
  interval: 'year',
  iosProductId: 'com.redhanded.premium.yearly',
  androidProductId: 'premium',
  androidBasePlanId: 'yearly',
} as unknown as PremiumPlan

describe('isIapAvailable', () => {
  it('is true on iOS and Android, false on web', async () => {
    const mod = await import('../lib/iap')
    platformOsRef.os = 'ios'
    expect(mod.isIapAvailable()).toBe(true)
    platformOsRef.os = 'android'
    expect(mod.isIapAvailable()).toBe(true)
    platformOsRef.os = 'web'
    expect(mod.isIapAvailable()).toBe(false)
  })
})

describe('purchaseCoinPack — web fallback', () => {
  it('throws IAPNotImplementedError on platforms without billing', async () => {
    platformOsRef.os = 'web'
    const { purchaseCoinPack, IAPNotImplementedError } = await import('../lib/iap')
    await expect(purchaseCoinPack(IOS_PACK)).rejects.toBeInstanceOf(IAPNotImplementedError)
  })
})

describe('purchaseCoinPack — iOS happy path', () => {
  it('verifies the JWS server-side, finishes the transaction as consumable, and resolves', async () => {
    platformOsRef.os = 'ios'
    apiPostMock.mockResolvedValue({ status: 'credited', starCoins: 1500 })

    const { purchaseCoinPack } = await import('../lib/iap')
    const pending = purchaseCoinPack(IOS_PACK)

    // Wait a tick so ensureConnection() attaches the listener.
    await new Promise((r) => setTimeout(r, 0))
    expect(purchaseCallbacks).toHaveLength(1)

    // Simulate the native layer delivering the purchase.
    await purchaseCallbacks[0]({
      productId: IOS_PACK.iosProductId,
      transactionId: 'tx-123',
      verificationResultIOS: 'signed.jws.blob',
    })

    const result = await pending

    expect(result).toEqual({ status: 'credited', starCoins: 1500 })
    expect(apiPostMock).toHaveBeenCalledWith('/shop/iap/apple/verify', {
      signedTransaction: 'signed.jws.blob',
    })
    // Consumables must be finished with isConsumable: true so StoreKit /
    // Play Billing clear them from the queue.
    expect(finishTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({ isConsumable: true }),
    )
  })

  it('rejects with IAPVerificationError when /verify fails and leaves the txn unfinished', async () => {
    platformOsRef.os = 'ios'
    apiPostMock.mockRejectedValue(new Error('server_rejected'))

    const { purchaseCoinPack, IAPVerificationError } = await import('../lib/iap')
    const pending = purchaseCoinPack(IOS_PACK)
    await new Promise((r) => setTimeout(r, 0))

    await purchaseCallbacks[0]({
      productId: IOS_PACK.iosProductId,
      transactionId: 'tx-err',
      verificationResultIOS: 'signed.jws.blob',
    })

    await expect(pending).rejects.toBeInstanceOf(IAPVerificationError)
    // Critical: we must NOT have finished the transaction — otherwise the
    // queue gets drained and a charged-but-not-credited user can't retry.
    expect(finishTransactionMock).not.toHaveBeenCalled()
  })
})

describe('purchaseCoinPack — user cancel', () => {
  it('rejects with IAPCancelledError when the native sheet returns E_USER_CANCELLED', async () => {
    platformOsRef.os = 'ios'
    const { purchaseCoinPack, IAPCancelledError } = await import('../lib/iap')

    const pending = purchaseCoinPack(IOS_PACK)
    await new Promise((r) => setTimeout(r, 0))

    errorCallbacks[0]({ code: 'E_USER_CANCELLED', message: 'user cancelled' })

    await expect(pending).rejects.toBeInstanceOf(IAPCancelledError)
    expect(apiPostMock).not.toHaveBeenCalled()
    expect(finishTransactionMock).not.toHaveBeenCalled()
  })

  it('rejects with IAPVerificationError on other native errors', async () => {
    platformOsRef.os = 'ios'
    const { purchaseCoinPack, IAPVerificationError, IAPCancelledError } = await import(
      '../lib/iap'
    )

    const pending = purchaseCoinPack(IOS_PACK)
    await new Promise((r) => setTimeout(r, 0))

    errorCallbacks[0]({ code: 'E_UNKNOWN', message: 'boom' })

    await expect(pending).rejects.toBeInstanceOf(IAPVerificationError)
    // Not a cancel — don't want the UI showing the cancel copy.
    await expect(pending).rejects.not.toBeInstanceOf(IAPCancelledError)
  })
})

describe('purchaseCoinPack — Android happy path', () => {
  it('calls the google/verify/product endpoint with the token + productId', async () => {
    platformOsRef.os = 'android'
    apiPostMock.mockResolvedValue({ status: 'credited', starCoins: 500 })

    const { purchaseCoinPack } = await import('../lib/iap')
    const pending = purchaseCoinPack(IOS_PACK)
    await new Promise((r) => setTimeout(r, 0))

    await purchaseCallbacks[0]({
      productId: IOS_PACK.androidProductId,
      purchaseToken: 'gp-token-xyz',
      transactionId: 'tx-a',
    })

    await pending
    expect(apiPostMock).toHaveBeenCalledWith('/shop/iap/google/verify/product', {
      productId: IOS_PACK.androidProductId,
      purchaseToken: 'gp-token-xyz',
    })
  })

  it('flushes cached-pending Android purchases on first connect (boot recovery)', async () => {
    platformOsRef.os = 'android'
    apiPostMock.mockResolvedValue({ status: 'credited', starCoins: 1 })

    const { purchaseCoinPack } = await import('../lib/iap')
    const pending = purchaseCoinPack(IOS_PACK)
    await new Promise((r) => setTimeout(r, 0))

    expect(flushFailedAndroidMock).toHaveBeenCalled()

    // Resolve the outstanding purchase so the pending promise doesn't leak.
    await purchaseCallbacks[0]({
      productId: IOS_PACK.androidProductId,
      purchaseToken: 't',
      transactionId: 'x',
    })
    await pending
  })
})

describe('subscribePremium — iOS', () => {
  it('kicks off requestSubscription with the iOS product and treats the txn as non-consumable', async () => {
    platformOsRef.os = 'ios'
    apiPostMock.mockResolvedValue({
      status: 'premium_extended',
      premiumUntil: '2026-05-01T00:00:00.000Z',
      planId: 'yearly',
    })

    const { subscribePremium } = await import('../lib/iap')
    const pending = subscribePremium(IOS_PREMIUM)
    await new Promise((r) => setTimeout(r, 0))

    expect(requestSubscriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ sku: IOS_PREMIUM.iosProductId }),
    )

    await purchaseCallbacks[0]({
      productId: IOS_PREMIUM.iosProductId,
      transactionId: 'sub-1',
      verificationResultIOS: 'signed.jws',
    })

    const result = await pending
    expect(result).toEqual(expect.objectContaining({ status: 'premium_extended' }))
    expect(finishTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({ isConsumable: false }),
    )
  })
})

describe('subscribePremium — Android resolves the offerToken from the store', () => {
  it('fetches subscription details, picks the matching base plan, and forwards the basePlanId to verify', async () => {
    platformOsRef.os = 'android'
    getSubscriptionsMock.mockResolvedValue([
      {
        productId: 'premium',
        subscriptionOfferDetails: [
          { basePlanId: 'monthly', offerToken: 'tok-monthly' },
          { basePlanId: 'yearly', offerToken: 'tok-yearly' },
        ],
      },
    ])
    apiPostMock.mockResolvedValue({
      status: 'premium_extended',
      premiumUntil: '2026-05-01T00:00:00.000Z',
      planId: 'yearly',
    })

    const { subscribePremium } = await import('../lib/iap')
    const pending = subscribePremium(IOS_PREMIUM)
    await new Promise((r) => setTimeout(r, 0))

    expect(requestSubscriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: 'premium',
        subscriptionOffers: [{ sku: 'premium', offerToken: 'tok-yearly' }],
      }),
    )

    await purchaseCallbacks[0]({
      productId: 'premium',
      purchaseToken: 'gp-sub-token',
      transactionId: 'sub-a',
    })

    await pending
    expect(apiPostMock).toHaveBeenCalledWith('/shop/iap/google/verify/subscription', {
      productId: 'premium',
      purchaseToken: 'gp-sub-token',
      basePlanId: 'yearly',
    })
  })

  it('rejects when the requested base plan is not offered in the store', async () => {
    platformOsRef.os = 'android'
    getSubscriptionsMock.mockResolvedValue([
      {
        productId: 'premium',
        subscriptionOfferDetails: [{ basePlanId: 'monthly', offerToken: 'tok' }],
      },
    ])

    const { subscribePremium, IAPVerificationError } = await import('../lib/iap')
    await expect(subscribePremium(IOS_PREMIUM)).rejects.toBeInstanceOf(IAPVerificationError)
  })
})

describe('openManageSubscription', () => {
  it('deep-links to the App Store subscription manager on iOS', async () => {
    platformOsRef.os = 'ios'
    const { openManageSubscription } = await import('../lib/iap')
    await openManageSubscription()
    expect(linkingOpenMock).toHaveBeenCalledWith(
      'https://apps.apple.com/account/subscriptions',
    )
  })

  it('deep-links to the Play Store with sku + package on Android', async () => {
    platformOsRef.os = 'android'
    const { openManageSubscription } = await import('../lib/iap')
    await openManageSubscription()
    const url = linkingOpenMock.mock.calls[0][0] as string
    expect(url).toMatch(/play\.google\.com\/store\/account\/subscriptions/)
    expect(url).toMatch(/sku=premium/)
    expect(url).toMatch(/package=com\.redhanded\.game/)
  })

  it('throws IAPNotImplementedError on web', async () => {
    platformOsRef.os = 'web'
    const { openManageSubscription, IAPNotImplementedError } = await import('../lib/iap')
    await expect(openManageSubscription()).rejects.toBeInstanceOf(IAPNotImplementedError)
  })
})

describe('restorePurchases', () => {
  it('is a web no-op (throws IAPNotImplementedError)', async () => {
    platformOsRef.os = 'web'
    const { restorePurchases, IAPNotImplementedError } = await import('../lib/iap')
    await expect(restorePurchases()).rejects.toBeInstanceOf(IAPNotImplementedError)
  })

  it('re-verifies every active purchase and finishes each one (iOS)', async () => {
    platformOsRef.os = 'ios'
    getAvailablePurchasesMock.mockResolvedValue([
      {
        productId: IOS_PACK.iosProductId,
        verificationResultIOS: 'jws1',
        transactionId: 'tx-1',
      },
      {
        productId: IOS_PREMIUM.iosProductId,
        verificationResultIOS: 'jws2',
        transactionId: 'tx-2',
      },
    ])
    apiPostMock.mockResolvedValue({ status: 'credited', starCoins: 1 })

    const { restorePurchases } = await import('../lib/iap')
    await restorePurchases()

    expect(apiPostMock).toHaveBeenCalledTimes(2)
    expect(finishTransactionMock).toHaveBeenCalledTimes(2)
  })

  it('does not throw when an individual purchase fails to re-verify', async () => {
    platformOsRef.os = 'ios'
    getAvailablePurchasesMock.mockResolvedValue([
      {
        productId: IOS_PACK.iosProductId,
        verificationResultIOS: 'jws1',
        transactionId: 'tx-1',
      },
    ])
    apiPostMock.mockRejectedValue(new Error('server_down'))

    const { restorePurchases } = await import('../lib/iap')
    await expect(restorePurchases()).resolves.toBeUndefined()
  })
})

describe('shutdownIap', () => {
  it('no-ops before any connection has been established', async () => {
    const { shutdownIap } = await import('../lib/iap')
    await expect(shutdownIap()).resolves.toBeUndefined()
    expect(endConnectionMock).not.toHaveBeenCalled()
  })

  it('closes the native connection after a connect-via-purchase flow', async () => {
    platformOsRef.os = 'ios'
    apiPostMock.mockResolvedValue({ status: 'credited', starCoins: 1 })

    const { purchaseCoinPack, shutdownIap } = await import('../lib/iap')
    const pending = purchaseCoinPack(IOS_PACK)
    await new Promise((r) => setTimeout(r, 0))

    await purchaseCallbacks[0]({
      productId: IOS_PACK.iosProductId,
      verificationResultIOS: 'jws',
      transactionId: 'x',
    })
    await pending

    await shutdownIap()

    expect(endConnectionMock).toHaveBeenCalled()
  })
})
