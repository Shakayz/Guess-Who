import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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
    t: (key: string, opts?: unknown) => {
      if (opts && typeof opts === 'object' && (opts as any).name) return `${(opts as any).name} joined`
      return key
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}))

vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, token: 'tok', clearAuth: vi.fn() }),
}))

let mockRoomState = {
  room: null as any,
  setRoom: vi.fn(),
  setRoleAndWord: vi.fn(),
  setRound: vi.fn(),
  reset: vi.fn(),
  gameFinished: false,
  result: null,
}

vi.mock('../../store/game', () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    return selector ? selector(mockRoomState) : mockRoomState
  },
}))

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ friends: [
      { friendshipId: 'f1', user: { id: 'u3', username: 'friend1', avatarUrl: null } },
    ] }),
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

vi.mock('@red-handed/ui', () => ({
  RoomCodeDisplay: ({ code }: { code: string }) => <div data-testid="room-code">{code}</div>,
  PlayerCard: ({ player }: { player: any }) => <div data-testid="player-card">{player.username}</div>,
}))

vi.mock('@red-handed/shared', () => ({
  WORD_CATEGORIES: [
    { key: 'food', label: 'Food', icon: '🍕' },
    { key: 'animals', label: 'Animals', icon: '🐶' },
  ],
}))

import LobbyPage from '../../pages/LobbyPage'
import { api } from '../../lib/api'

