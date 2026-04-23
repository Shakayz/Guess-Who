import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { IAP_PRODUCT_IDS, COIN_PACKS } from '@red-handed/shared'
import { useResponsive } from '../lib/responsive'
import { HapticManager } from '../lib/haptics'
import { api } from '../lib/api'
import { createLogger } from '../lib/logger'
import {
  initIap,
  fetchCoinProducts,
  fetchSubscriptionProducts,
  buyCoinPack,
  buySubscription,
  restorePurchases,
  type IapProduct,
} from '../lib/iap'
import { AdBanner } from '../components/AdBanner'

const log = createLogger('shop')

// Mobile shop. Unlike the web version which talks to Stripe Checkout, the
// mobile shop must go through StoreKit (iOS) and Play Billing (Android) —
// Apple and Google both require IAP for digital goods. Stripe is kept for the
// web flow; mobile never hits the Stripe endpoints. The server still records
// Purchase rows for analytics and to grant coins, triggered by the IAP
// verification endpoint instead of the Stripe webhook.

type Tab = 'coins' | 'premium'

// Display fallback when the store hasn't returned product metadata yet (e.g.
// network hiccup during product fetch, or running in Expo Go where the native
// module is missing). Keeps the layout stable so the user always sees packs.
const FALLBACK_COIN_PACKS = COIN_PACKS.map((p) => ({
  id: p.id,
  productId: (IAP_PRODUCT_IDS.coins as Record<string, string>)[p.id],
  amount: p.amount,
  bonus: p.bonus,
  localizedPrice: `€${(p.priceCents / 100).toFixed(2)}`,
  popular: p.id === 'pack_1500',
}))

