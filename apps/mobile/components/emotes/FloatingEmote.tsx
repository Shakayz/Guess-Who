import React, { useEffect, useMemo, useRef } from 'react'
import { View, Text, Animated, Easing } from 'react-native'
import {
  getEmoteById,
  type EmoteRarity,
  type EmoteAnimation,
  type EmoteParticle,
} from '@red-handed/shared'

/**
 * Mobile counterpart of apps/web/src/components/emotes/FloatingEmote.tsx.
 * Same visual contract — rarity-tinted halo, per-emote entrance animation,
 * particle burst — using React Native's Animated API instead of CSS.
 *
 * Lifetime (2.8s) and cleanup are owned by the parent; we only animate
 * what the glyph itself does between mount and unmount.
 */

const RARITY_GLOW: Record<EmoteRarity, string> = {
  free:      'rgba(120,120,140,0.3)',
  common:    'rgba(56,189,248,0.4)',
  rare:      'rgba(99,102,241,0.5)',
  epic:      'rgba(217,70,239,0.55)',
  legendary: 'rgba(251,191,36,0.7)',
}

const PARTICLE_GLYPHS: Record<EmoteParticle, string[]> = {
  none:      [],
  sparkle:   ['✨', '⭐', '✨'],
  hearts:    ['❤️', '💖', '💕'],
  fire:      ['🔥', '💢', '🔥'],
  stars:     ['⭐', '🌟', '✨'],
  tears:     ['💧', '💦'],
  confetti:  ['🎉', '🎊', '✨'],
  lightning: ['⚡', '⚡'],
  bubbles:   ['💭', '○'],
  money:     ['💵', '💰', '💸'],
  skull:     ['💀', '☠️'],
}

type Props = {
  emoteId?: string
  emoji?: string
  username: string
}

export function FloatingEmote({ emoteId, emoji, username }: Props) {
  const emote = emoteId ? getEmoteById(emoteId) : undefined
  const rarity: EmoteRarity = emote?.rarity ?? 'free'
  const animation: EmoteAnimation = emote?.animation ?? 'pop'
  const particle: EmoteParticle = emote?.particle ?? 'none'
  const glyph = emote?.emoji ?? emoji ?? '❔'

  // Entrance driver — 0 → 1 over 0.55s, then idle.
  const entrance = useRef(new Animated.Value(0)).current
  // Lifecycle rise + fade — 0 → 1 over the full 2.8s lifetime.
  const rise = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: animation === 'bounce' ? 800 : animation === 'spin' ? 900 : 550,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: true,
    }).start()
    Animated.timing(rise, {
      toValue: 1,
      duration: 2800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
  }, [entrance, rise, animation])

  // Interpolations per animation type.
  const scale = entrance.interpolate({
    inputRange: [0, 0.5, 0.8, 1],
    outputRange: [0, 1.25, 0.95, 1],
  })
  const rotate =
    animation === 'spin'
      ? entrance.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
      : animation === 'shake'
      ? entrance.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: ['0deg', '-8deg', '8deg', '-4deg', '0deg'],
        })
      : '0deg'
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [0, -140] })
  const opacity = rise.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] })

  // Particles — pick once, each with random offsets.
  const particles = useMemo(() => {
    const pool = PARTICLE_GLYPHS[particle]
    if (pool.length === 0) return [] as { g: string; dx: number; dy: number; delay: number }[]
    const count = rarity === 'legendary' ? 8 : rarity === 'epic' ? 6 : rarity === 'rare' ? 4 : 3
    return Array.from({ length: count }, (_, i) => ({
      g: pool[i % pool.length],
      dx: (Math.random() - 0.5) * 120,
      dy: -40 - Math.random() * 60,
      delay: Math.random() * 200,
    }))
  }, [particle, rarity])

  return (
    <Animated.View
      style={{
        alignItems: 'center',
        opacity,
        transform: [{ translateY }],
      }}
      pointerEvents="none"
    >
      <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
        {/* Rarity halo */}
        <View
          style={{
            position: 'absolute',
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: RARITY_GLOW[rarity],
            opacity: 0.6,
          }}
        />
        {/* Particles */}
        {particles.map((p, i) => (
          <ParticleDot key={i} glyph={p.g} dx={p.dx} dy={p.dy} delay={p.delay} />
        ))}
        <Animated.Text
          style={{
            fontSize: 36,
            transform: [{ scale }, { rotate }],
            textShadowColor: 'rgba(0,0,0,0.6)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 6,
          }}
        >
          {glyph}
        </Animated.Text>
      </View>
      <View
        style={{
          backgroundColor: 'rgba(0,0,0,0.55)',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 999,
          marginTop: 4,
        }}
      >
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>{username}</Text>
      </View>
    </Animated.View>
  )
}

function ParticleDot({ glyph, dx, dy, delay }: { glyph: string; dx: number; dy: number; delay: number }) {
  const drive = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(drive, {
      toValue: 1,
      duration: 1800,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
  }, [drive, delay])
  const tx = drive.interpolate({ inputRange: [0, 1], outputRange: [0, dx] })
  const ty = drive.interpolate({ inputRange: [0, 1], outputRange: [0, dy] })
  const op = drive.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] })
  const sc = drive.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.1] })
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        fontSize: 14,
        opacity: op,
        transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
      }}
    >
      {glyph}
    </Animated.Text>
  )
}
