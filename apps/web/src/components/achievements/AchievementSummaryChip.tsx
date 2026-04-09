import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'

interface SummaryResponse {
  total: number
  unlocked: number
  unclaimedCount: number
  unclaimedStars: number
}

interface Props {
  onOpen: () => void
}

/**
 * Compact achievements summary used in place of the old grid on the profile
 * page. Shows total unlocked out of the full catalogue and, if any rewards
 * are sitting waiting to be claimed, a pulsing call-to-action pill.
 */
export function AchievementSummaryChip({ onOpen }: Props) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery<SummaryResponse>({
    queryKey: ['achievements-summary'],
    queryFn: () => api.get('/achievements/summary'),
    retry: false,
  })

  if (isLoading || !data) {
    return (
      <button
        onClick={onOpen}
        className="card w-full text-left hover:border-brand-600/60 transition-colors"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">
          {t('profile.achievements')}
        </p>
        <div className="h-12 flex items-center justify-center text-neutral-600 text-sm">…</div>
      </button>
    )
  }

  const hasUnclaimed = data.unclaimedCount > 0

  return (
    <button
      onClick={onOpen}
      className="card w-full text-left hover:border-brand-600/60 transition-colors relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          {t('profile.achievements')}
        </p>
        <span className="text-xs text-neutral-500">
          {data.unlocked}/{data.total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all"
          style={{ width: `${Math.min(100, Math.round((data.unlocked / Math.max(1, data.total)) * 100))}%` }}
        />
      </div>

      {hasUnclaimed ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/50 animate-pulse-slow">
            <span className="text-base">🎁</span>
            <span className="text-xs font-bold text-amber-200">
              {data.unclaimedCount} {t('profile.unclaimed')} · +{data.unclaimedStars}⭐
            </span>
          </div>
          <span className="text-[11px] font-semibold text-brand-300">{t('achievements.claimNow')} →</span>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">{t('profile.playToUnlock')}</p>
      )}
    </button>
  )
}
