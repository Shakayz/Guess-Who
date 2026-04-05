import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { WORD_CATEGORIES, shuffleArray, OFFLINE_WORD_PAIRS, pickRandomWordPair } from '@imposter/shared'
import type { WordCategory } from '@imposter/shared'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'dealing' | 'playing' | 'results'

interface PlayerRole {
  name: string
  role: 'villager' | 'imposter'
  word: string
  isEliminated: boolean
}

interface VoteRecord {
  voterName: string
  targetName: string
}

// ─── Sub-component: Setup Phase ──────────────────────────────────────────────

interface SetupPhaseProps {
  onStart: (names: string[], imposterCount: number, categories: WordCategory[]) => void
}

function SetupPhase({ onStart }: SetupPhaseProps) {
  const { t } = useTranslation()
  const [names, setNames] = useState<string[]>(['', '', ''])
  const [imposterCount, setImposterCount] = useState(1)
  const [categories, setCategories] = useState<WordCategory[]>([])

  const filledCount = names.filter((n) => n.trim().length > 0).length
  const canStart = filledCount >= 3

  // Auto-adjust imposter count suggestion based on player count
  useEffect(() => {
    if (filledCount >= 6 && imposterCount < 2) {
      setImposterCount(2)
    } else if (filledCount < 6 && imposterCount > 1) {
      setImposterCount(1)
    }
  }, [filledCount])

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
    onStart(validNames, imposterCount, categories)
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="text-center">
        <div className="text-5xl mb-3">🎭</div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Offline Mode</h1>
        <p className="text-brand-400 font-semibold text-lg">Pass &amp; Play</p>
        <p className="text-neutral-500 text-sm mt-2">No internet required — play with friends in the same room</p>
      </div>

      {/* Player names */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          Players ({names.length}/20)
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
            + Add Player
          </button>
        )}
      </div>

      {/* Imposter count */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
          Number of Imposters
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
          {filledCount >= 6
            ? 'Recommended: 2 imposters for 6+ players'
            : 'Recommended: 1 imposter for under 6 players'}
        </p>
      </div>

      {/* Categories */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
            Word Categories
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setCategories(WORD_CATEGORIES.map((c) => c.key as WordCategory))}
              className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors"
            >
              All
            </button>
            <span className="text-neutral-700">·</span>
            <button
              onClick={() => setCategories([])}
              className="text-[11px] text-neutral-500 hover:text-neutral-400 transition-colors"
            >
              Random
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
          <p className="text-[10px] text-neutral-600">Random category each game</p>
        )}
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!canStart}
        className="w-full py-4 rounded-2xl font-bold text-lg text-white bg-brand-600 hover:bg-brand-500 shadow-2xl shadow-brand-600/25 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-600"
      >
        Start Game →
      </button>

      {!canStart && (
        <p className="text-center text-neutral-600 text-xs">
          Enter at least 3 player names to start
        </p>
      )}
    </div>
  )
}

// ─── Sub-component: Dealing Phase ────────────────────────────────────────────

interface DealingPhaseProps {
  players: PlayerRole[]
  onDone: () => void
}

