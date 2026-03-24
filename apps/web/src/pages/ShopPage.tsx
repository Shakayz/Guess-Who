import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavBar } from '../components/NavBar'
import { GOLD_COIN_PACKS } from '@imposter/shared'

type Tab = 'coins' | 'cosmetics' | 'season'

const MOCK_COSMETICS = [
  { id: '1', name: 'Shadow Cloak',    type: 'avatar_outfit',   price: 200, currency: 'star', icon: '🦇', isNew: true },
  { id: '2', name: 'Gold Crown',      type: 'avatar_accessory', price: 150, currency: 'star', icon: '👑', isNew: false },
  { id: '3', name: 'Neon Frame',      type: 'card_background',  price: 80,  currency: 'star', icon: '🌈', isNew: false },
  { id: '4', name: 'Smoke Reveal',    type: 'word_effect',      price: 500, currency: 'gold', icon: '💨', isNew: true },
  { id: '5', name: 'The Architect',   type: 'title',            price: 300, currency: 'star', icon: '🏗️', isNew: false },
  { id: '6', name: 'Detective Badge', type: 'badge',            price: 120, currency: 'star', icon: '🔍', isNew: false },
]

const SEASON_PERKS = [
  '🎭 Exclusive Season 1 avatar frame',
  '⚡ 1.5× XP boost on all games',
  '💰 +50 Gold Coins per month',
  '🌟 Access to Premium Word Packs',
  '🏆 Season-exclusive title: "The Strategist"',
]

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2 text-sm font-semibold rounded-lg transition-all',
        active ? 'bg-brand-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default function ShopPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('coins')

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">{t('shop.shop')}</h1>
              <p className="text-neutral-500 text-sm mt-1">Cosmetics, coins & season pass</p>
            </div>
            {/* Wallet */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700">
                <span className="text-sm">⭐</span>
                <span className="text-sm font-semibold text-white">100</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-800/50">
                <span className="text-sm">💰</span>
                <span className="text-sm font-semibold text-amber-400">0</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <TabButton active={tab === 'coins'}     onClick={() => setTab('coins')}>💰 Gold Coins</TabButton>
            <TabButton active={tab === 'cosmetics'} onClick={() => setTab('cosmetics')}>🎨 Cosmetics</TabButton>
            <TabButton active={tab === 'season'}    onClick={() => setTab('season')}>👑 Season Pass</TabButton>
          </div>

          {/* Gold Coins */}
          {tab === 'coins' && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold">Gold Coin Packs</p>
              <div className="grid grid-cols-3 gap-3">
                {GOLD_COIN_PACKS.map((pack, i) => (
                  <div
                    key={pack.id}
                    className={[
                      'card text-center relative overflow-hidden cursor-pointer transition-all hover:border-brand-600/50 hover:-translate-y-0.5',
                      i === 1 ? 'border-brand-600/40 ring-1 ring-brand-600/20' : '',
                    ].join(' ')}
                  >
                    {i === 1 && (
                      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
                    )}
                    {i === 1 && (
                      <span className="absolute top-2 right-2 text-[10px] font-bold text-brand-400 bg-brand-950/60 px-1.5 py-0.5 rounded-full">POPULAR</span>
                    )}
                    <p className="text-3xl mb-2">💰</p>
                    <p className="text-2xl font-extrabold text-white">{pack.amount.toLocaleString()}</p>
                    {pack.bonus > 0 && (
                      <p className="text-xs text-emerald-400 font-semibold mt-0.5">+{pack.bonus} bonus</p>
                    )}
                    <p className="text-neutral-400 text-sm mt-2 mb-3">${pack.price}</p>
                    <button className="w-full py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors">
                      {t('shop.buy')}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-neutral-600 text-center">Gold Coins are used for premium cosmetics and word packs.</p>
            </div>
          )}

          {/* Cosmetics */}
          {tab === 'cosmetics' && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold">Available items</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {MOCK_COSMETICS.map((item) => (
                  <div key={item.id} className="card relative flex flex-col items-center text-center gap-2 hover:border-neutral-700 transition-colors cursor-pointer hover:-translate-y-0.5">
                    {item.isNew && (
                      <span className="absolute top-2 right-2 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded-full">NEW</span>
                    )}
                    <span className="text-4xl mt-1">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.name}</p>
                      <p className="text-xs text-neutral-500 capitalize">{item.type.replace(/_/g, ' ')}</p>
                    </div>
                    <button className={[
                      'w-full py-1.5 rounded-lg text-xs font-semibold transition-colors',
                      item.currency === 'gold'
                        ? 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-400 border border-amber-800/40'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-white',
                    ].join(' ')}>
                      {item.currency === 'gold' ? '💰' : '⭐'} {item.price}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Season Pass */}
          {tab === 'season' && (
            <div className="space-y-4">
              <div className="card relative overflow-hidden border-brand-600/40">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-1">Season 1</p>
                      <h2 className="text-2xl font-extrabold text-white">Season Pass</h2>
                      <p className="text-neutral-400 text-sm mt-1">Unlock exclusive rewards every month</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-extrabold text-white">$4.99</p>
                      <p className="text-xs text-neutral-500">per month</p>
                    </div>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {SEASON_PERKS.map((perk) => (
                      <li key={perk} className="flex items-center gap-2 text-sm text-neutral-300">
                        <span className="text-emerald-400 shrink-0">✓</span>
                        {perk}
                      </li>
                    ))}
                  </ul>

                  <button className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all shadow-lg shadow-brand-600/20">
                    Subscribe — $4.99/mo
                  </button>
                  <p className="text-xs text-neutral-600 text-center mt-3">Cancel anytime. No commitments.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
