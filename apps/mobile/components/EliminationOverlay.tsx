import React, { useEffect, useMemo, useRef } from 'react'
import { Modal, View, Text, Animated, Easing, useWindowDimensions } from 'react-native'

interface EliminationOverlayProps {
  visible: boolean
  username: string
  role: string
  reason?: 'voted' | 'said_word'
  isSelf: boolean
  onDismiss: () => void
}

const ROLE_LABELS: Record<string, string> = {
  red_handed: 'Red-Handed',
  double_agent: 'Double Agent',
  villager: 'Villager',
  detective: 'Detective',
}

function getEmoji(role: string, isSelf: boolean): string {
  if (isSelf) return '\uD83D\uDC80' // skull
  if (role === 'red_handed' || role === 'double_agent') return '\uD83C\uDF89' // party
  return '\uD83D\uDE2C' // grimacing
}

function isEvilRole(role: string): boolean {
  return role === 'red_handed' || role === 'double_agent'
}

/**
 * Full-screen cinematic when a player is eliminated.
 *
 * Stages:
 *   impact (0ms)    — screen flash + expanding shock ring + shake
 *   pop    (250ms)  — emoji pops in with a bouncy scale
 *   stamp  (550ms)  — role label slides up & the "CAUGHT/DOWN" stamp lands rotated
 *   hold   (800ms+) — ambient breathing glow
 *   outro  (3200ms) — fade-out, dismiss at 3500ms
 */
