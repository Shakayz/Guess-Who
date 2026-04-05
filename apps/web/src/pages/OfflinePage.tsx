import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { WORD_CATEGORIES, shuffleArray, OFFLINE_WORD_PAIRS, pickRandomWordPair } from '@imposter/shared'
import type { WordCategory } from '@imposter/shared'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'dealing' | 'playing' | 'results'
type GameMode = 'normal' | 'special'
type PlayerRoleType = 'villager' | 'imposter' | 'detective' | 'doubleAgent'

interface PlayerRole {
  name: string
  role: PlayerRoleType
  word: string
  isEliminated: boolean
}

interface VoteRecord {
  voterName: string
  targetName: string
}

interface GameSettings {
  names: string[]
  imposterCount: number
  detectiveCount: number
  doubleAgentCount: number
  categories: WordCategory[]
  gameMode: GameMode
}

// ─── Role helpers ────────────────────────────────────────────────────────────

function getRoleConfig(t: (key: string) => string): Record<PlayerRoleType, { label: string; icon: string; color: string; bgClass: string; borderClass: string; textClass: string; badgeClass: string }> {
  return {
    villager:    { label: t('offline.villager'),     icon: '🟢', color: 'emerald', bgClass: 'bg-emerald-950/70', borderClass: 'border-emerald-700/60', textClass: 'text-emerald-400', badgeClass: 'text-emerald-500' },
    imposter:    { label: t('offline.imposter'),     icon: '🔴', color: 'red',     bgClass: 'bg-red-950/70',     borderClass: 'border-red-700/60',     textClass: 'text-red-400',     badgeClass: 'text-red-500' },
    detective:   { label: t('offline.detective'),    icon: '🔍', color: 'blue',    bgClass: 'bg-blue-950/70',    borderClass: 'border-blue-700/60',    textClass: 'text-blue-400',    badgeClass: 'text-blue-500' },
    doubleAgent: { label: t('offline.doubleAgent'),  icon: '🕵️', color: 'amber',   bgClass: 'bg-amber-950/70',   borderClass: 'border-amber-700/60',   textClass: 'text-amber-400',   badgeClass: 'text-amber-500' },
  }
}

function isEvilRole(role: PlayerRoleType) {
  return role === 'imposter' || role === 'doubleAgent'
}

// ─── Sub-component: Setup Phase ──────────────────────────────────────────────

interface SetupPhaseProps {
  initialSettings: GameSettings | null
  onStart: (names: string[], imposterCount: number, detectiveCount: number, doubleAgentCount: number, categories: WordCategory[], gameMode: GameMode) => void
}

