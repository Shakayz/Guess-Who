import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'
import { Avatar, Badge } from '@imposter/ui'
import { RANK_CONFIG } from '@imposter/shared'
import type { RankTier } from '@imposter/shared'

interface LeaderboardUser {
  id: string
  username: string
  avatarUrl: string | null
  rankTier: RankTier
  rankPoints: number
}

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' }

function SkeletonRow() {
  return (
    <div className="card flex items-center gap-3 animate-pulse">
      <div className="w-6 h-4 bg-neutral-800 rounded" />
      <div className="w-8 h-8 bg-neutral-800 rounded-full" />
      <div className="flex-1 h-4 bg-neutral-800 rounded" />
      <div className="w-20 h-5 bg-neutral-800 rounded-full" />
      <div className="w-12 h-4 bg-neutral-800 rounded" />
    </div>
  )
}

export default function LeaderboardPage() {
  const { i18n } = useTranslation()
  const locale = i18n.language?.split('-')[0] ?? 'en'
  const [search, setSearch] = React.useState('')
  const { data: users = [], isLoading } = useQuery<LeaderboardUser[]>({
    queryKey: ['leaderboard', locale],
    queryFn: () => api.get(`/users/leaderboard?locale=${locale}`),
    retry: false,
  })

  const filtered = search.trim()
    ? users.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()))
    : users

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <div className="max-w-xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Leaderboard</h1>
            <p className="text-neutral-500 text-sm mt-1">Top players this season</p>
          </div>

          {/* Search */}
          <div className="mb-6 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">🔍</span>
            <input
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-600 text-sm focus:outline-none focus:border-brand-600 transition-colors"
              placeholder="Search player..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Top 3 podium (when data available and no search) */}
          {!isLoading && !search.trim() && users.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[users[1], users[0], users[2]].map((u, podiumIdx) => {
                const realIdx = podiumIdx === 0 ? 1 : podiumIdx === 1 ? 0 : 2
                const rank = RANK_CONFIG[u.rankTier]
                const sizes = ['h-24', 'h-32', 'h-20']
                return (
                  <div key={u.id} className={['card flex flex-col items-center justify-end pb-4 pt-3 transition-colors hover:border-neutral-700', sizes[podiumIdx]].join(' ')}>
                    <span className="text-2xl mb-1">{MEDAL[realIdx]}</span>
                    <Avatar src={u.avatarUrl} username={u.username} size="sm" className="mb-1" />
                    <p className="text-xs font-semibold text-white truncate max-w-full px-1">{u.username}</p>
                    <p className="text-xs text-neutral-500">{u.rankPoints} LP</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Full list */}
          <div className="space-y-2">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
              ? (
                <div className="card text-center py-12">
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="text-white font-semibold">{search.trim() ? 'No player found' : 'No players ranked yet'}</p>
                  <p className="text-neutral-500 text-sm mt-1">{search.trim() ? 'Try a different name' : 'Play your first game to appear here'}</p>
                </div>
              )
              : filtered.map((u, i) => {
                  const rank = RANK_CONFIG[u.rankTier]
                  return (
                    <div key={u.id} className={['card flex items-center gap-3 transition-colors hover:border-neutral-700', i < 3 ? 'border-neutral-700' : ''].join(' ')}>
                      <span className="text-sm w-6 text-right font-mono text-neutral-500">
                        {MEDAL[i] ?? i + 1}
                      </span>
                      <Avatar src={u.avatarUrl} username={u.username} size="sm" />
                      <span className="flex-1 font-semibold text-white text-sm">{u.username}</span>
                      <Badge variant="rank">{rank.icon} {rank.label}</Badge>
                      <span className="text-sm font-mono text-neutral-400 tabular-nums">{u.rankPoints.toLocaleString()} LP</span>
                    </div>
                  )
                })
            }
          </div>
        </div>
      </main>
    </div>
  )
}
