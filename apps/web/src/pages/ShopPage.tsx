import React, { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavBar } from '../components/NavBar'
import { PremiumBadge } from '../components/PremiumBadge'
import { api } from '../lib/api'
import { usePremium } from '../lib/usePremium'
import { EmoteTile } from '../components/emotes/EmoteTile'
import { useEmotesStore } from '../store/emotes'
import { InsufficientCoinsModal } from '../components/InsufficientCoinsModal'
import type { EmoteRarity } from '@red-handed/shared'

// Premium prices shown on the plan selector. Source of truth for the actual
// charge is the Stripe Price referenced by STRIPE_PRICE_ID_PREMIUM_{MONTHLY,YEARLY}
// — these constants only drive the display, and match the matching entries in
// packages/shared/src/constants/index.ts (PREMIUM_PLANS).
const PREMIUM_MONTHLY_PRICE_CENTS = 499
const PREMIUM_YEARLY_PRICE_CENTS = 4990
const PREMIUM_CURRENCY = 'eur'

type PremiumPlanId = 'monthly' | 'yearly'

type Tab = 'coins' | 'emotes' | 'premium'

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
    : rawInitial === 'emotes' ? 'emotes'
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

          {/* Tabs — Emotes sits between Coins and Premium as the "spend your
              coins on cosmetic extras" destination. */}
          <div className="flex gap-2 mb-6 overflow-x-auto">
            <TabButton active={tab === 'coins'}   onClick={() => setTab('coins')}>{t('shop.tabCoins')}</TabButton>
            <TabButton active={tab === 'emotes'}  onClick={() => setTab('emotes')}>Emotes</TabButton>
            <TabButton active={tab === 'premium'} onClick={() => setTab('premium')}>{t('shop.tabPremium')}</TabButton>
          </div>

          {/* Post-checkout banner. Stripe redirects back with ?checkout=success
              (balance was credited by the webhook) or ?checkout=canceled. */}
          <CheckoutBanner />

          {/* Gifts received from friends. Hidden when empty. Placed above the
              tab content so it's the first thing a user sees when they open
              the shop to redeem. */}
          <GiftsInbox />

          {tab === 'coins' && <CoinsTab onPlayClick={() => navigate('/')} />}
          {tab === 'emotes' && <EmotesTab starCoins={starCoins} onGoToCoins={() => setTab('coins')} />}
          {tab === 'premium' && <PremiumTab />}
        </div>
      </main>
    </div>
  )
}

// ─── Coins tab ────────────────────────────────────────────────────────────────

