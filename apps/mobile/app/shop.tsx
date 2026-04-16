import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useResponsive } from '../lib/responsive'
import { HapticManager } from '../lib/haptics'
import { api } from '../lib/api'
import { createLogger } from '../lib/logger'

const log = createLogger('shop')

// Mobile mirror of the web ShopPage. Cosmetics were removed from the game
// design (no avatar to attach them to), so the shop now only carries coin
// packs (placeholder — payments disabled server-side) and the season pass.

type Tab = 'coins' | 'season'

/**
 * Placeholder packs shown in the Coins tab. When payments are re-enabled
 * server-side, swap this for a fetch of GET /api/shop/packs and wire the
 * purchase button to POST /api/shop/packs/:id/checkout.
 */
const PLACEHOLDER_COIN_PACKS = [
  { id: 'small',  amount: 500,  price: '$1.99',  bonus: 0 },
  { id: 'medium', amount: 1500, price: '$4.99',  bonus: 150, popular: true },
  { id: 'large',  amount: 5000, price: '$14.99', bonus: 750 },
] as const

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

  // Initial tab is driven by the `?tab=` URL param so the
  // InsufficientCoinsModal can deep-link to /shop?tab=coins.
  const initial: Tab =
    params.tab === 'season' || params.tab === 'coins' ? (params.tab as Tab) : 'coins'
  const [tab, setTab] = useState<Tab>(initial)

  const switchTab = (next: Tab) => {
    HapticManager.selection()
    setTab(next)
  }

  // Live balance — refreshed on mount. Plain useEffect pattern because the
  // mobile app doesn't bundle react-query.
  const [starCoins, setStarCoins] = useState(0)
  const [goldCoins, setGoldCoins] = useState(0)
  const fetchMe = useCallback(() => {
    api
      .get<{ starCoins?: number; goldCoins?: number }>('/auth/me')
      .then((me) => {
        setStarCoins(me.starCoins ?? 0)
        setGoldCoins(me.goldCoins ?? 0)
      })
      .catch((err) => log.warn('balance fetch failed', { error: err?.message }))
  }, [])
  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-neutral-950">
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-900">
        <TouchableOpacity onPress={() => router.back()} className="pr-3">
          <Text className="text-neutral-400" style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold flex-1" style={{ fontSize: 16 * fontScale }}>
          {t('shop.shop', { defaultValue: 'Shop' })}
        </Text>
        <View className="flex-row gap-2">
          <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 border border-neutral-700">
            <Text style={{ fontSize: 12 }}>⭐</Text>
            <Text className="text-white font-semibold" style={{ fontSize: 12 * fontScale }}>
              {starCoins.toLocaleString()}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-800/50">
            <Text style={{ fontSize: 12 }}>💰</Text>
            <Text className="text-amber-400 font-semibold" style={{ fontSize: 12 * fontScale }}>
              {goldCoins.toLocaleString()}
            </Text>
          </View>
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
            active={tab === 'season'}
            onPress={() => switchTab('season')}
            label={t('shop.tabSeason', { defaultValue: '👑 Season' })}
            fontScale={fontScale}
          />
        </View>

        {tab === 'coins' && (
          <CoinsTab
            fontScale={fontScale}
            onPlayPress={() => {
              HapticManager.selection()
              router.push('/')
            }}
          />
        )}
        {tab === 'season' && (
          <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 items-center">
            <Text style={{ fontSize: 36 }}>👑</Text>
            <Text className="text-white font-semibold mt-2" style={{ fontSize: 14 * fontScale }}>
              {t('shop.seasonComingSoon', { defaultValue: 'Season Pass coming soon.' })}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Coins tab ────────────────────────────────────────────────────────────────

function CoinsTab({ fontScale, onPlayPress }: { fontScale: number; onPlayPress: () => void }) {
  const { t } = useTranslation()
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
          {PLACEHOLDER_COIN_PACKS.map((pack) => (
            <View
              key={pack.id}
              className={[
                'flex-1 rounded-2xl border p-3 items-center',
                (pack as any).popular
                  ? 'border-violet-600/40 bg-neutral-900'
                  : 'border-neutral-800 bg-neutral-900',
              ].join(' ')}
              style={{ opacity: 0.8 }}
            >
              {(pack as any).popular && (
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
              <Text className="text-neutral-500 mt-1" style={{ fontSize: 11 * fontScale }}>
                {pack.price}
              </Text>
            </View>
          ))}
        </View>
        <View className="rounded-xl px-3 py-2.5 bg-amber-950/30 border border-amber-900/50">
          <Text className="text-amber-300 text-center" style={{ fontSize: 11 * fontScale }}>
            ⏳ {t('shop.packsUnavailable', { defaultValue: 'Coin packs are coming soon — payments are temporarily disabled.' })}
          </Text>
        </View>
      </View>

      {/* Honest alternative — the game's real earning mechanics */}
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
          icon="🎮"
          text={t('shop.earnGameReward', { defaultValue: 'Play a game: +10 to +90 ⭐ depending on role & result.' })}
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
