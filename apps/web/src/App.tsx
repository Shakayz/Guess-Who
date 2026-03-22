import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'

const HomePage     = React.lazy(() => import('./pages/HomePage'))
const LobbyPage    = React.lazy(() => import('./pages/LobbyPage'))
const GamePage     = React.lazy(() => import('./pages/GamePage'))
const ProfilePage  = React.lazy(() => import('./pages/ProfilePage'))
const ShopPage     = React.lazy(() => import('./pages/ShopPage'))
const LeaderboardPage = React.lazy(() => import('./pages/LeaderboardPage'))
const AuthPage     = React.lazy(() => import('./pages/AuthPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/auth" replace />
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
  </div>
)

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/lobby/:code" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/game/:code" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
        <Route path="/profile/:id?" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
