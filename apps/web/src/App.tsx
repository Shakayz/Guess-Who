import React, { Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { useSocialStore } from './store/social'
import { getSocket } from './lib/socket'
import { api } from './lib/api'

const HomePage        = React.lazy(() => import('./pages/HomePage'))
const LobbyPage       = React.lazy(() => import('./pages/LobbyPage'))
const GamePage        = React.lazy(() => import('./pages/GamePage'))
const ProfilePage     = React.lazy(() => import('./pages/ProfilePage'))
const PremiumPage     = React.lazy(() => import('./pages/PremiumPage'))
const LeaderboardPage = React.lazy(() => import('./pages/LeaderboardPage'))
const ResultsPage     = React.lazy(() => import('./pages/ResultsPage'))
const AuthPage        = React.lazy(() => import('./pages/AuthPage'))
const HistoryPage     = React.lazy(() => import('./pages/HistoryPage'))
const GameDetailPage  = React.lazy(() => import('./pages/GameDetailPage'))
const FriendsPage         = React.lazy(() => import('./pages/FriendsPage'))
const PlayerProfilePage   = React.lazy(() => import('./pages/PlayerProfilePage'))
const SeasonPassPage      = React.lazy(() => import('./pages/SeasonPassPage'))
const WordPacksPage       = React.lazy(() => import('./pages/WordPacksPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/auth" replace />
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

    sock.on('dm:receive', handleDmReceive)
    sock.on('room:invited', handleRoomInvited)
    sock.on('friend:request', handleFriendRequest)

    return () => {
      sock.off('dm:receive', handleDmReceive)
      sock.off('room:invited', handleRoomInvited)
      sock.off('friend:request', handleFriendRequest)
    }
  }, [token, activeDm, incrementUnread, setPendingInvite, setPendingFriendRequest])

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

  if (!pendingInvite) return null

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
      <GlobalSocketListeners />
      <InviteBanner />
      <FriendRequestBanner />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/lobby/:code" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/game/:code" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
        <Route path="/results/:code" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
        <Route path="/profile/:id?" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/premium" element={<ProtectedRoute><PremiumPage /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        <Route path="/history/:gameId" element={<ProtectedRoute><GameDetailPage /></ProtectedRoute>} />
        <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
        <Route path="/player/:userId" element={<ProtectedRoute><PlayerProfilePage /></ProtectedRoute>} />
        <Route path="/season-pass" element={<ProtectedRoute><SeasonPassPage /></ProtectedRoute>} />
        <Route path="/word-packs" element={<ProtectedRoute><WordPacksPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
