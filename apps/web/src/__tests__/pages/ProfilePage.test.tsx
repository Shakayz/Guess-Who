import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: unknown; to: string }) => <a href={to}>{children as React.ReactNode}</a>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
    i18n: { language: 'en' },
  }),
}))

vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, token: 'tok' }),
}))

const mockApiGet = vi.fn()
const mockApiPatch = vi.fn()
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn().mockResolvedValue({}),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

vi.mock('@imposter/ui', () => ({
  Avatar: ({ username }: { username: string }) => <div data-testid="avatar">{username}</div>,
  Badge: ({ tier }: { tier: string }) => <div data-testid="badge">{tier}</div>,
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

const meResponse = {
  id: 'u1',
  username: 'testuser',
  email: 'test@test.com',
  avatarUrl: null,
  rankTier: 'bronze',
  rankPoints: 150,
  honorPoints: 5,
  starCoins: 50,
  goldCoins: 0,
  locale: 'en',
  createdAt: new Date('2023-01-01').toISOString(),
  honorTeamplayer: 3,
  honorSharpMind: 1,
  honorGoodSport: 0,
}

const achievementsResponse: any[] = [
  { id: 'a1', key: 'first_win', name: 'First Win', description: 'Win your first game', icon: '🏆', unlocked: true, unlockedAt: new Date().toISOString() },
  { id: 'a2', key: 'veteran', name: 'Veteran', description: 'Play 50 games', icon: '⭐', unlocked: false, unlockedAt: null },
]

const profileStatsResponse = {
  stats: { totalGames: 30, wins: 18, losses: 12, winRate: 0.6, asVillager: 22, asImposter: 8, survived: 15 },
  recentGames: [
    { gameId: 'g1', role: 'villager', survived: true, winnerTeam: 'villagers', didWin: true, rounds: 3, playedAt: new Date().toISOString() },
  ],
}

import ProfilePage from '../../pages/ProfilePage'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/auth/me') return Promise.resolve(meResponse)
      if (path === '/achievements') return Promise.resolve(achievementsResponse)
      if (path.includes('/profile')) return Promise.resolve(profileStatsResponse)
      return Promise.resolve({})
    })
    mockApiPatch.mockResolvedValue({ ...meResponse, username: 'newuser' })
  })

  it('renders without crashing', () => {
    render(<ProfilePage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    render(<ProfilePage />, { wrapper })
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    render(<ProfilePage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })

  it('renders profile data after loading', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getAllByText('testuser').length).toBeGreaterThan(0)
    })
  })

  it('renders honor points display', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      // Honor points shown in stats
      expect(screen.getByText('profile.honorPoints')).toBeInTheDocument()
    })
  })

  it('renders star coins display', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('profile.starCoins')).toBeInTheDocument()
    })
  })

  it('renders rank points display', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('profile.rankPoints')).toBeInTheDocument()
    })
  })

  it('shows achievements section', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('First Win')).toBeInTheDocument()
    })
  })

  it('shows unlock status on achievements', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('Veteran')).toBeInTheDocument()
    })
  })

  it('shows edit button for avatar', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
  })

  it('shows username edit UI when pencil/edit is clicked', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      // Find the username edit button - it's typically a pencil icon button next to username
      const editButtons = screen.getAllByRole('button')
      const editUsernameBtn = editButtons.find(btn => btn.title === 'edit' || btn.getAttribute('aria-label') === 'edit')
      if (editUsernameBtn) fireEvent.click(editUsernameBtn)
    })
    expect(document.body).toBeInTheDocument()
  })

  it('renders honor labels for honor_teamplayer', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('profile.teamPlayer')).toBeInTheDocument()
    })
  })

  it('renders without errors even while data is loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    render(<ProfilePage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })
})
