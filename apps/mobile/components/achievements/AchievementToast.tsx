import React, { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSocialStore, type AchievementToast as ToastData } from '../../store/social'

const DIFFICULTY_BORDER: Record<string, string> = {
  bronze: 'border-amber-500/60',
  silver: 'border-slate-300/60',
  gold: 'border-yellow-400/70',
  platinum: 'border-cyan-300/70',
  diamond: 'border-sky-300/80',
  mythic: 'border-fuchsia-400/90',
}

/**
 * Renders a stack of dismissible achievement-unlock toasts from the social
 * store. Each toast auto-dismisses after 6 seconds, or earlier when tapped.
 * Tapping the body navigates to the achievements page so the user can claim.
 */
export function AchievementToastBanner() {
  const toasts = useSocialStore((s) => s.achievementToasts)
  if (toasts.length === 0) return null
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 80,
        right: 12,
        left: 12,
        zIndex: 60,
        gap: 8,
      }}
    >
      {toasts.map((toast, i) => (
        <AchievementToastItem key={toast.id} toast={toast} index={i} />
      ))}
    </View>
  )
}

const DIFFICULTY_GLOW: Record<string, string> = {
  bronze:   'rgba(217,119,6,0.55)',
  silver:   'rgba(203,213,225,0.5)',
  gold:     'rgba(250,204,21,0.6)',
  platinum: 'rgba(103,232,249,0.6)',
  diamond:  'rgba(125,211,252,0.7)',
  mythic:   'rgba(232,121,249,0.75)',
}

function AchievementToastItem({ toast, index }: { toast: ToastData; index: number }) {
  const { t } = useTranslation()
  const router = useRouter()
  const dismiss = useSocialStore((s) => s.dismissAchievementToast)

  // Bouncy entrance: slide + scale + opacity
  const slide   = useRef(new Animated.Value(-28)).current
  const opacity = useRef(new Animated.Value(0)).current
  const scale   = useRef(new Animated.Value(0.85)).current

  // Ambient glow pulse (loops for the toast's lifetime)
  const glow    = useRef(new Animated.Value(0)).current

  // Shimmer that sweeps across the card once right after entrance
  const shimmer = useRef(new Animated.Value(-1)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: 420,
        delay: index * 70,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        delay: index * 70,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 120,
        delay: index * 70,
        useNativeDriver: true,
      }),
    ]).start()

    // Shimmer sweep once after entrance completes
    const shimmerTimer = setTimeout(() => {
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 900,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start()
    }, index * 70 + 500)

    // Ambient glow loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start()

    const timer = setTimeout(() => dismiss(toast.id), 6000)
    return () => {
      clearTimeout(timer)
      clearTimeout(shimmerTimer)
    }
  }, [])

  const borderClass = DIFFICULTY_BORDER[toast.difficulty] ?? DIFFICULTY_BORDER.bronze
  const glowColor   = DIFFICULTY_GLOW[toast.difficulty] ?? DIFFICULTY_GLOW.bronze
  const shimmerTranslate = shimmer.interpolate({
    inputRange: [-1, 1],
    outputRange: [-220, 220],
  })

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY: slide }, { scale }],
        shadowColor: glowColor,
        shadowOpacity: 0.55,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
      }}
    >
      {/* Pulsing ambient glow behind the card */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -6,
          left: -6,
          right: -6,
          bottom: -6,
          borderRadius: 22,
          backgroundColor: glowColor,
          opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.45] }),
          transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.04] }) }],
        }}
      />
      <TouchableOpacity
        onPress={() => {
          dismiss(toast.id)
          router.push('/(tabs)/profile/achievements')
        }}
        activeOpacity={0.9}
        className={[
          'flex-row items-center gap-3 px-4 py-3 rounded-2xl border-2 overflow-hidden',
          'bg-violet-950/95',
          borderClass,
        ].join(' ')}
      >
        {/* Shimmer overlay — a diagonal white stripe sweeping left→right */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 80,
            backgroundColor: 'rgba(255,255,255,0.15)',
            transform: [{ translateX: shimmerTranslate }, { skewX: '-20deg' }],
          }}
        />

        <Animated.Text
          style={{
            fontSize: 28,
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
            textShadowColor: glowColor,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 12,
          }}
        >
          {toast.icon}
        </Animated.Text>
        <View className="flex-1 min-w-0">
          <Text className="text-amber-300 font-bold uppercase tracking-widest" style={{ fontSize: 9 }}>
            {t('achievements.unlockedToast', { defaultValue: 'Achievement Unlocked!' })}
          </Text>
          <Text className="text-white font-bold text-sm" numberOfLines={1}>
            {toast.name}
          </Text>
          <Text className="text-amber-200 font-semibold text-xs">
            {t('achievements.claimNow', { defaultValue: 'Tap to claim' })} · +{toast.starsReward}⭐
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}
