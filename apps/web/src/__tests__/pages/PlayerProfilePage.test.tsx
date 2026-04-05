import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useParams: () => ({ userId: 'u2' }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: unknown; to: string }) => <a href={to}>{children as React.ReactNode}</a>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) =>
      typeof fallback === 'string' ? fallback : key,
    i18n: { language: 'en' },
  }),
}))

const mockApiGet = vi.fn()
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

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

const fullProfile = {
  id: 'u2',
  username: 'player2',
  avatarUrl: null,
  rankTier: 'silver' as const,
  rankPoints: 600,
  honorPoints: 10,
  createdAt: new Date('2023-01-01').toISOString(),
  stats: { totalGames: 20, wins: 12, losses: 8, winRate: 60, asVillager: 15, asImposter: 5, survived: 10 },
  recentGames: [
    { gameId: 'g1', role: 'villager', survived: true, winnerTeam: 'villagers', didWin: true, rounds: 3, playedAt: new Date().toISOString() },
    { gameId: 'g2', role: 'imposter', survived: false, winnerTeam: 'villagers', didWin: false, rounds: 2, playedAt: new Date().toISOString() },
  ],
  honors: [
    { type: 'teamplayer', count: 5 },
    { type: 'sharp_mind', count: 3 },
  ],
}

import PlayerProfilePage from '../../pages/PlayerProfilePage'

describe('PlayerProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue(fullProfile)
  })

  it('renders without crashing', () => {
    render(<PlayerProfilePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    render(<PlayerProfilePage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows loading state while data is pending', () => {
    mockApiGet.mockReturnValueOnce(new Promise(() => {}))
    render(<PlayerProfilePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('fetches profile for given userId on mount', async () => {
    render(<PlayerProfilePage />)
    expect(mockApiGet).toHaveBeenCalledWith('/users/u2/profile')
  })

  it('renders player profile data after loading', async () => {
    await act(async () => {
      render(<PlayerProfilePage />)
    })
    await waitFor(() => {
      expect(screen.getByText('player2')).toBeInTheDocument()
    })
  })

  it('renders stats grid with correct values', async () => {
    await act(async () => {
      render(<PlayerProfilePage />)
    })
    await waitFor(() => {
      // Total games
      expect(screen.getByText('20')).toBeInTheDocument()
      // Wins
      expect(screen.getByText('12')).toBeInTheDocument()
    })
  })

  it('renders honor badges when honors exist', async () => {
    await act(async () => {
      render(<PlayerProfilePage />)
    })
    await waitFor(() => {
      expect(screen.getByText('Team Player')).toBeInTheDocument()
      expect(screen.getByText('Sharp Mind')).toBeInTheDocument()
    })
  })

  it('renders recent games list', async () => {
    await act(async () => {
      render(<PlayerProfilePage />)
    })
    await waitFor(() => {
      expect(screen.getByText('playerProfile.recentGames')).toBeInTheDocument()
    })
  })

  it('shows error state when API fails', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('User not found'))
    await act(async () => {
      render(<PlayerProfilePage />)
    })
    await waitFor(() => {
      expect(screen.getByText('playerProfile.loadError')).toBeInTheDocument()
    })
  })

  it('navigates back when back button clicked', async () => {
    await act(async () => {
      render(<PlayerProfilePage />)
    })
    await waitFor(() => {
      const backBtn = screen.getAllByText('playerProfile.back')[0]
      fireEvent.click(backBtn)
    })
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('navigates back on error back button', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Error'))
    await act(async () => {
      render(<PlayerProfilePage />)
    })
    await waitFor(() => {
      fireEvent.click(screen.getByText('playerProfile.back'))
    })
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('shows no games message when recentGames is empty', async () => {
    mockApiGet.mockResolvedValueOnce({ ...fullProfile, recentGames: [] })
    await act(async () => {
      render(<PlayerProfilePage />)
    })
    await waitFor(() => {
      expect(screen.getByText('playerProfile.noGames')).toBeInTheDocument()
    })
  })

  it('does not show honors section when honors array is empty', async () => {
    mockApiGet.mockResolvedValueOnce({ ...fullProfile, honors: [] })
    await act(async () => {
      render(<PlayerProfilePage />)
    })
    await waitFor(() => {
      expect(screen.queryByText('playerProfile.honorsReceived')).not.toBeInTheDocument()
    })
  })
})
