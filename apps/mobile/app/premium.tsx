import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { IAP_PRODUCT_IDS } from '@red-handed/shared'
import { useResponsive } from '../lib/responsive'
import { HapticManager } from '../lib/haptics'
import { SoundManager } from '../lib/sounds'
import { api } from '../lib/api'
import {
  initIap,
  fetchSubscriptionProducts,
  buySubscription,
  restorePurchases,
  type IapProduct,
} from '../lib/iap'
import { createLogger } from '../lib/logger'

const log = createLogger('premium')

const PERKS = [
  { icon: '🚫', title: 'No Ads', desc: 'Completely ad-free experience, always.' },
  { icon: '♾️', title: 'Unlimited Games', desc: 'Play as many games as you want, no daily limits.' },
  { icon: '🎭', title: 'All Word Categories', desc: 'Access every category including Mangas, Célébrités, Mix and more.' },
  { icon: '🏆', title: 'Ranked Priority', desc: 'Faster matchmaking in ranked mode.' },
  { icon: '👑', title: 'Premium Badge', desc: 'Exclusive badge on your profile and in lobbies.' },
]

export default function PremiumScreen() {
  const router = useRouter()
  const { px, fontScale, isTablet } = useResponsive()

  const [subProducts, setSubProducts] = useState<IapProduct[]>([])
  const [premium, setPremium] = useState(false)
  const [buyingId, setBuyingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ready = await initIap({
        onCredited: (res) => {
          log.info('premium credited', res)
          HapticManager.success()
          SoundManager.play('success')
          if (res.premium) setPremium(true)
          Alert.alert('Welcome to Premium!', 'Thanks for your support.')
        },
        onError: (err) => {
          log.warn('premium IAP error', { message: err.message })
          HapticManager.error()
        },
      })
      if (!ready || cancelled) return
      const subs = await fetchSubscriptionProducts()
      if (cancelled) return
      setSubProducts(subs)
    })()

    api.get<{ premium?: boolean }>('/auth/me')
      .then((me) => setPremium(Boolean(me.premium)))
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  const monthly = subProducts.find((p) => p.productId === IAP_PRODUCT_IDS.subscriptions.premium_monthly)
  const yearly  = subProducts.find((p) => p.productId === IAP_PRODUCT_IDS.subscriptions.premium_yearly)

  const handleBuy = async (productId: string) => {
    try {
      HapticManager.medium()
      SoundManager.play('click')
      setBuyingId(productId)
      await buySubscription(productId as any)
    } catch (err) {
      Alert.alert('Purchase failed', (err as Error).message)
    } finally {
      setBuyingId(null)
    }
  }

  const handleRestore = async () => {
    HapticManager.selection()
    const restored = await restorePurchases()
    Alert.alert(
      'Restore complete',
      restored.length ? `${restored.length} purchase(s) restored.` : 'Nothing to restore on this account.',
    )
    api.get<{ premium?: boolean }>('/auth/me')
      .then((me) => setPremium(Boolean(me.premium)))
      .catch(() => {})
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-neutral-950">
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-900">
        <TouchableOpacity onPress={() => router.back()} className="pr-3">
          <Text className="text-neutral-400" style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold flex-1" style={{ fontSize: 16 * fontScale }}>
          Go Premium
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: px, paddingVertical: 24, paddingBottom: 48, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center gap-3">
          <View
            className="items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10"
            style={{ width: isTablet ? 72 : 64, height: isTablet ? 72 : 64 }}
          >
            <Text style={{ fontSize: 32 }}>👑</Text>
          </View>
          <Text className="text-white font-extrabold" style={{ fontSize: (isTablet ? 28 : 24) * fontScale }}>
            Go Premium
          </Text>
          <Text className="text-neutral-400 text-center" style={{ fontSize: 13 * fontScale }}>
            The best way to play Red Handed !
          </Text>
        </View>

        <View className="rounded-2xl border border-amber-500/30 bg-neutral-900/80 overflow-hidden">
          <View className="h-[2] bg-amber-500/60" />
          <View className="p-5 gap-5">
            <View className="flex-row gap-3">
              <View className="flex-1 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 items-center">
                <Text className="text-white font-extrabold" style={{ fontSize: 22 * fontScale }}>
                  {monthly?.localizedPrice ?? '€1'}
                </Text>
                <Text className="text-neutral-400" style={{ fontSize: 11 * fontScale }}>
                  / month
                </Text>
              </View>
              <View className="flex-1 rounded-xl border border-amber-500/60 bg-amber-500/10 p-3 items-center">
                <View className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-amber-950/80">
                  <Text className="text-amber-400 font-bold" style={{ fontSize: 9 }}>
                    BEST VALUE
                  </Text>
                </View>
                <Text className="text-white font-extrabold" style={{ fontSize: 22 * fontScale }}>
                  {yearly?.localizedPrice ?? '€10'}
                </Text>
                <Text className="text-neutral-400" style={{ fontSize: 11 * fontScale }}>
                  / year
                </Text>
                <Text className="text-emerald-400 font-semibold mt-0.5" style={{ fontSize: 10 * fontScale }}>
                  Save 2 months free
                </Text>
              </View>
            </View>
            <Text className="text-neutral-600 text-center" style={{ fontSize: 11 * fontScale }}>
              Cancel anytime in your store account
            </Text>

            <View className="gap-3">
              {PERKS.map((p) => (
                <View key={p.title} className="flex-row gap-3">
                  <Text style={{ fontSize: 20 }}>{p.icon}</Text>
                  <View className="flex-1">
                    <Text className="text-white font-semibold" style={{ fontSize: 13 * fontScale }}>
                      {p.title}
                    </Text>
                    <Text className="text-neutral-500 mt-0.5" style={{ fontSize: 11 * fontScale, lineHeight: 16 * fontScale }}>
                      {p.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {premium ? (
              <View className="px-3 py-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 items-center">
                <Text className="text-emerald-300 font-bold" style={{ fontSize: 13 * fontScale }}>
                  👑 Premium is active
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                <TouchableOpacity
                  onPress={() => handleBuy(IAP_PRODUCT_IDS.subscriptions.premium_yearly)}
                  disabled={buyingId === IAP_PRODUCT_IDS.subscriptions.premium_yearly}
                  className="rounded-xl bg-amber-500 items-center"
                  style={{ paddingVertical: 13 }}
                  activeOpacity={0.85}
                >
                  {buyingId === IAP_PRODUCT_IDS.subscriptions.premium_yearly ? (
                    <ActivityIndicator color="#18181b" />
                  ) : (
                    <Text className="text-neutral-900 font-bold" style={{ fontSize: 15 * fontScale }}>
                      Subscribe — {yearly?.localizedPrice ?? '€10'}/year
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleBuy(IAP_PRODUCT_IDS.subscriptions.premium_monthly)}
                  disabled={buyingId === IAP_PRODUCT_IDS.subscriptions.premium_monthly}
                  className="rounded-xl bg-neutral-800 border border-neutral-700 items-center"
                  style={{ paddingVertical: 11 }}
                  activeOpacity={0.8}
                >
                  {buyingId === IAP_PRODUCT_IDS.subscriptions.premium_monthly ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-semibold" style={{ fontSize: 13 * fontScale }}>
                      Monthly — {monthly?.localizedPrice ?? '€1'}/month
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity onPress={handleRestore} activeOpacity={0.7} className="items-center">
              <Text className="text-amber-300 font-semibold" style={{ fontSize: 12 * fontScale }}>
                Restore purchases
              </Text>
            </TouchableOpacity>

            <Text className="text-neutral-600 text-center" style={{ fontSize: 10 * fontScale }}>
              Secure payment through Apple / Google · Cancel anytime in your store account
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
