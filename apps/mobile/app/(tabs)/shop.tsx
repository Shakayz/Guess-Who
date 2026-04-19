import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useResponsive } from '../../lib/responsive'
import { HapticManager } from '../../lib/haptics'
import { SoundManager } from '../../lib/sounds'
import { api } from '../../lib/api'
import { createLogger } from '../../lib/logger'
import {
  purchaseCoinPack,
  subscribePremium,
  openManageSubscription,
  restorePurchases,
  IAPNotImplementedError,
  IAPCancelledError,
} from '../../lib/iap'
import {
  PREMIUM_PLANS,
  EMOTE_CATALOG,
  type CoinPack,
  type PremiumPlan,
  type Emote,
  type EmoteRarity,
} from '@red-handed/shared'
import { PopIn, SlideUp, GlowPulse, Shimmer, FloatSoft, Breathe } from '../../components/anim/AnimatedViews'
import { EmoteTile } from '../../components/emotes/EmoteTile'
import { useEmotesStore } from '../../store/emotes'

const log = createLogger('shop')

// Mobile mirror of the web ShopPage. Parity with apps/web/src/pages/ShopPage.tsx:
//   - dynamic pack catalogue fetched from GET /api/shop/packs
//   - Premium tab with monthly/yearly plan selector + Manage button for
//     existing subscribers
//   - post-purchase success/canceled banner
// All pay actions go through lib/iap — Stripe's web-only flow is not used on
// mobile (Apple/Google policy). Phase B has iap stubbed; Phase C wires the
// native StoreKit 2 / Play Billing flow.

type Tab = 'coins' | 'emotes' | 'premium'
type PlanId = PremiumPlan['id']

type Pack = CoinPack

type Me = { id: string; isPremium?: boolean; premiumUntil?: string | null; starCoins?: number }

// Middle tier is highlighted as POPULAR — cosmetic only, matches web.
const POPULAR_PACK_ID = 'pack_1500'

// Source of truth is packages/shared/src/constants/index.ts (PREMIUM_PLANS).
const PREMIUM_PLAN_BY_ID: Record<PlanId, PremiumPlan> = PREMIUM_PLANS.reduce(
  (acc, p) => ({ ...acc, [p.id]: p }),
  {} as Record<PlanId, PremiumPlan>,
)

