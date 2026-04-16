import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { api } from '../../../lib/api'
import { RANK_CONFIG } from '@red-handed/shared'
import type { RankTier } from '@red-handed/shared'
import { useResponsive } from '../../../lib/responsive'

const REPORT_REASONS = [
  { value: 'cheating', label: '🚫 Cheating' },
  { value: 'harassment', label: '😡 Harassment' },
  { value: 'hate_speech', label: '🔞 Hate Speech' },
  { value: 'inappropriate_name', label: '🏷️ Inappropriate Name' },
  { value: 'spam', label: '📢 Spam' },
  { value: 'other', label: '❓ Other' },
]

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
  const [blocked, setBlocked] = useState(false)
  const [blockLoading, setBlockLoading] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportDone, setReportDone] = useState(false)

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

  const handleBlock = async () => {
    if (!userId || blocked) return
    Alert.alert(
      'Block Player',
      `Block ${profile?.username}? They won't be able to join your rooms or send you messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setBlockLoading(true)
            try {
              await api.post(`/users/${userId}/block`, {})
              setBlocked(true)
            } catch (err: any) {
              setError(err.message)
            } finally {
              setBlockLoading(false)
            }
          },
        },
      ]
    )
  }

  const handleReport = async () => {
    if (!userId || !reportReason) return
    setReportLoading(true)
    try {
      await api.post(`/users/${userId}/report`, {
        reason: reportReason,
        details: reportDetails.trim() || undefined,
      })
      setReportDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setReportLoading(false)
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
          <View
            className="rounded-full bg-violet-600 items-center justify-center mb-4 overflow-hidden"
            style={{ width: isTablet ? 100 : 80, height: isTablet ? 100 : 80 }}
          >
            {profile.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={{ width: isTablet ? 100 : 80, height: isTablet ? 100 : 80 }}
                resizeMode="cover"
              />
            ) : (
              <Text className="text-white text-3xl font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </Text>
            )}
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

        {/* Block / Report actions */}
        <View className="mt-3 flex-row gap-2" style={{ marginHorizontal: px }}>
          <TouchableOpacity
            onPress={() => { setShowReportModal(true); setReportDone(false); setReportReason(''); setReportDetails('') }}
            className="flex-1 py-3 rounded-2xl border border-neutral-700 bg-neutral-800 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-neutral-400 font-semibold text-sm">🚨 Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleBlock}
            disabled={blocked || blockLoading}
            className={[
              'flex-1 py-3 rounded-2xl border items-center',
              blocked ? 'border-emerald-800/50 bg-emerald-950/30' : 'border-red-900/50 bg-red-950/30',
              (blocked || blockLoading) ? 'opacity-60' : '',
            ].join(' ')}
            activeOpacity={0.8}
          >
            {blockLoading ? (
              <ActivityIndicator size="small" color="#f87171" />
            ) : (
              <Text className={blocked ? 'text-emerald-400 font-semibold text-sm' : 'text-red-400 font-semibold text-sm'}>
                {blocked ? '✅ Blocked' : '🚫 Block'}
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

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-neutral-950 border border-neutral-800 rounded-t-3xl px-5 pt-5 pb-8">
            {/* Handle bar */}
            <View className="w-10 h-1 rounded-full bg-neutral-700 self-center mb-4" />

            {reportDone ? (
              <View className="items-center py-6 gap-3">
                <Text style={{ fontSize: 48 }}>✅</Text>
                <Text className="text-white font-bold text-lg">Report Submitted</Text>
                <Text className="text-neutral-400 text-sm text-center">
                  Thank you. We'll review this report and take appropriate action.
                </Text>
                <TouchableOpacity
                  onPress={() => setShowReportModal(false)}
                  className="mt-2 px-8 py-3 rounded-2xl bg-violet-600"
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-bold">Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-white font-bold text-lg">Report {profile?.username}</Text>
                  <TouchableOpacity onPress={() => setShowReportModal(false)}>
                    <Text className="text-neutral-400 text-2xl">×</Text>
                  </TouchableOpacity>
                </View>

                <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">
                  Reason *
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {REPORT_REASONS.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      onPress={() => setReportReason(r.value)}
                      className={[
                        'px-3 py-2 rounded-xl border',
                        reportReason === r.value
                          ? 'border-red-700/60 bg-red-950/50'
                          : 'border-neutral-700 bg-neutral-800',
                      ].join(' ')}
                      activeOpacity={0.75}
                    >
                      <Text className={reportReason === r.value ? 'text-red-300 text-sm font-medium' : 'text-neutral-400 text-sm'}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">
                  Details (optional)
                </Text>
                <TextInput
                  value={reportDetails}
                  onChangeText={(v) => setReportDetails(v.slice(0, 500))}
                  placeholder="Describe what happened..."
                  placeholderTextColor="#525252"
                  multiline
                  numberOfLines={3}
                  className="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm mb-4"
                  style={{ height: 80, textAlignVertical: 'top' }}
                />

                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setShowReportModal(false)}
                    className="flex-1 py-3.5 rounded-2xl border border-neutral-700 bg-neutral-800 items-center"
                    activeOpacity={0.8}
                  >
                    <Text className="text-neutral-400 font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleReport}
                    disabled={!reportReason || reportLoading}
                    className={[
                      'flex-1 py-3.5 rounded-2xl items-center',
                      !reportReason || reportLoading ? 'bg-red-900/50 opacity-50' : 'bg-red-700',
                    ].join(' ')}
                    activeOpacity={0.8}
                  >
                    {reportLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-white font-bold">Submit Report</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
