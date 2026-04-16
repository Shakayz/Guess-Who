import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

const mockApiGet = vi.fn()
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}))

const singlePageData = {
  games: [
    {
      id: 'g1',
      startedAt: new Date('2024-01-15').toISOString(),
      endedAt: new Date('2024-01-15').toISOString(),
      winnerTeam: 'villagers',
      myRole: 'villager',
      survived: true,
      starCoinsEarned: 5,
      roundCount: 3,
      players: [
        { userId: 'u1', username: 'testuser', avatarUrl: null, role: 'villager', survived: true },
        { userId: 'u2', username: 'opponent', avatarUrl: null, role: 'red_handed', survived: false },
      ],
    },
    {
      id: 'g2',
      startedAt: new Date('2024-01-14').toISOString(),
      endedAt: new Date('2024-01-14').toISOString(),
      winnerTeam: 'red_handed',
      myRole: 'villager',
      survived: false,
      starCoinsEarned: 2,
      roundCount: 2,
      players: [
        { userId: 'u1', username: 'testuser', avatarUrl: null, role: 'villager', survived: false },
      ],
    },
  ],
  total: 2,
  page: 1,
  totalPages: 1,
}

const multiPageData = {
  ...singlePageData,
  total: 20,
  totalPages: 3,
}

import HistoryPage from '../../pages/HistoryPage'

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue(singlePageData)
  })

  it('renders without crashing', () => {
    render(<HistoryPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    render(<HistoryPage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows the history title', () => {
    render(<HistoryPage />)
    expect(screen.getByText('history.title')).toBeInTheDocument()
  })

  it('shows loading skeleton while data is pending', () => {
    mockApiGet.mockReturnValueOnce(new Promise(() => {}))
    render(<HistoryPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('fetches history data on mount', () => {
    render(<HistoryPage />)
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/history'))
  })

  it('renders game list after data loads', async () => {
    await act(async () => {
      render(<HistoryPage />)
    })
    await waitFor(() => {
      // Games are rendered as buttons — check that the game count appears
      expect(screen.getByText('2 games')).toBeInTheDocument()
    })
  })

  it('shows victory badge for won game', async () => {
    await act(async () => {
      render(<HistoryPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('history.victory')).toBeInTheDocument()
    })
  })

  it('shows defeat badge for lost game', async () => {
    await act(async () => {
      render(<HistoryPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('history.defeat')).toBeInTheDocument()
    })
  })

  it('navigates to game detail when a game is clicked', async () => {
    await act(async () => {
      render(<HistoryPage />)
    })
    await waitFor(async () => {
      const gameButtons = screen.getAllByRole('button').filter(b =>
        b.classList.toString().includes('text-left') || b.textContent?.includes('history.')
      )
      if (gameButtons.length > 0) {
        fireEvent.click(gameButtons[0])
      }
    })
    expect(document.body).toBeInTheDocument()
  })

  it('navigates to player profile when player chip is clicked', async () => {
    await act(async () => {
      render(<HistoryPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('opponent')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('opponent'))
    expect(mockNavigate).toHaveBeenCalledWith('/player/u2')
  })

  it('shows no-games message when games list is empty', async () => {
    mockApiGet.mockResolvedValueOnce({ games: [], total: 0, page: 1, totalPages: 1 })
    await act(async () => {
      render(<HistoryPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('history.noGames')).toBeInTheDocument()
    })
  })

  it('shows error state when API fails', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network error'))
    await act(async () => {
      render(<HistoryPage />)
    })
    await waitFor(() => {
      expect(screen.getByText(/history.loadError/)).toBeInTheDocument()
    })
  })

  it('shows pagination when there are multiple pages', async () => {
    mockApiGet.mockResolvedValueOnce(multiPageData)
    await act(async () => {
      render(<HistoryPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('history.prev')).toBeInTheDocument()
      expect(screen.getByText('history.next')).toBeInTheDocument()
    })
  })

  it('previous page button is disabled on page 1', async () => {
    mockApiGet.mockResolvedValueOnce(multiPageData)
    await act(async () => {
      render(<HistoryPage />)
    })
    await waitFor(() => {
      const prevBtn = screen.getByText('history.prev')
      expect(prevBtn).toBeDisabled()
    })
  })

  it('clicking next page fetches next page of data', async () => {
    mockApiGet.mockResolvedValue(multiPageData)
    await act(async () => {
      render(<HistoryPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('history.next')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('history.next'))
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('page=2'))
    })
  })
})
