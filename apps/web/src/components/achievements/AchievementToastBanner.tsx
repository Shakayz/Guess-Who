import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSocialStore, type AchievementToast } from '../../store/social'

const DIFFICULTY_RING: Record<string, string> = {
  bronze:   'ring-amber-700/70  from-amber-600/30   to-amber-800/20',
  silver:   'ring-slate-400/70  from-slate-300/20   to-slate-500/10',
  gold:     'ring-yellow-400/80 from-yellow-400/25  to-yellow-600/15',
  platinum: 'ring-cyan-300/80   from-cyan-300/25    to-cyan-500/15',
  diamond:  'ring-sky-300/90    from-sky-300/30     to-indigo-500/20',
  mythic:   'ring-fuchsia-400/90 from-fuchsia-500/30 via-amber-400/20 to-cyan-400/30',
}

const DIFFICULTY_GLOW: Record<string, string> = {
  bronze:   '0 0 22px rgba(180,83,9,0.45)',
  silver:   '0 0 22px rgba(203,213,225,0.45)',
  gold:     '0 0 26px rgba(250,204,21,0.55)',
  platinum: '0 0 26px rgba(103,232,249,0.55)',
  diamond:  '0 0 30px rgba(125,211,252,0.65)',
  mythic:   '0 0 34px rgba(232,121,249,0.7)',
}

/**
 * Renders a stack of dismissible achievement-unlock toasts from the social
 * store. Each toast now plays a 3D card-flip entrance: the back of the card
 * (locked sigil) flips over to reveal the unlocked achievement.
 * Auto-dismisses after 6s, or earlier when clicked.
 * Clicking the body routes to /achievements so the user can claim the reward.
 */
export function AchievementToastBanner() {
  const toasts = useSocialStore((s) => s.achievementToasts)
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
      {toasts.map((toast, i) => (
        <AchievementToastItem key={toast.id} toast={toast} index={i} />
      ))}
    </div>
  )
}

function AchievementToastItem({ toast, index }: { toast: AchievementToast; index: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dismiss = useSocialStore((s) => s.dismissAchievementToast)
  const ringClass = DIFFICULTY_RING[toast.difficulty] ?? DIFFICULTY_RING.bronze
  const glow = DIFFICULTY_GLOW[toast.difficulty] ?? DIFFICULTY_GLOW.bronze

  // Flip starts on back (rotateY 180°), settles on front after ~700ms.
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    const flipDelay = 180 + index * 90
    const flipTimer = setTimeout(() => setFlipped(true), flipDelay)
    const dismissTimer = setTimeout(() => dismiss(toast.id), 6000)
    return () => {
      clearTimeout(flipTimer)
      clearTimeout(dismissTimer)
    }
  }, [toast.id, dismiss, index])

  return (
    <div
      className="pointer-events-auto [perspective:1400px]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <button
        onClick={() => {
          dismiss(toast.id)
          navigate('/achievements')
        }}
        aria-label={`${toast.name} — ${t('achievements.unlockedToast')}`}
        className="relative w-full text-left"
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 750ms cubic-bezier(0.34, 1.4, 0.5, 1)',
          transform: flipped ? 'rotateY(0deg)' : 'rotateY(180deg)',
        }}
      >
        {/* FRONT — revealed side */}
        <div
          className={[
            'relative flex items-center gap-3 px-4 py-3 rounded-2xl overflow-hidden',
            'border border-amber-500/40 bg-gradient-to-br bg-brand-950/95 backdrop-blur',
            'ring-2 shadow-2xl hover:scale-[1.02] transition-transform',
            ringClass,
          ].join(' ')}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            boxShadow: `${glow}, 0 20px 40px -20px rgba(0,0,0,0.6)`,
          }}
        >
          {/* Sheen sweep */}
          <div className="absolute inset-y-0 -inset-x-1/3 pointer-events-none">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-sheen-sweep" />
          </div>
          <div className="text-3xl flex-shrink-0 animate-pop-in" style={{ animationDelay: '0.55s' }}>
            {toast.icon}
          </div>
          <div className="flex-1 min-w-0 relative">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
              {t('achievements.unlockedToast')}
            </p>
            <p className="text-white font-bold text-sm truncate">{toast.name}</p>
            <p className="text-xs text-amber-200 font-semibold">
              {t('achievements.claimNow')} · +{toast.starsReward}⭐
            </p>
          </div>
        </div>

        {/* BACK — locked sigil (shown before flip lands) */}
        <div
          className={[
            'absolute inset-0 flex items-center justify-center rounded-2xl overflow-hidden',
            'border border-brand-700/60 bg-gradient-to-br from-brand-900/90 via-brand-950/95 to-black/80 backdrop-blur',
            'ring-2 ring-brand-600/40',
          ].join(' ')}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            boxShadow: '0 20px 40px -20px rgba(0,0,0,0.6)',
          }}
        >
          {/* Ornamental rune pattern */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(124,58,237,0.35) 0 2px, transparent 2px 14px)',
            }}
          />
          <div className="relative text-3xl">✨</div>
        </div>
      </button>
    </div>
  )
}