export default function EliminationOverlay({
  visible,
  username,
  role,
  reason,
  isSelf,
  onDismiss,
}: EliminationOverlayProps) {
  const { width, height } = useWindowDimensions()

  // ── Shared Animated.Values ────────────────────────────────────────
  const flash     = useRef(new Animated.Value(0)).current
  const shock     = useRef(new Animated.Value(0)).current
  const shake     = useRef(new Animated.Value(0)).current
  const emojiScale= useRef(new Animated.Value(0)).current
  const titleY    = useRef(new Animated.Value(24)).current
  const titleOp   = useRef(new Animated.Value(0)).current
  const stampScale= useRef(new Animated.Value(3)).current
  const stampOp   = useRef(new Animated.Value(0)).current
  const stampRot  = useRef(new Animated.Value(-18)).current
  const reasonY   = useRef(new Animated.Value(14)).current
  const reasonOp  = useRef(new Animated.Value(0)).current
  const hintOp    = useRef(new Animated.Value(0)).current
  const fade      = useRef(new Animated.Value(1)).current
  const glowPulse = useRef(new Animated.Value(0.7)).current

  // ── Ambient floating particles (stable across renders) ────────────
  const particles = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.25
    const dist = 120 + Math.random() * 90
    return {
      id: i,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      size: 5 + Math.round(Math.random() * 7),
      delay: 80 + i * 24,
      anim: new Animated.Value(0),
    }
  }), [visible])

  useEffect(() => {
    if (!visible) return

    // Reset for re-show
    flash.setValue(0);  shock.setValue(0);  shake.setValue(0)
    emojiScale.setValue(0); titleY.setValue(24); titleOp.setValue(0)
    stampScale.setValue(3); stampOp.setValue(0); stampRot.setValue(-18)
    reasonY.setValue(14); reasonOp.setValue(0); hintOp.setValue(0)
    fade.setValue(1); glowPulse.setValue(0.7)
    particles.forEach(p => p.anim.setValue(0))

    // Main sequence
    Animated.sequence([
      // 1. impact (flash + shock + shake in parallel)
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flash, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]),
        Animated.timing(shock, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(shake, { toValue: 1,  duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 1,  duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0,  duration: 80, useNativeDriver: true }),
        ]),
      ]),
      // 2. emoji pops in with overshoot
      Animated.spring(emojiScale, {
        toValue: 1,
        friction: 4,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start()

    // 3. Title rises in (parallel after delay)
    Animated.parallel([
      Animated.timing(titleY,  { toValue: 0, duration: 360, delay: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(titleOp, { toValue: 1, duration: 360, delay: 500, useNativeDriver: true }),
    ]).start()

    // 4. Stamp lands with a little overshoot
    Animated.parallel([
      Animated.timing(stampOp,    { toValue: 1,    duration: 260, delay: 700, useNativeDriver: true }),
      Animated.spring(stampScale, { toValue: 1,    friction: 5, tension: 180, delay: 700, useNativeDriver: true }),
      Animated.spring(stampRot,   { toValue: -8,   friction: 6, tension: 180, delay: 700, useNativeDriver: true }),
    ]).start()

    // 5. Reason banner + continue hint
    Animated.parallel([
      Animated.timing(reasonY,  { toValue: 0, duration: 320, delay: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(reasonOp, { toValue: 1, duration: 320, delay: 1000, useNativeDriver: true }),
      Animated.timing(hintOp,   { toValue: 1, duration: 400, delay: 1500, useNativeDriver: true }),
    ]).start()

    // 6. Particle radial burst
    particles.forEach(p => {
      Animated.timing(p.anim, {
        toValue: 1,
        duration: 900 + Math.random() * 300,
        delay: p.delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    })

    // 7. Ambient glow breathing loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1,   duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.7, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start()

    // Outro fade + dismiss
    const fadeTimer = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }).start()
    }, 3150)
    const dismissTimer = setTimeout(() => onDismiss(), 3500)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(dismissTimer)
    }
  }, [visible])

  const evil = isEvilRole(role)
  const emoji = getEmoji(role, isSelf)
  const roleLabel = ROLE_LABELS[role] ?? role

  // Stamp text: evil caught → "CAUGHT", otherwise → "DOWN"
  const stampLabel = evil ? 'CAUGHT' : 'DOWN'
  const accentColor = evil ? '#34d399' : '#f87171'        // green on evil catch, red on innocent
  const accentGlow  = evil ? 'rgba(52,211,153,0.55)' : 'rgba(248,113,113,0.55)'
  const bgColorRgba = evil ? 'rgba(5,46,22,0.96)' : 'rgba(69,10,10,0.96)'

  // Interpolations
  const shakeTranslate = shake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-10, 0, 10],
  })
  const shockScale = shock.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 3.2],
  })
  const shockOpacity = shock.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [1, 0.85, 0],
  })

  const shockSize = Math.max(width, height) * 0.55

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        {/* Background with shake */}
        <Animated.View
          style={{
            ...StyleAbsFill,
            backgroundColor: bgColorRgba,
            transform: [{ translateX: shakeTranslate }],
          }}
        />

        {/* Screen flash */}
        <Animated.View
          pointerEvents="none"
          style={{ ...StyleAbsFill, backgroundColor: '#ffffff', opacity: flash }}
        />

        {/* Ambient glow halo (breathing) */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: width / 2 - shockSize / 2,
            top:  height / 2 - shockSize / 2,
            width: shockSize,
            height: shockSize,
            borderRadius: shockSize / 2,
            backgroundColor: accentGlow,
            opacity: glowPulse.interpolate({ inputRange: [0.7, 1], outputRange: [0.12, 0.22] }),
          }}
        />

        {/* Shock ring */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: width / 2 - 120,
            top:  height / 2 - 120,
            width: 240,
            height: 240,
            borderRadius: 120,
            borderWidth: 4,
            borderColor: accentColor,
            opacity: shockOpacity,
            transform: [{ scale: shockScale }],
          }}
        />

        {/* Particles */}
        {particles.map((p) => {
          const tx = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] })
          const ty = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] })
          const sc = p.anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1, 0] })
          const op = p.anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] })
          const hue = p.id % 3 === 0 ? '#fbbf24' : p.id % 3 === 1 ? '#ffffff' : accentColor
          return (
            <Animated.View
              key={p.id}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: width / 2 - p.size / 2,
                top:  height / 2 - p.size / 2,
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: hue,
                shadowColor: hue,
                shadowOpacity: 0.9,
                shadowRadius: p.size,
                shadowOffset: { width: 0, height: 0 },
                opacity: op,
                transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
              }}
            />
          )
        })}

        {/* Centrepiece */}
        <Animated.View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            transform: [{ translateX: shakeTranslate }],
          }}
        >
          {/* ELIMINATED pill */}
          <Animated.View
            style={{
              opacity: titleOp,
              transform: [{ translateY: titleY.interpolate({ inputRange: [0, 24], outputRange: [-4, 20] }) }],
              marginBottom: 14,
              paddingHorizontal: 14,
              paddingVertical: 5,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: accentColor + '80',
              backgroundColor: evil ? 'rgba(6,78,59,0.55)' : 'rgba(69,10,10,0.55)',
              shadowColor: accentColor,
              shadowOpacity: 0.55,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <Text
              style={{
                color: accentColor,
                fontSize: 10,
                fontWeight: '900',
                letterSpacing: 4,
              }}
            >
              {isSelf ? 'YOU ARE OUT' : evil ? 'CAUGHT' : 'ELIMINATED'}
            </Text>
          </Animated.View>

          {/* Emoji with pop */}
          <Animated.Text
            style={{
              fontSize: 92,
              marginBottom: 12,
              transform: [{ scale: emojiScale }],
              textShadowColor: accentGlow,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 24,
            }}
          >
            {emoji}
          </Animated.Text>

          {/* Title */}
          <Animated.View
            style={{
              opacity: titleOp,
              transform: [{ translateY: titleY }],
              marginBottom: 12,
              alignItems: 'center',
            }}
          >
            <Text
              className="text-white text-center"
              style={{
                fontSize: isSelf ? 26 : 22,
                fontWeight: '900',
                letterSpacing: 0.3,
              }}
            >
              {isSelf ? 'You were eliminated!' : `${username} was eliminated`}
            </Text>
          </Animated.View>

          {/* Rotated stamp */}
          <Animated.View
            pointerEvents="none"
            style={{
              marginTop: 4,
              marginBottom: 18,
              paddingHorizontal: 18,
              paddingVertical: 6,
              borderWidth: 3,
              borderColor: accentColor,
              borderRadius: 8,
              backgroundColor: 'rgba(0,0,0,0.35)',
              opacity: stampOp,
              transform: [
                { scale: stampScale },
                { rotate: stampRot.interpolate({ inputRange: [-18, -8], outputRange: ['-18deg', '-8deg'] }) },
              ],
              shadowColor: accentColor,
              shadowOpacity: 0.7,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <Text style={{ color: accentColor, fontSize: 16, fontWeight: '900', letterSpacing: 6 }}>
              {stampLabel}
            </Text>
          </Animated.View>

          {/* Reason banner */}
          {reason === 'said_word' ? (
            <Animated.View
              style={{
                opacity: reasonOp,
                transform: [{ translateY: reasonY }],
                backgroundColor: 'rgba(239,68,68,0.15)',
                borderWidth: 1,
                borderColor: 'rgba(185,28,28,0.9)',
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 8,
                marginBottom: 12,
              }}
            >
              <Text className="text-red-300 font-bold text-sm text-center">
                {isSelf ? 'You' : username} said the word!
              </Text>
            </Animated.View>
          ) : null}

          {/* Role pill */}
          <Animated.View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              opacity: reasonOp,
              transform: [{ translateY: reasonY }],
            }}
          >
            <Text className="text-neutral-400 text-sm">
              {isSelf ? 'You were a' : 'They were a'}
            </Text>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: accentColor + '80',
                backgroundColor: evil ? 'rgba(69,10,10,0.5)' : 'rgba(46,16,101,0.5)',
              }}
            >
              <Text style={{ color: accentColor, fontSize: 14, fontWeight: '800' }}>
                {roleLabel}
              </Text>
            </View>
          </Animated.View>

          {/* Continue hint */}
          <Animated.Text
            className="text-neutral-500 text-xs"
            style={{
              marginTop: 28,
              opacity: hintOp,
              letterSpacing: 2,
            }}
          >
            {isSelf ? 'YOU ARE NOW SPECTATING' : 'CONTINUING...'}
          </Animated.Text>
        </Animated.View>
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