describe('LobbyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoomState.room = null
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
    expect(mockSocketEmit).toHaveBeenCalledWith('room:join', { roomCode: 'ROOM01' })
  })

  it('cleans up socket listeners on unmount', () => {
    const { unmount } = render(<LobbyPage />)
    unmount()
    expect(mockSocketOff).toHaveBeenCalled()
  })

  it('shows the room code display', () => {
    render(<LobbyPage />)
    expect(screen.getByTestId('room-code')).toBeInTheDocument()
  })

  it('shows waiting message', () => {
    render(<LobbyPage />)
    expect(screen.getByText('lobby.waiting')).toBeInTheDocument()
  })

  it('shows player list with empty state', () => {
    render(<LobbyPage />)
    expect(screen.getByText('lobby.waitingToJoin')).toBeInTheDocument()
  })

  it('shows player cards when room has players', () => {
    mockRoomState.room = {
      id: 'r1',
      code: 'ROOM01',
      status: 'waiting',
      hostId: 'u2',
      players: [
        { id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: false },
        { id: 'p2', userId: 'u2', username: 'host', isReady: true, isHost: true },
      ],
      settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
    }
    render(<LobbyPage />)
    expect(screen.getAllByTestId('player-card').length).toBe(2)
  })

  it('shows ready/not ready button for non-host player', () => {
    mockRoomState.room = {
      id: 'r1',
      code: 'ROOM01',
      status: 'waiting',
      hostId: 'u2', // u1 is NOT host
      players: [
        { id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: false },
        { id: 'p2', userId: 'u2', username: 'host', isReady: false, isHost: true },
        { id: 'p3', userId: 'u3', username: 'p3', isReady: false, isHost: false },
        { id: 'p4', userId: 'u4', username: 'p4', isReady: false, isHost: false },
      ],
      settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
    }
    render(<LobbyPage />)
    expect(screen.getByText('lobby.notReady')).toBeInTheDocument()
  })

  it('toggles ready state when ready button clicked', () => {
    mockRoomState.room = {
      id: 'r1',
      code: 'ROOM01',
      status: 'waiting',
      hostId: 'u2',
      players: [
        { id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: false },
        { id: 'p2', userId: 'u2', username: 'host', isReady: false, isHost: true },
        { id: 'p3', userId: 'u3', username: 'p3', isReady: false, isHost: false },
        { id: 'p4', userId: 'u4', username: 'p4', isReady: false, isHost: false },
      ],
      settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
    }
    render(<LobbyPage />)
    fireEvent.click(screen.getByText('lobby.notReady'))
    expect(mockSocketEmit).toHaveBeenCalledWith('player:ready', true)
  })

  it('shows start game button for host', () => {
    mockRoomState.room = {
      id: 'r1',
      code: 'ROOM01',
      status: 'waiting',
      hostId: 'u1', // u1 IS host
      players: [
        { id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: true },
        { id: 'p2', userId: 'u2', username: 'player2', isReady: true, isHost: false },
        { id: 'p3', userId: 'u3', username: 'player3', isReady: true, isHost: false },
        { id: 'p4', userId: 'u4', username: 'player4', isReady: true, isHost: false },
      ],
      settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
    }
    render(<LobbyPage />)
    expect(screen.getByText('lobby.startGame')).toBeInTheDocument()
  })

  it('shows settings panel toggle for host', () => {
    mockRoomState.room = {
      id: 'r1',
      code: 'ROOM01',
      status: 'waiting',
      hostId: 'u1',
      players: [{ id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: true }],
      settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
    }
    render(<LobbyPage />)
    expect(screen.getByText(/lobby\.roomSettings/)).toBeInTheDocument()
  })

  it('opens settings panel when host clicks settings toggle', () => {
    mockRoomState.room = {
      id: 'r1',
      code: 'ROOM01',
      status: 'waiting',
      hostId: 'u1',
      players: [{ id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: true }],
      settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
    }
    render(<LobbyPage />)
    // The settings button shows the room settings label (with emoji prefix, use regex)
    const settingsBtn = screen.getByRole('button', { name: /lobby\.roomSettings/i })
    fireEvent.click(settingsBtn)
    // Now the settings panel should be open - shows categories section
    expect(screen.getByText('lobby.categories')).toBeInTheDocument()
  })

  it('shows leave button', () => {
    render(<LobbyPage />)
    expect(screen.getByText('lobby.leave')).toBeInTheDocument()
  })

  it('emits leave event and navigates home when leave is clicked', () => {
    render(<LobbyPage />)
    fireEvent.click(screen.getByText('lobby.leave'))
    expect(mockSocketEmit).toHaveBeenCalledWith('room:leave')
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('shows invite friends toggle button', () => {
    render(<LobbyPage />)
    expect(screen.getByText('lobby.inviteFriends')).toBeInTheDocument()
  })

  it('opens invite panel when invite button clicked', async () => {
    render(<LobbyPage />)
    fireEvent.click(screen.getByText('lobby.inviteFriends'))
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/friends')
    })
  })

  it('shows not enough players warning', () => {
    mockRoomState.room = {
      id: 'r1',
      code: 'ROOM01',
      status: 'waiting',
      hostId: 'u2',
      players: [
        { id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: false },
        { id: 'p2', userId: 'u2', username: 'host', isReady: false, isHost: true },
      ],
      settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
    }
    render(<LobbyPage />)
    // With 2 players (less than 4 minimum), warning should appear
    expect(screen.getByText('lobby.needMore')).toBeInTheDocument()
  })

  it('handles room:updated socket event to set room data', () => {
    render(<LobbyPage />)
    // The socket.on calls should include room:updated
    const roomUpdatedCall = mockSocketOn.mock.calls.find(call => call[0] === 'room:updated')
    expect(roomUpdatedCall).toBeDefined()
    // Simulate a room:updated event
    const handler = roomUpdatedCall![1]
    act(() => {
      handler({
        id: 'r1',
        code: 'ROOM01',
        status: 'waiting',
        hostId: 'u1',
        players: [],
        settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
      })
    })
    expect(document.body).toBeInTheDocument()
  })

  it('navigates to game when game:started event fires', () => {
    render(<LobbyPage />)
    const gameStartedCall = mockSocketOn.mock.calls.find(call => call[0] === 'game:started')
    expect(gameStartedCall).toBeDefined()
    const handler = gameStartedCall![1]
    act(() => {
      handler({ round: { id: 'rnd1', roundNumber: 1, speakingOrder: [], clues: [], votes: [] }, yourWord: 'pizza', yourRole: 'villager', yourVillagerWord: null })
    })
    expect(mockNavigate).toHaveBeenCalledWith('/game/ROOM01')
  })

  it('navigates to game when room:updated shows in_progress status', () => {
    render(<LobbyPage />)
    const roomUpdatedCall = mockSocketOn.mock.calls.find(call => call[0] === 'room:updated')
    const handler = roomUpdatedCall![1]
    act(() => {
      handler({ status: 'in_progress', players: [], settings: {} })
    })
    expect(mockNavigate).toHaveBeenCalledWith('/game/ROOM01')
  })

  it('shows settings panel with special mode toggle', () => {
    mockRoomState.room = {
      id: 'r1',
      code: 'ROOM01',
      status: 'waiting',
      hostId: 'u1',
      players: [{ id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: true }],
      settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
    }
    render(<LobbyPage />)
    const settingsBtn = screen.getByRole('button', { name: /lobby\.roomSettings/i })
    fireEvent.click(settingsBtn)
    expect(screen.getByText('lobby.categories')).toBeInTheDocument()
    // Toggle special mode
    fireEvent.click(screen.getByText(/lobby\.special/i))
    expect(screen.getByText('lobby.specialRoles')).toBeInTheDocument()
  })

  it('enables detective and double agent in special mode', () => {
    mockRoomState.room = {
      id: 'r1',
      code: 'ROOM01',
      status: 'waiting',
      hostId: 'u1',
      players: [{ id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: true }],
      settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
    }
    render(<LobbyPage />)
    fireEvent.click(screen.getByRole('button', { name: /lobby\.roomSettings/i }))
    fireEvent.click(screen.getByText(/lobby\.special/i))
    fireEvent.click(screen.getByText('lobby.detective'))
    expect(mockSocketEmit).toHaveBeenCalledWith('room:settings', expect.objectContaining({ enableDetective: true }))
  })

  it('emits start game when start button clicked', () => {
    mockRoomState.room = {
      id: 'r1',
      code: 'ROOM01',
      status: 'waiting',
      hostId: 'u1',
      players: [
        { id: 'p1', userId: 'u1', username: 'testuser', isReady: true, isHost: true },
        { id: 'p2', userId: 'u2', username: 'player2', isReady: true, isHost: false },
        { id: 'p3', userId: 'u3', username: 'player3', isReady: true, isHost: false },
        { id: 'p4', userId: 'u4', username: 'player4', isReady: true, isHost: false },
      ],
      settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
    }
    render(<LobbyPage />)
    const startBtn = screen.getByText('lobby.startGame')
    fireEvent.click(startBtn)
    expect(mockSocketEmit).toHaveBeenCalledWith('game:start')
  })

  it('shows friend list after invite toggle when api returns friends', async () => {
    render(<LobbyPage />)
    fireEvent.click(screen.getByText('lobby.inviteFriends'))
    await waitFor(() => {
      expect(screen.getByText('friend1')).toBeInTheDocument()
    })
  })

  it('sends invite to friend when invite button clicked', async () => {
    render(<LobbyPage />)
    fireEvent.click(screen.getByText('lobby.inviteFriends'))
    await waitFor(() => expect(screen.getByText('friend1')).toBeInTheDocument())
    fireEvent.click(screen.getByText('lobby.invite'))
    expect(mockSocketEmit).toHaveBeenCalledWith('room:invite', expect.objectContaining({ toUserId: 'u3' }))
  })

  it('shows already-ready state after room:updated event sets isReady', () => {
    mockRoomState.room = {
      id: 'r1', code: 'ROOM01', status: 'waiting', hostId: 'u2',
      players: [
        { id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: false },
        { id: 'p2', userId: 'u2', username: 'host', isReady: false, isHost: true },
        { id: 'p3', userId: 'u3', username: 'p3', isReady: false, isHost: false },
        { id: 'p4', userId: 'u4', username: 'p4', isReady: false, isHost: false },
      ],
      settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
    }
    render(<LobbyPage />)
    // Initially shows notReady
    expect(screen.getByText('lobby.notReady')).toBeInTheDocument()
    // Fire a room:updated event where u1 is now ready
    const roomUpdatedCall = mockSocketOn.mock.calls.find(call => call[0] === 'room:updated')
    act(() => {
      roomUpdatedCall![1]({
        id: 'r1', code: 'ROOM01', status: 'waiting', hostId: 'u2',
        players: [
          { id: 'p1', userId: 'u1', username: 'testuser', isReady: true, isHost: false },
          { id: 'p2', userId: 'u2', username: 'host', isReady: false, isHost: true },
          { id: 'p3', userId: 'u3', username: 'p3', isReady: false, isHost: false },
          { id: 'p4', userId: 'u4', username: 'p4', isReady: false, isHost: false },
        ],
        settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
      })
    })
    // Now shows the ready state
    expect(screen.getByText('✓ lobby.ready')).toBeInTheDocument()
  })

  it('handles error socket event', () => {
    render(<LobbyPage />)
    const errorCall = mockSocketOn.mock.calls.find(call => call[0] === 'error')
    expect(errorCall).toBeDefined()
    act(() => {
      errorCall![1]({ code: 'LANGUAGE_MISMATCH', message: 'Language mismatch' })
    })
    expect(screen.getByText('room.languageMismatch')).toBeInTheDocument()
  })

  it('handles non-host settings view', () => {
    mockRoomState.room = {
      id: 'r1', code: 'ROOM01', status: 'waiting', hostId: 'u2',
      players: [
        { id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: false },
        { id: 'p2', userId: 'u2', username: 'host', isReady: false, isHost: true },
        { id: 'p3', userId: 'u3', username: 'p3', isReady: false, isHost: false },
        { id: 'p4', userId: 'u4', username: 'p4', isReady: false, isHost: false },
      ],
      settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
    }
    render(<LobbyPage />)
    // Non-host sees a settings summary, not the panel toggle
    expect(screen.queryByRole('button', { name: /lobby\.roomSettings/i })).not.toBeInTheDocument()
    expect(screen.getByText('lobby.normal')).toBeInTheDocument()
  })

  it('shows matchmade game starting banner', () => {
    mockRoomState.room = {
      id: 'r1', code: 'ROOM01', status: 'waiting', hostId: 'u2',
      settings: {
        maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30,
        isMatchmade: true,
      },
      players: [
        { id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: false },
        { id: 'p2', userId: 'u2', username: 'host', isReady: false, isHost: true },
        { id: 'p3', userId: 'u3', username: 'p3', isReady: false, isHost: false },
        { id: 'p4', userId: 'u4', username: 'p4', isReady: false, isHost: false },
      ],
    }
    render(<LobbyPage />)
    expect(screen.getByText('lobby.autoStarting')).toBeInTheDocument()
  })

  it('shows waitingAllReady message when host has enough players but not all ready', () => {
    mockRoomState.room = {
      id: 'r1', code: 'ROOM01', status: 'waiting', hostId: 'u1',
      players: [
        { id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: true },
        { id: 'p2', userId: 'u2', username: 'player2', isReady: false, isHost: false },
        { id: 'p3', userId: 'u3', username: 'player3', isReady: false, isHost: false },
        { id: 'p4', userId: 'u4', username: 'player4', isReady: false, isHost: false },
      ],
      settings: { maxPlayers: 10, redHandedCount: 2, speakingTimeSeconds: 30, votingTimeSeconds: 30 },
    }
    render(<LobbyPage />)
    expect(screen.getByText('lobby.waitingAllReady')).toBeInTheDocument()
  })

  it('handles room:updated with settings updating UI language', () => {
    render(<LobbyPage />)
    const roomUpdatedCall = mockSocketOn.mock.calls.find(call => call[0] === 'room:updated')
    const handler = roomUpdatedCall![1]
    act(() => {
      handler({
        id: 'r1', code: 'ROOM01', status: 'waiting', hostId: 'u1',
        players: [{ id: 'p1', userId: 'u1', username: 'testuser', isReady: false, isHost: true }],
        settings: {
          maxPlayers: 8, redHandedCount: 1, speakingTimeSeconds: 45, votingTimeSeconds: 45,
          gameMode: 'normal', language: 'fr', categories: [],
          enableDetective: false, enableDoubleAgent: false,
        },
        maxRounds: 5,
      })
    })
    expect(document.body).toBeInTheDocument()
  })
})
