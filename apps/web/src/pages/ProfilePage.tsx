import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  honorTeamplayer?: number
  honorSharpMind?: number
  honorGoodSport?: number
}

interface AchievementItem {
  id: string
  key: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt: string | null
}

interface UserStats {
  totalGames: number
  wins: number
  losses: number
  winRate: number
  asVillager: number
  asImposter: number
  survived: number
}

const HONOR_LABELS = [
  { key: 'teamplayer', label: 'Team Player', icon: '🤝', field: 'honorTeamplayer' },
  { key: 'sharp_mind', label: 'Sharp Mind',  icon: '🧠', field: 'honorSharpMind' },
  { key: 'good_sport', label: 'Good Sport',  icon: '🎖️', field: 'honorGoodSport' },
]

export default function ProfilePage() {
  const authUser = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [avatarInput, setAvatarInput] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const { data: me, isLoading } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me'),
    retry: false,
  })

  const { data: achievements, isLoading: achievementsLoading } = useQuery<AchievementItem[]>({
    queryKey: ['achievements'],
    queryFn: () => api.get('/achievements'),
    retry: false,
  })

  const { data: profileStats } = useQuery<{ stats: UserStats }>({
    queryKey: ['profile-stats', me?.id],
    queryFn: () => api.get(`/users/${me!.id}/profile`),
    enabled: !!me?.id,
    retry: false,
  })

  const avatarMutation = useMutation({
    mutationFn: (avatarUrl: string) => api.patch('/users/me', { avatarUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setEditingAvatar(false)
      setAvatarInput('')
    },
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

  const gameStats = profileStats?.stats

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
                <div className="relative group">
                  {me?.avatarUrl ? (
                    <img src={me.avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover border-2 border-brand-700/60" />
                  ) : (
                    <Avatar username={me?.username ?? authUser?.username ?? '?'} size="xl" />
                  )}
                  <button
                    onClick={() => { setEditingAvatar(true); setAvatarInput(me?.avatarUrl ?? '') }}
                    className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white font-semibold"
                  >
                    Edit
                  </button>
                </div>
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

            {/* Avatar edit form */}
            {editingAvatar && (
              <div className="mt-4 flex items-center gap-2 animate-slide-up">
                <input
                  ref={avatarInputRef}
                  type="url"
                  placeholder="Paste image URL…"
                  value={avatarInput}
                  onChange={(e) => setAvatarInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-brand-600 transition-colors"
                />
                <button
                  onClick={() => avatarMutation.mutate(avatarInput)}
                  disabled={!avatarInput.trim() || avatarMutation.isPending}
                  className="px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingAvatar(false)}
                  className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Currency & rank stats grid */}
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

          {/* Game statistics */}
          {(gameStats || isLoading) && (
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Game Statistics</p>
              {isLoading || !gameStats ? (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/60">
                      <div className="h-6 w-12 bg-neutral-700 rounded animate-pulse" />
                      <div className="h-3 w-16 bg-neutral-700 rounded animate-pulse mt-1" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Games Played', value: gameStats.totalGames, icon: '🎮' },
                    { label: 'Win Rate', value: `${gameStats.winRate}%`, icon: '🏆' },
                    { label: 'Wins', value: gameStats.wins, icon: '✅' },
                    { label: 'As Villager', value: gameStats.asVillager, icon: '🏘️' },
                    { label: 'As Imposter', value: gameStats.asImposter, icon: '🎭' },
                    { label: 'Survived', value: gameStats.survived, icon: '💪' },
                  ].map((s) => (
                    <div key={s.label} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/60 text-center">
                      <span className="text-xl">{s.icon}</span>
                      <p className="text-lg font-bold text-white">{s.value}</p>
                      <p className="text-[10px] text-neutral-500 leading-tight">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Honors */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Honor Received</p>
            {isLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {HONOR_LABELS.map((h) => (
                  <div key={h.key} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/60">
                    <span className="text-2xl">{h.icon}</span>
                    <p className="text-xs font-semibold text-white">{h.label}</p>
                    <div className="h-6 w-8 bg-neutral-700 rounded animate-pulse mt-1" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {HONOR_LABELS.map((h) => {
                  const count = (me as any)?.[h.field] ?? 0
                  return (
                    <div key={h.key} className={[
                      'flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors',
                      count > 0
                        ? 'bg-brand-950/40 border-brand-800/40'
                        : 'bg-neutral-800/60 border-neutral-700/60 opacity-50',
                    ].join(' ')}>
                      <span className="text-2xl">{h.icon}</span>
                      <p className="text-xs font-semibold text-white">{h.label}</p>
                      <p className={['text-lg font-bold', count > 0 ? 'text-brand-300' : 'text-neutral-500'].join(' ')}>
                        {count}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Achievements */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
              Achievements{achievements ? ` (${achievements.filter((a) => a.unlocked).length}/${achievements.length})` : ''}
            </p>
            {achievementsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/60">
                    <div className="w-10 h-10 rounded-xl bg-neutral-700 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="h-4 w-24 bg-neutral-700 rounded animate-pulse" />
                      <div className="h-3 w-32 bg-neutral-700 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !achievements || achievements.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="text-4xl mb-2">🏅</span>
                <p className="text-white font-semibold text-sm">No achievements yet</p>
                <p className="text-neutral-500 text-xs mt-1">Play games to unlock achievements</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {achievements.map((a) => (
                  <div
                    key={a.id}
                    className={[
                      'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                      a.unlocked
                        ? 'bg-brand-950/40 border-brand-800/40'
                        : 'bg-neutral-800/40 border-neutral-700/40 opacity-50',
                    ].join(' ')}
                  >
                    <div className={[
                      'w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0',
                      a.unlocked ? 'bg-brand-800/40' : 'bg-neutral-700/60',
                    ].join(' ')}>
                      {a.unlocked ? a.icon : '🔒'}
                    </div>
                    <div className="min-w-0">
                      <p className={['text-sm font-semibold truncate', a.unlocked ? 'text-white' : 'text-neutral-500'].join(' ')}>
                        {a.name}
                      </p>
                      <p className="text-[10px] text-neutral-500 leading-tight line-clamp-2">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
