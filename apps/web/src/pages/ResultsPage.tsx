import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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

const MOCK_PLAYERS = [
  { id: 'p1', userId: 'u1', username: 'Alice',   role: 'villager' as const, survived: true,  correctVote: true },
  { id: 'p2', userId: 'u2', username: 'Bob',     role: 'imposter' as const, survived: false, correctVote: false },
  { id: 'p3', userId: 'u3', username: 'Charlie', role: 'villager' as const, survived: true,  correctVote: true },
  { id: 'p4', userId: 'u4', username: 'Diana',   role: 'villager' as const, survived: true,  correctVote: true },
]

export default function ResultsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { result, room, myRole, reset } = useGameStore()
  const [honorGiven, setHonorGiven] = useState<Record<string, HonorType>>({})
  const [honorTarget, setHonorTarget] = useState<string | null>(null)

  // Game chat state
  const [chatMessages, setChatMessages] = useState<GameChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock = getSocket() as any

    const handleChatHistory = (data: { messages: GameChatMessage[] }) => {
      setChatMessages(data.messages)
    }
    const handleChatMessage = (msg: GameChatMessage) => {
      setChatMessages((prev) => [...prev, msg])
    }

    sock.on('gamechat:history', handleChatHistory)
    sock.on('gamechat:message', handleChatMessage)

    // Request history
    sock.emit('gamechat:history')

    return () => {
      sock.off('gamechat:history', handleChatHistory)
      sock.off('gamechat:message', handleChatMessage)
    }
  }, [])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleChatSend = () => {
    const text = chatInput.trim()
    if (!text) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock = getSocket() as any
    sock.emit('gamechat:send', { text })
    setChatInput('')
  }

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleChatSend()
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  // Use real result if available, else show a mock for preview
  const winner = result?.winner ?? 'villagers'
  const rewards = result?.rewards ?? { starCoinsEarned: 25, xpEarned: 120, lpChange: 18, achievements: [] }
  const players = room?.players?.length ? room.players : MOCK_PLAYERS
  const isImposter = myRole === 'imposter' || myRole === 'double_agent'
  const didWin = (winner === 'villagers' && !isImposter) || (winner === 'imposters' && isImposter)

  const handleHonor = (targetUserId: string, honorType: HonorType) => {
    setHonorGiven((prev) => ({ ...prev, [targetUserId]: honorType }))
    setHonorTarget(null)
    // getSocket().emit('honor:give', { targetPlayerId: targetUserId, honorType })
  }

  const handlePlayAgain = () => {
    reset()
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-4 pb-12">
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
              <p className="text-6xl mb-3">{didWin ? '🏆' : '💀'}</p>
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

          {/* Rewards */}
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">Rewards Earned</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/50">
                <span className="text-xl">⭐</span>
                <span className="text-lg font-bold text-white">+{rewards.starCoinsEarned}</span>
                <span className="text-xs text-neutral-500">Star Coins</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/50">
                <span className="text-xl">⚡</span>
                <span className="text-lg font-bold text-white">+{rewards.xpEarned}</span>
                <span className="text-xs text-neutral-500">XP</span>
              </div>
              <div className={[
                'flex flex-col items-center gap-1 p-3 rounded-xl border',
                rewards.lpChange >= 0
                  ? 'bg-emerald-950/40 border-emerald-800/40'
                  : 'bg-red-950/40 border-red-800/40',
              ].join(' ')}>
                <span className="text-xl">📊</span>
                <span className={[
                  'text-lg font-bold',
                  rewards.lpChange >= 0 ? 'text-emerald-400' : 'text-red-400',
                ].join(' ')}>
                  {rewards.lpChange >= 0 ? '+' : ''}{rewards.lpChange}
                </span>
                <span className="text-xs text-neutral-500">LP</span>
              </div>
            </div>

            {rewards.achievements.length > 0 && (
              <div className="mt-3 pt-3 border-t border-neutral-800">
                <p className="text-xs text-neutral-500 mb-2">Achievements Unlocked</p>
                <div className="flex flex-wrap gap-2">
                  {rewards.achievements.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-950/60 border border-brand-800/40 text-brand-400 text-xs font-semibold">
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
              {players.map((p) => {
                const role = (p as any).role as string | undefined
                const survived = (p as any).survived as boolean | undefined
                const isMe = p.userId === user?.id
                return (
                  <div
                    key={p.id}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors',
                      isMe ? 'border-brand-800/50 bg-brand-950/20' : 'border-neutral-800 bg-neutral-900/40',
                    ].join(' ')}
                  >
                    <Avatar username={p.username} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white text-sm truncate">{p.username}</span>
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
                      <span className="text-xs text-emerald-400 font-semibold">
                        {HONOR_OPTIONS.find((h) => h.type === honorGiven[p.userId])?.icon}{' '}
                        {HONOR_OPTIONS.find((h) => h.type === honorGiven[p.userId])?.label}
                      </span>
                    ) : honorTarget === p.userId ? (
                      <div className="flex gap-1.5">
                        {HONOR_OPTIONS.map((h) => (
                          <button
                            key={h.type}
                            onClick={() => handleHonor(p.userId, h.type)}
                            title={h.label}
                            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-base transition-colors"
                          >
                            {h.icon}
                          </button>
                        ))}
                        <button
                          onClick={() => setHonorTarget(null)}
                          className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-500 text-xs transition-colors"
                        >
                          ✕
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
              className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all shadow-lg shadow-brand-600/20"
            >
              Play Again
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold transition-colors"
            >
              Profile
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}
