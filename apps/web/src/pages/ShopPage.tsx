import React, { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'
import { createLogger } from '../lib/logger'

const log = createLogger('shop')

type Tab = 'coins' | 'cosmetics' | 'season'

/**
 * Gold-coin packs shown in the "Coins" tab. Real Stripe checkout is disabled
 * server-side right now (apps/api/src/routes/shop.ts — GET /api/shop/packs
 * returns 503), so the UI displays the packs but with a clear "coming soon"
 * notice. We keep the visual so players know it's planned and can see the
 * earning alternatives (daily bonus / streak / game rewards) underneath.
 *
 * When real payments are ready: drop these fallbacks, call GET /api/shop/packs
 * and POST /api/shop/packs/:id/checkout to redirect to Stripe.
 */
const PLACEHOLDER_COIN_PACKS = [
  { id: 'small',   amount: 500,   price: '$1.99',  bonus: 0 },
  { id: 'medium',  amount: 1500,  price: '$4.99',  bonus: 150, popular: true },
  { id: 'large',   amount: 5000,  price: '$14.99', bonus: 750 },
] as const

interface Cosmetic {
  id: string
  name: string
  type: string
  price: number
  currency: 'star' | 'gold'
  icon?: string | null
  isNew?: boolean
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

  // Initial tab is driven by the `?tab=` URL param so the InsufficientCoinsModal
  // can link directly to /shop?tab=coins.
  const initial = (params.get('tab') as Tab) || 'coins'
  const [tab, setTabState] = useState<Tab>(
    initial === 'coins' || initial === 'cosmetics' || initial === 'season' ? initial : 'coins',
  )
  const setTab = (next: Tab) => {
    setTabState(next)
    setParams({ tab: next }, { replace: true })
  }

  // Live balance — re-uses the cached ['me'] key NavBar/Profile already seed.
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
            {/* Live wallet — reflects the server-authoritative balance */}
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

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto">
            <TabButton active={tab === 'coins'}     onClick={() => setTab('coins')}>{t('shop.tabCoins')}</TabButton>
            <TabButton active={tab === 'cosmetics'} onClick={() => setTab('cosmetics')}>{t('shop.tabCosmetics')}</TabButton>
            <TabButton active={tab === 'season'}    onClick={() => setTab('season')}>{t('shop.tabSeason')}</TabButton>
          </div>

          {tab === 'coins' && <CoinsTab onPlayClick={() => navigate('/')} />}
          {tab === 'cosmetics' && <CosmeticsTab starCoins={starCoins} goldCoins={goldCoins} />}
          {tab === 'season' && <SeasonTab />}
        </div>
      </main>
    </div>
  )
}

// ─── Coins tab ────────────────────────────────────────────────────────────────

