// Cache-bust: 2026-04-03T17
import React, { Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { useSocialStore } from './store/social'
import { useGameStore } from './store/game'
import { getSocket } from './lib/socket'
import { api } from './lib/api'
import { BottomNav } from './components/BottomNav'

const HomePage        = React.lazy(() => import('./pages/HomePage'))
const LobbyPage       = React.lazy(() => import('./pages/LobbyPage'))
const GamePage        = React.lazy(() => import('./pages/GamePage'))
const ProfilePage     = React.lazy(() => import('./pages/ProfilePage'))
// const PremiumPage     = React.lazy(() => import('./pages/PremiumPage'))  // TODO: re-enable when premium is ready
const LeaderboardPage = React.lazy(() => import('./pages/LeaderboardPage'))
const ResultsPage     = React.lazy(() => import('./pages/ResultsPage'))
const AuthPage        = React.lazy(() => import('./pages/AuthPage'))
const HistoryPage     = React.lazy(() => import('./pages/HistoryPage'))
const GameDetailPage  = React.lazy(() => import('./pages/GameDetailPage'))
const FriendsPage         = React.lazy(() => import('./pages/FriendsPage'))
const PlayerProfilePage   = React.lazy(() => import('./pages/PlayerProfilePage'))
// const SeasonPassPage      = React.lazy(() => import('./pages/SeasonPassPage'))  // TODO: re-enable when premium is ready
// const WordPacksPage       = React.lazy(() => import('./pages/WordPacksPage'))  // TODO: re-enable when premium is ready

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/auth" replace />
}

/**
 * Prevents ALIVE players from navigating away during an active game.
 * You must forfeit or get eliminated before you can leave.
 *
 * Eliminated / forfeited players are NOT blocked — they can browse freely
 * and will see a "Rejoin Game" banner on the home page.
 */
function ActiveGameGuard() {
  const room = useGameStore((s) => s.room)
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!room) return
    const isActiveGame = room.status === 'in_progress' || room.status === 'voting'
    if (!isActiveGame) return

    // Check if I'm still alive in this game
    const me = room.players?.find((p) => p.userId === user?.id)
    const isAlive = me && me.status === 'alive'
    if (!isAlive) return // eliminated/forfeited — free to browse

    const gameCode = room.code
    const gamePath = `/game/${gameCode}`
    const resultsPath = `/results/${gameCode}`
    const { pathname } = location

    if (pathname !== gamePath && pathname !== resultsPath) {
      navigate(gamePath, { replace: true })
    }
  }, [room, location.pathname, navigate, user])

  return null
}

/**
 * On app load (and after login), checks the server for any active game
 * the user is part of.
 * - If active → restores the room into the game store (rejoin card appears)
 * - If NOT active → clears any stale game state from sessionStorage
 */
function ActiveGameRestorer() {
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) return

    let cancelled = false
    api.get<{ active: boolean; roomCode?: string; room?: any }>('/rooms/active')
      .then((data) => {
        if (cancelled) return
        if (data.active && data.room) {
          useGameStore.getState().setRoom(data.room)
        } else {
          // No active game on server — clear any stale client state
          const store = useGameStore.getState()
          if (store.room) {
            store.reset()
          }
        }
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [token]) // only on login / app mount

  return null
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
  </div>
)

interface DmReceiveEvent {
  id: string
  senderId: string
  senderUsername: string
  text: string
  createdAt: string
}

interface RoomInvitedEvent {
  fromUserId: string
  fromUsername: string
  roomCode: string
}

interface FriendRequestEvent {
  friendshipId: string
  from: { id: string; username: string }
}

