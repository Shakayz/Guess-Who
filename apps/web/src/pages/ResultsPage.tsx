import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useGameStore } from '../store/game'
import { useAuthStore } from '../store/auth'
import { NavBar } from '../components/NavBar'
import { Avatar, Badge } from '@imposter/ui'
import { RANK_CONFIG } from '@imposter/shared'
import type { RankTier } from '@imposter/shared'
import { getSocket } from '../lib/socket'

type HonorType = 'teamplayer' | 'sharp_mind' | 'good_sport'

interface GameChatMessage {
  id: string
  userId: string
  username: string
  text: string
  createdAt: string
}

const HONOR_OPTIONS: { type: HonorType; label: string; icon: string }[] = [
  { type: 'teamplayer', label: 'Team Player', icon: '🤝' },
  { type: 'sharp_mind', label: 'Sharp Mind',  icon: '🧠' },
  { type: 'good_sport', label: 'Good Sport',  icon: '🎖️' },
]

// Animated number counter hook
function useAnimatedNumber(target: number, duration = 1200): number {
  const [value, setValue] = useState(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    startRef.current = null
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    // Delay start for staggered effect
    const timeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate)
    }, 300)
    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return value
}

export default function ResultsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { result, room, myRole, reset } = useGameStore()
  const [honorGiven, setHonorGiven] = useState<Record<string, HonorType>>({})
  const [honorTarget, setHonorTarget] = useState<string | null>(null)
  const [rankUp, setRankUp] = useState<{ oldTier: RankTier; newTier: RankTier; newLP: number } | null>(null)
  const [showRankCelebration, setShowRankCelebration] = useState(false)

  // Game chat state
  const [chatMessages, setChatMessages] = useState<GameChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const winner = result?.winner ?? 'villagers'
  const rewards = result?.rewards ?? { starCoinsEarned: 25, xpEarned: 120, lpChange: 18, achievements: [] }
  const players = room?.players?.length ? room.players : []
  const isImposter = myRole === 'imposter' || myRole === 'double_agent'
  const didWin = (winner === 'villagers' && !isImposter) || (winner === 'imposters' && isImposter)

  // Animated counters
  const animatedStars = useAnimatedNumber(Math.abs(rewards.starCoinsEarned))
  const animatedXP = useAnimatedNumber(Math.abs(rewards.xpEarned))
  const animatedLP = useAnimatedNumber(Math.abs(rewards.lpChange))

  useEffect(() => {
    const sock = getSocket() as any

    const handleChatHistory = (data: { messages: GameChatMessage[] }) => setChatMessages(data.messages)
    const handleChatMessage = (msg: GameChatMessage) => setChatMessages((prev) => [...prev, msg])
    const handleRankUpdated = (data: { oldTier: RankTier; newTier: RankTier; newLP: number; promoted: boolean }) => {
      if (data.promoted) {
        setRankUp({ oldTier: data.oldTier, newTier: data.newTier, newLP: data.newLP })
        setShowRankCelebration(true)
        setTimeout(() => setShowRankCelebration(false), 5000)
      }
    }

    sock.on('gamechat:history', handleChatHistory)
    sock.on('gamechat:message', handleChatMessage)
    sock.on('rank:updated', handleRankUpdated)
    sock.emit('gamechat:history')

    return () => {
      sock.off('gamechat:history', handleChatHistory)
      sock.off('gamechat:message', handleChatMessage)
      sock.off('rank:updated', handleRankUpdated)
    }
  }, [])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleChatSend = () => {
    const text = chatInput.trim()
    if (!text) return
    ;(getSocket() as any).emit('gamechat:send', { text })
    setChatInput('')
  }

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleChatSend()
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  const handleHonor = (targetUserId: string, honorType: HonorType) => {
    setHonorGiven((prev) => ({ ...prev, [targetUserId]: honorType }))
    setHonorTarget(null)
    getSocket().emit('honor:give' as any, { targetUserId, honorType })
  }

  const handlePlayAgain = () => {
    reset()
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      {/* Rank Up Celebration Overlay */}
      {showRankCelebration && rankUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="text-center animate-bounce-in px-8 py-10">
            <p className="text-6xl mb-4">{RANK_CONFIG[rankUp.newTier]?.icon ?? '🏅'}</p>
            <p className="text-xs uppercase tracking-widest text-neutral-400 mb-2 font-semibold">Rank Up!</p>
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="text-neutral-500 text-lg">{RANK_CONFIG[rankUp.oldTier]?.icon}</span>
              <span className="text-neutral-500">→</span>
              <span className="text-3xl">{RANK_CONFIG[rankUp.newTier]?.icon}</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-1">
              {RANK_CONFIG[rankUp.newTier]?.label}
            </h2>
            <p className="text-neutral-400 text-sm">{rankUp.newLP} LP</p>
            <button
              onClick={() => setShowRankCelebration(false)}
              className="mt-6 px-6 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 p-4 pb-20 sm:pb-12">
        <div className="max-w-lg mx-auto space-y-4 animate-slide-up">

          {/* Outcome hero */}
          <div className={[
            'card relative overflow-hidden text-center py-8',
            didWin ? 'border-emerald-700/40' : 'border-red-800/40',
          ].join(' ')}>
            <div className={[
              'absolute inset-0 opacity-10',
              didWin
                ? 'bg-gradient-to-br from-emerald-500 to-transparent'
                : 'bg-gradient-to-br from-red-600 to-transparent',
            ].join(' ')} />
            <div className={[
              'absolute top-0 inset-x-0 h-0.5',
              didWin
                ? 'bg-gradient-to-r from-transparent via-emerald-500 to-transparent'
                : 'bg-gradient-to-r from-transparent via-red-500 to-transparent',
            ].join(' ')} />
            <div className="relative">
              <p className={['text-6xl mb-3', didWin ? 'animate-bounce-in' : ''].join(' ')}>
                {didWin ? '🏆' : '💀'}
              </p>
              <h1 className={[
                'text-3xl font-extrabold tracking-tight mb-1',
                didWin ? 'text-emerald-400' : 'text-red-400',
              ].join(' ')}>
                {didWin ? 'Victory!' : 'Defeat'}
              </h1>
              <p className="text-neutral-400 text-sm">
                {winner === 'villagers' ? 'Villagers found the imposters' : 'Imposters escaped detection'}
              </p>
            </div>
          </div>

          {/* Animated Rewards */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Rewards Earned</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/50 animate-count-up" style={{ animationDelay: '0.1s' }}>
                <span className="text-xl">⭐</span>
                <span className="text-lg font-bold text-white tabular-nums">+{animatedStars}</span>
                <span className="text-xs text-neutral-500">Star Coins</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/50 animate-count-up" style={{ animationDelay: '0.3s' }}>
                <span className="text-xl">⚡</span>
                <span className="text-lg font-bold text-white tabular-nums">+{animatedXP}</span>
                <span className="text-xs text-neutral-500">XP</span>
              </div>
              <div className={[
                'flex flex-col items-center gap-1 p-3 rounded-xl border animate-count-up',
                rewards.lpChange >= 0
                  ? 'bg-emerald-950/40 border-emerald-800/40'
                  : 'bg-red-950/40 border-red-800/40',
              ].join(' ')} style={{ animationDelay: '0.5s' }}>
                <span className="text-xl">📊</span>
                <span className={[
                  'text-lg font-bold tabular-nums',
                  rewards.lpChange >= 0 ? 'text-emerald-400' : 'text-red-400',
                ].join(' ')}>
                  {rewards.lpChange >= 0 ? '+' : '-'}{animatedLP}
                </span>
                <span className="text-xs text-neutral-500">LP</span>
              </div>
            </div>

            {rewards.achievements.length > 0 && (
              <div className="mt-3 pt-3 border-t border-neutral-800">
                <p className="text-xs text-neutral-500 mb-2">Achievements Unlocked</p>
                <div className="flex flex-wrap gap-2">
                  {rewards.achievements.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-950/60 border border-brand-800/40 text-brand-400 text-xs font-semibold animate-scale-in">
                      🏅 {a.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Player reveal */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Player Roles</p>
            <div className="space-y-2">
              {players.map((p, idx) => {
                const role = (p as any).role as string | undefined
                const survived = (p as any).survived as boolean | undefined
                const isMe = p.userId === user?.id
                return (
                  <div
                    key={p.id}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors animate-slide-up',
                      isMe ? 'border-brand-800/50 bg-brand-950/20' : 'border-neutral-800 bg-neutral-900/40',
                    ].join(' ')}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <Avatar username={p.username} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isMe ? (
                          <span className="font-semibold text-white text-sm truncate">{p.username}</span>
                        ) : (
                          <Link
                            to={`/player/${p.userId}`}
                            className="font-semibold text-white text-sm truncate hover:text-brand-400 transition-colors"
                          >
                            {p.username}
                          </Link>
                        )}
                        {isMe && <span className="text-[10px] text-brand-400 font-bold">YOU</span>}
                      </div>
                    </div>
                    <span className={[
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      role === 'imposter' || role === 'double_agent'
                        ? 'bg-red-950/60 text-red-400 border border-red-800/40'
                        : 'bg-brand-950/60 text-brand-400 border border-brand-800/40',
                    ].join(' ')}>
                      {role === 'imposter' ? '🎭 Imposter'
                        : role === 'double_agent' ? '🕵️ Double Agent'
                        : role === 'detective' ? '🔍 Detective'
                        : '🏘️ Villager'}
                    </span>
                    {survived !== undefined && (
                      <span className={[
                        'text-xs',
                        survived ? 'text-emerald-500' : 'text-neutral-600',
                      ].join(' ')}>
                        {survived ? 'Survived' : 'Eliminated'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Give honor */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Give Honor</p>
            <div className="space-y-2">
              {players
                .filter((p) => p.userId !== user?.id)
                .map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <Avatar username={p.username} size="xs" />
                    <span className="flex-1 text-sm text-white font-medium">{p.username}</span>
                    {honorGiven[p.userId] ? (
                      <span className="text-xs text-emerald-400 font-semibold animate-scale-in">
                        {HONOR_OPTIONS.find((h) => h.type === honorGiven[p.userId])?.icon}{' '}
                        {HONOR_OPTIONS.find((h) => h.type === honorGiven[p.userId])?.label}
                      </span>
                    ) : honorTarget === p.userId ? (
                      <div className="flex flex-col gap-1.5 items-end animate-slide-up">
                        {HONOR_OPTIONS.map((h) => (
                          <button
                            key={h.type}
                            onClick={() => handleHonor(p.userId, h.type)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 hover:text-white transition-colors"
                          >
                            <span>{h.icon}</span>
                            <span>{h.label}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => setHonorTarget(null)}
                          className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setHonorTarget(p.userId)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors font-medium"
                      >
                        + Honor
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Game Chat */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">💬 Game Chat</p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-3 pr-1">
              {chatMessages.length === 0 ? (
                <p className="text-neutral-600 text-sm text-center py-4">No messages yet. Start the conversation!</p>
              ) : (
                (() => {
                  let lastUser = ''
                  return chatMessages.map((msg) => {
                    const isMe = msg.userId === user?.id
                    const showName = msg.userId !== lastUser
                    lastUser = msg.userId
                    return (
                      <div
                        key={msg.id}
                        className={['flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row'].join(' ')}
                      >
                        {showName && !isMe && (
                          <div className="w-7 h-7 rounded-full bg-brand-600/60 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">
                            {msg.username.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {(!showName || isMe) && <div className="w-7 flex-shrink-0" />}
                        <div className="flex flex-col max-w-[75%]">
                          {showName && (
                            <span className={['text-[10px] text-neutral-500 mb-0.5', isMe ? 'text-right' : ''].join(' ')}>
                              {isMe ? 'You' : msg.username} · {formatTime(msg.createdAt)}
                            </span>
                          )}
                          <div className={[
                            'px-3 py-1.5 rounded-2xl text-sm',
                            isMe
                              ? 'bg-brand-600/80 text-white rounded-tr-sm self-end'
                              : 'bg-neutral-800 text-neutral-200 rounded-tl-sm',
                          ].join(' ')}>
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()
              )}
              <div ref={chatBottomRef} />
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
              <input
                type="text"
                placeholder="Say something…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                className="flex-1 px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-brand-600 transition-colors"
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim()}
                className="px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handlePlayAgain}
              className="flex-1 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-lg transition-all shadow-lg shadow-brand-600/30 hover:shadow-brand-600/50 active:scale-[0.98]"
            >
              Play Again
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="px-5 py-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold transition-colors"
            >
              Profile
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}