function SetupPhase({ initialSettings, onStart }: SetupPhaseProps) {
  const { t } = useTranslation()
  const [names, setNames] = useState<string[]>(initialSettings?.names ?? ['', '', ''])
  const [imposterCount, setImposterCount] = useState(initialSettings?.imposterCount ?? 1)
  const [detectiveCount, setDetectiveCount] = useState(initialSettings?.detectiveCount ?? 1)
  const [doubleAgentCount, setDoubleAgentCount] = useState(initialSettings?.doubleAgentCount ?? 0)
  const [categories, setCategories] = useState<WordCategory[]>(initialSettings?.categories ?? [])
  const [gameMode, setGameMode] = useState<GameMode>(initialSettings?.gameMode ?? 'normal')

  const filledCount = names.filter((n) => n.trim().length > 0).length
  const canStart = filledCount >= 3

  // Auto-adjust imposter count suggestion based on player count (only if no initial settings)
  useEffect(() => {
    if (initialSettings) return
    if (filledCount >= 6 && imposterCount < 2) {
      setImposterCount(2)
    } else if (filledCount < 6 && imposterCount > 1) {
      setImposterCount(1)
    }
  }, [filledCount])

  // Auto-adjust double agent availability based on player count
  useEffect(() => {
    if (initialSettings) return
    if (filledCount >= 6 && doubleAgentCount === 0 && gameMode === 'special') {
      setDoubleAgentCount(1)
    } else if (filledCount < 6 && doubleAgentCount > 0) {
      setDoubleAgentCount(0)
    }
  }, [filledCount, gameMode])

  const addPlayer = () => {
    if (names.length < 20) setNames((prev) => [...prev, ''])
  }

  const removePlayer = (i: number) => {
    if (names.length <= 3) return
    setNames((prev) => prev.filter((_, idx) => idx !== i))
  }

  const updateName = (i: number, val: string) => {
    setNames((prev) => prev.map((n, idx) => (idx === i ? val : n)))
  }

  const toggleCategory = (key: WordCategory) => {
    setCategories((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    )
  }

  const handleStart = () => {
    const validNames = names.map((n) => n.trim()).filter((n) => n.length > 0)
    if (validNames.length < 3) return
    onStart(validNames, imposterCount, gameMode === 'special' ? detectiveCount : 0, gameMode === 'special' ? doubleAgentCount : 0, categories, gameMode)
  }

  // Max special roles based on player count
  const maxSpecialTotal = Math.max(0, filledCount - imposterCount - 1) // at least 1 villager
  const maxDetectives = Math.min(3, maxSpecialTotal)
  const maxDoubleAgents = Math.min(2, Math.max(0, maxSpecialTotal - detectiveCount))

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="text-center">
        <div className="text-5xl mb-3">🎭</div>
        <h1 className="text-3xl font-extrabold text-white mb-1">{t('offline.title')}</h1>
        <p className="text-brand-400 font-semibold text-lg">{t('offline.passAndPlay')}</p>
        <p className="text-neutral-500 text-sm mt-2">{t('offline.noInternet')}</p>
      </div>

      {/* Game mode selector */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          {t('offline.gameMode')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setGameMode('normal')}
            className={[
              'flex flex-col items-center gap-1.5 px-4 py-3.5 rounded-xl border-2 transition-all',
              gameMode === 'normal'
                ? 'bg-brand-950/60 border-brand-600/60 shadow-lg shadow-brand-950/30'
                : 'bg-neutral-800/40 border-neutral-700/40 hover:border-neutral-600/60',
            ].join(' ')}
          >
            <span className="text-2xl">🎲</span>
            <span className={['text-sm font-bold', gameMode === 'normal' ? 'text-brand-400' : 'text-neutral-400'].join(' ')}>
              {t('offline.normal')}
            </span>
            <span className={['text-[10px] leading-tight text-center', gameMode === 'normal' ? 'text-brand-500/70' : 'text-neutral-600'].join(' ')}>
              {t('offline.normalDesc')}
            </span>
          </button>
          <button
            onClick={() => setGameMode('special')}
            className={[
              'flex flex-col items-center gap-1.5 px-4 py-3.5 rounded-xl border-2 transition-all',
              gameMode === 'special'
                ? 'bg-amber-950/60 border-amber-600/60 shadow-lg shadow-amber-950/30'
                : 'bg-neutral-800/40 border-neutral-700/40 hover:border-neutral-600/60',
            ].join(' ')}
          >
            <span className="text-2xl">⚡</span>
            <span className={['text-sm font-bold', gameMode === 'special' ? 'text-amber-400' : 'text-neutral-400'].join(' ')}>
              {t('offline.special')}
            </span>
            <span className={['text-[10px] leading-tight text-center', gameMode === 'special' ? 'text-amber-500/70' : 'text-neutral-600'].join(' ')}>
              {t('offline.specialDesc')}
            </span>
          </button>
        </div>
        {gameMode === 'special' && (
          <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span>🔍</span>
              <span className="text-blue-400 font-semibold">{t('offline.detective')}</span>
              <span className="text-neutral-500">— {t('offline.detectiveInfo')}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span>🕵️</span>
              <span className="text-amber-400 font-semibold">{t('offline.doubleAgent')}</span>
              <span className="text-neutral-500">— {t('offline.doubleAgentInfo')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Player names */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          {t('offline.players')} ({names.length}/20)
        </p>
        <div className="space-y-2">
          {names.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-neutral-600 text-sm w-5 text-right shrink-0">{i + 1}.</span>
              <input
                className="flex-1 bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600/50 transition-all"
                placeholder={`Player ${i + 1}`}
                value={name}
                onChange={(e) => updateName(i, e.target.value)}
                maxLength={24}
              />
              {names.length > 3 && (
                <button
                  onClick={() => removePlayer(i)}
                  className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-red-900/40 hover:text-red-400 text-neutral-500 flex items-center justify-center transition-colors text-sm font-bold shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {names.length < 20 && (
          <button
            onClick={addPlayer}
            className="w-full py-2 rounded-xl border border-dashed border-neutral-700 text-neutral-500 hover:border-brand-700/50 hover:text-brand-400 text-sm font-semibold transition-all"
          >
            {t('offline.addPlayer')}
          </button>
        )}
      </div>

      {/* Imposter count */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
          {t('offline.imposterCount')}
        </p>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setImposterCount(n)}
              className={[
                'flex-1 py-3 rounded-xl border font-bold text-lg transition-all',
                imposterCount === n
                  ? 'bg-red-950/60 border-red-700/60 text-red-400 shadow-md shadow-red-950/30'
                  : 'bg-neutral-800/60 border-neutral-700/40 text-neutral-400 hover:border-neutral-600/60 hover:text-neutral-300',
              ].join(' ')}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-neutral-600 mt-2">
          {filledCount >= 6 ? t('offline.recommendHigh') : t('offline.recommendLow')}
        </p>
      </div>

      {/* Special role counts */}
      {gameMode === 'special' && (
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-4">
          {/* Detective count */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
              🔍 {t('offline.detectiveCount')}
            </p>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => { if (n <= maxDetectives) setDetectiveCount(n) }}
                  className={[
                    'flex-1 py-3 rounded-xl border font-bold text-lg transition-all',
                    n > maxDetectives ? 'opacity-30 cursor-not-allowed bg-neutral-900 border-neutral-800 text-neutral-600' :
                    detectiveCount === n
                      ? 'bg-blue-950/60 border-blue-700/60 text-blue-400 shadow-md shadow-blue-950/30'
                      : 'bg-neutral-800/60 border-neutral-700/40 text-neutral-400 hover:border-neutral-600/60 hover:text-neutral-300',
                  ].join(' ')}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Double Agent count */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
              🕵️ {t('offline.doubleAgentCount')}
            </p>
            <div className="flex gap-2">
              {[0, 1, 2].map((n) => (
                <button
                  key={n}
                  onClick={() => { if (n <= maxDoubleAgents) setDoubleAgentCount(n) }}
                  className={[
                    'flex-1 py-3 rounded-xl border font-bold text-lg transition-all',
                    n > maxDoubleAgents ? 'opacity-30 cursor-not-allowed bg-neutral-900 border-neutral-800 text-neutral-600' :
                    doubleAgentCount === n
                      ? 'bg-amber-950/60 border-amber-700/60 text-amber-400 shadow-md shadow-amber-950/30'
                      : 'bg-neutral-800/60 border-neutral-700/40 text-neutral-400 hover:border-neutral-600/60 hover:text-neutral-300',
                  ].join(' ')}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
            {t('offline.wordCategories')}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setCategories(WORD_CATEGORIES.map((c) => c.key as WordCategory))}
              className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors"
            >
              {t('offline.all')}
            </button>
            <span className="text-neutral-700">·</span>
            <button
              onClick={() => setCategories([])}
              className="text-[11px] text-neutral-500 hover:text-neutral-400 transition-colors"
            >
              {t('offline.random')}
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
                    ? 'bg-brand-950/60 border-brand-700/50 text-brand-300 ring-1 ring-brand-700/20'
                    : isAll
                      ? 'bg-neutral-800/40 border-neutral-700/30 text-neutral-400 hover:border-neutral-600/50'
                      : 'bg-neutral-900/40 border-neutral-800/40 text-neutral-600 hover:border-neutral-700/50',
              ].join(' ')}
              >
                <span>{cat.icon}</span>
                <span className="truncate">{t(`home.cat.${cat.key}`, cat.label)}</span>
              </button>
            )
          })}
        </div>
        {categories.length === 0 && (
          <p className="text-[10px] text-neutral-600">{t('offline.randomHint')}</p>
        )}
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!canStart}
        className="w-full py-4 rounded-2xl font-bold text-lg text-white bg-brand-600 hover:bg-brand-500 shadow-2xl shadow-brand-600/25 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-600"
      >
        {t('offline.startGame')}
      </button>

      {!canStart && (
        <p className="text-center text-neutral-600 text-xs">
          {t('offline.needPlayers')}
        </p>
      )}
    </div>
  )
}

// ─── Sub-component: Dealing Phase ────────────────────────────────────────────

interface DealingPhaseProps {
  players: PlayerRole[]
  gameMode: GameMode
  onDone: () => void
}

function DealingPhase({ players, gameMode, onDone }: DealingPhaseProps) {
  const { t } = useTranslation()
  const ROLES = getRoleConfig(t)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showingCard, setShowingCard] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const current = players[currentIndex]
  const rc = ROLES[current.role]

  const handleReady = () => {
    setShowingCard(true)
    setTimeout(() => setRevealed(true), 50)
  }

  const handleGotIt = () => {
    setShowingCard(false)
    setRevealed(false)
    const next = currentIndex + 1
    if (next >= players.length) {
      onDone()
    } else {
      setCurrentIndex(next)
    }
  }

  const getRoleInstruction = (role: PlayerRoleType) => {
    switch (role) {
      case 'imposter': return t('offline.roleInstructionImposter')
      case 'villager': return t('offline.roleInstructionVillager')
      case 'detective': return t('offline.roleInstructionDetective')
      case 'doubleAgent': return t('offline.roleInstructionDoubleAgent')
    }
  }

  // Determine card color classes
  const cardBg = rc.bgClass
  const cardBorder = rc.borderClass
  const cardShadow = `shadow-${rc.color}-950/40`
  const wordBg = `bg-${rc.color}-900/30`
  const wordBorder = `border-${rc.color}-800/40`
  const wordLabelColor = `text-${rc.color}-600`
  const wordValueColor = `text-${rc.color}-300`
  const wordGlow = rc.color === 'emerald' ? 'drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]'
    : rc.color === 'red' ? 'drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]'
    : rc.color === 'blue' ? 'drop-shadow-[0_0_12px_rgba(96,165,250,0.5)]'
    : 'drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]'
  const btnBg = rc.color === 'emerald' ? 'bg-emerald-700 hover:bg-emerald-600'
    : rc.color === 'red' ? 'bg-red-700 hover:bg-red-600'
    : rc.color === 'blue' ? 'bg-blue-700 hover:bg-blue-600'
    : 'bg-amber-700 hover:bg-amber-600'
  const btnShadow = `shadow-${rc.color}-950/40`
  const instructionColor = `text-${rc.color}-600/70`

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-slide-up">
      {/* Progress dots */}
      <div className="flex gap-1.5">
        {players.map((_, i) => (
          <div
            key={i}
            className={[
              'w-2 h-2 rounded-full transition-all',
              i < currentIndex
                ? 'bg-brand-500'
                : i === currentIndex
                  ? 'bg-brand-400 scale-125'
                  : 'bg-neutral-700',
            ].join(' ')}
          />
        ))}
      </div>

      {!showingCard ? (
        <div className="text-center space-y-6 px-4">
          <div className="text-6xl">🤲</div>
          <div>
            <p className="text-neutral-400 text-lg mb-2">{t('offline.passDevice')}</p>
            <p className="text-3xl font-extrabold text-brand-400">{current.name}</p>
          </div>
          <p className="text-neutral-600 text-sm">
            {t('offline.playerOf', { current: currentIndex + 1, total: players.length })}
          </p>
          <button
            onClick={handleReady}
            className="px-10 py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-lg transition-all active:scale-[0.97] shadow-xl shadow-brand-600/20"
          >
            {t('offline.imReady')}
          </button>
        </div>
      ) : (
        <div
          className={[
            'w-full max-w-sm mx-auto transition-all duration-500',
            revealed ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
          ].join(' ')}
        >
          <div className={`rounded-3xl border-2 p-8 text-center space-y-6 shadow-2xl ${cardBg} ${cardBorder} ${cardShadow}`}>
            <div className="text-6xl">{rc.icon}</div>

            <div>
              <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${rc.badgeClass}`}>
                {t('offline.yourRole')}
              </p>
              <p className={`text-2xl font-extrabold ${rc.textClass}`}>
                {rc.label}
              </p>
            </div>

            <div className={`px-6 py-4 rounded-2xl border ${wordBg} ${wordBorder}`}>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${wordLabelColor}`}>
                {t('offline.yourWord')}
              </p>
              <p className={`text-3xl font-black tracking-tight ${wordValueColor} ${wordGlow}`}>
                {current.word}
              </p>
            </div>

            {current.role === 'detective' && (
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl px-4 py-2.5 text-xs text-blue-400/80 font-medium">
                {t('offline.detectiveTip')}
              </div>
            )}

            {current.role === 'doubleAgent' && (
              <div className="bg-amber-900/20 border border-amber-800/30 rounded-xl px-4 py-2.5 text-xs text-amber-400/80 font-medium">
                {t('offline.doubleAgentTip')}
              </div>
            )}

            <p className={`text-xs leading-relaxed ${instructionColor}`}>
              {getRoleInstruction(current.role)}
            </p>

            <button
              onClick={handleGotIt}
              className={`w-full py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.97] ${btnBg} text-white shadow-lg ${btnShadow}`}
            >
              {currentIndex < players.length - 1 ? t('offline.gotItPass') : t('offline.gotItStart')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-component: Speaking Timer ───────────────────────────────────────────

interface SpeakingTimerProps {
  defaultSeconds?: number
}

function SpeakingTimer({ defaultSeconds = 30 }: SpeakingTimerProps) {
  const { t } = useTranslation()
  const [totalSeconds, setTotalSeconds] = useState(defaultSeconds)
  const [remaining, setRemaining] = useState(defaultSeconds)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pct = remaining / totalSeconds
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - pct)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            return 0
          }
          return r - 1
        })
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  const handleReset = () => {
    setRunning(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRemaining(totalSeconds)
  }

  const colorClass = pct > 0.5 ? 'stroke-brand-500' : pct > 0.25 ? 'stroke-amber-500' : 'stroke-red-500'

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">{t('offline.speakingTimer')}</p>

      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-neutral-800"
            />
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`transition-all duration-1000 ${colorClass}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-extrabold text-white tabular-nums">{remaining}</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex gap-1.5">
            {[15, 30, 45, 60].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setTotalSeconds(s)
                  setRemaining(s)
                  setRunning(false)
                  if (intervalRef.current) clearInterval(intervalRef.current)
                }}
                className={[
                  'flex-1 py-1 rounded-lg text-xs font-bold transition-all border',
                  totalSeconds === s
                    ? 'bg-brand-950/60 border-brand-700/50 text-brand-400'
                    : 'bg-neutral-800/60 border-neutral-700/40 text-neutral-500 hover:text-neutral-300',
                ].join(' ')}
              >
                {s}s
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setRunning((r) => !r)}
              disabled={remaining === 0}
              className={[
                'flex-1 py-2 rounded-xl font-bold text-sm transition-all border disabled:opacity-40',
                running
                  ? 'bg-amber-900/40 border-amber-700/40 text-amber-400 hover:bg-amber-900/60'
                  : 'bg-brand-600 hover:bg-brand-500 border-transparent text-white',
              ].join(' ')}
            >
              {running ? `⏸ ${t('offline.pause')}` : remaining === totalSeconds ? `▶ ${t('offline.start')}` : `▶ ${t('offline.resume')}`}
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/60 text-neutral-400 hover:text-white text-sm font-bold transition-all"
            >
              ↺
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-component: Vote Phase (pass-and-play voting) ─────────────────────────

interface VotePhaseProps {
  alivePlayers: PlayerRole[]
  onVotesDone: (votes: VoteRecord[], eliminated: PlayerRole | null) => void
  onCancel: () => void
}

type VoteStep = 'pass' | 'voting'

function VotePhase({ alivePlayers, onVotesDone, onCancel }: VotePhaseProps) {
  const { t } = useTranslation()
  const [voterIndex, setVoterIndex] = useState(0)
  const [step, setStep] = useState<VoteStep>('pass')
  const [votes, setVotes] = useState<VoteRecord[]>([])

  const voter = alivePlayers[voterIndex]

  const castVote = (targetName: string) => {
    const newVotes = [...votes, { voterName: voter.name, targetName }]
    const nextIndex = voterIndex + 1

    if (nextIndex >= alivePlayers.length) {
      const tally: Record<string, number> = {}
      for (const v of newVotes) {
        tally[v.targetName] = (tally[v.targetName] ?? 0) + 1
      }
      const maxVotes = Math.max(...Object.values(tally))
      const topCandidates = Object.entries(tally).filter(([, c]) => c === maxVotes).map(([n]) => n)
      if (topCandidates.length > 1) {
        onVotesDone(newVotes, null)
      } else {
        const eliminated = alivePlayers.find((p) => p.name === topCandidates[0]) ?? null
        onVotesDone(newVotes, eliminated)
      }
    } else {
      setVotes(newVotes)
      setVoterIndex(nextIndex)
      setStep('pass')
    }
  }

  const otherPlayers = alivePlayers.filter((p) => p.name !== voter.name)

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="text-center">
        <p className="text-neutral-400 text-sm mb-1">
          {t('offline.voteOf', { current: voterIndex + 1, total: alivePlayers.length })}
        </p>
        <h2 className="text-xl font-extrabold text-white">{t('offline.votingPhase')}</h2>
      </div>

      {step === 'pass' ? (
        <div className="text-center space-y-5 py-6">
          <div className="text-5xl">🤲</div>
          <div>
            <p className="text-neutral-400 text-base mb-2">{t('offline.passDevice')}</p>
            <p className="text-2xl font-extrabold text-brand-400">{voter.name}</p>
          </div>
          <button
            onClick={() => setStep('voting')}
            className="px-8 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all active:scale-[0.97]"
          >
            {t('offline.imReadyToVote')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
              {t('offline.whoIsImposter', { name: voter.name })}
            </p>
            <div className="space-y-2">
              {otherPlayers.map((p) => (
                <button
                  key={p.name}
                  onClick={() => castVote(p.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700/40 hover:border-neutral-600/60 text-white text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  <span className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-base shrink-0">
                    {p.name[0].toUpperCase()}
                  </span>
                  {p.name}
                  <span className="ml-auto text-neutral-500 text-xs">{t('offline.voteArrow')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onCancel}
        className="w-full py-2.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700/40 text-neutral-500 hover:text-neutral-300 text-sm font-semibold transition-all"
      >
        {t('offline.cancelVote')}
      </button>
    </div>
  )
}

// ─── Sub-component: Vote Result ───────────────────────────────────────────────

interface VoteResultProps {
  votes: VoteRecord[]
  eliminated: PlayerRole | null
  onContinue: () => void
}

function VoteResult({ votes, eliminated, onContinue }: VoteResultProps) {
  const { t } = useTranslation()
  const ROLES = getRoleConfig(t)
  const tally: Record<string, number> = {}
  for (const v of votes) {
    tally[v.targetName] = (tally[v.targetName] ?? 0) + 1
  }
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])

  const eliminatedRc = eliminated ? ROLES[eliminated.role] : null

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="text-center space-y-2">
        <div className="text-4xl">{eliminated ? '🗳️' : '🤷'}</div>
        <h2 className="text-xl font-extrabold text-white">
          {eliminated ? t('offline.wasEliminated', { name: eliminated.name }) : t('offline.noOneEliminated')}
        </h2>
        {eliminated && eliminatedRc && (
          <p className={`text-sm font-semibold ${eliminatedRc.textClass}`}>
            {t('offline.theyWere')} {eliminatedRc.icon} {eliminatedRc.label}
          </p>
        )}
      </div>

      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">{t('offline.voteTally')}</p>
        {sorted.map(([name, count]) => (
          <div key={name} className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white w-28 truncate">{name}</span>
            <div className="flex-1 bg-neutral-800 rounded-full h-2">
              <div
                className={[
                  'h-2 rounded-full transition-all',
                  eliminated?.name === name ? 'bg-red-500' : 'bg-neutral-600',
                ].join(' ')}
                style={{ width: `${(count / votes.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-neutral-400 w-6 text-right">{count}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onContinue}
        className="w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all active:scale-[0.97]"
      >
        {t('offline.continueGame')}
      </button>
    </div>
  )
}

// ─── Sub-component: Playing Phase ────────────────────────────────────────────

interface PlayingPhaseProps {
  players: PlayerRole[]
  gameMode: GameMode
  wordPair: { villagerWord: string; imposterWord: string }
  onRevealRoles: (updatedPlayers: PlayerRole[]) => void
}

type PlayingSubPhase = 'main' | 'voting' | 'voteResult'

function PlayingPhase({ players: initialPlayers, gameMode, wordPair, onRevealRoles }: PlayingPhaseProps) {
  const { t } = useTranslation()
  const ROLES = getRoleConfig(t)
  const [players, setPlayers] = useState<PlayerRole[]>(initialPlayers)
  const [subPhase, setSubPhase] = useState<PlayingSubPhase>('main')
  const [lastVotes, setLastVotes] = useState<VoteRecord[]>([])
  const [lastEliminated, setLastEliminated] = useState<PlayerRole | null>(null)

  const alivePlayers = players.filter((p) => !p.isEliminated)

  const handleVotesDone = (votes: VoteRecord[], eliminated: PlayerRole | null) => {
    setLastVotes(votes)
    setLastEliminated(eliminated)
    if (eliminated) {
      setPlayers((prev) =>
        prev.map((p) => (p.name === eliminated.name ? { ...p, isEliminated: true } : p)),
      )
    }
    setSubPhase('voteResult')
  }

  const handleContinueAfterVote = () => {
    setSubPhase('main')
  }

  if (subPhase === 'voting') {
    return (
      <VotePhase
        alivePlayers={alivePlayers}
        onVotesDone={handleVotesDone}
        onCancel={() => setSubPhase('main')}
      />
    )
  }

  if (subPhase === 'voteResult') {
    return (
      <VoteResult
        votes={lastVotes}
        eliminated={lastEliminated}
        onContinue={handleContinueAfterVote}
      />
    )
  }

  const eliminatedPlayers = players.filter((p) => p.isEliminated)

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-600/30 bg-brand-600/10 text-brand-400 text-xs font-semibold mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          {t('offline.gameInProgress')}
          {gameMode === 'special' && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold uppercase">{t('offline.special')}</span>
          )}
        </div>
        <h2 className="text-2xl font-extrabold text-white">
          {alivePlayers.length === 1
            ? t('offline.playerAlive', { count: 1 })
            : t('offline.playersAlive', { count: alivePlayers.length })}
        </h2>
      </div>

      {/* Speaking timer */}
      <SpeakingTimer defaultSeconds={30} />

      {/* Players list */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">{t('common.players')}</p>
        {players.map((p) => (
          <div
            key={p.name}
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-xl border',
              p.isEliminated
                ? 'bg-neutral-900/20 border-neutral-800/30 opacity-50'
                : 'bg-neutral-800/40 border-neutral-700/40',
            ].join(' ')}
          >
            <span className={[
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
              p.isEliminated ? 'bg-neutral-800 text-neutral-600' : 'bg-brand-900/40 text-brand-400',
            ].join(' ')}>
              {p.name[0].toUpperCase()}
            </span>
            <span className={['font-semibold text-sm', p.isEliminated ? 'text-neutral-600 line-through' : 'text-white'].join(' ')}>
              {p.name}
            </span>
            {p.isEliminated && (
              <span className="ml-auto text-xs text-neutral-600 font-semibold">{t('offline.eliminated')}</span>
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        {alivePlayers.length >= 3 && (
          <button
            onClick={() => setSubPhase('voting')}
            className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-base transition-all active:scale-[0.98] shadow-xl shadow-amber-600/20"
          >
            {t('offline.startVote')}
          </button>
        )}
        <button
          onClick={() => onRevealRoles(players)}
          className="w-full py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/60 text-white font-bold text-base transition-all active:scale-[0.98]"
        >
          {t('offline.revealRoles')}
        </button>
      </div>

      {eliminatedPlayers.length > 0 && (
        <p className="text-center text-neutral-600 text-xs">
          {t('offline.playersEliminated', { count: eliminatedPlayers.length })}
        </p>
      )}
    </div>
  )
}

// ─── Sub-component: Results Phase ────────────────────────────────────────────

interface ResultsPhaseProps {
  players: PlayerRole[]
  gameMode: GameMode
  wordPair: { villagerWord: string; imposterWord: string }
  onPlayAgain: () => void
  onHome: () => void
}

function ResultsPhase({ players, gameMode, wordPair, onPlayAgain, onHome }: ResultsPhaseProps) {
  const { t } = useTranslation()
  const ROLES = getRoleConfig(t)
  const imposters = players.filter((p) => p.role === 'imposter')
  const doubleAgents = players.filter((p) => p.role === 'doubleAgent')
  const evilTeam = [...imposters, ...doubleAgents]
  const eliminatedEvil = evilTeam.filter((p) => p.isEliminated)
  const impostersWon = eliminatedEvil.length < evilTeam.length

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="text-6xl">🎭</div>
        <h1 className="text-3xl font-extrabold text-white">{t('offline.gameOver')}</h1>
        <div className={[
          'inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold',
          impostersWon
            ? 'bg-red-950/60 border-red-700/50 text-red-400'
            : 'bg-emerald-950/60 border-emerald-700/50 text-emerald-400',
        ].join(' ')}>
          {impostersWon ? `🔴 ${t('offline.impostersWin')}` : `🟢 ${t('offline.villagersWin')}`}
        </div>
      </div>

      {/* Words revealed */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">{t('offline.theWords')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/30">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">{t('offline.villagerWord')}</p>
            <p className="text-lg font-extrabold text-emerald-300">{wordPair.villagerWord}</p>
          </div>
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/30">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1">{t('offline.imposterWord')}</p>
            <p className="text-lg font-extrabold text-red-300">{wordPair.imposterWord}</p>
          </div>
        </div>
      </div>

      {/* Role legend for special mode */}
      {gameMode === 'special' && (
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">{t('offline.roleLegend')}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2"><span>🟢</span><span className="text-emerald-400">{t('offline.villager')}</span></div>
            <div className="flex items-center gap-2"><span>🔴</span><span className="text-red-400">{t('offline.imposter')}</span></div>
            <div className="flex items-center gap-2"><span>🔍</span><span className="text-blue-400">{t('offline.detective')}</span></div>
            <div className="flex items-center gap-2"><span>🕵️</span><span className="text-amber-400">{t('offline.doubleAgent')}</span></div>
          </div>
        </div>
      )}

      {/* All players with roles */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">{t('offline.allRoles')}</p>
        {players.map((p) => {
          const rc = ROLES[p.role]
          const evil = isEvilRole(p.role)
          return (
            <div
              key={p.name}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border',
                evil
                  ? 'bg-red-950/30 border-red-800/30'
                  : p.role === 'detective'
                    ? 'bg-blue-950/20 border-blue-800/20'
                    : 'bg-emerald-950/20 border-emerald-800/20',
              ].join(' ')}
            >
              <span className="text-xl">{rc.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={['font-semibold text-sm', p.isEliminated ? 'line-through opacity-60' : ''].join(' ')}>
                  {p.name}
                </p>
                <p className={`text-xs ${rc.badgeClass}`}>
                  {rc.label} · {p.word}
                </p>
              </div>
              {p.isEliminated && (
                <span className="text-[10px] font-bold uppercase text-neutral-600 bg-neutral-800 px-2 py-0.5 rounded-full">
                  {t('offline.out')}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <button
          onClick={onPlayAgain}
          className="w-full py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-lg transition-all active:scale-[0.98] shadow-xl shadow-brand-600/20"
        >
          {t('offline.playAgain')}
        </button>
        <button
          onClick={onHome}
          className="w-full py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/60 text-neutral-300 hover:text-white font-bold text-base transition-all active:scale-[0.98]"
        >
          {t('offline.home')}
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OfflinePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [phase, setPhase] = useState<Phase>('setup')
  const [players, setPlayers] = useState<PlayerRole[]>([])
  const [gameMode, setGameMode] = useState<GameMode>('normal')
  const [wordPair, setWordPair] = useState<{ villagerWord: string; imposterWord: string }>({
    villagerWord: '',
    imposterWord: '',
  })
  // Persist settings across Play Again
  const [lastSettings, setLastSettings] = useState<GameSettings | null>(null)

  const handleStart = useCallback(
    (names: string[], imposterCount: number, detectiveCount: number, doubleAgentCount: number, categories: WordCategory[], mode: GameMode) => {
      // Save settings for Play Again
      setLastSettings({ names, imposterCount, detectiveCount, doubleAgentCount, categories, gameMode: mode })
      setGameMode(mode)

      const pair = pickRandomWordPair(categories, shuffleArray)
      const playerOrder = shuffleArray([...names])
      const totalPlayers = playerOrder.length

      let roles: PlayerRole[]

      if (mode === 'special' && (detectiveCount > 0 || doubleAgentCount > 0)) {
        // Special mode: assign detectives + double agents + imposters + villagers
        roles = playerOrder.map((name, i) => {
          let role: PlayerRoleType
          let word: string
          if (i < imposterCount) {
            role = 'imposter'
            word = pair.imposterWord
          } else if (i < imposterCount + detectiveCount) {
            role = 'detective'
            word = pair.villagerWord
          } else if (i < imposterCount + detectiveCount + doubleAgentCount) {
            role = 'doubleAgent'
            word = pair.villagerWord
          } else {
            role = 'villager'
            word = pair.villagerWord
          }
          return { name, role, word, isEliminated: false }
        })
      } else {
        // Normal mode
        roles = playerOrder.map((name, i) => ({
          name,
          role: (i < imposterCount ? 'imposter' : 'villager') as PlayerRoleType,
          word: i < imposterCount ? pair.imposterWord : pair.villagerWord,
          isEliminated: false,
        }))
      }

      const shuffledRoles = shuffleArray(roles)
      setWordPair(pair)
      setPlayers(shuffledRoles)
      setPhase('dealing')
    },
    [],
  )

  const handleDealingDone = useCallback(() => {
    setPhase('playing')
  }, [])

  const handleRevealRoles = useCallback((updatedPlayers: PlayerRole[]) => {
    setPlayers(updatedPlayers)
    setPhase('results')
  }, [])

  const handlePlayAgain = useCallback(() => {
    setPhase('setup')
    setPlayers([])
    setWordPair({ villagerWord: '', imposterWord: '' })
    // lastSettings is preserved so SetupPhase gets initial values
  }, [])

  const handleHome = useCallback(() => {
    navigate('/')
  }, [navigate])

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-neutral-800/60 bg-neutral-950/90 backdrop-blur">
        <button
          onClick={phase === 'setup' ? handleHome : handlePlayAgain}
          className="w-9 h-9 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700/40 flex items-center justify-center text-neutral-400 hover:text-white transition-all"
        >
          ←
        </button>
        <div className="text-center">
          <p className="text-white font-bold text-sm">{t('offline.title')}</p>
          <p className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">
            {phase === 'setup' && t('offline.setup')}
            {phase === 'dealing' && t('offline.dealingCards')}
            {phase === 'playing' && (gameMode === 'special' ? t('offline.specialMode') : t('offline.playing'))}
            {phase === 'results' && t('offline.results')}
          </p>
        </div>
        <div className="w-9" />
      </div>

      {/* Content */}
      <main className="px-4 py-6 pb-24 max-w-lg mx-auto">
        {phase === 'setup' && (
          <SetupPhase initialSettings={lastSettings} onStart={handleStart} />
        )}
        {phase === 'dealing' && (
          <DealingPhase players={players} gameMode={gameMode} onDone={handleDealingDone} />
        )}
        {phase === 'playing' && (
          <PlayingPhase
            players={players}
            gameMode={gameMode}
            wordPair={wordPair}
            onRevealRoles={handleRevealRoles}
          />
        )}
        {phase === 'results' && (
          <ResultsPhase
            players={players}
            gameMode={gameMode}
            wordPair={wordPair}
            onPlayAgain={handlePlayAgain}
            onHome={handleHome}
          />
        )}
      </main>
    </div>
  )
}