function formatPrice(priceCents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(priceCents / 100)
  } catch {
    return `$${(priceCents / 100).toFixed(2)}`
  }
}

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
  const params = useLocalSearchParams<{ tab?: string; checkout?: string }>()

  // Initial tab driven by `?tab=`. `season` is an alias for `premium` kept for
  // legacy deep links from the InsufficientCoinsModal.
  const initial: Tab =
    params.tab === 'coins' ? 'coins'
    : params.tab === 'emotes' ? 'emotes'
    : params.tab === 'premium' || params.tab === 'season' ? 'premium'
    : 'coins'
  const [tab, setTab] = useState<Tab>(initial)

  const switchTab = (next: Tab) => {
    HapticManager.selection()
    setTab(next)
  }

  // Live user. Stored locally so pay callbacks can refresh on success. This
  // file avoids react-query to stay consistent with the rest of the mobile
  // app's plain-useEffect pattern.
  const [me, setMe] = useState<Me | null>(null)
  const fetchMe = useCallback(() => {
    api
      .get<Me>('/auth/me')
      .then(setMe)
      .catch((err) => log.warn('me fetch failed', { error: err?.message }))
  }, [])
  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  const starCoins = me?.starCoins ?? 0

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-neutral-950">
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-900">
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
        <PopIn>
          <Text className="text-white font-extrabold" style={{ fontSize: (isTablet ? 28 : 22) * fontScale }}>
            {t('shop.shop', { defaultValue: 'Shop' })}
          </Text>
          <Text className="text-neutral-500 mt-1" style={{ fontSize: 12 * fontScale }}>
            {t('shop.subtitle', { defaultValue: 'Buy coins & more' })}
          </Text>
        </PopIn>

        <View className="flex-row gap-2">
          <TabButton
            active={tab === 'coins'}
            onPress={() => switchTab('coins')}
            label={t('shop.tabCoins', { defaultValue: '⭐ Star Coins' })}
            fontScale={fontScale}
          />
          <TabButton
            active={tab === 'emotes'}
            onPress={() => switchTab('emotes')}
            label={t('shop.tabEmotes', { defaultValue: '😂 Emotes' })}
            fontScale={fontScale}
          />
          <TabButton
            active={tab === 'premium'}
            onPress={() => switchTab('premium')}
            label={t('shop.tabPremium', { defaultValue: '👑 Premium' })}
            fontScale={fontScale}
          />
        </View>

        <CheckoutBanner status={params.checkout} fontScale={fontScale} />

        {tab === 'coins' && (
          <CoinsTab
            fontScale={fontScale}
            onPurchased={fetchMe}
            onPlayPress={() => {
              HapticManager.selection()
              router.push('/')
            }}
          />
        )}
        {tab === 'emotes' && (
          <EmotesTab
            fontScale={fontScale}
            starCoins={starCoins}
            onPurchased={fetchMe}
          />
        )}
        {tab === 'premium' && (
          <PremiumTab
            fontScale={fontScale}
            me={me}
            onChanged={fetchMe}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Coins tab ────────────────────────────────────────────────────────────────

function CoinsTab({
  fontScale,
  onPurchased,
  onPlayPress,
}: {
  fontScale: number
  onPurchased: () => void
  onPlayPress: () => void
}) {
  const { t } = useTranslation()
  const [packs, setPacks] = useState<Pack[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyPackId, setBusyPackId] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ packs: Pack[] }>('/shop/packs')
      .then((res) => setPacks(res.packs))
      .catch((err) => {
        log.warn('packs fetch failed', { error: err?.message })
        setLoadError(err?.message ?? 'Packs unavailable')
      })
  }, [])

  const handleBuy = async (pack: Pack) => {
    HapticManager.medium()
    SoundManager.play('click')
    setBusyPackId(pack.id)
    try {
      const res = await purchaseCoinPack(pack)
      if (res.status === 'credited') {
        SoundManager.play('success')
        Alert.alert(
          t('shop.purchaseSuccessTitle', { defaultValue: 'Thanks!' }),
          t('shop.purchaseSuccessBody', {
            defaultValue: '+{{coins}} ⭐ added to your balance.',
            coins: res.starCoins.toLocaleString(),
          }),
        )
        onPurchased()
      }
    } catch (err) {
      if (err instanceof IAPCancelledError) return // user backed out — silent
      if (err instanceof IAPNotImplementedError) {
        Alert.alert(
          t('shop.iapPendingTitle', { defaultValue: 'Coming very soon' }),
          err.message,
        )
        return
      }
      Alert.alert(
        t('shop.purchaseErrorTitle', { defaultValue: 'Purchase failed' }),
        (err as Error)?.message ?? 'Please try again.',
      )
    } finally {
      setBusyPackId(null)
    }
  }

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 10 }}>
        <Text
          className="text-neutral-500 font-semibold uppercase"
          style={{ fontSize: 10 * fontScale, letterSpacing: 1 }}
        >
          {t('shop.packsTitle', { defaultValue: 'Star Coin Packs' })}
        </Text>

        {packs === null && !loadError ? (
          <View className="flex-row" style={{ gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                className="rounded-2xl border border-neutral-800 bg-neutral-900"
                style={{ flex: 1, height: 140, opacity: 0.5 }}
              />
            ))}
          </View>
        ) : loadError || (packs && packs.length === 0) ? (
          <View className="rounded-xl px-3 py-2.5 bg-amber-950/30 border border-amber-900/50">
            <Text className="text-amber-300 text-center" style={{ fontSize: 11 * fontScale }}>
              ⏳ {t('shop.packsUnavailable', { defaultValue: 'Coin packs are coming soon.' })}
            </Text>
          </View>
        ) : (
          <View className="flex-row" style={{ gap: 8 }}>
            {packs!.map((pack, i) => {
              const popular = pack.id === POPULAR_PACK_ID
              const busy = busyPackId === pack.id
              const card = (
                <TouchableOpacity
                  onPress={() => handleBuy(pack)}
                  disabled={busyPackId !== null}
                  activeOpacity={0.85}
                  className={[
                    'rounded-2xl border p-3 items-center',
                    popular ? 'border-violet-600/60 bg-neutral-900' : 'border-neutral-800 bg-neutral-900',
                  ].join(' ')}
                  style={{ flex: 1, opacity: busyPackId !== null && !busy ? 0.5 : 1 }}
                >
                  {popular && (
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
                      +{pack.bonus} {t('shop.bonus', { defaultValue: 'bonus' })}
                    </Text>
                  )}
                  <Text className="text-neutral-400 mt-1" style={{ fontSize: 11 * fontScale }}>
                    {formatPrice(pack.priceCents, pack.currency)}
                  </Text>
                  <View
                    className="w-full mt-2 rounded-lg bg-violet-600 items-center justify-center"
                    style={{ paddingVertical: 6 }}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text className="text-white font-semibold" style={{ fontSize: 11 * fontScale }}>
                        {t('shop.buy', { defaultValue: 'Buy' })}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )
              return (
                <PopIn key={pack.id} delay={100 + i * 120} style={{ flex: 1 }}>
                  {popular ? <GlowPulse style={{ borderRadius: 16, flex: 1 }}>{card}</GlowPulse> : card}
                </PopIn>
              )
            })}
          </View>
        )}
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

