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

function AchievementToastItem({ toast, index }: { toast: ToastData; index: number }) {
  const { t } = useTranslation()
  const router = useRouter()
  const dismiss = useSocialStore((s) => s.dismissAchievementToast)
  const slide = useRef(new Animated.Value(-20)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: 260,
        delay: index * 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start()
    const timer = setTimeout(() => dismiss(toast.id), 6000)
    return () => clearTimeout(timer)
  }, [])

  const borderClass = DIFFICULTY_BORDER[toast.difficulty] ?? DIFFICULTY_BORDER.bronze

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: slide }] }}>
      <TouchableOpacity
        onPress={() => {
          dismiss(toast.id)
          router.push('/(tabs)/profile/achievements')
        }}
        activeOpacity={0.9}
        className={[
          'flex-row items-center gap-3 px-4 py-3 rounded-2xl border-2',
          'bg-violet-950/95',
          borderClass,
        ].join(' ')}
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.5,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
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
      </TouchableOpacity>
    </Animated.View>
  )
}
