import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as ImagePicker from 'expo-image-picker'
import { useAuthStore } from '../../../store/auth'
import { api } from '../../../lib/api'
import { RANK_CONFIG } from '@imposter/shared'
import type { RankTier } from '@imposter/shared'
import i18n from '../../../i18n'
import { useResponsive } from '../../../lib/responsive'

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

  const [uploadingAvatar, setUploadingAvatar] = useState(false)

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

  const pickAndUploadAvatar = async (source: 'camera' | 'library') => {
    try {
      let result: ImagePicker.ImagePickerResult
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        exif: false,
      }

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync()
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Camera access is needed to take a photo.')
          return
        }
        result = await ImagePicker.launchCameraAsync({ ...options, maxWidth: 800, maxHeight: 800 })
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Photo library access is needed to pick a photo.')
          return
        }
        result = await ImagePicker.launchImageLibraryAsync({ ...options, maxWidth: 800, maxHeight: 800 })
      }

      if (result.canceled || !result.assets?.length) return

      const uri = result.assets[0].uri
      setUploadingAvatar(true)
      try {
        const updated = await api.upload<{ avatarUrl: string }>('/users/me/avatar', uri)
        setProfile((prev) => (prev ? { ...prev, avatarUrl: updated.avatarUrl } : prev))
      } catch (err: any) {
        setError(err.message)
      } finally {
        setUploadingAvatar(false)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleAvatarPress = () => {
    Alert.alert('Profile Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: () => pickAndUploadAvatar('camera') },
      { text: 'Choose from Library', onPress: () => pickAndUploadAvatar('library') },
      ...(profile?.avatarUrl
        ? [
            {
              text: 'Remove Photo',
              style: 'destructive' as const,
              onPress: async () => {
                setUploadingAvatar(true)
                try {
                  await api.delete('/users/me/avatar')
                  setProfile((prev) => (prev ? { ...prev, avatarUrl: undefined } : prev))
                } catch (err: any) {
                  setError(err.message)
                } finally {
                  setUploadingAvatar(false)
                }
              },
            },
          ]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ])
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

  const { isTablet, px, fontScale } = useResponsive()
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
        <View style={contentStyle}>
        {/* Avatar + Name */}
        <View className="items-center pt-8 pb-4" style={{ paddingHorizontal: px + 8 }}>
          <TouchableOpacity
            onPress={handleAvatarPress}
            disabled={uploadingAvatar}
            className="mb-4"
            activeOpacity={0.8}
          >
            {/* Avatar ring */}
            <View
              className="rounded-full border-2 border-violet-600/60 p-0.5"
              style={{ width: isTablet ? 108 : 88, height: isTablet ? 108 : 88, alignItems: 'center', justifyContent: 'center' }}
            >
            <View
              className="rounded-full bg-violet-600 items-center justify-center overflow-hidden"
              style={{ width: isTablet ? 100 : 80, height: isTablet ? 100 : 80 }}
            >
              {profile.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={{ width: isTablet ? 100 : 80, height: isTablet ? 100 : 80 }}
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-white font-bold" style={{ fontSize: isTablet ? 40 : 30 }}>
                  {profile.username.charAt(0).toUpperCase()}
                </Text>
              )}
              {uploadingAvatar && (
                <View
                  className="absolute inset-0 items-center justify-center"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    width: isTablet ? 100 : 80,
                    height: isTablet ? 100 : 80,
                    borderRadius: (isTablet ? 100 : 80) / 2,
                  }}
                >
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )}
            </View>
            </View>
            {!uploadingAvatar && (
              <View
                className="absolute bottom-0 right-0 bg-violet-600 rounded-full items-center justify-center border-2 border-neutral-950"
                style={{ width: 26, height: 26 }}
              >
                <Text style={{ fontSize: 12, color: '#fff' }}>✎</Text>
              </View>
            )}
          </TouchableOpacity>

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
        <View
          className="mx-4 mb-4 rounded-2xl overflow-hidden border"
          style={{ borderColor: rankCfg.color + '40' }}
        >
          <View className="absolute inset-0" style={{ backgroundColor: rankCfg.color + '10' }} />
          <View className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: rankCfg.color + 'AA' }} />
          <View className="flex-row items-center gap-4 p-4">
            <View
              className="rounded-2xl items-center justify-center border"
              style={{
                width: isTablet ? 68 : 56,
                height: isTablet ? 68 : 56,
                backgroundColor: rankCfg.color + '20',
                borderColor: rankCfg.color + '50',
              }}
            >
              <Text style={{ fontSize: isTablet ? 36 : 28 }}>{rankCfg.icon}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-0.5">
                Current Rank
              </Text>
              <Text className="font-extrabold tracking-tight" style={{ color: rankCfg.color, fontSize: isTablet ? 24 : 20 }}>
                {rankCfg.label}
              </Text>
              <View className="flex-row items-center gap-1.5 mt-1">
                <Text className="text-neutral-300 font-bold" style={{ fontSize: 15 * fontScale }}>
                  {profile.rankPoints}
                </Text>
                <Text className="text-neutral-500 text-xs">LP</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap mb-4 gap-2" style={{ marginHorizontal: px }}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl items-center overflow-hidden"
              style={{ width: isTablet ? '23%' : '48%', padding: isTablet ? 20 : 16 }}
            >
              <View className="absolute top-0 left-0 right-0 h-0.5 bg-violet-800/50" />
              <Text className="text-white font-extrabold" style={{ fontSize: isTablet ? 32 : 26 }}>
                {stat.value}
              </Text>
              <Text className="text-neutral-500 text-xs mt-1 uppercase tracking-wider font-semibold" style={{ fontSize: 10 * fontScale }}>
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
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-3 items-center overflow-hidden"
              >
                <View className="absolute top-0 left-0 right-0 h-0.5 bg-amber-800/40" />
                <Text style={{ fontSize: isTablet ? 28 : 22, marginBottom: 4 }}>{h.icon}</Text>
                <Text className="text-white font-extrabold" style={{ fontSize: isTablet ? 24 : 20 }}>{h.count}</Text>
                <Text className="text-neutral-500 mt-0.5 text-center font-semibold uppercase tracking-wider" style={{ fontSize: 9 * fontScale }}>
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

        {/* Settings */}
        <View style={{ marginHorizontal: px, marginTop: 16 }}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile/settings')}
            className="rounded-2xl items-center border border-neutral-800 bg-neutral-900 flex-row justify-center gap-2"
            style={{ paddingVertical: isTablet ? 18 : 16 }}
          >
            <Text style={{ fontSize: 18 }}>⚙️</Text>
            <Text className="text-white font-semibold" style={{ fontSize: 15 * fontScale }}>
              {t('nav.settings', 'Settings')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <View className="mt-3" style={{ marginHorizontal: px }}>
          <TouchableOpacity
            onPress={handleSignOut}
            className="rounded-2xl items-center border border-red-900 bg-red-950/40"
            style={{ paddingVertical: isTablet ? 18 : 16 }}
          >
            <Text className="text-red-400 font-bold" style={{ fontSize: 16 * fontScale }}>
              {t('profile.signOut', 'Sign Out')}
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