function CoinsTab({ onPlayClick }: { onPlayClick: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      {/* Pack grid — visually available but non-functional until payments are
          re-enabled server-side. The banner underneath makes this explicit. */}
      <section>
        <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold mb-3">{t('shop.packsTitle')}</p>
        <div className="grid grid-cols-3 gap-3">
          {PLACEHOLDER_COIN_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={[
                'card text-center relative overflow-hidden cursor-not-allowed opacity-80',
                (pack as any).popular ? 'border-brand-600/40 ring-1 ring-brand-600/20' : '',
              ].join(' ')}
            >
              {(pack as any).popular && (
                <span className="absolute top-2 right-2 text-[10px] font-bold text-brand-400 bg-brand-950/60 px-1.5 py-0.5 rounded-full">
                  POPULAR
                </span>
              )}
              <p className="text-3xl mb-2">⭐</p>
              <p className="text-2xl font-extrabold text-white">{pack.amount.toLocaleString()}</p>
              {pack.bonus > 0 && (
                <p className="text-xs text-emerald-400 font-semibold mt-0.5">+{pack.bonus} bonus</p>
              )}
              <p className="text-neutral-400 text-sm mt-2 mb-3">{pack.price}</p>
              <button
                disabled
                className="w-full py-1.5 rounded-lg bg-neutral-800 text-neutral-500 text-sm font-semibold cursor-not-allowed"
              >
                {t('shop.buy')}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 px-3 py-2.5 rounded-xl bg-amber-950/30 border border-amber-900/50 text-amber-300 text-xs text-center">
          ⏳ {t('shop.packsUnavailable')}
        </div>
      </section>

      {/* Honest alternative: point the player at the free earning mechanics
          that already exist in the game (dailyRewards.ts). */}
      <section>
        <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold mb-3">{t('shop.earnTitle')}</p>
        <div className="space-y-2">
          <EarnRow icon="🎁" text={t('shop.earnDailyBonus')} />
          <EarnRow icon="🔥" text={t('shop.earnStreak')} />
          <EarnRow icon="🎮" text={t('shop.earnGameReward')} />
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

// ─── Cosmetics tab ────────────────────────────────────────────────────────────

function CosmeticsTab({ starCoins, goldCoins }: { starCoins: number; goldCoins: number }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const { data: cosmetics, isLoading } = useQuery<Cosmetic[]>({
    queryKey: ['shop', 'cosmetics'],
    queryFn: () => api.get('/shop/cosmetics'),
    staleTime: 10 * 60 * 1000,
  })

  const purchase = useMutation({
    mutationFn: (id: string) => api.post(`/shop/cosmetics/${id}/purchase`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setToast({ kind: 'ok', text: t('shop.purchaseSuccess') })
      setTimeout(() => setToast(null), 3500)
    },
    onError: (err: any) => {
      log.error('cosmetic purchase failed', { error: err?.message })
      setToast({ kind: 'err', text: err?.data?.error ?? t('shop.purchaseFailed') })
      setTimeout(() => setToast(null), 3500)
    },
  })

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold">{t('shop.cosmeticsTitle')}</p>

      {toast && (
        <div
          role="alert"
          className={[
            'px-3 py-2.5 rounded-xl text-sm text-center',
            toast.kind === 'ok'
              ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300'
              : 'bg-red-950/50 border border-red-800/50 text-red-300',
          ].join(' ')}
        >
          {toast.text}
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-neutral-500 py-8">…</div>
      ) : !cosmetics || cosmetics.length === 0 ? (
        <p className="text-center text-neutral-500 py-8 text-sm">{t('shop.cosmeticsEmpty')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {cosmetics.map((item) => {
            const canAfford =
              item.currency === 'star' ? starCoins >= item.price : goldCoins >= item.price
            const isBuying = purchase.isPending && purchase.variables === item.id
            return (
              <div
                key={item.id}
                className="card relative flex flex-col items-center text-center gap-2 hover:border-neutral-700 transition-colors"
              >
                {item.isNew && (
                  <span className="absolute top-2 right-2 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded-full">
                    NEW
                  </span>
                )}
                <span className="text-4xl mt-1">{item.icon || '🎨'}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{item.name}</p>
                  <p className="text-xs text-neutral-500 capitalize">{item.type.replace(/_/g, ' ')}</p>
                </div>
                <button
                  onClick={() => purchase.mutate(item.id)}
                  disabled={!canAfford || isBuying || item.currency === 'gold'}
                  className={[
                    'w-full py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    item.currency === 'gold'
                      ? 'bg-amber-950/60 text-amber-400/60 border border-amber-800/40 cursor-not-allowed'
                      : canAfford
                        ? 'bg-brand-600 hover:bg-brand-500 text-white'
                        : 'bg-neutral-800 text-neutral-500 cursor-not-allowed',
                  ].join(' ')}
                >
                  {isBuying ? '…' : `${item.currency === 'gold' ? '💰' : '⭐'} ${item.price}`}
                </button>
              </div>
            )
          })}
        </div>
      )}
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
