import React, { useEffect, useState } from 'react'

interface Props {
  /** The achievement key of the card the burst should anchor to. */
  targetKey: string
  /** Stars amount shown in the floating label. */
  stars: number
  /** Called when the burst animation finishes (used to unmount). */
  onDone: () => void
}

/**
 * CSS-only celebration overlay. Positions itself over the claimed card via
 * getBoundingClientRect(), spawns a radial glow, 6 flying star particles at
 * evenly spaced angles, and a `+N⭐` floating label. Auto-dismisses after
 * 1.2s via the `onDone` callback.
 */
export function ClaimBurst({ targetKey, stars, onDone }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const el = document.getElementById(`achievement-card-${targetKey}`)
    if (el) {
      setRect(el.getBoundingClientRect())
      el.classList.add('animate-burst-pop')
      const timer = setTimeout(() => el.classList.remove('animate-burst-pop'), 600)
      return () => clearTimeout(timer)
    }
  }, [targetKey])

  useEffect(() => {
    const t = setTimeout(onDone, 1200)
    return () => clearTimeout(t)
  }, [onDone])

  if (!rect) return null

  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2
    const radius = 70 + Math.random() * 20
    const dx = Math.cos(angle) * radius
    const dy = Math.sin(angle) * radius
    return { dx, dy, delay: i * 20 }
  })

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]" aria-hidden="true">
      {/* Radial glow */}
      <div
        className="absolute w-32 h-32 rounded-full animate-radial-glow"
        style={{
          left: cx,
          top: cy,
          background: 'radial-gradient(circle, rgba(251,191,36,0.8) 0%, rgba(251,191,36,0.2) 40%, transparent 70%)',
        }}
      />

      {/* Star particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute text-2xl animate-star-fly"
          style={{
            left: cx,
            top: cy,
            // CSS custom properties read by the keyframe
            ['--dx' as any]: `${p.dx}px`,
            ['--dy' as any]: `${p.dy}px`,
            animationDelay: `${p.delay}ms`,
          }}
        >
          ⭐
        </div>
      ))}

      {/* Floating +N⭐ label */}
      <div
        className="absolute text-amber-300 font-extrabold text-xl animate-burst-label drop-shadow-[0_2px_8px_rgba(251,191,36,0.8)]"
        style={{ left: cx, top: cy - 10 }}
      >
        +{stars}⭐
      </div>
    </div>
  )
}