function DealingPhase({ players, onDone }: DealingPhaseProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showingCard, setShowingCard] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const current = players[currentIndex]

  const handleReady = () => {
    setShowingCard(true)
    // Small delay then animate reveal
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

  const isImposter = current.role === 'imposter'

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
        /* Pass screen */
        <div className="text-center space-y-6 px-4">
          <div className="text-6xl">🤲</div>
          <div>
            <p className="text-neutral-400 text-lg mb-2">Pass the device to</p>
            <p className="text-3xl font-extrabold text-brand-400">{current.name}</p>
          </div>
          <p className="text-neutral-600 text-sm">
            Player {currentIndex + 1} of {players.length}
          </p>
          <button
            onClick={handleReady}
            className="px-10 py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-lg transition-all active:scale-[0.97] shadow-xl shadow-brand-600/20"
          >
            I'm Ready
          </button>
        </div>
      ) : (
        /* Card reveal */
        <div
          className={[
            'w-full max-w-sm mx-auto transition-all duration-500',
            revealed ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
          ].join(' ')}
        >
          <div
            className={[
              'rounded-3xl border-2 p-8 text-center space-y-6 shadow-2xl',
              isImposter
                ? 'bg-red-950/70 border-red-700/60 shadow-red-950/40'
                : 'bg-emerald-950/70 border-emerald-700/60 shadow-emerald-950/40',
            ].join(' ')}
          >
            {/* Role icon */}
            <div className="text-6xl">{isImposter ? '🔴' : '🟢'}</div>

            {/* Role label */}
            <div>
              <p className={['text-xs font-bold uppercase tracking-widest mb-1', isImposter ? 'text-red-500' : 'text-emerald-500'].join(' ')}>
                Your Role
              </p>
              <p className={['text-2xl font-extrabold', isImposter ? 'text-red-400' : 'text-emerald-400'].join(' ')}>
                {isImposter ? 'Imposter' : 'Villager'}
              </p>
            </div>

            {/* Word */}
            <div
              className={[
                'px-6 py-4 rounded-2xl border',
                isImposter
                  ? 'bg-red-900/30 border-red-800/40'
                  : 'bg-emerald-900/30 border-emerald-800/40',
              ].join(' ')}
            >
              <p className={['text-xs font-semibold uppercase tracking-widest mb-1', isImposter ? 'text-red-600' : 'text-emerald-600'].join(' ')}>
                Your Word
              </p>
              <p
                className={[
                  'text-3xl font-black tracking-tight',
                  isImposter
                    ? 'text-red-300 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                    : 'text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]',
                ].join(' ')}
              >
                {current.word}
              </p>
            </div>

            {/* Instruction */}
            <p className={['text-xs leading-relaxed', isImposter ? 'text-red-600/70' : 'text-emerald-600/70'].join(' ')}>
              {isImposter
                ? 'Blend in with the villagers. Don\'t reveal your true identity!'
                : 'Discuss the word. Find the imposter among you!'}
            </p>

            <button
              onClick={handleGotIt}
              className={[
                'w-full py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.97]',
                isImposter
                  ? 'bg-red-700 hover:bg-red-600 text-white shadow-lg shadow-red-950/40'
                  : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-950/40',
              ].join(' ')}
            >
              {currentIndex < players.length - 1 ? 'Got it! Pass to next player' : 'Got it! Start game'}
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
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Speaking Timer</p>

      <div className="flex items-center gap-4">
        {/* Circular countdown */}
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

        {/* Controls */}
        <div className="flex-1 space-y-2">
          {/* Duration selector */}
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

          {/* Start/Pause/Reset */}
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
              {running ? '⏸ Pause' : remaining === totalSeconds ? '▶ Start' : '▶ Resume'}
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
  const [voterIndex, setVoterIndex] = useState(0)
  const [step, setStep] = useState<VoteStep>('pass')
  const [votes, setVotes] = useState<VoteRecord[]>([])

  const voter = alivePlayers[voterIndex]

  const castVote = (targetName: string) => {
    const newVotes = [...votes, { voterName: voter.name, targetName }]
    const nextIndex = voterIndex + 1

    if (nextIndex >= alivePlayers.length) {
      // Tally
      const tally: Record<string, number> = {}
      for (const v of newVotes) {
        tally[v.targetName] = (tally[v.targetName] ?? 0) + 1
      }
      const maxVotes = Math.max(...Object.values(tally))
      const topCandidates = Object.entries(tally).filter(([, c]) => c === maxVotes).map(([n]) => n)
      // Tie → no elimination
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
          Vote {voterIndex + 1} of {alivePlayers.length}
        </p>
        <h2 className="text-xl font-extrabold text-white">Voting Phase</h2>
      </div>

      {step === 'pass' ? (
        <div className="text-center space-y-5 py-6">
          <div className="text-5xl">🤲</div>
          <div>
            <p className="text-neutral-400 text-base mb-2">Pass the device to</p>
            <p className="text-2xl font-extrabold text-brand-400">{voter.name}</p>
          </div>
          <button
            onClick={() => setStep('voting')}
            className="px-8 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all active:scale-[0.97]"
          >
            I'm Ready to Vote
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
              {voter.name}, who is the imposter?
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
                  <span className="ml-auto text-neutral-500 text-xs">Vote →</span>
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
        Cancel Vote
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
  const tally: Record<string, number> = {}
  for (const v of votes) {
    tally[v.targetName] = (tally[v.targetName] ?? 0) + 1
  }
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="text-center space-y-2">
        <div className="text-4xl">{eliminated ? '🗳️' : '🤷'}</div>
        <h2 className="text-xl font-extrabold text-white">
          {eliminated ? `${eliminated.name} was eliminated!` : 'No one was eliminated — it\'s a tie!'}
        </h2>
        {eliminated && (
          <p className={['text-sm font-semibold', eliminated.role === 'imposter' ? 'text-red-400' : 'text-emerald-400'].join(' ')}>
            They were a {eliminated.role === 'imposter' ? '🔴 Imposter' : '🟢 Villager'}
          </p>
        )}
      </div>

      {/* Vote tally */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Vote Tally</p>
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
        Continue Game
      </button>
    </div>
  )
}

// ─── Sub-component: Playing Phase ────────────────────────────────────────────

interface PlayingPhaseProps {
  players: PlayerRole[]
  wordPair: { villagerWord: string; imposterWord: string }
  onRevealRoles: (updatedPlayers: PlayerRole[]) => void
}

type PlayingSubPhase = 'main' | 'voting' | 'voteResult'

function PlayingPhase({ players: initialPlayers, wordPair, onRevealRoles }: PlayingPhaseProps) {
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
          Game in Progress
        </div>
        <h2 className="text-2xl font-extrabold text-white">
          {alivePlayers.length} player{alivePlayers.length !== 1 ? 's' : ''} alive
        </h2>
      </div>

      {/* Speaking timer */}
      <SpeakingTimer defaultSeconds={30} />

      {/* Players list */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Players</p>
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
              <span className="ml-auto text-xs text-neutral-600 font-semibold">Eliminated</span>
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
            🗳️ Start Vote
          </button>
        )}
        <button
          onClick={() => onRevealRoles(players)}
          className="w-full py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/60 text-white font-bold text-base transition-all active:scale-[0.98]"
        >
          🎭 Reveal Roles &amp; End Game
        </button>
      </div>

      {eliminatedPlayers.length > 0 && (
        <p className="text-center text-neutral-600 text-xs">
          {eliminatedPlayers.length} player{eliminatedPlayers.length !== 1 ? 's' : ''} eliminated
        </p>
      )}
    </div>
  )
}

// ─── Sub-component: Results Phase ────────────────────────────────────────────

interface ResultsPhaseProps {
  players: PlayerRole[]
  wordPair: { villagerWord: string; imposterWord: string }
  onPlayAgain: () => void
  onHome: () => void
}

function ResultsPhase({ players, wordPair, onPlayAgain, onHome }: ResultsPhaseProps) {
  const imposters = players.filter((p) => p.role === 'imposter')
  const villagers = players.filter((p) => p.role === 'villager')
  const eliminatedImposters = imposters.filter((p) => p.isEliminated)
  const impostersWon = eliminatedImposters.length < imposters.length

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="text-6xl">🎭</div>
        <h1 className="text-3xl font-extrabold text-white">Game Over</h1>
        <div className={[
          'inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold',
          impostersWon
            ? 'bg-red-950/60 border-red-700/50 text-red-400'
            : 'bg-emerald-950/60 border-emerald-700/50 text-emerald-400',
        ].join(' ')}>
          {impostersWon ? '🔴 Imposters Win!' : '🟢 Villagers Win!'}
        </div>
      </div>

      {/* Words revealed */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">The Words</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/30">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Villager Word</p>
            <p className="text-lg font-extrabold text-emerald-300">{wordPair.villagerWord}</p>
          </div>
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/30">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1">Imposter Word</p>
            <p className="text-lg font-extrabold text-red-300">{wordPair.imposterWord}</p>
          </div>
        </div>
      </div>

      {/* All players with roles */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">All Roles</p>
        {players.map((p) => (
          <div
            key={p.name}
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-xl border',
              p.role === 'imposter'
                ? 'bg-red-950/30 border-red-800/30'
                : 'bg-emerald-950/20 border-emerald-800/20',
            ].join(' ')}
          >
            <span className="text-xl">{p.role === 'imposter' ? '🔴' : '🟢'}</span>
            <div className="flex-1 min-w-0">
              <p className={['font-semibold text-sm', p.isEliminated ? 'line-through opacity-60' : ''].join(' ')}>
                {p.name}
              </p>
              <p className={['text-xs', p.role === 'imposter' ? 'text-red-500' : 'text-emerald-600'].join(' ')}>
                {p.role === 'imposter' ? 'Imposter' : 'Villager'} · {p.word}
              </p>
            </div>
            {p.isEliminated && (
              <span className="text-[10px] font-bold uppercase text-neutral-600 bg-neutral-800 px-2 py-0.5 rounded-full">
                Out
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <button
          onClick={onPlayAgain}
          className="w-full py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-lg transition-all active:scale-[0.98] shadow-xl shadow-brand-600/20"
        >
          Play Again
        </button>
        <button
          onClick={onHome}
          className="w-full py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/60 text-neutral-300 hover:text-white font-bold text-base transition-all active:scale-[0.98]"
        >
          Home
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
  const [wordPair, setWordPair] = useState<{ villagerWord: string; imposterWord: string }>({
    villagerWord: '',
    imposterWord: '',
  })

  const handleStart = useCallback(
    (names: string[], imposterCount: number, categories: WordCategory[]) => {
      const pair = pickRandomWordPair(categories, shuffleArray)
      const playerOrder = shuffleArray([...names])
      const roles: PlayerRole[] = playerOrder.map((name, i) => ({
        name,
        role: i < imposterCount ? 'imposter' : 'villager',
        word: i < imposterCount ? pair.imposterWord : pair.villagerWord,
        isEliminated: false,
      }))
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
          <p className="text-white font-bold text-sm">Offline Mode</p>
          <p className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">
            {phase === 'setup' && 'Setup'}
            {phase === 'dealing' && 'Dealing Cards'}
            {phase === 'playing' && 'Playing'}
            {phase === 'results' && 'Results'}
          </p>
        </div>
        <div className="w-9" />
      </div>

      {/* Content */}
      <main className="px-4 py-6 pb-24 max-w-lg mx-auto">
        {phase === 'setup' && (
          <SetupPhase onStart={handleStart} />
        )}
        {phase === 'dealing' && (
          <DealingPhase players={players} onDone={handleDealingDone} />
        )}
        {phase === 'playing' && (
          <PlayingPhase
            players={players}
            wordPair={wordPair}
            onRevealRoles={handleRevealRoles}
          />
        )}
        {phase === 'results' && (
          <ResultsPhase
            players={players}
            wordPair={wordPair}
            onPlayAgain={handlePlayAgain}
            onHome={handleHome}
          />
        )}
      </main>
    </div>
  )
}
