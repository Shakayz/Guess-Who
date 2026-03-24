import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'
import { RANK_CONFIG } from '@imposter/shared'
import type { RankTier } from '@imposter/shared'

interface PlayerStats {
  totalGames: number
  wins: number
  losses: number
  winRate: number
  asVillager: number
  asImposter: number
  survived: number
}

interface RecentGame {
  gameId: string
  role: string
  survived: boolean
  winnerTeam: string
  didWin: boolean
  rounds: number
  playedAt: string
}

interface HonorCount {
  type: string
  count: number
}

interface PlayerProfile {
  id: string
  username: string
  avatarUrl: string | null
  rankTier: RankTier
  rankPoints: number
  honorPoints: number
  createdAt: string
  stats: PlayerStats
  recentGames: RecentGame[]
  honors: HonorCount[]
}

const HONOR_ICONS: Record<string, string> = {
  teamplayer: '🤝',
  sharp_mind: '🧠',
  good_sport: '🎖️',
}

const HONOR_LABELS: Record<string, string> = {
  teamplayer: 'Team Player',
  sharp_mind: 'Sharp Mind',
  good_sport: 'Good Sport',
}

function InitialsAvatar({ username, size = 'md' }: { username: string; size?: 'sm' | 'md' | 'lg' }) {
  const colors = [
    'bg-brand-600', 'bg-amber-600', 'bg-emerald-600', 'bg-red-600',
    'bg-purple-600', 'bg-sky-600', 'bg-pink-600', 'bg-orange-600',
  ]
  const idx = username.charCodeAt(0) % colors.length
  const sizeClass = size === 'lg' ? 'w-20 h-20 text-2xl' : size === 'md' ? 'w-12 h-12 text-base' : 'w-8 h-8 text-xs'
  return (
    <div className={`${sizeClass} ${colors[idx]} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {username.slice(0, 2).toUpperCase()}
    </div>
  )
}

export default function PlayerProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    api
      .get<PlayerProfile>(`/users/${userId}/profile`)
      .then((res) => { setProfile(res); setLoading(false) })
      .catch((err: Error) => { setError(err.message); setLoading(false) })
  }, [userId])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 p-6">
          <div className="max-w-lg mx-auto space-y-4">
            <div className="h-8 w-24 bg-neutral-800 rounded animate-pulse" />
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 animate-pulse h-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 animate-pulse h-20" />
            ))}
          </div>
        </main>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 font-semibold">Failed to load profile</p>
            <p className="text-neutral-500 text-sm mt-1">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-4 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm transition-colors"
            >
              ← Go Back
            </button>
          </div>
        </main>
      </div>
    )
  }

  const rankCfg = RANK_CONFIG[profile.rankTier]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-4 pb-12">
        <div className="max-w-lg mx-auto space-y-4 animate-slide-up">

          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white transition-colors"
          >
            ← Back
          </button>

          {/* Profile header */}
          <div className="card flex items-center gap-4">
            <InitialsAvatar username={profile.username} size="lg" />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-extrabold text-white truncate">{profile.username}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-semibold" style={{ color: rankCfg?.color ?? '#aaa' }}>
                  {rankCfg?.icon} {profile.rankTier}
                </span>
                <span className="text-neutral-600">·</span>
                <span className="text-sm text-neutral-400">{profile.rankPoints} LP</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-amber-400">⭐ {profile.honorPoints} honor</span>
                <span className="text-neutral-600">·</span>
                <span className="text-xs text-neutral-500">Joined {formatDate(profile.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Stats</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-0.5 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/50">
                <span className="text-xl font-bold text-white">{profile.stats.totalGames}</span>
                <span className="text-xs text-neutral-500">Games</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
                <span className="text-xl font-bold text-emerald-400">{profile.stats.wins}</span>
                <span className="text-xs text-neutral-500">Wins</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/50">
                <span className="text-xl font-bold text-white">{profile.stats.winRate}%</span>
                <span className="text-xs text-neutral-500">Win Rate</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="flex flex-col items-center gap-0.5 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/50">
                <span className="text-xl font-bold text-brand-400">{profile.stats.asVillager}</span>
                <span className="text-xs text-neutral-500">As Villager</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/50">
                <span className="text-xl font-bold text-amber-400">{profile.stats.asImposter}</span>
                <span className="text-xs text-neutral-500">As Imposter</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/50">
                <span className="text-xl font-bold text-white">{profile.stats.survived}</span>
                <span className="text-xs text-neutral-500">Survived</span>
              </div>
            </div>
          </div>

          {/* Honors received */}
          {profile.honors.length > 0 && (
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Honors Received</p>
              <div className="flex flex-wrap gap-2">
                {profile.honors.map((h) => (
                  <div
                    key={h.type}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-950/60 border border-brand-800/40 text-brand-300 text-xs font-semibold"
                  >
                    <span>{HONOR_ICONS[h.type] ?? '🏅'}</span>
                    <span>{HONOR_LABELS[h.type] ?? h.type}</span>
                    <span className="text-brand-500">×{h.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent games */}
          {profile.recentGames.length > 0 && (
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Recent Games</p>
              <div className="space-y-2">
                {profile.recentGames.map((g) => (
                  <Link
                    key={g.gameId}
                    to={`/history/${g.gameId}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 hover:bg-neutral-800/40 transition-colors"
                  >
                    <span className="text-2xl">{g.didWin ? '🏆' : '💀'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={[
                          'text-xs font-bold',
                          g.didWin ? 'text-emerald-400' : 'text-red-400',
                        ].join(' ')}>
                          {g.didWin ? 'Victory' : 'Defeat'}
                        </span>
                        <span className="text-neutral-600">·</span>
                        <span className="text-xs text-neutral-400">
                          {g.role === 'imposter' ? '🎭 Imposter' : '👤 Villager'}
                        </span>
                        <span className="text-neutral-600">·</span>
                        <span className="text-xs text-neutral-500">{g.rounds}R</span>
                      </div>
                      <p className="text-xs text-neutral-600 mt-0.5">{formatDate(g.playedAt)}</p>
                    </div>
                    <span className={[
                      'text-xs',
                      g.survived ? 'text-emerald-500' : 'text-neutral-600',
                    ].join(' ')}>
                      {g.survived ? 'Survived' : 'Eliminated'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {profile.recentGames.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-neutral-500 text-sm">No games played yet</p>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
