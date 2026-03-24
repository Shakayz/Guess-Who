import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'

interface SeasonTier {
  id: string
  tierNumber: number
  xpRequired: number
  rewardType: string
  rewardValue: string
  isPremium: boolean
  claimed: boolean
  unlocked: boolean
}

interface SeasonData {
  id: string
  name: string
  startDate: string
  endDate: string
  userXp: number
  tiers: SeasonTier[]
}

const REWARD_ICONS: Record<string, string> = {
  starCoins: '⭐',
  goldCoins: '💰',
  cosmetic:  '👗',
  title:     '🏷️',
}

export default function SeasonPassPage() {
  const queryClient = useQueryClient()

  const { data: season, isLoading } = useQuery<SeasonData | null>({
    queryKey: ['season-pass'],
    queryFn: () => api.get('/season-pass/current'),
    retry: false,
  })

  const claimMutation = useMutation({
    mutationFn: (tierId: string) => api.post(`/season-pass/claim/${tierId}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['season-pass'] }),
  })

  const now = new Date()
  const endDate = season ? new Date(season.endDate) : null
  const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86400000)) : null

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-4 pb-12">
        <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">

          {/* Header */}
          <div className="card relative overflow-hidden text-center py-8">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
            <div className="relative">
              <p className="text-5xl mb-3">🎫</p>
              <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">Season Pass</h1>
              {isLoading ? (
                <div className="h-4 w-48 bg-neutral-800 rounded animate-pulse mx-auto mt-2" />
              ) : season ? (
                <>
                  <p className="text-brand-400 font-semibold text-lg">{season.name}</p>
                  <p className="text-neutral-500 text-sm mt-1">{daysLeft} days remaining</p>
                  <div className="mt-4 max-w-xs mx-auto">
                    <div className="flex justify-between text-xs text-neutral-500 mb-1">
                      <span>{season.userXp} XP</span>
                      <span>{season.tiers[season.tiers.length - 1]?.xpRequired ?? '?'} XP max</span>
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-600 transition-all duration-700"
                        style={{
                          width: `${Math.min(100, (season.userXp / (season.tiers[season.tiers.length - 1]?.xpRequired ?? 1)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-neutral-500 text-sm mt-2">No active season pass</p>
              )}
            </div>
          </div>

          {/* Tiers */}
          {!isLoading && season && (
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Season Tiers</p>
              <div className="space-y-2">
                {season.tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors',
                      tier.claimed
                        ? 'border-emerald-800/40 bg-emerald-950/20'
                        : tier.unlocked
                        ? 'border-brand-800/40 bg-brand-950/20'
                        : 'border-neutral-800 bg-neutral-900/40 opacity-60',
                    ].join(' ')}
                  >
                    <div className={[
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                      tier.claimed ? 'bg-emerald-800/40 text-emerald-400' : tier.unlocked ? 'bg-brand-800/40 text-brand-400' : 'bg-neutral-800 text-neutral-500',
                    ].join(' ')}>
                      {tier.claimed ? '✓' : tier.tierNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {REWARD_ICONS[tier.rewardType] ?? '🎁'}{' '}
                        {tier.rewardType === 'starCoins' ? `${tier.rewardValue} Star Coins`
                          : tier.rewardType === 'goldCoins' ? `${tier.rewardValue} Gold Coins`
                          : tier.rewardType === 'cosmetic' ? 'Cosmetic Item'
                          : tier.rewardValue}
                      </p>
                      <p className="text-xs text-neutral-500">{tier.xpRequired} XP required</p>
                    </div>
                    {tier.isPremium && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 font-semibold border border-amber-800/40">
                        PREMIUM
                      </span>
                    )}
                    {tier.unlocked && !tier.claimed ? (
                      <button
                        onClick={() => claimMutation.mutate(tier.id)}
                        disabled={claimMutation.isPending}
                        className="px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors disabled:opacity-40"
                      >
                        Claim
                      </button>
                    ) : tier.claimed ? (
                      <span className="text-xs text-emerald-400 font-semibold">Claimed</span>
                    ) : (
                      <span className="text-xs text-neutral-600 font-semibold">Locked</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="card space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-neutral-800">
                  <div className="w-8 h-8 rounded-lg bg-neutral-800 animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-4 w-32 bg-neutral-800 rounded animate-pulse" />
                    <div className="h-3 w-20 bg-neutral-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
