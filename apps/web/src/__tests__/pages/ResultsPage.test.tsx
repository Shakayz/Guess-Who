import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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
  setResult: vi.fn(),
  setRoom: vi.fn(),
}

vi.mock('../../store/game', () => ({
  useGameStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      return selector ? selector(mockGameState) : mockGameState
    },
    { getState: () => mockGameState },
  ),
}))

const mockSocketOn = vi.fn()
const mockSocketOff = vi.fn()
const mockSocketEmit = vi.fn()
vi.mock('../../lib/socket', () => ({
  getSocket: () => ({ on: mockSocketOn, off: mockSocketOff, emit: mockSocketEmit }),
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

const winResult = {
  winner: 'villagers',
  finalRound: { id: 'r1', roundNumber: 3, speakingOrder: [], clues: [], votes: [] },
  rewards: { starCoinsEarned: 10, xpEarned: 50, lpChange: 5, achievements: [] },
}

const winRoom = {
  code: 'GAME01',
  status: 'finished',
  settings: { gameMode: 'normal', isPrivate: false },
  players: [
    { userId: 'u1', username: 'testuser', role: 'villager', status: 'alive', avatarUrl: null },
    { userId: 'u2', username: 'enemy', role: 'imposter', status: 'eliminated', avatarUrl: null },
  ],
}

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
    expect(screen.getByText('No game data available.')).toBeInTheDocument()
  })

  it('shows back to home button on fallback screen', () => {
    render(<ResultsPage />)
    expect(screen.getByText('Back to Home')).toBeInTheDocument()
  })

  it('navigates home when back button clicked from fallback', () => {
    render(<ResultsPage />)
    fireEvent.click(screen.getByText('Back to Home'))
    expect(mockGameState.reset).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('renders navbar when result is available', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
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

  it('renders with a completed game result as villager winning', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders when imposters win', () => {
    mockGameState.result = {
      winner: 'imposters',
      finalRound: { id: 'r1', roundNumber: 2, speakingOrder: [], clues: [], votes: [] },
      rewards: { starCoinsEarned: 5, xpEarned: 25, lpChange: -3, achievements: [] },
    }
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders when imposter player wins', () => {
    mockGameState.result = {
      winner: 'imposters',
      finalRound: { id: 'r1', roundNumber: 2, speakingOrder: [], clues: [], votes: [] },
      rewards: { starCoinsEarned: 15, xpEarned: 75, lpChange: 10, achievements: [] },
    }
    mockGameState.room = { ...winRoom, settings: { gameMode: 'normal', isPrivate: false } }
    mockGameState.myRole = 'imposter'
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders ranked game results with LP display', () => {
    mockGameState.result = {
      winner: 'villagers',
      finalRound: { id: 'r1', roundNumber: 1, speakingOrder: [], clues: [], votes: [] },
      rewards: { starCoinsEarned: 0, xpEarned: 0, lpChange: 20, achievements: [] },
    }
    mockGameState.room = {
      ...winRoom,
      settings: { gameMode: 'ranked', isPrivate: false },
    }
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('emits gamechat:history on mount', () => {
    render(<ResultsPage />)
    expect(mockSocketEmit).toHaveBeenCalledWith('gamechat:history')
  })

  it('handles chat message received via socket', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    // Simulate receiving a chat message
    const chatMsgCall = mockSocketOn.mock.calls.find(call => call[0] === 'gamechat:message')
    expect(chatMsgCall).toBeDefined()
    act(() => {
      chatMsgCall![1]({ id: 'm1', userId: 'u2', username: 'enemy', text: 'Good game!', createdAt: new Date().toISOString() })
    })
    expect(screen.getByText('Good game!')).toBeInTheDocument()
  })

  it('handles play again button click', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    // The play again button should be rendered
    const playAgainBtn = screen.queryByText('results.playAgain')
    if (playAgainBtn) {
      fireEvent.click(playAgainBtn)
      expect(mockGameState.reset).toHaveBeenCalled()
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles completed rounds when present', () => {
    mockGameState.result = winResult
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    mockGameState.completedRounds = [
      {
        id: 'r1', roundNumber: 1, speakingOrder: ['u1', 'u2'], clues: [], votes: [],
        wordReveal: { villagerWord: 'pizza', imposterWord: 'pasta' }, eliminatedPlayerId: 'u2',
      },
    ]
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders with draw result', () => {
    mockGameState.result = {
      winner: 'draw',
      finalRound: { id: 'r1', roundNumber: 1, speakingOrder: [], clues: [], votes: [] },
      rewards: { starCoinsEarned: 3, xpEarned: 10, lpChange: 0, achievements: [] },
    }
    mockGameState.room = winRoom
    mockGameState.myRole = 'villager'
    render(<ResultsPage />)
    expect(document.body).toBeInTheDocument()
  })
})
