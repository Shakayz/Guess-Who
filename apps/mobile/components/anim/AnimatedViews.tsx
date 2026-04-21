import React, { useEffect, useMemo } from 'react'
import { StyleSheet, ViewStyle, View, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  withSpring,
  Easing,
  interpolate,
  Extrapolation,
  cancelAnimation,
} from 'react-native-reanimated'
import { CURVES, DURATION, GLOW } from '../../lib/anim'

type AV = React.PropsWithChildren<{ style?: ViewStyle; delay?: number }>

// ─── FadeIn / SlideUp / SlideDown ─────────────────────────────────────────
export function FadeIn({ children, style, delay = 0 }: AV) {
  const opacity = useSharedValue(0)
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: DURATION.fadeIn }))
  }, [delay])
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

export function SlideUp({ children, style, delay = 0, distance = 12 }: AV & { distance?: number }) {
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(distance)
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: DURATION.slide }))
    translateY.value = withDelay(delay, withTiming(0, { duration: DURATION.slide, easing: CURVES.easeOut }))
  }, [delay])
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── PopIn (juicy overshoot entrance) ─────────────────────────────────────
export function PopIn({ children, style, delay = 0 }: AV) {
  const opacity = useSharedValue(0)
  const scale = useSharedValue(0.3)
  const translateY = useSharedValue(10)
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 250 }))
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.12, { duration: 275, easing: CURVES.bounce }),
        withTiming(0.94, { duration: 110, easing: CURVES.easeOut }),
        withTiming(1, { duration: 115, easing: CURVES.easeOut }),
      ),
    )
    translateY.value = withDelay(
      delay,
      withSequence(
        withTiming(-4, { duration: 275, easing: CURVES.bounce }),
        withTiming(0, { duration: 225, easing: CURVES.easeOut }),
      ),
    )
  }, [delay])
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── BounceIn (larger entrance for heroes/modals) ─────────────────────────
export function BounceIn({ children, style, delay = 0 }: AV) {
  const opacity = useSharedValue(0)
  const scale = useSharedValue(0.3)
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 250 }))
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.1, { duration: 250, easing: CURVES.bounce }),
        withTiming(0.9, { duration: 100 }),
        withTiming(1, { duration: 150 }),
      ),
    )
  }, [delay])
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── StampIn (verdict / big-label slam) ────────────────────────────────────
export function StampIn({ children, style, delay = 0, angle = -8 }: AV & { angle?: number }) {
  const opacity = useSharedValue(0)
  const scale = useSharedValue(3)
  const rot = useSharedValue(-18)
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 330, easing: CURVES.whipBack }))
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(0.92, { duration: 330, easing: CURVES.whipBack }),
        withTiming(1.06, { duration: 110 }),
        withTiming(1, { duration: 110 }),
      ),
    )
    rot.value = withDelay(
      delay,
      withSequence(
        withTiming(-6, { duration: 330, easing: CURVES.whipBack }),
        withTiming(-10, { duration: 110 }),
        withTiming(angle, { duration: 110 }),
      ),
    )
  }, [delay, angle])
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rot.value}deg` }],
  }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── CardFlipIn (3D Y-axis flip entrance for role reveal) ─────────────────
export function CardFlipIn({ children, style, delay = 0 }: AV) {
  const opacity = useSharedValue(0)
  const rotY = useSharedValue(-90)
  const scale = useSharedValue(0.85)
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }))
    rotY.value = withDelay(
      delay,
      withSequence(
        withTiming(18, { duration: 495, easing: CURVES.bounce }),
        withTiming(-6, { duration: 225 }),
        withTiming(0, { duration: 180 }),
      ),
    )
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.03, { duration: 495, easing: CURVES.bounce }),
        withTiming(0.99, { duration: 225 }),
        withTiming(1, { duration: 180 }),
      ),
    )
  }, [delay])
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { perspective: 900 },
      { rotateY: `${rotY.value}deg` },
      { scale: scale.value },
    ],
  }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── CardFlipHero (dramatic 3D X+Y flip for reward reveal) ────────────────
export function CardFlipHero({ children, style, delay = 0 }: AV) {
  const opacity = useSharedValue(0)
  const rotX = useSharedValue(70)
  const rotY = useSharedValue(-30)
  const scale = useSharedValue(0.7)
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 495 }))
    rotX.value = withDelay(
      delay,
      withSequence(
        withTiming(-8, { duration: 495, easing: CURVES.bounce }),
        withTiming(3, { duration: 275 }),
        withTiming(0, { duration: 330 }),
      ),
    )
    rotY.value = withDelay(
      delay,
      withSequence(
        withTiming(10, { duration: 495, easing: CURVES.bounce }),
        withTiming(-3, { duration: 275 }),
        withTiming(0, { duration: 330 }),
      ),
    )
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.06, { duration: 495, easing: CURVES.bounce }),
        withTiming(0.99, { duration: 275 }),
        withTiming(1, { duration: 330 }),
      ),
    )
  }, [delay])
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { perspective: 1200 },
      { rotateX: `${rotX.value}deg` },
      { rotateY: `${rotY.value}deg` },
      { scale: scale.value },
    ],
  }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── Shake (error / invalid input) ────────────────────────────────────────
export function Shake({ children, style, trigger }: { children: React.ReactNode; style?: ViewStyle; trigger: number }) {
  const translateX = useSharedValue(0)
  useEffect(() => {
    if (trigger > 0) {
      translateX.value = withSequence(
        withTiming(-1, { duration: 50, easing: CURVES.shake }),
        withTiming(2, { duration: 50, easing: CURVES.shake }),
        withTiming(-6, { duration: 50, easing: CURVES.shake }),
        withTiming(6, { duration: 50, easing: CURVES.shake }),
        withTiming(-6, { duration: 50, easing: CURVES.shake }),
        withTiming(6, { duration: 50, easing: CURVES.shake }),
        withTiming(-6, { duration: 50, easing: CURVES.shake }),
        withTiming(2, { duration: 50, easing: CURVES.shake }),
        withTiming(-1, { duration: 50, easing: CURVES.shake }),
        withTiming(0, { duration: 50, easing: CURVES.shake }),
      )
    }
  }, [trigger])
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── Heartbeat (idle emphasis — e.g. timer, live dot) ─────────────────────
export function Heartbeat({ children, style }: AV) {
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 196 }),
        withTiming(1, { duration: 196 }),
        withTiming(1.1, { duration: 196 }),
        withTiming(1, { duration: 812 }),
      ),
      -1,
      false,
    )
    return () => cancelAnimation(scale)
  }, [])
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── Breathe (soft idle scale — buttons waiting on click) ────────────────
export function Breathe({ children, style }: AV) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0.95)
  useEffect(() => {
    scale.value = withRepeat(withTiming(1.04, { duration: DURATION.breathe / 2 }), -1, true)
    opacity.value = withRepeat(withTiming(1, { duration: DURATION.breathe / 2 }), -1, true)
    return () => {
      cancelAnimation(scale)
      cancelAnimation(opacity)
    }
  }, [])
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── GlowPulse (purple shadow pulse — CTAs / important cards) ─────────────
export function GlowPulse({ children, style, color = GLOW.brandSolid }: AV & { color?: string }) {
  const shadowRadius = useSharedValue(6)
  const shadowOpacity = useSharedValue(0.35)
  useEffect(() => {
    shadowRadius.value = withRepeat(withTiming(24, { duration: DURATION.glowPulse / 2 }), -1, true)
    shadowOpacity.value = withRepeat(withTiming(0.7, { duration: DURATION.glowPulse / 2 }), -1, true)
    return () => {
      cancelAnimation(shadowRadius)
      cancelAnimation(shadowOpacity)
    }
  }, [])
  const animStyle = useAnimatedStyle(() => ({
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: shadowOpacity.value,
    shadowRadius: shadowRadius.value,
    elevation: shadowRadius.value,
  }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── UrgentPulse (red glow — running out of time) ─────────────────────────
export function UrgentPulse({ children, style }: AV) {
  const scale = useSharedValue(1)
  const shadowRadius = useSharedValue(0)
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: DURATION.urgentPulse / 2 }),
        withTiming(1, { duration: DURATION.urgentPulse / 2 }),
      ),
      -1,
      false,
    )
    shadowRadius.value = withRepeat(
      withSequence(
        withTiming(14, { duration: DURATION.urgentPulse / 2 }),
        withTiming(0, { duration: DURATION.urgentPulse / 2 }),
      ),
      -1,
      false,
    )
    return () => {
      cancelAnimation(scale)
      cancelAnimation(shadowRadius)
    }
  }, [])
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: shadowRadius.value,
    elevation: shadowRadius.value,
  }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── FloatSoft (gentle up/down bob for resting heroes) ────────────────────
export function FloatSoft({ children, style }: AV) {
  const translateY = useSharedValue(0)
  useEffect(() => {
    translateY.value = withRepeat(withTiming(-6, { duration: DURATION.floatSoft / 2 }), -1, true)
    return () => cancelAnimation(translateY)
  }, [])
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── TiltIdle (subtle rotation for interactive cards) ─────────────────────
export function TiltIdle({ children, style }: AV) {
  const rot = useSharedValue(-2)
  useEffect(() => {
    rot.value = withRepeat(withTiming(2, { duration: DURATION.tiltIdle / 2 }), -1, true)
    return () => cancelAnimation(rot)
  }, [])
  const animStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── DeathFall (elimination — fall + rotate + desaturate) ────────────────
export function DeathFall({ children, style, trigger }: { children: React.ReactNode; style?: ViewStyle; trigger: boolean }) {
  const translateY = useSharedValue(0)
  const rot = useSharedValue(0)
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)
  useEffect(() => {
    if (trigger) {
      translateY.value = withSequence(
        withTiming(-8, { duration: DURATION.deathFall * 0.3 }),
        withTiming(80, { duration: DURATION.deathFall * 0.7 }),
      )
      rot.value = withSequence(
        withTiming(-6, { duration: DURATION.deathFall * 0.3 }),
        withTiming(30, { duration: DURATION.deathFall * 0.7 }),
      )
      scale.value = withSequence(
        withTiming(1.02, { duration: DURATION.deathFall * 0.3 }),
        withTiming(0.7, { duration: DURATION.deathFall * 0.7 }),
      )
      opacity.value = withTiming(0.15, { duration: DURATION.deathFall })
    }
  }, [trigger])
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { rotate: `${rot.value}deg` }, { scale: scale.value }],
  }))
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>
}

// ─── ScreenFlash (big-moment white flash overlay) ─────────────────────────
export function ScreenFlash({ trigger, color = '#ffffff' }: { trigger: number; color?: string }) {
  const opacity = useSharedValue(0)
  useEffect(() => {
    if (trigger > 0) {
      opacity.value = withSequence(
        withTiming(0.55, { duration: DURATION.screenFlash * 0.4 }),
        withTiming(0, { duration: DURATION.screenFlash * 0.6 }),
      )
    }
  }, [trigger])
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: color, zIndex: 9999 }, animStyle]}
    />
  )
}

// ─── Shimmer (skeleton / "new" sheen) ─────────────────────────────────────
export function Shimmer({ style, color = 'rgba(255,255,255,0.12)' }: { style?: ViewStyle; color?: string }) {
  const x = useSharedValue(-1)
  useEffect(() => {
    x.value = withRepeat(withTiming(2, { duration: 1500, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(x)
  }, [])
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(x.value, [-1, 2], [-200, 400], Extrapolation.CLAMP) },
      { skewX: '-18deg' },
    ],
    opacity: interpolate(x.value, [-1, 0, 1, 2], [0, 0.6, 0.6, 0], Extrapolation.CLAMP),
  }))
  return (
    <View style={[{ overflow: 'hidden' }, style]} pointerEvents="none">
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 120,
            backgroundColor: color,
          },
          animStyle,
        ]}
      />
    </View>
  )
}

// ─── ConfettiRain (N falling pieces over the screen) ──────────────────────
const CONFETTI_COLORS = ['#f472b6', '#8b5cf6', '#fbbf24', '#34d399', '#60a5fa', '#f87171']

function ConfettiPiece({ x0, delay, duration, color, size }: { x0: number; delay: number; duration: number; color: string; size: number }) {
  const y = useSharedValue(-120)
  const rot = useSharedValue(0)
  const opacity = useSharedValue(1)
  const screenH = Dimensions.get('window').height
  useEffect(() => {
    y.value = withDelay(delay, withTiming(screenH + 40, { duration, easing: Easing.linear }))
    rot.value = withDelay(delay, withTiming(720, { duration, easing: Easing.linear }))
    opacity.value = withDelay(
      delay + duration * 0.8,
      withTiming(0, { duration: duration * 0.2 }),
    )
  }, [])
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${rot.value}deg` }],
    opacity: opacity.value,
  }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: x0,
          top: 0,
          width: size,
          height: size * 1.6,
          backgroundColor: color,
          borderRadius: 2,
        },
        animStyle,
      ]}
    />
  )
}

