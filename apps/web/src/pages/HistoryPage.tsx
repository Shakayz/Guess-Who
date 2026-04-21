import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'
import { findLanguage } from '../i18n/languages'

type HistoryMode = 'unranked' | 'ranked'

interface GameSummary {
  id: string
  startedAt: string
  endedAt: string
  winnerTeam: 'villagers' | 'red_handed'
  gameMode: 'normal' | 'special' | 'ranked'
  language?: string
  myRole: 'villager' | 'red_handed'
  survived: boolean
  starCoinsEarned: number
  roundCount: number
  players: { userId: string; username: string; avatarUrl: string | null; role: string; survived: boolean }[]
}

interface HistoryResponse {
  games: GameSummary[]
  total: number
  page: number
  totalPages: number
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-32 bg-neutral-800 rounded" />
          <div className="h-3 w-24 bg-neutral-800 rounded" />
        </div>
        <div className="h-6 w-16 bg-neutral-800 rounded-full" />
      </div>
      <div className="flex gap-2 mt-3">
        <div className="h-5 w-20 bg-neutral-800 rounded-full" />
        <div className="h-5 w-20 bg-neutral-800 rounded-full" />
        <div className="h-5 w-20 bg-neutral-800 rounded-full" />
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const languageName = React.useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([i18n.language], { type: 'language' })
      return (code: string) => {
        const name = dn.of(code)
        return name ? name.charAt(0).toUpperCase() + name.slice(1) : code
      }
    } catch {
      return (code: string) => code
    }
  }, [i18n.language])
  const [mode, setMode] = useState<HistoryMode>('unranked')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .get<HistoryResponse>(`/history?page=${page}&limit=10&mode=${mode}`)
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [page, mode])

  const selectMode = (next: HistoryMode) => {
    if (next === mode) return
    setMode(next)
    setPage(1)
    setData(null)
  }

  const didWin = (game: GameSummary) =>
    (game.winnerTeam === 'villagers' && game.myRole === 'villager') ||
    (game.winnerTeam === 'red_handed' && game.myRole === 'red_handed')

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const emptyLabel = mode === 'ranked' ? t('history.noRankedGames') : t('history.noUnrankedGames')

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{t('history.title')}</h1>
            {data && (
              <span className="text-sm text-neutral-500">{data.total} game{data.total !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Tabs: Unranked (unranked + lobby) vs Ranked */}
          <div
            role="tablist"
            aria-label={t('history.title')}
            className="inline-flex rounded-2xl bg-neutral-900/60 border border-neutral-800 p-1"
          >
            <button
              role="tab"
              aria-selected={mode === 'unranked'}
              onClick={() => selectMode('unranked')}
              className={[
                'px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors',
                mode === 'unranked'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200',
              ].join(' ')}
            >
              {t('history.tabUnranked')}
            </button>
            <button
              role="tab"
              aria-selected={mode === 'ranked'}
              onClick={() => selectMode('ranked')}
              className={[
                'px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors',
                mode === 'ranked'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200',
              ].join(' ')}
            >
              {t('history.tabRanked')}
            </button>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-red-400 text-sm">
              {t('history.loadError')}: {error}
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {!loading && !error && data?.games.length === 0 && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-12 flex flex-col items-center text-center">
              <span className="text-5xl mb-3">🎮</span>
              <p className="text-white font-semibold text-lg">{emptyLabel}</p>
              <p className="text-neutral-500 text-sm mt-1">{t('history.noGamesHint')}</p>
            </div>
          )}

          {!loading && !error && data && data.games.length > 0 && (
            <>
              <div className="space-y-3">
                {data.games.map((game) => {
                  const won = didWin(game)
                  const langInfo = findLanguage(game.language)
                  return (
                    <button
                      key={game.id}
                      onClick={() => navigate(`/history/${game.id}`)}
                      className="w-full text-left rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 hover:border-neutral-700 hover:bg-neutral-900/80 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white font-semibold text-sm group-hover:text-brand-400 transition-colors">
                              {formatDate(game.startedAt)}
                            </p>
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-300 bg-neutral-800/60 inline-flex items-center gap-1.5"
                              title={t('lobby.roomLanguage', 'Room language') as string}
                            >
                              <img
                                src={`https://flagcdn.com/w20/${langInfo.country}.png`}
                                alt=""
                                className="w-3.5 h-2.5 object-cover rounded-sm"
                              />
                              <span>{languageName(langInfo.code)}</span>
                            </span>
                          </div>
                          <p className="text-neutral-500 text-xs mt-0.5">
                            {game.players.length} player{game.players.length !== 1 ? 's' : ''} · {game.roundCount} round{game.roundCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <span
                          className={[
                            'text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0',
                            won
                              ? 'bg-green-950 text-green-400 border-green-800'
                              : 'bg-red-950 text-red-400 border-red-800',
                          ].join(' ')}
                        >
                          {won ? t('history.victory') : t('history.defeat')}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3">
                        <span
                          className={[
                            'text-xs font-semibold px-2 py-0.5 rounded-full border',
                            game.myRole === 'red_handed'
                              ? 'bg-amber-950 text-amber-400 border-amber-800/60'
                              : 'bg-brand-950/60 text-brand-400 border-brand-800/60',
                          ].join(' ')}
                        >
                          {game.myRole === 'red_handed' ? t('gameDetail.redHandedRole') : t('gameDetail.villagerRole')}
                        </span>
                        <span
                          className={[
                            'text-xs font-semibold px-2 py-0.5 rounded-full border',
                            game.survived
                              ? 'border-emerald-800/60 text-emerald-400 bg-emerald-950/40'
                              : 'border-neutral-700 text-neutral-500 bg-neutral-800/60',
                          ].join(' ')}
                        >
                          {game.survived ? t('history.survived') : t('history.eliminated')}
                        </span>
                      </div>

                      {/* Players — clickable chips to view profiles */}
                      {game.players.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-neutral-800/60">
                          {game.players.map((p) => (
                            <button
                              key={p.userId}
                              onClick={(e) => { e.stopPropagation(); navigate(`/player/${p.userId}`) }}
                              className={[
                                'text-xs font-semibold px-2 py-0.5 rounded-full border transition-all hover:scale-105',
                                p.role === 'red_handed' || p.role === 'double_agent'
                                  ? 'bg-red-950/30 text-red-400 border-red-900/40 hover:border-red-700/50'
                                  : 'bg-neutral-800/60 text-neutral-300 border-neutral-700/40 hover:border-neutral-600/60',
                              ].join(' ')}
                            >
                              {p.username}
                            </button>
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t('history.prev')}
                  </button>
                  <span className="text-neutral-500 text-sm">
                    {t('history.pageOf', { page, total: data.totalPages })}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t('history.next')}
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  )
}