// ─── Emotes tab ───────────────────────────────────────────────────────────────

const RARITY_ORDER: EmoteRarity[] = ['legendary', 'epic', 'rare', 'common', 'free']
const RARITY_LABEL: Record<EmoteRarity, string> = {
  legendary: 'Legendary',
  epic: 'Epic',
  rare: 'Rare',
  common: 'Common',
  free: 'Free',
}

function EmotesTab({
  fontScale,
  starCoins,
  onPurchased,
}: {
  fontScale: number
  starCoins: number
  onPurchased: () => void
}) {
  const { t } = useTranslation()
  const store = useEmotesStore()
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    store.fetchMe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const ownedSet = new Set(store.me?.ownedIds ?? [])

  const grouped = React.useMemo(() => {
    const byRarity: Record<EmoteRarity, Emote[]> = {
      legendary: [], epic: [], rare: [], common: [], free: [],
    }
    for (const em of EMOTE_CATALOG) byRarity[em.rarity].push(em)
    return byRarity
  }, [])

  const handleBuy = async (em: Emote) => {
    if (ownedSet.has(em.id) || em.rarity === 'free') return
    if (starCoins < em.price) {
      Alert.alert(
        t('shop.emoteInsufficientTitle', { defaultValue: 'Not enough ⭐' }),
        t('shop.emoteInsufficientBody', {
          defaultValue: 'You need {{price}} ⭐ to buy this emote.',
          price: em.price.toLocaleString(),
        }),
      )
      return
    }
    HapticManager.medium()
    SoundManager.play('click')
    setBusyId(em.id)
    try {
      await api.post(`/emotes/${em.id}/buy`, {})
      store.markOwned(em.id)
      SoundManager.play('success')
      onPurchased()
    } catch (err) {
      Alert.alert(
        t('shop.emoteBuyErrorTitle', { defaultValue: 'Purchase failed' }),
        (err as Error)?.message ?? 'Please try again.',
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 6 }}>
        <Text
          className="text-neutral-500 font-semibold uppercase"
          style={{ fontSize: 10 * fontScale, letterSpacing: 1 }}
        >
          {t('shop.emotesTitle', { defaultValue: 'In-Game Reactions' })}
        </Text>
        <Text className="text-neutral-500" style={{ fontSize: 11 * fontScale }}>
          {t('shop.emotesSubtitle', {
            defaultValue: 'Buy emotes to equip them in your React bar. Free emotes are always available.',
          })}
        </Text>
      </View>

      {RARITY_ORDER.map((rarity) => {
        const list = grouped[rarity]
        if (list.length === 0) return null
        return (
          <View key={rarity} style={{ gap: 8 }}>
            <Text
              className="text-neutral-400 font-bold uppercase"
              style={{ fontSize: 10 * fontScale, letterSpacing: 1 }}
            >
              {RARITY_LABEL[rarity]}
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {list.map((em) => {
                const owned = em.rarity === 'free' || ownedSet.has(em.id)
                return (
                  <View key={em.id} style={{ width: '31%' }}>
                    <EmoteTile
                      emoji={em.emoji}
                      name={em.name}
                      rarity={em.rarity}
                      price={em.price}
                      owned={owned}
                      busy={busyId === em.id}
                      disabled={owned || busyId !== null}
                      onPress={() => handleBuy(em)}
                    />
                  </View>
                )
              })}
            </View>
          </View>
        )
      })}
    </View>
  )
}

