import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Animated, Easing, Dimensions } from 'react-native'
import { useTranslation } from 'react-i18next'

export interface CoinsRevealCardProps {
  /**
   * Coins credited for level-ups triggered by this game (level × 10 per
   * level gained). Zero if the player didn't cross a level threshold.
   */
  levelUpEarned: number
  /** +DAILY_BONUS when the server awarded first-of-day */
  dailyBonus?: number
  /** +STREAK_BONUS when the new streak hits a multiple of STREAK_INTERVAL */
  streakBonus?: number
  /** Entry fee that was paid (shown for transparency) */
  gameCost?: number
  /** Rolling consecutive-day count (persisted by the server) */
  newStreakCount?: number
}

/** A small animated chip for one line of the breakdown. */
function BreakdownChip({
  label,
  value,
  tone,
  icon,
  delay,
}: {
  label: string
  value: number
  tone: 'base' | 'daily' | 'streak' | 'cost'
  icon?: string
  delay: number
}) {
  const scale = useRef(new Animated.Value(0.3)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 420,
        delay,
        easing: Easing.out(Easing.back(1.8)),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay,
        useNativeDriver: true,
      }),
    ]).start()
  }, [delay])

  const toneClass: Record<typeof tone, string> = {
    base:   'bg-amber-950/60  border-amber-700/60  ',
    daily:  'bg-yellow-950/70 border-yellow-500/70 ',
    streak: 'bg-orange-950/80 border-orange-500/80 ',
    cost:   'bg-neutral-900/80 border-neutral-600/60 ',
  }
  const textClass: Record<typeof tone, string> = {
    base:   'text-amber-200',
    daily:  'text-yellow-200',
    streak: 'text-orange-200',
    cost:   'text-red-300',
  }
  const sign = value >= 0 ? '+' : '−'

  return (
    <Animated.View
      style={{ opacity, transform: [{ scale }] }}
      className={[
        'flex-row items-center gap-1 px-2.5 py-1 rounded-full border',
        toneClass[tone],
      ].join(' ')}
    >
      {icon && <Text style={{ fontSize: 11 }}>{icon}</Text>}
      <Text className={['text-[11px] font-semibold', textClass[tone]].join(' ')}>{label}</Text>
      <Text className={['text-[11px] font-extrabold', textClass[tone]].join(' ')}>
        {sign}
        {Math.abs(value)}⭐
      </Text>
    </Animated.View>
  )
}

/** Single falling coin particle. */
function CoinRainParticle({ leftPct, delay, cardWidth }: { leftPct: number; delay: number; cardWidth: number }) {
  const y = useRef(new Animated.Value(-12)).current
  const opacity = useRef(new Animated.Value(0)).current
  const rot = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 220,
          duration: 1700,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rot, {
          toValue: 1,
          duration: 1700,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(1300),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start()
  }, [delay])

  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] })

  return (
    <Animated.Text
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: Math.max(0, Math.min(cardWidth - 16, (leftPct / 100) * cardWidth)),
        opacity,
        transform: [{ translateY: y }, { rotate }],
        fontSize: 14,
      }}
    >
      ⭐
    </Animated.Text>
  )
}

/** Animated count-up that drives a Text via setState with rAF-like timers. */
function useCountUp(target: number, duration = 1100, delay = 320) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let frame: any
    let start: number | null = null
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (start === null) start = ts
        const p = Math.min((ts - start) / duration, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        setValue(Math.round(target * eased))
        if (p < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }, delay)
    return () => {
      clearTimeout(timer)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [target, duration, delay])
  return value
}

/**
 * Flashy "you won coins" reveal card for the mobile results screen.
 * - 3D flip-in entrance (scale + rotateX)
 * - Spinning coin (rotateY), animated total, sheen sweep, coin-rain particles
 * - Breakdown chips for daily / streak / cost (only when earned)
 * - 7-day streak pips light up with the current streak day
 */
