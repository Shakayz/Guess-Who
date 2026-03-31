import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  role: string
  word: string
  villagerWord?: string
  onDone: () => void
}

// 8 burst directions (px offset from center)
const PARTICLES = [
  { dx:   0, dy: -130 },
  { dx:  92, dy:  -92 },
  { dx: 130, dy:    0 },
  { dx:  92, dy:   92 },
  { dx:   0, dy:  130 },
  { dx: -92, dy:   92 },
  { dx:-130, dy:    0 },
  { dx: -92, dy:  -92 },
]

const GLOW = 'rgba(139,92,246,0.45)'
const BORDER = '#7c3aed'

export function RoleRevealScreen({ word, villagerWord, onDone }: Props) {
  const { t } = useTranslation()
  const isDoubleAgent = !!villagerWord

  const [appeared, setAppeared]                   = useState(false)
  const [flipped, setFlipped]                     = useState(false)
  const [showWord, setShowWord]                   = useState(false)
  const [particlesVisible, setParticlesVisible]   = useState(false)
  const [particlesExpanded, setParticlesExpanded] = useState(false)
  const [exiting, setExiting]                     = useState(false)

  useEffect(() => {
    const t0 = setTimeout(() => setAppeared(true), 80)
    const t1 = setTimeout(() => {
      setFlipped(true)
      setParticlesVisible(true)
      setTimeout(() => setParticlesExpanded(true), 40)
      setTimeout(() => setParticlesVisible(false), 950)
    }, 1100)
    const t2 = setTimeout(() => setShowWord(true), 2050)
    const t3 = setTimeout(() => setExiting(true), 3900)
    const t4 = setTimeout(() => onDone(), 4350)
    return () => [t0, t1, t2, t3, t4].forEach(clearTimeout)
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center select-none"
      style={{
        backgroundColor: 'rgba(3, 3, 8, 0.97)',
        transition: 'opacity 0.45s ease-out',
        opacity: exiting ? 0 : 1,
      }}
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 65% 55% at 50% 45%, ${GLOW.replace('0.45', '0.10')} 0%, transparent 70%)`,
          transition: 'opacity 1.1s ease',
          opacity: flipped ? 1 : 0,
        }}
      />

      {/* Card + particles wrapper */}
      <div className="relative" style={{ perspective: '1200px' }}>

        {/* Particle burst */}
        {particlesVisible && PARTICLES.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '11px',
              height: '11px',
              borderRadius: '50%',
              backgroundColor: BORDER,
              boxShadow: `0 0 8px ${BORDER}`,
              transition: `transform 0.85s cubic-bezier(0.1, 0.9, 0.2, 1) ${i * 22}ms, opacity 0.85s ease-out ${i * 22}ms`,
              transform: particlesExpanded
                ? `translate(calc(-50% + ${p.dx}px), calc(-50% + ${p.dy}px)) scale(0)`
                : 'translate(-50%, -50%) scale(2)',
              opacity: particlesExpanded ? 0 : 1,
            }}
          />
        ))}

        {/* 3-D flip card */}
        <div
          style={{
            width: isDoubleAgent ? '280px' : '240px',
            height: '320px',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transition: flipped
              ? 'transform 0.9s cubic-bezier(0.45, 0.05, 0.55, 0.95)'
              : 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
            transform: appeared
              ? flipped ? 'rotateY(180deg) scale(1)' : 'rotateY(0deg) scale(1)'
              : 'rotateY(0deg) scale(0.25) translateY(50px)',
            opacity: appeared ? 1 : 0,
          }}
        >
          {/* ── FRONT (question mark) ── */}
          <div
            className="absolute inset-0 rounded-2xl border-2 overflow-hidden flex flex-col items-center justify-center gap-3"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              backgroundColor: '#060610',
              borderColor: '#1e1e38',
            }}
          >
            {/* Shimmer sweep */}
            <div className="absolute inset-0 overflow-hidden" style={{ opacity: 0.18 }}>
              <div
                style={{
                  position: 'absolute',
                  top: '-20%',
                  bottom: '-20%',
                  width: '55%',
                  background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
                  animation: 'shimmerCard 2.4s linear infinite',
                }}
              />
            </div>
            {[80, 148, 216, 284].map((size) => (
              <div
                key={size}
                className="absolute rounded-full"
                style={{ width: `${size}px`, height: `${size}px`, border: '1px solid rgba(255,255,255,0.04)' }}
              />
            ))}
            <span className="relative z-10 font-black select-none leading-none" style={{ fontSize: '96px', color: '#16163a', lineHeight: 1 }}>?</span>
            <p className="relative z-10 font-bold uppercase tracking-[0.35em] text-[9px]" style={{ color: '#1e1e40' }}>
              {t('game.discoverRole')}
            </p>
          </div>

          {/* ── BACK (word revealed) ── */}
          <div
            className="absolute inset-0 rounded-2xl border-2 overflow-hidden flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-violet-950 via-purple-900/60 to-neutral-950"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderColor: BORDER,
              boxShadow: `0 0 30px ${GLOW}, 0 0 80px ${GLOW.replace('0.45', '0.12')}`,
            }}
          >
            {/* Specular highlight */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: '180px', height: '180px', top: '-50px', left: '-50px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 65%)',
              }}
            />
            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: `linear-gradient(${BORDER} 1px, transparent 1px), linear-gradient(90deg, ${BORDER} 1px, transparent 1px)`,
                backgroundSize: '32px 32px',
              }}
            />

            {/* Label */}
            <p className="relative z-10 text-[9px] font-bold uppercase tracking-[0.38em] text-violet-400">
              {t('game.yourWordLabel')}
            </p>

            {/* Word(s) */}
            <div
              className="relative z-10 text-center px-5 w-full"
              style={{
                transition: 'opacity 0.45s ease, transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
                opacity: showWord ? 1 : 0,
                transform: showWord ? 'scale(1)' : 'scale(0.55)',
              }}
            >
              {isDoubleAgent ? (
                <div className="flex gap-2 justify-center">
                  <div className="flex-1 rounded-xl px-3 py-3 border border-violet-700/30 bg-violet-900/20">
                    <p className="text-[20px] font-extrabold text-white leading-tight">{villagerWord}</p>
                  </div>
                  <div className="flex-1 rounded-xl px-3 py-3 border border-violet-700/30 bg-violet-900/20">
                    <p className="text-[20px] font-extrabold text-white leading-tight">{word}</p>
                  </div>
                </div>
              ) : (
                <p className="text-[32px] font-extrabold text-white leading-tight">{word}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmerCard {
          0%   { transform: translateX(-120%) skewX(-12deg); }
          100% { transform: translateX(320%)  skewX(-12deg); }
        }
      `}</style>
    </div>
  )
}
