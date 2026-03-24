import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'

interface GameSummary {
  id: string
  startedAt: string
  endedAt: string
  winnerTeam: 'villagers' | 'imposters'
  myRole: 'villager' | 'imposter'
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
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .get<HistoryResponse>(`/history?page=${page}&limit=10`)
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [page])

  const didWin = (game: GameSummary) =>
    (game.winnerTeam === 'villagers' && game.myRole === 'villager') ||
    (game.winnerTeam === 'imposters' && game.myRole === 'imposter')

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Game History</h1>
            {data && (
              <span className="text-sm text-neutral-500">{data.total} game{data.total !== 1 ? 's' : ''}</span>
            )}
          </div>

          {error && (
            <div className="rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-red-400 text-sm">
              Failed to load history: {error}
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
              <p className="text-white font-semibold text-lg">No games yet</p>
              <p className="text-neutral-500 text-sm mt-1">Play your first game to see your history here</p>
            </div>
          )}

          {!loading && !error && data && data.games.length > 0 && (
            <>
              <div className="space-y-3">
                {data.games.map((game) => {
                  const won = didWin(game)
                  return (
                    <button
                      key={game.id}
                      onClick={() => navigate(`/history/${game.id}`)}
                      className="w-full text-left rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 hover:border-neutral-700 hover:bg-neutral-900/80 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white font-semibold text-sm group-hover:text-brand-400 transition-colors">
                            {formatDate(game.startedAt)}
                          </p>
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
                          {won ? 'Victory' : 'Defeat'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3">
                        <span
                          className={[
                            'text-xs font-semibold px-2 py-0.5 rounded-full border',
                            game.myRole === 'imposter'
                              ? 'bg-amber-950 text-amber-400 border-amber-800/60'
                              : 'bg-brand-950/60 text-brand-400 border-brand-800/60',
                          ].join(' ')}
                        >
                          {game.myRole === 'imposter' ? '🎭 Imposter' : '👤 Villager'}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-400 bg-neutral-800/60">
                          ⭐ +{game.starCoinsEarned}
                        </span>
                        <span
                          className={[
                            'text-xs font-semibold px-2 py-0.5 rounded-full border',
                            game.survived
                              ? 'border-emerald-800/60 text-emerald-400 bg-emerald-950/40'
                              : 'border-neutral-700 text-neutral-500 bg-neutral-800/60',
                          ].join(' ')}
                        >
                          {game.survived ? '✓ Survived' : '✗ Eliminated'}
                        </span>
                      </div>
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
                    ← Prev
                  </button>
                  <span className="text-neutral-500 text-sm">
                    Page {page} of {data.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next →
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
