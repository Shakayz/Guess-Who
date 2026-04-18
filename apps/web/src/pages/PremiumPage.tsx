import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NavBar } from '../components/NavBar'
import { PremiumBadge } from '../components/PremiumBadge'
import { api } from '../lib/api'
import { usePremium } from '../lib/usePremium'

type CheckoutResponse = { url: string | null; sessionId: string }
type PortalResponse = { url: string }
type PlanId = 'monthly' | 'yearly'

const PERKS = [
  { icon: '🚫', title: 'No Ads',              desc: 'Completely ad-free experience, always.' },
  { icon: '♾️', title: 'Unlimited Games',     desc: 'Play as many games as you want, no daily limits.' },
  { icon: '🎭', title: 'All Word Categories', desc: 'Access every category including Mangas, Célébrités, Mix and more.' },
  { icon: '🏆', title: 'Ranked Priority',     desc: 'Faster matchmaking in ranked mode.' },
  { icon: '👑', title: 'Premium Badge',       desc: 'Exclusive badge on your profile and in lobbies.' },
]

export default function PremiumPage() {
  const { isPremium, premiumUntil } = usePremium()
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const status = params.get('checkout')

  // On return from a successful checkout, re-fetch /auth/me so the page
  // immediately flips to the "you're premium" state without waiting for the
  // NavBar's own polling. The subscription row is written by the webhook, so
  // there's a small lag — but invalidating is cheap and converges fast.
  React.useEffect(() => {
    if (status === 'success') {
      queryClient.invalidateQueries({ queryKey: ['me'] })
    }
  }, [status, queryClient])

  const checkout = useMutation<CheckoutResponse, Error, PlanId>({
    mutationFn: (planId) => api.post<CheckoutResponse>(`/shop/premium/checkout/${planId}`, {}),
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url
    },
  })

  const portal = useMutation<PortalResponse, Error, void>({
    mutationFn: () => api.post<PortalResponse>(`/shop/premium/portal`, {}),
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url
    },
  })

  const dismissBanner = () => {
    const next = new URLSearchParams(params)
    next.delete('checkout')
    setParams(next, { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-slide-up">

          {(status === 'success' || status === 'canceled') && (
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
                  ? '✅ Payment successful — your Premium is being activated.'
                  : 'Checkout canceled. No charge was made.'}
              </span>
              <button onClick={dismissBanner} className="text-xs text-neutral-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-4 shadow-xl shadow-amber-500/10">
              <span className="text-3xl">👑</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {isPremium ? 'You are Premium' : 'Go Premium'}
            </h1>
            <p className="text-neutral-400 text-sm mt-1.5">The best way to play Red Handed !</p>
            {isPremium && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <PremiumBadge size="md" />
                {premiumUntil && (
                  <span className="text-xs text-neutral-500">
                    renews {premiumUntil.toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-amber-500/30 bg-neutral-900/80 backdrop-blur-sm overflow-hidden shadow-2xl shadow-amber-500/5">
            {/* Top gradient bar */}
            <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

            <div className="p-6 space-y-5">
              {!isPremium && (
                <>
                  {/* Price */}
                  <div className="text-center py-2">
                    <div className="flex gap-3 justify-center">
                      <div className="flex-1 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-center">
                        <p className="text-2xl font-extrabold text-white">1€</p>
                        <p className="text-neutral-400 text-xs font-medium mt-0.5">/ month</p>
                      </div>
                      <div className="flex-1 rounded-xl border border-amber-500/60 bg-amber-500/10 p-3 text-center relative overflow-hidden">
                        <div className="absolute top-1.5 right-1.5 text-[10px] font-bold text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded-full">BEST VALUE</div>
                        <p className="text-2xl font-extrabold text-white">10€</p>
                        <p className="text-neutral-400 text-xs font-medium mt-0.5">/ year</p>
                        <p className="text-emerald-400 text-[10px] font-semibold mt-0.5">Save 2 months free</p>
                      </div>
                    </div>
                    <p className="text-neutral-600 text-xs mt-1 text-center">Cancel anytime</p>
                  </div>
                </>
              )}

              {/* Perks */}
              <ul className="space-y-3">
                {PERKS.map((perk) => (
                  <li key={perk.title} className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">{perk.icon}</span>
                    <div>
                      <p className="text-white font-semibold text-sm">{perk.title}</p>
                      <p className="text-neutral-500 text-xs mt-0.5">{perk.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="space-y-2">
                {isPremium ? (
                  <button
                    onClick={() => portal.mutate()}
                    disabled={portal.isPending}
                    className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-60 text-white font-bold text-base transition-all border border-neutral-700"
                  >
                    {portal.isPending ? '…' : 'Manage Subscription'}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => checkout.mutate('yearly')}
                      disabled={checkout.isPending}
                      className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 active:scale-[0.98] text-neutral-900 font-bold text-base transition-all shadow-lg shadow-amber-500/25"
                    >
                      {checkout.isPending && checkout.variables === 'yearly' ? '…' : 'Subscribe — 10€/year'}
                    </button>
                    <button
                      onClick={() => checkout.mutate('monthly')}
                      disabled={checkout.isPending}
                      className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-60 active:scale-[0.98] text-white font-semibold text-sm transition-all border border-neutral-700"
                    >
                      {checkout.isPending && checkout.variables === 'monthly' ? '…' : 'Monthly — 1€/month'}
                    </button>
                  </>
                )}
              </div>

              {(checkout.isError || portal.isError) && (
                <div className="px-3 py-2.5 rounded-xl bg-red-950/30 border border-red-900/50 text-red-300 text-xs text-center">
                  {(checkout.error ?? portal.error)?.message}
                </div>
              )}

              <p className="text-center text-neutral-600 text-xs">
                Secure payment · No commitments · Cancel anytime
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
