import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { RANK_CONFIG } from '@red-handed/shared'
import type { RankTier } from '@red-handed/shared'
import { api } from '../../lib/api'
import { useResponsive } from '../../lib/responsive'
import { LANGUAGES, findLanguage } from '../../i18n/languages'

interface LeaderboardEntry {
  id: string
  username: string
  rank: RankTier
  rankPoints: number
  honorPoints: number
}

const PODIUM_MEDALS = ['🥇', '🥈', '🥉'] as const

export default function LeaderboardScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()

  const { isTablet, px, fontScale } = useResponsive()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [locale, setLocale] = useState<string>(() => findLanguage(i18n.language).code)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')

  const currentLang = findLanguage(locale)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((u) => u.username.toLowerCase().includes(q))
  }, [entries, search])
  const isSearching = search.trim().length > 0

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<LeaderboardEntry[]>(`/users/leaderboard?locale=${locale}`)
      setEntries(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [locale])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const navigateToPlayer = (userId: string) => {
    router.push(`/profile/${userId}`)
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950 items-center justify-center" edges={['bottom']}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950 items-center justify-center px-6" edges={['bottom']}>
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
  const listData = isSearching ? filtered : rest

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

  const contentStyle = isTablet ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const } : {}

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    // When searching, show original rank from entries; otherwise offset by podium top-3.
    const position = isSearching
      ? entries.findIndex((u) => u.id === item.id) + 1
      : index + 4
    const rankCfg = RANK_CONFIG[item.rank] ?? RANK_CONFIG.wooden

    return (
      <TouchableOpacity
        onPress={() => navigateToPlayer(item.id)}
        className="flex-row items-center mb-2 bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden"
        style={{ marginHorizontal: px, paddingHorizontal: isTablet ? 20 : 16, paddingVertical: isTablet ? 14 : 11, ...contentStyle }}
        activeOpacity={0.7}
      >
        {/* Position */}
        <View className="w-7 items-center mr-1">
          <Text className="text-neutral-600 font-bold text-sm tabular-nums">
            {position}
          </Text>
        </View>

        {/* Avatar */}
        <View
          className="rounded-full bg-neutral-700 items-center justify-center mx-3 border border-neutral-600/50"
          style={{ width: isTablet ? 42 : 36, height: isTablet ? 42 : 36 }}
        >
          <Text className="text-white font-bold" style={{ fontSize: isTablet ? 16 : 13 }}>
            {item.username.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Name + Rank Badge */}
        <View className="flex-1">
          <Text className="text-white font-semibold" style={{ fontSize: 14 * fontScale }}>
            {item.username}
          </Text>
          <View className="flex-row items-center gap-1 mt-0.5">
            <Text style={{ fontSize: 10 }}>{rankCfg.icon}</Text>
            <Text className="font-semibold" style={{ color: rankCfg.color, fontSize: 10 * fontScale }}>
              {rankCfg.label}
            </Text>
          </View>
        </View>

        {/* LP */}
        <View
          className="items-center px-2.5 py-1 rounded-lg bg-violet-950/50 border border-violet-800/40"
        >
          <Text className="text-violet-300 font-extrabold tabular-nums" style={{ fontSize: 13 * fontScale }}>
            {item.rankPoints}
          </Text>
          <Text className="text-violet-600 font-bold" style={{ fontSize: 9 * fontScale }}>LP</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <>
            {/* Screen header */}
            <View className="flex-row items-center justify-between pt-5 pb-1" style={{ paddingHorizontal: px, ...contentStyle }}>
              <Text className="text-white font-extrabold tracking-tight" style={{ fontSize: isTablet ? 26 : 22 }}>
                {t('leaderboard.title', { defaultValue: 'Leaderboard' })}
              </Text>
              <TouchableOpacity
                onPress={() => setPickerOpen(true)}
                accessibilityLabel={t('leaderboard.languagePickerLabel', { defaultValue: 'Change leaderboard language' })}
                accessibilityRole="button"
                className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800/80 border border-neutral-700/50"
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14 }}>{currentLang.flag}</Text>
                <Text className="text-white text-xs font-bold uppercase">{currentLang.code}</Text>
                <Text className="text-neutral-400 text-[10px]">▾</Text>
              </TouchableOpacity>
            </View>

            {/* Subtitle: rankings for {language} */}
            <View className="pb-2" style={{ paddingHorizontal: px, ...contentStyle }}>
              <Text className="text-neutral-500 text-xs">
                {t('leaderboard.rankingsFor', {
                  language: currentLang.label,
                  defaultValue: `Top players in ${currentLang.label}`,
                })}
              </Text>
            </View>

            {/* Search */}
            <View className="pb-3" style={{ paddingHorizontal: px, ...contentStyle }}>
              <View className="flex-row items-center bg-neutral-900 border border-neutral-800 rounded-xl px-3">
                <Text className="text-neutral-500" style={{ fontSize: 14 }}>🔍</Text>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('leaderboard.searchPlaceholder', { defaultValue: 'Search player...' })}
                  placeholderTextColor="#525252"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 text-white text-sm py-2.5 px-2"
                />
                {isSearching && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                    <Text className="text-neutral-500 text-xs">✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Podium header — hidden while searching */}
            {!isSearching && (
              <View className="items-center pb-2" style={{ paddingHorizontal: px }}>
                <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-700/40 bg-amber-950/20 mb-1">
                  <Text style={{ fontSize: 12 }}>🏆</Text>
                  <Text className="text-amber-400 font-bold text-xs uppercase tracking-widest">Top Players</Text>
                </View>
              </View>
            )}

            {/* Podium */}
            {!isSearching && top3.length > 0 && (
              <View className="pb-4" style={{ paddingHorizontal: px, ...contentStyle }}>
                <View className="flex-row items-end justify-center gap-4">
                  {podiumOrder.map((player, i) => {
                    if (!player) return null
                    const size = podiumSizes[i]
                    const medal = podiumMedalOrder[i]
                    const rankCfg = RANK_CONFIG[player.rank] ?? RANK_CONFIG.wooden
                    const isFirst = i === 1 && top3.length >= 3
                    const circleSz = isTablet ? Math.round(size.circle * 1.3) : size.circle

                    // Podium platform heights
                    const platformH = isFirst ? 56 : i === 0 ? 40 : 28

                    return (
                      <TouchableOpacity
                        key={player.id}
                        onPress={() => navigateToPlayer(player.id)}
                        className="items-center"
                        style={{ marginBottom: 0, flex: isFirst ? 1.1 : 1 }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: isFirst ? 28 : 22, marginBottom: 4 }}>{medal}</Text>
                        <View
                          className="rounded-full items-center justify-center mb-2"
                          style={{
                            width: circleSz,
                            height: circleSz,
                            backgroundColor: isFirst ? '#4c1d95' : '#1c1c1c',
                            borderWidth: 2,
                            borderColor: isFirst ? '#8b5cf6' : i === 0 ? '#92400e' : '#374151',
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
                          className="text-white font-bold text-center"
                          numberOfLines={1}
                          style={{ maxWidth: 80, fontSize: isFirst ? 13 : 11 }}
                        >
                          {player.username}
                        </Text>
                        <View className="flex-row items-center gap-0.5 mt-0.5">
                          <Text style={{ fontSize: 9 }}>{rankCfg.icon}</Text>
                          <Text
                            className="font-semibold"
                            style={{ color: rankCfg.color, fontSize: 9 }}
                          >
                            {rankCfg.label}
                          </Text>
                        </View>
                        {/* Podium base */}
                        <View
                          className={[
                            'w-full rounded-t-lg mt-2 items-center justify-center',
                            isFirst ? 'bg-violet-900/50 border border-violet-700/40' : 'bg-neutral-800/60 border border-neutral-700/40',
                          ].join(' ')}
                          style={{ height: platformH }}
                        >
                          <Text
                            className={['font-extrabold', isFirst ? 'text-violet-300' : 'text-neutral-400'].join(' ')}
                            style={{ fontSize: isFirst ? 14 : 12 }}
                          >
                            {player.rankPoints}
                          </Text>
                          <Text className="text-neutral-600" style={{ fontSize: 9 }}>LP</Text>
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Divider — hidden while searching since podium is hidden too */}
            {!isSearching && rest.length > 0 && (
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
              {isSearching
                ? t('leaderboard.noPlayerFound', { defaultValue: 'No player found' })
                : t('leaderboard.empty', { defaultValue: 'No players yet' })}
            </Text>
          </View>
        }
      />

      {/* Language picker modal */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setPickerOpen(false)}
          className="flex-1 bg-black/60 items-center justify-center"
        >
          <View
            className="bg-neutral-900 rounded-2xl border border-neutral-700 overflow-hidden"
            style={{ width: 280 }}
          >
            <View className="px-5 py-4 border-b border-neutral-800">
              <Text className="text-white font-bold text-base text-center">
                {t('leaderboard.language', { defaultValue: 'Language' })}
              </Text>
            </View>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const isSelected = item.code === locale
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setLocale(item.code)
                      setPickerOpen(false)
                    }}
                    className={`flex-row items-center gap-3 px-5 py-3.5 ${isSelected ? 'bg-violet-900/40' : ''}`}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 20 }}>{item.flag}</Text>
                    <Text className="text-white text-sm flex-1">{item.label}</Text>
                    {isSelected && <View className="w-2 h-2 rounded-full bg-violet-400" />}
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}
