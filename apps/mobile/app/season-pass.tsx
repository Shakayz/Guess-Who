import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useResponsive } from '../lib/responsive'
import { HapticManager } from '../lib/haptics'
import { SoundManager } from '../lib/sounds'
import { api } from '../lib/api'

// Mobile mirror of the web SeasonPassPage. Uses the same /season-pass/current
// endpoint so both platforms show the exact same user state and can claim
// the same tiers.

interface SeasonTier {
  id: string
  tierNumber: number
  xpRequired: number
  rewardType: string
  rewardValue: string
  isPremium: boolean
  claimed: boolean
  unlocked: boolean
}

interface SeasonData {
  id: string
  name: string
  startDate: string
  endDate: string
  userXp: number
  tiers: SeasonTier[]
}

const REWARD_ICONS: Record<string, string> = {
  starCoins: '⭐',
  title: '🏷️',
}

export default function SeasonPassScreen() {
  const router = useRouter()
  const { px, fontScale } = useResponsive()
  const [season, setSeason] = useState<SeasonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await api.get<SeasonData | null>('/season-pass/current')
      setSeason(data)
    } catch {
      setSeason(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function claim(tier: SeasonTier) {
    if (!tier.unlocked || tier.claimed || claimingId) return
    HapticManager.medium()
    SoundManager.play('success')
    setClaimingId(tier.id)
    try {
      await api.post(`/season-pass/claim/${tier.id}`, {})
      await load()
    } catch {
      HapticManager.error()
    } finally {
      setClaimingId(null)
    }
  }

  const endDate = season ? new Date(season.endDate) : null
  const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000)) : null
  const maxXp = season?.tiers[season.tiers.length - 1]?.xpRequired ?? 1
  const progress = season ? Math.min(100, (season.userXp / Math.max(1, maxXp)) * 100) : 0

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-neutral-950">
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-900">
        <TouchableOpacity onPress={() => router.back()} className="pr-3">
          <Text className="text-neutral-400" style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold flex-1" style={{ fontSize: 16 * fontScale }}>
          Season Pass
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: px, paddingVertical: 20, paddingBottom: 48, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-2xl border border-violet-600/30 bg-neutral-900 overflow-hidden">
          <View className="h-[2] bg-violet-500/60" />
          <View className="p-6 items-center gap-2">
            <Text style={{ fontSize: 44 }}>🎫</Text>
            <Text className="text-white font-extrabold" style={{ fontSize: 24 * fontScale }}>
              Season Pass
            </Text>
            {loading ? (
              <ActivityIndicator color="#a78bfa" />
            ) : season ? (
              <>
                <Text className="text-violet-400 font-semibold" style={{ fontSize: 16 * fontScale }}>
                  {season.name}
                </Text>
                {daysLeft !== null && (
                  <Text className="text-neutral-500" style={{ fontSize: 12 * fontScale }}>
                    {daysLeft} days remaining
                  </Text>
                )}
                <View className="w-full mt-3 gap-1">
                  <View className="flex-row justify-between">
                    <Text className="text-neutral-500" style={{ fontSize: 10 * fontScale }}>
                      {season.userXp} XP
                    </Text>
                    <Text className="text-neutral-500" style={{ fontSize: 10 * fontScale }}>
                      {maxXp} XP max
                    </Text>
                  </View>
                  <View className="h-2 rounded-full bg-neutral-800 overflow-hidden">
                    <View className="h-full rounded-full bg-violet-600" style={{ width: `${progress}%` }} />
                  </View>
                </View>
              </>
            ) : (
              <Text className="text-neutral-500 text-center" style={{ fontSize: 12 * fontScale }}>
                No active season right now. Come back soon!
              </Text>
            )}
          </View>
        </View>

        {season?.tiers?.length ? (
          <View className="gap-2">
            <Text className="text-neutral-500 font-semibold uppercase tracking-widest" style={{ fontSize: 10 * fontScale }}>
              Tiers
            </Text>
            {season.tiers.map((tier) => (
              <View
                key={tier.id}
                className={[
                  'flex-row items-center gap-3 px-3 py-3 rounded-xl border',
                  tier.claimed
                    ? 'bg-emerald-950/30 border-emerald-800/40'
                    : tier.unlocked
                      ? 'bg-violet-950/30 border-violet-700/40'
                      : 'bg-neutral-900 border-neutral-800',
                ].join(' ')}
              >
                <View className="items-center justify-center w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700">
                  <Text className="text-white font-bold" style={{ fontSize: 12 * fontScale }}>
                    {tier.tierNumber}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold" style={{ fontSize: 13 * fontScale }}>
                    {REWARD_ICONS[tier.rewardType] ?? '🎁'} {tier.rewardValue}
                  </Text>
                  <Text className="text-neutral-500" style={{ fontSize: 11 * fontScale }}>
                    {tier.xpRequired} XP · {tier.isPremium ? 'Premium' : 'Free'}
                  </Text>
                </View>
                {tier.claimed ? (
                  <Text className="text-emerald-400 font-bold" style={{ fontSize: 11 * fontScale }}>
                    CLAIMED
                  </Text>
                ) : tier.unlocked ? (
                  <TouchableOpacity
                    onPress={() => claim(tier)}
                    disabled={claimingId === tier.id}
                    className="px-3 py-1.5 rounded-lg bg-violet-600"
                    activeOpacity={0.8}
                  >
                    {claimingId === tier.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-white font-semibold" style={{ fontSize: 11 * fontScale }}>
                        Claim
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text className="text-neutral-600 font-semibold" style={{ fontSize: 11 * fontScale }}>
                    🔒
                  </Text>
                )}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}