export function CoinsRevealCard({
  levelUpEarned,
  dailyBonus = 0,
  streakBonus = 0,
  gameCost = 0,
  newStreakCount = 0,
}: CoinsRevealCardProps) {
  const { t } = useTranslation()
  const total = Math.max(0, levelUpEarned) + dailyBonus + streakBonus
  const animatedTotal = useCountUp(total)
  const streakDay = newStreakCount > 0 ? ((newStreakCount - 1) % 7) + 1 : 0
  const hitStreakBonus = streakBonus > 0

  const [cardWidth, setCardWidth] = useState(() => Math.min(Dimensions.get('window').width - 32, 520))

  // Entrance: flip + scale
  const rotX = useRef(new Animated.Value(1)).current // 1 → 0
  const scale = useRef(new Animated.Value(0.75)).current
  const opacity = useRef(new Animated.Value(0)).current

  // Continuous coin spin (rotateY)
  const coinSpin = useRef(new Animated.Value(0)).current

  // Sheen sweep
  const sheen = useRef(new Animated.Value(0)).current

  // Glow pulse
  const glow = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.06,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 140,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(rotX, {
        toValue: 0,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()

    Animated.loop(
      Animated.timing(coinSpin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start()

    Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(sheen, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sheen, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    ).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1300, useNativeDriver: true }),
      ]),
    ).start()
  }, [])

  const rotateX = rotX.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '70deg'] })
  const coinRotate = coinSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-cardWidth, cardWidth] })
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.75] })

  const coins = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: 8 + ((i * 37) % 86),
        delay: (i % 6) * 140,
      })),
    [],
  )

  return (
    <Animated.View
      onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
      style={{
        opacity,
        transform: [{ perspective: 1200 }, { rotateX }, { scale }],
      }}
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Base gradient layers */}
      <View className="absolute inset-0 bg-amber-900" style={{ opacity: 0.35 }} />
      <View className="absolute inset-0 bg-neutral-950" style={{ opacity: 0.7 }} />

      {/* Pulsing golden glow border */}
      <Animated.View
        pointerEvents="none"
        style={{ opacity: glowOpacity }}
        className="absolute inset-0 rounded-2xl border-2 border-amber-400"
      />

      {/* Sheen sweep */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: cardWidth * 0.45,
          transform: [{ translateX: sheenX }, { skewX: '-18deg' }],
          backgroundColor: 'rgba(255,255,255,0.14)',
        }}
      />

      {/* Coin rain behind content */}
      <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
        {coins.map((c) => (
          <CoinRainParticle key={c.id} leftPct={c.left} delay={c.delay} cardWidth={cardWidth} />
        ))}
      </View>

      {/* Content */}
      <View className="relative items-center px-4 pt-5 pb-4">
        {total > 0 && (
          <>
            <Text
              className="text-amber-300 font-bold uppercase"
              style={{ fontSize: 10, letterSpacing: 3, marginBottom: 4 }}
            >
              {t('results.coinsWon', { defaultValue: 'Coins won' })}
            </Text>

            {/* Spinning coin + big total */}
            <View className="flex-row items-center gap-3 mb-3">
              <Animated.Text
                style={{
                  fontSize: 34,
                  transform: [{ perspective: 600 }, { rotateY: coinRotate }],
                  textShadowColor: 'rgba(251,191,36,0.55)',
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 10,
                }}
              >
                🪙
              </Animated.Text>
              <Text
                className="text-amber-300 font-black tabular-nums"
                style={{
                  fontSize: 44,
                  textShadowColor: 'rgba(251,191,36,0.5)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 8,
                }}
              >
                +{animatedTotal}
              </Text>
            </View>
          </>
        )}

        {/* Breakdown chips */}
        <View className="flex-row flex-wrap justify-center gap-1.5 mb-1">
          {levelUpEarned > 0 && (
            <BreakdownChip
              label={t('results.levelUpReward', { defaultValue: 'Level up' })}
              value={levelUpEarned}
              tone="base"
              icon="⚡"
              delay={450}
            />
          )}
          {dailyBonus > 0 && (
            <BreakdownChip
              label={t('results.dailyBonus', { defaultValue: 'Daily bonus' })}
              value={dailyBonus}
              tone="daily"
              icon="🌅"
              delay={600}
            />
          )}
          {streakBonus > 0 && (
            <BreakdownChip
              label={t('results.streakBonus', { defaultValue: '7-day streak!' })}
              value={streakBonus}
              tone="streak"
              icon="🔥"
              delay={750}
            />
          )}
          {gameCost > 0 && (
            <BreakdownChip
              label={t('results.gameCost', { defaultValue: 'Entry fee' })}
              value={-gameCost}
              tone="cost"
              icon="🎟️"
              delay={900}
            />
          )}
        </View>

        {/* 7-day streak pips */}
        {streakDay > 0 && (
          <View className="mt-3 pt-3 border-t border-amber-900/40 w-full items-center">
            <View className="flex-row items-center gap-1.5 mb-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <StreakPip key={i} index={i} streakDay={streakDay} hitStreakBonus={hitStreakBonus} />
              ))}
            </View>
            <Text className="text-amber-200 font-semibold" style={{ fontSize: 11, opacity: 0.85 }}>
              {t('results.streakProgress', { count: streakDay, defaultValue: `Day ${streakDay}/7 of your streak` })}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  )
}

function StreakPip({
  index,
  streakDay,
  hitStreakBonus,
}: {
  index: number
  streakDay: number
  hitStreakBonus: boolean
}) {
  const idx = index + 1
  const lit = idx <= streakDay
  const isBonus = idx === 7 && hitStreakBonus
  const scale = useRef(new Animated.Value(lit ? 0.3 : 1)).current

  useEffect(() => {
    if (!lit) return
    Animated.sequence([
      Animated.delay(500 + index * 70),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }),
    ]).start()
  }, [lit])

  return (
    <Animated.View
      style={{ transform: [{ scale }] }}
      className={[
        'w-5 h-5 rounded-full items-center justify-center border',
        lit
          ? isBonus
            ? 'bg-orange-500 border-orange-300'
            : 'bg-amber-400 border-amber-300'
          : 'bg-neutral-900 border-neutral-700',
      ].join(' ')}
    >
      <Text
        className={[
          'font-black',
          lit ? 'text-amber-950' : 'text-neutral-600',
        ].join(' ')}
        style={{ fontSize: 9 }}
      >
        {isBonus ? '🔥' : idx}
      </Text>
    </Animated.View>
  )
}
