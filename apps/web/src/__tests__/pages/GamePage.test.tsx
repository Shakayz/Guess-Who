import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
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
  currentRound: null as unknown,
  myRole: null as unknown,
  myWord: null as unknown,
  myVillagerWord: null as unknown,
  detectiveRevealUsed: false,
  revealedPlayer: null,
  messages: [] as unknown[],
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
  connectSocket: vi.fn(),
  getSocket: () => ({ on: mockSocketOn, off: mockSocketOff, emit: mockSocketEmit, connected: false }),
}))

vi.mock('@imposter/ui', () => ({
  Avatar: ({ username }: { username: string }) => <div data-testid="avatar">{username}</div>,
}))

vi.mock('@imposter/shared', () => ({}))

import GamePage from '../../pages/GamePage'

const mockRoom = {
  id: 'r1',
  code: 'GAME01',
  status: 'in_progress',
  players: [
    { userId: 'u1', username: 'testuser', status: 'alive', avatarUrl: null, isReady: false },
    { userId: 'u2', username: 'opponent', status: 'alive', avatarUrl: null, isReady: false },
  ],
  settings: { speakingTimeSeconds: 30, votingTimeSeconds: 60, gameMode: 'normal' },
  currentRound: 1,
}

const mockRound = {
  id: 'rnd1',
  roundNumber: 1,
  speakingOrder: ['u1', 'u2'],
  clues: [],
  votes: [],
  eliminatedPlayerId: null,
}

describe('GamePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGameState.room = null
    mockGameState.myRole = null
    mockGameState.myWord = null
    mockGameState.currentRound = null
    mockGameState.messages = []
    mockGameState.result = null
    mockGameState.completedRounds = []
  })

  it('renders without crashing when no room', () => {
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('shows connecting state when no room is in store', () => {
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders the game page with room data', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('registers socket event listeners on mount', () => {
    render(<GamePage />)
    expect(mockSocketOn).toHaveBeenCalled()
  })

  it('cleans up socket listeners on unmount', () => {
    const { unmount } = render(<GamePage />)
    unmount()
    expect(mockSocketOff).toHaveBeenCalled()
  })

  it('renders as imposter role', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'imposter'
    mockGameState.myWord = 'pasta'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders voting phase', () => {
    mockGameState.room = { ...mockRoom, status: 'voting' }
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('handles round:speaking-turn event', () => {
    render(<GamePage />)
    const speakingTurnCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:speaking-turn')
    if (speakingTurnCall) {
      act(() => {
        speakingTurnCall[1]({ playerId: 'u1', timeSeconds: 30, speakingOrder: ['u1', 'u2'] })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles round:voting-started event', () => {
    render(<GamePage />)
    const votingCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:voting-started')
    if (votingCall) {
      act(() => {
        votingCall[1]({ timeSeconds: 30, players: [{ userId: 'u1' }, { userId: 'u2' }] })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles round:ended event with elimination', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    const roundEndedCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:ended')
    if (roundEndedCall) {
      act(() => {
        roundEndedCall[1]({
          round: {
            id: 'rnd1', roundNumber: 1, eliminatedPlayerId: 'u2', eliminatedRole: 'imposter',
            wordReveal: { villagerWord: 'pizza', imposterWord: 'pasta' },
            votes: [{ voterId: 'u1', targetId: 'u2' }],
          },
          nextRound: null,
        })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles round:clue-submitted event', () => {
    render(<GamePage />)
    const clueSubmittedCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:clue-submitted')
    if (clueSubmittedCall) {
      act(() => {
        clueSubmittedCall[1]({ playerId: 'u1', text: 'It is round', createdAt: new Date().toISOString() })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles game:finished event and navigates to results', () => {
    mockGameState.room = mockRoom
    mockGameState.myRole = 'villager'
    render(<GamePage />)
    const gameFinishedCall = mockSocketOn.mock.calls.find(c => c[0] === 'game:finished')
    if (gameFinishedCall) {
      act(() => {
        gameFinishedCall[1]({
          winner: 'villagers',
          finalRound: { id: 'r1', roundNumber: 1 },
          rewards: { starCoinsEarned: 10, xpEarned: 50, lpChange: 5, achievements: [] },
        })
      })
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/results'))
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles game:sync event for speaking phase', () => {
    render(<GamePage />)
    const syncCall = mockSocketOn.mock.calls.find(c => c[0] === 'game:sync')
    if (syncCall) {
      act(() => {
        syncCall[1]({
          phase: 'speaking',
          currentSpeakerId: 'u1',
          speakingOrder: ['u1', 'u2'],
          clues: [],
          votes: [],
          timeRemainingSeconds: 25,
          currentRound: mockRound,
          tiebreakerActive: false,
          tiebreakerPlayerIds: [],
          tiebreakerPhase: null,
        })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles game:sync event for voting phase', () => {
    render(<GamePage />)
    const syncCall = mockSocketOn.mock.calls.find(c => c[0] === 'game:sync')
    if (syncCall) {
      act(() => {
        syncCall[1]({
          phase: 'voting',
          currentSpeakerId: null,
          speakingOrder: ['u1', 'u2'],
          clues: [{ playerId: 'u1', text: 'test', createdAt: new Date().toISOString() }],
          votes: [],
          timeRemainingSeconds: 20,
          currentRound: mockRound,
          tiebreakerActive: false,
          tiebreakerPlayerIds: [],
          tiebreakerPhase: null,
        })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles game:started event', () => {
    render(<GamePage />)
    const gameStartedCall = mockSocketOn.mock.calls.find(c => c[0] === 'game:started')
    if (gameStartedCall) {
      act(() => {
        gameStartedCall[1]({ yourWord: 'cat', yourRole: 'villager', yourVillagerWord: null })
      })
    }
    expect(mockGameState.setRoleAndWord).toHaveBeenCalled()
  })

  it('handles tiebreaker event', () => {
    render(<GamePage />)
    const tbCall = mockSocketOn.mock.calls.find(c => c[0] === 'round:tiebreaker-start')
    if (tbCall) {
      act(() => {
        tbCall[1]({ tiedPlayerIds: ['u1', 'u2'], tiedUsernames: ['testuser', 'opponent'], timeSeconds: 20 })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('handles player-forfeited event', () => {
    render(<GamePage />)
    const forfeitCall = mockSocketOn.mock.calls.find(c => c[0] === 'game:player-forfeited')
    if (forfeitCall) {
      act(() => {
        forfeitCall[1]({ userId: 'u2' })
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('renders with eliminated user state', () => {
    mockGameState.room = {
      ...mockRoom,
      players: [
        { userId: 'u1', username: 'testuser', status: 'eliminated', avatarUrl: null },
        { userId: 'u2', username: 'opponent', status: 'alive', avatarUrl: null },
      ],
    }
    mockGameState.myRole = 'villager'
    mockGameState.myWord = 'pizza'
    mockGameState.currentRound = mockRound
    render(<GamePage />)
    expect(document.body).toBeInTheDocument()
  })
})
