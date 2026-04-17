import React, { useEffect, useMemo, useState, memo } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Full-screen cinematic overlay that plays when a player is eliminated.
 *
 * Flow:
 *   impact    (0.00s)  — screen flash + shake + radial shock ring
 *   flip      (0.10s)  — their card flips revealing their role & emoji
 *   stamp     (0.90s)  — role label "stamps" in at a tilt
 *   hold      (1.10s)  — subtle breathing glow while the user takes it in
 *   outro     (2.80s)  — fade out
 *
 * The overlay auto-dismisses after ~3.2s or on tap.
 */

export interface EliminationRevealProps {
  username: string
  role: string
  isRedHanded: boolean
  isSelf: boolean
  onDone: () => void
}

/** Role → pretty display. Kept in sync with GamePage/ResultsPage. */
const ROLE_META: Record<string, { icon: string; labelKey: string; defaultLabel: string; isEvil: boolean; color: string; glow: string }> = {
  red_handed:    { icon: '🔪', labelKey: 'game.roleRedHanded',     defaultLabel: 'Imposter',             isEvil: true,  color: '#f87171', glow: 'rgba(248,113,113,0.65)' },
  double_agent:  { icon: '🎭', labelKey: 'game.roleDoubleAgent',  defaultLabel: 'Double Agent',         isEvil: true,  color: '#fb923c', glow: 'rgba(251,146,60,0.65)' },
  detective:     { icon: '🔍', labelKey: 'game.roleDetective',    defaultLabel: 'Detective',            isEvil: false, color: '#60a5fa', glow: 'rgba(96,165,250,0.6)' },
  guardian:      { icon: '🛡️', labelKey: 'game.roleGuardian',     defaultLabel: 'Guardian',             isEvil: false, color: '#facc15', glow: 'rgba(250,204,21,0.6)' },
  mayor:         { icon: '⚖️', labelKey: 'game.roleMayor',        defaultLabel: 'Mayor',                isEvil: false, color: '#a5b4fc', glow: 'rgba(165,180,252,0.6)' },
  infiltrator:   { icon: '🥷', labelKey: 'game.roleInfiltrator',  defaultLabel: 'Infiltrator',          isEvil: true,  color: '#e879f9', glow: 'rgba(232,121,249,0.6)' },
  jester:        { icon: '🃏', labelKey: 'game.roleJester',       defaultLabel: 'Jester',               isEvil: false, color: '#f472b6', glow: 'rgba(244,114,182,0.6)' },
  judge:         { icon: '👨‍⚖️', labelKey: 'game.roleJudge',         defaultLabel: 'Judge',                isEvil: false, color: '#6ee7b7', glow: 'rgba(110,231,183,0.6)' },
  revenant:      { icon: '👻', labelKey: 'game.roleRevenant',     defaultLabel: 'Revenant',             isEvil: false, color: '#5eead4', glow: 'rgba(94,234,212,0.6)' },
  kamikaze:      { icon: '💥', labelKey: 'game.roleKamikaze',     defaultLabel: 'Kamikaze',             isEvil: true,  color: '#fca5a5', glow: 'rgba(252,165,165,0.6)' },
  corruptor:     { icon: '🕷️', labelKey: 'game.roleCorruptor',    defaultLabel: 'Corruptor',            isEvil: true,  color: '#fdba74', glow: 'rgba(253,186,116,0.6)' },
  inverter:      { icon: '🔄', labelKey: 'game.roleInverter',     defaultLabel: 'Inverter',             isEvil: true,  color: '#fda4af', glow: 'rgba(253,164,175,0.6)' },
  twin_villager: { icon: '👯', labelKey: 'game.roleTwinVillager', defaultLabel: 'Evil Twin (Villager)', isEvil: true,  color: '#d8b4fe', glow: 'rgba(216,180,254,0.6)' },
  twin_red_handed: { icon: '👯', labelKey: 'game.roleTwinRedHanded', defaultLabel: 'Evil Twin (Imposter)', isEvil: true,  color: '#c4b5fd', glow: 'rgba(196,181,253,0.6)' },
  villager:      { icon: '🏘️', labelKey: 'game.roleVillager',     defaultLabel: 'Villager',             isEvil: false, color: '#6ee7b7', glow: 'rgba(110,231,183,0.6)' },
}

