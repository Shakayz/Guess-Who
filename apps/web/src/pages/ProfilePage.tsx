import React, { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AchievementSummaryChip } from '../components/achievements/AchievementSummaryChip'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { NavBar } from '../components/NavBar'
import { Avatar, Badge } from '@red-handed/ui'
import { RANK_CONFIG, LEVEL_CAP, USERNAME_CHANGE_COST, EMAIL_VERIFICATION_REWARD } from '@red-handed/shared'
import type { RankTier } from '@red-handed/shared'
import { api } from '../lib/api'
import { ReferralCard } from '../components/ReferralCard'
import { PremiumBadge } from '../components/PremiumBadge'
import { EmoteLoadoutSection } from '../components/emotes/EmoteLoadoutSection'

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/gif,image/webp'

interface MeResponse {
  id: string
  username: string
  email: string
  emailVerified?: boolean
  avatarUrl: string | null
  rankTier: RankTier | 'unranked'
  rankPoints: number
  honorPoints: number
  starCoins: number
  locale: string
  createdAt: string
  honorTeamplayer?: number
  honorSharpMind?: number
  honorGoodSport?: number
  level?: number
  xp?: number
  xpInLevel?: number
  xpForNextLevel?: number
  hasPlayedRanked?: boolean
  isPremium?: boolean
  premiumUntil?: string | null
}

interface UserStats {
  totalGames: number
  wins: number
  losses: number
  winRate: number
  asVillager: number
  asRedHanded: number
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
  gameMode?: string
}

interface HonorBucket {
  type: string
  count: number
}

interface ProfileStatsResponse {
  stats: UserStats
  statsRanked?: UserStats
  statsUnranked?: UserStats
  honors?: HonorBucket[]
  honorsRanked?: HonorBucket[]
  honorsUnranked?: HonorBucket[]
  recentGames: RecentGame[]
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
  const [confirmUsernameCost, setConfirmUsernameCost] = useState<string | null>(null)
  const [statsTab, setStatsTab] = useState<'unranked' | 'ranked'>('unranked')
  const navigate = useNavigate()

