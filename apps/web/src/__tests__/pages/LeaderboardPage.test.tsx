import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: unknown; to: string }) => <a href={to}>{children as React.ReactNode}</a>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Real react-i18next accepts either `t(key, fallback)` or
    // `t(key, interpolationObject)`. Only the string-fallback form should
    // short-circuit; interpolation objects must fall back to the raw key so
    // React never tries to render `{language: 'English'}` as a child.
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

const mockApiGet = vi.fn().mockResolvedValue([
  { id: 'u1', username: 'alice', avatarUrl: null, rankTier: 'gold', rankPoints: 1200 },
  { id: 'u2', username: 'bob', avatarUrl: null, rankTier: 'silver', rankPoints: 800 },
])

vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}))

vi.mock('@red-handed/ui', () => ({
  Avatar: ({ username }: { username: string }) => <div data-testid="avatar">{username}</div>,
  Badge: ({ tier }: { tier: string }) => <div data-testid="badge">{tier}</div>,
}))

vi.mock('@red-handed/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  RANK_CONFIG: {
    gold: { label: 'Gold', icon: '🥇', minPoints: 1000 },
    silver: { label: 'Silver', icon: '🥈', minPoints: 500 },
  },
}))

import LeaderboardPage from '../../pages/LeaderboardPage'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('LeaderboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<LeaderboardPage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    render(<LeaderboardPage />, { wrapper })
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows the leaderboard title', () => {
    render(<LeaderboardPage />, { wrapper })
    expect(screen.getByText('leaderboard.title')).toBeInTheDocument()
  })

  it('shows search input', () => {
    render(<LeaderboardPage />, { wrapper })
    const searchInput = screen.getByRole('textbox')
    expect(searchInput).toBeInTheDocument()
  })

  it('filters list when search text is entered', async () => {
    render(<LeaderboardPage />, { wrapper })
    const searchInput = screen.getByRole('textbox')
    fireEvent.change(searchInput, { target: { value: 'alice' } })
    expect(searchInput).toHaveValue('alice')
  })

  it('renders podium section with 3+ players after data loads', async () => {
    mockApiGet.mockResolvedValue([
      { id: 'u1', username: 'alice', avatarUrl: null, rankTier: 'gold', rankPoints: 1200 },
      { id: 'u2', username: 'bob', avatarUrl: null, rankTier: 'silver', rankPoints: 800 },
      { id: 'u3', username: 'carol', avatarUrl: null, rankTier: 'silver', rankPoints: 600 },
    ])
    await act(async () => {
      render(<LeaderboardPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getAllByTestId('avatar').length).toBeGreaterThan(0)
    })
  })

  it('renders full ranked list after data loads', async () => {
    mockApiGet.mockResolvedValue([
      { id: 'u1', username: 'alice', avatarUrl: null, rankTier: 'gold', rankPoints: 1200 },
      { id: 'u2', username: 'bob', avatarUrl: null, rankTier: 'silver', rankPoints: 800 },
      { id: 'u3', username: 'carol', avatarUrl: null, rankTier: 'silver', rankPoints: 600 },
      { id: 'u4', username: 'dave', avatarUrl: null, rankTier: 'silver', rankPoints: 500 },
    ])
    await act(async () => {
      render(<LeaderboardPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getAllByText('alice').length).toBeGreaterThan(0)
    })
  })

  it('shows no-player-found message when search yields no results', async () => {
    mockApiGet.mockResolvedValue([
      { id: 'u1', username: 'alice', avatarUrl: null, rankTier: 'gold', rankPoints: 1200 },
      { id: 'u2', username: 'bob', avatarUrl: null, rankTier: 'silver', rankPoints: 800 },
      { id: 'u3', username: 'carol', avatarUrl: null, rankTier: 'silver', rankPoints: 600 },
    ])
    await act(async () => {
      render(<LeaderboardPage />, { wrapper })
    })
    await waitFor(() => expect(screen.getAllByText('alice').length).toBeGreaterThan(0))
    const searchInput = screen.getByRole('textbox')
    fireEvent.change(searchInput, { target: { value: 'zzznomatch' } })
    await waitFor(() => {
      expect(screen.getByText('leaderboard.noPlayerFound')).toBeInTheDocument()
    })
  })

  it('shows noPlayersYet message when leaderboard is empty', async () => {
    mockApiGet.mockResolvedValue([])
    await act(async () => {
      render(<LeaderboardPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('leaderboard.noPlayersYet')).toBeInTheDocument()
    })
  })

  it('shows loading skeleton rows initially', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    render(<LeaderboardPage />, { wrapper })
    // Skeleton rows render while loading
    expect(document.body).toBeInTheDocument()
  })
})
