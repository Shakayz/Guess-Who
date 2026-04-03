import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../../store/auth'
import { api } from '../../../lib/api'
import { RANK_CONFIG } from '@imposter/shared'
import type { RankTier } from '@imposter/shared'
import i18n from '../../../i18n'

interface UserProfile {
  id: string
  username: string
  email?: string
  avatarUrl?: string
  rank: RankTier
  rankPoints: number
  honorPoints: number
  starCoins: number
  honors: {
    teamplayer: number
    sharp_mind: number
    good_sport: number
  }
  gamesPlayed: number
  wins: number
  losses: number
}

interface Achievement {
  id: string
  key: string
  name: string
  description: string
  icon: string
  unlockedAt: string
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Francais' },
  { code: 'ar', label: 'Arabic' },
  { code: 'es', label: 'Espanol' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Portugues' },
  { code: 'zh', label: 'Chinese' },
] as const

export default function ProfileScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [savingName, setSavingName] = useState(false)

  const currentLangIndex = LANGUAGES.findIndex((l) => l.code === i18n.language)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [me, achList] = await Promise.all([
        api.get<UserProfile>('/auth/me'),
        api.get<Achievement[]>('/achievements'),
      ])
      setProfile(me)
      setAchievements(achList)
      setDraftName(me.username)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSaveName = async () => {
    const trimmed = draftName.trim()
    if (!trimmed || trimmed === profile?.username) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    try {
      await api.patch('/users/me', { username: trimmed })
      setProfile((prev) => (prev ? { ...prev, username: trimmed } : prev))
      setEditingName(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingName(false)
    }
  }

  const cycleLanguage = () => {
    const nextIndex = (currentLangIndex + 1) % LANGUAGES.length
    i18n.changeLanguage(LANGUAGES[nextIndex].code)
  }

  const handleSignOut = () => {
    clearAuth()
    router.replace('/auth')
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
          onPress={fetchData}
          className="bg-violet-600 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

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

  const honors = [
    { icon: '🤝', label: t('profile.teamPlayer', 'Team Player'), count: profile.honors.teamplayer },
    { icon: '🧠', label: t('profile.sharpMind', 'Sharp Mind'), count: profile.honors.sharp_mind },
    { icon: '🏅', label: t('profile.goodSport', 'Good Sport'), count: profile.honors.good_sport },
  ]

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + Name */}
        <View className="items-center pt-8 pb-4 px-6">
          {profile.avatarUrl ? (
            <View className="w-20 h-20 rounded-full bg-violet-600 items-center justify-center mb-4 overflow-hidden">
              <Text className="text-white text-3xl font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          ) : (
            <View className="w-20 h-20 rounded-full bg-violet-600 items-center justify-center mb-4">
              <Text className="text-white text-3xl font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {editingName ? (
            <View className="flex-row items-center gap-2">
              <TextInput
                className="bg-neutral-800 text-white px-4 py-2 rounded-xl border border-neutral-700 text-center text-lg font-semibold min-w-[160px]"
                value={draftName}
                onChangeText={setDraftName}
                autoFocus
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <TouchableOpacity
                onPress={handleSaveName}
                disabled={savingName}
                className="bg-violet-600 px-4 py-2 rounded-xl"
              >
                {savingName ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-sm">Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setEditingName(false)
                  setDraftName(profile.username)
                }}
                className="px-3 py-2"
              >
                <Text className="text-neutral-500 text-sm">Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setEditingName(true)}
              className="flex-row items-center gap-2"
            >
              <Text className="text-white text-xl font-bold">
                {profile.username}
              </Text>
              <Text className="text-neutral-500 text-sm">Edit</Text>
            </TouchableOpacity>
          )}

          {profile.email && (
            <Text className="text-neutral-500 text-sm mt-1">
              {profile.email}
            </Text>
          )}
        </View>

        {/* Rank */}
        <View className="mx-4 mb-4 p-4 rounded-2xl border border-neutral-800 bg-neutral-900 items-center">
          <Text className="text-3xl mb-1">{rankCfg.icon}</Text>
          <Text className="text-lg font-bold" style={{ color: rankCfg.color }}>
            {rankCfg.label}
          </Text>
          <Text className="text-neutral-400 text-sm mt-1">
            {profile.rankPoints} LP
          </Text>
        </View>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap mx-4 mb-4 gap-2">
          {stats.map((stat) => (
            <View
              key={stat.label}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 items-center"
              style={{ width: '48%' }}
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

        {/* Honor Badges */}
        <View className="mx-4 mb-4">
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
            {t('profile.honors', 'Honor Badges')}
          </Text>
          <View className="flex-row gap-2">
            {honors.map((h) => (
              <View
                key={h.label}
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-3 items-center"
              >
                <Text className="text-2xl mb-1">{h.icon}</Text>
                <Text className="text-white font-bold text-lg">{h.count}</Text>
                <Text className="text-neutral-500 text-[10px] mt-0.5 text-center">
                  {h.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Achievements */}
        {achievements.length > 0 && (
          <View className="mx-4 mb-4">
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
              {t('profile.achievements', 'Achievements')}
            </Text>
            <View className="gap-2">
              {achievements.map((ach) => (
                <View
                  key={ach.id}
                  className="flex-row items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-2xl p-4"
                >
                  <Text className="text-2xl">{ach.icon}</Text>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-sm">
                      {ach.name}
                    </Text>
                    <Text className="text-neutral-500 text-xs mt-0.5">
                      {ach.description}
                    </Text>
                  </View>
                  <Text className="text-neutral-600 text-[10px]">
                    {new Date(ach.unlockedAt).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Language Switcher */}
        <View className="mx-4 mb-4">
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
            {t('profile.language', 'Language')}
          </Text>
          <TouchableOpacity
            onPress={cycleLanguage}
            className="flex-row items-center justify-between bg-neutral-900 border border-neutral-800 rounded-2xl p-4"
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-lg">🌐</Text>
              <Text className="text-white font-semibold">
                {LANGUAGES[currentLangIndex >= 0 ? currentLangIndex : 0].label}
              </Text>
            </View>
            <Text className="text-neutral-500 text-sm">Tap to change</Text>
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error && (
          <View className="mx-4 mb-4 flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800">
            <Text className="text-red-400 text-sm">{error}</Text>
          </View>
        )}

        {/* Sign Out */}
        <View className="mx-4 mt-4">
          <TouchableOpacity
            onPress={handleSignOut}
            className="py-4 rounded-2xl items-center border border-red-900 bg-red-950/40"
          >
            <Text className="text-red-400 font-bold text-base">
              {t('profile.signOut', 'Sign Out')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
