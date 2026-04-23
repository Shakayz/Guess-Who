import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useResponsive } from '../lib/responsive'
import { HapticManager } from '../lib/haptics'
import { SoundManager } from '../lib/sounds'
import { api } from '../lib/api'

// Mobile mirror of the web PremiumPage. Keeps perk list + pricing in lockstep
// with the web version so promotional copy never drifts.

const PERKS = [
  { icon: '🚫', title: 'No Ads', desc: 'Completely ad-free experience, always.' },
  { icon: '♾️', title: 'Unlimited Games', desc: 'Play as many games as you want, no daily limits.' },
  { icon: '🎭', title: 'All Word Categories', desc: 'Access every category including Mangas, Célébrités, Mix and more.' },
  { icon: '🏆', title: 'Ranked Priority', desc: 'Faster matchmaking in ranked mode.' },
  { icon: '👑', title: 'Premium Badge', desc: 'Exclusive badge on your profile and in lobbies.' },
]

type Me = { id: string; isPremium?: boolean; premiumUntil?: string | null }

export default function PremiumScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { px, fontScale, isTablet } = useResponsive()

  const { data: me } = useQuery<Me>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<Me>('/auth/me'),
    retry: false,
  })

  const isPremium = !!me?.isPremium
  const renewalDate = me?.premiumUntil ? new Date(me.premiumUntil) : null

  const checkout = useMutation({
    mutationFn: (planId: 'monthly' | 'yearly') =>
      api.post<{ url: string }>(`/shop/premium/checkout/${planId}`, {}),
    onSuccess: ({ url }) => { if (url) Linking.openURL(url) },
    onError: (err: any) => Alert.alert('Checkout failed', err?.message ?? 'Please try again.'),
  })

  const portal = useMutation({
    mutationFn: () => api.post<{ url: string }>('/shop/premium/portal', {}),
    onSuccess: ({ url }) => { if (url) Linking.openURL(url) },
    onError: (err: any) => Alert.alert('Portal unavailable', err?.message ?? 'Please try again.'),
  })

  const handleSubscribe = (plan: 'monthly' | 'yearly') => {
    HapticManager.medium()
    SoundManager.play('success')
    checkout.mutate(plan)
  }
  const handleManage = () => {
    HapticManager.light()
    SoundManager.play('click')
    portal.mutate()
  }

  const busy = checkout.isPending || portal.isPending

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-neutral-950">
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-900">
        <TouchableOpacity
          onPress={() => {
            queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
            router.back()
          }}
          className="pr-3"
        >
          <Text className="text-neutral-400" style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold flex-1" style={{ fontSize: 16 * fontScale }}>
          Go Premium
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: px, paddingVertical: 24, paddingBottom: 48, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center gap-3">
          <View
            className="items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10"
            style={{ width: isTablet ? 72 : 64, height: isTablet ? 72 : 64 }}
          >
            <Text style={{ fontSize: 32 }}>👑</Text>
          </View>
          <Text className="text-white font-extrabold" style={{ fontSize: (isTablet ? 28 : 24) * fontScale }}>
            {isPremium ? 'You are Premium' : 'Go Premium'}
          </Text>
          <Text className="text-neutral-400 text-center" style={{ fontSize: 13 * fontScale }}>
            {isPremium && renewalDate
              ? `Renews ${renewalDate.toLocaleDateString()}`
              : 'The best way to play Red Handed !'}
          </Text>
        </View>

        <View className="rounded-2xl border border-amber-500/30 bg-neutral-900/80 overflow-hidden">
          <View className="h-[2] bg-amber-500/60" />
          <View className="p-5 gap-5">
            {!isPremium && (
              <>
                <View className="flex-row gap-3">
                  <View className="flex-1 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 items-center">
                    <Text className="text-white font-extrabold" style={{ fontSize: 22 * fontScale }}>1€</Text>
                    <Text className="text-neutral-400" style={{ fontSize: 11 * fontScale }}>/ month</Text>
                  </View>
                  <View className="flex-1 rounded-xl border border-amber-500/60 bg-amber-500/10 p-3 items-center">
                    <View className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-amber-950/80">
                      <Text className="text-amber-400 font-bold" style={{ fontSize: 9 }}>BEST VALUE</Text>
                    </View>
                    <Text className="text-white font-extrabold" style={{ fontSize: 22 * fontScale }}>10€</Text>
                    <Text className="text-neutral-400" style={{ fontSize: 11 * fontScale }}>/ year</Text>
                    <Text className="text-emerald-400 font-semibold mt-0.5" style={{ fontSize: 10 * fontScale }}>
                      Save 2 months free
                    </Text>
                  </View>
                </View>
                <Text className="text-neutral-600 text-center" style={{ fontSize: 11 * fontScale }}>
                  Cancel anytime
                </Text>
              </>
            )}

            <View className="gap-3">
              {PERKS.map((p) => (
                <View key={p.title} className="flex-row gap-3">
                  <Text style={{ fontSize: 20 }}>{p.icon}</Text>
                  <View className="flex-1">
                    <Text className="text-white font-semibold" style={{ fontSize: 13 * fontScale }}>
                      {p.title}
                    </Text>
                    <Text className="text-neutral-500 mt-0.5" style={{ fontSize: 11 * fontScale, lineHeight: 16 * fontScale }}>
                      {p.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View className="gap-2">
              {isPremium ? (
                <TouchableOpacity
                  onPress={handleManage}
                  disabled={busy}
                  className="rounded-xl bg-amber-500 items-center"
                  style={{ paddingVertical: 13, opacity: busy ? 0.6 : 1 }}
                  activeOpacity={0.85}
                >
                  {busy ? (
                    <ActivityIndicator color="#171717" />
                  ) : (
                    <Text className="text-neutral-900 font-bold" style={{ fontSize: 15 * fontScale }}>
                      Manage subscription
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => handleSubscribe('yearly')}
                    disabled={busy}
                    className="rounded-xl bg-amber-500 items-center"
                    style={{ paddingVertical: 13, opacity: busy ? 0.6 : 1 }}
                    activeOpacity={0.85}
                  >
                    {busy ? (
                      <ActivityIndicator color="#171717" />
                    ) : (
                      <Text className="text-neutral-900 font-bold" style={{ fontSize: 15 * fontScale }}>
                        Subscribe — 10€/year
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleSubscribe('monthly')}
                    disabled={busy}
                    className="rounded-xl bg-neutral-800 border border-neutral-700 items-center"
                    style={{ paddingVertical: 11, opacity: busy ? 0.6 : 1 }}
                    activeOpacity={0.8}
                  >
                    <Text className="text-white font-semibold" style={{ fontSize: 13 * fontScale }}>
                      Monthly — 1€/month
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <Text className="text-neutral-600 text-center" style={{ fontSize: 10 * fontScale }}>
              Secure payment · No commitments · Cancel anytime
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