// ─── Premium tab ──────────────────────────────────────────────────────────────

function PremiumTab({
  fontScale,
  me,
  onChanged,
}: {
  fontScale: number
  me: Me | null
  onChanged: () => void
}) {
  const { t } = useTranslation()
  // Yearly is the default — it's the BEST VALUE tile and matches the web default.
  const [plan, setPlan] = useState<PlanId>('yearly')
  const [busy, setBusy] = useState(false)

  const isPremium = !!me?.isPremium
  const renewalDate = me?.premiumUntil ? new Date(me.premiumUntil) : null

  const monthlyPlan = PREMIUM_PLAN_BY_ID.monthly
  const yearlyPlan = PREMIUM_PLAN_BY_ID.yearly
  const monthlyLabel = formatPrice(monthlyPlan.priceCents, monthlyPlan.currency)
  const yearlyLabel = formatPrice(yearlyPlan.priceCents, yearlyPlan.currency)

  const handleSubscribe = async () => {
    HapticManager.medium()
    SoundManager.play('click')
    setBusy(true)
    try {
      const res = await subscribePremium(PREMIUM_PLAN_BY_ID[plan])
      if (res.status === 'premium_extended') {
        SoundManager.play('success')
        Alert.alert(
          t('shop.premiumActiveTitle', { defaultValue: 'Welcome to Premium 👑' }),
          t('shop.premiumActiveBody', {
            defaultValue: 'You are premium until {{date}}.',
            date: new Date(res.premiumUntil).toLocaleDateString(),
          }),
        )
        onChanged()
      }
    } catch (err) {
      if (err instanceof IAPCancelledError) return
      if (err instanceof IAPNotImplementedError) {
        Alert.alert(
          t('shop.iapPendingTitle', { defaultValue: 'Coming very soon' }),
          err.message,
        )
        return
      }
      Alert.alert(
        t('shop.subscribeErrorTitle', { defaultValue: 'Subscription failed' }),
        (err as Error)?.message ?? 'Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleManage = async () => {
    HapticManager.light()
    SoundManager.play('click')
    try {
      await openManageSubscription()
    } catch (err) {
      if (err instanceof IAPNotImplementedError) {
        Alert.alert(
          t('shop.iapPendingTitle', { defaultValue: 'Coming very soon' }),
          err.message,
        )
        return
      }
      Alert.alert(
        t('shop.manageErrorTitle', { defaultValue: 'Could not open subscriptions' }),
        (err as Error)?.message ?? 'Please try again.',
      )
    }
  }

  const handleRestore = async () => {
    HapticManager.light()
    try {
      await restorePurchases()
      onChanged()
    } catch (err) {
      if (err instanceof IAPNotImplementedError) {
        Alert.alert(
          t('shop.iapPendingTitle', { defaultValue: 'Coming very soon' }),
          err.message,
        )
        return
      }
      Alert.alert(
        t('shop.restoreErrorTitle', { defaultValue: 'Restore failed' }),
        (err as Error)?.message ?? 'Please try again.',
      )
    }
  }

  return (
    <SlideUp delay={80}>
      <GlowPulse color="rgba(251,191,36,0.55)" style={{ borderRadius: 16 }}>
        <View className="rounded-2xl border border-amber-800/50 bg-neutral-900 p-6 overflow-hidden" style={{ gap: 16 }}>
          <Shimmer style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

          <View className="items-center">
            <FloatSoft>
              <Text style={{ fontSize: 48, textShadowColor: 'rgba(251,191,36,0.6)', textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 } }}>
                👑
              </Text>
            </FloatSoft>
            <Text className="text-white font-extrabold mt-2" style={{ fontSize: 22 * fontScale }}>
              {isPremium
                ? t('shop.premiumActiveHeading', { defaultValue: 'You are Premium' })
                : t('shop.premiumTitle', { defaultValue: 'Premium' })}
            </Text>
            <Text className="text-amber-200/80 mt-1" style={{ fontSize: 12 * fontScale }}>
              {isPremium && renewalDate
                ? t('shop.premiumRenews', {
                    defaultValue: 'Renews {{date}}',
                    date: renewalDate.toLocaleDateString(),
                  })
                : t('shop.premiumSubtitle', { defaultValue: 'Play more, play your way.' })}
            </Text>
          </View>

          {[
            {
              icon: '🚫',
              title: t('shop.premiumFeatureNoAdsTitle', { defaultValue: 'No ads' }),
              desc: t('shop.premiumFeatureNoAdsDesc', { defaultValue: 'A completely ad-free experience on every screen.' }),
            },
            {
              icon: '🃏',
              title: t('shop.premiumFeatureDecksTitle', { defaultValue: 'Create your own decks' }),
              desc: t('shop.premiumFeatureDecksDesc', { defaultValue: 'Build custom word packs with your own themes.' }),
            },
            {
              icon: '♾️',
              title: t('shop.premiumFeatureUnlimitedTitle', { defaultValue: 'Unlimited games' }),
              desc: t('shop.premiumFeatureUnlimitedDesc', { defaultValue: 'No star-coin entry cost — play as many games as you want.' }),
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

          {isPremium ? (
            <TouchableOpacity
              onPress={handleManage}
              className="rounded-xl bg-neutral-800 border border-neutral-700 items-center"
              style={{ paddingVertical: 13 }}
              activeOpacity={0.85}
            >
              <Text className="text-white font-bold" style={{ fontSize: 14 * fontScale }}>
                {t('shop.premiumManage', { defaultValue: 'Manage subscription' })}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 10 }}>
              {/* Plan selector — monthly | yearly. Yearly wears BEST VALUE. */}
              <View className="flex-row" style={{ gap: 8 }}>
                <PlanTile
                  active={plan === 'monthly'}
                  onPress={() => {
                    HapticManager.selection()
                    setPlan('monthly')
                  }}
                  label={t('shop.premiumPerMonth', {
                    defaultValue: '{{price}} / month',
                    price: monthlyLabel,
                  })}
                  fontScale={fontScale}
                />
                <PlanTile
                  active={plan === 'yearly'}
                  onPress={() => {
                    HapticManager.selection()
                    setPlan('yearly')
                  }}
                  label={t('shop.premiumPerYear', {
                    defaultValue: '{{price}} / year',
                    price: yearlyLabel,
                  })}
                  badge={t('shop.premiumBestValue', { defaultValue: 'BEST VALUE' })}
                  hint={t('shop.premiumSaveTwoMonths', { defaultValue: 'Save 2 months free' })}
                  fontScale={fontScale}
                />
              </View>

              <Breathe>
                <TouchableOpacity
                  onPress={handleSubscribe}
                  disabled={busy}
                  className="rounded-xl bg-amber-500 items-center"
                  style={{ paddingVertical: 13, opacity: busy ? 0.6 : 1 }}
                  activeOpacity={0.85}
                >
                  {busy ? (
                    <ActivityIndicator color="#171717" />
                  ) : (
                    <Text className="text-neutral-900 font-bold" style={{ fontSize: 15 * fontScale }}>
                      {plan === 'yearly'
                        ? t('shop.premiumSubscribeYearly', {
                            defaultValue: 'Subscribe — {{price}}',
                            price: yearlyLabel,
                          })
                        : t('shop.premiumSubscribe', {
                            defaultValue: 'Subscribe — {{price}}',
                            price: monthlyLabel,
                          })}
                    </Text>
                  )}
                </TouchableOpacity>
              </Breathe>

              <Text className="text-neutral-600 text-center" style={{ fontSize: 10 * fontScale }}>
                {t('shop.premiumCancelAnytime', { defaultValue: 'Cancel anytime · Secure payment' })}
              </Text>
            </View>
          )}

          {/* Restore — required by App Store review guidelines. Visible both
              when premium and when not (a reinstalled user may be premium
              without `me.isPremium` yet). */}
          <TouchableOpacity onPress={handleRestore} className="items-center" activeOpacity={0.7}>
            <Text className="text-neutral-500" style={{ fontSize: 11 * fontScale }}>
              {t('shop.premiumRestore', { defaultValue: 'Restore purchases' })}
            </Text>
          </TouchableOpacity>
        </View>
      </GlowPulse>
    </SlideUp>
  )
}

function PlanTile({
  active,
  onPress,
  label,
  badge,
  hint,
  fontScale,
}: {
  active: boolean
  onPress: () => void
  label: string
  badge?: string
  hint?: string
  fontScale: number
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={[
        'flex-1 p-3 rounded-xl border items-center relative',
        active
          ? 'border-amber-500 bg-amber-500/10'
          : 'border-neutral-800 bg-neutral-900',
      ].join(' ')}
      activeOpacity={0.8}
    >
      {badge && (
        <View className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full bg-neutral-950 border border-amber-500/40">
          <Text className="text-amber-400 font-bold" style={{ fontSize: 8 }}>
            {badge}
          </Text>
        </View>
      )}
      <Text
        className={active ? 'text-white font-semibold' : 'text-neutral-300 font-semibold'}
        style={{ fontSize: 12 * fontScale }}
      >
        {label}
      </Text>
      {hint && (
        <Text className="text-emerald-400 font-semibold mt-0.5" style={{ fontSize: 10 * fontScale }}>
          {hint}
        </Text>
      )}
    </TouchableOpacity>
  )
}

// ─── Checkout banner (web-return UX, still useful on mobile for deep links) ──

function CheckoutBanner({ status, fontScale }: { status?: string; fontScale: number }) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null
  if (status !== 'success' && status !== 'canceled') return null

  return (
    <View
      className={[
        'flex-row items-center px-4 py-3 rounded-xl border',
        status === 'success'
          ? 'bg-emerald-950/40 border-emerald-900/60'
          : 'bg-neutral-900 border-neutral-800',
      ].join(' ')}
      style={{ gap: 10 }}
    >
      <Text
        className={status === 'success' ? 'text-emerald-200 flex-1' : 'text-neutral-300 flex-1'}
        style={{ fontSize: 12 * fontScale }}
      >
        {status === 'success'
          ? t('shop.checkoutSuccess', {
              defaultValue: '✅ Payment successful — your coins will appear in a few seconds.',
            })
          : t('shop.checkoutCanceled', {
              defaultValue: 'Checkout canceled. No charge was made.',
            })}
      </Text>
      <TouchableOpacity onPress={() => setDismissed(true)}>
        <Text className="text-neutral-400" style={{ fontSize: 14 }}>✕</Text>
      </TouchableOpacity>
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
