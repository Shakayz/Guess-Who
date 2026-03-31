import React, { useEffect, useRef, useState, useCallback, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { useGameStore } from '../store/game'
import { useAuthStore } from '../store/auth'
import { getSocket } from '../lib/socket'
import { Avatar } from '@imposter/ui'
import type { Clue } from '@imposter/shared'
import { RoleRevealScreen } from '../components/RoleRevealScreen'
import { EliminationOverlay } from '../components/EliminationOverlay'

type Phase = 'speaking' | 'voting' | 'reveal'

const PHASE_STEP_IDS: Phase[] = ['speaking', 'voting', 'reveal']
const PHASE_ICONS: Record<Phase, string> = { speaking: '💬', voting: '🗳', reveal: '📋' }
const EMOTES = ['👍', '😮', '🤔', '😂', '😱']

/** SVG circular countdown timer — visually prominent */
const CircularTimer = memo(({ seconds, total, phase }: { seconds: number; total: number; phase: Phase }) => {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const pct = total > 0 ? seconds / total : 0
  const offset = circumference * (1 - pct)
  const urgent = seconds <= 10 && seconds > 0
  const color = phase === 'voting' ? '#f59e0b' : '#8b5cf6'
  const urgentColor = '#ef4444'

  return (
    <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 52 52" width="56" height="56">
        <circle cx="26" cy="26" r={radius} fill="none" stroke="#262626" strokeWidth="3" />
        <circle
          cx="26" cy="26" r={radius}
          fill="none"
          stroke={urgent ? urgentColor : color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-linear"
          style={{ filter: urgent ? 'drop-shadow(0 0 4px rgba(239,68,68,0.5))' : undefined }}
        />
      </svg>
      <span className={[
        'text-sm font-mono font-bold tabular-nums z-10',
        urgent ? 'text-red-400' : 'text-white',
      ].join(' ')}>
        {seconds}
      </span>
    </div>
  )
})

/** Phase progress bar — shows Speaking → Voting → Reveal */
const PhaseIndicator = memo(({ currentPhase }: { currentPhase: Phase }) => {
  const { t } = useTranslation()
  const PHASE_LABELS: Record<Phase, string> = {
    speaking: t('game.phaseSpeaking'),
    voting: t('game.phaseVoting'),
    reveal: t('game.phaseReveal'),
  }
  const currentIdx = PHASE_STEP_IDS.indexOf(currentPhase)
  return (
    <div className="flex items-center gap-1">
      {PHASE_STEP_IDS.map((id, i) => {
        const isActive = id === currentPhase
        const isDone = i < currentIdx
        return (
          <React.Fragment key={id}>
            {i > 0 && (
              <div className={['h-0.5 w-4 rounded-full transition-colors', isDone ? 'bg-brand-500' : 'bg-neutral-800'].join(' ')} />
            )}
            <div className={[
              'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold transition-all',
              isActive ? 'bg-brand-950/60 text-brand-400 border border-brand-700/40' :
              isDone ? 'text-brand-600' :
              'text-neutral-600',
            ].join(' ')}>
              <span>{PHASE_ICONS[id]}</span>
              <span className="hidden sm:inline">{PHASE_LABELS[id]}</span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
})

/** Countdown progress bar for speaking/voting phase */
const CountdownBar = memo(({ seconds, total, color }: { seconds: number; total: number; color: string }) => {
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
})

export default function GamePage() {
  const { code } = useParams<{ code: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { room, currentRound, myRole, myWord, myVillagerWord, detectiveRevealUsed, revealedPlayer, messages, addMessage, setResult, setRound, addCompletedRound, setDetectiveRevealUsed, setRevealedPlayer, setRoom } = useGameStore()
  const user = useAuthStore((s) => s.user)
  const [clueText, setClueText] = useState('')
  const [clues, setClues] = useState<Clue[]>([])
  const [chatInput, setChatInput] = useState('')
  const [deadChatInput, setDeadChatInput] = useState('')
  const [deadChatMessages, setDeadChatMessages] = useState<{ id: string; userId: string; username: string; text: string }[]>([])
  const [isEliminated, setIsEliminated] = useState(false)
  const [eliminationAnim, setEliminationAnim] = useState<{ playerName: string; role: string; isMe: boolean; reason?: 'said_word' } | null>(null)
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
  const [showRoleReveal, setShowRoleReveal] = useState(false)
  const roleRevealShownRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef<Phase>('speaking')
  const isFirstRoundRef = useRef(true)
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([])

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

  // Trigger role reveal exactly once when we arrive with a role
  useEffect(() => {
    if (myRole && !roleRevealShownRef.current) {
      roleRevealShownRef.current = true
      setShowRoleReveal(true)
    }
  }, [myRole])

  const isImposter = myRole === 'imposter' || myRole === 'double_agent'
  const players = room?.players ?? []
  const isRanked = room?.settings?.gameMode === 'ranked'

  /** In ranked games, hide other players' real names. Your own name is always visible. */
  const getDisplayName = useCallback((playerId: string, realName: string) => {
    if (!isRanked || playerId === user?.id) return realName
    const idx = players.findIndex(p => p.userId === playerId)
    return idx >= 0 ? `Player ${idx + 1}` : realName
  }, [isRanked, players, user?.id])

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
      if (round) addCompletedRound(round)
      if (nextRound) setRound(nextRound)
      if (round?.wordReveal) setWordReveal(round.wordReveal)
      if (round?.eliminatedPlayerId) {
        const elim = players.find((p: any) => p.userId === round.eliminatedPlayerId)
        const elimRole = round.eliminatedRole ?? (elim as any)?.role ?? 'villager'
        const elimName = getDisplayName(round.eliminatedPlayerId, elim?.username ?? round.eliminatedPlayerId)
        setEliminated({ username: elimName, role: elimRole })
        // Show elimination animation for everyone
        const isMe = round.eliminatedPlayerId === user?.id
        setEliminationAnim({ playerName: elimName, role: elimRole, isMe })
        // If it's me, join dead chat
        if (isMe) {
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
    socket.on('detective:result', ({ targetUserId, targetUsername, role }) => {
      setDetectiveRevealUsed()
      setRevealedPlayer({ userId: targetUserId, username: targetUsername, role })
      setTimeout(() => setRevealedPlayer(null), 5000)
    })
    socket.on('round:word-said' as any, ({ playerId, username, role }: any) => {
      if (room) {
        setRoom({
          ...room,
          players: room.players.map((p) =>
            p.userId === playerId ? { ...p, status: 'eliminated' as const } : p
          ),
        })
      }
      const isMe = playerId === user?.id
      setEliminationAnim({ playerName: username, role, isMe, reason: 'said_word' })
      if (isMe) {
        setIsEliminated(true)
        socket.emit('deadchat:join' as any)
      }
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
      const tid = setTimeout(() => setFloatingEmotes((prev) => prev.filter((e) => e.id !== id)), 2800)
      timeoutRefs.current.push(tid)
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
      socket.off('detective:result')
      socket.off('round:word-said' as any)
      socket.off('vote:update' as any)
      socket.off('vote:all-cast' as any)
      if (timerRef.current) clearInterval(timerRef.current)
      timeoutRefs.current.forEach(clearTimeout)
      timeoutRefs.current = []
    }
  }, [code, startTimer, getDisplayName])

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

        {showCountdown && !showRoleReveal && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="text-center animate-slide-up">
              <p className="text-neutral-400 text-sm font-semibold uppercase tracking-widest mb-2">{t('game.gameStartsIn')}</p>
              <p className="text-8xl font-extrabold text-brand-400 tabular-nums">{countdownVal}</p>
            </div>
          </div>
        )}

        {showRoleReveal && myRole && myWord && (
          <RoleRevealScreen
            role={myRole}
            word={myWord}
            villagerWord={myVillagerWord ?? undefined}
            onDone={() => setShowRoleReveal(false)}
          />
        )}

        {/* Detective role reveal result */}
        {revealedPlayer && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div className="animate-bounce-in px-6 py-5 rounded-2xl border text-center max-w-xs mx-4"
              style={{ backgroundColor: 'rgba(8,8,20,0.95)', borderColor: '#3b82f6', boxShadow: '0 0 30px rgba(59,130,246,0.3)' }}>
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-1">{t('game.detectiveRevealTitle')}</p>
              <p className="text-white font-extrabold text-lg">{revealedPlayer.username}</p>
              <div className={[
                'mt-2 px-3 py-1.5 rounded-lg text-sm font-bold',
                revealedPlayer.role === 'imposter' ? 'bg-red-950/60 text-red-400 border border-red-800/40' :
                revealedPlayer.role === 'double_agent' ? 'bg-orange-950/60 text-orange-400 border border-orange-800/40' :
                revealedPlayer.role === 'detective' ? 'bg-blue-950/60 text-blue-400 border border-blue-800/40' :
                'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40',
              ].join(' ')}>
                {revealedPlayer.role === 'imposter' ? t('game.roleImposter') :
                 revealedPlayer.role === 'double_agent' ? t('game.roleDoubleAgent') :
                 revealedPlayer.role === 'detective' ? t('game.roleDetective') :
                 t('game.roleVillager')}
              </div>
            </div>
          </div>
        )}

        {eliminationAnim && (
          <EliminationOverlay
            playerName={eliminationAnim.playerName}
            role={eliminationAnim.role}
            isMe={eliminationAnim.isMe}
            reason={eliminationAnim.reason}
            onDone={() => setEliminationAnim(null)}
          />
        )}

        {/* Top bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {timeLeft > 0 && (
                <CircularTimer seconds={timeLeft} total={totalTime} phase={phase} />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold tracking-tight text-white">Imposter</span>
                  {code && (
                    <span className="text-xs font-mono text-neutral-500 border border-neutral-800 rounded px-2 py-0.5">
                      {code}
                    </span>
                  )}
                </div>
                <span className="text-xs text-neutral-500">
                  {t('game.aliveCount', { count: alivePlayers.length })} · {t('game.roundNumber', { number: currentRound?.roundNumber ?? 1 })}
                </span>
              </div>
            </div>
            <PhaseIndicator currentPhase={phase} />
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
          {myVillagerWord ? (
            /* Double agent: two word chips */
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🎭</span>
                <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">
                  {t('game.roleDoubleAgent')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-emerald-950/40 border border-emerald-800/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">{t('game.villagerWord')}</p>
                  <p className="text-xl font-extrabold text-emerald-200">{myVillagerWord}</p>
                </div>
                <div className="rounded-xl bg-orange-950/40 border border-orange-800/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-1">{t('game.imposterWord')}</p>
                  <p className="text-xl font-extrabold text-orange-200">{myWord}</p>
                </div>
              </div>
              <p className="text-xs text-neutral-600 mt-2">{t('game.giveClueHint')}</p>
            </div>
          ) : (
            <div className="relative flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 bg-neutral-800/60">
                🔤
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-0.5">
                  {t('game.yourWordLabel')}
                </p>
                <p className="text-2xl font-extrabold tracking-tight text-white">
                  {myWord ?? '???'}
                </p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {t('game.giveClueHint')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Speaking phase: clue input */}
        {phase === 'speaking' && (
          <div className="card">
            {currentSpeakerId && (() => {
              const speaker = players.find(p => p.userId === currentSpeakerId)
              const isMe = currentSpeakerId === user?.id
              return (
                <div className={[
                  'flex items-center gap-3 px-4 py-3 rounded-xl border mb-3',
                  isMe
                    ? 'bg-brand-950/80 border-brand-700/60 ring-1 ring-brand-600/30'
                    : 'bg-neutral-800/60 border-neutral-700/40',
                ].join(' ')}>
                  <Avatar username={speaker?.username ?? '?'} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className={['font-bold text-sm truncate', isMe ? 'text-brand-200' : 'text-white'].join(' ')}>
                      {isMe ? t('game.yourTurn') : t('game.isSpeaking', { name: currentSpeakerId ? getDisplayName(currentSpeakerId, speaker?.username ?? '...') : '...' })}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {isMe ? t('game.yourTurnHint') : t('game.isListening')}
                    </p>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-400 animate-pulse shrink-0" />
                </div>
              )
            })()}
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">{t('game.yourClue')}</p>
            {hasSubmittedClue ? (
              <div className="flex items-center gap-2 py-2 text-emerald-400 text-sm">
                <span>✓</span>
                <span>{t('game.clueSubmitted')}</span>
              </div>
            ) : (
              <form onSubmit={submitClue} className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder={t('game.cluePlaceholder')}
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
                  {t('game.send')}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Voting phase */}
        {phase === 'voting' && (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{t('game.voteOutImposter')}</p>
              {totalVoters > 0 && (
                <span className={['text-xs font-bold tabular-nums', voteCount === totalVoters ? 'text-emerald-400' : 'text-neutral-400'].join(' ')}>
                  {t('game.voteCount', { count: voteCount, total: totalVoters })}
                </span>
              )}
            </div>
            {/* Vote progress bar */}
            {totalVoters > 0 && (
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-3">
                <div
                  className={['h-full rounded-full transition-all duration-500', voteCount === totalVoters ? 'bg-emerald-500' : 'bg-amber-500'].join(' ')}
                  style={{ width: `${(voteCount / totalVoters) * 100}%` }}
                />
              </div>
            )}
            {allVotedMsg && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800/40 mb-3 animate-slide-up">
                <span>✅</span>
                <span className="text-sm font-semibold text-emerald-400">{t('game.everyoneVoted')}</span>
              </div>
            )}
            {/* Your vote summary */}
            {votedFor && (() => {
              const votedPlayer = alivePlayers.find(p => p.userId === votedFor)
              return votedPlayer ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-950/30 border border-amber-800/30 mb-3">
                  <span className="text-amber-400 text-xs">🗳</span>
                  <span className="text-xs text-amber-300 font-semibold">{t('game.youVotedFor')} <span className="text-amber-200">{getDisplayName(votedPlayer.userId, votedPlayer.username)}</span></span>
                </div>
              ) : null
            })()}
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
                    <span className="flex-1 font-semibold text-white text-sm">{getDisplayName(p.userId, p.username)}</span>
                    {votedFor === p.userId && (
                      <span className="text-amber-400 text-xs font-bold">{t('game.yourVoteLabel')}</span>
                    )}
                    {!votedFor && (
                      <span className="text-neutral-600 text-xs">{t('game.clickToVote')}</span>
                    )}
                  </button>
                ))}
            </div>
            {/* Speaking order reminder during voting */}
            {speakingOrder.length > 0 && (
              <div className="mt-3 pt-3 border-t border-neutral-800">
                <p className="text-xs text-neutral-600 mb-1.5">{t('game.speakingOrderReminder')}</p>
                <div className="flex flex-wrap gap-1">
                  {speakingOrder.map((uid, i) => {
                    const p = players.find(pl => pl.userId === uid)
                    return (
                      <span key={uid} className="text-xs px-2 py-0.5 rounded bg-neutral-800/60 text-neutral-500 border border-neutral-700/30">
                        {i + 1}. {p ? getDisplayName(p.userId, p.username) : uid.slice(0, 6)}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
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
                  {t('game.wasEliminatedPlayer', { name: eliminated.username })}
                </p>
                <p className={[
                  'text-sm font-semibold',
                  eliminated.role === 'imposter' || eliminated.role === 'double_agent'
                    ? 'text-red-400'
                    : 'text-brand-400',
                ].join(' ')}>
                  {t('game.theyWereA')}{' '}
                  {eliminated.role === 'imposter' ? t('game.roleImposter')
                    : eliminated.role === 'double_agent' ? t('game.roleDoubleAgent')
                    : t('game.roleVillager')}
                </p>
              </>
            ) : isTie ? (
              <>
                <p className="text-white font-bold text-lg mb-1">🤝 {t('game.itsTie')}</p>
                <p className="text-neutral-400 text-sm">{t('game.tieDesc')}</p>
              </>
            ) : (
              <p className="text-neutral-400 text-sm">{t('game.noEliminatedRound')}</p>
            )}
            {wordReveal && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl bg-brand-950/40 border border-brand-800/40 p-3 text-center">
                  <p className="text-xs text-neutral-500 mb-1">{t('game.villagerWord')}</p>
                  <p className="text-white font-extrabold text-xl">{wordReveal.villagerWord}</p>
                </div>
                <div className="rounded-xl bg-amber-950/40 border border-amber-800/40 p-3 text-center">
                  <p className="text-xs text-neutral-500 mb-1">{t('game.imposterWord')}</p>
                  <p className="text-amber-300 font-extrabold text-xl">{wordReveal.imposterWord}</p>
                </div>
              </div>
            )}
            <p className="text-xs text-neutral-600 mt-4">{t('game.nextRoundSoon')}</p>
          </div>
        )}

        {/* Clues log */}
        <div className="card flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
            {t('game.cluesTitle', { round: currentRound?.roundNumber ?? 1 })}
          </p>
          {phase === 'speaking' && speakingOrder.length > 0 && (
            <div className="mb-3 pb-3 border-b border-neutral-800">
              <p className="text-xs text-neutral-600 mb-2">{t('game.speakingOrder')}</p>
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
                      {p ? getDisplayName(p.userId, p.username) : uid.slice(0,6)}
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse ml-1" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {clues.length === 0 ? (
            <p className="text-neutral-600 text-sm italic">{t('game.noClues')}</p>
          ) : (
            <div className="space-y-2">
              {clues.map((clue, i) => {
                const player = players.find((p) => p.userId === clue.playerId)
                const isMe = clue.playerId === user?.id
                return (
                  <div
                    key={i}
                    className={[
                      'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all animate-scale-in',
                      clue.flaggedForWord
                        ? 'ring-1 ring-amber-500/40 bg-amber-950/20 border-amber-700/40'
                        : isMe
                          ? 'bg-brand-950/30 border-brand-800/30'
                          : 'bg-neutral-800/30 border-neutral-800/50',
                    ].join(' ')}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <Avatar username={player?.username ?? '?'} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-neutral-400">
                          {player ? getDisplayName(player.userId, player.username) : 'Unknown'}
                        </span>
                        <span className="text-neutral-700 text-[10px]">#{i + 1}</span>
                        {isMe && <span className="text-[10px] text-brand-400 font-bold">YOU</span>}
                        {clue.flaggedForWord && (
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider ml-auto">
                            ⚠ {t('game.saidTheWordBadge')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white leading-snug mt-0.5">{clue.text}</p>
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
            {t('game.playersLabel', { count: alivePlayers.length })}
          </p>
          {/* Detective ability banner */}
          {myRole === 'detective' && (
            <div className={[
              'flex items-center gap-2 px-3 py-2 rounded-xl border mb-2 text-xs font-semibold',
              detectiveRevealUsed
                ? 'bg-neutral-900/40 border-neutral-800 text-neutral-600'
                : 'bg-blue-950/40 border-blue-800/40 text-blue-400',
            ].join(' ')}>
              <span>🔍</span>
              <span>{detectiveRevealUsed ? t('game.detectiveUsed') : t('game.detectiveAvailable')}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {players.map((p) => {
              const canReveal = myRole === 'detective' && !detectiveRevealUsed && p.userId !== user?.id && p.status === 'alive' && (phase === 'speaking' || phase === 'voting')
              return (
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
                  {getDisplayName(p.userId, p.username)}
                  {canReveal && (
                    <button
                      onClick={() => getSocket().emit('detective:reveal', { targetUserId: p.userId })}
                      className="ml-0.5 text-blue-400 hover:text-blue-300 text-[10px] font-bold border border-blue-800/50 rounded px-1 transition-colors"
                      title={t('game.detectiveRevealBtn')}
                    >
                      🔍
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Ghost Chat — only for eliminated players */}
        {isEliminated ? (
          <div className="flex-1 flex flex-col border-t-2 border-red-900/50">
            <div className="px-3 py-2 bg-red-950/30 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-red-500">{t('game.ghostChat')}</span>
              <span className="text-xs text-neutral-600">{t('game.ghostOnly')}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {deadChatMessages.length === 0 ? (
                <p className="text-neutral-700 text-xs italic">{t('game.ghostDesc')}</p>
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
                  placeholder={t('game.ghostPlaceholder')}
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
          <div className="flex-1 flex flex-col justify-end p-3 gap-3">
            {/* Chat disabled notice */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-neutral-600 text-sm shrink-0">🔇</span>
              <p className="text-xs text-neutral-600 leading-relaxed">
                {t('game.chatDisabled')}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">{t('game.react')}</p>
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
          </div>
        )}
      </div>
    </div>
  )
}
