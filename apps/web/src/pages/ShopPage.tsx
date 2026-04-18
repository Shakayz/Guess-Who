import React, { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavBar } from '../components/NavBar'
import { PremiumBadge } from '../components/PremiumBadge'
import { api } from '../lib/api'
import { usePremium } from '../lib/usePremium'

// Premium prices shown on the plan selector. Source of truth for the actual
// charge is the Stripe Price referenced by STRIPE_PRICE_ID_PREMIUM_{MONTHLY,YEARLY}
// — these constants only drive the display, and match the matching entries in
// packages/shared/src/constants/index.ts (PREMIUM_PLANS).
const PREMIUM_MONTHLY_PRICE_CENTS = 499
const PREMIUM_YEARLY_PRICE_CENTS = 4990
const PREMIUM_CURRENCY = 'eur'

type PremiumPlanId = 'monthly' | 'yearly'

type Tab = 'coins' | 'premium'

type Pack = {
  id: string
  amount: number
  bonus: number
  priceCents: number
  currency: string
}

// Middle-tier pack is flagged as the popular one in the UI. The server doesn't
// care which pack is highlighted, so this stays a web-only cosmetic list.
const POPULAR_PACK_ID = 'pack_1500'

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

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap',
        active ? 'bg-brand-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default function ShopPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  // Initial tab is driven by the `?tab=` URL param so the
  // InsufficientCoinsModal can link directly to /shop?tab=coins.
  // Accepts the legacy `?tab=season` query value so existing links (emails,
  // modals, bookmarks) keep landing on what is now the Premium tab.
  const rawInitial = params.get('tab')
  const initial: Tab =
    rawInitial === 'coins' ? 'coins'
    : rawInitial === 'premium' || rawInitial === 'season' ? 'premium'
    : 'coins'
  const [tab, setTabState] = useState<Tab>(initial)
  const setTab = (next: Tab) => {
    setTabState(next)
    setParams({ tab: next }, { replace: true })
  }

  // Live balance — re-uses the cached ['me'] key other screens seed.
  const { data: me } = useQuery<{ starCoins?: number }>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me'),
    retry: false,
  })
  const starCoins = me?.starCoins ?? 0

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">{t('shop.shop')}</h1>
              <p className="text-neutral-500 text-sm mt-1">{t('shop.subtitle')}</p>
            </div>
            {/* Live wallet — server-authoritative balance */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700">
                <span className="text-sm">⭐</span>
                <span className="text-sm font-semibold text-white">{starCoins.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Tabs — cosmetics tab was removed from the game design, so the
              shop now carries only coins + premium. */}
          <div className="flex gap-2 mb-6 overflow-x-auto">
            <TabButton active={tab === 'coins'}   onClick={() => setTab('coins')}>{t('shop.tabCoins')}</TabButton>
            <TabButton active={tab === 'premium'} onClick={() => setTab('premium')}>{t('shop.tabPremium')}</TabButton>
          </div>

          {/* Post-checkout banner. Stripe redirects back with ?checkout=success
              (balance was credited by the webhook) or ?checkout=canceled. */}
          <CheckoutBanner />

          {tab === 'coins' && <CoinsTab onPlayClick={() => navigate('/')} />}
          {tab === 'premium' && <PremiumTab />}
        </div>
      </main>
    </div>
  )
}

// ─── Coins tab ────────────────────────────────────────────────────────────────

