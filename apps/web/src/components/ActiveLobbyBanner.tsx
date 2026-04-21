import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/game'
import { useMatchmakingStore } from '../store/matchmaking'
import { getSocket } from '../lib/socket'
import { createLogger } from '../lib/logger'

const log = createLogger('active-lobby-banner')

/**
 * Floating reminder shown on every non-lobby page while the user has a
 * waiting Custom Lobby open. Mirrors MatchmakingBanner's layout so the two
 * indicators feel like siblings — click anywhere to return, click the X to
 * leave (and actually close the lobby on the server).
 */
export function ActiveLobbyBanner() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const room = useGameStore((s) => s.room)
  const reset = useGameStore((s) => s.reset)
  const isSearching = useMatchmakingStore((s) => s.isSearching)

  if (!room || room.status !== 'waiting') return null
  // Hide on the lobby page itself — the user is already there.
  if (location.pathname === `/lobby/${room.code}`) return null
  // Avoid stacking on top of the matchmaking banner.
  if (isSearching) return null

  const players = (room as any).players ?? []
  const maxPlayers = (room as any).settings?.maxPlayers ?? 10

  const handleLeave = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    log.info('leaving lobby from banner', { code: room.code })
    try {
      getSocket().emit('room:leave')
    } catch {
      // Socket might be briefly disconnected — server will drop us on
      // disconnect anyway. Still clear local state below.
    }
    reset()
  }

  return (
    <button
      type="button"
      onClick={() => navigate(`/lobby/${room.code}`)}
      aria-live="polite"
      aria-label={t('lobby.returnToLobby') as string}
      className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,440px)] text-left rounded-2xl border border-violet-700/60 bg-neutral-950/95 backdrop-blur shadow-2xl overflow-hidden transition-transform hover:-translate-y-0.5 hover:-translate-x-1/2 active:scale-[0.99]"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-violet-900/60 border border-violet-700/60 flex items-center justify-center text-violet-300 flex-shrink-0">
          <span aria-hidden="true">🎲</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">
            {t('lobby.stillInLobby')} · <span className="text-violet-400 font-mono">{room.code}</span>
          </p>
          <p className="text-neutral-500 text-xs truncate">
            {t('lobby.readyCount', {
              ready: players.filter((p: any) => p.isReady || p.isHost).length,
              total: players.length,
            })} · {players.length}/{maxPlayers}
          </p>
        </div>
        <span
          onClick={handleLeave}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleLeave(e)
            }
          }}
          aria-label={t('lobby.leaveLobby') as string}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-red-900/70 text-neutral-400 hover:text-red-300 text-xs font-semibold transition-colors cursor-pointer"
        >
          ✕
        </span>
      </div>
    </button>
  )
}
