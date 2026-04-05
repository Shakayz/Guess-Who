import React from 'react'
import { render, screen } from '@testing-library/react'
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

vi.mock('../../store/social', () => ({
  useSocialStore: (selector: (s: unknown) => unknown) =>
    selector({ activeDm: null, setActiveDm: vi.fn(), unreadCounts: {}, clearUnread: vi.fn() }),
}))

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ friends: [], requests: [] }),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

import FriendsPage from '../../pages/FriendsPage'
import { api } from '../../lib/api'

describe('FriendsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<FriendsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    render(<FriendsPage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows friends page title (h1)', () => {
    render(<FriendsPage />)
    // Multiple 'friends.title' may appear; use getAllByText
    const titles = screen.getAllByText('friends.title')
    expect(titles.length).toBeGreaterThanOrEqual(1)
  })

  it('shows find players section', () => {
    render(<FriendsPage />)
    expect(screen.getByText('friends.findPlayers')).toBeInTheDocument()
  })

  it('fetches friends and requests data on mount', () => {
    render(<FriendsPage />)
    expect(api.get).toHaveBeenCalled()
  })
})
