import React from 'react'
import { NavBar } from '../components/NavBar'

const PERKS = [
  { icon: '🚫', title: 'No Ads', desc: 'Completely ad-free experience, always.' },
  { icon: '♾️', title: 'Unlimited Games', desc: 'Play as many games as you want, no daily limits.' },
  { icon: '🎭', title: 'All Word Categories', desc: 'Access every category including Mangas, Célébrités, Mix and more.' },
  { icon: '🏆', title: 'Ranked Priority', desc: 'Faster matchmaking in ranked mode.' },
  { icon: '👑', title: 'Premium Badge', desc: 'Exclusive badge on your profile and in lobbies.' },
]

export default function PremiumPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-slide-up">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-4 shadow-xl shadow-amber-500/10">
              <span className="text-3xl">👑</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Go Premium</h1>
            <p className="text-neutral-400 text-sm mt-1.5">The best way to play Imposter Game</p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-amber-500/30 bg-neutral-900/80 backdrop-blur-sm overflow-hidden shadow-2xl shadow-amber-500/5">
            {/* Top gradient bar */}
            <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

            <div className="p-6 space-y-5">
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
                <button className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-neutral-900 font-bold text-base transition-all shadow-lg shadow-amber-500/25">
                  Subscribe — 10€/year
                </button>
                <button className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] text-white font-semibold text-sm transition-all border border-neutral-700">
                  Monthly — 1€/month
                </button>
              </div>

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