export function ConfettiRain({ count = 60, trigger = 1 }: { count?: number; trigger?: number }) {
  const { width } = Dimensions.get('window')
  const pieces = useMemo(
    () =>
      new Array(count).fill(0).map((_, i) => ({
        id: `${trigger}-${i}`,
        x0: Math.random() * width,
        delay: Math.random() * 600,
        duration: 1600 + Math.random() * 1200,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    [count, trigger, width],
  )
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { zIndex: 9998 }]}>
      {pieces.map((p) => (
        <ConfettiPiece key={p.id} x0={p.x0} delay={p.delay} duration={p.duration} color={p.color} size={p.size} />
      ))}
    </View>
  )
}

// ─── CoinRain (gold coins falling from the top — reward reveal) ──────────
function CoinPiece({ x0, delay, duration }: { x0: number; delay: number; duration: number }) {
  const y = useSharedValue(-20)
  const rot = useSharedValue(0)
  const opacity = useSharedValue(0)
  const scale = useSharedValue(0.6)
  useEffect(() => {
    y.value = withDelay(delay, withTiming(260, { duration }))
    rot.value = withDelay(delay, withTiming(540, { duration }))
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: duration * 0.12 }),
        withTiming(1, { duration: duration * 0.7 }),
        withTiming(0, { duration: duration * 0.18 }),
      ),
    )
    scale.value = withDelay(delay, withTiming(1.1, { duration }))
  }, [])
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${rot.value}deg` }, { scale: scale.value }],
    opacity: opacity.value,
  }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: x0,
          top: 0,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: '#fbbf24',
          borderWidth: 2,
          borderColor: '#b45309',
          shadowColor: '#fbbf24',
          shadowOpacity: 0.8,
          shadowRadius: 6,
        },
        animStyle,
      ]}
    />
  )
}

export function CoinRain({ count = 20, trigger = 1 }: { count?: number; trigger?: number }) {
  const { width } = Dimensions.get('window')
  const coins = useMemo(
    () =>
      new Array(count).fill(0).map((_, i) => ({
        id: `${trigger}-${i}`,
        x0: Math.random() * (width - 40),
        delay: Math.random() * 500,
        duration: 1200 + Math.random() * 900,
      })),
    [count, trigger, width],
  )
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { zIndex: 9997 }]}>
      {coins.map((c) => (
        <CoinPiece key={c.id} x0={c.x0} delay={c.delay} duration={c.duration} />
      ))}
    </View>
  )
}
