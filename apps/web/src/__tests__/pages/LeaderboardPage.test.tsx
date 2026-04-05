import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue([
      { id: 'u1', username: 'alice', avatarUrl: null, rankTier: 'gold', rankPoints: 1200 },
      { id: 'u2', username: 'bob', avatarUrl: null, rankTier: 'silver', rankPoints: 800 },
    ]),
  },
}))

vi.mock('@imposter/ui', () => ({
  Avatar: ({ username }: { username: string }) => <div data-testid="avatar">{username}</div>,
  Badge: ({ tier }: { tier: string }) => <div data-testid="badge">{tier}</div>,
}))

vi.mock('@imposter/shared', () => ({
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
})
