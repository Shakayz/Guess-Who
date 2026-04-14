import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { NavBar } from '../components/NavBar'
import { WORD_CATEGORIES, MATCHMAKING_CONFIG, TUTORIAL_COMPLETION_REWARD } from '@imposter/shared'
import type { WordCategory, MatchmakingStatus } from '@imposter/shared'
import { connectSocket, getSocket } from '../lib/socket'
import { useGameStore } from '../store/game'
import { useAuthStore } from '../store/auth'
import { createLogger } from '../lib/logger'
import { SoundManager } from '../lib/sounds'
import { OnboardingTutorial, hasTutorialCompleted } from '../components/OnboardingTutorial'

const log = createLogger('home')

type HomeMode = 'normal' | 'ranked' | 'lobby' | 'offline'
type SubGameMode = 'normal' | 'special'

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const activeRoom = useGameStore((s) => s.room)
  const gameFinished = useGameStore((s) => s.gameFinished)
  const gameResult = useGameStore((s) => s.result)
  const user = useAuthStore((s) => s.user)

  // Determine if the player currently has a game they can return to
  const hasActiveGame = !!(activeRoom && (
    activeRoom.status === 'in_progress' || activeRoom.status === 'voting'
  ))
  const hasUnacknowledgedResult = !!(gameFinished && gameResult && activeRoom)

  // Whether the player is still playing (alive) — they get redirected by ActiveGameGuard
  // Whether the player is eliminated/forfeited — they see the "rejoin" banner but can browse
  const isAliveInGame = hasActiveGame && activeRoom?.players?.some(
    (p) => p.userId === user?.id && p.status === 'alive'
  )

  // Block starting new games while in an active game (alive OR eliminated — game isn't over yet)
  const isBlockedFromNewGame = hasActiveGame

  const [selectedMode, setSelectedMode] = useState<HomeMode | null>(null)
  const [unrankedSubMode, setUnrankedSubMode] = useState<SubGameMode>('normal')
  const [lobbyGameMode, setSubGameMode] = useState<SubGameMode>('normal')
  const [categories, setCategories] = useState<WordCategory[]>([])
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchmaking, setMatchmaking] = useState(false)
  const [matchStatus, setMatchStatus] = useState<MatchmakingStatus>({
    queueSize: 1, needed: MATCHMAKING_CONFIG.IDEAL_PLAYERS, elapsed: 0,
    maxWait: MATCHMAKING_CONFIG.MAX_WAIT_SECONDS, idealPlayers: MATCHMAKING_CONFIG.IDEAL_PLAYERS,
  })

  const hasCategories = selectedMode === 'normal' || selectedMode === 'lobby'
  const hasSubMode = selectedMode === 'normal' || selectedMode === 'lobby'
  // 'offline' mode navigates directly to /offline, so it never reaches the create button

  useEffect(() => {
    if (!matchmaking) return
    connectSocket()
    const sock = getSocket() as any
    const handleStatus = (d: MatchmakingStatus) => setMatchStatus(d)
    const handleFound = (d: { roomCode: string }) => {
      setMatchmaking(false)
      navigate(`/lobby/${d.roomCode}`)
    }
    const handleError = (d: { reason?: string; required?: number; message?: string }) => {
      setMatchmaking(false)
      if (d?.reason === 'INSUFFICIENT_STARS') {
        setError(t('results.insufficientStars', { required: d.required ?? 10 }))
      } else {
        setError(d?.message ?? t('common.error'))
      }
    }
    sock.on('matchmaking:status', handleStatus)
    sock.on('matchmaking:found', handleFound)
    sock.on('matchmaking:error', handleError)

    // ── Connection sanity heartbeat ──────────────────────────────────────────
    // Every 5 seconds, if the socket got wedged (disconnected silently), kick
    // the reconnection. On successful reconnect, the server re-tracks the
    // user in `onlineUsers` so `matchmaking:status` broadcasts resume. We do
    // NOT re-emit `matchmaking:join` here — that would reset the user's queue
    // position and wait time. The server's internal tick already broadcasts
    // status every 1-2s to every online user in the queue, so a healthy
    // socket is all we need.
    const heartbeat = setInterval(() => {
      const s = getSocket()
      if (!s.connected) {
        log.info('matchmaking heartbeat: socket disconnected, reconnecting')
        connectSocket()
      }
    }, 5000)

    return () => {
      clearInterval(heartbeat)
      sock.off('matchmaking:status', handleStatus)
      sock.off('matchmaking:found', handleFound)
      sock.off('matchmaking:error', handleError)
    }
  }, [matchmaking, t])

  const toggleCategory = (key: WordCategory) => {
    setCategories((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    )
  }

  const handleCreate = async () => {
    if (!selectedMode || isBlockedFromNewGame) return
    setError(null)

    if (selectedMode === 'lobby') {
      setLoading(true)
      log.info('creating private lobby', { categories, language: i18n.language })
      try {
        const room = await api.post<{ code: string }>('/rooms', {
          settings: { categories, isPrivate: true, language: i18n.language.split('-')[0] },
        })
        log.info('lobby created', { code: room.code })
        navigate(`/lobby/${room.code}?mode=${lobbyGameMode}`)
      } catch (err: any) {
        log.error('lobby creation failed', { error: err.message })
        // The API returns 402 { error: 'INSUFFICIENT_STARS', required } when
        // the host can't afford to create a private lobby.
        if (err?.data?.error === 'INSUFFICIENT_STARS') {
          setError(t('results.insufficientStars', { required: err.data.required ?? 10 }))
        } else {
          setError(err.message)
        }
      } finally {
        setLoading(false)
      }
      return
    }

    connectSocket()
    setMatchStatus({
      queueSize: 1, needed: MATCHMAKING_CONFIG.IDEAL_PLAYERS, elapsed: 0,
      maxWait: MATCHMAKING_CONFIG.MAX_WAIT_SECONDS, idealPlayers: MATCHMAKING_CONFIG.IDEAL_PLAYERS,
    })
    setMatchmaking(true)
    // For unranked (selectedMode === 'normal'), use the sub-mode (normal/special)
    const actualGameMode = selectedMode === 'normal' ? unrankedSubMode : selectedMode
    log.info('joining matchmaking', { mode: actualGameMode, categories })
    getSocket().emit('matchmaking:join' as any, { gameMode: actualGameMode, categories })
  }

  const cancelMatchmaking = () => {
    log.info('leaving matchmaking')
    setMatchmaking(false)
    getSocket().emit('matchmaking:leave' as any, { gameMode: selectedMode })
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomCode.trim() || isBlockedFromNewGame) return
    navigate(`/lobby/${roomCode.trim().toUpperCase()}`)
  }

  const MODES: { id: HomeMode; icon: string; labelKey: string; descKey: string; color: string; inactive: string; shadow: string }[] = [
    {
      id: 'normal',
      icon: '🎲',
      labelKey: 'home.normalLabel',
      descKey: 'home.normalDesc',
      color: 'border-brand-700/60 bg-brand-950/50 text-brand-400 shadow-md shadow-brand-950/50 ring-1 ring-brand-600/20',
      inactive: 'border-neutral-800 hover:border-brand-800/50 hover:-translate-y-0.5 hover:shadow-md hover:shadow-neutral-950/60',
      shadow: 'shadow-brand-950/50',
    },
    {
      id: 'ranked',
      icon: '🏆',
      labelKey: 'home.rankedLabel',
      descKey: 'home.rankedDesc',
      color: 'border-amber-700/60 bg-amber-950/50 text-amber-400 shadow-md shadow-amber-950/50 ring-1 ring-amber-600/20',
      inactive: 'border-neutral-800 hover:border-amber-800/50 hover:-translate-y-0.5 hover:shadow-md hover:shadow-neutral-950/60',
      shadow: 'shadow-amber-950/50',
    },
    {
      id: 'lobby',
      icon: '🚪',
      labelKey: 'home.lobbyLabel',
      descKey: 'home.lobbyDesc',
      color: 'border-violet-700/60 bg-violet-950/50 text-violet-400 shadow-md shadow-violet-950/50 ring-1 ring-violet-600/20',
      inactive: 'border-neutral-800 hover:border-violet-800/50 hover:-translate-y-0.5 hover:shadow-md hover:shadow-neutral-950/60',
      shadow: 'shadow-violet-950/50',
    },
    {
      id: 'offline',
      icon: '📱',
      labelKey: 'home.offlineLabel',
      descKey: 'home.offlineDesc',
      color: 'border-teal-700/60 bg-teal-950/50 text-teal-400 shadow-md shadow-teal-950/50 ring-1 ring-teal-600/20',
      inactive: 'border-neutral-800 hover:border-teal-800/50 hover:-translate-y-0.5 hover:shadow-md hover:shadow-neutral-950/60',
      shadow: 'shadow-teal-950/50',
    },
  ]

  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [showTutorial, setShowTutorial] = useState(() => !hasTutorialCompleted())
  // Server-side tutorial completion flag (source of truth for the /tutorial
  // walkthrough reward). We hide the "🎓 Your First Game" CTA card once this
  // is true so returning players aren't prompted to replay something they've
  // already earned the 50⭐ for. Defaults to `true` (hide) while loading so
  // the card doesn't flicker in and then disappear.
  const [walkthroughCompleted, setWalkthroughCompleted] = useState(true)
  useEffect(() => {
    let cancelled = false
    api.get<{ completed: boolean }>('/tutorial/status')
      .then((s) => { if (!cancelled) setWalkthroughCompleted(s.completed) })
      .catch(() => { if (!cancelled) setWalkthroughCompleted(false) })
    return () => { cancelled = true }
  }, [])

  const LOBBY_GAME_MODES: { id: SubGameMode; icon: string; labelKey: string; descKey: string }[] = [
    { id: 'normal',  icon: '🎭', labelKey: 'home.normalGameMode',  descKey: 'home.normalGameModeDesc' },
    { id: 'special', icon: '✨', labelKey: 'home.specialGameMode', descKey: 'home.specialGameModeDesc' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main id="main-content" role="main" className="flex-1 flex flex-col items-center px-4 pt-16 pb-24 md:pb-16 md:pt-20 lg:pt-24">
        <div className="w-full max-w-lg md:max-w-2xl lg:max-w-4xl animate-slide-up space-y-5">

          {/* Heading */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-600/30 bg-brand-600/10 text-brand-400 text-xs font-semibold mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-slow" />
              {t('home.tagline')}
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight tracking-tight mb-2">
              {t('home.heroTitle1')} <span className="text-brand-500">{t('home.heroTitle2')}</span> {t('home.heroTitle3')}
            </h1>
            <p className="text-neutral-400 text-base md:text-lg">{t('home.subtitle')}</p>
          </div>

          {/* ── Active game card — rejoin / spectate ── */}
          {hasActiveGame && activeRoom && (() => {
            const me = activeRoom.players?.find(p => p.userId === user?.id)
            const amAlive = me?.status === 'alive'
            const amEliminated = me?.status === 'eliminated'
            const alivePlayers = activeRoom.players?.filter(p => p.status === 'alive').length ?? 0
            const totalPlayers = activeRoom.players?.length ?? 0
            const roundNum = (activeRoom as any).currentRound ?? '?'

            return (
              <button
                onClick={() => navigate(`/game/${activeRoom.code}`)}
                className={[
                  'w-full group relative overflow-hidden rounded-2xl border p-4 text-left transition-all active:scale-[0.99]',
                  amAlive
                    ? 'border-brand-600/60 bg-brand-950/60 hover:border-brand-500/80 hover:bg-brand-950/80'
                    : 'border-neutral-700/50 bg-neutral-900/60 hover:border-neutral-600/70 hover:bg-neutral-800/60',
                ].join(' ')}
              >
                {/* Top glow line */}
                <div className={[
                  'absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent to-transparent',
                  amAlive ? 'via-brand-500' : 'via-neutral-600',
                ].join(' ')} />

                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={[
                    'w-12 h-12 rounded-xl border flex items-center justify-center text-2xl shrink-0',
                    amAlive
                      ? 'bg-brand-600/20 border-brand-700/40'
                      : 'bg-neutral-800/60 border-neutral-700/40',
                  ].join(' ')}>
                    {amAlive ? '🎮' : amEliminated ? '👻' : '🏳'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold text-sm">
                        {t('home.activeGame', 'Game In Progress')}
                      </p>
                      {amAlive && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-900/60 text-emerald-400 border border-emerald-800/40">
                          {t('home.statusPlaying', 'Playing')}
                        </span>
                      )}
                      {amEliminated && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-900/40 text-red-400 border border-red-800/30">
                          {t('home.statusEliminated', 'Eliminated')}
                        </span>
                      )}
                      {me?.status === 'forfeited' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-900/40 text-orange-400 border border-orange-800/30">
                          {t('home.statusForfeited', 'Forfeited')}
                        </span>
                      )}
                    </div>
                    <p className="text-neutral-400 text-xs mt-0.5">
                      {t('home.activeGameInfo', '{{alive}} of {{total}} alive · Round {{round}}', { alive: alivePlayers, total: totalPlayers, round: roundNum })}
                      {' · '}
                      <span className="font-mono text-neutral-500">{activeRoom.code}</span>
                    </p>
                  </div>

                  {/* CTA */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <span className={[
                      'font-semibold text-sm transition-colors',
                      amAlive
                        ? 'text-brand-400 group-hover:text-brand-300'
                        : 'text-neutral-400 group-hover:text-neutral-300',
                    ].join(' ')}>
                      {amAlive
                        ? t('home.rejoinGame', 'Rejoin')
                        : t('home.spectateGame', 'Watch')} →
                    </span>
                  </div>
                </div>
              </button>
            )
          })()}

          {/* Unacknowledged result — link to results page */}
          {!hasActiveGame && hasUnacknowledgedResult && activeRoom && (
            <button
              onClick={() => navigate(`/results/${activeRoom.code}`)}
              className="w-full group relative overflow-hidden rounded-2xl border border-amber-700/50 bg-amber-950/40 p-4 text-left transition-all hover:border-amber-600/70 hover:bg-amber-950/60 active:scale-[0.99]"
            >
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-600/20 border border-amber-700/40 flex items-center justify-center text-2xl shrink-0">
                  🏆
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">{t('home.gameEnded', 'Game Finished')}</p>
                  <p className="text-neutral-400 text-xs mt-0.5">{t('home.viewResults', 'View your results and rewards')}</p>
                </div>
                <span className="text-amber-400 font-semibold text-sm group-hover:text-amber-300 transition-colors">
                  {t('home.seeResults', 'Results')} →
                </span>
              </div>
            </button>
          )}

          {/* Quick Join */}
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              className="input-field flex-1 font-mono uppercase tracking-[0.25em] text-center text-lg h-12 focus:ring-2 focus:ring-brand-600/50 focus:shadow-lg focus:shadow-brand-950/40 transition-all"
              placeholder={t('home.roomCodePlaceholder')}
              aria-label="Room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={8}
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={roomCode.trim().length < 4 || !!isBlockedFromNewGame}
              className="h-12 px-6 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 whitespace-nowrap shadow-sm"
            >
              {t('room.joinRoom')}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-neutral-800" />
            <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider">{t('home.orStartNew')}</span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>

          {/* Mode selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
              {t('home.chooseMode')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:gap-4 gap-2.5">
              {MODES.map((mode) => {
                const active = selectedMode === mode.id
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      SoundManager.play('click')
                      if (mode.id === 'offline') { navigate('/offline'); return }
                      setSelectedMode(active ? null : mode.id)
                      setCategories([])
                      setError(null)
                    }}
                    aria-label={t(mode.labelKey)}
                    aria-pressed={active}
                    className={[
                      'flex flex-col items-center gap-1.5 p-4 rounded-2xl border transition-all duration-200 active:scale-[0.97]',
                      active ? mode.color : `bg-neutral-900 text-neutral-400 ${mode.inactive}`,
                    ].join(' ')}
                  >
                    <span className="text-2xl md:text-3xl">{mode.icon}</span>
                    <span className="text-sm md:text-base font-bold">{t(mode.labelKey)}</span>
                    <span className={['text-[10px] text-center leading-tight', active ? 'opacity-80' : 'text-neutral-600'].join(' ')}>
                      {t(mode.descKey)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Game mode sub-selector — shown for Unranked and Lobby */}
          {hasSubMode && (
            <div className="card animate-slide-up space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{t('home.gameModeLabel')}</p>
              <div className="flex gap-2">
                {LOBBY_GAME_MODES.map((m) => {
                  const currentSubMode = selectedMode === 'normal' ? unrankedSubMode : lobbyGameMode
                  const setSubMode = selectedMode === 'normal' ? setUnrankedSubMode : setSubGameMode
                  const isActive = currentSubMode === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSubMode(m.id)}
                      className={[
                        'flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-sm font-semibold transition-all border',
                        isActive
                          ? m.id === 'special'
                            ? 'bg-purple-950/60 border-purple-700/50 text-purple-400'
                            : 'bg-brand-950/60 border-brand-700/50 text-brand-400'
                          : 'bg-neutral-800/60 border-neutral-700/50 text-neutral-400 hover:text-white',
                      ].join(' ')}
                    >
                      <span className="text-lg">{m.icon}</span>
                      <span>{t(m.labelKey)}</span>
                      <span className={['text-[10px] font-normal text-center', isActive ? 'opacity-70' : 'text-neutral-600'].join(' ')}>
                        {t(m.descKey)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Category picker */}
          {hasCategories && (
            <div className="card space-y-3 animate-slide-up">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  {t('home.categories')}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCategories(WORD_CATEGORIES.map((c) => c.key as WordCategory))}
                    className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    {t('home.catAll')}
                  </button>
                  <span className="text-neutral-700">·</span>
                  <button
                    onClick={() => setCategories([])}
                    className="text-[11px] text-neutral-500 hover:text-neutral-400 transition-colors"
                  >
                    {t('home.catRandom')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 md:gap-2">
                {WORD_CATEGORIES.map((cat) => {
                  const selected = categories.includes(cat.key as WordCategory)
                  const isAll = categories.length === 0
                  return (
                    <button
                      key={cat.key}
                      onClick={() => toggleCategory(cat.key as WordCategory)}
                      className={[
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                        selected
                          ? 'bg-brand-950/60 border-brand-700/50 text-brand-300 shadow-sm shadow-brand-950/40 ring-1 ring-brand-700/20'
                          : isAll
                            ? 'bg-neutral-800/40 border-neutral-700/30 text-neutral-400 hover:border-neutral-600/50 hover:text-neutral-300'
                            : 'bg-neutral-900/40 border-neutral-800/40 text-neutral-600 hover:border-neutral-700/50 hover:text-neutral-400',
                      ].join(' ')}
                    >
                      <span>{cat.icon}</span>
                      <span className="truncate">{t(`home.cat.${cat.key}`, cat.label)}</span>
                    </button>
                  )
                })}
              </div>

              {categories.length === 0 && (
                <p className="text-[10px] text-neutral-600">{t('home.catNoFilter')}</p>
              )}
              {categories.length > 0 && (
                <p className="text-[10px] text-neutral-600">
                  {t('home.catSelected', { count: categories.length, total: WORD_CATEGORIES.length })}
                </p>
              )}
            </div>
          )}

          {/* Ranked info */}
          {selectedMode === 'ranked' && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-950/30 border border-amber-800/30 animate-slide-up">
              <span className="text-amber-400 mt-0.5">🏆</span>
              <div>
                <p className="text-amber-400 text-sm font-semibold">{t('home.rankedMode')}</p>
                <p className="text-amber-600 text-xs mt-0.5">{t('home.rankedModeInfo')}</p>
              </div>
            </div>
          )}

          {/* Matchmaking waiting UI */}
          {matchmaking && (() => {
            const { queueSize, needed, elapsed, maxWait, idealPlayers } = matchStatus
            const progressPct = Math.min(100, (queueSize / idealPlayers) * 100)
            const timePct = Math.min(100, (elapsed / maxWait) * 100)
            const statusText = elapsed < 15
              ? t('home.matchmakingFullLobby')
              : elapsed < 35
                ? t('home.matchmakingExpanding')
                : t('home.matchmakingStartingSoon')

            return (
              <div className="card animate-slide-up space-y-4" aria-live="polite" role="status">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-white font-semibold text-sm">{statusText}</p>
                    <p className="text-neutral-500 text-xs">
                      {t('home.inQueue', { count: queueSize, needed })}
                    </p>
                  </div>
                </div>

                {/* Player slot dots */}
                <div className="flex items-center justify-center gap-1.5">
                  {Array.from({ length: idealPlayers }).map((_, i) => (
                    <div
                      key={i}
                      className={[
                        'w-3 h-3 rounded-full transition-all duration-300',
                        i < queueSize
                          ? 'bg-brand-500 scale-110'
                          : i < needed
                            ? 'bg-neutral-700 border border-neutral-600'
                            : 'bg-neutral-800/50',
                      ].join(' ')}
                    />
                  ))}
                </div>

                {/* Player progress bar */}
                <div className="w-full bg-neutral-800 rounded-full h-1.5">
                  <div
                    className="bg-brand-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Time progress bar */}
                <div className="w-full bg-neutral-800 rounded-full h-1">
                  <div
                    className="bg-neutral-600 h-1 rounded-full transition-all duration-1000"
                    style={{ width: `${timePct}%` }}
                  />
                </div>
                <p className="text-neutral-600 text-[10px] text-center">{elapsed}s / {maxWait}s</p>

                <button
                  onClick={cancelMatchmaking}
                  className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white font-semibold text-sm transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            )
          })()}

          {/* Create button */}
          {selectedMode && !matchmaking && (
            <button
              onClick={handleCreate}
              disabled={loading || !!isBlockedFromNewGame}
              className={[
                'w-full py-4 rounded-2xl font-bold text-lg text-white transition-all duration-150 active:scale-[0.98] shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed',
                selectedMode === 'ranked'
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25'
                  : selectedMode === 'lobby'
                    ? 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/25'
                    : 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/25',
              ].join(' ')}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {t('home.creating')}
                </span>
              ) : (
                <span className="flex flex-col items-center gap-1">
                  <span>
                    {selectedMode === 'normal' && t('home.findGame')}
                    {selectedMode === 'ranked' && t('home.findRanked')}
                    {selectedMode === 'lobby' && t('home.createLobby')}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                    {selectedMode === 'lobby'
                      ? t('home.costHintHost', { cost: 10 })
                      : t('home.costHint', { cost: 10 })}
                  </span>
                </span>
              )}
            </button>
          )}

          {error && (
            <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-400 text-sm">
              <span>⚠</span> {error}
            </div>
          )}

        </div>

        {/* Walkthrough / tutorial CTA — prominent card for first-time players.
            Hidden once the player has finished the walkthrough and claimed
            the 50⭐ reward (server-side `tutorialCompleted` flag). */}
        {!walkthroughCompleted && (
          <Link
            to="/tutorial"
            className="mt-10 w-full max-w-md mx-auto group relative overflow-hidden rounded-2xl border border-amber-700/40 bg-gradient-to-br from-amber-950/50 to-brand-950/40 p-4 flex items-center gap-4 hover:border-amber-600/60 hover:from-amber-950/70 transition-all active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-600/20 border border-amber-700/40 flex items-center justify-center text-2xl shrink-0">
              🎓
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white font-bold text-sm">{t('tutorial.homeCardTitle')}</p>
              <p className="text-amber-300/80 text-xs mt-0.5">
                {t('tutorial.homeCardSubtitle', { amount: TUTORIAL_COMPLETION_REWARD })}
              </p>
            </div>
            <span className="text-amber-400 font-semibold text-sm group-hover:text-amber-300 transition-colors">
              {t('tutorial.homeCardCta')} →
            </span>
          </Link>
        )}

        {/* How to play link */}
        <Link
          to="/how-to-play"
          className="mt-6 text-xs font-semibold uppercase tracking-widest text-neutral-600 hover:text-neutral-400 transition-colors flex items-center gap-1.5"
        >
          <span className="w-4 h-4 rounded-full border border-neutral-700 flex items-center justify-center text-[10px] font-bold">?</span>
          {t('home.howToPlay')}
        </Link>

        {/* How to play modal */}
        {showHowToPlay && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowHowToPlay(false)}
          >
            <div
              className="w-full max-w-md md:max-w-lg bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
                <h2 className="text-white font-bold text-base">{t('home.howToPlay')}</h2>
                <button onClick={() => setShowHowToPlay(false)} className="text-neutral-500 hover:text-white transition-colors text-xl leading-none">×</button>
              </div>

              <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">

                {/* Objective */}
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">{t('home.htp.objective')}</p>
                  <p className="text-sm text-neutral-300 leading-relaxed">{t('home.htp.objectiveDesc')}</p>
                </section>

                {/* Rounds */}
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">{t('home.htp.rounds')}</p>
                  <div className="space-y-2">
                    {(['speaking', 'voting', 'reveal'] as const).map((step, i) => (
                      <div key={step} className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-400 flex-shrink-0 mt-0.5">{i + 1}</span>
                        <div>
                          <p className="text-sm font-semibold text-white">{t(`home.htp.step${i + 1}Title`)}</p>
                          <p className="text-xs text-neutral-500 leading-relaxed">{t(`home.htp.step${i + 1}Desc`)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Roles */}
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">{t('home.htp.roles')}</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                      <span className="text-lg">🏘️</span>
                      <div>
                        <p className="text-sm font-semibold text-white">{t('home.htp.villagerTitle')}</p>
                        <p className="text-xs text-neutral-500 leading-relaxed">{t('home.htp.villagerDesc')}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                      <span className="text-lg">🔪</span>
                      <div>
                        <p className="text-sm font-semibold text-white">{t('home.htp.imposterTitle')}</p>
                        <p className="text-xs text-neutral-500 leading-relaxed">{t('home.htp.imposterDesc')}</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Win conditions */}
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">{t('home.htp.winConditions')}</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-neutral-300">
                      <span className="text-emerald-400">✓</span>
                      {t('home.htp.villagerWin')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-300">
                      <span className="text-red-400">✓</span>
                      {t('home.htp.imposterWin')}
                    </div>
                  </div>
                </section>

                {/* Tips */}
                <section className="pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">{t('home.htp.tips')}</p>
                  <ul className="space-y-1.5">
                    {[0, 1, 2].map((i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-neutral-400">
                        <span className="text-brand-400 mt-0.5">›</span>
                        {t(`home.htp.tip${i + 1}`)}
                      </li>
                    ))}
                  </ul>
                </section>

              </div>
            </div>
          </div>
        )}

        {/* Onboarding tutorial — shown on first sign-in */}
        {showTutorial && (
          <OnboardingTutorial onClose={() => setShowTutorial(false)} />
        )}
      </main>
    </div>
  )
}
