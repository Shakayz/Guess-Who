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
import { RANK_CONFIG } from '@imposter/shared'
import type { RankTier } from '@imposter/shared'
import { api } from '../../lib/api'
import { useResponsive } from '../../lib/responsive'

interface LeaderboardEntry {
  id: string
  username: string
  rank: RankTier
  rankPoints: number
  honorPoints: number
}

const PODIUM_MEDALS = ['🥇', '🥈', '🥉'] as const

export default function LeaderboardScreen() {
  const { t } = useTranslation()
  const router = useRouter()

  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<LeaderboardEntry[]>('/users/leaderboard')
      setEntries(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const navigateToPlayer = (userId: string) => {
    router.push(`/profile/${userId}`)
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950 items-center justify-center">
        <ActivityIndicator size="large" color="#8b5cf6" />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950 items-center justify-center px-6">
        <Text className="text-red-400 text-sm text-center mb-4">{error}</Text>
        <TouchableOpacity
          onPress={fetchLeaderboard}
          className="bg-violet-600 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)

  // Reorder for podium display: [2nd, 1st, 3rd]
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3
  const podiumMedalOrder = top3.length >= 3
    ? [PODIUM_MEDALS[1], PODIUM_MEDALS[0], PODIUM_MEDALS[2]]
    : PODIUM_MEDALS.slice(0, top3.length)
  const podiumSizes = top3.length >= 3
    ? [{ circle: 64, font: 22 }, { circle: 80, font: 28 }, { circle: 64, font: 22 }]
    : top3.map(() => ({ circle: 64, font: 22 }))

  const { isTablet, px, fontScale } = useResponsive()
  const contentStyle = isTablet ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const } : {}

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const position = index + 4 // offset by top 3
    const rankCfg = RANK_CONFIG[item.rank] ?? RANK_CONFIG.wooden

    return (
      <TouchableOpacity
        onPress={() => navigateToPlayer(item.id)}
        className="flex-row items-center mb-2 bg-neutral-900 border border-neutral-800 rounded-2xl"
        style={{ marginHorizontal: px, paddingHorizontal: isTablet ? 20 : 16, paddingVertical: isTablet ? 16 : 12, ...contentStyle }}
        activeOpacity={0.7}
      >
        {/* Position */}
        <View className="w-8 items-center">
          <Text className="text-neutral-500 font-bold text-sm">
            {position}
          </Text>
        </View>

        {/* Avatar */}
        <View className="w-10 h-10 rounded-full bg-neutral-800 items-center justify-center mx-3">
          <Text className="text-white font-bold text-sm">
            {item.username.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Name + Rank Badge */}
        <View className="flex-1">
          <Text className="text-white font-semibold text-sm">
            {item.username}
          </Text>
          <View className="flex-row items-center gap-1 mt-0.5">
            <Text className="text-xs">{rankCfg.icon}</Text>
            <Text className="text-xs font-medium" style={{ color: rankCfg.color }}>
              {rankCfg.label}
            </Text>
          </View>
        </View>

        {/* LP */}
        <View className="items-end">
          <Text className="text-violet-400 font-bold text-sm">
            {item.rankPoints}
          </Text>
          <Text className="text-neutral-600 text-[10px]">LP</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <FlatList
        data={rest}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <>
            {/* Podium */}
            {top3.length > 0 && (
              <View className="pt-6 pb-4" style={{ paddingHorizontal: px, ...contentStyle }}>
                <View className="flex-row items-end justify-center gap-3">
                  {podiumOrder.map((player, i) => {
                    if (!player) return null
                    const size = podiumSizes[i]
                    const medal = podiumMedalOrder[i]
                    const rankCfg = RANK_CONFIG[player.rank] ?? RANK_CONFIG.wooden
                    const isFirst = i === 1 && top3.length >= 3

                    return (
                      <TouchableOpacity
                        key={player.id}
                        onPress={() => navigateToPlayer(player.id)}
                        className="items-center"
                        style={{ marginBottom: isFirst ? 8 : 0 }}
                        activeOpacity={0.7}
                      >
                        <Text className="text-2xl mb-1">{medal}</Text>
                        <View
                          className="rounded-full items-center justify-center mb-2"
                          style={{
                            width: isTablet ? size.circle * 1.3 : size.circle,
                            height: isTablet ? size.circle * 1.3 : size.circle,
                            backgroundColor: isFirst ? '#7c3aed' : '#262626',
                            borderWidth: 2,
                            borderColor: isFirst ? '#a78bfa' : '#404040',
                          }}
                        >
                          <Text
                            className="text-white font-bold"
                            style={{ fontSize: size.font }}
                          >
                            {player.username.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          className="text-white font-semibold text-sm text-center"
                          numberOfLines={1}
                          style={{ maxWidth: 80 }}
                        >
                          {player.username}
                        </Text>
                        <View className="flex-row items-center gap-1 mt-0.5">
                          <Text className="text-xs">{rankCfg.icon}</Text>
                          <Text
                            className="text-xs font-medium"
                            style={{ color: rankCfg.color }}
                          >
                            {rankCfg.label}
                          </Text>
                        </View>
                        <Text className="text-violet-400 font-bold text-xs mt-0.5">
                          {player.rankPoints} LP
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Divider */}
            {rest.length > 0 && (
              <View className="flex-row items-center gap-3 mb-3 mt-2" style={{ marginHorizontal: px, ...contentStyle }}>
                <View className="flex-1 h-px bg-neutral-800" />
                <Text className="text-neutral-500 text-xs font-medium uppercase tracking-wider">
                  {t('leaderboard.rankings', 'Rankings')}
                </Text>
                <View className="flex-1 h-px bg-neutral-800" />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-neutral-500 text-sm">
              {t('leaderboard.empty', 'No players yet')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}
