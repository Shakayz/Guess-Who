import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { NavBar } from '../components/NavBar'
import { WORD_CATEGORIES } from '@red-handed/shared'
import type { WordCategory } from '@red-handed/shared'
import { useGameStore } from '../store/game'
import { SoundManager } from '../lib/sounds'

type PublicLobby = {
  code: string
  host: { id: string; username: string }
  playerCount: number
  maxPlayers: number
  gameMode: 'normal' | 'special' | 'ranked'
  categories: WordCategory[]
  vocalMode: boolean
  language: string
  createdAt: string
}

const CATEGORY_ICON: Record<string, string> = Object.fromEntries(
  WORD_CATEGORIES.map((c) => [c.key, c.icon]),
)

export default function PublicLobbiesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const activeRoom = useGameStore((s) => s.room)
  // Active-game guard — mirrors HomePage's isBlockedFromNewGame so players
  // can't jump into a fresh lobby while their current one is still running.
  const isBlockedFromNewGame = !!(activeRoom && (
    activeRoom.status === 'in_progress' || activeRoom.status === 'voting'
  ))

  const [lobbies, setLobbies] = useState<PublicLobby[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLobbies = useCallback(async () => {
    setError(null)
    try {
      const data = await api.get<{ lobbies: PublicLobby[] }>('/rooms/public')
      setLobbies(data.lobbies)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load lobbies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLobbies()
    // Light polling so newly-opened lobbies appear without a manual refresh.
    // 8 s is a balance between freshness and server load — switch to a socket
    // event if lobby traffic grows enough that polling becomes expensive.
    const id = window.setInterval(fetchLobbies, 8000)
    return () => window.clearInterval(id)
  }, [fetchLobbies])

  const join = (code: string) => {
    if (isBlockedFromNewGame) return
    SoundManager.play('click')
    navigate(`/lobby/${code}`)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 px-4 pt-20 pb-24 sm:pb-16">
        <div className="max-w-2xl mx-auto animate-slide-up space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              {/* Back arrow returns to the Custom Lobby chooser (Create / Join)
                  on the home page. Explicit route instead of navigate(-1) so
                  direct loads or deep links still land somewhere sensible. */}
              <button
                type="button"
                onClick={() => { SoundManager.play('click'); navigate('/?mode=lobby') }}
                aria-label={t('common.back')}
                className="shrink-0 mt-1 h-9 w-9 -ml-1 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/70 flex items-center justify-center transition-colors"
              >
                ←
              </button>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  <span>🔍</span> {t('publicLobbies.title')}
                </h1>
                <p className="text-neutral-400 text-sm mt-1">{t('publicLobbies.subtitle')}</p>
              </div>
            </div>
            <button
              onClick={fetchLobbies}
              className="shrink-0 h-10 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-sm font-semibold border border-neutral-700 hover:border-neutral-600 transition-colors"
              aria-label={t('publicLobbies.refresh')}
            >
              ↻ {t('publicLobbies.refresh')}
            </button>
          </div>

          {error && (
            <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-400 text-sm">
              <span>⚠</span> {error}
            </div>
          )}

          {loading && lobbies.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-neutral-500">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-sm">{t('publicLobbies.loading')}</p>
            </div>
          )}

          {!loading && lobbies.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-center px-4">
              <span className="text-5xl">🫥</span>
              <p className="text-white font-semibold">{t('publicLobbies.emptyTitle')}</p>
              <p className="text-neutral-500 text-sm max-w-sm">{t('publicLobbies.emptyDesc')}</p>
              <button
                onClick={() => { SoundManager.play('click'); navigate('/?mode=lobby&action=create') }}
                className="mt-2 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
              >
                {t('publicLobbies.createOne')}
              </button>
            </div>
          )}

          {/* Lobby list */}
          <div className="space-y-2.5">
            {lobbies.map((lobby) => {
              const isFull = lobby.playerCount >= lobby.maxPlayers
              // Empty categories == "all" per the shared convention.
              const cats = lobby.categories.length === 0
                ? null
                : lobby.categories.slice(0, 4)
              return (
                <button
                  key={lobby.code}
                  onClick={() => join(lobby.code)}
                  disabled={isFull || isBlockedFromNewGame}
                  className={[
                    'w-full text-left rounded-2xl border p-4 transition-all group',
                    isFull
                      ? 'border-neutral-800/60 bg-neutral-900/40 opacity-60 cursor-not-allowed'
                      : 'border-neutral-800 bg-neutral-900/70 hover:border-indigo-700/60 hover:bg-neutral-900 active:scale-[0.99]',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-neutral-500 tracking-wider">{lobby.code}</span>
                        <span className="text-white font-bold text-sm truncate">
                          {t('publicLobbies.hostedBy', { name: lobby.host.username })}
                        </span>
                        {lobby.gameMode === 'special' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-900/50 text-purple-300 border border-purple-800/40">
                            {t('home.specialGameMode')}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-neutral-800/80 text-neutral-300 border border-neutral-700/60 flex items-center gap-1">
                          <span>{lobby.vocalMode ? '🎙️' : '⌨️'}</span>
                          {lobby.vocalMode ? t('publicLobbies.audio') : t('publicLobbies.typing')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {cats === null && (
                          <span className="text-[11px] text-neutral-500 italic">{t('publicLobbies.allCategories')}</span>
                        )}
                        {cats !== null && cats.map((c) => (
                          <span
                            key={c}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-neutral-800/70 border border-neutral-700/60 text-neutral-300"
                          >
                            <span>{CATEGORY_ICON[c] ?? '🏷️'}</span>
                            <span>{t(`home.cat.${c}`, c)}</span>
                          </span>
                        ))}
                        {lobby.categories.length > 4 && (
                          <span className="text-[10px] text-neutral-500">+{lobby.categories.length - 4}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={[
                        'font-mono font-bold text-base',
                        isFull ? 'text-red-400' : 'text-indigo-300',
                      ].join(' ')}>
                        {lobby.playerCount}/{lobby.maxPlayers}
                      </p>
                      <p className={[
                        'text-[10px] font-semibold uppercase tracking-wider mt-0.5 transition-colors',
                        isFull
                          ? 'text-red-500'
                          : 'text-indigo-400 group-hover:text-indigo-300',
                      ].join(' ')}>
                        {isFull ? t('publicLobbies.full') : `${t('publicLobbies.join')} →`}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {isBlockedFromNewGame && (
            <p className="text-xs text-amber-500 text-center">
              {t('publicLobbies.blockedByActiveGame')}
            </p>
          )}

        </div>
      </main>
    </div>
  )
}