function CoinsTab({ onPlayClick }: { onPlayClick: () => void }) {
  const { t } = useTranslation()

  // Pack catalogue comes from the API so prices/bonuses stay in sync with the
  // server-side COIN_PACKS constant and can be evolved without a web deploy.
  const { data, isLoading, isError } = useQuery<{ packs: Pack[] }>({
    queryKey: ['shop', 'packs'],
    queryFn: () => api.get('/shop/packs'),
    retry: false,
  })

  const checkout = useMutation<{ url: string | null; sessionId: string }, Error, string>({
    mutationFn: (packId) => api.post(`/shop/packs/${packId}/checkout`, {}),
    onSuccess: (res) => {
      // Stripe returns `url` for hosted checkout; redirect the whole tab so
      // the user gets back via success_url / cancel_url after payment.
      if (res.url) window.location.href = res.url
    },
  })

  const pending = checkout.isPending ? checkout.variables : null
  const packs = data?.packs ?? []

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold mb-3">{t('shop.packsTitle')}</p>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card text-center h-40 animate-pulse bg-neutral-900" />
            ))}
          </div>
        ) : isError || packs.length === 0 ? (
          <div className="px-3 py-2.5 rounded-xl bg-amber-950/30 border border-amber-900/50 text-amber-300 text-xs text-center">
            ⏳ {t('shop.packsUnavailable')}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {packs.map((pack) => {
              const popular = pack.id === POPULAR_PACK_ID
              const isBusy = pending === pack.id
              return (
                <div
                  key={pack.id}
                  className={[
                    'card text-center relative overflow-hidden',
                    popular ? 'border-brand-600/40 ring-1 ring-brand-600/20' : '',
                  ].join(' ')}
                >
                  {popular && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold text-brand-400 bg-brand-950/60 px-1.5 py-0.5 rounded-full">
                      POPULAR
                    </span>
                  )}
                  <p className="text-3xl mb-2">⭐</p>
                  <p className="text-2xl font-extrabold text-white">{pack.amount.toLocaleString()}</p>
                  {pack.bonus > 0 && (
                    <p className="text-xs text-emerald-400 font-semibold mt-0.5">+{pack.bonus} bonus</p>
                  )}
                  <p className="text-neutral-400 text-sm mt-2 mb-3">{formatPrice(pack.priceCents, pack.currency)}</p>
                  <button
                    onClick={() => checkout.mutate(pack.id)}
                    disabled={checkout.isPending}
                    className="w-full py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-sm font-semibold transition-colors"
                  >
                    {isBusy ? '…' : t('shop.buy')}
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {checkout.isError && (
          <div className="mt-3 px-3 py-2.5 rounded-xl bg-red-950/30 border border-red-900/50 text-red-300 text-xs text-center">
            {checkout.error.message}
          </div>
        )}
      </section>

      {/* Honest alternative — the game's real earning mechanics. These are
          the channels dailyRewards.ts already implements on the server. */}
      <section>
        <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold mb-3">{t('shop.earnTitle')}</p>
        <div className="space-y-2">
          <EarnRow icon="🎁" text={t('shop.earnDailyBonus')} />
          <EarnRow icon="🔥" text={t('shop.earnStreak')} />
          <EarnRow icon="⚡" text={t('shop.earnLevelUp')} />
          <EarnRow icon="🏆" text={t('shop.earnAchievements')} />
        </div>
        <button
          onClick={onPlayClick}
          className="mt-4 w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all shadow-lg shadow-brand-600/20"
        >
          🎲 {t('shop.earnPlayNow')}
        </button>
      </section>
    </div>
  )
}

function EarnRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800">
      <span className="text-xl shrink-0">{icon}</span>
      <p className="text-sm text-neutral-300">{text}</p>
    </div>
  )
}

// ─── Checkout return banner ───────────────────────────────────────────────────

function CheckoutBanner() {
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const status = params.get('checkout')

  // Refresh balance when we come back from a successful checkout. The webhook
  // credits starCoins server-side; this just re-fetches so the header updates.
  React.useEffect(() => {
    if (status === 'success') {
      queryClient.invalidateQueries({ queryKey: ['me'] })
    }
  }, [status, queryClient])

  if (status !== 'success' && status !== 'canceled') return null

  const dismiss = () => {
    const next = new URLSearchParams(params)
    next.delete('checkout')
    setParams(next, { replace: true })
  }

  return (
    <div
      className={[
        'mb-4 px-4 py-3 rounded-xl border text-sm flex items-center justify-between gap-3',
        status === 'success'
          ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-200'
          : 'bg-neutral-900 border-neutral-800 text-neutral-300',
      ].join(' ')}
    >
      <span>
        {status === 'success'
          ? '✅ Payment successful — your star coins will appear in a few seconds.'
          : 'Checkout canceled. No charge was made.'}
      </span>
      <button onClick={dismiss} className="text-xs text-neutral-400 hover:text-white">
        ✕
      </button>
    </div>
  )
}

// ─── Premium tab ──────────────────────────────────────────────────────────────
// Subscribes the user to the monthly Premium plan via Stripe Checkout.
// Single-tier entry point — the shop is the only place Premium is sold.

