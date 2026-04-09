import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'
import type { AchievementCardData } from '../components/achievements/AchievementCard'
import { AchievementCard } from '../components/achievements/AchievementCard'
import { ClaimBurst } from '../components/achievements/ClaimBurst'
import { AchievementFilters } from '../components/achievements/AchievementFilters'
import type { CategoryFilter, StateFilter } from '../components/achievements/AchievementFilters'

interface ClaimResponse {
  starsGranted: number
  xpGranted: number
  newBalance: number
  claimedAt: string
  achievement: { key: string; name: string; icon: string; difficulty: string }
}

interface MeResponse { starCoins: number }

export default function AchievementsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [stateFilter, setStateFilter] = useState<StateFilter>('unclaimed')
  const [burst, setBurst] = useState<{ key: string; stars: number } | null>(null)

  const { data: achievements, isLoading } = useQuery<AchievementCardData[]>({
    queryKey: ['achievements'],
    queryFn: () => api.get('/achievements'),
    retry: false,
  })

  const claimMutation = useMutation({
    mutationFn: (key: string) => api.post<ClaimResponse>(`/achievements/${key}/claim`, {}),
    onSuccess: (data, key) => {
      // Optimistic cache update: flip the row to claimed
      queryClient.setQueryData<AchievementCardData[]>(['achievements'], (old) =>
        old?.map((a) => (a.key === key ? { ...a, claimed: true, claimedAt: data.claimedAt } : a)),
      )
      // Update the NavBar / balance cache
      queryClient.setQueryData<MeResponse>(['me'], (old) =>
        old ? { ...old, starCoins: data.newBalance } : old,
      )
      queryClient.invalidateQueries({ queryKey: ['achievements-summary'] })
      // Trigger the burst animation over the claimed card
      setBurst({ key, stars: data.starsGranted })
    },
  })

  const filtered = useMemo(() => {
    if (!achievements) return []
    return achievements.filter((a) => {
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false
      if (stateFilter === 'locked' && a.unlocked) return false
      if (stateFilter === 'unclaimed' && (!a.unlocked || a.claimed)) return false
      if (stateFilter === 'claimed' && !a.claimed) return false
      return true
    })
  }, [achievements, categoryFilter, stateFilter])

  // Counts per category for the pill badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: achievements?.length ?? 0 }
    if (!achievements) return counts
    for (const a of achievements) {
      counts[a.category] = (counts[a.category] ?? 0) + 1
    }
    return counts
  }, [achievements])

  const total = achievements?.length ?? 0
  const unlocked = achievements?.filter((a) => a.unlocked).length ?? 0
  const claimed = achievements?.filter((a) => a.claimed).length ?? 0
  const unclaimed = unlocked - claimed
  const unclaimedStars = achievements?.filter((a) => a.unlocked && !a.claimed)
    .reduce((s, a) => s + a.starsReward, 0) ?? 0

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {t('achievements.title')}
            </h1>
            <p className="text-neutral-500 text-sm mt-1">{t('achievements.subtitle')}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label={t('achievements.unlocked')} value={`${unlocked}/${total}`} icon="🏅" accent="brand" />
            <StatCard label={t('achievements.claimedCount')} value={claimed.toString()} icon="✓" accent="emerald" />
            <StatCard label={t('achievements.unclaimedCount')} value={unclaimed.toString()} icon="🎁" accent="amber" />
            <StatCard label={t('achievements.pendingStars')} value={`+${unclaimedStars}⭐`} icon="⭐" accent="amber" />
          </div>

          <AchievementFilters
            category={categoryFilter}
            state={stateFilter}
            onCategoryChange={setCategoryFilter}
            onStateChange={setStateFilter}
            counts={categoryCounts}
          />

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-neutral-900/50 border border-neutral-800 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-neutral-500">
              <div className="text-5xl mb-3">🎯</div>
              <p className="font-semibold">{t('achievements.emptyState')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((a) => (
                <AchievementCard
                  key={a.id}
                  achievement={a}
                  onClaim={(key) => claimMutation.mutate(key)}
                  isClaiming={claimMutation.isPending && claimMutation.variables === a.key}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {burst && (
        <ClaimBurst
          targetKey={burst.key}
          stars={burst.stars}
          onDone={() => setBurst(null)}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent: 'brand' | 'amber' | 'emerald' }) {
  const accentClass = {
    brand:   'border-brand-700/40 bg-brand-950/30',
    amber:   'border-amber-700/40 bg-amber-950/20',
    emerald: 'border-emerald-700/40 bg-emerald-950/20',
  }[accent]
  return (
    <div className={['rounded-2xl border p-4', accentClass].join(' ')}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-1">
        <span className="text-base">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-2xl font-extrabold text-white">{value}</div>
    </div>
  )
}
