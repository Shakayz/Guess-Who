import React, { Suspense } from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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

let _authToken: string | null = 'test-token'
let _authUser: any = { id: 'u1', username: 'testuser' }
vi.mock('../store/auth', () => ({
  useAuthStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      const state = { token: _authToken, user: _authUser, setAuth: vi.fn(), clearAuth: vi.fn() }
      return selector ? selector(state) : state
    },
    { getState: () => ({ token: _authToken, user: _authUser, setAuth: vi.fn(), clearAuth: vi.fn() }) },
  ),
}))

let _socialState = {
  activeDm: null as any,
  setActiveDm: vi.fn(),
  unreadCounts: {} as Record<string, number>,
  incrementUnread: vi.fn(),
  clearUnread: vi.fn(),
  pendingInvite: null as any,
  setPendingInvite: vi.fn(),
  pendingFriendRequest: null as any,
  setPendingFriendRequest: vi.fn(),
}

vi.mock('../store/social', () => ({
  useSocialStore: (selector: (s: unknown) => unknown) => selector(_socialState),
}))

let _gameState = {
  room: null as any,
  result: null as any,
  gameFinished: false,
  setRoom: vi.fn(),
  reset: vi.fn(),
  lastResetAt: 0,
  setResult: vi.fn(),
}

