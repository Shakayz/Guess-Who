import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMatchmakingStore } from '../store/matchmaking'
import { getSocket } from '../lib/socket'
import { createLogger } from '../lib/logger'

const log = createLogger('matchmaking-banner')

/**
 * Floating banner shown on every page (except the home page, which has the
 * full matchmaking card) while the user is in the matchmaking queue. Lets the
 * user see live queue progress and cancel without navigating home first.
 */
export function MatchmakingBanner() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const isSearching = useMatchmakingStore((s) => s.isSearching)
  const topMode = useMatchmakingStore((s) => s.topMode)
  const gameMode = useMatchmakingStore((s) => s.gameMode)
  const status = useMatchmakingStore((s) => s.status)
  const stopSearch = useMatchmakingStore((s) => s.stopSearch)

  // The home page already renders the full matchmaking card; skip the banner
  // there to avoid a double-indicator.
  if (!isSearching || location.pathname === '/') return null

  const { queueSize, needed, elapsed, maxWait, idealPlayers } = status
  const progressPct = Math.min(100, (queueSize / idealPlayers) * 100)
  const timePct = Math.min(100, (elapsed / maxWait) * 100)
  const statusText = elapsed < 15
    ? t('home.matchmakingFullLobby')
    : elapsed < 35
      ? t('home.matchmakingExpanding')
      : t('home.matchmakingStartingSoon')

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    log.info('leaving matchmaking from banner')
    try {
      ;(getSocket() as any).emit('matchmaking:leave', { gameMode: topMode })
    } catch {
      // Socket might be briefly disconnected — server will drop us from the
      // queue on disconnect anyway. Still clear local state below.
    }
    stopSearch()
  }

  const isRanked = gameMode === 'ranked' || topMode === 'ranked'

  return (
    <button
      type="button"
      onClick={() => navigate('/')}
      aria-live="polite"
      aria-label={statusText}
      className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,440px)] text-left rounded-2xl border border-brand-700/60 bg-neutral-950/95 backdrop-blur shadow-2xl overflow-hidden transition-transform hover:-translate-y-0.5 hover:-translate-x-1/2 active:scale-[0.99]"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className={[
            'w-8 h-8 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0',
            isRanked ? 'border-amber-500' : 'border-brand-500',
          ].join(' ')}
        />
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{statusText}</p>
          <p className="text-neutral-500 text-xs truncate">
            {t('home.inQueue', { count: queueSize, needed })} · {elapsed}s / {maxWait}s
          </p>
        </div>
        <span
          onClick={handleCancel}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleCancel(e as unknown as React.MouseEvent)
            }
          }}
          aria-label={t('common.cancel')}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          {t('common.cancel')}
        </span>
      </div>

      <div className="flex items-center justify-center gap-1 pb-2 px-4">
        {Array.from({ length: idealPlayers }).map((_, i) => (
          <div
            key={i}
            className={[
              'w-2 h-2 rounded-full transition-all duration-300',
              i < queueSize
                ? (isRanked ? 'bg-amber-500 scale-110' : 'bg-brand-500 scale-110')
                : i < needed
                  ? 'bg-neutral-700 border border-neutral-600'
                  : 'bg-neutral-800/60',
            ].join(' ')}
          />
        ))}
      </div>

      <div className="h-1 bg-neutral-800">
        <div
          className={isRanked ? 'bg-amber-500 h-1 transition-all duration-500' : 'bg-brand-500 h-1 transition-all duration-500'}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="h-0.5 bg-neutral-900">
        <div
          className="bg-neutral-600 h-0.5 transition-all duration-1000"
          style={{ width: `${timePct}%` }}
        />
      </div>
    </button>
  )
}
