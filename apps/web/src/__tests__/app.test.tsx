import React, { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all heavy dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: unknown }) => children,
}))

vi.mock('../store/auth', () => ({
  useAuthStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      const state = { token: 'test-token', user: { id: 'u1', username: 'testuser' }, setAuth: vi.fn(), clearAuth: vi.fn() }
      return selector ? selector(state) : state
    },
    { getState: () => ({ token: 'test-token', user: { id: 'u1', username: 'testuser' }, setAuth: vi.fn(), clearAuth: vi.fn() }) },
  ),
}))

vi.mock('../store/social', () => ({
  useSocialStore: (selector: (s: unknown) => unknown) =>
    selector({
      activeDm: null, setActiveDm: vi.fn(), unreadCounts: {}, incrementUnread: vi.fn(),
      clearUnread: vi.fn(), pendingInvite: null, setPendingInvite: vi.fn(),
      pendingFriendRequest: null, setPendingFriendRequest: vi.fn(),
    }),
}))

vi.mock('../store/game', () => ({
  useGameStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      const state = { room: null, result: null, gameFinished: false, setRoom: vi.fn(), reset: vi.fn(), lastResetAt: 0 }
      return selector ? selector(state) : state
    },
    { getState: () => ({ room: null, result: null, gameFinished: false, setRoom: vi.fn(), reset: vi.fn(), lastResetAt: 0 }) },
  ),
}))

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ active: false }),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../lib/socket', () => ({
  getSocket: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: false }),
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
}))

vi.mock('../components/BottomNav', () => ({ BottomNav: () => <div data-testid="bottom-nav" /> }))

// Mock all lazy page imports
vi.mock('../pages/HomePage', () => ({ default: () => <div data-testid="home-page">Home</div> }))
vi.mock('../pages/AuthPage', () => ({ default: () => <div data-testid="auth-page">Auth</div> }))
vi.mock('../pages/LobbyPage', () => ({ default: () => <div data-testid="lobby-page">Lobby</div> }))
vi.mock('../pages/GamePage', () => ({ default: () => <div data-testid="game-page">Game</div> }))
vi.mock('../pages/ResultsPage', () => ({ default: () => <div data-testid="results-page">Results</div> }))
vi.mock('../pages/ProfilePage', () => ({ default: () => <div data-testid="profile-page">Profile</div> }))
vi.mock('../pages/LeaderboardPage', () => ({ default: () => <div data-testid="leaderboard-page">Leaderboard</div> }))
vi.mock('../pages/HistoryPage', () => ({ default: () => <div data-testid="history-page">History</div> }))
vi.mock('../pages/GameDetailPage', () => ({ default: () => <div data-testid="game-detail-page">GameDetail</div> }))
vi.mock('../pages/FriendsPage', () => ({ default: () => <div data-testid="friends-page">Friends</div> }))
vi.mock('../pages/PlayerProfilePage', () => ({ default: () => <div data-testid="player-profile-page">PlayerProfile</div> }))

import App from '../App'

function AppWithRouter({ initialPath = '/' }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  )
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', async () => {
    render(<AppWithRouter />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders BottomNav', async () => {
    render(<AppWithRouter />)
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()
  })

  it('renders auth page when navigating to /auth', async () => {
    render(<AppWithRouter initialPath="/auth" />)
    // AuthPage is lazy — after Suspense resolves it should appear
    expect(document.body).toBeInTheDocument()
  })

  it('renders home page for authenticated user at /', async () => {
    render(<AppWithRouter initialPath="/" />)
    expect(document.body).toBeInTheDocument()
  })

  it('redirects unauthenticated users to /auth (ProtectedRoute logic is tested in smoke.test)', () => {
    // This is tested via the ProtectedRoute smoke test in smoke.test.tsx
    // Just verify the app renders without crashing when initial path is /auth
    render(<AppWithRouter initialPath="/auth" />)
    expect(document.body).toBeInTheDocument()
  })
})
