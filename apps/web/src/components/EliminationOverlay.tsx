import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  playerName: string
  role: string
  isMe: boolean
  reason?: 'said_word'
  onDone: () => void
}

const ROLE_CONFIG = {
  imposter:     { emoji: '🔪', textClass: 'text-red-400',     borderColor: '#ef4444', glowRgba: 'rgba(239,68,68,0.35)',     bgClass: 'from-red-950/80 to-neutral-950/90' },
  double_agent: { emoji: '🎭', textClass: 'text-orange-400',  borderColor: '#f97316', glowRgba: 'rgba(249,115,22,0.35)',    bgClass: 'from-orange-950/80 to-neutral-950/90' },
  detective:    { emoji: '🔍', textClass: 'text-blue-400',    borderColor: '#3b82f6', glowRgba: 'rgba(59,130,246,0.35)',    bgClass: 'from-blue-950/80 to-neutral-950/90' },
  villager:     { emoji: '🏘️', textClass: 'text-neutral-400', borderColor: '#525252', glowRgba: 'rgba(82,82,82,0.35)',      bgClass: 'from-neutral-900/90 to-neutral-950/90' },
}

const WORD_SAID_CONFIG = {
  emoji: '💬',
  textClass: 'text-amber-400',
  borderColor: '#d97706',
  glowRgba: 'rgba(245,158,11,0.40)',
  bgClass: 'from-amber-950/80 to-neutral-950/90',
}

export function EliminationOverlay({ playerName, role, isMe, reason, onDone }: Props) {
  const { t } = useTranslation()
  const isWordSaid = reason === 'said_word'
  const cfg = isWordSaid ? WORD_SAID_CONFIG : (ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.villager)

  // Slightly longer display for word-said (more dramatic)
  const exitDelay = isWordSaid ? (isMe ? 4000 : 3600) : (isMe ? 3200 : 2800)
  const doneDelay = isWordSaid ? (isMe ? 4500 : 4100) : (isMe ? 3700 : 3300)

  const [stage, setStage] = useState<'entering' | 'visible' | 'exiting'>('entering')
  const [showBadge, setShowBadge] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setStage('visible'), 50)
    const t2 = setTimeout(() => setShowBadge(true), 500)
    const t3 = setTimeout(() => setStage('exiting'), exitDelay)
    const t4 = setTimeout(() => onDone(), doneDelay)
    return () => [t1, t2, t3, t4].forEach(clearTimeout)
  }, [exitDelay, doneDelay, onDone])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{
        transition: 'opacity 0.45s ease-out',
        opacity: stage === 'exiting' ? 0 : 1,
      }}
    >
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background: isWordSaid
            ? 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(180,100,0,0.18) 0%, rgba(0,0,0,0.82) 70%)'
            : isMe
              ? 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(180,10,10,0.18) 0%, rgba(0,0,0,0.82) 70%)'
              : 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(4px)',
          transition: 'opacity 0.3s ease',
          opacity: stage === 'entering' ? 0 : 1,
        }}
      />

      {/* Card */}
      <div
        className={`relative flex flex-col items-center gap-4 px-10 py-8 rounded-3xl border bg-gradient-to-b ${cfg.bgClass} max-w-sm mx-4 text-center`}
        style={{
          borderColor: isMe && !isWordSaid ? '#7f1d1d' : cfg.borderColor,
          boxShadow: `0 0 40px ${cfg.glowRgba}, 0 24px 60px rgba(0,0,0,0.6)`,
          transition: 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
          transform: stage === 'entering'
            ? 'translateY(-60px) scale(0.75)'
            : stage === 'exiting'
            ? 'translateY(20px) scale(0.92)'
            : 'translateY(0) scale(1)',
          opacity: stage === 'entering' ? 0 : stage === 'exiting' ? 0 : 1,
        }}
      >
        {/* Main emoji */}
        <div
          style={{
            fontSize: isMe ? '72px' : '56px',
            lineHeight: 1,
            transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s',
            transform: stage === 'visible' ? 'scale(1) rotate(0deg)' : 'scale(0) rotate(-30deg)',
            filter: isWordSaid
              ? `drop-shadow(0 0 12px ${cfg.glowRgba})`
              : isMe ? 'drop-shadow(0 0 12px rgba(239,68,68,0.6))' : undefined,
          }}
        >
          {isWordSaid ? cfg.emoji : isMe ? '💀' : cfg.emoji}
        </div>

        {/* Title */}
        <div>
          {isWordSaid ? (
            isMe ? (
              <p className="text-2xl font-extrabold text-white tracking-tight leading-tight">
                {t('game.youSaidTheWord')}
              </p>
            ) : (
              <>
                <p className="text-xl font-extrabold text-white tracking-tight">{playerName}</p>
                <p className="text-sm text-amber-400 mt-0.5">{t('game.saidTheWordSubtitle')}</p>
              </>
            )
          ) : isMe ? (
            <p className="text-2xl font-extrabold text-white tracking-tight leading-tight">
              {t('game.youEliminated')}
            </p>
          ) : (
            <>
              <p className="text-xl font-extrabold text-white tracking-tight">{playerName}</p>
              <p className="text-sm text-neutral-500 mt-0.5">{t('game.wasEliminatedAnim')}</p>
            </>
          )}
        </div>

        {/* Badge — slides in */}
        <div
          style={{
            transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            opacity: showBadge ? 1 : 0,
            transform: showBadge ? 'scale(1) translateY(0)' : 'scale(0.6) translateY(8px)',
          }}
        >
          {isWordSaid ? (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${cfg.textClass}`}
              style={{ borderColor: cfg.borderColor, backgroundColor: `${cfg.glowRgba.replace('0.40', '0.12')}` }}
            >
              <span>⚠️</span>
              <span>{t('game.saidTheWordBadge')}</span>
            </div>
          ) : (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${cfg.textClass}`}
              style={{ borderColor: cfg.borderColor, backgroundColor: `${cfg.glowRgba.replace('0.35', '0.12')}` }}
            >
              <span>{cfg.emoji}</span>
              <span>
                {role === 'imposter'     ? t('game.roleImposter')
                 : role === 'double_agent' ? t('game.roleDoubleAgent')
                 : role === 'detective'    ? t('game.roleDetective')
                 : t('game.roleVillager')}
              </span>
            </div>
          )}
        </div>

        {/* Ghost hint for self-elimination */}
        {isMe && (
          <p
            className="text-xs text-neutral-600"
            style={{ transition: 'opacity 0.5s ease 0.8s', opacity: showBadge ? 1 : 0 }}
          >
            {t('game.youGhost')}
          </p>
        )}
      </div>
    </div>
  )
}
