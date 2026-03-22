import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useGameStore } from '../store/game'
import { connectSocket, getSocket } from '../lib/socket'
import { RoomCodeDisplay, PlayerCard } from '@imposter/ui'
import { NavBar } from '../components/NavBar'
import type { Room } from '@imposter/shared'

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { room, setRoom, setRoleAndWord, setRound } = useGameStore()
  const [isReady, setIsReady] = useState(false)
  const [connecting, setConnecting] = useState(true)

  useEffect(() => {
    if (!code) return
    connectSocket()
    const socket = getSocket()

    socket.emit('room:join', { roomCode: code })
    setConnecting(false)

    socket.on('room:updated', (r) => setRoom(r as Room))
    socket.on('game:started', ({ round, yourWord, yourRole }) => {
      setRoleAndWord(yourRole, yourWord)
      setRound(round as any)
      navigate(`/game/${code}`)
    })
    socket.on('error', (err) => console.error(err))

    return () => {
      socket.off('room:updated')
      socket.off('game:started')
      socket.off('error')
    }
  }, [code])

  const toggleReady = () => {
    getSocket().emit('player:ready', !isReady)
    setIsReady((r) => !r)
  }

  const startGame = () => getSocket().emit('game:start')

  const isHost = room?.hostId === user?.id
  const players = room?.players ?? []
  const allReady = players.length >= 2 && players.every((p) => p.isReady || p.isHost)
  const minPlayers = 4

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 animate-slide-up">

          {/* Title */}
          <div className="text-center mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Room</p>
            <h1 className="text-2xl font-extrabold text-white">Waiting for players</h1>
            <p className="text-neutral-500 text-sm mt-1">Share the code below to invite friends</p>
          </div>

          {/* Room code */}
          <div className="flex justify-center">
            {code && <RoomCodeDisplay code={code} />}
          </div>

          {/* Player list */}
          <div className="card space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Players
              </p>
              <span className="text-xs text-neutral-500 tabular-nums">
                {players.length} / {room?.settings?.maxPlayers ?? 10}
              </span>
            </div>

            {players.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full bg-neutral-800 border-2 border-dashed border-neutral-700 animate-pulse"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <p className="text-neutral-500 text-sm">Waiting for players to join...</p>
                <p className="text-neutral-600 text-xs mt-1">Need at least {minPlayers} to start</p>
              </div>
            ) : (
              players.map((p) => (
                <PlayerCard key={p.id} player={p} isCurrentUser={p.userId === user?.id} />
              ))
            )}
          </div>

          {/* Min players warning */}
          {players.length > 0 && players.length < minPlayers && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-800/30 text-amber-400 text-xs">
              <span>⚠</span>
              <span>Need at least {minPlayers} players to start ({minPlayers - players.length} more needed)</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-sm transition-colors"
            >
              ← Leave
            </button>

            {!isHost ? (
              <button
                onClick={toggleReady}
                className={[
                  'flex-1 py-3 rounded-xl font-semibold transition-all',
                  isReady
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300',
                ].join(' ')}
              >
                {isReady ? '✓ Ready' : 'Not Ready'}
              </button>
            ) : (
              <button
                onClick={startGame}
                disabled={!allReady}
                className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all disabled:opacity-40 shadow-lg shadow-brand-600/20"
              >
                Start Game
              </button>
            )}
          </div>

          {isHost && !allReady && players.length >= minPlayers && (
            <p className="text-xs text-neutral-500 text-center">
              Waiting for all players to be ready
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
