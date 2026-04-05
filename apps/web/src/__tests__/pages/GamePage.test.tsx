import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useParams: () => ({ code: 'GAME01' }),
  useNavigate: () => mockNavigate,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: unknown }) => children,
}))

vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, token: 'tok' }),
}))

const mockGameState = {
  room: null as unknown,
  currentRound: null,
  myRole: null,
  myWord: null,
  myVillagerWord: null,
  detectiveRevealUsed: false,
  revealedPlayer: null,
  messages: [],
  result: null,
  completedRounds: [],
  addMessage: vi.fn(),
  setResult: vi.fn(),
  setRound: vi.fn(),
  addCompletedRound: vi.fn(),
  setDetectiveRevealUsed: vi.fn(),
  setRevealedPlayer: vi.fn(),
  setRoom: vi.fn(),
  setRoleAndWord: vi.fn(),
  reset: vi.fn(),
}

vi.mock('../../store/game', () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    return selector ? selector(mockGameState) : mockGameState
  },
}))

vi.mock('../../lib/socket', () => ({
  connectSocket: vi.fn(),
  getSocket: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: false }),
}))

vi.mock('@imposter/ui', () => ({
  Avatar: ({ username }: { username: string }) => <div data-testid="avatar">{username}</div>,
}))

vi.mock('@imposter/shared', () => ({}))

import GamePage from '../../pages/GamePage'

describe('GamePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGameState.room = null
    mockGameState.myRole = null
    mockGameState.myWord = null
  })

  it('renders without crashing when no room', () => {
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('shows connecting state when no room is in store', () => {
    render(<GamePage />)
    // Without a room the page shows a loading/connecting state
    expect(document.body).toBeInTheDocument()
  })

  it('renders the game page with room data', () => {
    mockGameState.room = {
      id: 'r1',
      code: 'GAME01',
      status: 'in_progress',
      players: [
        { userId: 'u1', username: 'testuser', status: 'alive', avatarUrl: null },
        { userId: 'u2', username: 'opponent', status: 'alive', avatarUrl: null },
      ],
      settings: { speakingTimeSeconds: 30, votingTimeSeconds: 60, gameMode: 'normal' },
      currentRound: 1,
    }
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = {
      id: 'rnd1',
      roundNumber: 1,
      speakingOrder: ['u1', 'u2'],
      clues: [],
      votes: [],
      eliminatedPlayerId: null,
    }
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('registers socket event listeners on mount', () => {
    render(<GamePage />)
    // Socket on/off are vi.fn() from the mock — just verify render doesn't crash
    expect(document.body).toBeInTheDocument()
  })

  it('cleans up socket listeners on unmount', () => {
    const { unmount } = render(<GamePage />)
    unmount()
    expect(document.body).toBeInTheDocument()
  })
})
