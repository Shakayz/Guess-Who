import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'

interface GameDetailPlayer {
  userId: string
  username: string
  avatarUrl: string | null
  role: string
  survived: boolean
  starCoinsEarned: number
}

interface RoundClue {
  playerId: string
  text: string
  createdAt: string
}

interface RoundVote {
  voterId: string
  targetId: string
}

interface RoundDetail {
  id: string
  roundNumber: number
  villagerWord: string
  imposterWord: string
  eliminatedId: string | null
  eliminatedRole: string | null
  clues: RoundClue[]
  votes: RoundVote[]
}

interface ChatMsg {
  id: string
  userId: string
  username: string
  text: string
  createdAt: string
}

interface GameDetail {
  id: string
  startedAt: string
  endedAt: string
  winnerTeam: 'villagers' | 'imposters'
  myRole: 'villager' | 'imposter'
  participations: GameDetailPlayer[]
  rounds: RoundDetail[]
  chatMessages: ChatMsg[]
}

function InitialsAvatar({ username, size = 'sm' }: { username: string; size?: 'sm' | 'md' }) {
  const colors = [
    'bg-brand-600', 'bg-amber-600', 'bg-emerald-600', 'bg-red-600',
    'bg-purple-600', 'bg-sky-600', 'bg-pink-600', 'bg-orange-600',
  ]
  const idx = username.charCodeAt(0) % colors.length
  const initials = username.slice(0, 2).toUpperCase()
  const sizeClass = size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'
  return (
    <div className={`${sizeClass} ${colors[idx]} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  )
}

function RoundAccordion({ round, players }: { round: RoundDetail; players: GameDetailPlayer[] }) {
  const [open, setOpen] = useState(false)

  const getUsername = (userId: string) =>
    players.find((p) => p.userId === userId)?.username ?? userId.slice(0, 8)

  const eliminatedPlayer = round.eliminatedId
    ? players.find((p) => p.userId === round.eliminatedId)
    : null

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-brand-400 font-bold text-sm">Round {round.roundNumber}</span>
          {round.eliminatedId && (
            <span className="text-xs text-neutral-500">
              · {eliminatedPlayer?.username ?? 'Unknown'} eliminated
            </span>
          )}
          {!round.eliminatedId && (
            <span className="text-xs text-neutral-500">· No elimination</span>
          )}
        </div>
        <span className="text-neutral-500 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-neutral-800">

          {/* Words */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="rounded-xl bg-brand-950/40 border border-brand-800/40 p-3 text-center">
              <p className="text-xs text-neutral-500 mb-1">Villager Word</p>
              <p className="text-white font-bold text-lg">{round.villagerWord}</p>
            </div>
            <div className="rounded-xl bg-amber-950/40 border border-amber-800/40 p-3 text-center">
              <p className="text-xs text-neutral-500 mb-1">Imposter Word</p>
              <p className="text-amber-300 font-bold text-lg">{round.imposterWord}</p>
            </div>
          </div>

          {/* Elimination */}
          {round.eliminatedId && (
            <div className="rounded-xl bg-red-950/20 border border-red-800/40 p-3 flex items-center gap-3">
              <span className="text-2xl">💀</span>
              <div>
                <p className="text-white font-semibold text-sm">
                  {eliminatedPlayer?.username ?? 'Unknown'} was eliminated
                </p>
                <p className="text-neutral-500 text-xs">
                  Role: {round.eliminatedRole ?? eliminatedPlayer?.role ?? 'unknown'}
                </p>
              </div>
            </div>
          )}

          {/* Clues */}
          {round.clues.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">Clues</p>
              <div className="space-y-2">
                {round.clues.map((clue, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <InitialsAvatar username={getUsername(clue.playerId)} size="sm" />
                    <div className="flex-1 bg-neutral-800/60 rounded-xl px-3 py-2">
                      <p className="text-xs text-neutral-500 mb-0.5">{getUsername(clue.playerId)}</p>
                      <p className="text-white text-sm">{clue.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Votes */}
          {round.votes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">Votes</p>
              <div className="space-y-1">
                {round.votes.map((vote, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-neutral-400">{getUsername(vote.voterId)}</span>
                    <span className="text-neutral-600">→</span>
                    <span className="text-white font-medium">{getUsername(vote.targetId)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GameDetailPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState<GameDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gameId) return
    setLoading(true)
    api
      .get<GameDetail>(`/history/${gameId}`)
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [gameId])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  const didWin =
    data &&
    ((data.winnerTeam === 'villagers' && data.myRole === 'villager') ||
      (data.winnerTeam === 'imposters' && data.myRole === 'imposter'))

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="h-8 w-32 bg-neutral-800 rounded animate-pulse" />
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 animate-pulse">
              <div className="h-16 w-48 bg-neutral-800 rounded mx-auto" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 animate-pulse h-20" />
            ))}
          </div>
        </main>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 font-semibold">Failed to load game details</p>
            <p className="text-neutral-500 text-sm mt-1">{error}</p>
            <button
              onClick={() => navigate('/history')}
              className="mt-4 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm transition-colors"
            >
              ← Back to History
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">

          {/* Back button */}
          <button
            onClick={() => navigate('/history')}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white transition-colors"
          >
            ← Back to History
          </button>

          {/* Header card */}
          <div className={[
            'rounded-2xl border p-6 text-center relative overflow-hidden',
            didWin
              ? 'border-emerald-700/40 bg-emerald-950/10'
              : 'border-red-800/40 bg-red-950/10',
          ].join(' ')}>
            <div className={[
              'absolute top-0 inset-x-0 h-0.5',
              didWin
                ? 'bg-gradient-to-r from-transparent via-emerald-500 to-transparent'
                : 'bg-gradient-to-r from-transparent via-red-500 to-transparent',
            ].join(' ')} />
            <p className="text-5xl mb-2">{didWin ? '🏆' : '💀'}</p>
            <h1 className={[
              'text-2xl font-extrabold tracking-tight mb-1',
              didWin ? 'text-emerald-400' : 'text-red-400',
            ].join(' ')}>
              {didWin ? 'Victory' : 'Defeat'}
            </h1>
            <p className="text-neutral-400 text-sm">{formatDate(data.startedAt)}</p>
            <div className="flex items-center justify-center gap-3 mt-3">
              <span className={[
                'text-xs font-bold px-2.5 py-1 rounded-full border',
                data.myRole === 'imposter'
                  ? 'bg-amber-950 text-amber-400 border-amber-800/60'
                  : 'bg-brand-950/60 text-brand-400 border-brand-800/60',
              ].join(' ')}>
                {data.myRole === 'imposter' ? '🎭 Imposter' : '👤 Villager'}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-neutral-700 text-neutral-400 bg-neutral-800/60">
                {data.rounds.length} round{data.rounds.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Players grid */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Players</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.participations.map((p) => {
                const isMe = p.userId === user?.id
                return (
                  <div
                    key={p.userId}
                    className={[
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors',
                      isMe
                        ? 'border-brand-800/50 bg-brand-950/20'
                        : 'border-neutral-800 bg-neutral-900/40',
                    ].join(' ')}
                  >
                    <InitialsAvatar username={p.username} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {isMe ? (
                          <span className="text-white text-xs font-semibold truncate">{p.username}</span>
                        ) : (
                          <Link
                            to={`/player/${p.userId}`}
                            className="text-white text-xs font-semibold truncate hover:text-brand-400 transition-colors"
                          >
                            {p.username}
                          </Link>
                        )}
                        {isMe && <span className="text-[9px] text-brand-400 font-bold">YOU</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-base">
                          {p.role === 'imposter' ? '🎭' : '👤'}
                        </span>
                        <span className={[
                          'text-[10px]',
                          p.survived ? 'text-emerald-500' : 'text-neutral-600',
                        ].join(' ')}>
                          {p.survived ? 'Survived' : 'Elim.'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Rounds accordion */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Rounds</p>
            <div className="space-y-2">
              {data.rounds.map((round) => (
                <RoundAccordion key={round.id} round={round} players={data.participations} />
              ))}
            </div>
          </div>

          {/* Game chat replay */}
          {data.chatMessages.length > 0 && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">💬 Game Chat</p>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {data.chatMessages.map((msg) => {
                  const isMe = msg.userId === user?.id
                  return (
                    <div
                      key={msg.id}
                      className={['flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row'].join(' ')}
                    >
                      <InitialsAvatar username={msg.username} size="sm" />
                      <div className={['max-w-[75%]', isMe ? 'items-end' : 'items-start'].join(' ')}>
                        <p className={['text-xs text-neutral-500 mb-0.5', isMe ? 'text-right' : ''].join(' ')}>
                          {msg.username} · {formatTime(msg.createdAt)}
                        </p>
                        <div className={[
                          'px-3 py-2 rounded-2xl text-sm',
                          isMe
                            ? 'bg-brand-600/80 text-white rounded-tr-sm'
                            : 'bg-neutral-800 text-neutral-200 rounded-tl-sm',
                        ].join(' ')}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
