import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Props for the reveal card. All numbers are optional; the card shows the
 * breakdown rows only for the bonuses that were actually earned.
 */
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

/** Ease-out cubic tween from 0 → target over `duration` ms, no re-renders. */
function useCountUp(target: number, duration = 1100, delay = 400): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    let start: number | null = null
    const timeout = setTimeout(() => {
      const step = (ts: number) => {
        if (start === null) start = ts
        const p = Math.min((ts - start) / duration, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        setValue(Math.round(target * eased))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(raf)
    }
  }, [target, duration, delay])
  return value
}

/**
 * Flashy "you won coins" reveal card for the results screen.
 * - 3D flip-in entrance (perspective + rotateX/Y)
 * - Spinning coin, animated total, sheen sweep, coin-rain particles
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

  // Coin-rain: 14 coins with pseudo-random horizontal offsets + delays.
  const COINS = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: 8 + ((i * 37) % 86), // % across the card
      delay: (i % 7) * 0.12,
      dx: (((i * 53) % 60) - 30) + 'px',
    })),
  ).current

  const streakDay = newStreakCount > 0 ? ((newStreakCount - 1) % 7) + 1 : 0
  const hitStreakBonus = streakBonus > 0

  return (
    <div
      className="relative [perspective:1200px]"
      role="status"
      aria-label={t('results.coinsWonAria', { count: total, defaultValue: `You won ${total} coins` })}
    >
      <div className="relative overflow-hidden rounded-2xl origin-bottom animate-card-flip-hero [transform-style:preserve-3d] will-change-transform">
        {/* Gradient shell */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/25 via-orange-500/10 to-yellow-300/20" />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/85 via-neutral-950/90 to-neutral-950" />

        {/* Animated golden glow ring */}
        <div className="absolute inset-0 rounded-2xl border border-amber-400/40 animate-glow-pulse pointer-events-none" />

        {/* Diagonal sheen sweep */}
        <div className="absolute inset-y-0 -inset-x-1/3 pointer-events-none">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-sheen-sweep" />
        </div>

        {/* Coin rain (behind content) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {COINS.map((c) => (
            <span
              key={c.id}
              className="absolute text-amber-300/90 animate-coin-rain text-lg select-none"
              style={{
                left: `${c.left}%`,
                top: '-6px',
                animationDelay: `${c.delay}s`,
                // @ts-expect-error -- CSS var for keyframe
                '--cx': c.dx,
                filter: 'drop-shadow(0 2px 4px rgba(251,191,36,0.35))',
              }}
            >
              ⭐
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="relative px-5 pt-5 pb-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/80 mb-1">
            {t('results.coinsWon', { defaultValue: 'Coins won' })}
          </p>

          {/* Spinning coin + big total */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <span
              className="inline-block text-4xl animate-coin-spin"
              style={{ transformStyle: 'preserve-3d', filter: 'drop-shadow(0 4px 10px rgba(251,191,36,0.55))' }}
              aria-hidden
            >
              🪙
            </span>
            <span className="text-5xl font-black tabular-nums bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_6px_rgba(251,191,36,0.35)]">
              +{animatedTotal}
            </span>
          </div>

          {/* Breakdown chips */}
          <div className="flex flex-wrap justify-center gap-1.5 mb-1">
            {levelUpEarned > 0 && (
              <BreakdownChip
                label={t('results.levelUpReward', { defaultValue: 'Level up' })}
                value={levelUpEarned}
                tone="base"
                icon="⚡"
                delay="0.45s"
              />
            )}
            {dailyBonus > 0 && (
              <BreakdownChip
                label={t('results.dailyBonus')}
                value={dailyBonus}
                tone="daily"
                icon="🌅"
                delay="0.6s"
              />
            )}
            {streakBonus > 0 && (
              <BreakdownChip
                label={t('results.streakBonus')}
                value={streakBonus}
                tone="streak"
                icon="🔥"
                delay="0.75s"
              />
            )}
            {gameCost > 0 && (
              <BreakdownChip
                label={t('results.gameCost')}
                value={-gameCost}
                tone="cost"
                icon="🎟️"
                delay="0.9s"
              />
            )}
          </div>

          {/* 7-day streak pips */}
          {streakDay > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-900/40">
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                {Array.from({ length: 7 }).map((_, i) => {
                  const idx = i + 1
                  const lit = idx <= streakDay
                  const isBonus = idx === 7 && hitStreakBonus
                  return (
                    <span
                      key={i}
                      className={[
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border transition-transform',
                        lit
                          ? isBonus
                            ? 'bg-gradient-to-br from-orange-400 to-amber-600 border-orange-300 text-amber-950 shadow-[0_0_12px_rgba(251,146,60,0.8)] animate-pop-in'
                            : 'bg-gradient-to-br from-amber-300 to-amber-500 border-amber-300 text-amber-950 shadow-[0_0_8px_rgba(251,191,36,0.55)] animate-pop-in'
                          : 'bg-neutral-900/70 border-neutral-700/70 text-neutral-600',
                      ].join(' ')}
                      style={{ animationDelay: `${0.5 + i * 0.07}s` }}
                      aria-label={lit ? `day-${idx}-lit` : `day-${idx}-pending`}
                    >
                      {isBonus ? '🔥' : idx}
                    </span>
                  )
                })}
              </div>
              <p className="text-[11px] text-amber-200/80 font-semibold">
                {t('results.streakProgress', { count: streakDay })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** A small animated chip that pops in to show one line of the breakdown. */
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
  delay: string
}) {
  const toneClasses: Record<typeof tone, string> = {
    base:   'bg-amber-950/50  border-amber-700/50  text-amber-200',
    daily:  'bg-yellow-950/60 border-yellow-600/60 text-yellow-200',
    streak: 'bg-orange-950/70 border-orange-500/70 text-orange-200',
    cost:   'bg-neutral-900/70 border-neutral-600/50 text-red-300',
  }
  const sign = value >= 0 ? '+' : '−'
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold opacity-0 animate-pop-in',
        toneClasses[tone],
      ].join(' ')}
      style={{ animationDelay: delay, animationFillMode: 'forwards' }}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
      <span className="tabular-nums font-bold">
        {sign}
        {Math.abs(value)}⭐
      </span>
    </span>
  )
}
