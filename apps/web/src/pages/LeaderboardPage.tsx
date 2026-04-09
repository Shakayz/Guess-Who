import React from 'react'
import { useNavigate } from 'react-router-dom'
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
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
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
        <div className="max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">{t('leaderboard.title')}</h1>
            <p className="text-neutral-500 text-sm md:text-base mt-1">{t('leaderboard.subtitle')}</p>
          </div>

          {/* Search */}
          <div className="mb-6 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">🔍</span>
            <input
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-600 text-sm focus:outline-none focus:border-brand-600 transition-colors"
              placeholder={t('leaderboard.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Top 3 podium (when data available and no search) */}
          {!isLoading && !search.trim() && users.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 md:gap-5 mb-8 items-start">
              {[users[1], users[0], users[2]].map((u, podiumIdx) => {
                const realIdx = podiumIdx === 0 ? 1 : podiumIdx === 1 ? 0 : 2
                const rank = RANK_CONFIG[u.rankTier]
                const offsets = ['mt-6', '', 'mt-10']
                const isFirst = realIdx === 0
                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => navigate(`/player/${u.id}`)}
                    className={[
                      'card w-full flex flex-col items-center justify-center gap-1.5',
                      'py-4 md:py-5 transition-colors hover:border-neutral-700',
                      isFirst ? 'ring-1 ring-amber-500/40' : '',
                      offsets[podiumIdx],
                    ].join(' ')}
                  >
                    <span className="text-2xl md:text-3xl leading-none">{MEDAL[realIdx]}</span>
                    <Avatar src={u.avatarUrl} username={u.username} size="md" />
                    <p className="block w-full text-center text-sm font-semibold text-white truncate px-2">
                      {u.username}
                    </p>
                    <Badge variant="rank" className="text-[10px]">{rank.icon} {rank.label}</Badge>
                    <p className="text-xs text-neutral-500 tabular-nums">{u.rankPoints.toLocaleString()} LP</p>
                  </button>
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
                  <p className="text-white font-semibold">{search.trim() ? t('leaderboard.noPlayerFound') : t('leaderboard.noPlayersYet')}</p>
                  <p className="text-neutral-500 text-sm mt-1">{search.trim() ? t('leaderboard.tryDifferentName') : t('leaderboard.playToAppear')}</p>
                </div>
              )
              : filtered.map((u, i) => {
                  const rank = RANK_CONFIG[u.rankTier]
                  return (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => navigate(`/player/${u.id}`)}
                      className={['card w-full text-left flex items-center gap-3 md:gap-4 md:px-5 md:py-4 transition-colors hover:border-neutral-700', i < 3 ? 'border-neutral-700' : ''].join(' ')}
                    >
                      <span className="text-sm w-6 text-right font-mono text-neutral-500">
                        {MEDAL[i] ?? i + 1}
                      </span>
                      <Avatar src={u.avatarUrl} username={u.username} size="sm" />
                      <span className="flex-1 font-semibold text-white text-sm md:text-base">{u.username}</span>
                      <Badge variant="rank">{rank.icon} {rank.label}</Badge>
                      <span className="text-sm font-mono text-neutral-400 tabular-nums">{u.rankPoints.toLocaleString()} LP</span>
                    </button>
                  )
                })
            }
          </div>
        </div>
      </main>
    </div>
  )
}
