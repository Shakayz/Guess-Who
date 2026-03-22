import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { NavBar } from '../components/NavBar'

const HOW_TO_PLAY = [
  { icon: '🎭', title: 'Get your role', desc: 'Villager or Imposter — each gets a different word.' },
  { icon: '💬', title: 'Give clues', desc: 'One sentence per round. Don\'t say the word!' },
  { icon: '🗳️', title: 'Vote', desc: 'Discuss and vote out who you think is the imposter.' },
  { icon: '🏆', title: 'Win', desc: 'Villagers win if all imposters are eliminated.' },
]

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState<'create' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setLoading('create')
    setError(null)
    try {
      const room = await api.post<{ code: string }>('/rooms', {})
      navigate(`/lobby/${room.code}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(null)
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

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center px-4 pt-20 pb-16">
        <div className="w-full max-w-lg animate-slide-up space-y-5">

          {/* Heading */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-600/30 bg-brand-600/10 text-brand-400 text-xs font-semibold mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-slow" />
              Social Deduction · Real-time · Multiplayer
            </div>
            <h1 className="text-5xl font-extrabold text-white leading-tight tracking-tight mb-3">
              Play the<br />
              <span className="text-brand-500">Imposter</span> Game
            </h1>
            <p className="text-neutral-400 text-lg">
              Deceive. Detect. Dominate.
            </p>
          </div>

          {/* Create */}
          <button
            onClick={handleCreate}
            disabled={loading === 'create'}
            className="w-full py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 active:scale-[0.98] text-white font-bold text-lg transition-all duration-150 shadow-2xl shadow-brand-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'create' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Creating room...
              </span>
            ) : (
              <>+ {t('room.createRoom')}</>
            )}
          </button>

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

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-400 text-sm">
              <span>⚠</span> {error}
            </div>
          )}
        </div>

        {/* How to play */}
        <div className="w-full max-w-2xl mt-24 animate-fade-in">
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
