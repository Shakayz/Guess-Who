import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

interface InsufficientCoinsModalProps {
  /** How many ⭐ the action needed (usually 10, the DAILY_COST). */
  required: number
  /**
   * If the modal was triggered because a DIFFERENT player in the lobby is
   * broke, we pass their username so the copy reads "X doesn't have enough…"
   * instead of "You don't…". Undefined = it's the viewer who is broke.
   */
  blockedUsername?: string
  /**
   * Optional override for the "Get coins" CTA. Used when the caller is
   * already inside /shop (e.g. emote purchase on the emotes tab) — instead
   * of navigating, switch the tab in-place. When omitted the modal falls
   * back to navigate('/shop?tab=coins').
   */
  onGetCoins?: () => void
  onClose: () => void
}

/**
 * Shown whenever the server returns INSUFFICIENT_STARS (HTTP 402 on
 * POST /rooms, matchmaking:error, game:start:failed). Replaces the old
 * tiny red alert with a clear actionable modal that links to /shop.
 *
 * We read the viewer's current star balance from /auth/me (same query
 * key the NavBar/Profile use) so the shown balance is always live —
 * right after the game-start transaction rolled back.
 */
export function InsufficientCoinsModal({
  required,
  blockedUsername,
  onGetCoins,
  onClose,
}: InsufficientCoinsModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Cheap: re-uses the cached ['me'] query the NavBar/Profile already seed.
  const { data: me } = useQuery<{ starCoins?: number }>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me'),
    retry: false,
    // Viewer-only: don't bother fetching for the "other player is broke" case.
    enabled: !blockedUsername,
  })

  const balance = me?.starCoins ?? 0
  const shortBy = Math.max(0, required - balance)
  const isViewerBroke = !blockedUsername

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="insufficient-coins-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — star icon over a soft amber gradient to telegraph "coin issue" */}
        <div className="relative px-5 pt-6 pb-4 border-b border-neutral-800 bg-gradient-to-b from-amber-950/40 to-transparent">
          <button
            onClick={onClose}
            aria-label={t('common.cancel')}
            className="absolute top-3 right-3 text-neutral-500 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-950/60 border border-amber-700/40 flex items-center justify-center text-3xl">
              ⭐
            </div>
            <h2 id="insufficient-coins-title" className="text-white font-extrabold text-lg">
              {isViewerBroke
                ? t('insufficientCoins.title')
                : t('insufficientCoins.playerTitle', { username: blockedUsername })}
            </h2>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Cost vs balance breakdown — only shown when the viewer is the one short.
              For the "another player is broke" variant we don't know their balance,
              so we just show a brief explanation. */}
          {isViewerBroke ? (
            <>
              <p className="text-neutral-400 text-sm text-center">
                {t('insufficientCoins.body', { required })}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-neutral-900 border border-neutral-800 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                    {t('insufficientCoins.balance')}
                  </p>
                  <p className="text-white font-bold text-base mt-0.5">{balance} ⭐</p>
                </div>
                <div className="rounded-xl bg-neutral-900 border border-neutral-800 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                    {t('insufficientCoins.cost')}
                  </p>
                  <p className="text-white font-bold text-base mt-0.5">{required} ⭐</p>
                </div>
                <div className="rounded-xl bg-red-950/30 border border-red-900/50 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-red-500 font-semibold">
                    {t('insufficientCoins.short')}
                  </p>
                  <p className="text-red-300 font-bold text-base mt-0.5">{shortBy} ⭐</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-neutral-400 text-sm text-center">
              {t('insufficientCoins.playerBody', { username: blockedUsername, required })}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white font-semibold text-sm transition-colors"
            >
              {t('common.cancel')}
            </button>
            {isViewerBroke && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  if (onGetCoins) onGetCoins()
                  else navigate('/shop?tab=coins')
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-amber-600/20"
              >
                {t('insufficientCoins.getCoinsCta')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
