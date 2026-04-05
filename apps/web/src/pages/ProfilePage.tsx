import React, { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { NavBar } from '../components/NavBar'
import { Avatar, Badge } from '@imposter/ui'
import { RANK_CONFIG } from '@imposter/shared'
import type { RankTier } from '@imposter/shared'
import { api } from '../lib/api'

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/gif,image/webp'

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

interface RecentGame {
  gameId: string
  role: string
  survived: boolean
  winnerTeam: string
  didWin: boolean
  rounds: number
  playedAt: string
}

const HONOR_LABELS = [
  { key: 'teamplayer', labelKey: 'profile.teamPlayer', icon: '🤝', field: 'honorTeamplayer' },
  { key: 'sharp_mind', labelKey: 'profile.sharpMind',  icon: '🧠', field: 'honorSharpMind' },
  { key: 'good_sport', labelKey: 'profile.goodSport',  icon: '🎖️', field: 'honorGoodSport' },
]

export default function ProfilePage() {
  const { t } = useTranslation()
  const authUser = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)

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

  const { data: profileStats } = useQuery<{ stats: UserStats; recentGames: RecentGame[] }>({
    queryKey: ['profile-stats', me?.id],
    queryFn: () => api.get(`/users/${me!.id}/profile`),
    enabled: !!me?.id,
    retry: false,
  })

  const avatarUploadMutation = useMutation({
    mutationFn: (file: File) => api.upload('/users/me/avatar', file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setEditingAvatar(false)
      setAvatarPreview(null)
      setSelectedFile(null)
    },
  })

  const avatarRemoveMutation = useMutation({
    mutationFn: () => api.delete('/users/me/avatar'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setEditingAvatar(false)
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setAvatarPreview(url)
  }

  function cancelAvatarEdit() {
    setEditingAvatar(false)
    setAvatarPreview(null)
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const usernameMutation = useMutation({
    mutationFn: (username: string) => api.patch('/users/me', { username }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setEditingUsername(false)
      setUsernameInput('')
      setUsernameError(null)
    },
    onError: () => {
      setUsernameError(t('profile.usernameTaken'))
    },
  })

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  const rankTier: RankTier = me?.rankTier ?? 'wooden'
  const rank = RANK_CONFIG[rankTier]
  const lp = me?.rankPoints ?? 0
  // Calculate LP progress within current tier
  const tierIndex = Object.keys(RANK_CONFIG).indexOf(rankTier)
  const prevThreshold = tierIndex === 0 ? 0 : Object.values(RANK_CONFIG)[tierIndex - 1]?.lpRequired ?? 0
  const currentThreshold = rank.lpRequired === Infinity ? prevThreshold + 100 : rank.lpRequired
  const tierRange = currentThreshold - prevThreshold
  const lpInTier = lp - prevThreshold
  const lpPct = tierRange > 0 ? Math.min(Math.max((lpInTier / tierRange) * 100, 0), 100) : 100
  const nextRankTiers = Object.entries(RANK_CONFIG)
  const nextIdx = nextRankTiers.findIndex(([k]) => k === rankTier) + 1
  const nextRank = nextRankTiers[nextIdx]?.[1]

  const stats = [
    { label: t('profile.starCoins'), value: me ? String(me.starCoins) : '—', icon: '⭐' },
    { label: t('profile.honorPoints'), value: me ? String(me.honorPoints) : '—', icon: '🎖️' },
    { label: t('profile.rankPoints'), value: me ? String(me.rankPoints) : '—', icon: '📊' },
  ]

  const gameStats = profileStats?.stats

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6 pb-24 md:pb-6">
        <div className="max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto space-y-4 md:space-y-6 animate-slide-up">

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
                    onClick={() => {
                      setEditingAvatar(true)
                      setTimeout(() => fileInputRef.current?.click(), 0)
                    }}
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
                    <div className="flex items-center gap-2">
                      {editingUsername ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <input
                            autoFocus
                            type="text"
                            value={usernameInput}
                            onChange={(e) => { setUsernameInput(e.target.value); setUsernameError(null) }}
                            placeholder={me?.username}
                            maxLength={20}
                            className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-neutral-800 border border-neutral-600 text-white text-lg font-bold focus:outline-none focus:border-brand-600 transition-colors"
                          />
                          <button
                            onClick={() => {
                              if (usernameInput.trim().length >= 2) usernameMutation.mutate(usernameInput.trim())
                              else setUsernameError(t('profile.minChars'))
                            }}
                            disabled={usernameMutation.isPending}
                            className="px-2 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors disabled:opacity-40"
                          >
                            {t('profile.save')}
                          </button>
                          <button
                            onClick={() => { setEditingUsername(false); setUsernameError(null) }}
                            className="px-2 py-1 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300 text-xs font-semibold transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <h1 className="text-2xl md:text-3xl font-extrabold text-white">{me?.username ?? authUser?.username}</h1>
                          <button
                            onClick={() => { setEditingUsername(true); setUsernameInput(me?.username ?? '') }}
                            className="text-neutral-600 hover:text-neutral-400 transition-colors text-sm"
                            title={t('profile.editUsername')}
                          >
                            ✏️
                          </button>
                        </>
                      )}
                    </div>
                    {usernameError && (
                      <p className="text-red-400 text-xs mt-0.5">{usernameError}</p>
                    )}
                    <p className="text-neutral-500 text-sm truncate">{me?.email ?? authUser?.email ?? '—'}</p>
                    {me?.createdAt && (
                      <p className="text-neutral-600 text-xs mt-0.5">{t('profile.joinedDate', { date: formatDate(me.createdAt) })}</p>
                    )}
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
                  <span>{nextRank ? nextRank.label : t('profile.maxRank')}</span>
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
              <div className="mt-4 animate-slide-up space-y-3">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  aria-label={t('profile.chooseImage')}
                  className="sr-only"
                  onChange={handleFileChange}
                />

                {/* Preview or prompt */}
                {avatarPreview ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarPreview}
                      alt="preview"
                      className="w-14 h-14 rounded-full object-cover border-2 border-brand-700/60"
                    />
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-neutral-400">{selectedFile?.name}</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-brand-400 hover:text-brand-300 transition-colors text-left"
                      >
                        {t('profile.chooseImage')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-6 rounded-xl border-2 border-dashed border-neutral-700 hover:border-brand-700 text-neutral-500 hover:text-neutral-300 text-sm font-medium transition-colors flex flex-col items-center gap-1"
                  >
                    <span className="text-2xl">📷</span>
                    <span>{t('profile.chooseImage')}</span>
                    <span className="text-xs text-neutral-600">JPEG, PNG, GIF, WebP</span>
                  </button>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => selectedFile && avatarUploadMutation.mutate(selectedFile)}
                    disabled={!selectedFile || avatarUploadMutation.isPending}
                    className="px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                  >
                    {t('profile.save')}
                  </button>
                  {me?.avatarUrl && (
                    <button
                      onClick={() => avatarRemoveMutation.mutate()}
                      disabled={avatarRemoveMutation.isPending}
                      className="px-3 py-2 rounded-xl bg-red-900/60 hover:bg-red-800/60 text-red-300 text-sm font-semibold transition-colors disabled:opacity-40"
                    >
                      {t('profile.removeAvatar')}
                    </button>
                  )}
                  <button
                    onClick={cancelAvatarEdit}
                    className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-sm font-semibold transition-colors"
                  >
                    {t('profile.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Currency & rank stats grid */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
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
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">{t('profile.gameStats')}</p>
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
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { label: t('profile.gamesPlayed'), value: gameStats.totalGames, icon: '🎮' },
                    { label: t('profile.winRate'), value: `${gameStats.winRate}%`, icon: '🏆' },
                    { label: t('profile.wins'), value: gameStats.wins, icon: '✅' },
                    { label: t('profile.asVillager'), value: gameStats.asVillager, icon: '🏘️' },
                    { label: t('profile.asImposter'), value: gameStats.asImposter, icon: '🎭' },
                    { label: t('profile.survived'), value: gameStats.survived, icon: '💪' },
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
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">{t('profile.honorReceived')}</p>
            {isLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {HONOR_LABELS.map((h) => (
                  <div key={h.key} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/60">
                    <span className="text-2xl">{h.icon}</span>
                    <p className="text-xs font-semibold text-white">{t(h.labelKey)}</p>
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
                      <p className="text-xs font-semibold text-white">{t(h.labelKey)}</p>
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
              {t('profile.achievements')}{achievements ? ` (${achievements.filter((a) => a.unlocked).length}/${achievements.length})` : ''}
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
                <p className="text-white font-semibold text-sm">{t('profile.noAchievements')}</p>
                <p className="text-neutral-500 text-xs mt-1">{t('profile.playToUnlock')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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

          {/* Recent games */}
          {(profileStats?.recentGames?.length ?? 0) > 0 && (
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">{t('profile.recentGames')}</p>
              <div className="space-y-2">
                {profileStats!.recentGames.map((g) => (
                  <Link
                    key={g.gameId}
                    to={`/history/${g.gameId}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 hover:bg-neutral-800/40 transition-colors"
                  >
                    <span className="text-2xl">{g.didWin ? '🏆' : '💀'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={['text-xs font-bold', g.didWin ? 'text-emerald-400' : 'text-red-400'].join(' ')}>
                          {g.didWin ? t('profile.victory') : t('profile.defeat')}
                        </span>
                        <span className="text-neutral-600">·</span>
                        <span className="text-xs text-neutral-400">
                          {g.role === 'imposter' ? t('gameDetail.imposterRole') : g.role === 'double_agent' ? '🕵️ D.Agent' : g.role === 'detective' ? '🔍 Detective' : t('gameDetail.villagerRole')}
                        </span>
                        <span className="text-neutral-600">·</span>
                        <span className="text-xs text-neutral-500">{g.rounds}R</span>
                      </div>
                      <p className="text-xs text-neutral-600 mt-0.5">{formatDate(g.playedAt)}</p>
                    </div>
                    <span className={['text-xs', g.survived ? 'text-emerald-500' : 'text-neutral-600'].join(' ')}>
                      {g.survived ? t('profile.survived') : t('results.eliminated')}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
