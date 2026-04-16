import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useResponsive } from '../lib/responsive'
import { HapticManager } from '../lib/haptics'
import { SoundManager } from '../lib/sounds'

// Mobile mirror of the web ShopPage. Cosmetics were removed from the game
// design (no avatar to attach them to), so the shop now only carries the
// gold-coin packs and the season pass.

type Tab = 'coins' | 'season'

const SEASON_PERKS = [
  '⚡ 1.5× XP boost on all games',
  '💰 +50 Gold Coins per month',
  '🌟 Access to Premium Word Packs',
  '🏆 Season-exclusive title: "The Strategist"',
]

function TabButton({
  active,
  onPress,
  label,
  fontScale,
}: {
  active: boolean
  onPress: () => void
  label: string
  fontScale: number
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={[
        'px-4 py-2 rounded-lg',
        active ? 'bg-violet-600' : 'bg-neutral-900 border border-neutral-800',
      ].join(' ')}
      activeOpacity={0.8}
    >
      <Text
        className={active ? 'text-white font-semibold' : 'text-neutral-400 font-semibold'}
        style={{ fontSize: 12 * fontScale }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

export default function ShopScreen() {
  const router = useRouter()
  const { px, fontScale, isTablet } = useResponsive()
  const [tab, setTab] = useState<Tab>('coins')

  const switchTab = (next: Tab) => {
    HapticManager.selection()
    setTab(next)
  }

  const buy = () => {
    HapticManager.medium()
    SoundManager.play('success')
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-neutral-950">
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-900">
        <TouchableOpacity onPress={() => router.back()} className="pr-3">
          <Text className="text-neutral-400" style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold flex-1" style={{ fontSize: 16 * fontScale }}>
          Shop
        </Text>
        <View className="flex-row gap-2">
          <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 border border-neutral-700">
            <Text style={{ fontSize: 12 }}>⭐</Text>
            <Text className="text-white font-semibold" style={{ fontSize: 12 * fontScale }}>
              100
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-800/50">
            <Text style={{ fontSize: 12 }}>💰</Text>
            <Text className="text-amber-400 font-semibold" style={{ fontSize: 12 * fontScale }}>
              0
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: px, paddingVertical: 20, paddingBottom: 48, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className="text-white font-extrabold" style={{ fontSize: (isTablet ? 28 : 22) * fontScale }}>
            Shop
          </Text>
          <Text className="text-neutral-500 mt-1" style={{ fontSize: 12 * fontScale }}>
            Coins & season pass
          </Text>
        </View>

        <View className="flex-row gap-2">
          <TabButton active={tab === 'coins'} onPress={() => switchTab('coins')} label="💰 Gold Coins" fontScale={fontScale} />
          <TabButton active={tab === 'season'} onPress={() => switchTab('season')} label="👑 Season" fontScale={fontScale} />
        </View>

        {tab === 'coins' && (
          <View className="gap-4">
            <Text className="text-neutral-500 font-semibold uppercase tracking-widest" style={{ fontSize: 10 * fontScale }}>
              Gold Coin Packs
            </Text>
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 items-center gap-2">
              <Text style={{ fontSize: 28 }}>💰</Text>
              <Text className="text-neutral-300 font-semibold text-center" style={{ fontSize: 13 * fontScale }}>
                Gold Coin packs are launching soon.
              </Text>
              <Text className="text-neutral-500 text-center" style={{ fontSize: 11 * fontScale, lineHeight: 16 * fontScale }}>
                Gold Coins will be used for premium word packs.
              </Text>
            </View>
          </View>
        )}

        {tab === 'season' && (
          <View className="rounded-2xl border border-violet-600/40 bg-neutral-900 overflow-hidden">
            <View className="h-[2] bg-violet-500/60" />
            <View className="p-5 gap-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-violet-400 font-semibold uppercase tracking-widest" style={{ fontSize: 10 * fontScale }}>
                    Season 1
                  </Text>
                  <Text className="text-white font-extrabold mt-1" style={{ fontSize: 22 * fontScale }}>
                    Season Pass
                  </Text>
                  <Text className="text-neutral-400 mt-1" style={{ fontSize: 12 * fontScale }}>
                    Unlock exclusive rewards every month
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-white font-extrabold" style={{ fontSize: 22 * fontScale }}>
                    $4.99
                  </Text>
                  <Text className="text-neutral-500" style={{ fontSize: 10 * fontScale }}>
                    per month
                  </Text>
                </View>
              </View>
              <View className="gap-2">
                {SEASON_PERKS.map((perk) => (
                  <View key={perk} className="flex-row items-center gap-2">
                    <Text className="text-emerald-400" style={{ fontSize: 14 }}>✓</Text>
                    <Text className="text-neutral-300 flex-1" style={{ fontSize: 12 * fontScale }}>
                      {perk}
                    </Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                onPress={buy}
                className="rounded-xl bg-violet-600 items-center"
                style={{ paddingVertical: 12 }}
                activeOpacity={0.85}
              >
                <Text className="text-white font-bold" style={{ fontSize: 14 * fontScale }}>
                  Subscribe — $4.99/mo
                </Text>
              </TouchableOpacity>
              <Text className="text-neutral-600 text-center" style={{ fontSize: 10 * fontScale }}>
                Cancel anytime. No commitments.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
