import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { NavBar } from '../components/NavBar'
import { Avatar, Badge } from '@imposter/ui'
import { RANK_CONFIG } from '@imposter/shared'
import type { RankTier } from '@imposter/shared'
import { api } from '../lib/api'

interface MeResponse {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  rankTier: RankTier
  rankPoints: number
  honorPoints: number
  starCoins: number
  goldCoins: number
  locale: string
  createdAt: string
}

const HONOR_LABELS = [
  { key: 'teamplayer', label: 'Team Player', icon: '🤝', field: 'honorTeamplayer' },
  { key: 'sharp_mind', label: 'Sharp Mind',  icon: '🧠', field: 'honorSharpMind' },
  { key: 'good_sport', label: 'Good Sport',  icon: '🎖️', field: 'honorGoodSport' },
]

export default function ProfilePage() {
  const authUser = useAuthStore((s) => s.user)

  const { data: me, isLoading } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me'),
    retry: false,
  })

  const rankTier: RankTier = me?.rankTier ?? 'wooden'
  const rank = RANK_CONFIG[rankTier]
  const lp = me?.rankPoints ?? 0
  const lpPct = rank.lpRequired === Infinity ? 100 : Math.min((lp / rank.lpRequired) * 100, 100)
  const nextRankTiers = Object.entries(RANK_CONFIG)
  const nextIdx = nextRankTiers.findIndex(([k]) => k === rankTier) + 1
  const nextRank = nextRankTiers[nextIdx]?.[1]

  const stats = [
    { label: 'Star Coins', value: me ? String(me.starCoins) : '—', icon: '⭐' },
    { label: 'Gold Coins', value: me ? String(me.goldCoins) : '—', icon: '💰' },
    { label: 'Honor Points', value: me ? String(me.honorPoints) : '—', icon: '🎖️' },
    { label: 'Rank Points', value: me ? String(me.rankPoints) : '—', icon: '📊' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <div className="max-w-xl mx-auto space-y-4 animate-slide-up">

          {/* Profile card */}
          <div className="card relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600/5 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex items-center gap-4">
              {isLoading ? (
                <div className="w-16 h-16 rounded-full bg-neutral-800 animate-pulse" />
              ) : (
                <Avatar username={me?.username ?? authUser?.username ?? '?'} size="xl" />
              )}
              <div className="flex-1 min-w-0">
                {isLoading ? (
                  <div className="space-y-2">
                    <div className="h-6 w-32 bg-neutral-800 rounded animate-pulse" />
                    <div className="h-4 w-48 bg-neutral-800 rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-extrabold text-white">{me?.username ?? authUser?.username}</h1>
                    <p className="text-neutral-500 text-sm truncate">{me?.email ?? authUser?.email ?? '—'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="rank">{rank.icon} {rank.label}</Badge>
                      <span className="text-xs text-neutral-500">
                        {lp} / {rank.lpRequired === Infinity ? '∞' : rank.lpRequired} LP
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Rank progress */}
            {!isLoading && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-neutral-500 mb-1">
                  <span>{rank.label}</span>
                  <span>{nextRank ? nextRank.label : 'Max Rank'}</span>
                </div>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all duration-700"
                    style={{ width: `${lpPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="card text-center hover:border-neutral-700 transition-colors">
                <p className="text-2xl mb-1">{s.icon}</p>
                {isLoading ? (
                  <div className="h-6 w-10 bg-neutral-800 rounded animate-pulse mx-auto my-1" />
                ) : (
                  <p className="text-xl font-bold text-white">{s.value}</p>
                )}
                <p className="text-xs text-neutral-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Honors */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Honor Received</p>
            <div className="grid grid-cols-3 gap-3">
              {HONOR_LABELS.map((h) => (
                <div key={h.key} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/60">
                  <span className="text-2xl">{h.icon}</span>
                  <p className="text-xs font-semibold text-white">{h.label}</p>
                  <p className="text-lg font-bold text-neutral-300">
                    {isLoading ? '—' : (me as any)?.[h.field] ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Achievements placeholder */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Achievements</p>
            <div className="flex flex-col items-center py-6 text-center">
              <span className="text-4xl mb-2">🏅</span>
              <p className="text-white font-semibold text-sm">No achievements yet</p>
              <p className="text-neutral-500 text-xs mt-1">Play games to unlock achievements</p>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
