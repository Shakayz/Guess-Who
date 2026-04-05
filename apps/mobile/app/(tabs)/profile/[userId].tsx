import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { api } from '../../../lib/api'
import { RANK_CONFIG } from '@imposter/shared'
import type { RankTier } from '@imposter/shared'
import { useResponsive } from '../../../lib/responsive'

interface PlayerProfile {
  id: string
  username: string
  avatarUrl?: string
  rank: RankTier
  rankPoints: number
  gamesPlayed: number
  wins: number
  losses: number
}

export default function PlayerProfileScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { userId } = useLocalSearchParams<{ userId: string }>()

  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [friendRequested, setFriendRequested] = useState(false)
  const [sendingRequest, setSendingRequest] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<PlayerProfile>(`/users/${userId}/profile`)
      setProfile(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleAddFriend = async () => {
    if (!userId || friendRequested) return
    setSendingRequest(true)
    try {
      await api.post('/friends/request', { toUserId: userId })
      setFriendRequested(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSendingRequest(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950 items-center justify-center">
        <ActivityIndicator size="large" color="#8b5cf6" />
      </SafeAreaView>
    )
  }

  if (error && !profile) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950 items-center justify-center px-6">
        <Text className="text-red-400 text-sm text-center mb-4">{error}</Text>
        <TouchableOpacity
          onPress={fetchProfile}
          className="bg-violet-600 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const { isTablet, px } = useResponsive()
  const contentStyle = isTablet ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const } : {}

  if (!profile) return null

  const rankCfg = RANK_CONFIG[profile.rank] ?? RANK_CONFIG.wooden
  const winRate =
    profile.gamesPlayed > 0
      ? Math.round((profile.wins / profile.gamesPlayed) * 100)
      : 0

  const stats = [
    { label: t('profile.gamesPlayed', 'Games'), value: profile.gamesPlayed },
    { label: t('profile.wins', 'Wins'), value: profile.wins },
    { label: t('profile.losses', 'Losses'), value: profile.losses },
    { label: t('profile.winRate', 'Win %'), value: `${winRate}%` },
  ]

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={contentStyle}>
        {/* Avatar + Name */}
        <View className="items-center pt-8 pb-4" style={{ paddingHorizontal: px + 8 }}>
          <View className="rounded-full bg-violet-600 items-center justify-center mb-4" style={{ width: isTablet ? 100 : 80, height: isTablet ? 100 : 80 }}>
            <Text className="text-white text-3xl font-bold">
              {profile.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-white text-xl font-bold">
            {profile.username}
          </Text>
        </View>

        {/* Rank */}
        <View className="mb-4 p-4 rounded-2xl border border-neutral-800 bg-neutral-900 items-center" style={{ marginHorizontal: px }}>
          <Text className="text-3xl mb-1">{rankCfg.icon}</Text>
          <Text className="text-lg font-bold" style={{ color: rankCfg.color }}>
            {rankCfg.label}
          </Text>
          <Text className="text-neutral-400 text-sm mt-1">
            {profile.rankPoints} LP
          </Text>
        </View>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap mb-4 gap-2" style={{ marginHorizontal: px }}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl items-center"
              style={{ width: isTablet ? '23%' : '48%', padding: isTablet ? 20 : 16 }}
            >
              <Text className="text-white text-2xl font-bold">
                {stat.value}
              </Text>
              <Text className="text-neutral-500 text-xs mt-1">
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Add Friend */}
        <View className="mt-4" style={{ marginHorizontal: px }}>
          <TouchableOpacity
            onPress={handleAddFriend}
            disabled={friendRequested || sendingRequest}
            className={[
              'py-4 rounded-2xl items-center',
              friendRequested
                ? 'bg-neutral-800 border border-neutral-700'
                : 'bg-violet-600',
              sendingRequest ? 'opacity-50' : '',
            ].join(' ')}
          >
            {sendingRequest ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">
                {friendRequested
                  ? t('profile.requestSent', 'Request Sent')
                  : t('profile.addFriend', 'Add Friend')}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error && (
          <View className="mt-4 flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800" style={{ marginHorizontal: px }}>
            <Text className="text-red-400 text-sm">{error}</Text>
          </View>
        )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
