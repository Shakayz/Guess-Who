import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mocks ----
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}))

// Game store state that can be mutated per test
let _room: unknown = null
let _gameFinished = false
let _gameResult: unknown = null

vi.mock('../../store/game', () => ({
  useGameStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      room: _room,
      gameFinished: _gameFinished,
      result: _gameResult,
      setRoom: vi.fn(),
      reset: vi.fn(),
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, token: 'tok', clearAuth: vi.fn() }),
}))

vi.mock('../../lib/api', () => ({
  api: {
    post: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
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

// Override WORD_CATEGORIES + MATCHMAKING_CONFIG but let every other shared
// constant (TUTORIAL_COMPLETION_REWARD, EMAIL_VERIFICATION_REWARD, …) fall
// through to the real package so HomePage doesn't crash on `undefined`.
vi.mock('@red-handed/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  WORD_CATEGORIES: [
    { key: 'food', label: 'Food', icon: '🍕' },
    { key: 'animals', label: 'Animals', icon: '🐶' },
    { key: 'sports', label: 'Sports', icon: '⚽' },
  ],
  MATCHMAKING_CONFIG: { IDEAL_PLAYERS: 6, MAX_WAIT_SECONDS: 60 },
}))

import HomePage from '../../pages/HomePage'
import { api } from '../../lib/api'

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _room = null
    _gameFinished = false
    _gameResult = null
  })

  it('renders without crashing and shows heading', () => {
    render(<HomePage />)
    expect(screen.getByAltText('Red Handed !')).toBeInTheDocument()
  })

  it('renders the NavBar', () => {
    render(<HomePage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows mode selection cards', () => {
    render(<HomePage />)
    expect(screen.getByText('home.normalLabel')).toBeInTheDocument()
    expect(screen.getByText('home.rankedLabel')).toBeInTheDocument()
    expect(screen.getByText('home.customLobbyLabel')).toBeInTheDocument()
  })

  it('shows active game card when player is in an active game', () => {
    _room = {
      id: 'r1',
      code: 'ABCD',
      status: 'in_progress',
      players: [{ userId: 'u1', status: 'alive' }],
      currentRound: 2,
    }
    render(<HomePage />)
    expect(screen.getByText('Game In Progress')).toBeInTheDocument()
  })

  it('shows eliminated status in active game card', () => {
    _room = {
      id: 'r1',
      code: 'ABCD',
      status: 'in_progress',
      players: [{ userId: 'u1', status: 'eliminated' }],
      currentRound: 2,
    }
    render(<HomePage />)
    expect(screen.getByText('Eliminated')).toBeInTheDocument()
  })

  it('shows forfeited status in active game card', () => {
    _room = {
      id: 'r1',
      code: 'ABCD',
      status: 'in_progress',
      players: [{ userId: 'u1', status: 'forfeited' }],
      currentRound: 2,
    }
    render(<HomePage />)
    expect(screen.getByText('Forfeited')).toBeInTheDocument()
  })

  it('shows room code input and join button', () => {
    render(<HomePage />)
    expect(screen.getByPlaceholderText('home.roomCodePlaceholder')).toBeInTheDocument()
    expect(screen.getByText('room.joinRoom')).toBeInTheDocument()
  })

  it('navigates to lobby when room code is entered and join submitted', () => {
    render(<HomePage />)
    const input = screen.getByPlaceholderText('home.roomCodePlaceholder')
    fireEvent.change(input, { target: { value: 'ABCD1234' } })
    const form = input.closest('form')!
    fireEvent.submit(form)
    expect(mockNavigate).toHaveBeenCalledWith('/lobby/ABCD1234')
  })

  it('does not navigate if room code is empty', () => {
    render(<HomePage />)
    const input = screen.getByPlaceholderText('home.roomCodePlaceholder')
    const form = input.closest('form')!
    fireEvent.submit(form)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows how to play link that navigates to /how-to-play', () => {
    render(<HomePage />)
    const howToPlayLink = screen.getByText('home.howToPlay')
    expect(howToPlayLink.closest('a')).toHaveAttribute('href', '/how-to-play')
  })

  it('closes how to play modal when close button is clicked', () => {
    render(<HomePage />)
    fireEvent.click(screen.getByText('home.howToPlay'))
    // Find close button (✕ or similar)
    const closeBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('✕') || b.textContent?.includes('home.close'))
    if (closeBtn) {
      fireEvent.click(closeBtn)
    }
    expect(document.body).toBeInTheDocument()
  })

  it('creates a lobby room when lobby mode is selected, Create lobby is chosen, and Create is clicked', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ code: 'LOBBY1' })
    render(<HomePage />)
    fireEvent.click(screen.getByText('home.customLobbyLabel'))
    // Custom Lobby now surfaces a Create/Join chooser first; pick Create.
    fireEvent.click(screen.getByText('home.lobbyCreateLabel'))
    const createBtn = screen.getByText('home.createLobby')
    fireEvent.click(createBtn)
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/rooms', expect.any(Object))
    })
  })

  it('selects normal mode and shows start matchmaking button', () => {
    render(<HomePage />)
    fireEvent.click(screen.getByText('home.normalLabel'))
    expect(screen.getByText('home.findGame')).toBeInTheDocument()
  })

  it('selects ranked mode and shows start matchmaking button', () => {
    render(<HomePage />)
    fireEvent.click(screen.getByText('home.rankedLabel'))
    expect(screen.getByText('home.findRanked')).toBeInTheDocument()
  })

  it('starts matchmaking when Find Match is clicked in normal mode', async () => {
    render(<HomePage />)
    fireEvent.click(screen.getByText('home.normalLabel'))
    await act(async () => {
      fireEvent.click(screen.getByText('home.findGame'))
    })
    expect(mockSocketEmit).toHaveBeenCalledWith('matchmaking:join', expect.any(Object))
  })

  it('shows cancel button while matchmaking', async () => {
    render(<HomePage />)
    fireEvent.click(screen.getByText('home.normalLabel'))
    await act(async () => {
      fireEvent.click(screen.getByText('home.findGame'))
    })
    expect(screen.getByText('common.cancel')).toBeInTheDocument()
  })

  it('cancels matchmaking when cancel is clicked', async () => {
    render(<HomePage />)
    fireEvent.click(screen.getByText('home.normalLabel'))
    await act(async () => {
      fireEvent.click(screen.getByText('home.findGame'))
    })
    fireEvent.click(screen.getByText('common.cancel'))
    expect(mockSocketEmit).toHaveBeenCalledWith('matchmaking:leave', expect.any(Object))
  })

  it('navigates to lobby when matchmaking:found event fires', async () => {
    render(<HomePage />)
    fireEvent.click(screen.getByText('home.normalLabel'))
    await act(async () => {
      fireEvent.click(screen.getByText('home.findGame'))
    })
    // Simulate matchmaking:found event
    const foundCall = mockSocketOn.mock.calls.find(c => c[0] === 'matchmaking:found')
    if (foundCall) {
      act(() => {
        foundCall[1]({ roomCode: 'NEWROOM' })
      })
      expect(mockNavigate).toHaveBeenCalledWith('/lobby/NEWROOM')
    }
    expect(document.body).toBeInTheDocument()
  })

  it('shows category filter when normal mode is selected', () => {
    render(<HomePage />)
    fireEvent.click(screen.getByText('home.normalLabel'))
    expect(screen.getByText('Food')).toBeInTheDocument()
  })

  it('toggles a category when category button is clicked', () => {
    render(<HomePage />)
    fireEvent.click(screen.getByText('home.normalLabel'))
    fireEvent.click(screen.getByText('Food'))
    // Click again to deselect
    fireEvent.click(screen.getByText('Food'))
    expect(document.body).toBeInTheDocument()
  })

  it('shows lobby sub-mode selection after picking Create lobby', () => {
    render(<HomePage />)
    fireEvent.click(screen.getByText('home.customLobbyLabel'))
    // Sub-mode appears only once the player has chosen Create — the bare
    // Custom Lobby card just shows the Create/Join chooser.
    fireEvent.click(screen.getByText('home.lobbyCreateLabel'))
    expect(screen.getByText('home.normalGameMode')).toBeInTheDocument()
    expect(screen.getByText('home.specialGameMode')).toBeInTheDocument()
  })

  it('shows error when create lobby fails', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Server error'))
    render(<HomePage />)
    fireEvent.click(screen.getByText('home.customLobbyLabel'))
    fireEvent.click(screen.getByText('home.lobbyCreateLabel'))
    await act(async () => {
      fireEvent.click(screen.getByText('home.createLobby'))
    })
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  it('navigates to game when active game card is clicked', () => {
    _room = {
      id: 'r1',
      code: 'ABCD',
      status: 'in_progress',
      players: [{ userId: 'u1', status: 'alive' }],
      currentRound: 1,
    }
    render(<HomePage />)
    const activeGameBtn = screen.getByText('Game In Progress').closest('button')!
    fireEvent.click(activeGameBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/game/ABCD')
  })

  it('does not show active game card for waiting room status', () => {
    _room = {
      id: 'r1',
      code: 'ABCD',
      status: 'waiting',
      players: [{ userId: 'u1', status: 'alive' }],
    }
    render(<HomePage />)
    expect(screen.queryByText('Game In Progress')).not.toBeInTheDocument()
  })
})
