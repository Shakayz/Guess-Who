import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ code: 'GAME01' }),
  Link: ({ children, to }: { children: unknown; to: string }) => <a href={to}>{children as React.ReactNode}</a>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}))

vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, token: 'tok' }),
}))

const mockGameState = {
  result: null as unknown,
  room: null as unknown,
  myRole: null as unknown,
  completedRounds: [] as unknown[],
  reset: vi.fn(),
  setRoleAndWord: vi.fn(),
}

vi.mock('../../store/game', () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    return selector ? selector(mockGameState) : mockGameState
  },
}))

const mockSocketOn = vi.fn()
const mockSocketOff = vi.fn()
vi.mock('../../lib/socket', () => ({
  getSocket: () => ({ on: mockSocketOn, off: mockSocketOff, emit: vi.fn() }),
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

vi.mock('@imposter/ui', () => ({
  Avatar: ({ username }: { username: string }) => <div>{username}</div>,
  Badge: ({ tier }: { tier: string }) => <div>{tier}</div>,
}))

vi.mock('@imposter/shared', () => ({
  RANK_CONFIG: {
    wooden:      { label: 'Wooden',      color: '#8B6914', icon: '🪵', lpRequired: 100 },
    bronze:      { label: 'Bronze',      color: '#CD7F32', icon: '🥉', lpRequired: 200 },
    silver:      { label: 'Silver',      color: '#C0C0C0', icon: '🥈', lpRequired: 300 },
    gold:        { label: 'Gold',        color: '#FFD700', icon: '🥇', lpRequired: 400 },
    diamond:     { label: 'Diamond',     color: '#B9F2FF', icon: '💎', lpRequired: 500 },
    master:      { label: 'Master',      color: '#9B59B6', icon: '👑', lpRequired: 600 },
    grandmaster: { label: 'Grandmaster', color: '#E74C3C', icon: '🌌', lpRequired: Infinity },
  },
}))

import ResultsPage from '../../pages/ResultsPage'

describe('ResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGameState.result = null
    mockGameState.room = null
    mockGameState.myRole = null
    mockGameState.completedRounds = []
  })

  it('renders without crashing', () => {
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('shows fallback text when no result is available', () => {
    render(<ResultsPage />)
    // When result is null, shows a fallback view
    expect(screen.getByText('No game data available.')).toBeInTheDocument()
  })

  it('renders navbar when result is available', () => {
    mockGameState.result = {
      winner: 'villagers',
      finalRound: { id: 'r1', roundNumber: 3, speakingOrder: [], clues: [], votes: [] },
      rewards: { starCoinsEarned: 10, xpEarned: 50, lpChange: 5, achievements: [] },
    }
    mockGameState.room = {
      code: 'GAME01',
      status: 'finished',
      players: [{ userId: 'u1', username: 'testuser', role: 'villager', status: 'alive', avatarUrl: null }],
    }
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('renders with a completed game result', () => {
    mockGameState.result = {
      winner: 'villagers',
      finalRound: { id: 'r1', roundNumber: 3, speakingOrder: [], clues: [], votes: [] },
      rewards: { starCoinsEarned: 10, xpEarned: 50, lpChange: 5, achievements: [] },
    }
    mockGameState.room = {
      code: 'GAME01',
      status: 'finished',
      players: [
        { userId: 'u1', username: 'testuser', role: 'villager', status: 'alive', avatarUrl: null },
      ],
    }
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('registers socket listeners on mount', () => {
    render(<ResultsPage />)
    expect(mockSocketOn).toHaveBeenCalled()
  })

  it('cleans up socket listeners on unmount', () => {
    const { unmount } = render(<ResultsPage />)
    unmount()
    expect(mockSocketOff).toHaveBeenCalled()
  })
})
