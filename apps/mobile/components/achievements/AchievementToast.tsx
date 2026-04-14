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

const DIFFICULTY_GLOW: Record<string, string> = {
  bronze:   'rgba(180,83,9,0.55)',
  silver:   'rgba(203,213,225,0.55)',
  gold:     'rgba(250,204,21,0.65)',
  platinum: 'rgba(103,232,249,0.65)',
  diamond:  'rgba(125,211,252,0.7)',
  mythic:   'rgba(232,121,249,0.75)',
}

/**
 * Stack of dismissible achievement-unlock toasts. Each card plays a 3D
 * flip-in reveal: the back (locked sigil) rotates to reveal the unlocked face.
 * Auto-dismisses after 6s, or earlier when tapped.
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
        gap: 10,
      }}
    >
      {toasts.map((toast, i) => (
        <AchievementToastItem key={toast.id} toast={toast} index={i} />
      ))}
    </View>
  )
}

function AchievementToastItem({ toast, index }: { toast: ToastData; index: number }) {
  const { t } = useTranslation()
  const router = useRouter()
  const dismiss = useSocialStore((s) => s.dismissAchievementToast)

  // Flip: 1 → 0 (back-facing → front-facing). Starts after a small delay so
  // the user perceives the card turning over (not a cold pop-in).
  const flip = useRef(new Animated.Value(1)).current
  const scale = useRef(new Animated.Value(0.9)).current
  const glow = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.delay(150 + index * 90),
        Animated.timing(flip, {
          toValue: 0,
          duration: 720,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 160,
        useNativeDriver: true,
        delay: 150 + index * 90,
      }),
    ]).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    ).start()

    const timer = setTimeout(() => dismiss(toast.id), 6000)
    return () => clearTimeout(timer)
  }, [])

  const borderClass = DIFFICULTY_BORDER[toast.difficulty] ?? DIFFICULTY_BORDER.bronze
  const glowColor = DIFFICULTY_GLOW[toast.difficulty] ?? DIFFICULTY_GLOW.bronze

  // Front face: rotateY goes 180° → 0° as flip goes 1 → 0
  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
  // Back face: offset by 180°, goes 360° → 180°
  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] })
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] })

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={() => {
          dismiss(toast.id)
          router.push('/(tabs)/profile/achievements')
        }}
        activeOpacity={0.9}
      >
        <View style={{ position: 'relative', minHeight: 72 }}>
          {/* FRONT — unlocked side */}
          <Animated.View
            style={{
              transform: [{ perspective: 1200 }, { rotateY: frontRotate }],
              backfaceVisibility: 'hidden',
              shadowColor: glowColor,
              shadowOpacity: shadowOpacity as unknown as number,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }}
            className={[
              'flex-row items-center gap-3 px-4 py-3 rounded-2xl border-2',
              'bg-violet-950/95',
              borderClass,
            ].join(' ')}
          >
            <Text style={{ fontSize: 28 }}>{toast.icon}</Text>
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
          </Animated.View>

          {/* BACK — locked sigil (visible before flip lands) */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              transform: [{ perspective: 1200 }, { rotateY: backRotate }],
              backfaceVisibility: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.5,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }}
            className="flex-row items-center justify-center rounded-2xl border-2 border-violet-700/70 bg-violet-950/95"
          >
            <View className="absolute inset-0 rounded-2xl overflow-hidden opacity-30">
              <View
                style={{
                  position: 'absolute',
                  top: -20,
                  left: -20,
                  right: -20,
                  bottom: -20,
                  backgroundColor: '#1e1b4b',
                }}
              />
            </View>
            <Text style={{ fontSize: 28 }}>✨</Text>
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}