export const EliminationReveal = memo(function EliminationReveal({
  username,
  role,
  isRedHanded,
  isSelf,
  onDone,
}: EliminationRevealProps) {
  const { t } = useTranslation()
  const [stage, setStage] = useState<'impact' | 'flip' | 'stamp' | 'hold' | 'outro'>('impact')

  const meta = ROLE_META[role] ?? ROLE_META.villager
  // good = caught an evil role, otherwise it's an innocent (or self)
  const caughtEvil = isRedHanded
  const primary = caughtEvil ? '#34d399' : '#f87171'
  const primaryGlow = caughtEvil ? 'rgba(52,211,153,0.65)' : 'rgba(248,113,113,0.65)'

  useEffect(() => {
    const t1 = setTimeout(() => setStage('flip'),  100)
    const t2 = setTimeout(() => setStage('stamp'), 900)
    const t3 = setTimeout(() => setStage('hold'),  1250)
    const t4 = setTimeout(() => setStage('outro'), 2800)
    const t5 = setTimeout(onDone, 3250)
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout)
  }, [onDone])

  // Pre-calc particle ring (memo so re-renders on stage change don't reroll)
  const particles = useMemo(() => Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2
    const dist = 140 + Math.random() * 110
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      size: 5 + Math.round(Math.random() * 8),
      delay: 50 + i * 18,
      hue: i % 3 === 0 ? '#fbbf24' : i % 3 === 1 ? '#ffffff' : primary,
    }
  }), [primary])

  const sparkles = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    id: i,
    left: 10 + Math.random() * 80,
    top:  15 + Math.random() * 70,
    delay: 400 + i * 90,
    size: 14 + Math.round(Math.random() * 18),
  })), [])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden select-none cursor-pointer"
      role="dialog"
      aria-label={`${username} was eliminated`}
      onClick={onDone}
      style={{
        opacity: stage === 'outro' ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      {/* Inline keyframes that only exist for this cinematic */}
      <style>{`
        @keyframes elim-shock   { 0%{ transform: scale(0.3); opacity: 1; } 100%{ transform: scale(3.5); opacity: 0; } }
        @keyframes elim-flash   { 0%,100%{ opacity:0 } 15%{ opacity:0.75 } 45%{ opacity:0 } }
        @keyframes elim-shake   { 0%,100%{transform:translateX(0)} 15%{transform:translateX(-14px)} 30%{transform:translateX(14px)} 45%{transform:translateX(-8px)} 60%{transform:translateX(8px)} 80%{transform:translateX(-3px)} }
        @keyframes elim-fly     {
          0%   { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
        }
        @keyframes elim-card-flip {
          0%   { transform: perspective(900px) rotateY(0deg)   scale(0.6); }
          45%  { transform: perspective(900px) rotateY(90deg)  scale(1.06); }
          100% { transform: perspective(900px) rotateY(180deg) scale(1); }
        }
        @keyframes elim-stamp   {
          0%   { opacity:0; transform: translate(-50%,-50%) scale(2.8) rotate(-16deg); filter: blur(6px); }
          55%  { opacity:1; transform: translate(-50%,-50%) scale(0.92) rotate(-4deg); filter: blur(0); }
          80%  {             transform: translate(-50%,-50%) scale(1.08) rotate(-10deg); }
          100% { opacity:1; transform: translate(-50%,-50%) scale(1)    rotate(-8deg); }
        }
        @keyframes elim-sparkle {
          0%   { transform: translate(-50%,-50%) scale(0) rotate(0deg);   opacity: 0; }
          25%  { opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1.4) rotate(220deg); opacity: 0; }
        }
        @keyframes elim-name-rise {
          0%   { opacity: 0; transform: translateY(24px); letter-spacing: 0.05em; }
          100% { opacity: 1; transform: translateY(0);   letter-spacing: 0.15em; }
        }
        @keyframes elim-bar-grow {
          0%   { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        @keyframes elim-rays {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Background gradient with shake on evil catch ─────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background: caughtEvil
            ? 'radial-gradient(ellipse at center, rgba(8,55,30,0.97) 0%, rgba(3,8,5,0.99) 75%)'
            : 'radial-gradient(ellipse at center, rgba(65,10,10,0.97) 0%, rgba(4,4,8,0.99) 75%)',
          animation: stage !== 'impact' ? 'elim-shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : undefined,
        }}
      />

      {/* Screen flash (pure white briefly) */}
      <div
        className="absolute inset-0 bg-white pointer-events-none"
        style={{ animation: 'elim-flash 0.55s ease forwards' }}
      />

      {/* Rotating ray of light (god-rays) behind the card for evil-catch */}
      {caughtEvil && stage !== 'impact' && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: '180vmin',
            height: '180vmin',
            background:
              'conic-gradient(from 0deg, transparent 0deg, rgba(52,211,153,0.18) 14deg, transparent 28deg, ' +
              'transparent 60deg, rgba(250,204,21,0.14) 74deg, transparent 88deg, ' +
              'transparent 120deg, rgba(52,211,153,0.16) 134deg, transparent 148deg, ' +
              'transparent 180deg, rgba(250,204,21,0.12) 194deg, transparent 208deg, ' +
              'transparent 240deg, rgba(52,211,153,0.16) 254deg, transparent 268deg, ' +
              'transparent 300deg, rgba(250,204,21,0.14) 314deg, transparent 328deg)',
            animation: 'elim-rays 9s linear infinite',
            filter: 'blur(2px)',
            opacity: stage === 'outro' ? 0 : 1,
            transition: 'opacity 0.4s ease',
          }}
        />
      )}

      {/* Expanding shock ring at impact */}
      <div
        className="absolute left-1/2 top-1/2 rounded-full border-4 pointer-events-none"
        style={{
          width: 220,
          height: 220,
          marginLeft: -110,
          marginTop: -110,
          borderColor: primary,
          boxShadow: `0 0 60px ${primaryGlow}`,
          animation: 'elim-shock 0.9s cubic-bezier(0.16,1,0.3,1) forwards',
        }}
      />

      {/* Particle burst (visible after the initial impact) */}
      {stage !== 'impact' && particles.map((p, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
          style={{
            width: p.size,
            height: p.size,
            background: p.hue,
            boxShadow: `0 0 ${p.size * 2}px ${p.hue}`,
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            animation: `elim-fly ${0.9 + Math.random() * 0.4}s cubic-bezier(0.22,1,0.36,1) forwards`,
            animationDelay: `${p.delay}ms`,
            opacity: 0,
          } as React.CSSProperties}
        />
      ))}

      {/* Floating sparkles scattered in the frame */}
      {stage !== 'impact' && sparkles.map(s => (
        <div
          key={s.id}
          className="absolute pointer-events-none"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            fontSize: s.size,
            animation: `elim-sparkle 1.4s ease-out forwards`,
            animationDelay: `${s.delay}ms`,
          }}
        >
          ✦
        </div>
      ))}

      {/* ── Centrepiece: flipping card ──────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 pointer-events-none">
        {/* Top "ELIMINATED" banner */}
        <div
          className="mb-4 px-4 py-1.5 rounded-full border uppercase text-[11px] font-black tracking-[0.25em]"
          style={{
            color: primary,
            borderColor: primary + '80',
            background: caughtEvil ? 'rgba(6,78,59,0.55)' : 'rgba(69,10,10,0.55)',
            boxShadow: `0 0 20px ${primaryGlow}, inset 0 0 12px ${primaryGlow}`,
            opacity: stage === 'impact' ? 0 : 1,
            transform: stage === 'impact' ? 'translateY(-12px)' : 'translateY(0)',
            transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1) 0.2s',
          }}
        >
          {isSelf
            ? t('elimReveal.youWereEliminated', 'You were eliminated')
            : caughtEvil
              ? t('elimReveal.caught', 'Caught!')
              : t('elimReveal.eliminated', 'Eliminated')}
        </div>

        {/* Flipping card */}
        <div
          className="relative"
          style={{
            width: 216,
            height: 288,
            perspective: 900,
          }}
        >
          <div
            className="relative w-full h-full"
            style={{
              transformStyle: 'preserve-3d',
              animation: stage !== 'impact'
                ? 'elim-card-flip 0.8s cubic-bezier(0.68,-0.3,0.27,1.35) forwards'
                : undefined,
              transform: 'perspective(900px) rotateY(0deg) scale(0.6)',
            }}
          >
            {/* Card back (the "mystery" side) */}
            <div
              className="absolute inset-0 rounded-3xl border-2 flex items-center justify-center"
              style={{
                backfaceVisibility: 'hidden',
                background:
                  'linear-gradient(135deg, rgba(30,27,75,0.95) 0%, rgba(49,46,129,0.9) 50%, rgba(15,23,42,0.95) 100%)',
                borderColor: 'rgba(139,92,246,0.6)',
                boxShadow:
                  '0 20px 60px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.08), 0 0 40px rgba(139,92,246,0.35)',
              }}
            >
              <div className="text-center">
                <div className="text-6xl mb-2 opacity-90" style={{ filter: 'drop-shadow(0 4px 16px rgba(139,92,246,0.6))' }}>❔</div>
                <div className="text-[10px] font-black tracking-[0.25em] text-brand-300 uppercase">Identity</div>
              </div>
            </div>

            {/* Card front (the revealed role) */}
            <div
              className="absolute inset-0 rounded-3xl border-2 flex flex-col items-center justify-center p-5 overflow-hidden"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: caughtEvil
                  ? 'linear-gradient(160deg, rgba(6,78,59,0.96) 0%, rgba(2,44,34,0.98) 50%, rgba(0,20,14,0.98) 100%)'
                  : 'linear-gradient(160deg, rgba(76,5,25,0.96) 0%, rgba(45,5,18,0.98) 50%, rgba(15,5,10,0.98) 100%)',
                borderColor: meta.color + 'b0',
                boxShadow:
                  `0 20px 60px rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,255,255,0.12), 0 0 60px ${meta.glow}`,
              }}
            >
              {/* Inner glow */}
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 30%, ${meta.color}25 0%, transparent 60%)`,
                }}
              />

              <div
                className="text-[10px] font-black tracking-[0.3em] uppercase mb-2"
                style={{ color: primary, opacity: 0.75 }}
              >
                {t('elimReveal.roleReveal', 'Role Reveal')}
              </div>

              <div
                className="text-7xl mb-2 relative"
                style={{
                  filter: `drop-shadow(0 6px 18px ${meta.glow})`,
                  animation: stage === 'hold' ? 'elim-bar-grow 0s, heartbeat 1.6s ease-in-out infinite' : undefined,
                }}
              >
                {meta.icon}
              </div>

              <div
                className="text-2xl font-black tracking-wide relative text-center"
                style={{
                  color: meta.color,
                  textShadow: `0 0 20px ${meta.glow}`,
                }}
              >
                {t(meta.labelKey, meta.defaultLabel)}
              </div>

              {/* Under-glow bar */}
              <div
                className="h-1 mt-4 rounded-full origin-left"
                style={{
                  width: '70%',
                  background: `linear-gradient(90deg, transparent 0%, ${meta.color} 50%, transparent 100%)`,
                  boxShadow: `0 0 12px ${meta.glow}`,
                  transform: 'scaleX(0)',
                  animation: stage === 'stamp' || stage === 'hold' || stage === 'outro'
                    ? 'elim-bar-grow 0.45s cubic-bezier(0.16,1,0.3,1) forwards'
                    : undefined,
                }}
              />
            </div>
          </div>

          {/* Rotated "STAMP" overlay on top of the card after flip */}
          {(stage === 'stamp' || stage === 'hold' || stage === 'outro') && (
            <div
              className="absolute top-1/2 left-1/2 pointer-events-none"
              style={{
                transform: 'translate(-50%,-50%) rotate(-8deg)',
                animation: 'elim-stamp 0.55s cubic-bezier(0.34,1.56,0.64,1) both',
              }}
            >
              <div
                className="px-4 py-1 rounded-lg border-[3px] text-xs font-black tracking-[0.35em] uppercase"
                style={{
                  color: primary,
                  borderColor: primary,
                  background: 'rgba(0,0,0,0.45)',
                  boxShadow: `0 0 22px ${primaryGlow}, inset 0 0 10px ${primaryGlow}`,
                  letterSpacing: '0.3em',
                }}
              >
                {caughtEvil
                  ? t('elimReveal.stampCaught', 'CAUGHT')
                  : t('elimReveal.stampDown', 'DOWN')}
              </div>
            </div>
          )}
        </div>

        {/* Username under card */}
        <div
          className="mt-7 font-black tracking-[0.15em] uppercase text-white text-xl sm:text-2xl"
          style={{
            animation: stage !== 'impact' ? 'elim-name-rise 0.5s cubic-bezier(0.16,1,0.3,1) 0.4s both' : undefined,
            textShadow: `0 2px 12px rgba(0,0,0,0.8), 0 0 22px ${primaryGlow}`,
          }}
        >
          {username}
        </div>

        {/* Subtitle / flavor */}
        <div
          className="mt-2 text-sm"
          style={{
            color: caughtEvil ? '#6ee7b7' : '#fca5a5',
            animation: stage !== 'impact' ? 'elim-name-rise 0.5s cubic-bezier(0.16,1,0.3,1) 0.55s both' : undefined,
            opacity: stage === 'impact' ? 0 : 0.9,
          }}
        >
          {isSelf
            ? t('elimReveal.subtitleYou', 'The village turned on you…')
            : caughtEvil
              ? t('elimReveal.subtitleCaught', 'The mole is out. Good work, village.')
              : t('elimReveal.subtitleInnocent', 'An innocent was voted out.')}
        </div>

        <div
          className="mt-6 text-[11px] uppercase tracking-[0.3em] text-neutral-500"
          style={{
            animation: stage === 'hold' ? 'fadeIn 0.4s ease both' : undefined,
            opacity: stage === 'hold' || stage === 'outro' ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          {t('common.tapToContinue', 'Tap to continue')}
        </div>
      </div>
    </div>
  )
})