function CoinsTab({ onPlayClick }: { onPlayClick: () => void }) {
  const { t } = useTranslation()
  const [giftTarget, setGiftTarget] = useState<{ kind: 'pack'; id: string; label: string } | null>(null)

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
                  <button
                    onClick={() => setGiftTarget({
                      kind: 'pack',
                      id: pack.id,
                      label: `${pack.amount.toLocaleString()}⭐ · ${formatPrice(pack.priceCents, pack.currency)}`,
                    })}
                    className="mt-1.5 w-full py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors"
                  >
                    🎁 Gift
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

      {giftTarget && (
        <GiftModal
          target={giftTarget}
          onClose={() => setGiftTarget(null)}
        />
      )}

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

// ─── Emotes tab ───────────────────────────────────────────────────────────────
// Browse the emote catalog and spend star coins to unlock new reactions.
// Catalog comes from /api/emotes/catalog (public, static) and ownership from
// /api/emotes/me (authed) — rendered together in a single grid grouped by
// rarity. After a successful purchase we update the local store + React Query
// `me` cache so the coin balance, in-game React bar, and Profile loadout
// picker all refresh without a second fetch.

type CatalogEmote = {
  id: string
  emoji: string
  name: string
  rarity: EmoteRarity
  price: number
  animation: string
  particle: string
}

const RARITY_ORDER: EmoteRarity[] = ['legendary', 'epic', 'rare', 'common', 'free']
const RARITY_LABEL: Record<EmoteRarity, string> = {
  legendary: 'Legendary',
  epic: 'Epic',
  rare: 'Rare',
  common: 'Common',
  free: 'Free',
}

function EmotesTab({ starCoins, onGoToCoins }: { starCoins: number; onGoToCoins: () => void }) {
  const queryClient = useQueryClient()
  const emotesStore = useEmotesStore()
  const [notice, setNotice] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  const [confirming, setConfirming] = useState<CatalogEmote | null>(null)
  // Tracks the emote whose purchase was blocked by insufficient ⭐. Drives the
  // "Get coins" modal — same component the lobby uses — so every coin-gated
  // action in the app shares a single "suggest buying coins" flow.
  const [shortOn, setShortOn] = useState<CatalogEmote | null>(null)

  // Prime the store on mount so the loadout/owned set is current before the
  // user buys anything. fetchMe is a no-op if already in flight.
  React.useEffect(() => { emotesStore.fetchMe() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: catalog, isLoading } = useQuery<{ emotes: CatalogEmote[] }>({
    queryKey: ['emotes', 'catalog'],
    queryFn: () => api.get('/emotes/catalog'),
    retry: false,
  })

  const buy = useMutation<{ ok: boolean; emoteId: string; starCoins: number }, Error, string>({
    mutationFn: (id) => api.post(`/emotes/${id}/buy`, {}),
    onSuccess: (res) => {
      // Local store — flips the tile to "Owned" and makes the emote pickable
      // in the Profile loadout screen without waiting on a refetch.
      emotesStore.markOwned(res.emoteId)
      // React Query caches that other screens read from.
      queryClient.setQueryData<{ starCoins?: number }>(['me'], (prev) => ({
        ...(prev ?? {}),
        starCoins: res.starCoins,
      }))
      queryClient.invalidateQueries({ queryKey: ['me'] })
      // NavBar keeps its own local state (not react-query). Push the new
      // balance so the header chip updates immediately.
      window.dispatchEvent(
        new CustomEvent('wallet:balance', { detail: { starCoins: res.starCoins } }),
      )
      setNotice({ kind: 'ok', text: 'Unlocked! Equip it in Profile → Emotes.' })
    },
    onError: (err, id) => {
      const msg = err.message || ''
      // Server confirmed the wallet is short — swap the inline toast for the
      // shared InsufficientCoinsModal so the user gets a "Get coins" CTA that
      // flips the shop to the coins tab.
      if (msg.includes('insufficient_coins')) {
        const em = (catalog?.emotes ?? []).find((e) => e.id === id)
        if (em) {
          setShortOn(em)
          return
        }
      }
      setNotice({
        kind: 'error',
        text: msg.includes('already_owned')
          ? 'You already own this emote.'
          : msg || 'Purchase failed. Please try again.',
      })
    },
  })

  const owned = new Set(emotesStore.me?.ownedIds ?? [])
  const emotes = catalog?.emotes ?? []

  // Group by rarity so the grid reads "wow stuff first" → "basics last".
  const grouped = React.useMemo(() => {
    const map: Record<EmoteRarity, CatalogEmote[]> = {
      legendary: [], epic: [], rare: [], common: [], free: [],
    }
    for (const em of emotes) map[em.rarity].push(em)
    return map
  }, [emotes])

  // Click handler. Never silently swallow the click — if the purchase can't
  // go through, show why. Client-side affordability is a UX hint only; the
  // server is authoritative, so we still attempt the request when the client
  // balance looks low (protects against stale /auth/me caches where the
  // header chip shows the correct balance but this component read 0).
  const handleBuy = (em: CatalogEmote) => {
    setNotice(null)
    if (em.rarity === 'free' || owned.has(em.id)) {
      setNotice({ kind: 'ok', text: 'You already have this one.' })
      return
    }
    if (buy.isPending) return
    // Client-side affordability short-circuit — skip the confirm step and
    // jump straight to the "Get coins" modal so the user doesn't have to
    // click through a confirm only to be rejected on the next screen.
    if (starCoins < em.price) {
      setShortOn(em)
      return
    }
    setConfirming(em)
  }

  const confirmPurchase = () => {
    if (!confirming) return
    const em = confirming
    setConfirming(null)
    buy.mutate(em.id)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-600/30 bg-brand-950/30 px-4 py-3 text-sm text-brand-200">
        Unlocked emotes are automatically available for your React bar. Head to{' '}
        <span className="font-semibold text-white">Profile → Emotes</span> to pick which 10 appear in-game.
      </div>

      {notice && (
        <div
          className={[
            'px-3 py-2.5 rounded-xl border text-xs text-center',
            notice.kind === 'error'
              ? 'bg-red-950/30 border-red-900/50 text-red-300'
              : 'bg-emerald-950/30 border-emerald-900/50 text-emerald-300',
          ].join(' ')}
        >
          {notice.text}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-neutral-900 animate-pulse" />
          ))}
        </div>
      ) : (
        RARITY_ORDER.map((rarity) => {
          const bucket = grouped[rarity]
          if (bucket.length === 0) return null
          return (
            <section key={rarity}>
              <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold mb-3">
                {RARITY_LABEL[rarity]}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {bucket.map((em) => {
                  const isOwned = owned.has(em.id) || em.rarity === 'free'
                  // Visually dim unaffordable tiles, but still let the click
                  // through — the server revalidates the balance and the
                  // onError handler surfaces the real message.
                  const canAfford = starCoins >= em.price
                  const dimmed = isOwned || em.rarity === 'free' || !canAfford
                  // Only fully-disable tiles the user already owns or that
                  // aren't purchasable at all (free tier). Unaffordable tiles
                  // stay clickable so stale-balance cases don't silently fail.
                  const hardDisabled = isOwned || em.rarity === 'free'
                  const busy = buy.isPending && buy.variables === em.id
                  return (
                    <EmoteTile
                      key={em.id}
                      emoji={em.emoji}
                      name={em.name}
                      rarity={em.rarity}
                      price={em.price}
                      owned={isOwned}
                      disabled={hardDisabled}
                      dimmed={dimmed && !hardDisabled}
                      busy={busy}
                      onClick={() => handleBuy(em)}
                    />
                  )
                })}
              </div>
            </section>
          )
        })
      )}

      {confirming && (
        <ConfirmPurchaseModal
          emote={confirming}
          starCoins={starCoins}
          onCancel={() => setConfirming(null)}
          onConfirm={confirmPurchase}
        />
      )}

      {shortOn && (
        <InsufficientCoinsModal
          required={shortOn.price}
          onGetCoins={() => {
            setShortOn(null)
            onGoToCoins()
          }}
          onClose={() => setShortOn(null)}
        />
      )}
    </div>
  )
}

