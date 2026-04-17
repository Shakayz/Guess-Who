import React, { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'

type Tab = 'coins' | 'season'

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
  const initial = (params.get('tab') as Tab) || 'coins'
  const [tab, setTabState] = useState<Tab>(
    initial === 'coins' || initial === 'season' ? initial : 'coins',
  )
  const setTab = (next: Tab) => {
    setTabState(next)
    setParams({ tab: next }, { replace: true })
  }

  // Live balance — re-uses the cached ['me'] key other screens seed.
  const { data: me } = useQuery<{ starCoins?: number; goldCoins?: number }>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me'),
    retry: false,
  })
  const starCoins = me?.starCoins ?? 0
  const goldCoins = me?.goldCoins ?? 0

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
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-800/50">
                <span className="text-sm">💰</span>
                <span className="text-sm font-semibold text-amber-400">{goldCoins.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Tabs — cosmetics tab was removed from the game design, so the
              shop now carries only coins + season pass. */}
          <div className="flex gap-2 mb-6 overflow-x-auto">
            <TabButton active={tab === 'coins'}  onClick={() => setTab('coins')}>{t('shop.tabCoins')}</TabButton>
            <TabButton active={tab === 'season'} onClick={() => setTab('season')}>{t('shop.tabSeason')}</TabButton>
          </div>

          {/* Post-checkout banner. Stripe redirects back with ?checkout=success
              (balance was credited by the webhook) or ?checkout=canceled. */}
          <CheckoutBanner />

          {tab === 'coins' && <CoinsTab onPlayClick={() => navigate('/')} />}
          {tab === 'season' && <SeasonTab />}
        </div>
      </main>
    </div>
  )
}

// ─── Coins tab ────────────────────────────────────────────────────────────────

function CoinsTab({ onPlayClick }: { onPlayClick: () => void }) {
  const { t } = useTranslation()

  // Pack catalogue comes from the API so prices/bonuses stay in sync with the
  // server-side GOLD_COIN_PACKS constant and can be evolved without a web deploy.
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
                  <p className="text-3xl mb-2">💰</p>
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
  // credits goldCoins server-side; this just re-fetches so the header updates.
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
          ? '✅ Payment successful — your gold coins will appear in a few seconds.'
          : 'Checkout canceled. No charge was made.'}
      </span>
      <button onClick={dismiss} className="text-xs text-neutral-400 hover:text-white">
        ✕
      </button>
    </div>
  )
}

// ─── Season pass tab (disabled placeholder) ───────────────────────────────────

function SeasonTab() {
  const { t } = useTranslation()
  return (
    <div className="card text-center py-10">
      <p className="text-4xl mb-3">👑</p>
      <p className="text-white font-semibold">{t('shop.seasonComingSoon')}</p>
    </div>
  )
}
