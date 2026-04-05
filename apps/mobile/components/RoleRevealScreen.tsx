import React, { useEffect, useRef } from 'react'
import { Modal, View, Text, Animated, useWindowDimensions } from 'react-native'

interface RoleRevealScreenProps {
  visible: boolean
  role: string
  word: string
  villagerWord?: string
  onDismiss: () => void
}

const ROLE_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string; border: string }> = {
  imposter: {
    emoji: '🎭',
    label: 'Imposter',
    color: 'text-red-400',
    bg: 'bg-red-950/30',
    border: 'border-red-800',
  },
  double_agent: {
    emoji: '🕵️',
    label: 'Double Agent',
    color: 'text-red-400',
    bg: 'bg-red-950/30',
    border: 'border-red-800',
  },
  villager: {
    emoji: '🏘️',
    label: 'Villager',
    color: 'text-violet-400',
    bg: 'bg-violet-950/30',
    border: 'border-violet-800',
  },
  detective: {
    emoji: '🔍',
    label: 'Detective',
    color: 'text-sky-400',
    bg: 'bg-sky-950/30',
    border: 'border-sky-800',
  },
}

export default function RoleRevealScreen({
  visible,
  role,
  word,
  villagerWord,
  onDismiss,
}: RoleRevealScreenProps) {
  const { width } = useWindowDimensions()
  const isTablet = width >= 768
  const cardMaxWidth = isTablet ? 440 : 340

  const flipAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) {
      flipAnim.setValue(0)
      return
    }

    // After 800ms, flip the card over 400ms
    const flipTimeout = setTimeout(() => {
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start()
    }, 800)

    // Auto-dismiss after 4300ms
    const dismissTimeout = setTimeout(() => {
      onDismiss()
    }, 4300)

    return () => {
      clearTimeout(flipTimeout)
      clearTimeout(dismissTimeout)
    }
  }, [visible])

  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.villager

  // Front: 0 -> 90 degrees (visible when flipAnim 0..0.5)
  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '90deg'],
  })
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.49, 0.5],
    outputRange: [1, 1, 0],
  })

  // Back: 90 -> 0 degrees (visible when flipAnim 0.5..1)
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-90deg', '-90deg', '0deg'],
  })
  const backOpacity = flipAnim.interpolate({
    inputRange: [0.5, 0.51, 1],
    outputRange: [0, 1, 1],
  })

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 bg-black/80 items-center justify-center px-6">
        <View style={{ width: '100%', maxWidth: cardMaxWidth, aspectRatio: 0.72 }}>
          {/* Front side */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: '100%',
                height: '100%',
                backfaceVisibility: 'hidden',
                transform: [{ perspective: 800 }, { rotateY: frontRotate }],
                opacity: frontOpacity,
              },
            ]}
          >
            <View className="flex-1 bg-neutral-900 border border-neutral-700 rounded-3xl items-center justify-center">
              <View className="w-24 h-24 rounded-full bg-neutral-800 items-center justify-center mb-4">
                <Text className="text-5xl">?</Text>
              </View>
              <Text className="text-neutral-500 text-sm font-semibold uppercase tracking-widest">
                Your Role
              </Text>
              <Text className="text-neutral-600 text-xs mt-2">Revealing...</Text>
            </View>
          </Animated.View>

          {/* Back side */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: '100%',
                height: '100%',
                backfaceVisibility: 'hidden',
                transform: [{ perspective: 800 }, { rotateY: backRotate }],
                opacity: backOpacity,
              },
            ]}
          >
            <View
              className={[
                'flex-1 border rounded-3xl items-center justify-center px-6',
                config.bg,
                config.border,
              ].join(' ')}
            >
              {/* Role accent line */}
              <View
                className={[
                  'absolute top-0 left-6 right-6 h-0.5 rounded-full',
                  role === 'imposter' || role === 'double_agent'
                    ? 'bg-red-500'
                    : role === 'detective'
                    ? 'bg-sky-500'
                    : 'bg-violet-500',
                ].join(' ')}
                style={{ opacity: 0.6 }}
              />

              <Text className="text-5xl mb-3">{config.emoji}</Text>

              <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">
                You are
              </Text>
              <Text className={['text-2xl font-extrabold tracking-tight mb-6', config.color].join(' ')}>
                {config.label}
              </Text>

              {role === 'double_agent' && villagerWord ? (
                <View className="w-full gap-3">
                  <View className="bg-neutral-900/60 rounded-2xl px-4 py-3 items-center">
                    <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-1">
                      Imposter Word
                    </Text>
                    <Text className="text-xl font-extrabold text-red-400">{word}</Text>
                  </View>
                  <View className="bg-neutral-900/60 rounded-2xl px-4 py-3 items-center">
                    <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-1">
                      Villager Word
                    </Text>
                    <Text className="text-xl font-extrabold text-violet-400">{villagerWord}</Text>
                  </View>
                </View>
              ) : (
                <View className="bg-neutral-900/60 rounded-2xl px-6 py-4 items-center w-full">
                  <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-1">
                    Your Word
                  </Text>
                  <Text className={['text-3xl font-extrabold', config.color].join(' ')}>{word}</Text>
                </View>
              )}

              <Text className="text-neutral-600 text-xs mt-6 text-center">
                {role === 'imposter'
                  ? "Blend in -- don't reveal you have a different word"
                  : role === 'double_agent'
                  ? 'You know both words -- use this to your advantage'
                  : role === 'detective'
                  ? 'Investigate players to find the imposter'
                  : 'Give clues without saying the word directly'}
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  )
}
