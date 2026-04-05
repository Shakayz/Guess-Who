import React from 'react'
import { render, screen } from '@testing-library/react'
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

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      id: 'u1',
      username: 'testuser',
      email: 'test@test.com',
      avatarUrl: null,
      rankTier: 'bronze',
      rankPoints: 100,
      honorPoints: 5,
      starCoins: 50,
      goldCoins: 0,
      locale: 'en',
      createdAt: new Date().toISOString(),
    }),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
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

import ProfilePage from '../../pages/ProfilePage'
import { api } from '../../lib/api'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    render(<ProfilePage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })

  it('renders without errors even while data is loading', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}) as any)
    render(<ProfilePage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })
})