function PremiumTab() {
  const { t } = useTranslation()
  const { isPremium, premiumUntil } = usePremium()
  // Default to yearly — highlighted as BEST VALUE so the cheapest-per-month
  // option is the one pre-selected when a user opens the tab.
  const [plan, setPlan] = useState<PremiumPlanId>('yearly')

  const checkout = useMutation<{ url: string | null; sessionId: string }, Error, PremiumPlanId>({
    mutationFn: (planId) => api.post(`/shop/premium/checkout/${planId}`, {}),
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url
    },
  })

  const portal = useMutation<{ url: string }, Error, void>({
    mutationFn: () => api.post('/shop/premium/portal', {}),
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url
    },
  })

  const features: Array<{ icon: string; title: string; desc: string }> = [
    { icon: '🚫', title: t('shop.premiumFeatureNoAdsTitle'),     desc: t('shop.premiumFeatureNoAdsDesc') },
    { icon: '🃏', title: t('shop.premiumFeatureDecksTitle'),     desc: t('shop.premiumFeatureDecksDesc') },
    { icon: '♾️', title: t('shop.premiumFeatureUnlimitedTitle'), desc: t('shop.premiumFeatureUnlimitedDesc') },
  ]

  const monthlyLabel = formatPrice(PREMIUM_MONTHLY_PRICE_CENTS, PREMIUM_CURRENCY)
  const yearlyLabel  = formatPrice(PREMIUM_YEARLY_PRICE_CENTS,  PREMIUM_CURRENCY)
  const priceLabel   = plan === 'yearly' ? yearlyLabel : monthlyLabel
  const ctaKey       = plan === 'yearly' ? 'shop.premiumSubscribeYearly' : 'shop.premiumSubscribe'

  return (
    <div className="card py-8 px-6">
      <div className="text-center mb-6">
        <p className="text-5xl mb-2">👑</p>
        <h2 className="text-2xl font-extrabold text-white">{t('shop.premiumTitle')}</h2>
        <p className="text-neutral-400 text-sm mt-1">{t('shop.premiumSubtitle')}</p>
        {isPremium && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <PremiumBadge size="md" />
            {premiumUntil && (
              <span className="text-xs text-neutral-500">
                {t('shop.premiumRenews', { date: premiumUntil.toLocaleDateString() })}
              </span>
            )}
          </div>
        )}
      </div>
      <ul className="space-y-3 mb-6">
        {features.map((f) => (
          <li
            key={f.title}
            className="flex items-start gap-3 p-3 rounded-xl bg-neutral-900 border border-neutral-800"
          >
            <span className="text-2xl shrink-0" aria-hidden>{f.icon}</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">{f.title}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{f.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      {isPremium ? (
        <button
          onClick={() => portal.mutate()}
          disabled={portal.isPending}
          className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-60 text-white font-bold text-base transition-all border border-neutral-700"
        >
          {portal.isPending ? '…' : t('shop.premiumManage')}
        </button>
      ) : (
        <>
          {/* Plan selector — two side-by-side tiles. Yearly is highlighted as
              the BEST VALUE since it's cheaper per month (~€4.16) than the
              monthly plan (€4.99) and matches the PREMIUM_PLANS entries. */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <PlanTile
              active={plan === 'monthly'}
              onClick={() => setPlan('monthly')}
              label={t('shop.premiumPerMonth', { price: monthlyLabel })}
            />
            <PlanTile
              active={plan === 'yearly'}
              onClick={() => setPlan('yearly')}
              label={t('shop.premiumPerYear', { price: yearlyLabel })}
              badge={t('shop.premiumBestValue')}
              hint={t('shop.premiumSaveTwoMonths')}
            />
          </div>
          <button
            onClick={() => checkout.mutate(plan)}
            disabled={checkout.isPending}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 active:scale-[0.98] text-neutral-900 font-bold text-base transition-all shadow-lg shadow-amber-500/25"
          >
            {checkout.isPending ? '…' : t(ctaKey, { price: priceLabel })}
          </button>
          <p className="text-center text-neutral-600 text-[11px] mt-2">
            {t('shop.premiumCancelAnytime')}
          </p>
        </>
      )}

      {(checkout.isError || portal.isError) && (
        <div className="mt-3 px-3 py-2.5 rounded-xl bg-red-950/30 border border-red-900/50 text-red-300 text-xs text-center">
          {(checkout.error ?? portal.error)?.message}
        </div>
      )}
    </div>
  )
}

function PlanTile({
  active,
  onClick,
  label,
  badge,
  hint,
}: {
  active: boolean
  onClick: () => void
  label: string
  badge?: string
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative p-3 rounded-xl border text-center transition-all',
        active
          ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
          : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700',
      ].join(' ')}
    >
      {badge && (
        <span className="absolute -top-2 right-2 text-[9px] font-bold tracking-wide text-amber-400 bg-neutral-950 border border-amber-500/40 px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <p className={['text-sm font-semibold', active ? 'text-white' : 'text-neutral-300'].join(' ')}>
        {label}
      </p>
      {hint && <p className="text-[11px] text-emerald-400 font-semibold mt-0.5">{hint}</p>}
    </button>
  )
}
