import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { api } from '../../../lib/api'
import { useResponsive } from '../../../lib/responsive'
import {
  AchievementCard,
  type AchievementCardData,
} from '../../../components/achievements/AchievementCard'
import {
  AchievementFilters,
  type CategoryFilter,
  type StateFilter,
} from '../../../components/achievements/AchievementFilters'

interface ClaimResponse {
  starsGranted: number
  xpGranted: number
  newBalance: number
  claimedAt: string
}

export default function AchievementsScreen() {
  const { t } = useTranslation()
  const { isTablet, px, fontScale } = useResponsive()

  const [achievements, setAchievements] = useState<AchievementCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [stateFilter, setStateFilter] = useState<StateFilter>('unclaimed')
  const [claimingKey, setClaimingKey] = useState<string | null>(null)
  const [burstKey, setBurstKey] = useState<string | null>(null)

  const fetchAchievements = useCallback(async () => {
    setError(null)
    try {
      const list = await api.get<AchievementCardData[]>('/achievements')
      setAchievements(list)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load achievements')
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchAchievements().finally(() => setLoading(false))
  }, [fetchAchievements])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAchievements()
    setRefreshing(false)
  }, [fetchAchievements])

  const handleClaim = useCallback(async (key: string) => {
    if (claimingKey) return
    setClaimingKey(key)
    try {
      const data = await api.post<ClaimResponse>(`/achievements/${key}/claim`, {})
      // Optimistic local update
      setAchievements((prev) =>
        prev.map((a) =>
          a.key === key ? { ...a, claimed: true, claimedAt: data.claimedAt } : a,
        ),
      )
      setBurstKey(key)
      setTimeout(() => setBurstKey(null), 900)
    } catch (err: any) {
      setError(err?.message ?? 'Claim failed')
    } finally {
      setClaimingKey(null)
    }
  }, [claimingKey])

  const filtered = useMemo(() => {
    return achievements.filter((a) => {
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false
      if (stateFilter === 'locked' && a.unlocked) return false
      if (stateFilter === 'unclaimed' && (!a.unlocked || a.claimed)) return false
      if (stateFilter === 'claimed' && !a.claimed) return false
      return true
    })
  }, [achievements, categoryFilter, stateFilter])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: achievements.length }
    for (const a of achievements) {
      counts[a.category] = (counts[a.category] ?? 0) + 1
    }
    return counts
  }, [achievements])

  const total = achievements.length
  const unlocked = achievements.filter((a) => a.unlocked).length
  const claimed = achievements.filter((a) => a.claimed).length
  const unclaimed = unlocked - claimed
  const unclaimedStars = achievements
    .filter((a) => a.unlocked && !a.claimed)
    .reduce((s, a) => s + (a.starsReward ?? 0), 0)

  const contentStyle = isTablet
    ? { maxWidth: 900, alignSelf: 'center' as const, width: '100%' as const }
    : {}

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={contentStyle}>
          {/* Header */}
          <View style={{ paddingHorizontal: px, paddingTop: 16 }}>
            <Text className="text-white font-extrabold tracking-tight" style={{ fontSize: (isTablet ? 28 : 22) }}>
              {t('achievements.title', { defaultValue: 'Achievements' })}
            </Text>
            <Text className="text-neutral-500 mt-1" style={{ fontSize: 12 * fontScale }}>
              {t('achievements.subtitle', { defaultValue: 'Unlock badges and claim star coins.' })}
            </Text>
          </View>

          {/* Summary stats */}
          <View
            className="flex-row gap-2"
            style={{ paddingHorizontal: px, marginTop: 16 }}
          >
            <StatPill
              icon="🏅"
              label={t('achievements.unlocked', { defaultValue: 'Unlocked' })}
              value={`${unlocked}/${total}`}
              accent="violet"
              fontScale={fontScale}
            />
            <StatPill
              icon="✓"
              label={t('achievements.claimedCount', { defaultValue: 'Claimed' })}
              value={`${claimed}`}
              accent="emerald"
              fontScale={fontScale}
            />
            <StatPill
              icon="🎁"
              label={t('achievements.unclaimedCount', { defaultValue: 'Ready' })}
              value={`${unclaimed}`}
              accent="amber"
              fontScale={fontScale}
            />
          </View>

          {/* Pending stars chip */}
          {unclaimedStars > 0 && (
            <View
              className="mt-3 mx-auto px-3 py-1.5 rounded-full bg-amber-950/40 border border-amber-700/50 flex-row items-center gap-1.5"
              style={{ marginHorizontal: px, alignSelf: 'flex-start' }}
            >
              <Text style={{ fontSize: 12 * fontScale }}>⭐</Text>
              <Text className="text-amber-300 font-bold" style={{ fontSize: 12 * fontScale }}>
                {t('achievements.pendingStars', { defaultValue: 'Pending' })}: +{unclaimedStars}
              </Text>
            </View>
          )}

          {/* Filters */}
          <View style={{ paddingHorizontal: px, marginTop: 16 }}>
            <AchievementFilters
              category={categoryFilter}
              state={stateFilter}
              onCategoryChange={setCategoryFilter}
              onStateChange={setStateFilter}
              counts={categoryCounts}
              fontScale={fontScale}
            />
          </View>

          {/* Error */}
          {error && (
            <View
              className="mt-3 flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800"
              style={{ marginHorizontal: px }}
            >
              <Text className="text-red-400" style={{ fontSize: 13 * fontScale }}>⚠ {error}</Text>
            </View>
          )}

          {/* Grid */}
          {loading ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator color="#a78bfa" size="large" />
            </View>
          ) : filtered.length === 0 ? (
            <View className="items-center justify-center py-16">
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🎯</Text>
              <Text className="text-neutral-500 font-semibold" style={{ fontSize: 14 * fontScale }}>
                {t('achievements.emptyState', { defaultValue: 'Nothing here yet.' })}
              </Text>
            </View>
          ) : (
            <View
              className="flex-row flex-wrap"
              style={{ paddingHorizontal: px - 4, marginTop: 16 }}
            >
              {filtered.map((a) => (
                <View
                  key={a.id}
                  style={{
                    width: isTablet ? '33.333%' : '50%',
                    padding: 4,
                  }}
                >
                  <AchievementCard
                    achievement={a}
                    onClaim={handleClaim}
                    isClaiming={claimingKey === a.key}
                    isTablet={isTablet}
                    fontScale={fontScale}
                    burstKey={burstKey}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatPill({
  icon,
  label,
  value,
  accent,
  fontScale,
}: {
  icon: string
  label: string
  value: string
  accent: 'violet' | 'amber' | 'emerald'
  fontScale: number
}) {
  const accentClass = {
    violet: 'border-violet-700/40 bg-violet-950/30',
    amber: 'border-amber-700/40 bg-amber-950/20',
    emerald: 'border-emerald-700/40 bg-emerald-950/20',
  }[accent]
  const valueClass = {
    violet: 'text-violet-200',
    amber: 'text-amber-200',
    emerald: 'text-emerald-200',
  }[accent]
  return (
    <View className={['flex-1 rounded-2xl border p-3', accentClass].join(' ')}>
      <View className="flex-row items-center gap-1.5 mb-0.5">
        <Text style={{ fontSize: 12 * fontScale }}>{icon}</Text>
        <Text className="text-neutral-500 font-semibold uppercase tracking-wider" style={{ fontSize: 9 * fontScale }}>
          {label}
        </Text>
      </View>
      <Text className={['font-extrabold', valueClass].join(' ')} style={{ fontSize: 18 * fontScale }}>
        {value}
      </Text>
    </View>
  )
}