function TabButton({
  active,
  onPress,
  label,
  fontScale,
}: {
  active: boolean
  onPress: () => void
  label: string
  fontScale: number
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={[
        'px-4 py-2 rounded-lg',
        active ? 'bg-violet-600' : 'bg-neutral-900 border border-neutral-800',
      ].join(' ')}
      activeOpacity={0.8}
    >
      <Text
        className={active ? 'text-white font-semibold' : 'text-neutral-400 font-semibold'}
        style={{ fontSize: 12 * fontScale }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

export default function ShopScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { px, fontScale, isTablet } = useResponsive()
  const params = useLocalSearchParams<{ tab?: string }>()

  const initial: Tab =
    params.tab === 'coins' ? 'coins'
    : params.tab === 'premium' || params.tab === 'season' ? 'premium'
    : 'coins'
  const [tab, setTab] = useState<Tab>(initial)

  const switchTab = (next: Tab) => {
    HapticManager.selection()
    setTab(next)
  }

  const [starCoins, setStarCoins] = useState(0)
  const [premium, setPremium] = useState(false)
  const [coinProducts, setCoinProducts] = useState<IapProduct[]>([])
  const [subProducts, setSubProducts] = useState<IapProduct[]>([])
  const [buyingId, setBuyingId] = useState<string | null>(null)

  const fetchMe = useCallback(() => {
    api
      .get<{ starCoins?: number; premium?: boolean }>('/auth/me')
      .then((me) => {
        setStarCoins(me.starCoins ?? 0)
        setPremium(Boolean(me.premium))
      })
      .catch((err) => log.warn('balance fetch failed', { error: err?.message }))
  }, [])

  // Initialise the IAP connection, fetch store-localised product metadata and
  // install a credit-listener so the balance refreshes the moment the server
  // acknowledges a new purchase.
  useEffect(() => {
    fetchMe()
    let cancelled = false
    ;(async () => {
      const ready = await initIap({
        onCredited: (res) => {
          log.info('IAP credited', res)
          HapticManager.success()
          fetchMe()
          Alert.alert(
            t('shop.purchaseThanksTitle', { defaultValue: 'Thanks!' }),
            res.premium
              ? t('shop.purchaseThanksPremium', { defaultValue: 'Premium unlocked.' })
              : t('shop.purchaseThanksCoins', {
                  defaultValue: '{{n}} star coins added.',
                  n: res.starCoinsCredited ?? 0,
                }),
          )
        },
        onError: (err) => {
          log.warn('IAP error', { message: err.message })
          HapticManager.error()
        },
      })
      if (!ready || cancelled) return
      const [coins, subs] = await Promise.all([
        fetchCoinProducts(),
        fetchSubscriptionProducts(),
      ])
      if (cancelled) return
      setCoinProducts(coins)
      setSubProducts(subs)
    })()
    return () => {
      cancelled = true
    }
  }, [fetchMe, t])

  const handleBuyCoins = async (productId: string) => {
    try {
      HapticManager.medium()
      setBuyingId(productId)
      await buyCoinPack(productId as any)
    } catch (err) {
      Alert.alert(
        t('shop.purchaseFailedTitle', { defaultValue: 'Purchase failed' }),
        (err as Error).message,
      )
    } finally {
      setBuyingId(null)
    }
  }

  const handleBuySubscription = async (productId: string) => {
    try {
      HapticManager.medium()
      setBuyingId(productId)
      await buySubscription(productId as any)
    } catch (err) {
      Alert.alert(
        t('shop.purchaseFailedTitle', { defaultValue: 'Purchase failed' }),
        (err as Error).message,
      )
    } finally {
      setBuyingId(null)
    }
  }

  const handleRestore = async () => {
    HapticManager.selection()
    const restored = await restorePurchases()
    fetchMe()
    Alert.alert(
      t('shop.restoreDoneTitle', { defaultValue: 'Restore complete' }),
      restored.length
        ? t('shop.restoreDoneMsg', {
            defaultValue: '{{n}} purchase(s) restored.',
            n: restored.length,
          })
        : t('shop.restoreNothing', { defaultValue: 'Nothing to restore on this account.' }),
    )
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-neutral-950">
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-900">
        <TouchableOpacity onPress={() => router.back()} className="pr-3">
          <Text className="text-neutral-400" style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold flex-1" style={{ fontSize: 16 * fontScale }}>
          {t('shop.shop', { defaultValue: 'Shop' })}
        </Text>
        <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 border border-neutral-700">
          <Text style={{ fontSize: 12 }}>⭐</Text>
          <Text className="text-white font-semibold" style={{ fontSize: 12 * fontScale }}>
            {starCoins.toLocaleString()}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: px, paddingVertical: 20, paddingBottom: 48, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className="text-white font-extrabold" style={{ fontSize: (isTablet ? 28 : 22) * fontScale }}>
            {t('shop.shop', { defaultValue: 'Shop' })}
          </Text>
          <Text className="text-neutral-500 mt-1" style={{ fontSize: 12 * fontScale }}>
            {t('shop.subtitle', { defaultValue: 'Buy coins & more' })}
          </Text>
        </View>

        <View className="flex-row gap-2">
          <TabButton
            active={tab === 'coins'}
            onPress={() => switchTab('coins')}
            label={t('shop.tabCoins', { defaultValue: '⭐ Star Coins' })}
            fontScale={fontScale}
          />
          <TabButton
            active={tab === 'premium'}
            onPress={() => switchTab('premium')}
            label={t('shop.tabPremium', { defaultValue: '👑 Premium' })}
            fontScale={fontScale}
          />
        </View>

        {tab === 'coins' && (
          <CoinsTab
            fontScale={fontScale}
            coinProducts={coinProducts}
            buyingId={buyingId}
            onBuy={handleBuyCoins}
            onPlayPress={() => {
              HapticManager.selection()
              router.push('/')
            }}
          />
        )}
        {tab === 'premium' && (
          <PremiumTab
            fontScale={fontScale}
            subProducts={subProducts}
            premium={premium}
            buyingId={buyingId}
            onBuy={handleBuySubscription}
            onRestore={handleRestore}
          />
        )}

        {/* Bottom banner — disclosure required by Play Console / ASA policy */}
        <Text className="text-neutral-600 text-center mt-4" style={{ fontSize: 10 * fontScale }}>
          {t('shop.iapDisclosure', {
            defaultValue: 'Purchases are processed by Apple or Google and billed to your store account.',
          })}
        </Text>

        <AdBanner hidden={premium} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Coins tab ────────────────────────────────────────────────────────────────

type CoinsTabProps = {
  fontScale: number
  coinProducts: IapProduct[]
  buyingId: string | null
  onBuy: (productId: string) => void
  onPlayPress: () => void
}

function CoinsTab({ fontScale, coinProducts, buyingId, onBuy, onPlayPress }: CoinsTabProps) {
  const { t } = useTranslation()

  // Merge store-localised prices on top of the canonical pack list, falling
  // back to hard-coded display strings when the store hasn't answered yet.
  const packs = FALLBACK_COIN_PACKS.map((fallback) => {
    const live = coinProducts.find((p) => p.productId === fallback.productId)
    return {
      ...fallback,
      localizedPrice: live?.localizedPrice ?? fallback.localizedPrice,
    }
  })

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 10 }}>
        <Text
          className="text-neutral-500 font-semibold uppercase"
          style={{ fontSize: 10 * fontScale, letterSpacing: 1 }}
        >
          {t('shop.packsTitle', { defaultValue: 'Star Coin Packs' })}
        </Text>
        <View className="flex-row" style={{ gap: 8 }}>
          {packs.map((pack) => {
            const busy = buyingId === pack.productId
            return (
              <TouchableOpacity
                key={pack.id}
                onPress={() => onBuy(pack.productId)}
                disabled={busy || !pack.productId}
                className={[
                  'flex-1 rounded-2xl border p-3 items-center',
                  pack.popular
                    ? 'border-violet-600/40 bg-neutral-900'
                    : 'border-neutral-800 bg-neutral-900',
                ].join(' ')}
                activeOpacity={0.85}
              >
                {pack.popular && (
                  <View className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-violet-950/60">
                    <Text className="text-violet-400 font-bold" style={{ fontSize: 8 }}>POPULAR</Text>
                  </View>
                )}
                <Text style={{ fontSize: 24 }}>⭐</Text>
                <Text className="text-white font-extrabold" style={{ fontSize: 16 * fontScale }}>
                  {pack.amount.toLocaleString()}
                </Text>
                {pack.bonus > 0 && (
                  <Text className="text-emerald-400 font-semibold" style={{ fontSize: 10 * fontScale }}>
                    +{pack.bonus} bonus
                  </Text>
                )}
                <View className="mt-1 rounded-lg bg-violet-600 px-2 py-1" style={{ opacity: busy ? 0.5 : 1 }}>
                  {busy ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white font-bold" style={{ fontSize: 11 * fontScale }}>
                      {pack.localizedPrice}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text
          className="text-neutral-500 font-semibold uppercase"
          style={{ fontSize: 10 * fontScale, letterSpacing: 1 }}
        >
          {t('shop.earnTitle', { defaultValue: 'Earn coins for free' })}
        </Text>
        <EarnRow
          icon="🎁"
          text={t('shop.earnDailyBonus', { defaultValue: 'Daily bonus: +20 ⭐ for your first game each day.' })}
          fontScale={fontScale}
        />
        <EarnRow
          icon="🔥"
          text={t('shop.earnStreak', { defaultValue: '7-day streak: +100 ⭐ every 7 days.' })}
          fontScale={fontScale}
        />
        <EarnRow
          icon="⚡"
          text={t('shop.earnLevelUp', { defaultValue: 'Level up: +10 ⭐ × new level every time you level up (e.g. level 5 → +50 ⭐).' })}
          fontScale={fontScale}
        />
        <EarnRow
          icon="🏆"
          text={t('shop.earnAchievements', { defaultValue: 'Unlock achievements: claim ⭐ rewards from the Achievements page.' })}
          fontScale={fontScale}
        />
        <TouchableOpacity
          onPress={onPlayPress}
          className="rounded-xl bg-violet-600 items-center mt-2"
          style={{ paddingVertical: 12 }}
          activeOpacity={0.85}
        >
          <Text className="text-white font-bold" style={{ fontSize: 14 * fontScale }}>
            🎲 {t('shop.earnPlayNow', { defaultValue: 'Play a game' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── Premium tab ──────────────────────────────────────────────────────────────

type PremiumTabProps = {
  fontScale: number
  subProducts: IapProduct[]
  premium: boolean
  buyingId: string | null
  onBuy: (productId: string) => void
  onRestore: () => void
}

function PremiumTab({ fontScale, subProducts, premium, buyingId, onBuy, onRestore }: PremiumTabProps) {
  const { t } = useTranslation()
  const monthly = subProducts.find((p) => p.productId === IAP_PRODUCT_IDS.subscriptions.premium_monthly)
  const yearly  = subProducts.find((p) => p.productId === IAP_PRODUCT_IDS.subscriptions.premium_yearly)

  return (
    <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6" style={{ gap: 16 }}>
      <View className="items-center">
        <Text style={{ fontSize: 40 }}>👑</Text>
        <Text className="text-white font-extrabold mt-2" style={{ fontSize: 20 * fontScale }}>
          {t('shop.premiumTitle', { defaultValue: 'Premium' })}
        </Text>
        <Text className="text-neutral-400 mt-1" style={{ fontSize: 12 * fontScale }}>
          {t('shop.premiumSubtitle', { defaultValue: 'Play more, play your way.' })}
        </Text>
      </View>
      {[
        {
          icon: '🚫',
          title: t('shop.premiumFeatureNoAdsTitle', { defaultValue: 'No ads' }),
          desc: t('shop.premiumFeatureNoAdsDesc',   { defaultValue: 'A completely ad-free experience on every screen.' }),
        },
        {
          icon: '🃏',
          title: t('shop.premiumFeatureDecksTitle', { defaultValue: 'Create your own decks' }),
          desc: t('shop.premiumFeatureDecksDesc',   { defaultValue: 'Build custom word packs with your own themes.' }),
        },
        {
          icon: '♾️',
          title: t('shop.premiumFeatureUnlimitedTitle', { defaultValue: 'Unlimited games' }),
          desc: t('shop.premiumFeatureUnlimitedDesc',   { defaultValue: 'No star-coin entry cost — play as many games as you want.' }),
        },
      ].map((f) => (
        <View
          key={f.title}
          className="flex-row p-3 rounded-xl bg-neutral-950 border border-neutral-800"
          style={{ gap: 10 }}
        >
          <Text style={{ fontSize: 22 }}>{f.icon}</Text>
          <View className="flex-1">
            <Text className="text-white font-semibold" style={{ fontSize: 13 * fontScale }}>{f.title}</Text>
            <Text className="text-neutral-400 mt-0.5" style={{ fontSize: 11 * fontScale }}>{f.desc}</Text>
          </View>
        </View>
      ))}

      {premium ? (
        <View className="px-3 py-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 items-center">
          <Text className="text-emerald-300 font-bold" style={{ fontSize: 13 * fontScale }}>
            👑 {t('shop.premiumActive', { defaultValue: 'Premium is active.' })}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <TouchableOpacity
            onPress={() => onBuy(IAP_PRODUCT_IDS.subscriptions.premium_yearly)}
            disabled={buyingId === IAP_PRODUCT_IDS.subscriptions.premium_yearly}
            className="rounded-xl bg-amber-500 items-center"
            style={{ paddingVertical: 13 }}
            activeOpacity={0.85}
          >
            {buyingId === IAP_PRODUCT_IDS.subscriptions.premium_yearly ? (
              <ActivityIndicator color="#18181b" />
            ) : (
              <Text className="text-neutral-900 font-bold" style={{ fontSize: 15 * fontScale }}>
                {t('shop.subscribeYearly', { defaultValue: 'Subscribe — {{price}}/year', price: yearly?.localizedPrice ?? '€10' })}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onBuy(IAP_PRODUCT_IDS.subscriptions.premium_monthly)}
            disabled={buyingId === IAP_PRODUCT_IDS.subscriptions.premium_monthly}
            className="rounded-xl bg-neutral-800 border border-neutral-700 items-center"
            style={{ paddingVertical: 11 }}
            activeOpacity={0.8}
          >
            {buyingId === IAP_PRODUCT_IDS.subscriptions.premium_monthly ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold" style={{ fontSize: 13 * fontScale }}>
                {t('shop.subscribeMonthly', { defaultValue: 'Monthly — {{price}}/month', price: monthly?.localizedPrice ?? '€1' })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity onPress={onRestore} activeOpacity={0.7} className="items-center">
        <Text className="text-violet-400 font-semibold" style={{ fontSize: 12 * fontScale }}>
          {t('shop.restorePurchases', { defaultValue: 'Restore purchases' })}
        </Text>
      </TouchableOpacity>

      <Text className="text-neutral-600 text-center" style={{ fontSize: 10 * fontScale }}>
        {t('shop.subscriptionTerms', {
          defaultValue:
            'Subscription auto-renews until cancelled in the App Store / Play Store. Manage or cancel in your store account.',
        })}
      </Text>
    </View>
  )
}

function EarnRow({ icon, text, fontScale }: { icon: string; text: string; fontScale: number }) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3">
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text className="text-neutral-300 flex-1" style={{ fontSize: 12 * fontScale, lineHeight: 16 * fontScale }}>
        {text}
      </Text>
    </View>
  )
}
