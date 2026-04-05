import React, { useEffect, useRef, useState, useCallback, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { useGameStore } from '../store/game'
import { useAuthStore } from '../store/auth'
import { getSocket, connectSocket } from '../lib/socket'
import { Avatar } from '@imposter/ui'
import type { Clue } from '@imposter/shared'
// Overlays removed — they blocked gameplay and caused desync between players

type Phase = 'clues' | 'voting' | 'reveal'

const PHASE_STEP_IDS: Phase[] = ['clues', 'voting', 'reveal']
const PHASE_ICONS: Record<Phase, string> = { clues: '✏️', voting: '🗳', reveal: '📋' }
const EMOTES = ['👍', '😮', '🤔', '😂', '😱']

/** SVG circular countdown timer — visually prominent */
const CircularTimer = memo(({ seconds, total, phase }: { seconds: number; total: number; phase: Phase }) => {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const pct = total > 0 ? seconds / total : 0
  const offset = circumference * (1 - pct)
  const urgent = seconds <= 10 && seconds > 0
  const color = phase === 'voting' ? '#f59e0b' : '#8b5cf6'
  const colorGlow = phase === 'voting' ? 'rgba(245,158,11,0.5)' : 'rgba(139,92,246,0.5)'
  const urgentColor = '#ef4444'
  const urgentGlow = 'rgba(239,68,68,0.6)'

  return (
    <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 52 52" width="56" height="56">
        <circle cx="26" cy="26" r={radius} fill="none" stroke="#262626" strokeWidth="4" />
        <circle
          cx="26" cy="26" r={radius}
          fill="none"
          stroke={urgent ? urgentColor : color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-linear"
          style={{ filter: `drop-shadow(0 0 6px ${urgent ? urgentGlow : colorGlow})` }}
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
    clues: t('game.phaseClues', 'Clues'),
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

/** Modal that shows a player's full clue history across all completed rounds */
const PlayerClueHistoryModal = memo(({
  playerId,
  onClose,
  players,
  completedRounds,
  currentRound,
  result,
  getDisplayName,
}: {
  playerId: string
  onClose: () => void
  players: import('@imposter/shared').Player[]
  completedRounds: import('@imposter/shared').Round[]
  currentRound: import('@imposter/shared').Round | null
  result: { winner: string } | null
  getDisplayName: (id: string, name: string) => string
}) => {
  const { t } = useTranslation()
  const player = players.find((p) => p.userId === playerId)
  if (!player) return null

  const gameOver = !!result || player.status === 'eliminated' || player.status === 'forfeited'

  // Collect all rounds in order (completed + current if clues exist)
  const allRounds: import('@imposter/shared').Round[] = [
    ...completedRounds,
    ...(currentRound && currentRound.clues.some((c) => c.playerId === playerId) ? [currentRound] : []),
  ]

  const ROLE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    villager:     { icon: '🏘️', color: 'text-emerald-400', label: t('game.roleVillager', 'Villager') },
    imposter:     { icon: '🔪', color: 'text-red-400',     label: t('game.roleImposter', 'Imposter') },
    detective:    { icon: '🔍', color: 'text-blue-400',    label: t('game.roleDetective', 'Detective') },
    double_agent: { icon: '🎭', color: 'text-orange-400',  label: t('game.roleDoubleAgent', 'Double Agent') },
  }
  const roleInfo = player.role ? ROLE_CONFIG[player.role] : null

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <>
      <style>{`
        @keyframes slide-in-right { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .player-history-panel { animation: slide-in-right 0.25s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end"
        onClick={handleBackdrop}
      >
        {/* Panel */}
        <div
          className="player-history-panel relative w-full max-w-sm h-full bg-neutral-900 border-l border-neutral-700 flex flex-col overflow-hidden"
          data-testid="player-history-panel"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-neutral-800 shrink-0">
            <Avatar username={player.username} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate">{getDisplayName(player.userId, player.username)}</p>
              {gameOver && roleInfo && (
                <p className={['text-xs font-semibold flex items-center gap-1 mt-0.5', roleInfo.color].join(' ')}>
                  <span>{roleInfo.icon}</span>
                  <span>{roleInfo.label}</span>
                </p>
              )}
              {(player.status === 'eliminated' || player.status === 'forfeited') && (
                <p className="text-xs text-red-400 font-semibold mt-0.5">
                  {player.status === 'forfeited' ? '🏳 Forfeited' : '💀 Eliminated'}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">
              {t('game.clueHistory', 'Clue History')}
            </p>

            {allRounds.length === 0 && (
              <p className="text-sm text-neutral-600 italic">{t('game.noClueHistory', 'No clues yet.')}</p>
            )}

            {allRounds.map((round) => {
              const clue = round.clues.find((c) => c.playerId === playerId)
              const wasElimThisRound = round.eliminatedPlayerId === playerId
              const isCurrent = currentRound?.id === round.id

              return (
                <div
                  key={round.id}
                  className={[
                    'rounded-xl border px-3 py-2.5',
                    clue?.flaggedForWord
                      ? 'border-amber-700/50 bg-amber-950/20'
                      : wasElimThisRound
                      ? 'border-red-800/40 bg-red-950/20'
                      : 'border-neutral-800 bg-neutral-800/30',
                  ].join(' ')}
                >
                  {/* Round header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      {t('game.roundNumber', { number: round.roundNumber })}
                      {isCurrent && (
                        <span className="ml-1.5 text-brand-400">{t('game.currentRoundBadge', '(current)')}</span>
                      )}
                    </span>
                    {clue?.flaggedForWord && (
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                        ⚠ {t('game.saidTheWordBadge', 'Said the word')}
                      </span>
                    )}
                  </div>

                  {/* Clue bubble or eliminated notice */}
                  {clue ? (
                    <div className={[
                      'rounded-lg px-3 py-2 text-sm text-white leading-snug',
                      clue.flaggedForWord
                        ? 'bg-amber-950/40 border border-amber-700/40'
                        : 'bg-neutral-700/40',
                    ].join(' ')}>
                      {clue.text}
                    </div>
                  ) : wasElimThisRound ? (
                    <p className="text-xs text-red-400 font-semibold flex items-center gap-1">
                      <span>💀</span>
                      <span>{t('game.eliminatedThisRound', 'Eliminated this round')}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-600 italic">
                      {t('game.noClueThisRound', 'No clue this round')}
                    </p>
                  )}
                </div>
              )
            })}

            {/* Eliminated / forfeited summary at bottom */}
            {(player.status === 'eliminated' || player.status === 'forfeited') && (
              <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-2 flex items-center gap-2">
                <span className="text-red-400">{player.status === 'forfeited' ? '🏳' : '💀'}</span>
                <span className="text-xs text-red-300 font-semibold">
                  {player.status === 'forfeited'
                    ? t('game.playerForfeited', 'Player forfeited the game')
                    : t('game.playerEliminated', 'Player was eliminated')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
})

export default function GamePage() {
  const { code } = useParams<{ code: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { room, currentRound, completedRounds, myRole, myWord, myVillagerWord, detectiveRevealUsed, revealedPlayer, messages, addMessage, setResult, setRound, addCompletedRound, setDetectiveRevealUsed, setRevealedPlayer, setRoom, setRoleAndWord, result, reset } = useGameStore()
  const user = useAuthStore((s) => s.user)
  const [clueText, setClueText] = useState('')
  const [clues, setClues] = useState<Clue[]>([])
  const [chatInput, setChatInput] = useState('')
  const [deadChatInput, setDeadChatInput] = useState('')
  const [deadChatMessages, setDeadChatMessages] = useState<{ id: string; userId: string; username: string; text: string }[]>([])
  const [isEliminated, setIsEliminated] = useState(false)
  const [floatingEmotes, setFloatingEmotes] = useState<{ id: string; emoji: string; username: string; x: number }[]>([])
  const [phase, setPhase] = useState<Phase>('clues')
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
  const [totalTime, setTotalTime] = useState(30)
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false)
  const [showRoleCard, setShowRoleCard] = useState(!!myRole)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [tiebreakerActive, setTiebreakerActive] = useState(false)
  const [tiebreakerPlayerIds, setTiebreakerPlayerIds] = useState<string[]>([])
  const [tiebreakerUsernames, setTiebreakerUsernames] = useState<string[]>([])
  const [tiebreakerPhase, setTiebreakerPhase] = useState<'clue' | 'vote' | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef<Phase>('clues')
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


  const isImposter = myRole === 'imposter' || myRole === 'double_agent'
  const players = room?.players ?? []
  const isRanked = room?.settings?.gameMode === 'ranked'
  const gameIsRunning = room?.status === 'in_progress' || room?.status === 'voting'

  // Restore eliminated state from persisted room data (e.g. after page refresh)
  useEffect(() => {
    if (!room || !user) return
    const me = room.players?.find((p) => p.userId === user.id)
    if (me && (me.status === 'eliminated' || me.status === 'forfeited') && !isEliminated) {
      setIsEliminated(true)
    }
  }, [room, user])

  const isAliveInGame = gameIsRunning && !isEliminated

  // Block tab close / browser refresh + back button while alive in game
  useEffect(() => {
    if (!isAliveInGame) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    const handlePopState = () => {
      // Push state back so the user stays on the game page
      window.history.pushState(null, '', window.location.href)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)
    // Push an extra history entry so back button triggers popstate instead of leaving
    window.history.pushState(null, '', window.location.href)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isAliveInGame])

  /** In ranked games, hide other players' real names. Your own name is always visible. */
  const getDisplayName = useCallback((playerId: string, realName: string) => {
    if (!isRanked || playerId === user?.id) return realName
    const idx = players.findIndex(p => p.userId === playerId)
    return idx >= 0 ? `Player ${idx + 1}` : realName
  }, [isRanked, players, user?.id])

  // Refs so socket handlers always call the latest version without re-subscribing
  const getDisplayNameRef = useRef(getDisplayName)
  useEffect(() => { getDisplayNameRef.current = getDisplayName }, [getDisplayName])
  const startTimerRef = useRef(startTimer)
  useEffect(() => { startTimerRef.current = startTimer }, [startTimer])

  useEffect(() => {
    connectSocket()
    const socket = getSocket()

    // Clear any stale result from a previous game so this new game starts fresh.
    // (The old code navigated to /results here, which caused players to see old
    //  win/loss screens when starting a new game in the same room.)
    if (result) {
      reset()
    }

    // On game start, reset ALL UI state and set new role/word
    socket.on('game:started', ({ yourWord, yourRole, yourVillagerWord }: any) => {
      setRoleAndWord(yourRole, yourWord, yourVillagerWord)
      setShowRoleCard(true)
      // Clear all per-round UI state from any previous game
      setClues([])
      setHasSubmittedClue(false)
      setVotedFor(null)
      setEliminated(null)
      setWordReveal(null)
      setIsTie(false)
      setVoteCount(0)
      setTotalVoters(0)
      setAllVotedMsg(false)
      setIsEliminated(false)
      setDeadChatMessages([])
      setCurrentSpeakerId(null)
      phaseRef.current = 'clues'
      setPhase('clues')
    })

    // Full phase sync on reconnect — restores timer, clues, votes, speaking order and tiebreaker state
    socket.on('game:sync', ({ phase: syncPhase, currentSpeakerId: speakerId, speakingOrder: order, clues: syncClues, votes: syncVotes, timeRemainingSeconds, currentRound: syncRound, tiebreakerActive: syncTbActive, tiebreakerPlayerIds: syncTbIds, tiebreakerPhase: syncTbPhase }: any) => {
      setClues(syncClues ?? [])
      if (syncRound) setRound(syncRound)

      // Restore tiebreaker state if active
      if (syncTbActive) {
        setTiebreakerActive(true)
        setTiebreakerPlayerIds(syncTbIds ?? [])
        setTiebreakerPhase(syncTbPhase ?? 'clue')
      }

      if (syncPhase === 'speaking') {
        phaseRef.current = 'clues'
        setPhase('clues')
        setCurrentSpeakerId(speakerId ?? null)
        if (order) setSpeakingOrder(order)
        startTimerRef.current(timeRemainingSeconds ?? 30)
        // Restore clue-submitted state if we already spoke this turn
        const myClue = (syncClues ?? []).find((c: any) => c.playerId === user?.id)
        if (myClue) setHasSubmittedClue(true)
      } else if (syncPhase === 'voting') {
        phaseRef.current = 'voting'
        setPhase('voting')
        setCurrentSpeakerId(null)
        if (order) setSpeakingOrder(order)
        setVoteCount((syncVotes ?? []).length)
        // speakingOrder at round start = alive player count = total voters
        setTotalVoters(order?.length ?? 0)
        startTimerRef.current(timeRemainingSeconds ?? 30)
        // Restore our own vote if we already cast one
        const myVote = (syncVotes ?? []).find((v: any) => v.voterId === user?.id)
        if (myVote) setVotedFor(myVote.targetId)
      }
    })

    // Update room state when a player forfeits mid-game
    socket.on('game:player-forfeited', ({ userId: forfeitedId }: any) => {
      const s = useGameStore.getState()
      if (!s.room) return
      s.setRoom({
        ...s.room,
        players: s.room.players.map((p) =>
          p.userId === forfeitedId ? { ...p, status: 'forfeited' as const } : p
        ),
      })
    })

    socket.on('round:clue-submitted', (clue) => setClues((c) => [...c, clue as Clue]))
    socket.on('round:speaking-turn', ({ playerId, timeSeconds, speakingOrder: order }: any) => {
      // Clean up previous round state when entering a new clue phase
      if (phaseRef.current !== 'clues') {
        setClues([])
        setHasSubmittedClue(false)
        setVotedFor(null)
        setEliminated(null)
        setWordReveal(null)
        setIsTie(false)
        setVoteCount(0)
        setAllVotedMsg(false)
      }
      setCurrentSpeakerId(null)
      if (order) setSpeakingOrder(order)
      phaseRef.current = 'clues'
      setPhase('clues')
      startTimerRef.current(timeSeconds)
    })
    socket.on('round:voting-started', ({ timeSeconds, players: vPlayers }: any) => {
      phaseRef.current = 'voting'
      setPhase('voting')
      setCurrentSpeakerId(null)
      setVoteCount(0)
      setTotalVoters(vPlayers?.length ?? 0)
      setAllVotedMsg(false)
      startTimerRef.current(timeSeconds ?? 30)
    })
    socket.on('round:ended', ({ round, nextRound }: any) => {
      phaseRef.current = 'reveal'
      setPhase('reveal')
      setCurrentSpeakerId(null)
      setAllVotedMsg(false)
      // Clear tiebreaker state when round ends
      setTiebreakerActive(false)
      setTiebreakerPlayerIds([])
      setTiebreakerUsernames([])
      setTiebreakerPhase(null)
      if (round) addCompletedRound(round)
      if (nextRound) setRound(nextRound)
      if (round?.wordReveal) setWordReveal(round.wordReveal)
      if (round?.eliminatedPlayerId) {
        const elim = players.find((p: any) => p.userId === round.eliminatedPlayerId)
        const elimRole = round.eliminatedRole ?? (elim as any)?.role ?? 'villager'
        const elimName = getDisplayNameRef.current(round.eliminatedPlayerId, elim?.username ?? round.eliminatedPlayerId)
        setEliminated({ username: elimName, role: elimRole })
        const isMe = round.eliminatedPlayerId === user?.id
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

    socket.on('round:tiebreaker-start' as any, ({ tiedPlayerIds, tiedUsernames, timeSeconds }: any) => {
      setTiebreakerActive(true)
      setTiebreakerPlayerIds(tiedPlayerIds ?? [])
      setTiebreakerUsernames(tiedUsernames ?? [])
      setTiebreakerPhase('clue')
      setVotedFor(null)
      setHasSubmittedClue(false)
      setClues([])
      phaseRef.current = 'clues'
      setPhase('clues')
      startTimerRef.current(timeSeconds ?? 30)
    })

    socket.on('round:tiebreaker-voting' as any, ({ tiedPlayerIds, timeSeconds }: any) => {
      setTiebreakerPlayerIds(tiedPlayerIds ?? [])
      setTiebreakerPhase('vote')
      setVoteCount(0)
      setAllVotedMsg(false)
      phaseRef.current = 'voting'
      setPhase('voting')
      startTimerRef.current(timeSeconds ?? 30)
    })
    socket.on('vote:update' as any, ({ voteCount: vc, totalVoters: tv }: any) => {
      setVoteCount(vc)
      setTotalVoters(tv)
    })
    socket.on('vote:all-cast' as any, () => {
      setAllVotedMsg(true)
    })
    socket.on('deadchat:message' as any, (msg: { id: string; userId: string; username: string; text: string }) => {
      setDeadChatMessages((prev) => {
        const next = [...prev, msg]
        return next.length > 200 ? next.slice(-200) : next
      })
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
      if (isMe) {
        setIsEliminated(true)
        socket.emit('deadchat:join' as any)
      }
    })
    socket.on('game:finished', (data) => {
      setResult(data)
      // Mark room as finished so ActiveGameGuard stops blocking
      const currentRoom = useGameStore.getState().room
      if (currentRoom) {
        useGameStore.getState().setRoom({ ...currentRoom, status: 'finished' as any })
      }
      navigate(`/results/${code}`)
    })
    // Keep room state in sync (player list, status changes)
    socket.on('room:updated', (roomData: any) => {
      setRoom(roomData)
      // If game ended externally (e.g. all forfeited), navigate to results
      if (roomData.status === 'finished' && useGameStore.getState().result) {
        navigate(`/results/${code}`)
      }
    })
    socket.on('error', (err: any) => {
      console.error('[game] socket error:', err?.code, err?.message)
    })
    socket.on('chat:message', addMessage)
    socket.on('emote:receive' as any, ({ username, emoji }: { username: string; emoji: string }) => {
      const id = `${Date.now()}_${Math.random()}`
      const x = 10 + Math.random() * 80
      setFloatingEmotes((prev) => prev.length >= 20 ? prev : [...prev, { id, emoji, username, x }])
      const tid = setTimeout(() => setFloatingEmotes((prev) => prev.filter((e) => e.id !== id)), 2800)
      timeoutRefs.current.push(tid)
    })

    // Register all handlers BEFORE emitting room:join so we don't miss the response
    const handleConnect = () => {
      if (code) socket.emit('room:join', { roomCode: code })
    }
    socket.on('connect', handleConnect)
    if (code) socket.emit('room:join', { roomCode: code })

    return () => {
      socket.off('connect', handleConnect)
      socket.off('game:started')
      socket.off('game:sync')
      socket.off('game:player-forfeited')
      socket.off('round:clue-submitted')
      socket.off('round:speaking-turn')
      socket.off('round:voting-started')
      socket.off('round:ended')
      socket.off('round:tiebreaker-start' as any)
      socket.off('round:tiebreaker-voting' as any)
      socket.off('game:finished')
      socket.off('room:updated')
      socket.off('error')
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
  }, [code])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, deadChatMessages])

  const submitClue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!clueText.trim() || hasSubmittedClue || phase !== 'clues' || isEliminated) return
    getSocket().emit('clue:submit', clueText.trim())
    setClueText('')
    setHasSubmittedClue(true)
  }

  const iAmTiedPlayer = tiebreakerActive && tiebreakerPlayerIds.includes(user?.id ?? '')

  const vote = (playerId: string) => {
    if (votedFor || phase !== 'voting') return
    // Tied players cannot vote during tiebreaker
    if (iAmTiedPlayer) return
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

  const handleForfeit = () => {
    getSocket().emit('game:forfeit')
    reset()
    navigate('/')
  }

  const handleLeaveEliminated = () => {
    getSocket().emit('game:leave-eliminated')
    // Don't reset game state — the game is still running. The player stays
    // "associated" with this game and cannot start a new one until game:finished
    // arrives. They'll be redirected to results when the game ends.
    navigate('/')
  }

  // Auto-dismiss role card after 5 seconds
  useEffect(() => {
    if (!showRoleCard) return
    const timer = setTimeout(() => setShowRoleCard(false), 5000)
    return () => clearTimeout(timer)
  }, [showRoleCard])

  const ROLE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
    villager:     { icon: '🏘️', label: t('game.roleVillager', 'Villager'),     color: 'text-emerald-400', bg: 'from-emerald-900/40' },
    imposter:     { icon: '🔪', label: t('game.roleImposter', 'Imposter'),     color: 'text-red-400',     bg: 'from-red-900/40' },
    detective:    { icon: '🔍', label: t('game.roleDetective', 'Detective'),    color: 'text-blue-400',    bg: 'from-blue-900/40' },
    double_agent: { icon: '🎭', label: t('game.roleDoubleAgent', 'Double Agent'), color: 'text-orange-400',  bg: 'from-orange-900/40' },
  }
  const roleInfo = ROLE_CONFIG[myRole ?? 'villager'] ?? ROLE_CONFIG.villager

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Player clue history modal ── */}
      {selectedPlayerId && (
        <PlayerClueHistoryModal
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
          players={players}
          completedRounds={completedRounds}
          currentRound={currentRound}
          result={result}
          getDisplayName={getDisplayName}
        />
      )}

      {/* ── Role reveal overlay ── */}
      {showRoleCard && myRole && (
        <>
          <style>{`
            @keyframes role-drop { 0% { transform: translateY(-60px) scale(0.7); opacity: 0; } 60% { transform: translateY(8px) scale(1.05); } 100% { transform: translateY(0) scale(1); opacity: 1; } }
            @keyframes role-rise { 0% { transform: translateY(20px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
            @keyframes role-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(168,85,247,0.4); } 50% { box-shadow: 0 0 0 20px rgba(168,85,247,0); } }
          `}</style>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={() => setShowRoleCard(false)}
          >
            <div className="text-center pointer-events-none select-none px-6">
              <div style={{ animation: 'role-drop 0.6s cubic-bezier(0.34,1.56,0.64,1) both', fontSize: 80 }}>
                {roleInfo.icon}
              </div>
              <p
                className={['text-xs font-bold uppercase tracking-[0.3em] mt-4', roleInfo.color].join(' ')}
                style={{ animation: 'role-rise 0.4s ease 0.2s both' }}
              >
                {t('game.yourRole', 'YOUR ROLE')}
              </p>
              <h1
                className={['text-4xl sm:text-5xl font-black tracking-tight mt-1', roleInfo.color].join(' ')}
                style={{ animation: 'role-rise 0.4s ease 0.3s both' }}
              >
                {roleInfo.label}
              </h1>
              <div className="mt-5" style={{ animation: 'role-rise 0.4s ease 0.45s both' }}>
                {myVillagerWord ? (
                  <div className="flex gap-3 justify-center">
                    <div className="rounded-xl bg-emerald-950/60 border border-emerald-800/40 px-4 py-2 text-center">
                      <p className="text-[10px] text-emerald-500 font-bold uppercase">{t('game.villagerWord')}</p>
                      <p className="text-xl font-extrabold text-emerald-200 mt-0.5">{myVillagerWord}</p>
                    </div>
                    <div className="rounded-xl bg-orange-950/60 border border-orange-800/40 px-4 py-2 text-center">
                      <p className="text-[10px] text-orange-500 font-bold uppercase">{t('game.imposterWord')}</p>
                      <p className="text-xl font-extrabold text-orange-200 mt-0.5">{myWord}</p>
                    </div>
                  </div>
                ) : (
                  <div className="inline-block rounded-xl bg-neutral-900/80 border border-neutral-700/50 px-6 py-3" style={{ animation: 'role-pulse 2s ease infinite' }}>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase">{t('game.yourWordLabel')}</p>
                    <p className="text-2xl font-extrabold text-white mt-0.5">{myWord}</p>
                  </div>
                )}
              </div>
              <p className="text-neutral-500 text-xs mt-6" style={{ animation: 'role-rise 0.4s ease 0.6s both' }}>
                {t('game.tapToContinue', 'Tap to continue')}
              </p>
            </div>
          </div>
        </>
      )}

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

        {/* Detective role reveal — small non-blocking toast */}
        {revealedPlayer && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-slide-up">
            <div className="px-4 py-3 rounded-xl border text-center"
              style={{ backgroundColor: 'rgba(8,8,20,0.95)', borderColor: '#3b82f6', boxShadow: '0 0 20px rgba(59,130,246,0.3)' }}>
              <span className="text-blue-400 font-bold text-sm">🔍 {revealedPlayer.username}: </span>
              <span className={[
                'text-sm font-bold',
                revealedPlayer.role === 'imposter' || revealedPlayer.role === 'double_agent' ? 'text-red-400' : 'text-emerald-400',
              ].join(' ')}>
                {revealedPlayer.role === 'imposter' ? t('game.roleImposter') :
                 revealedPlayer.role === 'double_agent' ? t('game.roleDoubleAgent') :
                 revealedPlayer.role === 'detective' ? t('game.roleDetective') :
                 t('game.roleVillager')}
              </span>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              {timeLeft > 0 && (
                <CircularTimer seconds={timeLeft} total={totalTime} phase={phase} />
              )}
              <div className="min-w-0">
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
            <div className="flex items-center gap-2 shrink-0">
              {/* Forfeit button — always visible in main area */}
              {!isEliminated && (
                showForfeitConfirm ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={handleForfeit} className="px-2.5 py-1 rounded-lg bg-orange-700 hover:bg-orange-600 text-white text-xs font-bold transition-colors">
                      {t('game.forfeitConfirmYes', 'Yes, forfeit')}
                    </button>
                    <button onClick={() => setShowForfeitConfirm(false)} className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors">
                      {t('game.forfeitConfirmNo', 'Cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowForfeitConfirm(true)}
                    className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/50 hover:border-orange-800/50 text-neutral-500 hover:text-orange-400 text-xs font-semibold transition-all"
                  >
                    🏳 {t('game.forfeit', 'Forfeit')}
                  </button>
                )
              )}
              <PhaseIndicator currentPhase={phase} />
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

        {/* Tiebreaker announcement banner */}
        {tiebreakerActive && phase === 'clues' && (
          <div className="card border-amber-700/50 bg-amber-950/30 animate-slide-up">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">⚔️</span>
              <p className="text-sm font-bold text-amber-400">{t('game.tiebreakerTitle', 'Tie! Extra Clue Round')}</p>
            </div>
            <p className="text-xs text-amber-300/80">
              {t('game.tiebreakerDesc', '{{names}} are tied — they must each give one more clue', { names: tiebreakerUsernames.join(' & ') })}
            </p>
          </div>
        )}

        {/* Clue phase: everyone submits clues simultaneously */}
        {phase === 'clues' && !isEliminated && (
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">{t('game.yourClue')}</p>
            {/* In tiebreaker mode: non-tied players just wait */}
            {tiebreakerActive && !tiebreakerPlayerIds.includes(user?.id ?? '') ? (
              <div className="flex items-center gap-2 py-2 text-amber-400 text-sm">
                <span>⏳</span>
                <span>{t('game.tiebreakerWaiting', 'Waiting for tied players to give their clues...')}</span>
              </div>
            ) : hasSubmittedClue ? (
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
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                {tiebreakerActive ? t('game.tiebreakerVoting', 'Vote between the tied players only') : t('game.voteOutImposter')}
              </p>
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
            {/* Tied players cannot vote during tiebreaker — show waiting message */}
            {tiebreakerActive && iAmTiedPlayer ? (
              <div className="flex items-center gap-2 py-3 text-amber-400 text-sm animate-slide-up">
                <span>⏳</span>
                <span>{t('game.tiebreakerCannotVote', 'You are tied — waiting for others to vote...')}</span>
              </div>
            ) : (
            <>
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
                .filter((p) => p.userId !== user?.id && (!tiebreakerActive || tiebreakerPlayerIds.includes(p.userId)))
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
            </>
            )}
          </div>
        )}

        {/* Reveal phase */}
        {phase === 'reveal' && (() => {
          const isImposterElim = eliminated?.role === 'imposter' || eliminated?.role === 'double_agent'
          return (
            <div className={[
              'card text-center py-8 relative overflow-hidden',
              eliminated
                ? isImposterElim ? 'border-emerald-800/40' : 'border-red-800/40'
                : isTie ? 'border-amber-800/40' : 'border-neutral-700',
            ].join(' ')}>
              {/* Background glow */}
              {eliminated && (
                <div className={[
                  'absolute inset-0 opacity-10',
                  isImposterElim
                    ? 'bg-gradient-to-br from-emerald-500 to-transparent'
                    : 'bg-gradient-to-br from-red-600 to-transparent',
                ].join(' ')} />
              )}
              <div className="relative">
                {eliminated ? (
                  <>
                    <p className="text-5xl mb-2" style={{ animation: 'role-drop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                      💀
                    </p>
                    <p
                      className="text-white font-bold text-lg mb-1"
                      style={{ animation: 'role-rise 0.4s ease 0.2s both' }}
                    >
                      {t('game.wasEliminatedPlayer', { name: eliminated.username })}
                    </p>
                    <p
                      className={[
                        'text-sm font-bold px-3 py-1 rounded-full inline-block',
                        isImposterElim
                          ? 'text-red-400 bg-red-950/60 border border-red-800/40'
                          : 'text-brand-400 bg-brand-950/60 border border-brand-800/40',
                      ].join(' ')}
                      style={{ animation: 'role-rise 0.4s ease 0.4s both' }}
                    >
                      {eliminated.role === 'imposter' ? t('game.roleImposter')
                        : eliminated.role === 'double_agent' ? t('game.roleDoubleAgent')
                        : eliminated.role === 'detective' ? t('game.roleDetective')
                        : t('game.roleVillager')}
                    </p>
                    {isImposterElim && (
                      <p className="text-emerald-400 text-xs font-semibold mt-2" style={{ animation: 'role-rise 0.4s ease 0.55s both' }}>
                        {t('game.goodCatch', 'Nice catch!')}
                      </p>
                    )}
                  </>
                ) : isTie ? (
                  <>
                    <p className="text-5xl mb-2" style={{ animation: 'role-drop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                      🤝
                    </p>
                    <p className="text-white font-bold text-lg mb-1" style={{ animation: 'role-rise 0.4s ease 0.2s both' }}>
                      {t('game.itsTie')}
                    </p>
                    <p className="text-neutral-400 text-sm" style={{ animation: 'role-rise 0.4s ease 0.35s both' }}>
                      {t('game.tieDesc')}
                    </p>
                  </>
                ) : (
                  <p className="text-neutral-400 text-sm animate-slide-up">{t('game.noEliminatedRound')}</p>
                )}
              </div>
              {wordReveal && (
                <div className="grid grid-cols-2 gap-3 mt-5 relative" style={{ animation: 'role-rise 0.4s ease 0.5s both' }}>
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
              <p className="text-xs text-neutral-600 mt-4 relative">{t('game.nextRoundSoon')}</p>
            </div>
          )
        })()}

        {/* Clues log — hidden during clue phase until you submit (prevents copying) */}
        <div className="card flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
            {t('game.cluesTitle', { round: currentRound?.roundNumber ?? 1 })}
          </p>
          {phase === 'clues' && !hasSubmittedClue && !isEliminated ? (
            <p className="text-neutral-600 text-sm italic">{t('game.submitClueFirst', 'Submit your clue to see what others wrote')}</p>
          ) : clues.length === 0 ? (
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
              const canReveal = myRole === 'detective' && !detectiveRevealUsed && p.userId !== user?.id && p.status === 'alive' && (phase === 'clues' || phase === 'voting')
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPlayerId(p.userId)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPlayerId(p.userId) }}
                  title={`View ${getDisplayName(p.userId, p.username)}'s clue history`}
                  className={[
                    'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer select-none',
                    p.status === 'alive'
                      ? 'bg-neutral-800 text-white hover:bg-neutral-700 hover:ring-1 hover:ring-neutral-600'
                      : p.status === 'forfeited'
                      ? 'bg-orange-950/30 text-neutral-600 line-through border border-orange-900/20 hover:bg-orange-950/50'
                      : 'bg-red-950/30 text-neutral-600 line-through border border-red-900/20 hover:bg-red-950/50',
                  ].join(' ')}
                >
                  <span className={[
                    'w-1.5 h-1.5 rounded-full',
                    p.status === 'alive' ? 'bg-emerald-400' : p.status === 'forfeited' ? 'bg-orange-700' : 'bg-neutral-700',
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
            {/* Eliminated banner with prominent Leave button */}
            <div className="px-3 py-3 bg-red-950/30 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-red-500">{t('game.ghostChat')}</span>
                  <span className="text-xs text-neutral-600">{t('game.ghostOnly')}</span>
                </div>
              </div>
              <button
                onClick={handleLeaveEliminated}
                className="w-full py-2 rounded-xl bg-red-900/60 hover:bg-red-800/70 text-red-300 hover:text-white text-sm font-bold transition-colors border border-red-800/40"
              >
                ← {t('game.leaveGame')}
              </button>
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
            <p className="text-xs text-neutral-600 text-center">{t('game.chatDisabled')}</p>
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
            {/* Quit & Forfeit */}
            {showForfeitConfirm ? (
              <div className="rounded-xl border border-orange-800/50 bg-orange-950/30 p-3 space-y-2">
                <p className="text-xs font-semibold text-orange-300">{t('game.forfeitConfirmText')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleForfeit}
                    className="flex-1 py-1.5 rounded-lg bg-orange-700 hover:bg-orange-600 text-white text-xs font-bold transition-colors"
                  >
                    {t('game.forfeitConfirmYes')}
                  </button>
                  <button
                    onClick={() => setShowForfeitConfirm(false)}
                    className="flex-1 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
                  >
                    {t('game.forfeitConfirmNo')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowForfeitConfirm(true)}
                className="w-full py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/50 hover:border-orange-800/50 text-neutral-500 hover:text-orange-400 text-xs font-semibold transition-all"
              >
                🏳 {t('game.quitForfeit')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
