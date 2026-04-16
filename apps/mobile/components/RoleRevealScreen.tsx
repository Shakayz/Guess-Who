import React, { useEffect, useMemo, useRef } from 'react'
import { Modal, View, Text, Animated, Easing, useWindowDimensions } from 'react-native'

interface RoleRevealScreenProps {
  visible: boolean
  role: string
  word: string
  villagerWord?: string
  onDismiss: () => void
}

const ROLE_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string; border: string; accent: string; glow: string }> = {
  red_handed: {
    emoji: '🎭',
    label: 'Red-Handed',
    color: 'text-red-400',
    bg: 'bg-red-950/30',
    border: 'border-red-800',
    accent: '#f87171',
    glow: 'rgba(248,113,113,0.55)',
  },
  double_agent: {
    emoji: '🕵️',
    label: 'Double Agent',
    color: 'text-red-400',
    bg: 'bg-red-950/30',
    border: 'border-red-800',
    accent: '#fb923c',
    glow: 'rgba(251,146,60,0.55)',
  },
  villager: {
    emoji: '🏘️',
    label: 'Villager',
    color: 'text-violet-400',
    bg: 'bg-violet-950/30',
    border: 'border-violet-800',
    accent: '#a78bfa',
    glow: 'rgba(167,139,250,0.55)',
  },
  detective: {
    emoji: '🔍',
    label: 'Detective',
    color: 'text-sky-400',
    bg: 'bg-sky-950/30',
    border: 'border-sky-800',
    accent: '#38bdf8',
    glow: 'rgba(56,189,248,0.55)',
  },
}

