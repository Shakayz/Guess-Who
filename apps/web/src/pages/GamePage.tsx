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
  const [floatingEmotes, setFloatingEmotes] = useState<{ id: string; emoji: string; username: string; x: number }[]>([])
  const [phase, setPhase] = useState<Phase>('speaking')
  const [votedFor, setVotedFor] = useState<string | null>(null)
  const [eliminated, setEliminated] = useState<{ username: string; role: string } | null>(null)
  const [hasSubmittedClue, setHasSubmittedClue] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [currentSpeakerId, setCurrentSpeakerId] = useState<string | null>(null)
  const [speakingOrder, setSpeakingOrder] = useState<string[]>([])
  const [voteCount, setVoteCount] = useState(0)
  const [totalVoters, setTotalVoters] = useState(0)
  const [allVotedMsg, setAllVotedMsg] = useState(false)
  const [wordReveal, setWordReveal] = useState<{ villagerWord: string; imposterWord: string } | null>(null)
  const [isTie, setIsTie] = useState(false)
  const [showCountdown, setShowCountdown] = useState(false)
  const [countdownVal, setCountdownVal] = useState(3)
  const [totalTime, setTotalTime] = useState(30)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef<Phase>('speaking')
  const isFirstRoundRef = useRef(true)

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
    socket.on('round:speaking-turn', ({ playerId, timeSeconds, speakingOrder: order }: any) => {
      if (phaseRef.current === 'reveal') {
        setClues([])
        setHasSubmittedClue(false)
        setVotedFor(null)
        setEliminated(null)
        setWordReveal(null)
        setIsTie(false)
        setVoteCount(0)
        setAllVotedMsg(false)
      }
      setCurrentSpeakerId(playerId)
      if (order) setSpeakingOrder(order)
      phaseRef.current = 'speaking'
      setPhase('speaking')
      // Show 3-2-1 countdown on very first speaking turn
      if (isFirstRoundRef.current) {
        isFirstRoundRef.current = false
        setShowCountdown(true)
        setCountdownVal(3)
        setTimeout(() => setCountdownVal(2), 1000)
        setTimeout(() => setCountdownVal(1), 2000)
        setTimeout(() => setShowCountdown(false), 3000)
        startTimer(timeSeconds)
      } else {
        startTimer(timeSeconds)
      }
    })
    socket.on('round:voting-started', ({ timeSeconds, players: vPlayers }: any) => {
      phaseRef.current = 'voting'
      setPhase('voting')
      setCurrentSpeakerId(null)
      setVoteCount(0)
      setTotalVoters(vPlayers?.length ?? 0)
      setAllVotedMsg(false)
      startTimer(timeSeconds ?? 30)
    })
    socket.on('round:ended', ({ round, nextRound }: any) => {
      phaseRef.current = 'reveal'
      setPhase('reveal')
      setCurrentSpeakerId(null)
      setAllVotedMsg(false)
      if (nextRound) setRound(nextRound)
      if (round?.wordReveal) setWordReveal(round.wordReveal)
      if (round?.eliminatedPlayerId) {
        const elim = players.find((p: any) => p.userId === round.eliminatedPlayerId)
        setEliminated({
          username: elim?.username ?? round.eliminatedPlayerId,
          role: round.eliminatedRole ?? (elim as any)?.role ?? 'villager',
        })
        // If it's me, join dead chat
        if (round.eliminatedPlayerId === user?.id) {
          setIsEliminated(true)
          socket.emit('deadchat:join' as any)
        }
      } else {
        // Check if it was a tie (votes were cast but no majority)
        if (round?.votes?.length > 0) setIsTie(true)
      }
    })
    socket.on('vote:update' as any, ({ voteCount: vc, totalVoters: tv }: any) => {
      setVoteCount(vc)
      setTotalVoters(tv)
    })
    socket.on('vote:all-cast' as any, () => {
      setAllVotedMsg(true)
    })
    socket.on('deadchat:message' as any, (msg: { id: string; userId: string; username: string; text: string }) => {
      setDeadChatMessages((prev) => [...prev, msg])
    })
    socket.on('game:finished', (data) => {
      setResult(data)
      navigate(`/results/${code}`)
    })
    socket.on('chat:message', addMessage)
    socket.on('emote:receive' as any, ({ username, emoji }: { username: string; emoji: string }) => {
      const id = `${Date.now()}_${Math.random()}`
      const x = 10 + Math.random() * 80
      setFloatingEmotes((prev) => [...prev, { id, emoji, username, x }])
      setTimeout(() => setFloatingEmotes((prev) => prev.filter((e) => e.id !== id)), 2800)
    })

    return () => {
      socket.off('connect', handleConnect)
      socket.off('round:clue-submitted')
      socket.off('round:speaking-turn')
      socket.off('round:voting-started')
      socket.off('round:ended')
      socket.off('game:finished')
      socket.off('chat:message')
      socket.off('deadchat:message' as any)
      socket.off('emote:receive' as any)
      socket.off('vote:update' as any)
      socket.off('vote:all-cast' as any)
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

  const sendEmote = (emoji: string) => {
    getSocket().emit('emote:send' as any, { emoji })
  }

  const sendDeadChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!deadChatInput.trim()) return
    getSocket().emit('deadchat:send' as any, { text: deadChatInput.trim() })
    setDeadChatInput('')
  }

  const alivePlayers = players.filter((p) => p.status === 'alive')

  const EMOTES = ['👍', '😮', '🤔', '😂', '😱']

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Main game area ── */}
      <div className="relative flex-1 flex flex-col p-4 lg:p-6 gap-4 overflow-y-auto">

        {/* Floating emote reactions */}
        {floatingEmotes.map((e) => (
          <div
            key={e.id}
            className="pointer-events-none absolute bottom-20 z-50 flex flex-col items-center animate-float-up"
            style={{ left: `${e.x}%` }}
          >
            <span className="text-3xl drop-shadow-lg">{e.emoji}</span>
            <span className="text-[10px] text-white/70 font-semibold mt-0.5 bg-black/40 px-1.5 py-0.5 rounded-full">{e.username}</span>
          </div>
        ))}

        {showCountdown && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="text-center animate-slide-up">
              <p className="text-neutral-400 text-sm font-semibold uppercase tracking-widest mb-2">Game starts in</p>
              <p className="text-8xl font-extrabold text-brand-400 tabular-nums">{countdownVal}</p>
            </div>
          </div>
        )}

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
            {currentSpeakerId && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-950/60 border border-brand-800/40 mb-3">
                <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                <span className="text-sm font-semibold text-brand-300">
                  {players.find(p => p.userId === currentSpeakerId)?.username ?? '...'} is speaking
                </span>
                {currentSpeakerId === user?.id && <span className="text-xs text-brand-500 ml-auto">← You!</span>}
              </div>
            )}
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
              <div className="flex items-center gap-2">
                {totalVoters > 0 && (
                  <span className={['text-xs font-bold tabular-nums', voteCount === totalVoters ? 'text-emerald-400' : 'text-neutral-400'].join(' ')}>
                    {voteCount}/{totalVoters} voted
                  </span>
                )}
                {votedFor && <span className="text-xs text-emerald-400 font-semibold">✓ Vote cast</span>}
              </div>
            </div>
            {allVotedMsg && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800/40 mb-3 animate-slide-up">
                <span>✅</span>
                <span className="text-sm font-semibold text-emerald-400">Everyone has voted! Resolving...</span>
              </div>
            )}
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
            ) : isTie ? (
              <>
                <p className="text-white font-bold text-lg mb-1">🤝 It's a tie!</p>
                <p className="text-neutral-400 text-sm">Votes were split equally — no one is eliminated</p>
              </>
            ) : (
              <p className="text-neutral-400 text-sm">No one was eliminated this round</p>
            )}
            {wordReveal && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl bg-brand-950/40 border border-brand-800/40 p-3 text-center">
                  <p className="text-xs text-neutral-500 mb-1">Villager Word</p>
                  <p className="text-white font-extrabold text-xl">{wordReveal.villagerWord}</p>
                </div>
                <div className="rounded-xl bg-amber-950/40 border border-amber-800/40 p-3 text-center">
                  <p className="text-xs text-neutral-500 mb-1">Imposter Word</p>
                  <p className="text-amber-300 font-extrabold text-xl">{wordReveal.imposterWord}</p>
                </div>
              </div>
            )}
            <p className="text-xs text-neutral-600 mt-4">Next round starting soon...</p>
          </div>
        )}

        {/* Clues log */}
        <div className="card flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
            Clues — Round {currentRound?.roundNumber ?? 1}
          </p>
          {phase === 'speaking' && speakingOrder.length > 0 && (
            <div className="mb-3 pb-3 border-b border-neutral-800">
              <p className="text-xs text-neutral-600 mb-2">Speaking order</p>
              <div className="flex flex-wrap gap-1.5">
                {speakingOrder.map((uid, i) => {
                  const p = players.find(pl => pl.userId === uid)
                  const isCurrent = uid === currentSpeakerId
                  const isDone = speakingOrder.indexOf(currentSpeakerId ?? '') > i || !currentSpeakerId
                  return (
                    <div key={uid} className={[
                      'flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border transition-all',
                      isCurrent ? 'bg-brand-950/60 border-brand-700/50 text-brand-300' :
                      isDone ? 'bg-neutral-900 border-neutral-800 text-neutral-600 line-through' :
                      'bg-neutral-800/60 border-neutral-700/40 text-neutral-400',
                    ].join(' ')}>
                      <span className="text-neutral-600">{i + 1}.</span>
                      {p?.username ?? uid.slice(0,6)}
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse ml-1" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
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
                  'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-500',
                  p.status === 'alive'
                    ? 'bg-neutral-800 text-white'
                    : 'bg-red-950/30 text-neutral-600 line-through border border-red-900/20',
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
          <div className="flex-1 flex flex-col justify-end p-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">React</p>
            <div className="flex gap-2 flex-wrap">
              {EMOTES.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendEmote(emoji)}
                  className="text-2xl w-11 h-11 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/80 hover:scale-110 active:scale-95 transition-all border border-neutral-700/50"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
