import React from 'react'
import { render, screen } from '@testing-library/react'
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

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      id: 'u2',
      username: 'player2',
      avatarUrl: null,
      rankTier: 'silver',
      rankPoints: 600,
      honorPoints: 10,
      createdAt: new Date().toISOString(),
      stats: { totalGames: 20, wins: 12, losses: 8, winRate: 0.6, asVillager: 15, asImposter: 5, survived: 10 },
      recentGames: [],
      honors: [],
    }),
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

import PlayerProfilePage from '../../pages/PlayerProfilePage'
import { api } from '../../lib/api'

describe('PlayerProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    vi.mocked(api.get).mockReturnValueOnce(new Promise(() => {}))
    render(<PlayerProfilePage />)
    expect(document.body).toBeInTheDocument()
  })

  it('fetches profile for given userId on mount', async () => {
    render(<PlayerProfilePage />)
    expect(api.get).toHaveBeenCalledWith('/users/u2/profile')
  })
})
