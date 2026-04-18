// Cache-bust: 2026-04-03T17
import React, { Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from './store/auth'
import { useSocialStore } from './store/social'
import { useGameStore } from './store/game'
import { getSocket, connectSocket, disconnectSocket } from './lib/socket'
import { api } from './lib/api'
import { BottomNav } from './components/BottomNav'
import { ConnectionStatus } from './components/ConnectionStatus'
import { AchievementToastBanner } from './components/achievements/AchievementToastBanner'
import { createLogger } from './lib/logger'
import { lazyWithRetry } from './lib/lazyWithRetry'

const log = createLogger('app')

// All lazy-loaded routes go through lazyWithRetry so that stale chunk hashes
// (after a deploy with --delete) auto-recover via a one-shot hard reload
// instead of surfacing "Failed to fetch dynamically imported module" to the
// user. See apps/web/src/lib/lazyWithRetry.ts for details.
const HomePage        = lazyWithRetry(() => import('./pages/HomePage'))
const LobbyPage       = lazyWithRetry(() => import('./pages/LobbyPage'))
const GamePage        = lazyWithRetry(() => import('./pages/GamePage'))
const ProfilePage     = lazyWithRetry(() => import('./pages/ProfilePage'))
const LeaderboardPage = lazyWithRetry(() => import('./pages/LeaderboardPage'))
const ResultsPage     = lazyWithRetry(() => import('./pages/ResultsPage'))
const AuthPage              = lazyWithRetry(() => import('./pages/AuthPage'))
const ForgotPasswordPage    = lazyWithRetry(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage     = lazyWithRetry(() => import('./pages/ResetPasswordPage'))
const HistoryPage     = lazyWithRetry(() => import('./pages/HistoryPage'))
const GameDetailPage  = lazyWithRetry(() => import('./pages/GameDetailPage'))
const FriendsPage         = lazyWithRetry(() => import('./pages/FriendsPage'))
const PlayerProfilePage   = lazyWithRetry(() => import('./pages/PlayerProfilePage'))
const OfflinePage         = lazyWithRetry(() => import('./pages/OfflinePage'))
const HowToPlayPage       = lazyWithRetry(() => import('./pages/HowToPlayPage'))
const TutorialPage        = lazyWithRetry(() => import('./pages/TutorialPage'))
const SettingsPage        = lazyWithRetry(() => import('./pages/SettingsPage'))
const AchievementsPage    = lazyWithRetry(() => import('./pages/AchievementsPage'))
const TermsPage           = lazyWithRetry(() => import('./pages/TermsPage'))
const PrivacyPage         = lazyWithRetry(() => import('./pages/PrivacyPage'))
const ShopPage            = lazyWithRetry(() => import('./pages/ShopPage'))
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
      log.info('redirecting to active game', { code: gameCode, from: pathname })
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

    // If the user just reset (left a game), don't immediately re-fetch
    // for 5 seconds to avoid race conditions with server cleanup
    const { lastResetAt } = useGameStore.getState()
    if (lastResetAt && Date.now() - lastResetAt < 5000) return

    let cancelled = false
    api.get<{ active: boolean; roomCode?: string; room?: any }>('/rooms/active')
      .then((data) => {
        if (cancelled) return
        // Re-check after async — user might have reset while we were fetching
        const { lastResetAt: currentReset } = useGameStore.getState()
        if (currentReset && Date.now() - currentReset < 5000) return

        if (data.active && data.room) {
          log.info('active game detected', { code: data.room.code, status: data.room.status })
          useGameStore.getState().setRoom(data.room)
        } else {
          // No active game on server — clear any stale client state
          const store = useGameStore.getState()
          if (store.room) {
            log.info('clearing stale game state')
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
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!token) {
      disconnectSocket()
      return
    }
    // Establish the socket connection as soon as the user is authenticated so
    // global notifications (DMs, room invites, friend requests, game:finished)
    // arrive even before the user starts a game.
    connectSocket()
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
      // Star balance changed on the server (base reward + daily/streak bonus)
      // — refetch /auth/me so the header chip and profile page update.
      queryClient.invalidateQueries({ queryKey: ['me'] })

      const store = useGameStore.getState()
      // Only act if the game store still has an active room (not yet reset)
      if (store.room && !store.result) {
        store.setResult(data)
        store.setRoom({ ...store.room, status: 'finished' as any })
        navigate(`/results/${store.room.code}`)
      }
    }

    // Achievement unlock notifications — invalidate queries so AchievementsPage
    // and the profile chip refresh immediately, and drop a pending toast.
    const handleAchievementUnlocked = (data: {
      key: string
      name: string
      icon: string
      difficulty: string
      category: string
      starsReward: number
      xpReward: number
    }) => {
      queryClient.invalidateQueries({ queryKey: ['achievements'] })
      queryClient.invalidateQueries({ queryKey: ['achievements-summary'] })
      useSocialStore.getState().pushAchievementToast({
        key: data.key,
        name: data.name,
        icon: data.icon,
        difficulty: data.difficulty,
        starsReward: data.starsReward,
      })
    }

    sock.on('dm:receive', handleDmReceive)
    sock.on('room:invited', handleRoomInvited)
    sock.on('friend:request', handleFriendRequest)
    sock.on('game:finished', handleGameFinished)
    sock.on('achievement:unlocked', handleAchievementUnlocked)

    return () => {
      sock.off('dm:receive', handleDmReceive)
      sock.off('room:invited', handleRoomInvited)
      sock.off('friend:request', handleFriendRequest)
      sock.off('game:finished', handleGameFinished)
      sock.off('achievement:unlocked', handleAchievementUnlocked)
    }
  }, [token, activeDm, incrementUnread, setPendingInvite, setPendingFriendRequest, navigate, queryClient])

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

function AuthenticatedConnectionStatus() {
  const token = useAuthStore((s) => s.token)
  if (!token) return null
  return <ConnectionStatus />
}

/**
 * Listens for 402 Payment Required responses from the API and redirects the
 * user to the Shop's Premium tab so they can upgrade. Skips redirect if
 * already on the shop or auth pages.
 */
function PremiumRequiredRedirector() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    const handler = () => {
      const p = location.pathname
      if (p === '/shop' || p === '/auth') return
      navigate('/shop?tab=premium&upsell=1', { replace: false })
    }
    window.addEventListener('premium-required', handler)
    return () => window.removeEventListener('premium-required', handler)
  }, [navigate, location.pathname])
  return null
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-indigo-600 focus:text-white focus:px-4 focus:py-2 focus:rounded">
        Skip to main content
      </a>
      <ActiveGameRestorer />
      <GlobalSocketListeners />
      <ActiveGameGuard />
      <PremiumRequiredRedirector />
      <AuthenticatedConnectionStatus />
      <InviteBanner />
      <FriendRequestBanner />
      <AchievementToastBanner />
      <BottomNav />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        {/* Discord OAuth callback. AuthPage picks up `?code=…` and exchanges
            it via /auth/discord/verify. Kept as its own path so Discord's
            redirect_uri registration is a stable, dedicated URL. */}
        <Route path="/auth/discord/callback" element={<AuthPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/offline" element={<OfflinePage />} />
        <Route path="/how-to-play" element={<HowToPlayPage />} />
        <Route path="/tutorial" element={<ProtectedRoute><TutorialPage /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/lobby/:code" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/game/:code" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
        <Route path="/results/:code" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
        <Route path="/profile/:id?" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/premium" element={<Navigate to="/shop?tab=premium" replace />} />
        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        <Route path="/history/:gameId" element={<ProtectedRoute><GameDetailPage /></ProtectedRoute>} />
        <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
        <Route path="/player/:userId" element={<ProtectedRoute><PlayerProfilePage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/achievements" element={<ProtectedRoute><AchievementsPage /></ProtectedRoute>} />
        <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        {/* <Route path="/season-pass" element={<ProtectedRoute><SeasonPassPage /></ProtectedRoute>} /> */}
        {/* <Route path="/word-packs" element={<ProtectedRoute><WordPacksPage /></ProtectedRoute>} /> */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