function ConfirmPurchaseModal({
  emote,
  starCoins,
  onCancel,
  onConfirm,
}: {
  emote: CatalogEmote
  starCoins: number
  onCancel: () => void
  onConfirm: () => void
}) {
  const canAfford = starCoins >= emote.price
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <p className="text-5xl mb-2" aria-hidden>{emote.emoji}</p>
          <h3 className="text-lg font-extrabold text-white">Unlock {emote.name}?</h3>
          <p className="text-sm text-neutral-400 mt-1">
            This will spend <span className="font-semibold text-white">{emote.price.toLocaleString()} ⭐</span> from your balance.
          </p>
          <p className="text-xs text-neutral-500 mt-2">
            Balance: {starCoins.toLocaleString()} ⭐
            {canAfford && (
              <> → {(starCoins - emote.price).toLocaleString()} ⭐ after</>
            )}
          </p>
          {!canAfford && (
            <p className="text-xs text-red-400 mt-2">
              Not enough coins — short by {(emote.price - starCoins).toLocaleString()} ⭐.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canAfford}
            className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-sm font-bold transition-colors"
          >
            Confirm · {emote.price.toLocaleString()} ⭐
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Gifts inbox ──────────────────────────────────────────────────────────────
// Shows gifts the user has received but not yet claimed. Claiming credits coins
// or extends premiumUntil server-side — we invalidate ['me'] so the header
// balance and premium badge update immediately.

type InboxGift = {
  id: string
  coinAmount: number
  premiumPlanId: string | null
  message: string | null
  createdAt: string
  sender: { id: string; username: string; avatarUrl: string | null }
}

function GiftsInbox() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery<InboxGift[]>({
    queryKey: ['gifts', 'inbox'],
    queryFn: () => api.get('/gifts/inbox'),
    retry: false,
  })

  const claim = useMutation<unknown, Error, string>({
    mutationFn: (giftId) => api.post(`/gifts/${giftId}/claim`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gifts', 'inbox'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })

  if (isLoading || !data || data.length === 0) return null

  return (
    <section className="mb-6">
      <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold mb-3">
        🎁 Gifts for you
      </p>
      <div className="space-y-2">
        {data.map((gift) => {
          const describe = gift.premiumPlanId
            ? gift.premiumPlanId === 'yearly'
              ? 'Premium · 1 year'
              : 'Premium · 1 month'
            : `${gift.coinAmount.toLocaleString()} ⭐`
          const busy = claim.isPending && claim.variables === gift.id
          return (
            <div
              key={gift.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900 border border-neutral-800"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">
                  <span className="font-semibold">@{gift.sender.username}</span>
                  <span className="text-neutral-400"> sent you </span>
                  <span className="font-semibold">{describe}</span>
                </p>
                {gift.message && (
                  <p className="text-xs text-neutral-400 mt-1 italic truncate">"{gift.message}"</p>
                )}
              </div>
              <button
                onClick={() => claim.mutate(gift.id)}
                disabled={claim.isPending}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold transition-colors"
              >
                {busy ? '…' : 'Claim'}
              </button>
            </div>
          )
        })}
      </div>
      {claim.isError && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-red-950/30 border border-red-900/50 text-red-300 text-xs">
          {claim.error.message}
        </div>
      )}
    </section>
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
  const [giftTarget, setGiftTarget] = useState<{ kind: 'premium'; id: PremiumPlanId; label: string } | null>(null)

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

      {/* Gift CTA — always shown (even if the buyer is already premium) so
          users can buy premium for friends regardless of their own status. */}
      <button
        onClick={() => setGiftTarget({
          kind: 'premium',
          id: plan,
          label: plan === 'yearly' ? `Premium 1 year · ${yearlyLabel}` : `Premium 1 month · ${monthlyLabel}`,
        })}
        className="mt-3 w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold transition-colors border border-neutral-700"
      >
        🎁 Gift this to a friend
      </button>

      {(checkout.isError || portal.isError) && (
        <div className="mt-3 px-3 py-2.5 rounded-xl bg-red-950/30 border border-red-900/50 text-red-300 text-xs text-center">
          {(checkout.error ?? portal.error)?.message}
        </div>
      )}

      {giftTarget && (
        <GiftModal target={giftTarget} onClose={() => setGiftTarget(null)} />
      )}
    </div>
  )
}

// ─── Gift modal ───────────────────────────────────────────────────────────────
// Pops up from the shop when the user taps "🎁 Gift" on a pack or the premium
// plan. Collects the receiver's username + an optional message, then POSTs to
// the server's gift-checkout endpoint and redirects to Stripe. On completion
// the webhook creates a Gift row instead of crediting the buyer — the
// receiver claims through the normal gifts inbox.

type GiftTarget =
  | { kind: 'pack'; id: string; label: string }
  | { kind: 'premium'; id: PremiumPlanId; label: string }

function GiftModal({ target, onClose }: { target: GiftTarget; onClose: () => void }) {
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

  const { data: friends = [] } = useQuery<Array<{ friendshipId: string; user: { id: string; username: string; avatarUrl: string | null } }>>({
    queryKey: ['friends', 'list'],
    queryFn: async () => {
      const res = await api.get<{ friends: Array<{ friendshipId: string; user: { id: string; username: string; avatarUrl: string | null } }> }>('/friends')
      return res.friends
    },
  })

  const query = username.trim().toLowerCase()
  const suggestions = (query
    ? friends.filter((f) => f.user.username.toLowerCase().includes(query) && f.user.username.toLowerCase() !== query)
    : friends
  ).slice(0, 5)

  const checkout = useMutation<{ url: string | null }, Error, void>({
    mutationFn: () => {
      const path = target.kind === 'pack'
        ? `/shop/packs/${target.id}/gift`
        : `/shop/premium/gift/${target.id}`
      return api.post(path, { receiverUsername: username.trim(), message: message.trim() || undefined })
    },
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url
    },
  })

  const canSubmit = username.trim().length > 0 && !checkout.isPending

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-extrabold text-white">🎁 Send as gift</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        <p className="text-xs text-neutral-400 mb-4">
          You're gifting <span className="font-semibold text-white">{target.label}</span>. Your
          friend gets it in their inbox after your payment clears.
        </p>

        <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1.5">
          Friend's username
        </label>
        <div className="relative mb-3">
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setSuggestionsOpen(true)
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
            placeholder="e.g. alice"
            autoFocus
            maxLength={20}
            className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm focus:border-brand-500 focus:outline-none"
          />
          {suggestionsOpen && suggestions.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg bg-neutral-950 border border-neutral-800 shadow-xl">
              {suggestions.map((f) => (
                <li key={f.friendshipId}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setUsername(f.user.username)
                      setSuggestionsOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-800 text-white text-sm"
                  >
                    {f.user.avatarUrl ? (
                      <img src={f.user.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] text-neutral-400">
                        {f.user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="truncate">{f.user.username}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1.5">
          Message <span className="text-neutral-600 normal-case font-normal">(optional)</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Happy birthday! 🎂"
          maxLength={200}
          rows={2}
          className="w-full mb-4 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-sm focus:border-brand-500 focus:outline-none resize-none"
        />

        {checkout.isError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-950/30 border border-red-900/50 text-red-300 text-xs">
            {errorMessage(checkout.error)}
          </div>
        )}

        <button
          onClick={() => checkout.mutate()}
          disabled={!canSubmit}
          className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-sm font-bold transition-colors"
        >
          {checkout.isPending ? '…' : 'Continue to payment'}
        </button>
        <p className="text-[11px] text-neutral-600 text-center mt-2">
          You must be friends to send a gift.
        </p>
      </div>
    </div>
  )
}

// Translates the API's discriminated error codes to end-user-friendly text.
// The server returns short machine-readable codes (`not_friends`,
// `user_not_found`, etc.) so the UI layer controls the copy/tone.
function errorMessage(err: Error): string {
  const raw = err.message || ''
  if (raw.includes('not_friends')) return 'You can only gift friends.'
  if (raw.includes('user_not_found')) return 'No user with that username.'
  if (raw.includes('cannot_gift_self')) return "You can't gift yourself."
  if (raw.includes('missing_receiver')) return 'Enter a username.'
  return raw || 'Something went wrong.'
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
