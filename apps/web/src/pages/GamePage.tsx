import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/game'
import { useAuthStore } from '../store/auth'
import { getSocket } from '../lib/socket'
import { Avatar } from '@imposter/ui'
import type { Clue } from '@imposter/shared'

type Phase = 'speaking' | 'voting' | 'reveal'

function CountdownBar({ seconds, total, color }: { seconds: number; total: number; color: string }) {
  const pct = Math.max(0, (seconds / total) * 100)
  const urgent = seconds <= 10
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={['h-full rounded-full transition-all duration-1000', color, urgent ? 'animate-pulse' : ''].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={['text-xs font-mono font-semibold tabular-nums w-8 text-right', urgent ? 'text-red-400' : 'text-neutral-400'].join(' ')}>
        {seconds}s
      </span>
    </div>
  )
}

export default function GamePage() {
  const { code } = useParams<{ code: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { room, currentRound, myRole, myWord, messages, addMessage, setResult, setRound } = useGameStore()
  const user = useAuthStore((s) => s.user)
  const [clueText, setClueText] = useState('')
  const [clues, setClues] = useState<Clue[]>([])
  const [chatInput, setChatInput] = useState('')
  const [deadChatInput, setDeadChatInput] = useState('')
  const [deadChatMessages, setDeadChatMessages] = useState<{ id: string; userId: string; username: string; text: string }[]>([])
  const [isEliminated, setIsEliminated] = useState(false)
  const [phase, setPhase] = useState<Phase>('speaking')
  const [votedFor, setVotedFor] = useState<string | null>(null)
  const [eliminated, setEliminated] = useState<{ username: string; role: string } | null>(null)
  const [hasSubmittedClue, setHasSubmittedClue] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalTime, setTotalTime] = useState(30)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef<Phase>('speaking')

  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTotalTime(seconds)
    setTimeLeft(seconds)
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0 }
        return t - 1
      })
    }, 1000)
  }, [])

  const isImposter = myRole === 'imposter' || myRole === 'double_agent'
  const players = room?.players ?? []

  useEffect(() => {
    const socket = getSocket()

    // Re-join the room socket on reconnect (socket loses room membership after disconnect)
    const handleConnect = () => {
      if (code) socket.emit('room:join', { roomCode: code })
    }
    socket.on('connect', handleConnect)

    socket.on('round:clue-submitted', (clue) => setClues((c) => [...c, clue as Clue]))
    socket.on('round:speaking-turn', ({ timeSeconds }) => {
      // Only reset state when starting a new round (transitioning from reveal)
      if (phaseRef.current === 'reveal') {
        setClues([])
        setHasSubmittedClue(false)
        setVotedFor(null)
        setEliminated(null)
      }
      phaseRef.current = 'speaking'
      setPhase('speaking')
      startTimer(timeSeconds)
    })
    socket.on('round:voting-started', ({ timeSeconds }) => {
      phaseRef.current = 'voting'
      setPhase('voting')
      startTimer(timeSeconds ?? 30)
    })
    socket.on('round:ended', ({ round, nextRound }: any) => {
      phaseRef.current = 'reveal'
      setPhase('reveal')
      if (nextRound) setRound(nextRound)
      if (round?.eliminatedPlayerId) {
        const elim = players.find((p: any) => p.userId === round.eliminatedPlayerId)
        setEliminated({
          username: elim?.username ?? round.eliminatedPlayerId,
          role: round.eliminatedRole ?? 'villager',
        })
        // If it's me, join dead chat
        if (round.eliminatedPlayerId === user?.id) {
          setIsEliminated(true)
          socket.emit('deadchat:join' as any)
        }
      }
    })
    socket.on('deadchat:message' as any, (msg: { id: string; userId: string; username: string; text: string }) => {
      setDeadChatMessages((prev) => [...prev, msg])
    })
    socket.on('game:finished', (data) => {
      setResult(data)
      navigate(`/results/${code}`)
    })
    socket.on('chat:message', addMessage)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('round:clue-submitted')
      socket.off('round:speaking-turn')
      socket.off('round:voting-started')
      socket.off('round:ended')
      socket.off('game:finished')
      socket.off('chat:message')
      socket.off('deadchat:message' as any)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startTimer])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submitClue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!clueText.trim() || hasSubmittedClue) return
    getSocket().emit('clue:submit', clueText.trim())
    setClueText('')
    setHasSubmittedClue(true)
  }

  const vote = (playerId: string) => {
    if (votedFor) return
    setVotedFor(playerId)
    getSocket().emit('vote:cast', playerId)
  }

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    getSocket().emit('chat:send', chatInput.trim())
    setChatInput('')
  }

  const sendDeadChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!deadChatInput.trim()) return
    getSocket().emit('deadchat:send' as any, { text: deadChatInput.trim() })
    setDeadChatInput('')
  }

  const alivePlayers = players.filter((p) => p.status === 'alive')

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Main game area ── */}
      <div className="flex-1 flex flex-col p-4 lg:p-6 gap-4 overflow-y-auto">

        {/* Top bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-white">Imposter</span>
              {code && (
                <span className="text-xs font-mono text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                  {code}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={[
                'text-xs font-semibold px-2.5 py-1 rounded-full',
                phase === 'speaking' ? 'bg-brand-950/60 text-brand-400 border border-brand-800/40' :
                phase === 'voting'   ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40' :
                                       'bg-neutral-800 text-neutral-400 border border-neutral-700',
              ].join(' ')}>
                {phase === 'speaking' ? '💬 Speaking' : phase === 'voting' ? '🗳 Voting' : '📋 Reveal'}
              </span>
              <span className="text-xs text-neutral-500">
                {alivePlayers.length} alive
              </span>
            </div>
          </div>
          {timeLeft > 0 && (
            <CountdownBar
              seconds={timeLeft}
              total={totalTime}
              color={phase === 'voting' ? 'bg-amber-500' : 'bg-brand-500'}
            />
          )}
        </div>

        {/* Word card */}
        <div className="card relative overflow-hidden border-neutral-700/50 bg-neutral-900/40">
          <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-neutral-500 to-transparent" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 bg-neutral-800/60">
              🔤
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-0.5">
                Your Word
              </p>
              <p className="text-2xl font-extrabold tracking-tight text-white">
                {myWord ?? '???'}
              </p>
              <p className="text-xs text-neutral-600 mt-0.5">
                Give a clue without saying the word directly
              </p>
            </div>
          </div>
        </div>

        {/* Speaking phase: clue input */}
        {phase === 'speaking' && (
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Your Clue</p>
            {hasSubmittedClue ? (
              <div className="flex items-center gap-2 py-2 text-emerald-400 text-sm">
                <span>✓</span>
                <span>Clue submitted — waiting for others...</span>
              </div>
            ) : (
              <form onSubmit={submitClue} className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="One sentence clue..."
                  value={clueText}
                  onChange={(e) => setClueText(e.target.value)}
                  maxLength={200}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!clueText.trim()}
                  className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold disabled:opacity-40 transition-colors"
                >
                  Send
                </button>
              </form>
            )}
          </div>
        )}

        {/* Voting phase */}
        {phase === 'voting' && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Vote out the Imposter</p>
              {votedFor && (
                <span className="text-xs text-emerald-400 font-semibold">✓ Vote cast</span>
              )}
            </div>
            <div className="space-y-2">
              {alivePlayers
                .filter((p) => p.userId !== user?.id)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => vote(p.userId)}
                    disabled={!!votedFor}
                    className={[
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left',
                      votedFor === p.userId
                        ? 'border-amber-600/50 bg-amber-950/30'
                        : votedFor
                        ? 'border-neutral-800 bg-neutral-900/40 opacity-50'
                        : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 hover:bg-neutral-800/60',
                    ].join(' ')}
                  >
                    <Avatar username={p.username} size="sm" />
                    <span className="flex-1 font-semibold text-white text-sm">{p.username}</span>
                    {votedFor === p.userId && (
                      <span className="text-amber-400 text-xs font-bold">Voted</span>
                    )}
                    {!votedFor && (
                      <span className="text-neutral-600 text-xs">Click to vote</span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Reveal phase */}
        {phase === 'reveal' && (
          <div className="card border-neutral-700 text-center py-6">
            <p className="text-4xl mb-3">
              {eliminated?.role === 'imposter' || eliminated?.role === 'double_agent' ? '🎉' : '😬'}
            </p>
            {eliminated ? (
              <>
                <p className="text-white font-bold text-lg mb-1">
                  {eliminated.username} was eliminated
                </p>
                <p className={[
                  'text-sm font-semibold',
                  eliminated.role === 'imposter' || eliminated.role === 'double_agent'
                    ? 'text-red-400'
                    : 'text-brand-400',
                ].join(' ')}>
                  They were a{' '}
                  {eliminated.role === 'imposter' ? 'Imposter'
                    : eliminated.role === 'double_agent' ? 'Double Agent'
                    : 'Villager'}
                </p>
              </>
            ) : (
              <p className="text-neutral-400 text-sm">No one was eliminated this round</p>
            )}
            <p className="text-xs text-neutral-600 mt-4">Next round starting soon...</p>
          </div>
        )}

        {/* Clues log */}
        <div className="card flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
            Clues — Round {currentRound?.roundNumber ?? 1}
          </p>
          {clues.length === 0 ? (
            <p className="text-neutral-600 text-sm italic">No clues yet...</p>
          ) : (
            <div className="space-y-2.5">
              {clues.map((clue, i) => {
                const player = players.find((p) => p.userId === clue.playerId)
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <Avatar username={player?.username ?? '?'} size="xs" />
                    <div>
                      <span className="text-xs font-semibold text-neutral-400">
                        {player?.username ?? 'Unknown'}
                      </span>
                      <p className="text-sm text-white leading-snug">{clue.text}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Chat sidebar ── */}
      <div className="w-full lg:w-72 flex flex-col border-t lg:border-t-0 lg:border-l border-neutral-800 h-64 lg:h-screen">
        {/* Players list */}
        <div className="border-b border-neutral-800 p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">
            Players ({alivePlayers.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {players.map((p) => (
              <div
                key={p.id}
                className={[
                  'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold',
                  p.status === 'alive'
                    ? 'bg-neutral-800 text-white'
                    : 'bg-neutral-900 text-neutral-600 line-through',
                ].join(' ')}
              >
                <span className={[
                  'w-1.5 h-1.5 rounded-full',
                  p.status === 'alive' ? 'bg-emerald-400' : 'bg-neutral-700',
                ].join(' ')} />
                {p.username}
              </div>
            ))}
          </div>
        </div>

        {/* Ghost Chat — only for eliminated players */}
        {isEliminated ? (
          <div className="flex-1 flex flex-col border-t-2 border-red-900/50">
            <div className="px-3 py-2 bg-red-950/30 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-red-500">💀 Ghost Chat</span>
              <span className="text-xs text-neutral-600">Only eliminated players</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {deadChatMessages.length === 0 ? (
                <p className="text-neutral-700 text-xs italic">You are a ghost now...</p>
              ) : (
                deadChatMessages.map((msg) => (
                  <div key={msg.id} className="text-sm">
                    <span className={['font-semibold', msg.userId === user?.id ? 'text-red-400' : 'text-neutral-400'].join(' ')}>
                      {msg.username}:{' '}
                    </span>
                    <span className="text-neutral-500">{msg.text}</span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-red-900/30">
              <form onSubmit={sendDeadChat} className="flex gap-2">
                <input
                  className="flex-1 bg-neutral-900 border border-red-900/40 rounded-lg px-3 py-1.5 text-sm text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-red-700/60"
                  placeholder="Ghost whisper..."
                  value={deadChatInput}
                  onChange={(e) => setDeadChatInput(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!deadChatInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-400 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  →
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  )
}
