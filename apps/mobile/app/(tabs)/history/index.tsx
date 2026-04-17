import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { api } from '../../../lib/api'
import { useAuthStore } from '../../../store/auth'
import { useResponsive } from '../../../lib/responsive'

type HistoryMode = 'unranked' | 'ranked'

interface GameSummary {
  id: string
  winner: 'villagers' | 'red_handed'
  myRole: 'villager' | 'red_handed' | 'detective' | 'doubleAgent'
  gameMode?: 'normal' | 'special' | 'ranked'
  roundCount: number
  players: string[]
  createdAt: string
}

interface HistoryResponse {
  games: GameSummary[]
  totalPages: number
}

const ROLE_CONFIG: Record<string, { emoji: string; label: string }> = {
  villager: { emoji: '🏘️', label: 'Villager' },
  red_handed: { emoji: '🎭', label: 'Imposter' },
  detective: { emoji: '🔍', label: 'Detective' },
  double_agent: { emoji: '🕵️', label: 'Double Agent' },
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function didWin(winner: string, myRole: string): boolean {
  const villagerTeam = ['villager', 'detective']
  const redHandedTeam = ['red_handed', 'doubleAgent']
  if (winner === 'villagers') return villagerTeam.includes(myRole)
  return redHandedTeam.includes(myRole)
}

export default function HistoryScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)

  const [mode, setMode] = useState<HistoryMode>('unranked')
  const [games, setGames] = useState<GameSummary[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPage = useCallback(
    async (p: number, m: HistoryMode) => {
      try {
        const data = await api.get<HistoryResponse>(
          `/history?page=${p}&limit=10&mode=${m}`,
        )
        if (p === 1) {
          setGames(data.games)
        } else {
          setGames((prev) => [...prev, ...data.games])
        }
        setTotalPages(data.totalPages)
      } catch (err: any) {
        setError(err.message)
      }
    },
    [],
  )

  useEffect(() => {
    setLoading(true)
    setPage(1)
    fetchPage(1, mode).finally(() => setLoading(false))
  }, [fetchPage, mode])

  const handleLoadMore = useCallback(() => {
    if (loadingMore || page >= totalPages) return
    const nextPage = page + 1
    setPage(nextPage)
    setLoadingMore(true)
    fetchPage(nextPage, mode).finally(() => setLoadingMore(false))
  }, [loadingMore, page, totalPages, fetchPage, mode])

  const selectMode = useCallback((next: HistoryMode) => {
    if (next === mode) return
    setGames([])
    setMode(next)
  }, [mode])

  const { isTablet, px, fontScale } = useResponsive()
  const contentStyle = isTablet ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const } : {}

  const renderGame = useCallback(
    ({ item }: { item: GameSummary }) => {
      const won = didWin(item.winner, item.myRole)
      const role = ROLE_CONFIG[item.myRole] ?? ROLE_CONFIG.villager

      return (
        <TouchableOpacity
          onPress={() => router.push(`/history/${item.id}`)}
          className="mb-3 rounded-2xl border border-neutral-800 bg-neutral-900"
          style={{ marginHorizontal: px, padding: isTablet ? 20 : 16, ...contentStyle }}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center justify-between mb-2">
            <View
              className={`px-2.5 py-1 rounded-lg ${won ? 'bg-emerald-950 border border-emerald-800' : 'bg-red-950 border border-red-800'}`}
            >
              <Text
                className={`text-xs font-bold ${won ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {won ? t('results.victory') : t('results.defeat')}
              </Text>
            </View>
            <Text className="text-neutral-500 text-xs">
              {dateFormatter.format(new Date(item.createdAt))}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg">{role.emoji}</Text>
              <Text className="text-white font-semibold text-sm">
                {role.label}
              </Text>
            </View>
            <Text className="text-neutral-500 text-xs">
              {item.roundCount} {item.roundCount === 1 ? 'round' : 'rounds'}
            </Text>
          </View>

          <View className="flex-row items-center mt-2 gap-1">
            <Text className="text-neutral-600 text-xs">
              {item.players.length} {t('common.players').toLowerCase()}
            </Text>
          </View>
        </TouchableOpacity>
      )
    },
    [router, t, px, isTablet, contentStyle],
  )

  const renderTabs = () => {
    const tabStyle = { marginHorizontal: px, ...contentStyle }
    return (
      <View
        className="flex-row rounded-2xl bg-neutral-900 border border-neutral-800 p-1 mb-3"
        style={tabStyle}
      >
        <TouchableOpacity
          onPress={() => selectMode('unranked')}
          className={`flex-1 rounded-xl py-2 items-center ${mode === 'unranked' ? 'bg-neutral-800' : ''}`}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'unranked' }}
        >
          <Text
            className={`text-sm font-semibold ${mode === 'unranked' ? 'text-white' : 'text-neutral-400'}`}
          >
            {t('history.tabUnranked', 'Unranked')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => selectMode('ranked')}
          className={`flex-1 rounded-xl py-2 items-center ${mode === 'ranked' ? 'bg-neutral-800' : ''}`}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'ranked' }}
        >
          <Text
            className={`text-sm font-semibold ${mode === 'ranked' ? 'text-white' : 'text-neutral-400'}`}
          >
            {t('history.tabRanked', 'Ranked')}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (loading && games.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
        <View style={{ paddingTop: 12 }}>{renderTabs()}</View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text className="text-neutral-500 mt-3 text-sm">
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950 items-center justify-center px-6">
        <Text className="text-red-400 text-sm text-center mb-4">
          {error}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setError(null)
            setLoading(true)
            setPage(1)
            fetchPage(1, mode).finally(() => setLoading(false))
          }}
          className="px-5 py-2.5 rounded-xl bg-violet-600"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-sm">
            {t('common.retry')}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const emptyMessage =
    mode === 'ranked'
      ? t('history.noRankedGames', 'No ranked games played yet')
      : t('history.noUnrankedGames', 'No unranked games played yet')

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <FlatList
        data={games}
        keyExtractor={(item) => item.id}
        renderItem={renderGame}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
        ListHeaderComponent={renderTabs()}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
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
            <Text className="text-neutral-500 text-base text-center">
              {emptyMessage}
            </Text>
            <Text className="text-neutral-600 text-sm text-center mt-1">
              Your game history will appear here
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}
