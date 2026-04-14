import React, { useEffect, useMemo, useState } from 'react'

interface Props {
  /** The achievement key of the card the burst should anchor to. */
  targetKey: string
  /** Stars amount shown in the floating label. */
  stars: number
  /** Called when the burst animation finishes (used to unmount). */
  onDone: () => void
}

/**
 * Big-budget achievement-unlock celebration:
 *   • expanding shock ring + radial glow
 *   • 14 star particles flying radially with spin
 *   • 6 light-rays fanning out behind the card
 *   • confetti rain falling from the top of the viewport
 *   • floating "+N⭐" label that rises above the card
 *   • brief screen-wide flash + jelly-squeeze on the card itself
 *
 * Auto-dismisses after ~1.6s.
 */
export function ClaimBurst({ targetKey, stars, onDone }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const el = document.getElementById(`achievement-card-${targetKey}`)
    if (el) {
      setRect(el.getBoundingClientRect())
      // Jellier pop + small brightness kick
      el.classList.add('animate-jelly')
      const timer = setTimeout(() => el.classList.remove('animate-jelly'), 650)
      return () => clearTimeout(timer)
    }
  }, [targetKey])

  useEffect(() => {
    const t = setTimeout(onDone, 1700)
    return () => clearTimeout(t)
  }, [onDone])

  // Pre-compute particles so they don't re-roll on re-render
  const particles = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.35
    const radius = 90 + Math.random() * 40
    return {
      dx: Math.cos(angle) * radius,
      dy: Math.sin(angle) * radius,
      delay: i * 18,
      emoji: i % 5 === 0 ? '✨' : i % 3 === 0 ? '💫' : '⭐',
      size: 18 + Math.round(Math.random() * 14),
    }
  }), [targetKey])

  const confetti = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 1.6 + Math.random() * 1.2,
    size: 5 + Math.random() * 7,
    sway: -30 + Math.random() * 60,
    hue: ['#fbbf24','#f59e0b','#fde68a','#ffffff','#a78bfa','#60a5fa'][i % 6],
  })), [targetKey])

  if (!rect) return null

  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]" aria-hidden="true">
      <style>{`
        @keyframes cb-ring {
          0%   { transform: translate(-50%,-50%) scale(0.3); opacity: 1; border-width: 6px; }
          100% { transform: translate(-50%,-50%) scale(3.2); opacity: 0; border-width: 1px; }
        }
        @keyframes cb-rays {
          0%   { transform: translate(-50%,-50%) rotate(0deg)   scale(0.2); opacity: 0; }
          25%  { opacity: 0.9; }
          100% { transform: translate(-50%,-50%) rotate(80deg)  scale(2.2); opacity: 0; }
        }
        @keyframes cb-flash {
          0%,100% { opacity: 0; }
          20%      { opacity: 0.45; }
        }
        @keyframes cb-confetti {
          0%   { transform: translate3d(0, -40px, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--sway), 80vh, 0) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {/* Screen-wide brief flash */}
      <div
        className="absolute inset-0 bg-amber-200"
        style={{ animation: 'cb-flash 0.6s ease forwards', opacity: 0 }}
      />

      {/* Expanding shock ring */}
      <div
        className="absolute rounded-full border-[6px] border-amber-300"
        style={{
          left: cx,
          top:  cy,
          width: 160,
          height: 160,
          boxShadow: '0 0 50px rgba(251,191,36,0.7)',
          animation: 'cb-ring 1.0s cubic-bezier(0.16,1,0.3,1) forwards',
        }}
      />

      {/* Light rays fanning out */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top:  cy,
          width: 360,
          height: 360,
          background:
            'conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.7) 6deg, transparent 30deg, ' +
            'transparent 60deg, rgba(251,191,36,0.5) 66deg, transparent 90deg, ' +
            'transparent 120deg, rgba(251,191,36,0.7) 126deg, transparent 150deg, ' +
            'transparent 180deg, rgba(251,191,36,0.5) 186deg, transparent 210deg, ' +
            'transparent 240deg, rgba(251,191,36,0.7) 246deg, transparent 270deg, ' +
            'transparent 300deg, rgba(251,191,36,0.5) 306deg, transparent 330deg)',
          animation: 'cb-rays 1.1s ease-out forwards',
          mixBlendMode: 'screen',
        }}
      />

      {/* Radial glow */}
      <div
        className="absolute w-40 h-40 rounded-full animate-radial-glow"
        style={{
          left: cx,
          top:  cy,
          background: 'radial-gradient(circle, rgba(251,191,36,0.9) 0%, rgba(251,191,36,0.3) 40%, transparent 70%)',
          filter: 'blur(2px)',
        }}
      />

      {/* Star particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute animate-star-fly"
          style={{
            left: cx,
            top:  cy,
            fontSize: p.size,
            filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.8))',
            ['--dx' as any]: `${p.dx}px`,
            ['--dy' as any]: `${p.dy}px`,
            animationDelay: `${p.delay}ms`,
          }}
        >
          {p.emoji}
        </div>
      ))}

      {/* Confetti rain (whole screen) */}
      {confetti.map(c => (
        <div
          key={c.id}
          className="absolute rounded-sm"
          style={{
            left: `${c.left}%`,
            top: 0,
            width: c.size,
            height: c.size * 1.5,
            background: c.hue,
            boxShadow: `0 0 4px ${c.hue}`,
            ['--sway' as any]: `${c.sway}px`,
            animation: `cb-confetti ${c.duration}s cubic-bezier(0.37,0,0.63,1) ${c.delay}s forwards`,
          }}
        />
      ))}

      {/* Floating +N⭐ label */}
      <div
        className="absolute text-amber-300 font-black text-2xl animate-burst-label"
        style={{
          left: cx,
          top: cy - 20,
          filter: 'drop-shadow(0 4px 16px rgba(251,191,36,0.9))',
          textShadow: '0 0 12px rgba(251,191,36,0.8)',
        }}
      >
        +{stars}⭐
      </div>
    </div>
  )
}