  const { data: me, isLoading } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me'),
    retry: false,
  })

  const { data: profileStats } = useQuery<ProfileStatsResponse>({
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
      setConfirmUsernameCost(null)
    },
    onError: (err: any) => {
      // The API returns HTTP 402 + { error: 'not_enough_coins', cost, starCoins }
      // when the player doesn't have USERNAME_CHANGE_COST ⭐. Keep the confirm
      // modal open so the "Get coins" CTA stays visible — closing it would
      // bury the fix path under a tiny inline error.
      const code = err?.data?.error
      if (code === 'not_enough_coins') {
        // Pull the authoritative balance from the 402 payload so the modal's
        // affordability check flips even if the cached /auth/me is stale.
        const liveBalance = err?.data?.starCoins
        if (typeof liveBalance === 'number') {
          queryClient.setQueryData<any>(['me'], (prev: any) => ({
            ...(prev ?? {}),
            starCoins: liveBalance,
          }))
        }
        setUsernameError(t('profile.notEnoughCoinsForRename', {
          cost: USERNAME_CHANGE_COST,
          defaultValue: 'You need {{cost}} ⭐ to change your username.',
        }))
        return
      }
      setConfirmUsernameCost(null)
      setUsernameError(t('profile.usernameTaken'))
    },
  })

  // Present the cost BEFORE we charge so a misclicked ✏️ can't drain 500 ⭐.
  // The confirmation step also doubles as client-side validation for the
  // "same as current username" no-op case: we skip the modal entirely and
  // just submit, since the server treats same-name patches as free.
  function submitUsernameChange() {
    const next = usernameInput.trim()
    if (next.length < 2) {
      setUsernameError(t('profile.minChars'))
      return
    }
    if (next === me?.username) {
      setEditingUsername(false)
      setUsernameInput('')
      return
    }
    setUsernameError(null)
    setConfirmUsernameCost(next)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  const isUnranked = me?.rankTier === 'unranked' || me?.hasPlayedRanked === false
  const rankTier: RankTier = (isUnranked ? 'wooden' : (me?.rankTier as RankTier)) ?? 'wooden'
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

  // Lifetime player level (any game type)
  const playerLevel = me?.level ?? 1
  const xpInLevel = me?.xpInLevel ?? 0
  const xpForNextLevel = me?.xpForNextLevel ?? 100
  const xpPct = playerLevel >= LEVEL_CAP
    ? 100
    : Math.min(100, Math.max(0, (xpInLevel / xpForNextLevel) * 100))

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6 pb-24 md:pb-6">
        <div className="max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto space-y-4 md:space-y-6 animate-slide-up">

          {/* Email verification banner — shown whenever the account is still
              unverified. Links to /settings where the 6-digit flow lives. */}
          {me && me.emailVerified === false && (
            <Link
              to="/settings"
              className="block card bg-gradient-to-br from-amber-950/70 to-amber-900/30 border-amber-700/60 hover:border-amber-500/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0">✉️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-200">
                    {t('profile.verifyEmailCtaTitle', { defaultValue: 'Verify your email' })}
                  </p>
                  <p className="text-xs text-amber-200/80 mt-0.5">
                    {t('profile.verifyEmailCtaBody', {
                      reward: EMAIL_VERIFICATION_REWARD,
                      defaultValue: 'Confirm your address to earn +{{reward}} ⭐.',
                    })}
                  </p>
                </div>
                <span className="text-amber-400 shrink-0">→</span>
              </div>
            </Link>
          )}

          {/* Profile card */}
          <div className="card relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600/5 via-transparent to-transparent pointer-events-none" />

            {/* Star coins chip (top-right) */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-700/50 bg-amber-950/50 text-amber-300 text-sm font-bold shadow-md shadow-amber-950/40">
              <span className="text-base leading-none">⭐</span>
              <span className="font-mono">{isLoading ? '—' : (me?.starCoins ?? 0).toLocaleString()}</span>
            </div>

            <div className="relative flex items-center gap-4 pr-24">
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
                            onClick={submitUsernameChange}
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
                          {me?.isPremium && <PremiumBadge size="sm" />}
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
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {isUnranked ? (
                        <Badge variant="rank">⚪ Unranked</Badge>
                      ) : (
                        <Badge variant="rank">{rank.icon} {rank.label}</Badge>
                      )}
                      {!isUnranked && (
                        <span className="text-xs text-neutral-500">
                          {lp} / {rank.lpRequired === Infinity ? '∞' : rank.lpRequired} LP
                        </span>
                      )}
                      <Badge variant="default">⚡ Lvl {playerLevel}</Badge>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Lifetime player level progress (any game type) */}
            {!isLoading && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-neutral-500 mb-1">
                  <span>⚡ Level {playerLevel}</span>
                  <span>
                    {playerLevel >= LEVEL_CAP
                      ? 'MAX'
                      : `${xpInLevel.toLocaleString()} / ${xpForNextLevel.toLocaleString()} XP`}
                  </span>
                </div>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Rank progress (only for ranked players) */}
            {!isLoading && !isUnranked && (
              <div className="mt-3">
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
            {!isLoading && isUnranked && (
              <p className="mt-3 text-xs text-neutral-500 text-center">
                Play your first ranked game to enter the leaderboard.
              </p>
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

          {/* Stats & Honors — tabbed by mode */}
          {(() => {
            const isRanked = statsTab === 'ranked'
            // Prefer the split buckets (statsRanked / statsUnranked), but fall
            // back to the aggregated `stats` field if the API hasn't been
            // updated yet — this prevents the skeleton from hanging forever
            // against a stale backend. For ranked, the fallback stays empty so
            // we don't misreport unranked games as ranked.
            const fallbackStats = profileStats?.stats
            const activeStats  = isRanked
              ? (profileStats?.statsRanked ?? null)
              : (profileStats?.statsUnranked ?? fallbackStats ?? null)
            const activeHonors = isRanked ? profileStats?.honorsRanked : profileStats?.honorsUnranked
            const countByType = new Map((activeHonors ?? []).map((h) => [h.type, h.count]))

            return (
              <div className="card space-y-4">
                {/* Tab switcher */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatsTab('unranked')}
                    className={[
                      'flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all',
                      !isRanked
                        ? 'bg-brand-600 text-white'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800',
                    ].join(' ')}
                  >
                    🎲 {t('profile.statsUnranked', { defaultValue: 'Unranked' })}
                  </button>
                  <button
                    onClick={() => setStatsTab('ranked')}
                    className={[
                      'flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all',
                      isRanked
                        ? 'bg-brand-600 text-white'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800',
                    ].join(' ')}
                  >
                    🏆 {t('profile.statsRanked', { defaultValue: 'Ranked' })}
                  </button>
                </div>

                {/* Stats grid */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                    {t('profile.gamesPlayed', { defaultValue: 'Games' })}
                  </p>
                  {isLoading && !profileStats ? (
                    <div className="grid grid-cols-3 gap-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/60">
                          <div className="h-6 w-12 bg-neutral-700 rounded animate-pulse" />
                          <div className="h-3 w-16 bg-neutral-700 rounded animate-pulse mt-1" />
                        </div>
                      ))}
                    </div>
                  ) : !activeStats || activeStats.totalGames === 0 ? (
                    <p className="text-xs text-neutral-500 text-center py-4">
                      {isRanked
                        ? t('profile.noRankedGames',   { defaultValue: 'No ranked games played yet.' })
                        : t('profile.noUnrankedGames', { defaultValue: 'No unranked games played yet.' })}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      {[
                        { label: t('profile.gamesPlayed'), value: activeStats.totalGames, icon: '🎮' },
                        { label: t('profile.winRate'),     value: `${activeStats.winRate}%`, icon: '🏆' },
                        { label: t('profile.wins'),        value: activeStats.wins, icon: '✅' },
                        { label: t('profile.asVillager'),  value: activeStats.asVillager, icon: '🏘️' },
                        { label: t('profile.asRedHanded'),  value: activeStats.asRedHanded, icon: '🎭' },
                        { label: t('profile.survived'),    value: activeStats.survived, icon: '💪' },
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

                {/* Honors grid */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                    {isRanked
                      ? t('profile.honorReceivedRanked',   { defaultValue: 'Honor Received' })
                      : t('profile.honorReceivedUnranked', { defaultValue: 'Honor Received' })}
                  </p>
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
                        const count = countByType.get(h.key) ?? 0
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
              </div>
            )
          })()}

          {/* Referral / invite-a-friend card */}
          <ReferralCard />

          {/* Achievements — compact summary chip; full grid lives on /achievements */}
          <AchievementSummaryChip onOpen={() => navigate('/achievements')} />

          {/* Emote loadout — pick which (up to 10) reactions appear on the
              in-game React bar. Changes persist to the server and take effect
              on the next game mount. */}
          <EmoteLoadoutSection onShop={() => navigate('/shop?tab=emotes')} />

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
                          {g.role === 'red_handed' ? t('gameDetail.redHandedRole') : g.role === 'double_agent' ? '🕵️ D.Agent' : g.role === 'detective' ? '🔍 Detective' : t('gameDetail.villagerRole')}
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

      {/* Username-change confirmation. Rendered outside <main> so it overlays
          the whole viewport on mobile — a full-screen modal reads more
          clearly than an inline warning for a 500-⭐ commitment. */}
      {confirmUsernameCost !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⭐</span>
              <h2 className="text-lg font-extrabold text-white">
                {t('profile.renameConfirmTitle', { defaultValue: 'Change username?' })}
              </h2>
            </div>
            <p className="text-sm text-neutral-300">
              {t('profile.renameConfirmBody', {
                cost: USERNAME_CHANGE_COST,
                next: confirmUsernameCost,
                defaultValue: 'Renaming to {{next}} costs {{cost}} ⭐ and cannot be undone.',
              })}
            </p>
            <div className="flex items-center justify-between text-xs text-neutral-400 px-3 py-2 rounded-xl bg-neutral-800/70 border border-neutral-700/60">
              <span>{t('profile.balance', { defaultValue: 'Your balance' })}</span>
              <span className="font-mono text-amber-300">
                {(me?.starCoins ?? 0).toLocaleString()} ⭐
              </span>
            </div>
            {(me?.starCoins ?? 0) < USERNAME_CHANGE_COST && (
              <p className="text-xs text-red-400">
                {t('profile.notEnoughCoinsForRename', {
                  cost: USERNAME_CHANGE_COST,
                  defaultValue: 'You need {{cost}} ⭐ to change your username.',
                })}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmUsernameCost(null)}
                disabled={usernameMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold transition-colors disabled:opacity-40"
              >
                {t('profile.cancel')}
              </button>
              {(me?.starCoins ?? 0) < USERNAME_CHANGE_COST ? (
                // Can't afford — turn the confirm button into a shop link so
                // the user has a path forward instead of a dead-end greyed
                // button. Matches the InsufficientCoinsModal flow elsewhere.
                <button
                  onClick={() => {
                    setConfirmUsernameCost(null)
                    navigate('/shop?tab=coins')
                  }}
                  className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-amber-600/20"
                >
                  {t('insufficientCoins.getCoinsCta', { defaultValue: 'Get coins' })}
                </button>
              ) : (
                <button
                  onClick={() => usernameMutation.mutate(confirmUsernameCost)}
                  disabled={usernameMutation.isPending}
                  className="flex-1 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  {usernameMutation.isPending
                    ? t('common.loading')
                    : t('profile.renameConfirmCta', {
                        cost: USERNAME_CHANGE_COST,
                        defaultValue: 'Pay {{cost}} ⭐',
                      })}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
