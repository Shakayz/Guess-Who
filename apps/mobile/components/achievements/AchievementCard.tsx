import React, { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native'
import { useTranslation } from 'react-i18next'

export interface AchievementCardData {
  id: string
  key: string
  name: string
  description: string
  icon: string
  category: string
  difficulty: string
  xpReward: number
  coinReward: number
  starsReward: number
  isSecret?: boolean
  unlocked: boolean
  unlockedAt: string | null
  claimed: boolean
  claimedAt: string | null
}

interface Props {
  achievement: AchievementCardData
  onClaim: (key: string) => void
  isClaiming: boolean
  isTablet: boolean
  fontScale: number
  /**
   * When this changes to the card's `key`, the card briefly plays a burst
   * animation (scale + glow) to celebrate a successful claim.
   */
  burstKey: string | null
}

const DIFFICULTY_BORDER: Record<string, string> = {
  bronze: 'border-amber-700/60 bg-amber-950/30',
  silver: 'border-neutral-400/60 bg-neutral-800/40',
  gold: 'border-yellow-500/60 bg-yellow-950/30',
  platinum: 'border-cyan-400/60 bg-cyan-950/30',
  diamond: 'border-sky-300/60 bg-sky-950/40',
  mythic: 'border-fuchsia-500/60 bg-fuchsia-950/30',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  bronze: 'text-amber-400',
  silver: 'text-neutral-300',
  gold: 'text-yellow-300',
  platinum: 'text-cyan-300',
  diamond: 'text-sky-200',
  mythic: 'text-fuchsia-300',
}

export function AchievementCard({ achievement: a, onClaim, isClaiming, isTablet, fontScale, burstKey }: Props) {
  const { t } = useTranslation()
  const state: 'locked' | 'unclaimed' | 'claimed' =
    !a.unlocked ? 'locked' : a.claimed ? 'claimed' : 'unclaimed'

  const scale = useRef(new Animated.Value(1)).current
  const glow = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (burstKey === a.key) {
      scale.setValue(0.92)
      glow.setValue(0)
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.06, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 220, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
      ]).start()
    }
  }, [burstKey])

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        opacity: state === 'locked' ? 0.55 : 1,
      }}
      className={[
        'relative overflow-hidden rounded-2xl border',
        DIFFICULTY_BORDER[a.difficulty] ?? 'border-neutral-700 bg-neutral-900',
      ].join(' ')}
    >
      {/* Glow overlay during burst */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(251,191,36,0.35)',
          opacity: glow,
        }}
      />

      <View style={{ padding: isTablet ? 16 : 12 }}>
        {/* Claimed badge */}
        {state === 'claimed' && (
          <View className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
            <Text className="text-emerald-300 font-bold" style={{ fontSize: 9 * fontScale }}>
              ✓ {t('achievements.claimed', { defaultValue: 'Claimed' })}
            </Text>
          </View>
        )}

        <View className="flex-row items-start gap-3">
          <View
            className={[
              'rounded-xl items-center justify-center',
              state === 'locked' ? 'bg-neutral-800/60' : 'bg-neutral-900/60',
            ].join(' ')}
            style={{ width: isTablet ? 56 : 48, height: isTablet ? 56 : 48 }}
          >
            <Text style={{ fontSize: isTablet ? 30 : 26 }}>
              {state === 'locked' && a.isSecret ? '🔒' : a.icon}
            </Text>
          </View>

          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-2 flex-wrap">
              <Text
                className="text-white font-semibold flex-shrink"
                style={{ fontSize: 13 * fontScale }}
                numberOfLines={1}
              >
                {a.name}
              </Text>
              <Text
                className={['font-bold uppercase tracking-wider', DIFFICULTY_LABEL[a.difficulty] ?? 'text-neutral-400'].join(' ')}
                style={{ fontSize: 9 * fontScale }}
              >
                {a.difficulty}
              </Text>
            </View>
            <Text
              className="text-neutral-400 mt-0.5"
              style={{ fontSize: 11 * fontScale, lineHeight: 14 * fontScale }}
              numberOfLines={2}
            >
              {a.description}
            </Text>
            <View className="flex-row items-center gap-3 mt-1.5">
              <Text className="text-amber-300 font-semibold" style={{ fontSize: 11 * fontScale }}>
                ⭐ {a.starsReward}
              </Text>
              <Text className="text-violet-300 font-semibold" style={{ fontSize: 11 * fontScale }}>
                ✨ {a.xpReward} XP
              </Text>
            </View>
          </View>
        </View>

        {state === 'unclaimed' && (
          <TouchableOpacity
            onPress={() => onClaim(a.key)}
            disabled={isClaiming}
            className="mt-3 rounded-xl items-center justify-center bg-amber-500"
            style={{ paddingVertical: isTablet ? 11 : 9, opacity: isClaiming ? 0.6 : 1 }}
            activeOpacity={0.8}
          >
            {isClaiming ? (
              <ActivityIndicator color="#1c1917" size="small" />
            ) : (
              <Text className="text-neutral-900 font-extrabold" style={{ fontSize: 13 * fontScale }}>
                {t('achievements.claim', { defaultValue: 'Claim' })} +{a.starsReward}⭐
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  )
}