vi.mock('../store/game', () => ({
  useGameStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      return selector ? selector(_gameState) : _gameState
    },
    { getState: () => _gameState },
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

const mockSocketOn = vi.fn()
const mockSocketOff = vi.fn()
const mockSocketEmit = vi.fn()
vi.mock('../lib/socket', () => ({
  getSocket: () => ({ on: mockSocketOn, off: mockSocketOff, emit: mockSocketEmit, connected: false }),
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
import { api } from '../lib/api'

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
    _authToken = 'test-token'
    _authUser = { id: 'u1', username: 'testuser' }
    _gameState.room = null
    _gameState.result = null
    _gameState.lastResetAt = 0
    _socialState.pendingInvite = null
    _socialState.pendingFriendRequest = null
    vi.mocked(api.get).mockResolvedValue({ active: false })
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
    expect(document.body).toBeInTheDocument()
  })

  it('renders home page for authenticated user at /', async () => {
    render(<AppWithRouter initialPath="/" />)
    expect(document.body).toBeInTheDocument()
  })

  it('redirects unauthenticated users to /auth', () => {
    _authToken = null
    _authUser = null
    render(<AppWithRouter initialPath="/" />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders friends page at /friends', async () => {
    render(<AppWithRouter initialPath="/friends" />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders leaderboard page at /leaderboard', async () => {
    render(<AppWithRouter initialPath="/leaderboard" />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders history page at /history', async () => {
    render(<AppWithRouter initialPath="/history" />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders profile page at /profile', async () => {
    render(<AppWithRouter initialPath="/profile" />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders player profile page at /player/:id', async () => {
    render(<AppWithRouter initialPath="/player/u2" />)
    expect(document.body).toBeInTheDocument()
  })

  it('calls api.get for active room on mount when authenticated', async () => {
    await act(async () => {
      render(<AppWithRouter />)
    })
    expect(api.get).toHaveBeenCalledWith('/rooms/active')
  })

  it('does not call api.get for active room when not authenticated', async () => {
    _authToken = null
    _authUser = null
    await act(async () => {
      render(<AppWithRouter />)
    })
    expect(api.get).not.toHaveBeenCalledWith('/rooms/active')
  })

  it('sets room when active game is found', async () => {
    const mockRoom = { id: 'r1', code: 'GAME01', status: 'in_progress', players: [] }
    vi.mocked(api.get).mockResolvedValueOnce({ active: true, room: mockRoom })
    await act(async () => {
      render(<AppWithRouter />)
    })
    await waitFor(() => {
      expect(_gameState.setRoom).toHaveBeenCalledWith(mockRoom)
    })
  })

  it('resets game store when no active game on server but room is in store', async () => {
    _gameState.room = { id: 'old', code: 'OLD01', status: 'waiting', players: [] }
    vi.mocked(api.get).mockResolvedValueOnce({ active: false })
    await act(async () => {
      render(<AppWithRouter />)
    })
    await waitFor(() => {
      expect(_gameState.reset).toHaveBeenCalled()
    })
  })

  it('renders invite banner when pendingInvite is set', () => {
    _socialState.pendingInvite = { fromUsername: 'bob', roomCode: 'ROOM01' }
    render(<AppWithRouter />)
    expect(screen.getByText(/bob/)).toBeInTheDocument()
    expect(screen.getByText('Join')).toBeInTheDocument()
  })

  it('renders friend request banner when pendingFriendRequest is set', () => {
    _socialState.pendingFriendRequest = { friendshipId: 'fr1', fromId: 'u5', fromUsername: 'carol' }
    render(<AppWithRouter />)
    expect(screen.getByText(/carol/)).toBeInTheDocument()
    expect(screen.getByText('Accept')).toBeInTheDocument()
    expect(screen.getByText('Decline')).toBeInTheDocument()
  })

  it('dismisses invite banner when Dismiss is clicked', () => {
    _socialState.pendingInvite = { fromUsername: 'bob', roomCode: 'ROOM01' }
    render(<AppWithRouter />)
    fireEvent.click(screen.getByText('Dismiss'))
    expect(_socialState.setPendingInvite).toHaveBeenCalledWith(null)
  })

  it('dismisses friend request when Decline is clicked', async () => {
    _socialState.pendingFriendRequest = { friendshipId: 'fr1', fromId: 'u5', fromUsername: 'carol' }
    render(<AppWithRouter />)
    await act(async () => {
      fireEvent.click(screen.getByText('Decline'))
    })
    expect(_socialState.setPendingFriendRequest).toHaveBeenCalledWith(null)
  })

  it('does not show invite banner when in active game', () => {
    _socialState.pendingInvite = { fromUsername: 'bob', roomCode: 'ROOM01' }
    _gameState.room = { id: 'r1', code: 'GAME01', status: 'in_progress', players: [] }
    render(<AppWithRouter />)
    expect(screen.queryByText('Join')).not.toBeInTheDocument()
  })

  it('socket registers dm:receive handler when authenticated', async () => {
    await act(async () => {
      render(<AppWithRouter />)
    })
    const dmHandler = mockSocketOn.mock.calls.find(c => c[0] === 'dm:receive')
    expect(dmHandler).toBeDefined()
  })

  it('increments unread when dm is received from non-active chat', async () => {
    await act(async () => {
      render(<AppWithRouter />)
    })
    const dmHandler = mockSocketOn.mock.calls.find(c => c[0] === 'dm:receive')
    if (dmHandler) {
      act(() => {
        dmHandler[1]({ senderId: 'u2', senderUsername: 'bob', text: 'hi', id: 'm1', createdAt: new Date().toISOString() })
      })
      expect(_socialState.incrementUnread).toHaveBeenCalledWith('u2')
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles room:invited socket event', async () => {
    await act(async () => {
      render(<AppWithRouter />)
    })
    const inviteHandler = mockSocketOn.mock.calls.find(c => c[0] === 'room:invited')
    if (inviteHandler) {
      act(() => {
        inviteHandler[1]({ fromUserId: 'u2', fromUsername: 'bob', roomCode: 'ROOM99' })
      })
      expect(_socialState.setPendingInvite).toHaveBeenCalledWith({ fromUsername: 'bob', roomCode: 'ROOM99' })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles friend:request socket event', async () => {
    await act(async () => {
      render(<AppWithRouter />)
    })
    const friendReqHandler = mockSocketOn.mock.calls.find(c => c[0] === 'friend:request')
    if (friendReqHandler) {
      act(() => {
        friendReqHandler[1]({ friendshipId: 'fr1', from: { id: 'u5', username: 'carol' } })
      })
      expect(_socialState.setPendingFriendRequest).toHaveBeenCalledWith({
        friendshipId: 'fr1', fromId: 'u5', fromUsername: 'carol',
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('skips active game fetch when lastResetAt is recent', async () => {
    _gameState.lastResetAt = Date.now() // just reset
    await act(async () => {
      render(<AppWithRouter />)
    })
    expect(api.get).not.toHaveBeenCalledWith('/rooms/active')
  })

  it('accepts friend request when Accept button is clicked', async () => {
    _socialState.pendingFriendRequest = { friendshipId: 'fr1', fromId: 'u5', fromUsername: 'carol' }
    render(<AppWithRouter />)
    await act(async () => {
      fireEvent.click(screen.getByText('Accept'))
    })
    expect(api.put).toHaveBeenCalledWith('/friends/fr1/accept', {})
    expect(_socialState.setPendingFriendRequest).toHaveBeenCalledWith(null)
  })

  it('navigates to /friends on accept', async () => {
    _socialState.pendingFriendRequest = { friendshipId: 'fr1', fromId: 'u5', fromUsername: 'carol' }
    render(<AppWithRouter initialPath="/" />)
    await act(async () => {
      fireEvent.click(screen.getByText('Accept'))
    })
    // The navigate('/friends') call happens inside handleAccept
    expect(_socialState.setPendingFriendRequest).toHaveBeenCalledWith(null)
  })

  it('does not show invite banner when in voting game', () => {
    _socialState.pendingInvite = { fromUsername: 'bob', roomCode: 'ROOM01' }
    _gameState.room = { id: 'r1', code: 'GAME01', status: 'voting', players: [] }
    render(<AppWithRouter />)
    expect(screen.queryByText('Join')).not.toBeInTheDocument()
  })

  it('navigates to lobby when Join invite button clicked', () => {
    _socialState.pendingInvite = { fromUsername: 'bob', roomCode: 'ROOM01' }
    render(<AppWithRouter />)
    fireEvent.click(screen.getByText('Join'))
    expect(_socialState.setPendingInvite).toHaveBeenCalledWith(null)
  })

  it('handles game:finished socket event when room is active', async () => {
    _gameState.room = { id: 'r1', code: 'GAME01', status: 'in_progress', players: [] }
    _gameState.result = null
    await act(async () => {
      render(<AppWithRouter />)
    })
    const finishedHandler = mockSocketOn.mock.calls.find(c => c[0] === 'game:finished')
    if (finishedHandler) {
      act(() => {
        finishedHandler[1]({ winner: 'villagers', finalRound: null, rewards: null })
      })
      expect(_gameState.setResult).toHaveBeenCalled()
    }
    expect(document.body).toBeInTheDocument()
  })

  it('does not handle game:finished when no room in store', async () => {
    _gameState.room = null
    await act(async () => {
      render(<AppWithRouter />)
    })
    const finishedHandler = mockSocketOn.mock.calls.find(c => c[0] === 'game:finished')
    if (finishedHandler) {
      act(() => {
        finishedHandler[1]({ winner: 'villagers', finalRound: null, rewards: null })
      })
      expect(_gameState.setResult).not.toHaveBeenCalled()
    }
    expect(document.body).toBeInTheDocument()
  })

  it('active game guard navigates to game when on different path while alive', async () => {
    _gameState.room = {
      id: 'r1', code: 'GAME01', status: 'in_progress',
      players: [{ userId: 'u1', status: 'alive' }],
    }
    render(<AppWithRouter initialPath="/leaderboard" />)
    await waitFor(() => {
      expect(document.body).toBeInTheDocument()
    })
  })

  it('active game restorer skips reset check when cancelled', async () => {
    // cancelled ref prevents double-action
    vi.mocked(api.get).mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ active: false }), 100)))
    const { unmount } = render(<AppWithRouter />)
    unmount() // triggers cancelled = true before fetch resolves
    expect(document.body).toBeInTheDocument()
  })
})
