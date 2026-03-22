import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { NavBar } from '../components/NavBar'
import { WORD_CATEGORIES } from '@imposter/shared'
import type { WordCategory } from '@imposter/shared'

type GameMode = 'normal' | 'ranked' | 'lobby'

const HOW_TO_PLAY = [
  { icon: '🎭', title: 'Get your role',   desc: 'Villager or Imposter — each gets a different word.' },
  { icon: '💬', title: 'Give clues',      desc: "One sentence per round. Don't say the word!" },
  { icon: '🗳️', title: 'Vote',           desc: 'Discuss and vote out who you think is the imposter.' },
  { icon: '🏆', title: 'Win',            desc: 'Villagers win if all imposters are eliminated.' },
]

const MODES = [
  {
    id: 'normal' as GameMode,
    icon: '🎮',
    label: 'Normal',
    desc: 'Play for fun — no LP at stake',
    color: 'border-brand-700/50 bg-brand-950/40 text-brand-400',
    inactive: 'border-neutral-800 hover:border-neutral-700',
  },
  {
    id: 'ranked' as GameMode,
    icon: '🏆',
    label: 'Ranked',
    desc: 'All categories · affects LP',
    color: 'border-amber-700/50 bg-amber-950/40 text-amber-400',
    inactive: 'border-neutral-800 hover:border-neutral-700',
  },
  {
    id: 'lobby' as GameMode,
    icon: '🚪',
    label: 'Create Lobby',
    desc: 'Invite friends with a code',
    color: 'border-violet-700/50 bg-violet-950/40 text-violet-400',
    inactive: 'border-neutral-800 hover:border-neutral-700',
  },
]

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null)
  const [categories, setCategories] = useState<WordCategory[]>([])   // empty = random / all
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasCategories = selectedMode === 'normal' || selectedMode === 'lobby'

  const toggleCategory = (key: WordCategory) => {
    setCategories((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    )
  }

  const handleCreate = async () => {
    if (!selectedMode) return
    setLoading(true)
    setError(null)
    try {
      const room = await api.post<{ code: string }>('/rooms', {
        settings: {
          gameMode: selectedMode === 'ranked' ? 'ranked' : 'normal',
          categories: selectedMode === 'ranked' ? [] : categories,
          isPrivate: selectedMode === 'lobby',
        },
      })
      navigate(`/lobby/${room.code}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomCode.trim()) return
    navigate(`/lobby/${roomCode.trim().toUpperCase()}`)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 flex flex-col items-center px-4 pt-16 pb-16">
        <div className="w-full max-w-lg animate-slide-up space-y-5">

          {/* Heading */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-600/30 bg-brand-600/10 text-brand-400 text-xs font-semibold mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-slow" />
              Social Deduction · Real-time · Multiplayer
            </div>
            <h1 className="text-5xl font-extrabold text-white leading-tight tracking-tight mb-3">
              Play the<br />
              <span className="text-brand-500">Imposter</span> Game
            </h1>
            <p className="text-neutral-400 text-lg">Deceive. Detect. Dominate.</p>
          </div>

          {/* Mode selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
              Choose a mode
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
                    <span className="text-sm font-bold">{mode.label}</span>
                    <span className={['text-[10px] text-center leading-tight', active ? 'opacity-80' : 'text-neutral-600'].join(' ')}>
                      {mode.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category picker — Normal & Lobby only */}
          {hasCategories && (
            <div className="card space-y-3 animate-slide-up">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  Categories
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
                <p className="text-[10px] text-neutral-600">
                  No filter — a random category is picked each round
                </p>
              )}
              {categories.length > 0 && (
                <p className="text-[10px] text-neutral-600">
                  {categories.length} of {WORD_CATEGORIES.length} categories selected
                </p>
              )}
            </div>
          )}

          {/* Ranked info */}
          {selectedMode === 'ranked' && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-950/30 border border-amber-800/30 animate-slide-up">
              <span className="text-amber-400 mt-0.5">🏆</span>
              <div>
                <p className="text-amber-400 text-sm font-semibold">Ranked mode</p>
                <p className="text-amber-600 text-xs mt-0.5">
                  All 12 categories are used. Wins and losses affect your LP and rank.
                </p>
              </div>
            </div>
          )}

          {/* Create button */}
          {selectedMode && (
            <button
              onClick={handleCreate}
              disabled={loading}
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
                  Creating room...
                </span>
              ) : (
                <>
                  {selectedMode === 'normal' && '🎮 Start Normal Game'}
                  {selectedMode === 'ranked' && '🏆 Start Ranked Game'}
                  {selectedMode === 'lobby' && '🚪 Create Lobby'}
                </>
              )}
            </button>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-400 text-sm">
              <span>⚠</span> {error}
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-neutral-800" />
            <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider">or join</span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>

          {/* Join */}
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              className="input-field flex-1 font-mono uppercase tracking-[0.25em] text-center text-lg h-12"
              placeholder="XXXXXX"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={8}
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={roomCode.trim().length < 4}
              className="h-12 px-6 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-sm transition-colors disabled:opacity-40 border border-neutral-700 whitespace-nowrap"
            >
              {t('room.joinRoom')}
            </button>
          </form>

        </div>

        {/* How to play */}
        <div className="w-full max-w-2xl mt-20 animate-fade-in">
          <h2 className="text-center text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-8">
            How to play
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {HOW_TO_PLAY.map((step) => (
              <div key={step.title} className="card text-center hover:border-neutral-700 transition-colors">
                <div className="text-3xl mb-3">{step.icon}</div>
                <p className="text-sm font-semibold text-white mb-1">{step.title}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
