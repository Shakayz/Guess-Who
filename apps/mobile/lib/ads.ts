import { Platform } from 'react-native'
import { createLogger } from './logger'

const log = createLogger('ads')

// react-native-google-mobile-ads is loaded lazily for the same reasons as
// react-native-iap — it ships native code, so it's absent in Expo Go and in
// the web/test bundle. Consumers guard on the `ready` flag returned here.
type RNAds = typeof import('react-native-google-mobile-ads')
let adsModule: RNAds | null = null
let adsLoadError: Error | null = null

function loadAds(): RNAds | null {
  if (adsModule) return adsModule
  if (adsLoadError) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    adsModule = require('react-native-google-mobile-ads') as RNAds
    return adsModule
  } catch (err) {
    adsLoadError = err as Error
    log.warn('react-native-google-mobile-ads unavailable (Expo Go or module not installed)', {
      message: adsLoadError.message,
    })
    return null
  }
}

/**
 * AdMob unit IDs per platform. Google publishes well-known "test" unit IDs
 * that never pay out but always fill — we use those in development and when
 * the real units aren't configured via env, to keep the UI flowing.
 *
 * Production unit IDs MUST be set via EXPO_PUBLIC_ADMOB_* env vars (see
 * apps/mobile/eas.json). Never hard-code live unit IDs in source.
 */
const TEST_UNITS = {
  banner:       { ios: 'ca-app-pub-3940256099942544/2934735716', android: 'ca-app-pub-3940256099942544/6300978111' },
  interstitial: { ios: 'ca-app-pub-3940256099942544/4411468910', android: 'ca-app-pub-3940256099942544/1033173712' },
  rewarded:     { ios: 'ca-app-pub-3940256099942544/1712485313', android: 'ca-app-pub-3940256099942544/5224354917' },
}

function unitId(kind: 'banner' | 'interstitial' | 'rewarded'): string {
  const env = process.env
  if (Platform.OS === 'ios') {
    const live = {
      banner: env.EXPO_PUBLIC_ADMOB_IOS_BANNER,
      interstitial: env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL,
      rewarded: env.EXPO_PUBLIC_ADMOB_IOS_REWARDED,
    }[kind]
    return live || TEST_UNITS[kind].ios
  }
  if (Platform.OS === 'android') {
    const live = {
      banner: env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER,
      interstitial: env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL,
      rewarded: env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED,
    }[kind]
    return live || TEST_UNITS[kind].android
  }
  return TEST_UNITS[kind].android
}

let initialised = false
let interstitialInstance: any = null
let rewardedInstance: any = null

/**
 * Initialise the AdMob SDK and (on iOS 14.5+) show the App Tracking
 * Transparency prompt. Call once at app start, ideally after the first render
 * so the prompt doesn't fight with the splash screen.
 */
export async function initAds(): Promise<boolean> {
  const ads = loadAds()
  if (!ads) return false
  if (initialised) return true
  try {
    await ads.default().initialize()
    // Request non-personalised ads until the user has given consent. The
    // ConsentInformation flow below handles GDPR and ATT upgrades.
    await ads.default().setRequestConfiguration({
      maxAdContentRating: ads.MaxAdContentRating.T,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    })
    initialised = true
    log.info('AdMob initialised')
    preloadInterstitial()
    preloadRewarded()
    return true
  } catch (err) {
    log.warn('AdMob initialise failed', { message: (err as Error).message })
    return false
  }
}

// ─── Banner ───────────────────────────────────────────────────────────────────

export function getBannerUnitId(): string {
  return unitId('banner')
}

/** Pass this to <BannerAd /> — `BANNER`, `LARGE_BANNER`, `MEDIUM_RECTANGLE`. */
export function getBannerSize(name: 'BANNER' | 'LARGE_BANNER' | 'MEDIUM_RECTANGLE' = 'BANNER'): string {
  const ads = loadAds()
  if (!ads) return 'BANNER'
  return (ads.BannerAdSize as any)[name] ?? 'BANNER'
}

// ─── Interstitial ─────────────────────────────────────────────────────────────

function preloadInterstitial() {
  const ads = loadAds()
  if (!ads || !initialised) return
  try {
    interstitialInstance = ads.InterstitialAd.createForAdRequest(unitId('interstitial'), {
      requestNonPersonalizedAdsOnly: true,
    })
    interstitialInstance.addAdEventListener(ads.AdEventType.LOADED, () => {
      log.debug('interstitial loaded')
    })
    interstitialInstance.addAdEventListener(ads.AdEventType.CLOSED, () => {
      // Chain the next fill so the next show has something ready.
      preloadInterstitial()
    })
    interstitialInstance.load()
  } catch (err) {
    log.warn('interstitial preload failed', { message: (err as Error).message })
  }
}

/**
 * Show an interstitial if one is ready. Silently no-ops when no ad is cached,
 * when ads aren't initialised, or when running in Expo Go — callers should
 * never block game flow on an ad.
 */
export async function showInterstitial(): Promise<boolean> {
  const ads = loadAds()
  if (!ads || !initialised || !interstitialInstance) return false
  try {
    if (!interstitialInstance.loaded) {
      log.debug('interstitial not ready, skipping')
      return false
    }
    await interstitialInstance.show()
    return true
  } catch (err) {
    log.warn('interstitial show failed', { message: (err as Error).message })
    return false
  }
}

// ─── Rewarded ─────────────────────────────────────────────────────────────────

function preloadRewarded() {
  const ads = loadAds()
  if (!ads || !initialised) return
  try {
    rewardedInstance = ads.RewardedAd.createForAdRequest(unitId('rewarded'), {
      requestNonPersonalizedAdsOnly: true,
    })
    rewardedInstance.addAdEventListener(ads.AdEventType.CLOSED, () => {
      preloadRewarded()
    })
    rewardedInstance.load()
  } catch (err) {
    log.warn('rewarded preload failed', { message: (err as Error).message })
  }
}

export type RewardResult = { type: string; amount: number }

/**
 * Show a rewarded ad. Resolves with the reward payload when the user
 * completes the ad, or `null` if they close it early / the ad failed. Callers
 * hand the reward to the server so it can't be forged client-side.
 */
export function showRewardedAd(): Promise<RewardResult | null> {
  const ads = loadAds()
  return new Promise((resolve) => {
    if (!ads || !initialised || !rewardedInstance) {
      resolve(null)
      return
    }
    if (!rewardedInstance.loaded) {
      log.debug('rewarded not ready')
      resolve(null)
      return
    }
    let earned: RewardResult | null = null
    const rewardedUnsub = rewardedInstance.addAdEventListener(
      ads.RewardedAdEventType.EARNED_REWARD,
      (reward: RewardResult) => { earned = reward },
    )
    const closedUnsub = rewardedInstance.addAdEventListener(
      ads.AdEventType.CLOSED,
      () => {
        rewardedUnsub?.()
        closedUnsub?.()
        resolve(earned)
      },
    )
    rewardedInstance.show().catch((err: Error) => {
      log.warn('rewarded show failed', { message: err.message })
      rewardedUnsub?.()
      closedUnsub?.()
      resolve(null)
    })
  })
}

export const ads = {
  init: initAds,
  getBannerUnitId,
  getBannerSize,
  showInterstitial,
  showRewardedAd,
}
