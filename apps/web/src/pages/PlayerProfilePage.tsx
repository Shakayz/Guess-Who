import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { NavBar } from '../components/NavBar'
import { Avatar, Badge } from '@red-handed/ui'
import { api } from '../lib/api'
import { RANK_CONFIG, LEVEL_CAP } from '@red-handed/shared'
import type { RankTier } from '@red-handed/shared'
import { ReportModal } from '../components/ReportModal'
import { PremiumBadge } from '../components/PremiumBadge'

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

interface PlayerProfile {
  id: string
  username: string
  avatarUrl: string | null
  rankTier: RankTier | 'unranked'
  rankPoints: number
  honorPoints: number
  createdAt: string
  level?: number
  xp?: number
  xpInLevel?: number
  xpForNextLevel?: number
  hasPlayedRanked?: boolean
  isPremium?: boolean
  stats: UserStats
  statsRanked?: UserStats
  statsUnranked?: UserStats
  recentGames: RecentGame[]
  honors: HonorBucket[]
  honorsRanked?: HonorBucket[]
  honorsUnranked?: HonorBucket[]
}

const HONOR_LABELS = [
  { key: 'teamplayer', labelKey: 'profile.teamPlayer', icon: '🤝' },
  { key: 'sharp_mind', labelKey: 'profile.sharpMind',  icon: '🧠' },
  { key: 'good_sport', labelKey: 'profile.goodSport',  icon: '🎖️' },
]

export default function PlayerProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [showReport, setShowReport] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [blockLoading, setBlockLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [statsTab, setStatsTab] = useState<'unranked' | 'ranked'>('unranked')

  const { data: profile, isLoading, error } = useQuery<PlayerProfile>({
    queryKey: ['player-profile', userId],
    queryFn: () => api.get(`/users/${userId}/profile`),
    enabled: !!userId,
    retry: false,
  })

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  const handleBlock = async () => {
    if (!userId || blocked) return
    setBlockLoading(true)
    try {
      await api.post(`/users/${userId}/block`, {})
      setBlocked(true)
    } catch (err: any) {
      setActionError(err.message)
    } finally {
      setBlockLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 p-6 pb-24 md:pb-6">
          <div className="max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto space-y-4 md:space-y-6">
            <div className="card animate-pulse h-40" />
            <div className="card animate-pulse h-56" />
            <div className="card animate-pulse h-40" />
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
            <p className="text-red-400 font-semibold">{t('playerProfile.loadError')}</p>
            <p className="text-neutral-500 text-sm mt-1">{(error as Error | null)?.message ?? ''}</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-4 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm transition-colors"
            >
              {t('playerProfile.back')}
            </button>
          </div>
        </main>
      </div>
    )
  }

  const isUnranked = profile.rankTier === 'unranked' || profile.hasPlayedRanked === false
  const rankTier: RankTier = (isUnranked ? 'wooden' : (profile.rankTier as RankTier)) ?? 'wooden'
  const rank = RANK_CONFIG[rankTier]
  const lp = profile.rankPoints ?? 0
  const tierIndex = Object.keys(RANK_CONFIG).indexOf(rankTier)
  const prevThreshold = tierIndex === 0 ? 0 : Object.values(RANK_CONFIG)[tierIndex - 1]?.lpRequired ?? 0
  const currentThreshold = rank.lpRequired === Infinity ? prevThreshold + 100 : rank.lpRequired
  const tierRange = currentThreshold - prevThreshold
  const lpInTier = lp - prevThreshold
  const lpPct = tierRange > 0 ? Math.min(Math.max((lpInTier / tierRange) * 100, 0), 100) : 100
  const nextRankTiers = Object.entries(RANK_CONFIG)
  const nextIdx = nextRankTiers.findIndex(([k]) => k === rankTier) + 1
  const nextRank = nextRankTiers[nextIdx]?.[1]

  const playerLevel = profile.level ?? 1
  const xpInLevel = profile.xpInLevel ?? 0
  const xpForNextLevel = profile.xpForNextLevel ?? 100
  const xpPct = playerLevel >= LEVEL_CAP
    ? 100
    : Math.min(100, Math.max(0, (xpInLevel / xpForNextLevel) * 100))

  const isRanked = statsTab === 'ranked'
  const fallbackStats = profile.stats
  const activeStats = isRanked
    ? (profile.statsRanked ?? null)
    : (profile.statsUnranked ?? fallbackStats ?? null)
  const activeHonors = isRanked ? profile.honorsRanked : profile.honorsUnranked
  const countByType = new Map((activeHonors ?? profile.honors ?? []).map((h) => [h.type, h.count]))

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6 pb-24 md:pb-6">
        <div className="max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto space-y-4 md:space-y-6 animate-slide-up">

          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white transition-colors"
          >
            {t('playerProfile.back')}
          </button>

          {/* Profile card */}
          <div className="card relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600/5 via-transparent to-transparent pointer-events-none" />

            <div className="relative flex items-center gap-4">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt="avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-brand-700/60"
                />
              ) : (
                <Avatar username={profile.username} size="xl" />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-white truncate">
                    {profile.username}
                  </h1>
                  {profile.isPremium && <PremiumBadge size="sm" />}
                </div>
                {profile.createdAt && (
                  <p className="text-neutral-600 text-xs mt-0.5">
                    {t('profile.joinedDate', { date: formatDate(profile.createdAt) })}
                  </p>
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
              </div>

              {/* Report / Block actions */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => setShowReport(true)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-red-950/40 hover:border-red-800/50 text-neutral-400 hover:text-red-400 text-xs font-semibold transition-colors"
                  title="Report player"
                >
                  🚨 Report
                </button>
                <button
                  onClick={handleBlock}
                  disabled={blocked || blockLoading}
                  className="px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={blocked ? 'Player blocked' : 'Block player'}
                >
                  {blocked ? '✅ Blocked' : blockLoading ? '...' : '🚫 Block'}
                </button>
              </div>
            </div>

            {/* Lifetime player level progress */}
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

            {/* Rank progress */}
            {!isUnranked && (
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
            {isUnranked && (
              <p className="mt-3 text-xs text-neutral-500 text-center">
                This player hasn't played a ranked game yet.
              </p>
            )}

            {actionError && (
              <p className="mt-3 text-xs text-red-400 text-center">{actionError}</p>
            )}
          </div>

          {showReport && (
            <ReportModal
              targetUserId={profile.id}
              targetUsername={profile.username}
              onClose={() => setShowReport(false)}
            />
          )}

          {/* Stats & Honors — tabbed by mode */}
          <div className="card space-y-4">
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

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                {t('profile.gamesPlayed', { defaultValue: 'Games' })}
              </p>
              {!activeStats || activeStats.totalGames === 0 ? (
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
                    { label: t('profile.asRedHanded'), value: activeStats.asRedHanded, icon: '🎭' },
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

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                {isRanked
                  ? t('profile.honorReceivedRanked',   { defaultValue: 'Honor Received' })
                  : t('profile.honorReceivedUnranked', { defaultValue: 'Honor Received' })}
              </p>
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
            </div>
          </div>

          {/* Recent games */}
          {(profile.recentGames?.length ?? 0) > 0 && (
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                {t('profile.recentGames')}
              </p>
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
                      {g.survived ? t('profile.survived') : t('playerProfile.eliminated')}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {(profile.recentGames?.length ?? 0) === 0 && (
            <div className="card text-center py-8">
              <p className="text-neutral-500 text-sm">{t('playerProfile.noGames')}</p>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