function GlobalSocketListeners() {
  const token = useAuthStore((s) => s.token)
  const activeDm = useSocialStore((s) => s.activeDm)
  const incrementUnread = useSocialStore((s) => s.incrementUnread)
  const setPendingInvite = useSocialStore((s) => s.setPendingInvite)
  const setPendingFriendRequest = useSocialStore((s) => s.setPendingFriendRequest)
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock = getSocket() as any

    const handleDmReceive = (data: DmReceiveEvent) => {
      if (!activeDm || activeDm.friendId !== data.senderId) {
        incrementUnread(data.senderId)
      }
    }

    const handleRoomInvited = (data: RoomInvitedEvent) => {
      setPendingInvite({ fromUsername: data.fromUsername, roomCode: data.roomCode })
    }

    const handleFriendRequest = (data: FriendRequestEvent) => {
      setPendingFriendRequest({ friendshipId: data.friendshipId, fromId: data.from.id, fromUsername: data.from.username })
    }

    // Global game:finished listener — catches game end even if the player
    // left the GamePage (e.g. eliminated player browsing home).
    // The GamePage has its own handler that navigates to /results/:code;
    // this one is a fallback for when the player is elsewhere.
    const handleGameFinished = (data: any) => {
      const store = useGameStore.getState()
      // Only act if the game store still has an active room (not yet reset)
      if (store.room && !store.result) {
        store.setResult(data)
        store.setRoom({ ...store.room, status: 'finished' as any })
        navigate(`/results/${store.room.code}`)
      }
    }

    sock.on('dm:receive', handleDmReceive)
    sock.on('room:invited', handleRoomInvited)
    sock.on('friend:request', handleFriendRequest)
    sock.on('game:finished', handleGameFinished)

    return () => {
      sock.off('dm:receive', handleDmReceive)
      sock.off('room:invited', handleRoomInvited)
      sock.off('friend:request', handleFriendRequest)
      sock.off('game:finished', handleGameFinished)
    }
  }, [token, activeDm, incrementUnread, setPendingInvite, setPendingFriendRequest, navigate])

  return null
}

function FriendRequestBanner() {
  const navigate = useNavigate()
  const pendingFriendRequest = useSocialStore((s) => s.pendingFriendRequest)
  const setPendingFriendRequest = useSocialStore((s) => s.setPendingFriendRequest)

  if (!pendingFriendRequest) return null

  const handleAccept = async () => {
    try {
      await api.put(`/friends/${pendingFriendRequest.friendshipId}/accept`, {})
    } catch {}
    setPendingFriendRequest(null)
    navigate('/friends')
  }

  const handleDecline = async () => {
    try {
      await api.delete(`/friends/${pendingFriendRequest.friendshipId}`)
    } catch {}
    setPendingFriendRequest(null)
  }

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-emerald-700/60 bg-brand-950/90 backdrop-blur shadow-2xl text-sm">
        <span className="text-lg">👤</span>
        <span className="text-white font-medium">
          <span className="text-emerald-400 font-bold">{pendingFriendRequest.fromUsername}</span> sent you a friend request!
        </span>
        <button
          onClick={handleAccept}
          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
        >
          Accept
        </button>
        <button
          onClick={handleDecline}
          className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white font-semibold transition-colors"
        >
          Decline
        </button>
      </div>
    </div>
  )
}

function InviteBanner() {
  const navigate = useNavigate()
  const pendingInvite = useSocialStore((s) => s.pendingInvite)
  const setPendingInvite = useSocialStore((s) => s.setPendingInvite)
  const activeRoom = useGameStore((s) => s.room)
  const isInActiveGame = activeRoom && (activeRoom.status === 'in_progress' || activeRoom.status === 'voting')

  if (!pendingInvite) return null

  // Don't show invite banner if player is in an active game
  if (isInActiveGame) {
    return null
  }

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-brand-700/60 bg-brand-950/90 backdrop-blur shadow-2xl text-sm">
        <span className="text-lg">📨</span>
        <span className="text-white font-medium">
          <span className="text-brand-400 font-bold">{pendingInvite.fromUsername}</span> invited you to a game!
        </span>
        <button
          onClick={() => {
            navigate(`/lobby/${pendingInvite.roomCode}`)
            setPendingInvite(null)
          }}
          className="px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors"
        >
          Join
        </button>
        <button
          onClick={() => setPendingInvite(null)}
          className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white font-semibold transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <ActiveGameRestorer />
      <GlobalSocketListeners />
      <ActiveGameGuard />
      <InviteBanner />
      <FriendRequestBanner />
      <BottomNav />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/lobby/:code" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/game/:code" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
        <Route path="/results/:code" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
        <Route path="/profile/:id?" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        {/* <Route path="/premium" element={<ProtectedRoute><PremiumPage /></ProtectedRoute>} /> */}
        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        <Route path="/history/:gameId" element={<ProtectedRoute><GameDetailPage /></ProtectedRoute>} />
        <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
        <Route path="/player/:userId" element={<ProtectedRoute><PlayerProfilePage /></ProtectedRoute>} />
        {/* <Route path="/season-pass" element={<ProtectedRoute><SeasonPassPage /></ProtectedRoute>} /> */}
        {/* <Route path="/word-packs" element={<ProtectedRoute><WordPacksPage /></ProtectedRoute>} /> */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
