import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { NavBar } from '../components/NavBar'
import { WORD_CATEGORIES } from '@imposter/shared'
import type { WordCategory } from '@imposter/shared'
import { connectSocket, getSocket } from '../lib/socket'
import { useGameStore } from '../store/game'
import { useAuthStore } from '../store/auth'

type HomeMode = 'normal' | 'ranked' | 'lobby'
type SubGameMode = 'normal' | 'special'

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const activeRoom = useGameStore((s) => s.room)
  const gameFinished = useGameStore((s) => s.gameFinished)
  const gameResult = useGameStore((s) => s.result)

  // If the player has an active game, determine what state they're in
  const hasActiveGame = activeRoom && (
    activeRoom.status === 'in_progress' || activeRoom.status === 'voting'
  )
  const hasUnacknowledgedResult = gameFinished && gameResult && activeRoom

  // Check if eliminated — they can browse but not start new games
  const user = useAuthStore((s) => s.user)
  const isEliminatedInActiveGame = hasActiveGame && activeRoom?.players?.some(
    (p) => p.userId === user?.id && (p.status === 'eliminated' || p.status === 'forfeited')
  )

  // Non-eliminated alive players or unacknowledged results → redirect
  useEffect(() => {
    if (hasActiveGame && !isEliminatedInActiveGame && activeRoom) {
      navigate(`/game/${activeRoom.code}`, { replace: true })
    } else if (hasUnacknowledgedResult && activeRoom) {
      navigate(`/results/${activeRoom.code}`, { replace: true })
    }
  }, [hasActiveGame, isEliminatedInActiveGame, hasUnacknowledgedResult, activeRoom, navigate])

  // Whether to block game creation/join buttons
  const isBlockedFromNewGame = hasActiveGame && isEliminatedInActiveGame

  const [selectedMode, setSelectedMode] = useState<HomeMode | null>(null)
  const [unrankedSubMode, setUnrankedSubMode] = useState<SubGameMode>('normal')
  const [lobbyGameMode, setSubGameMode] = useState<SubGameMode>('normal')
  const [categories, setCategories] = useState<WordCategory[]>([])
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchmaking, setMatchmaking] = useState(false)
  const [queueSize, setQueueSize] = useState(1)

  const hasCategories = selectedMode === 'normal' || selectedMode === 'lobby'
  const hasSubMode = selectedMode === 'normal' || selectedMode === 'lobby'

  useEffect(() => {
    if (!matchmaking) return
    connectSocket()
    const sock = getSocket() as any
    const handleStatus = (d: { queueSize: number; needed: number }) => setQueueSize(d.queueSize)
    const handleFound = (d: { roomCode: string }) => {
      setMatchmaking(false)
      navigate(`/lobby/${d.roomCode}`)
    }
    sock.on('matchmaking:status', handleStatus)
    sock.on('matchmaking:found', handleFound)
    return () => {
      sock.off('matchmaking:status', handleStatus)
      sock.off('matchmaking:found', handleFound)
    }
  }, [matchmaking])

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
      try {
        const room = await api.post<{ code: string }>('/rooms', {
          settings: { categories, isPrivate: true, language: i18n.language.split('-')[0] },
        })
        navigate(`/lobby/${room.code}?mode=${lobbyGameMode}`)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
      return
    }

    connectSocket()
    setQueueSize(1)
    setMatchmaking(true)
    // For unranked (selectedMode === 'normal'), use the sub-mode (normal/special)
    const actualGameMode = selectedMode === 'normal' ? unrankedSubMode : selectedMode
    getSocket().emit('matchmaking:join' as any, { gameMode: actualGameMode, categories })
  }

  const cancelMatchmaking = () => {
    setMatchmaking(false)
    getSocket().emit('matchmaking:leave' as any, { gameMode: selectedMode })
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomCode.trim() || isBlockedFromNewGame) return
    navigate(`/lobby/${roomCode.trim().toUpperCase()}`)
  }

  const MODES: { id: HomeMode; icon: string; labelKey: string; descKey: string; color: string; inactive: string }[] = [
    {
      id: 'normal',
      icon: '🎲',
      labelKey: 'home.normalLabel',
      descKey: 'home.normalDesc',
      color: 'border-brand-700/50 bg-brand-950/40 text-brand-400',
      inactive: 'border-neutral-800 hover:border-neutral-700',
    },
    {
      id: 'ranked',
      icon: '🏆',
      labelKey: 'home.rankedLabel',
      descKey: 'home.rankedDesc',
      color: 'border-amber-700/50 bg-amber-950/40 text-amber-400',
      inactive: 'border-neutral-800 hover:border-neutral-700',
    },
    {
      id: 'lobby',
      icon: '🚪',
      labelKey: 'home.lobbyLabel',
      descKey: 'home.lobbyDesc',
      color: 'border-violet-700/50 bg-violet-950/40 text-violet-400',
      inactive: 'border-neutral-800 hover:border-neutral-700',
    },
  ]

  const [showHowToPlay, setShowHowToPlay] = useState(false)

  const LOBBY_GAME_MODES: { id: SubGameMode; icon: string; labelKey: string; descKey: string }[] = [
    { id: 'normal',  icon: '🎭', labelKey: 'home.normalGameMode',  descKey: 'home.normalGameModeDesc' },
    { id: 'special', icon: '✨', labelKey: 'home.specialGameMode', descKey: 'home.specialGameModeDesc' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 flex flex-col items-center px-4 pt-16 pb-24 sm:pb-16">
        <div className="w-full max-w-lg animate-slide-up space-y-5">

          {/* Heading */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-600/30 bg-brand-600/10 text-brand-400 text-xs font-semibold mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-slow" />
              {t('home.tagline')}
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight mb-2">
              Play the <span className="text-brand-500">Imposter</span> Game
            </h1>
            <p className="text-neutral-400 text-base">{t('home.subtitle')}</p>
          </div>

          {/* Active game warning — shown to eliminated players who can browse but not start new games */}
          {isBlockedFromNewGame && activeRoom && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-950/40 border border-amber-800/40 animate-slide-up">
              <span className="text-amber-400 mt-0.5">⚠</span>
              <div className="flex-1">
                <p className="text-amber-400 text-sm font-semibold">{t('home.activeGameWarning', 'Game Still In Progress')}</p>
                <p className="text-amber-600 text-xs mt-0.5">{t('home.activeGameWarningDesc', 'You are still part of an active game. Wait for it to finish before starting a new one.')}</p>
              </div>
              <button
                onClick={() => navigate(`/game/${activeRoom.code}`)}
                className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                {t('home.returnToGame', 'Return')}
              </button>
            </div>
          )}

          {/* Quick Join */}
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              className="input-field flex-1 font-mono uppercase tracking-[0.25em] text-center text-lg h-12"
              placeholder={t('home.roomCodePlaceholder')}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={8}
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={roomCode.trim().length < 4 || !!isBlockedFromNewGame}
              className="h-12 px-6 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-sm transition-colors disabled:opacity-40 border border-neutral-700 whitespace-nowrap"
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
            <div className="grid grid-cols-3 gap-2.5">
              {MODES.map((mode) => {
                const active = selectedMode === mode.id
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setSelectedMode(active ? null : mode.id)
                      setCategories([])
                      setError(null)
                    }}
                    className={[
                      'flex flex-col items-center gap-1.5 p-4 rounded-2xl border transition-all duration-150 active:scale-[0.97]',
                      active ? mode.color : `bg-neutral-900 text-neutral-400 ${mode.inactive}`,
                    ].join(' ')}
                  >
                    <span className="text-2xl">{mode.icon}</span>
                    <span className="text-sm font-bold">{t(mode.labelKey)}</span>
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

              <div className="grid grid-cols-3 gap-1.5">
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
                          ? 'bg-brand-950/60 border-brand-700/50 text-brand-300'
                          : isAll
                            ? 'bg-neutral-800/40 border-neutral-700/30 text-neutral-400'
                            : 'bg-neutral-900/40 border-neutral-800/40 text-neutral-600',
                      ].join(' ')}
                    >
                      <span>{cat.icon}</span>
                      <span className="truncate">{cat.label}</span>
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
          {matchmaking && (
            <div className="card animate-slide-up space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin flex-shrink-0" />
                <div>
                  <p className="text-white font-semibold text-sm">{t('home.findingPlayers')}</p>
                  <p className="text-neutral-500 text-xs">
                    {t('home.inQueue', { count: queueSize })}
                  </p>
                </div>
              </div>
              <div className="w-full bg-neutral-800 rounded-full h-1.5">
                <div
                  className="bg-brand-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (queueSize / 4) * 100)}%` }}
                />
              </div>
              <button
                onClick={cancelMatchmaking}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white font-semibold text-sm transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          )}

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
                <>
                  {selectedMode === 'normal' && t('home.findGame')}
                  {selectedMode === 'ranked' && t('home.findRanked')}
                  {selectedMode === 'lobby' && t('home.createLobby')}
                </>
              )}
            </button>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-400 text-sm">
              <span>⚠</span> {error}
            </div>
          )}

        </div>

        {/* How to play button */}
        <button
          onClick={() => setShowHowToPlay(true)}
          className="mt-10 text-xs font-semibold uppercase tracking-widest text-neutral-600 hover:text-neutral-400 transition-colors flex items-center gap-1.5"
        >
          <span className="w-4 h-4 rounded-full border border-neutral-700 flex items-center justify-center text-[10px] font-bold">?</span>
          {t('home.howToPlay')}
        </button>

        {/* How to play modal */}
        {showHowToPlay && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowHowToPlay(false)}
          >
            <div
              className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden"
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
      </main>
    </div>
  )
}
