import React from 'react'
import { View, Platform } from 'react-native'
import { getBannerUnitId, getBannerSize } from '../lib/ads'
import { createLogger } from '../lib/logger'

const log = createLogger('ad-banner')

type Props = {
  size?: 'BANNER' | 'LARGE_BANNER' | 'MEDIUM_RECTANGLE'
  /** Hide the ad entirely (e.g. for Premium users). */
  hidden?: boolean
}

/**
 * AdMob banner wrapper. Renders nothing if the native module isn't available
 * (Expo Go, web, tests) or if the user is Premium. Callers pass `hidden` based
 * on their own premium check — this component has no store knowledge so it
 * stays drop-in reusable across screens.
 */
export function AdBanner({ size = 'BANNER', hidden = false }: Props) {
  if (hidden) return null
  if (Platform.OS === 'web') return null

  let BannerAd: any
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    BannerAd = require('react-native-google-mobile-ads').BannerAd
  } catch (err) {
    log.debug('banner native module unavailable', { message: (err as Error).message })
    return null
  }

  return (
    <View className="items-center justify-center py-2">
      <BannerAd
        unitId={getBannerUnitId()}
        size={getBannerSize(size)}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={(err: Error) => {
          log.debug('banner failed to load', { message: err.message })
        }}
      />
    </View>
  )
}
