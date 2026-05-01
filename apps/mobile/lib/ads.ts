import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { createLogger } from './logger'

const log = createLogger('ads')

// Threshold for showing ads. Kept in code only — never surfaced in UI.
const ADS_MIN_LEVEL = 3

// Expo Go bundles a fixed set of native modules; react-native-google-mobile-ads
// isn't one of them, so importing it at module scope in Expo Go red-screens
// the app. Gate all native access behind this check and no-op in Expo Go.
const isExpoGo = Constants.appOwnership === 'expo'

type AdsModule = typeof import('react-native-google-mobile-ads')
let ads: AdsModule | null = null
// Dynamic-import the AdMob SDK so vitest's `vi.mock` can intercept the module.
// `require` from a transformed ESM file slips through to Node's CJS loader and
// the package's RN-only source fails to parse there. Top-level await keeps
// the public API synchronous-feeling: callers like initAds() simply await the
// module before touching `ads`.
const adsLoadPromise: Promise<void> = (async () => {
  if (isExpoGo) return
  try {
    ads = await import('react-native-google-mobile-ads')
  } catch (e: any) {
    log.warn('ads module failed to load', { message: e?.message })
  }
})()

const PROD_INTERSTITIAL_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL,
  android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL,
})

let initialized = false
// `InterstitialAd`'s constructor is `protected`, so `InstanceType<…>` errors
// out. The public factory `createForAdRequest` returns the same instance type,
// so derive it from the factory's return type instead.
let interstitial: ReturnType<AdsModule['InterstitialAd']['createForAdRequest']> | null = null
let interstitialLoaded = false
const unsubs: Array<() => void> = []
let userMeta: { level: number; isPremium: boolean } = { level: 0, isPremium: false }

export function setAdsUserMeta(meta: { level?: number; isPremium?: boolean }) {
  userMeta = {
    level: meta.level ?? userMeta.level,
    isPremium: meta.isPremium ?? userMeta.isPremium,
  }
}

function disposeInterstitial() {
  while (unsubs.length) {
    try { unsubs.pop()!() } catch {}
  }
  interstitial = null
  interstitialLoaded = false
}

function preloadInterstitial() {
  if (!ads) return
  disposeInterstitial()
  const unitId =
    __DEV__ || !PROD_INTERSTITIAL_ID ? ads.TestIds.INTERSTITIAL : PROD_INTERSTITIAL_ID
  const ad = ads.InterstitialAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: true,
  })
  interstitial = ad

  unsubs.push(
    ad.addAdEventListener(ads.AdEventType.LOADED, () => {
      interstitialLoaded = true
    }),
  )
  unsubs.push(
    ad.addAdEventListener(ads.AdEventType.ERROR, (err: any) => {
      interstitialLoaded = false
      log.warn('interstitial load error', { message: err?.message })
    }),
  )
  unsubs.push(
    ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
      interstitialLoaded = false
      setTimeout(preloadInterstitial, 250)
    }),
  )

  try {
    ad.load()
  } catch (e: any) {
    log.warn('interstitial load threw', { message: e?.message })
  }
}

// EU GDPR / UK UK-GDPR compliance via Google's UMP SDK. Without this, EU users
// cannot legally see personalized ads and AdMob policy may serve no ads at all.
async function requestConsent(): Promise<void> {
  if (!ads) return
  try {
    const info = await ads.AdsConsent.requestInfoUpdate({ tagForUnderAgeOfConsent: false })
    if (info.isConsentFormAvailable) {
      await ads.AdsConsent.showForm()
    }
  } catch (e: any) {
    // Non-fatal: fall back to non-personalized ads (already set per-request).
    log.warn('consent request failed', { message: e?.message })
  }
}

export async function initAds() {
  if (initialized) return
  // Wait for the lazy import to settle. Without this, the very first
  // initAds() call after app boot races the dynamic import and silently
  // skips ads init forever.
  await adsLoadPromise
  if (!ads) {
    if (isExpoGo) log.info('ads disabled: running in Expo Go')
    return
  }
  initialized = true
  try {
    await requestConsent()
    await ads.default().setRequestConfiguration({
      maxAdContentRating: ads.MaxAdContentRating.T,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    })
    await ads.default().initialize()
    log.info('ads sdk initialized')
    preloadInterstitial()
  } catch (e: any) {
    log.warn('ads init failed', { message: e?.message })
    initialized = false
  }
}

function isEligible(): boolean {
  return !userMeta.isPremium && (userMeta.level ?? 0) >= ADS_MIN_LEVEL
}

/**
 * Resolves once the ad is dismissed, errors, or after a safety timeout.
 * Resolves immediately if the user is not eligible or no ad is ready, so
 * callers can `await` and then navigate without trapping the user.
 */
export function showInterstitialBetweenGames(): Promise<void> {
  if (!ads || !isEligible()) return Promise.resolve()
  const ad = interstitial
  if (!ad || !interstitialLoaded) {
    if (!ad) preloadInterstitial()
    else { try { ad.load() } catch {} }
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      try { unClosed() } catch {}
      try { unError() } catch {}
      clearTimeout(safety)
      resolve()
    }
    const unClosed = ad.addAdEventListener(ads!.AdEventType.CLOSED, finish)
    const unError = ad.addAdEventListener(ads!.AdEventType.ERROR, finish)
    const safety = setTimeout(finish, 30000)
    try {
      ad.show()
    } catch {
      finish()
    }
  })
}
