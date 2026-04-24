import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { api } from '../../../lib/api'
import { useResponsive } from '../../../lib/responsive'
import { findLanguage } from '../../../i18n/languages'
import { HapticManager } from '../../../lib/haptics'
import { isVillagerSideRole, isRedHandedSideRole, isJesterRole, isTwinRole } from '@red-handed/shared'
import type { PlayerRole } from '@red-handed/shared'

type HistoryMode = 'unranked' | 'ranked'
type WinnerTeam = 'villagers' | 'red_handed' | 'jester' | 'evil_twins' | 'draw'

interface GameSummary {
  id: string
  winnerTeam: WinnerTeam
  myRole: PlayerRole
  gameMode?: 'normal' | 'special' | 'ranked'
  roundCount: number
  players: { userId: string; username: string; role: string; survived: boolean }[]
  startedAt: string
  language?: string
  survived?: boolean
}

interface HistoryResponse {
  games: GameSummary[]
  total: number
  page: number
  totalPages: number
}

const ROLE_CONFIG: Record<string, { emoji: string; key: string; fallback: string }> = {
  villager:     { emoji: '🏘️', key: 'game.roleVillager',    fallback: 'Villager' },
  red_handed:   { emoji: '🎭', key: 'game.roleRedHanded',   fallback: 'Imposter' },
  detective:    { emoji: '🔍', key: 'game.roleDetective',   fallback: 'Detective' },
  double_agent: { emoji: '🕵️', key: 'game.roleDoubleAgent', fallback: 'Double Agent' },
  doubleAgent:  { emoji: '🕵️', key: 'game.roleDoubleAgent', fallback: 'Double Agent' },
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

type Outcome = 'win' | 'loss' | 'draw'

function getOutcome(winner: string, myRole: string): Outcome {
  if (winner === 'draw') return 'draw'
  const role = myRole as PlayerRole
  const won =
    (winner === 'villagers'  && isVillagerSideRole(role)) ||
    (winner === 'red_handed' && isRedHandedSideRole(role)) ||
    (winner === 'jester'     && isJesterRole(role)) ||
    (winner === 'evil_twins' && isTwinRole(role))
  return won ? 'win' : 'loss'
}

function startOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function bucketForDate(iso: string, t: (k: string, fb?: string) => string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return t('history.dateOlder', 'Older')
  const today = startOfDay(new Date())
  const games = startOfDay(d)
  const dayMs = 86400000
  const days = Math.round((today - games) / dayMs)
  if (days <= 0) return t('history.dateToday', 'Today')
  if (days === 1) return t('history.dateYesterday', 'Yesterday')
  if (days <= 7) return t('history.dateThisWeek', 'This week')
  if (days <= 30) return t('history.dateThisMonth', 'This month')
  return t('history.dateOlder', 'Older')
}

function SkeletonCard({ width }: { width: number | string }) {
  return (
    <View
      className="mb-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4"
      style={{ marginHorizontal: 16, width: typeof width === 'number' ? width : undefined }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="h-5 w-16 bg-neutral-800 rounded-lg" />
        <View className="h-4 w-24 bg-neutral-800 rounded-md" />
      </View>
      <View className="flex-row items-center justify-between mb-2">
        <View className="h-4 w-28 bg-neutral-800 rounded-md" />
        <View className="h-3 w-16 bg-neutral-800 rounded-md" />
      </View>
      <View className="h-3 w-20 bg-neutral-800 rounded-md mt-1" />
    </View>
  )
}

interface Stats {
  total: number
  wins: number
  winRate: number
  topRole: { role: string; count: number } | null
}

function computeStats(games: GameSummary[]): Stats {
  if (games.length === 0) return { total: 0, wins: 0, winRate: 0, topRole: null }
  let wins = 0
  let decided = 0
  const roleCount: Record<string, number> = {}
  for (const g of games) {
    const outcome = getOutcome(g.winnerTeam, g.myRole)
    if (outcome !== 'draw') {
      decided++
      if (outcome === 'win') wins++
    }
    roleCount[g.myRole] = (roleCount[g.myRole] ?? 0) + 1
  }
  let topRole: { role: string; count: number } | null = null
  for (const [role, count] of Object.entries(roleCount)) {
    if (!topRole || count > topRole.count) topRole = { role, count }
  }
  const winRate = decided === 0 ? 0 : Math.round((wins / decided) * 100)
  return { total: games.length, wins, winRate, topRole }
}

export default function HistoryScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { isTablet, px } = useResponsive()
  const contentStyle = isTablet
    ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const }
    : {}

  const [mode, setMode] = useState<HistoryMode>('unranked')
  const [games, setGames] = useState<GameSummary[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPage = useCallback(
    async (p: number, m: HistoryMode, replace: boolean) => {
      const limit = p === 1 ? 25 : 10
      const data = await api.get<HistoryResponse>(
        `/history?page=${p}&limit=${limit}&mode=${m}`,
      )
      if (replace) setGames(data.games)
      else setGames((prev) => [...prev, ...data.games])
      setTotalPages(data.totalPages)
    },
    [],
  )

  useEffect(() => {
    setLoading(true)
    setError(null)
    setPage(1)
    fetchPage(1, mode, true)
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [fetchPage, mode])

  const handleRefresh = useCallback(async () => {
    HapticManager.light()
    setRefreshing(true)
    setError(null)
    setPage(1)
    try {
      await fetchPage(1, mode, true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }, [fetchPage, mode])

  const handleLoadMore = useCallback(() => {
    if (loadingMore || page >= totalPages) return
    const nextPage = page + 1
    setPage(nextPage)
    setLoadingMore(true)
    fetchPage(nextPage, mode, false)
      .catch((err: any) => setError(err.message))
      .finally(() => setLoadingMore(false))
  }, [loadingMore, page, totalPages, fetchPage, mode])

  const selectMode = useCallback(
    (next: HistoryMode) => {
      if (next === mode) return
      HapticManager.selection()
      setGames([])
      setMode(next)
    },
    [mode],
  )

  const stats = useMemo(() => computeStats(games), [games])

  const sections = useMemo(() => {
    const buckets = new Map<string, GameSummary[]>()
    const order: string[] = []
    for (const g of games) {
      const label = bucketForDate(g.startedAt, t as any)
      if (!buckets.has(label)) {
        buckets.set(label, [])
        order.push(label)
      }
      buckets.get(label)!.push(g)
    }
    return order.map((title) => ({ title, data: buckets.get(title)! }))
  }, [games, t])

  const renderGame = useCallback(
    ({ item }: { item: GameSummary }) => {
      const outcome = getOutcome(item.winnerTeam, item.myRole)
      const role = ROLE_CONFIG[item.myRole] ?? ROLE_CONFIG.villager
      const lang = findLanguage(item.language)
      const dateText = (() => {
        const d = new Date(item.startedAt)
        return Number.isNaN(d.getTime()) ? '' : dateFormatter.format(d)
      })()

      return (
        <TouchableOpacity
          onPress={() => {
            HapticManager.selection()
            router.push(`/history/${item.id}`)
          }}
          className="mb-3 rounded-2xl border border-neutral-800 bg-neutral-900"
          style={{ marginHorizontal: px, padding: isTablet ? 20 : 16, ...contentStyle }}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center justify-between mb-2">
            <View
              className={`px-2.5 py-1 rounded-lg ${
                outcome === 'win'
                  ? 'bg-emerald-950 border border-emerald-800'
                  : outcome === 'draw'
                    ? 'bg-amber-950 border border-amber-800'
                    : 'bg-red-950 border border-red-800'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  outcome === 'win'
                    ? 'text-emerald-400'
                    : outcome === 'draw'
                      ? 'text-amber-400'
                      : 'text-red-400'
                }`}
              >
                {outcome === 'win'
                  ? t('history.victory')
                  : outcome === 'draw'
                    ? t('history.draw', 'Draw')
                    : t('history.defeat')}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full border border-neutral-700 bg-neutral-800/60">
                <Text style={{ fontSize: 11 }}>{lang.flag}</Text>
                <Text className="text-neutral-300 text-[10px] font-semibold">
                  {lang.label}
                </Text>
              </View>
              <Text className="text-neutral-500 text-xs">{dateText}</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg">{role.emoji}</Text>
              <Text className="text-white font-semibold text-sm">
                {t(role.key, role.fallback)}
              </Text>
              {item.survived === false && (
                <View className="px-1.5 py-0.5 rounded-md bg-red-950/60 border border-red-900/40">
                  <Text className="text-red-400 text-[9px] font-bold">
                    {t('history.eliminated', '✗')}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-neutral-500 text-xs">
              {item.roundCount === 1
                ? t('history.roundsSingular', { defaultValue: '1 round' })
                : t('history.roundsPlural', {
                    count: item.roundCount,
                    defaultValue: `${item.roundCount} rounds`,
                  })}
            </Text>
          </View>

          <View className="flex-row items-center mt-2 gap-1">
            <Text className="text-neutral-600 text-xs">
              {t('history.playersCount', {
                count: item.players.length,
                defaultValue: `${item.players.length} players`,
              })}
            </Text>
          </View>
        </TouchableOpacity>
      )
    },
    [router, t, px, isTablet, contentStyle],
  )

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View
        style={{ marginHorizontal: px, ...contentStyle, marginTop: 6, marginBottom: 6 }}
      >
        <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          {section.title}
        </Text>
      </View>
    ),
    [px, contentStyle],
  )

  const renderTabs = useCallback(() => {
    const tabStyle = { marginHorizontal: px, ...contentStyle }
    return (
      <View
        className="flex-row rounded-2xl bg-neutral-900 border border-neutral-800 p-1 mb-3"
        style={tabStyle}
      >
        <TouchableOpacity
          onPress={() => selectMode('unranked')}
          className={`flex-1 rounded-xl py-2 items-center ${
            mode === 'unranked' ? 'bg-neutral-800' : ''
          }`}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'unranked' }}
        >
          <Text
            className={`text-sm font-semibold ${
              mode === 'unranked' ? 'text-white' : 'text-neutral-400'
            }`}
          >
            {t('history.tabUnranked', 'Unranked')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => selectMode('ranked')}
          className={`flex-1 rounded-xl py-2 items-center ${
            mode === 'ranked' ? 'bg-neutral-800' : ''
          }`}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'ranked' }}
        >
          <Text
            className={`text-sm font-semibold ${
              mode === 'ranked' ? 'text-white' : 'text-neutral-400'
            }`}
          >
            {t('history.tabRanked', 'Ranked')}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }, [px, contentStyle, mode, selectMode, t])

  const renderStatsHeader = useCallback(() => {
    if (loading || stats.total === 0) return null
    const topRoleCfg = stats.topRole
      ? ROLE_CONFIG[stats.topRole.role] ?? ROLE_CONFIG.villager
      : null
    const topRoleLabel = topRoleCfg ? t(topRoleCfg.key, topRoleCfg.fallback) : '—'

    return (
      <View
        className="mb-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
        style={{ marginHorizontal: px, ...contentStyle }}
      >
        <Text className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-3">
          {t('history.statsTitle', 'Your stats')}
        </Text>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 items-center">
            <Text className="text-white text-2xl font-extrabold">{stats.total}</Text>
            <Text className="text-neutral-500 text-[10px] uppercase tracking-wider mt-0.5">
              {t('history.totalGames', 'Games')}
            </Text>
          </View>
          <View className="w-px h-10 bg-neutral-800" />
          <View className="flex-1 items-center">
            <Text
              className={`text-2xl font-extrabold ${
                stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {stats.winRate}%
            </Text>
            <Text className="text-neutral-500 text-[10px] uppercase tracking-wider mt-0.5">
              {t('history.winRate', 'Win rate')}
            </Text>
          </View>
          <View className="w-px h-10 bg-neutral-800" />
          <View className="flex-1 items-center">
            <View className="flex-row items-center gap-1">
              <Text className="text-lg">{topRoleCfg?.emoji ?? '—'}</Text>
              <Text className="text-white text-sm font-bold" numberOfLines={1}>
                {topRoleLabel}
              </Text>
            </View>
            <Text className="text-neutral-500 text-[10px] uppercase tracking-wider mt-0.5">
              {t('history.favoriteRole', 'Top role')}
            </Text>
          </View>
        </View>
      </View>
    )
  }, [loading, stats, t, px, contentStyle])

  if (loading && games.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
        <View style={{ paddingTop: 12 }}>{renderTabs()}</View>
        <View className="pt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} width="100%" />
          ))}
        </View>
      </SafeAreaView>
    )
  }

  if (error && games.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950 items-center justify-center px-6">
        <Text className="text-red-400 text-sm text-center mb-4">{error}</Text>
        <TouchableOpacity
          onPress={handleRefresh}
          className="px-5 py-2.5 rounded-xl bg-violet-600"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-sm">{t('common.retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const emptyMessage =
    mode === 'ranked'
      ? t('history.noRankedGames', 'No ranked games yet')
      : t('history.noUnrankedGames', 'No unranked games yet')

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderGame}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
        ListHeaderComponent={
          <>
            {renderTabs()}
            {renderStatsHeader()}
          </>
        }
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8b5cf6"
            colors={['#8b5cf6']}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#8b5cf6" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center justify-center pt-24 px-6">
            <Text className="text-4xl mb-4">📜</Text>
            <Text className="text-neutral-500 text-base text-center">{emptyMessage}</Text>
            <Text className="text-neutral-600 text-sm text-center mt-1">
              {t('history.noGamesHint', 'Play your first game to see it here')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}
