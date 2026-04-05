import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mocks ----
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
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

vi.mock('../../lib/socket', () => ({
  connectSocket: vi.fn(),
  getSocket: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: false }),
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

vi.mock('@imposter/shared', () => ({
  WORD_CATEGORIES: [
    { key: 'food', label: 'Food', icon: '🍕' },
    { key: 'animals', label: 'Animals', icon: '🐶' },
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
    expect(screen.getByText(/Imposter/i)).toBeInTheDocument()
  })

  it('renders the NavBar', () => {
    render(<HomePage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows mode selection cards', () => {
    render(<HomePage />)
    expect(screen.getByText('home.normalLabel')).toBeInTheDocument()
    expect(screen.getByText('home.rankedLabel')).toBeInTheDocument()
    expect(screen.getByText('home.lobbyLabel')).toBeInTheDocument()
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

  it('shows how to play modal on button click', () => {
    render(<HomePage />)
    const howToPlayBtn = screen.getByText('home.howToPlay')
    fireEvent.click(howToPlayBtn)
    expect(screen.getByText('home.htp.objective')).toBeInTheDocument()
  })

  it('creates a lobby room when lobby mode is selected and Create is clicked', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ code: 'LOBBY1' })
    render(<HomePage />)
    fireEvent.click(screen.getByText('home.lobbyLabel'))
    const createBtn = screen.getByText('home.createLobby')
    fireEvent.click(createBtn)
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/rooms', expect.any(Object))
    })
  })
})