export default function RoleRevealScreen({
  visible,
  role,
  word,
  villagerWord,
  onDismiss,
}: RoleRevealScreenProps) {
  const { width, height } = useWindowDimensions()
  const isTablet = width >= 768
  const cardMaxWidth = isTablet ? 440 : 340

  // Animated values
  const flipAnim    = useRef(new Animated.Value(0)).current
  const cardIn      = useRef(new Animated.Value(0)).current    // modal entrance 0→1
  const cardPulse   = useRef(new Animated.Value(0)).current    // scale pulse at flip peak
  const fade        = useRef(new Animated.Value(1)).current
  const glow        = useRef(new Animated.Value(0)).current    // bg breathing

  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.villager

  // ── Sparkle particles that bloom after the flip ───────────────────
  const sparkles = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2
    const r = 150 + Math.random() * 80
    return {
      id: i,
      dx: Math.cos(angle) * r,
      dy: Math.sin(angle) * r,
      size: 14 + Math.round(Math.random() * 10),
      delay: 900 + i * 30,
      anim: new Animated.Value(0),
    }
  }), [visible])

  useEffect(() => {
    if (!visible) {
      flipAnim.setValue(0)
      cardIn.setValue(0)
      cardPulse.setValue(0)
      fade.setValue(1)
      glow.setValue(0)
      sparkles.forEach(p => p.anim.setValue(0))
      return
    }

    // 1. Spring the card in
    Animated.spring(cardIn, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start()

    // 2. After 800ms, flip the card over 550ms with a mid-flip scale pulse
    const flipTimeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(flipAnim, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(cardPulse, { toValue: 1, duration: 275, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(cardPulse, { toValue: 0, duration: 275, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
        ]),
      ]).start()

      // 3. Sparkle burst after the flip
      sparkles.forEach(p => {
        Animated.timing(p.anim, {
          toValue: 1,
          duration: 900 + Math.random() * 300,
          delay: p.delay - 800, // relative to flipTimeout
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start()
      })
    }, 800)

    // 4. Ambient breathing glow behind the card
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start()

    // Fade out before dismiss
    const fadeTimer    = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }).start()
    }, 3950)
    const dismissTimer = setTimeout(() => onDismiss(), 4300)

    return () => {
      clearTimeout(flipTimeout)
      clearTimeout(fadeTimer)
      clearTimeout(dismissTimer)
    }
  }, [visible])

  // Front: 0 -> 90 degrees (visible when flipAnim 0..0.5)
  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '90deg'],
  })
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.49, 0.5],
    outputRange: [1, 1, 0],
  })

  // Back: -90 -> 0 degrees (visible when flipAnim 0.5..1)
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-90deg', '-90deg', '0deg'],
  })
  const backOpacity = flipAnim.interpolate({
    inputRange: [0.5, 0.51, 1],
    outputRange: [0, 1, 1],
  })

  // Card container transforms — spring in + pulse
  const containerScale = Animated.add(
    cardIn.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
    cardPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }),
  )
  const containerTranslateY = cardIn.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  })
  const containerOp = cardIn.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        {/* Black backdrop */}
        <View style={{ ...StyleAbsFill, backgroundColor: 'rgba(0,0,0,0.85)' }} />

        {/* Breathing glow behind the card */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: width / 2 - 200,
            top:  height / 2 - 200,
            width: 400,
            height: 400,
            borderRadius: 200,
            backgroundColor: config.glow,
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] }),
          }}
        />

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Animated.View
            style={{
              width: '100%',
              maxWidth: cardMaxWidth,
              aspectRatio: 0.72,
              opacity: containerOp,
              transform: [
                { translateY: containerTranslateY },
                { scale: containerScale },
              ],
            }}
          >
            {/* Front side */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  transform: [{ perspective: 900 }, { rotateY: frontRotate }],
                  opacity: frontOpacity,
                },
              ]}
            >
              <View className="flex-1 bg-neutral-900 border border-neutral-700 rounded-3xl items-center justify-center"
                    style={{
                      shadowColor: '#8b5cf6',
                      shadowOpacity: 0.35,
                      shadowRadius: 20,
                      shadowOffset: { width: 0, height: 10 },
                    }}>
                <View className="w-24 h-24 rounded-full bg-neutral-800 items-center justify-center mb-4 border border-neutral-700">
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
                  transform: [{ perspective: 900 }, { rotateY: backRotate }],
                  opacity: backOpacity,
                },
              ]}
            >
              <View
                className={[
                  'flex-1 border-2 rounded-3xl items-center justify-center px-6',
                  config.bg,
                  config.border,
                ].join(' ')}
                style={{
                  shadowColor: config.accent,
                  shadowOpacity: 0.55,
                  shadowRadius: 22,
                  shadowOffset: { width: 0, height: 12 },
                }}
              >
                {/* Role accent line */}
                <View
                  className={[
                    'absolute top-0 left-6 right-6 h-0.5 rounded-full',
                    role === 'red_handed' || role === 'double_agent'
                      ? 'bg-red-500'
                      : role === 'detective'
                      ? 'bg-sky-500'
                      : 'bg-violet-500',
                  ].join(' ')}
                  style={{ opacity: 0.6 }}
                />

                <Text
                  style={{
                    fontSize: 58,
                    marginBottom: 10,
                    textShadowColor: config.glow,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 20,
                  }}
                >
                  {config.emoji}
                </Text>

                <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">
                  You are
                </Text>
                <Text
                  className={['text-2xl font-extrabold tracking-tight mb-6', config.color].join(' ')}
                  style={{
                    textShadowColor: config.glow,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 10,
                  }}
                >
                  {config.label}
                </Text>

                {role === 'double_agent' && villagerWord ? (
                  <View className="w-full gap-3">
                    <View className="bg-neutral-900/60 rounded-2xl px-4 py-3 items-center">
                      <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-1">
                        RedHanded Word
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
                  {role === 'red_handed'
                    ? "Blend in -- don't reveal you have a different word"
                    : role === 'double_agent'
                    ? 'You know both words -- use this to your advantage'
                    : role === 'detective'
                    ? 'Investigate players to find the redHanded'
                    : 'Give clues without saying the word directly'}
                </Text>
              </View>
            </Animated.View>
          </Animated.View>

          {/* Sparkle burst around the card — placed at screen center */}
          {sparkles.map((p) => {
            const tx = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] })
            const ty = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] })
            const op = p.anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] })
            const sc = p.anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.3, 1, 0.4] })
            return (
              <Animated.Text
                key={p.id}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  fontSize: p.size,
                  opacity: op,
                  transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
                  textShadowColor: config.glow,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 12,
                }}
              >
                ✦
              </Animated.Text>
            )
          })}
        </View>
      </Animated.View>
    </Modal>
  )
}

const StyleAbsFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
}
