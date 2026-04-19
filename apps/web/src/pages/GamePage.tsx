import React, { useEffect, useRef, useState, useCallback, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { useGameStore } from '../store/game'
import { useAuthStore } from '../store/auth'
import { getSocket, connectSocket } from '../lib/socket'
import { Avatar } from '@red-handed/ui'
import type { Clue } from '@red-handed/shared'
import { createLogger } from '../lib/logger'
import { SoundManager } from '../lib/sounds'
import { VoiceChannel } from '../lib/webrtc'
import { EliminationReveal } from '../components/EliminationReveal'
// Overlays removed — they blocked gameplay and caused desync between players

const log = createLogger('game-page')

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
    <div
      className={[
        'relative flex items-center justify-center w-14 h-14 shrink-0 rounded-full',
        urgent ? 'animate-urgent-pulse' : 'animate-breathe',
      ].join(' ')}
      role="timer"
      aria-live="assertive"
      aria-label={`${seconds} seconds remaining`}
    >
      {/* Soft outer halo that breathes with the timer */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        aria-hidden="true"
        style={{
          background: `radial-gradient(circle, ${urgent ? urgentGlow : colorGlow} 0%, transparent 70%)`,
          opacity: urgent ? 0.55 : 0.25,
          filter: 'blur(4px)',
        }}
      />
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 52 52" width="56" height="56" aria-hidden="true">
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
        urgent ? 'text-red-400 animate-heartbeat' : 'text-white',
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
  const PHASE_ACTIVE_STYLES: Record<Phase, string> = {
    clues: 'bg-purple-950/70 text-purple-400 border border-purple-700/50 shadow-sm shadow-purple-900/40',
    voting: 'bg-amber-950/70 text-amber-400 border border-amber-700/50 shadow-sm shadow-amber-900/40',
    reveal: 'bg-emerald-950/70 text-emerald-400 border border-emerald-700/50 shadow-sm shadow-emerald-900/40',
  }
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
              isActive ? PHASE_ACTIVE_STYLES[id] :
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
  players: import('@red-handed/shared').Player[]
  completedRounds: import('@red-handed/shared').Round[]
  currentRound: import('@red-handed/shared').Round | null
  result: { winner: string } | null
  getDisplayName: (id: string, name: string) => string
}) => {
  const { t } = useTranslation()
  const player = players.find((p) => p.userId === playerId)
  if (!player) return null

  const gameOver = !!result || player.status === 'eliminated' || player.status === 'forfeited'

  // Collect all rounds in order (completed + current if clues exist)
  const allRounds: import('@red-handed/shared').Round[] = [
    ...completedRounds,
    ...(currentRound && currentRound.clues.some((c) => c.playerId === playerId) ? [currentRound] : []),
  ]

  const ROLE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    villager:      { icon: '🏘️', color: 'text-emerald-400', label: t('game.roleVillager', 'Villager') },
    red_handed:    { icon: '🔪', color: 'text-red-400',     label: t('game.roleRedHanded', 'Imposter') },
    detective:     { icon: '🔍', color: 'text-blue-400',    label: t('game.roleDetective', 'Detective') },
    double_agent:  { icon: '🎭', color: 'text-orange-400',  label: t('game.roleDoubleAgent', 'Double Agent') },
    guardian:      { icon: '🛡️', color: 'text-yellow-400',  label: t('game.roleGuardian', 'Guardian') },
    mayor:         { icon: '⚖️', color: 'text-indigo-400',  label: t('game.roleMayor', 'Mayor') },
    infiltrator:   { icon: '🥷', color: 'text-fuchsia-400', label: t('game.roleInfiltrator', 'Infiltrator') },
    jester:        { icon: '🃏', color: 'text-pink-400',    label: t('game.roleJester', 'Jester') },
    judge:         { icon: '👨‍⚖️', color: 'text-emerald-300', label: t('game.roleJudge', 'Judge') },
    revenant:      { icon: '👻', color: 'text-teal-300',    label: t('game.roleRevenant', 'Revenant') },
    kamikaze:      { icon: '💥', color: 'text-red-300',     label: t('game.roleKamikaze', 'Kamikaze') },
    corruptor:     { icon: '🕷️', color: 'text-orange-300',  label: t('game.roleCorruptor', 'Corruptor') },
    inverter:      { icon: '🔄', color: 'text-rose-300',    label: t('game.roleInverter', 'Inverter') },
    twin_villager: { icon: '👯', color: 'text-purple-300',  label: t('game.roleTwinVillager', 'Evil Twin (Villager)') },
    twin_red_handed: { icon: '👯', color: 'text-purple-400',  label: t('game.roleTwinRedHanded', 'Evil Twin (Imposter)') },
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
            <Avatar src={player.avatarUrl} username={player.username} size="sm" />
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
                  {player.status === 'forfeited' ? `🏳 ${t('game.statusForfeited', 'Forfeited')}` : `💀 ${t('game.statusEliminated', 'Eliminated')}`}
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
  const { room, currentRound, completedRounds, myRole, myWord, myVillagerWord, detectiveRevealUsed, guardianProtectUsed, guardianProtectedPlayer, mayorDoubleVoteUsed, mayorDoubleActive, inverterUsed, inverterActive, corruptorTargetUserId, twinPartner, revenantVotesRemaining, revealedPlayer, messages, addMessage, setResult, setRound, addCompletedRound, setDetectiveRevealUsed, setGuardianProtectUsed, setGuardianProtectedPlayer, setMayorDoubleActive, resetMayorDoubleActive, setInverterActive, resetInverterActive, setCorruptorTarget, setTwinPartner, setRevenantVotesRemaining, setRevealedPlayer, setRoom, setRoleAndWord, result, reset } = useGameStore()
  const user = useAuthStore((s) => s.user)
  const [clueText, setClueText] = useState('')
  const [clues, setClues] = useState<Clue[]>([])
  const [chatInput, setChatInput] = useState('')
  const [deadChatInput, setDeadChatInput] = useState('')
  const [deadChatMessages, setDeadChatMessages] = useState<{ id: string; userId: string; username: string; text: string }[]>([])
  const [isEliminated, setIsEliminated] = useState(false)
  const [floatingEmotes, setFloatingEmotes] = useState<{ id: string; emoji: string; username: string; x: number }[]>([])
  const [emoteCooldownUntil, setEmoteCooldownUntil] = useState(0)
  const [emoteNow, setEmoteNow] = useState(0)
  const lastEmoteTime = useRef(0)
  const [phase, setPhase] = useState<Phase>('clues')
  const [votedFor, setVotedFor] = useState<string | null>(null)
  const [eliminated, setEliminated] = useState<{ username: string; role: string } | null>(null)
  // Full-screen cinematic that plays once per elimination event
  const [elimCinematic, setElimCinematic] = useState<
    { username: string; role: string; isRedHanded: boolean; isSelf: boolean } | null
  >(null)
  const [hasSubmittedClue, setHasSubmittedClue] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [currentSpeakerId, setCurrentSpeakerId] = useState<string | null>(null)
  const [speakingOrder, setSpeakingOrder] = useState<string[]>([])
  const [voteCount, setVoteCount] = useState(0)
  const [totalVoters, setTotalVoters] = useState(0)
  const [allVotedMsg, setAllVotedMsg] = useState(false)
  const [wordReveal, setWordReveal] = useState<{ villagerWord: string; redHandedWord: string } | null>(null)
  const [isTie, setIsTie] = useState(false)
  const [totalTime, setTotalTime] = useState(30)
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false)
  const [showRoleCard, setShowRoleCard] = useState(!!myRole)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [tiebreakerActive, setTiebreakerActive] = useState(false)
  const [tiebreakerPlayerIds, setTiebreakerPlayerIds] = useState<string[]>([])
  const [tiebreakerUsernames, setTiebreakerUsernames] = useState<string[]>([])
  const [tiebreakerPhase, setTiebreakerPhase] = useState<'clue' | 'vote' | 'judge' | null>(null)
  // Kamikaze post-death target picker. When kamikazePrompt is non-null, a full-screen
  // modal lets the kamikaze pick a target from candidateUserIds.
  const [kamikazePrompt, setKamikazePrompt] = useState<{ candidateUserIds: string[]; timeSeconds: number } | null>(null)
  // Judge tiebreaker decision prompt. Only the judge sees this.
  const [judgePrompt, setJudgePrompt] = useState<{ candidateUserIds: string[]; candidateUsernames: string[]; timeSeconds: number } | null>(null)
  // Corruptor target picker. Shown once at game start to the corruptor.
  const [showCorruptorPicker, setShowCorruptorPicker] = useState(false)
  // ── Vocal mode state ──────────────────────────────────────────────────────
  // `vocalMode` mirrors the room setting; when true the clue phase becomes a
  // turn-based "speak out loud" round (no text input). The per-turn speaker
  // and countdown are driven by the server's `round:vocal-turn` events.
  const vocalMode = !!(room?.settings as any)?.vocalMode
  const [vocalSpeakerId, setVocalSpeakerId] = useState<string | null>(null)
  const [vocalPerTurnSeconds, setVocalPerTurnSeconds] = useState(10)
  const [vocalTurnTimeLeft, setVocalTurnTimeLeft] = useState(0)
  const [vocalTurnIndex, setVocalTurnIndex] = useState(0)
  const [vocalTotalSpeakers, setVocalTotalSpeakers] = useState(0)
  const vocalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // ── Voice (WebRTC) state ─────────────────────────────────────────────────
  // `voiceStatus` follows the lifecycle of mic capture + signaling. The
  // `voiceChannelRef` holds the live VoiceChannel instance so the cleanup
  // effect can tear it down deterministically. `voiceMutedManually` lets the
  // user override the auto-mute (mic only hot during their vocal turn).
  type VoiceStatus = 'idle' | 'requesting' | 'connected' | 'denied' | 'unsupported' | 'error'
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
  const [voiceMutedManually, setVoiceMutedManually] = useState(false)
  const [voicePeerCount, setVoicePeerCount] = useState(0)
  const voiceChannelRef = useRef<VoiceChannel | null>(null)
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


  const isRedHanded = myRole === 'red_handed' || myRole === 'double_agent'
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
      log.info('game started', { role: yourRole })
      SoundManager.play('game_start')
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
      // Corruptor: immediately show the target-picker modal on game start.
      // The player has to pick their one target before the first clue phase matters.
      if (yourRole === 'corruptor') {
        setShowCorruptorPicker(true)
      }
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

    // ── Vocal mode: per-player turn announcement ──────────────────────────
    socket.on('round:vocal-turn' as any, ({ speakerId, speakerIndex, totalSpeakers, perTurnSeconds }: any) => {
      setVocalSpeakerId(speakerId)
      setVocalTurnIndex(speakerIndex)
      setVocalTotalSpeakers(totalSpeakers)
      setVocalPerTurnSeconds(perTurnSeconds)
      setVocalTurnTimeLeft(perTurnSeconds)
      if (vocalTimerRef.current) clearInterval(vocalTimerRef.current)
      vocalTimerRef.current = setInterval(() => {
        setVocalTurnTimeLeft((t) => {
          if (t <= 1) {
            if (vocalTimerRef.current) clearInterval(vocalTimerRef.current)
            return 0
          }
          return t - 1
        })
      }, 1000)
    })

    socket.on('round:speaking-turn', ({ playerId, timeSeconds, speakingOrder: order }: any) => {
      // Clean up previous round state when entering a new clue phase
      if (phaseRef.current !== 'clues') {
        SoundManager.play('round_start')
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
      log.info('phase: voting', { timeSeconds, playerCount: vPlayers?.length })
      phaseRef.current = 'voting'
      setPhase('voting')
      setCurrentSpeakerId(null)
      // Vocal turns end with the clue phase — stop the per-turn countdown.
      setVocalSpeakerId(null)
      if (vocalTimerRef.current) { clearInterval(vocalTimerRef.current); vocalTimerRef.current = null }
      setVoteCount(0)
      setTotalVoters(vPlayers?.length ?? 0)
      setAllVotedMsg(false)
      startTimerRef.current(timeSeconds ?? 30)
    })
    socket.on('round:ended', ({ round, nextRound }: any) => {
      log.info('phase: reveal', { roundNumber: round?.roundNumber, eliminatedId: round?.eliminatedPlayerId })
      SoundManager.play('reveal')
      phaseRef.current = 'reveal'
      setPhase('reveal')
      setCurrentSpeakerId(null)
      setAllVotedMsg(false)
      // Mayor double-vote and inverter are per-round — clear active flags at round end
      resetMayorDoubleActive()
      resetInverterActive()
      // Revenant: decrement remaining post-mortem votes if we cast a vote this round.
      if (myRole === 'revenant' && isEliminated && revenantVotesRemaining > 0) {
        const didVote = (round?.votes ?? []).some((v: any) => v.voterId === user?.id)
        if (didVote) setRevenantVotesRemaining(revenantVotesRemaining - 1)
      }
      // Clear tiebreaker state when round ends
      setTiebreakerActive(false)
      setTiebreakerPlayerIds([])
      setTiebreakerUsernames([])
      setTiebreakerPhase(null)
      if (round) addCompletedRound(round)
      if (nextRound) setRound(nextRound)
      if (round?.wordReveal) setWordReveal(round.wordReveal)
      if (round?.eliminatedPlayerId) {
        SoundManager.play('elimination')
        const elim = players.find((p: any) => p.userId === round.eliminatedPlayerId)
        const elimRole = round.eliminatedRole ?? (elim as any)?.role ?? 'villager'
        const elimName = getDisplayNameRef.current(round.eliminatedPlayerId, elim?.username ?? round.eliminatedPlayerId)
        setEliminated({ username: elimName, role: elimRole })
        const isMe = round.eliminatedPlayerId === user?.id
        // Trigger the full-screen cinematic
        const isEvilRole = elimRole === 'red_handed' || elimRole === 'double_agent' || elimRole === 'kamikaze'
          || elimRole === 'corruptor' || elimRole === 'inverter' || elimRole === 'infiltrator'
          || elimRole === 'twin_red_handed'
        setElimCinematic({
          username: elimName,
          role: elimRole,
          isRedHanded: isEvilRole,
          isSelf: isMe,
        })
        // If it's me, join dead chat
        if (isMe) {
          setIsEliminated(true)
          // Revenant: grant 2 post-mortem vote rounds upon death.
          if (myRole === 'revenant') setRevenantVotesRemaining(2)
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
    socket.on('guardian:protect-ack' as any, ({ targetUserId, targetUsername }: any) => {
      setGuardianProtectUsed({ userId: targetUserId, username: targetUsername })
    })
    socket.on('guardian:protection-triggered' as any, ({ protectedUserId, protectedUsername }: any) => {
      setGuardianProtectedPlayer({ userId: protectedUserId, username: protectedUsername })
      setTimeout(() => setGuardianProtectedPlayer(null), 5000)
    })
    socket.on('mayor:double-ack' as any, () => {
      log.info('mayor double vote activated')
      setMayorDoubleActive()
    })
    socket.on('inverter:activate-ack' as any, () => {
      log.info('inverter activated')
      setInverterActive()
    })
    socket.on('corruptor:target-ack' as any, ({ targetUserId }: any) => {
      log.info('corruptor target locked', { targetUserId })
      setCorruptorTarget(targetUserId)
      setShowCorruptorPicker(false)
    })
    socket.on('kamikaze:select-prompt' as any, ({ candidateUserIds, timeSeconds }: any) => {
      log.info('kamikaze prompt received', { candidateUserIds })
      setKamikazePrompt({ candidateUserIds: candidateUserIds ?? [], timeSeconds: timeSeconds ?? 15 })
    })
    socket.on('kamikaze:target-chosen' as any, ({ kamikazeUserId, targetUserId, targetUsername }: any) => {
      log.info('kamikaze target chosen', { kamikazeUserId, targetUserId, targetUsername })
      setKamikazePrompt(null)
    })
    socket.on('judge:decide-prompt' as any, ({ candidateUserIds, candidateUsernames, timeSeconds }: any) => {
      log.info('judge prompt received', { candidateUserIds })
      setJudgePrompt({
        candidateUserIds: candidateUserIds ?? [],
        candidateUsernames: candidateUsernames ?? [],
        timeSeconds: timeSeconds ?? 20,
      })
      setTiebreakerPhase('judge')
    })
    socket.on('judge:decided' as any, ({ targetUserId, targetUsername }: any) => {
      log.info('judge decided', { targetUserId, targetUsername })
      setJudgePrompt(null)
    })
    socket.on('twin:partner' as any, ({ twinUserId, twinUsername, twinRole }: any) => {
      log.info('twin partner revealed', { twinUserId, twinUsername, twinRole })
      setTwinPartner({ twinUserId, twinUsername, twinRole })
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
        // Revenant starts with 2 post-mortem vote rounds upon death.
        if (role === 'revenant') setRevenantVotesRemaining(2)
        socket.emit('deadchat:join' as any)
      }
    })
    socket.on('game:finished', (data) => {
      log.info('game finished', { winner: (data as any)?.winner })
      SoundManager.play('game_end')
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
      log.error('socket error', { code: err?.code, message: err?.message })
    })
    socket.on('chat:message', (msg: any) => {
      if (msg?.userId !== user?.id) SoundManager.play('chat_message')
      addMessage(msg)
    })
    socket.on('emote:receive' as any, ({ username, emoji }: { username: string; emoji: string }) => {
      const id = `${Date.now()}_${Math.random()}`
      const x = 10 + Math.random() * 80
      setFloatingEmotes((prev) => prev.length >= 20 ? prev : [...prev, { id, emoji, username, x }])
      const tid = setTimeout(() => setFloatingEmotes((prev) => prev.filter((e) => e.id !== id)), 2800)
      timeoutRefs.current.push(tid)
    })
    socket.on('emote:cooldown' as any, ({ until }: { until: number }) => {
      setEmoteCooldownUntil((prev) => (until > prev ? until : prev))
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
      socket.off('round:vocal-turn' as any)
      if (vocalTimerRef.current) { clearInterval(vocalTimerRef.current); vocalTimerRef.current = null }
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
      socket.off('emote:cooldown' as any)
      socket.off('detective:result')
      socket.off('guardian:protect-ack' as any)
      socket.off('guardian:protection-triggered' as any)
      socket.off('mayor:double-ack' as any)
      socket.off('inverter:activate-ack' as any)
      socket.off('corruptor:target-ack' as any)
      socket.off('kamikaze:select-prompt' as any)
      socket.off('kamikaze:target-chosen' as any)
      socket.off('judge:decide-prompt' as any)
      socket.off('judge:decided' as any)
      socket.off('twin:partner' as any)
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

  // ── Voice channel: request mic + open peer mesh ────────────────────────
  // We do NOT auto-start the channel — browsers gate getUserMedia on a user
  // gesture and an unsolicited prompt is hostile UX. The "Enable mic" button
  // in the vocal-mode card calls this. Once started, the channel survives
  // round transitions and only tears down when the game ends or the
  // component unmounts.
  const startVoice = useCallback(async () => {
    if (voiceChannelRef.current || !user?.id) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus('unsupported')
      return
    }
    setVoiceStatus('requesting')
    const vc = new VoiceChannel({ socket: getSocket(), selfUserId: user.id })
    vc.onPeersChanged = (ids) => setVoicePeerCount(ids.length)
    vc.onMicError = (err) => {
      const denied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
      setVoiceStatus(denied ? 'denied' : 'error')
      voiceChannelRef.current = null
    }
    try {
      await vc.start()
      voiceChannelRef.current = vc
      setVoiceStatus('connected')
    } catch {
      // onMicError already updated status; nothing else to do.
    }
  }, [user?.id])

  const stopVoice = useCallback(() => {
    if (voiceChannelRef.current) {
      voiceChannelRef.current.destroy()
      voiceChannelRef.current = null
    }
    setVoiceStatus('idle')
    setVoicePeerCount(0)
  }, [])

  // Tear down the voice channel when leaving the game page or when vocalMode
  // gets switched off (which shouldn't happen mid-game, but defensive cleanup
  // is cheap). This also handles HMR cleanly.
  useEffect(() => {
    return () => stopVoice()
    // We only want this to run on unmount — `stopVoice` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Stop voice when the game finishes so the mic is released between games.
  useEffect(() => {
    if (room?.status === 'finished' || room?.status === 'waiting') stopVoice()
  }, [room?.status, stopVoice])

  // Auto-mute the local mic when it's not our turn to speak. The user can
  // override via the mute button (`voiceMutedManually`), in which case their
  // explicit choice wins. We only enforce the auto behaviour during the
  // vocal clue phase — at all other times the mic stays open so peers can
  // still hear ambient reactions during voting / reveal.
  useEffect(() => {
    const vc = voiceChannelRef.current
    if (!vc || voiceStatus !== 'connected') return
    if (voiceMutedManually) {
      vc.setMicEnabled(false)
      return
    }
    if (phase === 'clues' && vocalMode && vocalSpeakerId) {
      const isMyTurn = vocalSpeakerId === user?.id
      vc.setMicEnabled(isMyTurn)
    } else {
      vc.setMicEnabled(true)
    }
  }, [voiceStatus, voiceMutedManually, phase, vocalMode, vocalSpeakerId, user?.id])

  const submitClue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!clueText.trim() || hasSubmittedClue || phase !== 'clues' || isEliminated) return
    log.info('clue submitted')
    getSocket().emit('clue:submit', clueText.trim())
    setClueText('')
    setHasSubmittedClue(true)
  }

  const iAmTiedPlayer = tiebreakerActive && tiebreakerPlayerIds.includes(user?.id ?? '')

  const vote = (playerId: string) => {
    if (votedFor || phase !== 'voting') return
    // Tied players cannot vote during tiebreaker
    if (iAmTiedPlayer) return
    log.info('vote cast', { targetId: playerId })
    SoundManager.play('vote')
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
    const now = Date.now()
    if (now < emoteCooldownUntil) return
    if (now - lastEmoteTime.current < 1000) return
    lastEmoteTime.current = now
    getSocket().emit('emote:send' as any, { emoji })
  }

  // Tick while a server lockout is active so disabled buttons re-enable.
  useEffect(() => {
    if (emoteCooldownUntil <= Date.now()) return
    const id = setInterval(() => setEmoteNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [emoteCooldownUntil])

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

  // Timer tick sounds during countdown
  useEffect(() => {
    if (timeLeft <= 0) return
    if (timeLeft <= 3) {
      SoundManager.play('timer_warning')
    } else if (timeLeft <= 5) {
      SoundManager.play('timer_tick')
    }
  }, [timeLeft])

  // Auto-dismiss role card after 5 seconds
  useEffect(() => {
    if (!showRoleCard) return
    const timer = setTimeout(() => setShowRoleCard(false), 5000)
    return () => clearTimeout(timer)
  }, [showRoleCard])

  const ROLE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
    villager:      { icon: '🏘️', label: t('game.roleVillager', 'Villager'),               color: 'text-emerald-400', bg: 'from-emerald-900/40' },
    red_handed:    { icon: '🔪', label: t('game.roleRedHanded', 'Imposter'),               color: 'text-red-400',     bg: 'from-red-900/40' },
    detective:     { icon: '🔍', label: t('game.roleDetective', 'Detective'),             color: 'text-blue-400',    bg: 'from-blue-900/40' },
    double_agent:  { icon: '🎭', label: t('game.roleDoubleAgent', 'Double Agent'),        color: 'text-orange-400',  bg: 'from-orange-900/40' },
    guardian:      { icon: '🛡️', label: t('game.roleGuardian', 'Guardian'),               color: 'text-yellow-400',  bg: 'from-yellow-900/40' },
    mayor:         { icon: '⚖️', label: t('game.roleMayor', 'Mayor'),                     color: 'text-indigo-400',  bg: 'from-indigo-900/40' },
    infiltrator:   { icon: '🥷', label: t('game.roleInfiltrator', 'Infiltrator'),         color: 'text-fuchsia-400', bg: 'from-fuchsia-900/40' },
    jester:        { icon: '🃏', label: t('game.roleJester', 'Jester'),                   color: 'text-pink-400',    bg: 'from-pink-900/40' },
    judge:         { icon: '👨‍⚖️', label: t('game.roleJudge', 'Judge'),                    color: 'text-emerald-300', bg: 'from-emerald-900/40' },
    revenant:      { icon: '👻', label: t('game.roleRevenant', 'Revenant'),               color: 'text-teal-300',    bg: 'from-teal-900/40' },
    kamikaze:      { icon: '💥', label: t('game.roleKamikaze', 'Kamikaze'),               color: 'text-red-300',     bg: 'from-red-900/40' },
    corruptor:     { icon: '🕷️', label: t('game.roleCorruptor', 'Corruptor'),              color: 'text-orange-300',  bg: 'from-orange-900/40' },
    inverter:      { icon: '🔄', label: t('game.roleInverter', 'Inverter'),               color: 'text-rose-300',    bg: 'from-rose-900/40' },
    twin_villager: { icon: '👯', label: t('game.roleTwinVillager', 'Evil Twin (Villager)'), color: 'text-purple-300',  bg: 'from-purple-900/40' },
    twin_red_handed: { icon: '👯', label: t('game.roleTwinRedHanded', 'Evil Twin (Imposter)'), color: 'text-purple-400',  bg: 'from-purple-900/40' },
  }
  const roleInfo = ROLE_CONFIG[myRole ?? 'villager'] ?? ROLE_CONFIG.villager

  return (
    <div id="main-content" role="main" className="min-h-screen flex flex-col md:flex-row">
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

      {/* ── Full-screen elimination cinematic (plays once per death) ── */}
      {elimCinematic && (
        <EliminationReveal
          username={elimCinematic.username}
          role={elimCinematic.role}
          isRedHanded={elimCinematic.isRedHanded}
          isSelf={elimCinematic.isSelf}
          onDone={() => setElimCinematic(null)}
        />
      )}

      {/* ── Role reveal overlay ── */}
      {showRoleCard && myRole && (
        <>
          <style>{`
            @keyframes role-drop { 0% { transform: translateY(-60px) scale(0.7); opacity: 0; } 60% { transform: translateY(8px) scale(1.05); } 100% { transform: translateY(0) scale(1); opacity: 1; } }
            @keyframes role-rise { 0% { transform: translateY(20px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
            @keyframes role-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(168,85,247,0.4); } 50% { box-shadow: 0 0 0 20px rgba(168,85,247,0); } }
            @keyframes role-rays { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes role-card-flip { 0% { transform: perspective(900px) rotateY(-180deg) scale(0.5); opacity: 0; } 60% { transform: perspective(900px) rotateY(10deg) scale(1.08); opacity: 1; } 100% { transform: perspective(900px) rotateY(0deg) scale(1); opacity: 1; } }
            @keyframes role-sparkle { 0% { transform: translate(-50%,-50%) scale(0) rotate(0); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1.4) rotate(220deg); opacity: 0; } }
          `}</style>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md overflow-hidden"
            onClick={() => setShowRoleCard(false)}
          >
            {/* Rotating god-rays */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                width: '180vmin',
                height: '180vmin',
                background:
                  'conic-gradient(from 0deg, transparent 0deg, rgba(139,92,246,0.12) 14deg, transparent 28deg, ' +
                  'transparent 60deg, rgba(250,204,21,0.10) 74deg, transparent 88deg, ' +
                  'transparent 120deg, rgba(139,92,246,0.14) 134deg, transparent 148deg, ' +
                  'transparent 180deg, rgba(250,204,21,0.10) 194deg, transparent 208deg, ' +
                  'transparent 240deg, rgba(139,92,246,0.14) 254deg, transparent 268deg, ' +
                  'transparent 300deg, rgba(250,204,21,0.10) 314deg, transparent 328deg)',
                animation: 'role-rays 11s linear infinite',
                filter: 'blur(2px)',
              }}
            />

            {/* Ambient sparkles */}
            {Array.from({ length: 8 }).map((_, i) => {
              const left = 12 + Math.random() * 76
              const top  = 15 + Math.random() * 70
              const delay = i * 120
              return (
                <div
                  key={i}
                  className="absolute pointer-events-none text-brand-300"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    fontSize: 14 + Math.random() * 16,
                    animation: `role-sparkle 1.6s ease-out ${delay}ms infinite`,
                  }}
                >
                  ✦
                </div>
              )
            })}

            <div className="relative text-center pointer-events-none select-none px-6">
              {/* Card-style container with a 3D flip entrance */}
              <div
                className="inline-block relative rounded-3xl border-2 border-brand-500/50 bg-gradient-to-br from-brand-950/80 via-neutral-950/90 to-brand-950/70 p-8 shadow-2xl"
                style={{
                  animation: 'role-card-flip 0.85s cubic-bezier(0.34,1.56,0.64,1) both',
                  boxShadow: '0 30px 80px rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,255,255,0.08), 0 0 80px rgba(139,92,246,0.35)',
                }}
              >
                <div
                  style={{
                    animation: 'role-drop 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.3s both, floatSoft 3.5s ease-in-out 1s infinite',
                    fontSize: 80,
                    filter: 'drop-shadow(0 6px 20px rgba(139,92,246,0.55))',
                  }}
                >
                  {roleInfo.icon}
                </div>
                <p
                  className={['text-xs font-bold uppercase tracking-[0.3em] mt-4', roleInfo.color].join(' ')}
                  style={{ animation: 'role-rise 0.4s ease 0.5s both' }}
                >
                  {t('game.yourRole', 'YOUR ROLE')}
                </p>
                <h1
                  className={['text-4xl sm:text-5xl font-black tracking-tight mt-1', roleInfo.color].join(' ')}
                  style={{
                    animation: 'role-rise 0.4s ease 0.6s both',
                    textShadow: '0 0 28px rgba(139,92,246,0.55)',
                  }}
                >
                  {roleInfo.label}
                </h1>
                <div className="mt-5" style={{ animation: 'role-rise 0.4s ease 0.75s both' }}>
                  {myVillagerWord ? (
                    <div className="flex gap-3 justify-center">
                      <div className="rounded-xl bg-emerald-950/60 border border-emerald-800/40 px-4 py-2 text-center hover:scale-105 transition-transform">
                        <p className="text-[10px] text-emerald-500 font-bold uppercase">{t('game.villagerWord')}</p>
                        <p className="text-xl font-extrabold text-emerald-200 mt-0.5">{myVillagerWord}</p>
                      </div>
                      <div className="rounded-xl bg-orange-950/60 border border-orange-800/40 px-4 py-2 text-center hover:scale-105 transition-transform">
                        <p className="text-[10px] text-orange-500 font-bold uppercase">{t('game.redHandedWord')}</p>
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
              </div>
              <p className="text-neutral-500 text-xs mt-6" style={{ animation: 'role-rise 0.4s ease 0.95s both' }}>
                {t('game.tapToContinue', 'Tap to continue')}
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── Corruptor target picker modal — shown once at game start ── */}
      {showCorruptorPicker && myRole === 'corruptor' && !corruptorTargetUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-orange-800/60 p-6 shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">🕷️</div>
              <h2 className="text-xl font-black text-orange-400">{t('game.corruptorPickTitle', 'Pick Your Target')}</h2>
              <p className="text-xs text-neutral-500 mt-2">{t('game.corruptorPickDesc', 'Their votes will be silently dropped until you die.')}</p>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {players
                .filter((p) => p.userId !== user?.id && p.status === 'alive')
                .map((p) => (
                  <button
                    key={p.userId}
                    onClick={() => {
                      log.info('corruptor picking target', { targetUserId: p.userId })
                      getSocket().emit('corruptor:pick-target' as any, { targetUserId: p.userId })
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-neutral-800 hover:bg-orange-950/60 border border-neutral-700 hover:border-orange-700 text-left text-sm font-semibold text-white transition-all"
                  >
                    {p.username}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Kamikaze post-death target picker modal ── */}
      {kamikazePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-red-800/60 p-6 shadow-2xl animate-pulse">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">💥</div>
              <h2 className="text-xl font-black text-red-400">{t('game.kamikazePickTitle', 'Take Someone With You')}</h2>
              <p className="text-xs text-neutral-500 mt-2">
                {t('game.kamikazePickDesc', 'Pick a player to eliminate alongside you. Choose quickly!')}
              </p>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {players
                .filter((p) => kamikazePrompt.candidateUserIds.includes(p.userId))
                .map((p) => (
                  <button
                    key={p.userId}
                    onClick={() => {
                      log.info('kamikaze picking target', { targetUserId: p.userId })
                      getSocket().emit('kamikaze:pick-target' as any, { targetUserId: p.userId })
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-neutral-800 hover:bg-red-950/60 border border-neutral-700 hover:border-red-700 text-left text-sm font-semibold text-white transition-all"
                  >
                    {p.username}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Judge tiebreaker decision modal ── */}
      {judgePrompt && myRole === 'judge' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-emerald-800/60 p-6 shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">👨‍⚖️</div>
              <h2 className="text-xl font-black text-emerald-300">{t('game.judgePickTitle', 'The Judge Decides')}</h2>
              <p className="text-xs text-neutral-500 mt-2">
                {t('game.judgePickDesc', 'The vote is tied. You have final say.')}
              </p>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {judgePrompt.candidateUserIds.map((uid, idx) => {
                const uname = judgePrompt.candidateUsernames[idx] ?? uid
                return (
                  <button
                    key={uid}
                    onClick={() => {
                      log.info('judge deciding elimination', { targetUserId: uid })
                      getSocket().emit('judge:pick-elimination' as any, { targetUserId: uid })
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-neutral-800 hover:bg-emerald-950/60 border border-neutral-700 hover:border-emerald-700 text-left text-sm font-semibold text-white transition-all"
                  >
                    {uname}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Main game area ── */}
      <div className="relative flex-1 flex flex-col p-4 md:p-6 lg:p-8 gap-4 overflow-y-auto">

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
                revealedPlayer.role === 'red_handed' || revealedPlayer.role === 'double_agent' || revealedPlayer.role === 'kamikaze' || revealedPlayer.role === 'corruptor' || revealedPlayer.role === 'inverter' || revealedPlayer.role === 'twin_red_handed' ? 'text-red-400' :
                revealedPlayer.role === 'jester' ? 'text-pink-400' :
                revealedPlayer.role === 'twin_villager' ? 'text-purple-300' :
                'text-emerald-400',
              ].join(' ')}>
                {revealedPlayer.role === 'red_handed' ? t('game.roleRedHanded') :
                 revealedPlayer.role === 'double_agent' ? t('game.roleDoubleAgent') :
                 revealedPlayer.role === 'detective' ? t('game.roleDetective') :
                 revealedPlayer.role === 'guardian' ? t('game.roleGuardian') :
                 revealedPlayer.role === 'mayor' ? t('game.roleMayor') :
                 revealedPlayer.role === 'jester' ? t('game.roleJester') :
                 revealedPlayer.role === 'judge' ? t('game.roleJudge') :
                 revealedPlayer.role === 'revenant' ? t('game.roleRevenant') :
                 revealedPlayer.role === 'kamikaze' ? t('game.roleKamikaze') :
                 revealedPlayer.role === 'corruptor' ? t('game.roleCorruptor') :
                 revealedPlayer.role === 'inverter' ? t('game.roleInverter') :
                 revealedPlayer.role === 'twin_villager' ? t('game.roleTwinVillager') :
                 revealedPlayer.role === 'twin_red_handed' ? t('game.roleTwinRedHanded') :
                 t('game.roleVillager')}
              </span>
            </div>
          </div>
        )}

        {/* Guardian protection triggered — small non-blocking toast */}
        {guardianProtectedPlayer && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-slide-up">
            <div className="px-4 py-3 rounded-xl border text-center"
              style={{ backgroundColor: 'rgba(8,8,20,0.95)', borderColor: '#eab308', boxShadow: '0 0 20px rgba(234,179,8,0.3)' }}>
              <span className="text-yellow-400 font-bold text-sm">🛡️ {guardianProtectedPlayer.username} </span>
              <span className="text-sm font-bold text-yellow-300">{t('game.guardianProtectionTriggered')}</span>
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
                  <span className="text-lg font-extrabold tracking-tight text-white">Red Handed !</span>
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
        <div className="card relative overflow-hidden border-brand-800/40 bg-neutral-900/60 shadow-lg shadow-brand-950/30 ring-1 ring-brand-700/20">
          <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
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
                <div className="rounded-xl bg-emerald-950/40 border border-emerald-800/40 p-3 shadow-sm shadow-emerald-950/40">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">{t('game.villagerWord')}</p>
                  <p className="text-2xl font-extrabold text-emerald-200">{myVillagerWord}</p>
                </div>
                <div className="rounded-xl bg-orange-950/40 border border-orange-800/40 p-3 shadow-sm shadow-orange-950/40">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-1">{t('game.redHandedWord')}</p>
                  <p className="text-2xl font-extrabold text-orange-200">{myWord}</p>
                </div>
              </div>
              <p className="text-xs text-neutral-600 mt-2">{t('game.giveClueHint')}</p>
            </div>
          ) : (
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 bg-brand-950/50 border border-brand-800/40 shadow-sm shadow-brand-950/40">
                🔤
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-0.5">
                  {t('game.yourWordLabel')}
                </p>
                <p className="text-3xl font-extrabold tracking-tight text-white" style={{ textShadow: '0 0 20px rgba(139,92,246,0.3)' }}>
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

        {/* Clue phase: everyone submits clues simultaneously (or speaks in vocal mode) */}
        {phase === 'clues' && !isEliminated && vocalMode && (() => {
          const speaker = vocalSpeakerId ? players.find((p) => p.userId === vocalSpeakerId) : null
          const isMyTurn = !!(vocalSpeakerId && user?.id === vocalSpeakerId)
          const pct = vocalPerTurnSeconds > 0 ? (vocalTurnTimeLeft / vocalPerTurnSeconds) * 100 : 0
          return (
            <div className={[
              'card relative overflow-hidden transition-all',
              isMyTurn ? 'border-brand-600/60 shadow-lg shadow-brand-950/40' : 'border-neutral-700',
            ].join(' ')}>
              {/* Background glow when it's your turn */}
              {isMyTurn && (
                <div className="absolute inset-0 opacity-20 pointer-events-none bg-gradient-to-br from-brand-500 via-brand-900/20 to-transparent" />
              )}
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                    {t('game.vocalTurnTitle', 'Vocal turn {{index}} / {{total}}', {
                      index: Math.min(vocalTurnIndex + 1, vocalTotalSpeakers || 1),
                      total: vocalTotalSpeakers || 1,
                    })}
                  </p>
                  <span className={[
                    'text-xs font-bold tabular-nums',
                    vocalTurnTimeLeft <= 3 ? 'text-red-400' : isMyTurn ? 'text-brand-400' : 'text-neutral-400',
                  ].join(' ')}>
                    {vocalTurnTimeLeft}s
                  </span>
                </div>
                {/* Countdown bar */}
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-4">
                  <div
                    className={[
                      'h-full rounded-full transition-all duration-500',
                      vocalTurnTimeLeft <= 3 ? 'bg-red-500' : isMyTurn ? 'bg-brand-500' : 'bg-emerald-500',
                    ].join(' ')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {speaker ? (
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar username={speaker.username} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold truncate">
                        {isMyTurn
                          ? t('game.vocalSpeakNow', "It's your turn — speak now!")
                          : t('game.vocalSpeakingNow', '{{name}} is speaking...', { name: getDisplayName(speaker.userId, speaker.username) })}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {isMyTurn
                          ? t('game.vocalSpeakHint', 'Give your clue out loud — tap Done when finished')
                          : t('game.vocalListenHint', 'Listen carefully — your turn is coming')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-neutral-500 text-sm italic py-2">
                    {t('game.vocalWaiting', 'Waiting for the next speaker...')}
                  </p>
                )}
                {/* ── Microphone controls (real audio streaming) ───────── */}
                <div className="mt-3 mb-3 pt-3 border-t border-neutral-800/60">
                  {voiceStatus === 'idle' && (
                    <button
                      type="button"
                      onClick={startVoice}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <span>🎙️</span>
                      <span>{t('game.voiceEnable', 'Enable microphone')}</span>
                    </button>
                  )}
                  {voiceStatus === 'requesting' && (
                    <p className="text-xs text-neutral-400 text-center py-2">
                      {t('game.voiceRequesting', 'Requesting microphone permission...')}
                    </p>
                  )}
                  {voiceStatus === 'denied' && (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-amber-400 flex-1">
                        {t('game.voiceDenied', 'Mic permission denied. Allow it in your browser settings, then retry.')}
                      </p>
                      <button
                        type="button"
                        onClick={startVoice}
                        className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs text-white"
                      >
                        {t('game.voiceRetry', 'Retry')}
                      </button>
                    </div>
                  )}
                  {voiceStatus === 'unsupported' && (
                    <p className="text-xs text-neutral-500 text-center py-1">
                      {t('game.voiceUnsupported', 'Audio streaming is not supported in this browser.')}
                    </p>
                  )}
                  {voiceStatus === 'error' && (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-red-400 flex-1">
                        {t('game.voiceError', 'Microphone capture failed.')}
                      </p>
                      <button
                        type="button"
                        onClick={startVoice}
                        className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs text-white"
                      >
                        {t('game.voiceRetry', 'Retry')}
                      </button>
                    </div>
                  )}
                  {voiceStatus === 'connected' && (() => {
                    // Mic is "live" when track is enabled. We mirror the same
                    // logic the auto-mute effect uses to decide what to show.
                    const autoMicLive = !voiceMutedManually && (
                      !(phase === 'clues' && vocalMode && vocalSpeakerId) || vocalSpeakerId === user?.id
                    )
                    return (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-neutral-400">
                          <span className={[
                            'w-2 h-2 rounded-full',
                            autoMicLive ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600',
                          ].join(' ')} />
                          <span>
                            {autoMicLive
                              ? t('game.voiceMicLive', 'Mic live')
                              : t('game.voiceMicMuted', 'Mic muted')}
                          </span>
                          <span className="text-neutral-600">·</span>
                          <span>
                            {t('game.voicePeerCount', '{{count}} connected', { count: voicePeerCount })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setVoiceMutedManually((m) => !m)}
                          aria-pressed={voiceMutedManually}
                          aria-label={voiceMutedManually ? 'Unmute microphone' : 'Mute microphone'}
                          className={[
                            'px-2 py-1 rounded text-xs font-medium transition-colors',
                            voiceMutedManually
                              ? 'bg-red-600/20 text-red-300 hover:bg-red-600/30'
                              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700',
                          ].join(' ')}
                        >
                          {voiceMutedManually ? t('game.voiceUnmute', 'Unmute') : t('game.voiceMute', 'Mute')}
                        </button>
                      </div>
                    )
                  })()}
                </div>
                {isMyTurn && (
                  <button
                    type="button"
                    aria-label="End my turn"
                    onClick={() => getSocket().emit('vocal:skip-turn' as any)}
                    className="w-full px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-colors"
                  >
                    {t('game.vocalDone', "I'm done")}
                  </button>
                )}
              </div>
            </div>
          )
        })()}

        {phase === 'clues' && !isEliminated && !vocalMode && (
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
                  aria-label="Enter your clue"
                  value={clueText}
                  onChange={(e) => setClueText(e.target.value)}
                  maxLength={200}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!clueText.trim()}
                  aria-label="Submit clue"
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
                {tiebreakerActive ? t('game.tiebreakerVoting', 'Vote between the tied players only') : t('game.voteOutRedHanded')}
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
                    aria-label={`Vote for ${getDisplayName(p.userId, p.username)}`}
                    onClick={() => vote(p.userId)}
                    disabled={!!votedFor}
                    className={[
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 text-left active:scale-[0.98]',
                      votedFor === p.userId
                        ? 'border-amber-500/70 bg-gradient-to-r from-amber-950/60 to-amber-900/30 shadow-lg shadow-amber-950/50 animate-jelly'
                        : votedFor
                        ? 'border-neutral-800 bg-neutral-900/40 opacity-50'
                        : 'border-neutral-800 bg-neutral-900/40 hover:border-amber-700/60 hover:bg-gradient-to-r hover:from-amber-950/30 hover:to-neutral-900/40 hover:shadow-md hover:shadow-amber-950/30 hover:-translate-y-0.5 hover:scale-[1.015]',
                    ].join(' ')}
                  >
                    <Avatar src={p.avatarUrl} username={p.username} size="sm" />
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
          const isRedHandedElim = eliminated?.role === 'red_handed' || eliminated?.role === 'double_agent'
          return (
            <div className={[
              'card text-center py-10 relative overflow-hidden',
              eliminated
                ? isRedHandedElim ? 'border-emerald-700/50 shadow-lg shadow-emerald-950/30' : 'border-red-700/50 shadow-lg shadow-red-950/30'
                : isTie ? 'border-amber-700/50 shadow-lg shadow-amber-950/30' : 'border-neutral-700',
            ].join(' ')}>
              {/* Background glow */}
              {eliminated && (
                <div className={[
                  'absolute inset-0 opacity-15',
                  isRedHandedElim
                    ? 'bg-gradient-to-br from-emerald-500 via-emerald-900/20 to-transparent'
                    : 'bg-gradient-to-br from-red-600 via-red-900/20 to-transparent',
                ].join(' ')} />
              )}
              {eliminated && (
                <div className={[
                  'absolute top-0 inset-x-0 h-1',
                  isRedHandedElim
                    ? 'bg-gradient-to-r from-transparent via-emerald-500 to-transparent'
                    : 'bg-gradient-to-r from-transparent via-red-500 to-transparent',
                ].join(' ')} />
              )}
              <div className="relative">
                {eliminated ? (
                  <>
                    <p className="text-7xl mb-3" style={{ animation: 'role-drop 0.5s cubic-bezier(0.34,1.56,0.64,1) both', filter: isRedHandedElim ? 'drop-shadow(0 0 12px rgba(52,211,153,0.5))' : 'drop-shadow(0 0 12px rgba(248,113,113,0.5))' }}>
                      {isRedHandedElim ? '🎯' : '💀'}
                    </p>
                    <p
                      className="text-white font-bold text-xl mb-2"
                      style={{ animation: 'role-rise 0.4s ease 0.2s both' }}
                    >
                      {t('game.wasEliminatedPlayer', { name: eliminated.username })}
                    </p>
                    <p
                      className={[
                        'text-sm font-bold px-4 py-1.5 rounded-full inline-block',
                        isRedHandedElim
                          ? 'text-red-400 bg-red-950/60 border border-red-700/50 shadow-sm shadow-red-950/50'
                          : 'text-brand-400 bg-brand-950/60 border border-brand-700/50 shadow-sm shadow-brand-950/50',
                      ].join(' ')}
                      style={{ animation: 'role-rise 0.4s ease 0.4s both' }}
                    >
                      {eliminated.role === 'red_handed' ? t('game.roleRedHanded')
                        : eliminated.role === 'double_agent' ? t('game.roleDoubleAgent')
                        : eliminated.role === 'detective' ? t('game.roleDetective')
                        : eliminated.role === 'guardian' ? t('game.roleGuardian')
                        : eliminated.role === 'mayor' ? t('game.roleMayor')
                        : eliminated.role === 'infiltrator' ? t('game.roleInfiltrator')
                        : eliminated.role === 'jester' ? t('game.roleJester')
                        : eliminated.role === 'judge' ? t('game.roleJudge')
                        : eliminated.role === 'revenant' ? t('game.roleRevenant')
                        : eliminated.role === 'kamikaze' ? t('game.roleKamikaze')
                        : eliminated.role === 'corruptor' ? t('game.roleCorruptor')
                        : eliminated.role === 'inverter' ? t('game.roleInverter')
                        : eliminated.role === 'twin_villager' ? t('game.roleTwinVillager')
                        : eliminated.role === 'twin_red_handed' ? t('game.roleTwinRedHanded')
                        : t('game.roleVillager')}
                    </p>
                    {isRedHandedElim && (
                      <p className="text-emerald-400 text-sm font-bold mt-3" style={{ animation: 'role-rise 0.4s ease 0.55s both', textShadow: '0 0 10px rgba(52,211,153,0.4)' }}>
                        {t('game.goodCatch', 'Nice catch!')}
                      </p>
                    )}
                  </>
                ) : isTie ? (
                  <>
                    <p className="text-7xl mb-3" style={{ animation: 'role-drop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                      🤝
                    </p>
                    <p className="text-white font-bold text-xl mb-1" style={{ animation: 'role-rise 0.4s ease 0.2s both' }}>
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
                    <p className="text-xs text-neutral-500 mb-1">{t('game.redHandedWord')}</p>
                    <p className="text-amber-300 font-extrabold text-xl">{wordReveal.redHandedWord}</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-neutral-600 mt-4 relative">{t('game.nextRoundSoon')}</p>
            </div>
          )
        })()}

        {/* Clues log — hidden during clue phase until you submit (prevents copying) */}
        {/* In vocal mode clues aren't typed, so the log is only relevant for post-round review. */}
        {!(vocalMode && phase === 'clues') && (
        <div className="card flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
            {t('game.cluesTitle', { round: currentRound?.roundNumber ?? 1 })}
          </p>
          {phase === 'clues' && !hasSubmittedClue && !isEliminated && !vocalMode ? (
            <p className="text-neutral-600 text-sm italic">{t('game.submitClueFirst', 'Submit your clue to see what others wrote')}</p>
          ) : clues.length === 0 ? (
            <p className="text-neutral-600 text-sm italic">{vocalMode ? t('game.vocalNoTextClues', 'No typed clues — this round was spoken aloud') : t('game.noClues')}</p>
          ) : (
            <div className="space-y-2">
              {clues.map((clue, i) => {
                const player = players.find((p) => p.userId === clue.playerId)
                const isMe = clue.playerId === user?.id
                return (
                  <div
                    key={i}
                    className={[
                      'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all animate-scale-in border-l-2',
                      clue.flaggedForWord
                        ? 'ring-1 ring-amber-500/40 bg-amber-950/20 border-amber-700/40 border-l-amber-500'
                        : isMe
                          ? 'bg-brand-950/30 border-brand-800/30 border-l-brand-500'
                          : 'bg-neutral-800/30 border-neutral-800/50 border-l-emerald-700',
                    ].join(' ')}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <Avatar src={player?.avatarUrl} username={player?.username ?? '?'} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-neutral-400">
                          {player ? getDisplayName(player.userId, player.username) : 'Unknown'}
                        </span>
                        <span className="text-neutral-700 text-[10px]">#{i + 1}</span>
                        {isMe && <span className="text-[10px] text-brand-400 font-bold">{t('results.you', 'YOU')}</span>}
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
        )}
      </div>

      {/* ── Chat sidebar ── */}
      <div className="w-full md:w-72 lg:w-80 flex flex-col border-t md:border-t-0 md:border-l border-neutral-800/80 h-64 md:h-screen bg-neutral-950/60 backdrop-blur-sm">
        {/* Players list */}
        <div className="border-b border-neutral-800/70 p-3 bg-neutral-900/30">
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
          {/* Guardian ability banner */}
          {myRole === 'guardian' && (
            <div className={[
              'flex items-center gap-2 px-3 py-2 rounded-xl border mb-2 text-xs font-semibold',
              guardianProtectUsed
                ? 'bg-neutral-900/40 border-neutral-800 text-neutral-600'
                : 'bg-yellow-950/40 border-yellow-800/40 text-yellow-400',
            ].join(' ')}>
              <span>🛡️</span>
              <span>{guardianProtectUsed ? t('game.guardianUsed') : t('game.guardianAvailable')}</span>
            </div>
          )}
          {/* Mayor ability banner */}
          {myRole === 'mayor' && (
            <div className={[
              'flex flex-col gap-2 px-3 py-2 rounded-xl border mb-2 text-xs font-semibold',
              mayorDoubleActive
                ? 'bg-indigo-900/50 border-indigo-600/60 text-indigo-300'
                : mayorDoubleVoteUsed
                  ? 'bg-neutral-900/40 border-neutral-800 text-neutral-600'
                  : 'bg-indigo-950/40 border-indigo-800/40 text-indigo-400',
            ].join(' ')}>
              <div className="flex items-center gap-2">
                <span>⚖️</span>
                <span>
                  {mayorDoubleActive
                    ? t('game.mayorDoubleVoteActive', 'Double vote active this round')
                    : mayorDoubleVoteUsed
                      ? t('game.mayorDoubleVoteUsed', 'Double vote used')
                      : t('game.mayorAvailable', 'Double vote ready')}
                </span>
              </div>
              {!mayorDoubleVoteUsed && !mayorDoubleActive && phase === 'voting' && !isEliminated && (
                <button
                  onClick={() => {
                    log.info('mayor activating double vote')
                    getSocket().emit('mayor:activate-double' as any)
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                >
                  {t('game.mayorDoubleVoteBtn', 'Double my vote')}
                </button>
              )}
            </div>
          )}
          {/* Inverter ability banner */}
          {myRole === 'inverter' && (
            <div className={[
              'flex flex-col gap-2 px-3 py-2 rounded-xl border mb-2 text-xs font-semibold',
              inverterActive
                ? 'bg-rose-900/50 border-rose-600/60 text-rose-300'
                : inverterUsed
                  ? 'bg-neutral-900/40 border-neutral-800 text-neutral-600'
                  : 'bg-rose-950/40 border-rose-800/40 text-rose-400',
            ].join(' ')}>
              <div className="flex items-center gap-2">
                <span>🔄</span>
                <span>
                  {inverterActive
                    ? t('game.inverterActive', 'Vote inversion active this round')
                    : inverterUsed
                      ? t('game.inverterUsed', 'Vote inversion used')
                      : t('game.inverterAvailable', 'Vote inversion ready')}
                </span>
              </div>
              {!inverterUsed && !inverterActive && phase === 'voting' && !isEliminated && (
                <button
                  onClick={() => {
                    log.info('inverter activating')
                    getSocket().emit('inverter:activate' as any)
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
                >
                  {t('game.inverterActivateBtn', 'Invert the vote')}
                </button>
              )}
            </div>
          )}
          {/* Corruptor ability banner */}
          {myRole === 'corruptor' && (
            <div className={[
              'flex items-center gap-2 px-3 py-2 rounded-xl border mb-2 text-xs font-semibold',
              corruptorTargetUserId
                ? 'bg-orange-900/40 border-orange-800/40 text-orange-300'
                : 'bg-orange-950/50 border-orange-700/60 text-orange-300 animate-pulse',
            ].join(' ')}>
              <span>🕷️</span>
              <span>
                {corruptorTargetUserId
                  ? t('game.corruptorTargetLocked', 'Your target is silenced')
                  : t('game.corruptorMustPick', 'Pick your corruption target')}
              </span>
              {!corruptorTargetUserId && (
                <button
                  onClick={() => setShowCorruptorPicker(true)}
                  className="ml-auto px-2 py-0.5 rounded bg-orange-700 hover:bg-orange-600 text-white text-[10px] font-bold"
                >
                  {t('game.corruptorPickBtn', 'Pick')}
                </button>
              )}
            </div>
          )}
          {/* Revenant ghost-voter banner */}
          {myRole === 'revenant' && isEliminated && revenantVotesRemaining > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border mb-2 text-xs font-semibold bg-teal-950/50 border-teal-700/60 text-teal-300">
              <span>👻</span>
              <span>
                {t('game.revenantGhostVoter', { count: revenantVotesRemaining, defaultValue: 'Ghost voter — {{count}} vote(s) left' })}
              </span>
            </div>
          )}
          {/* Twin partner banner */}
          {(myRole === 'twin_villager' || myRole === 'twin_red_handed') && twinPartner && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border mb-2 text-xs font-semibold bg-purple-950/40 border-purple-800/40 text-purple-300">
              <span>👯</span>
              <span>
                {t('game.twinPartnerBanner', { name: twinPartner.twinUsername, defaultValue: 'Your twin: {{name}}' })}
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2" role="list" aria-label="Players">
            {players.map((p) => {
              const canReveal = myRole === 'detective' && !detectiveRevealUsed && p.userId !== user?.id && p.status === 'alive' && (phase === 'clues' || phase === 'voting')
              const canProtect = myRole === 'guardian' && !guardianProtectUsed && p.status === 'alive' && phase === 'voting'
              const isSpeakingNow = currentSpeakerId === p.userId && phase === 'clues'
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPlayerId(p.userId)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPlayerId(p.userId) }}
                  aria-label={`${getDisplayName(p.userId, p.username)}, ${p.status}`}
                  title={`View ${getDisplayName(p.userId, p.username)}'s clue history`}
                  className={[
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer select-none border active:scale-95 hover:-translate-y-0.5 hover:shadow-lg',
                    p.status === 'alive'
                      ? isSpeakingNow
                        ? 'bg-gradient-to-br from-brand-900/70 to-brand-950/80 text-white ring-2 ring-brand-500/60 border-brand-500/60 shadow-lg shadow-brand-900/50 animate-glow-pulse'
                        : 'bg-neutral-800/80 text-white hover:bg-neutral-700 hover:ring-1 hover:ring-neutral-600 border-neutral-700/50 hover:border-neutral-600 hover:shadow-neutral-900/60'
                      : p.status === 'forfeited'
                      ? 'bg-orange-950/30 text-neutral-600 line-through border-orange-900/20 hover:bg-orange-950/50 animate-desaturate'
                      : 'bg-red-950/30 text-neutral-600 line-through border-red-900/20 hover:bg-red-950/50 animate-desaturate',
                  ].join(' ')}
                >
                  <span className={[
                    'w-1.5 h-1.5 rounded-full',
                    p.status === 'alive'
                      ? isSpeakingNow ? 'bg-brand-400 animate-heartbeat' : 'bg-emerald-400 animate-pulse'
                      : p.status === 'forfeited' ? 'bg-orange-700' : 'bg-neutral-700',
                  ].join(' ')} />
                  <Avatar
                    src={p.avatarUrl}
                    username={p.username}
                    size="xs"
                    className={p.status !== 'alive' ? 'opacity-50 grayscale' : ''}
                  />
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
                  {canProtect && (
                    <button
                      onClick={(e) => { e.stopPropagation(); getSocket().emit('guardian:protect' as any, { targetUserId: p.userId }) }}
                      className="ml-0.5 text-yellow-400 hover:text-yellow-300 text-[10px] font-bold border border-yellow-800/50 rounded px-1 transition-colors"
                      title={t('game.guardianProtectBtn')}
                    >
                      🛡️
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
            {(() => {
              const cooldownRemaining = Math.max(0, emoteCooldownUntil - (emoteNow || Date.now()))
              const locked = cooldownRemaining > 0
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-neutral-600">{t('game.react')}</p>
                    {locked && (
                      <span className="text-[10px] text-amber-500">Slow down · {Math.ceil(cooldownRemaining / 1000)}s</span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {EMOTES.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => sendEmote(emoji)}
                        disabled={locked}
                        className={`text-2xl w-11 h-11 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/80 hover:scale-110 active:scale-95 transition-all border border-neutral-700/50 ${locked ? 'opacity-40 cursor-not-allowed hover:scale-100' : ''}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}
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
