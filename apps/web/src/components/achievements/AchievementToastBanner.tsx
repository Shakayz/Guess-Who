import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSocialStore, type AchievementToast } from '../../store/social'

const DIFFICULTY_RING: Record<string, string> = {
  bronze:   'ring-amber-700/60 from-amber-600/30 to-amber-800/20',
  silver:   'ring-slate-400/60 from-slate-300/20 to-slate-500/10',
  gold:     'ring-yellow-400/70 from-yellow-400/25 to-yellow-600/15',
  platinum: 'ring-cyan-300/70 from-cyan-300/25 to-cyan-500/15',
  diamond:  'ring-sky-300/80 from-sky-300/30 to-indigo-500/20',
  mythic:   'ring-fuchsia-400/90 from-fuchsia-500/30 via-amber-400/20 to-cyan-400/30',
}

/**
 * Renders a stack of dismissible achievement-unlock toasts from the social
 * store. Each toast auto-dismisses after 6 seconds, or earlier when clicked.
 * Clicking the body routes to /achievements so the user can claim the reward.
 */
export function AchievementToastBanner() {
  const toasts = useSocialStore((s) => s.achievementToasts)
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
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

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), 6000)
    return () => clearTimeout(timer)
  }, [toast.id, dismiss])

  return (
    <button
      onClick={() => {
        dismiss(toast.id)
        navigate('/achievements')
      }}
      style={{ animationDelay: `${index * 60}ms` }}
      className={[
        'pointer-events-auto text-left animate-slide-up',
        'flex items-center gap-3 px-4 py-3 rounded-2xl',
        'border border-amber-500/40 bg-gradient-to-br bg-brand-950/90 backdrop-blur',
        'ring-2 shadow-2xl hover:scale-[1.02] transition-transform',
        ringClass,
      ].join(' ')}
    >
      <div className="text-3xl flex-shrink-0">{toast.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
          {t('achievements.unlockedToast')}
        </p>
        <p className="text-white font-bold text-sm truncate">{toast.name}</p>
        <p className="text-xs text-amber-200 font-semibold">
          {t('achievements.claimNow')} · +{toast.starsReward}⭐
        </p>
      </div>
    </button>
  )
}
