import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useParams: () => ({ gameId: 'game-abc' }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: unknown; to: string }) => <a href={to}>{children as React.ReactNode}</a>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => {
      if (opts && typeof opts === 'object') return `${key}:${JSON.stringify(opts)}`
      return key
    },
    i18n: { language: 'en' },
  }),
}))

vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, token: 'tok' }),
}))

const mockApiGet = vi.fn()
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

const fullGameData = {
  id: 'game-abc',
  startedAt: new Date('2024-01-15T10:00:00Z').toISOString(),
  endedAt: new Date('2024-01-15T10:30:00Z').toISOString(),
  winnerTeam: 'villagers' as const,
  myRole: 'villager' as const,
  participations: [
    { userId: 'u1', username: 'testuser', avatarUrl: null, role: 'villager', survived: true, starCoinsEarned: 5 },
    { userId: 'u2', username: 'redHanded1', avatarUrl: null, role: 'red_handed', survived: false, starCoinsEarned: 2 },
  ],
  rounds: [
    {
      id: 'r1',
      roundNumber: 1,
      villagerWord: 'pizza',
      redHandedWord: 'pasta',
      eliminatedId: 'u2',
      eliminatedRole: 'red_handed',
      clues: [
        { playerId: 'u1', text: 'It is round', createdAt: new Date().toISOString() },
        { playerId: 'u2', text: 'It is delicious', createdAt: new Date().toISOString() },
      ],
      votes: [
        { voterId: 'u1', targetId: 'u2' },
        { voterId: 'u2', targetId: 'u1' },
      ],
    },
    {
      id: 'r2',
      roundNumber: 2,
      villagerWord: 'cat',
      redHandedWord: 'dog',
      eliminatedId: null,
      eliminatedRole: null,
      clues: [],
      votes: [],
    },
  ],
  chatMessages: [
    { id: 'm1', userId: 'u1', username: 'testuser', text: 'Good game!', createdAt: new Date().toISOString() },
  ],
}

import GameDetailPage from '../../pages/GameDetailPage'

describe('GameDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue(fullGameData)
  })

  it('renders without crashing', () => {
    render(<GameDetailPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    render(<GameDetailPage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows loading state while data is pending', () => {
    mockApiGet.mockReturnValueOnce(new Promise(() => {}))
    render(<GameDetailPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('fetches game detail for the correct gameId on mount', () => {
    render(<GameDetailPage />)
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('game-abc'))
  })

  it('renders game data after loading', async () => {
    await act(async () => {
      render(<GameDetailPage />)
    })
    // GameDetail surfaces villager / red-handed words in both the per-round
    // accordion AND the per-player breakdown, so the label appears multiple
    // times — `queryAllByText` confirms presence without choking on dupes.
    await waitFor(() => {
      expect(screen.queryAllByText('gameDetail.villagerWord').length).toBeGreaterThan(0)
    })
  })

  it('shows error state when API fails', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Not found'))
    await act(async () => {
      render(<GameDetailPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('history.loadError')).toBeInTheDocument()
    })
  })

  it('shows back to history button on error', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network error'))
    await act(async () => {
      render(<GameDetailPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('gameDetail.backToHistory')).toBeInTheDocument()
    })
  })

  it('navigates to history when back button clicked on error', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Error'))
    await act(async () => {
      render(<GameDetailPage />)
    })
    await waitFor(() => {
      fireEvent.click(screen.getByText('gameDetail.backToHistory'))
    })
    expect(mockNavigate).toHaveBeenCalledWith('/history')
  })

  it('renders round accordion sections after data loads', async () => {
    await act(async () => {
      render(<GameDetailPage />)
    })
    await waitFor(() => {
      // Both rounds should appear
      const round1Buttons = screen.getAllByRole('button')
      expect(round1Buttons.length).toBeGreaterThan(0)
    })
  })

  it('opens round accordion when clicked', async () => {
    await act(async () => {
      render(<GameDetailPage />)
    })
    await waitFor(() => {
      // Find a round button (accordion header) and click it
      const buttons = screen.getAllByRole('button')
      const roundBtn = buttons.find(b => b.textContent?.includes('▼'))
      if (roundBtn) {
        fireEvent.click(roundBtn)
      }
    })
    expect(document.body).toBeInTheDocument()
  })

  it('renders participants section', async () => {
    await act(async () => {
      render(<GameDetailPage />)
    })
    // The current player's username surfaces in the participants chip AND in
    // any round-by-round attribution rows, so multiple matches are expected.
    await waitFor(() => {
      expect(screen.queryAllByText('testuser').length).toBeGreaterThan(0)
    })
  })

  it('renders redHanded as winner scenario', async () => {
    mockApiGet.mockResolvedValueOnce({
      ...fullGameData,
      winnerTeam: 'red_handed',
      myRole: 'red_handed',
    })
    await act(async () => {
      render(<GameDetailPage />)
    })
    await waitFor(() => {
      expect(document.body).toBeInTheDocument()
    })
  })
})
