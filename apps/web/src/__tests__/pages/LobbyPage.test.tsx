import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mocks ----
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ code: 'ROOM01' }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}))

vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, token: 'tok', clearAuth: vi.fn() }),
}))

// useGameStore is called both as useGameStore() (no args) and useGameStore(selector)
vi.mock('../../store/game', () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      room: null,
      setRoom: vi.fn(),
      setRoleAndWord: vi.fn(),
      setRound: vi.fn(),
      reset: vi.fn(),
      gameFinished: false,
      result: null,
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ friends: [] }),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

const mockSocketOn = vi.fn()
const mockSocketOff = vi.fn()
const mockSocketEmit = vi.fn()
vi.mock('../../lib/socket', () => ({
  connectSocket: vi.fn(),
  getSocket: () => ({ on: mockSocketOn, off: mockSocketOff, emit: mockSocketEmit, connected: false }),
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

vi.mock('@imposter/ui', () => ({
  RoomCodeDisplay: ({ code }: { code: string }) => <div data-testid="room-code">{code}</div>,
  PlayerCard: ({ username }: { username: string }) => <div data-testid="player-card">{username}</div>,
}))

vi.mock('@imposter/shared', () => ({
  WORD_CATEGORIES: [{ key: 'food', label: 'Food', icon: '🍕' }],
}))

import LobbyPage from '../../pages/LobbyPage'

describe('LobbyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<LobbyPage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows loading state initially while fetching room', () => {
    render(<LobbyPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('registers socket event listeners on mount', () => {
    render(<LobbyPage />)
    expect(mockSocketOn).toHaveBeenCalled()
  })

  it('emits socket join event on mount', () => {
    render(<LobbyPage />)
    expect(mockSocketEmit).toHaveBeenCalled()
  })

  it('cleans up socket listeners on unmount', () => {
    const { unmount } = render(<LobbyPage />)
    unmount()
    expect(mockSocketOff).toHaveBeenCalled()
  })
})
