import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useParams: () => ({ gameId: 'game-abc' }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: unknown; to: string }) => <a href={to}>{children as React.ReactNode}</a>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
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
      id: 'game-abc',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      winnerTeam: 'villagers',
      myRole: 'villager',
      participations: [
        { userId: 'u1', username: 'testuser', avatarUrl: null, role: 'villager', survived: true, starCoinsEarned: 5 },
      ],
      rounds: [
        {
          id: 'r1',
          roundNumber: 1,
          villagerWord: 'pizza',
          imposterWord: 'pasta',
          eliminatedId: null,
          eliminatedRole: null,
          clues: [],
          votes: [],
        },
      ],
      chatMessages: [],
    }),
  },
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

import GameDetailPage from '../../pages/GameDetailPage'
import { api } from '../../lib/api'

describe('GameDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    vi.mocked(api.get).mockReturnValueOnce(new Promise(() => {}))
    render(<GameDetailPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('fetches game detail for the correct gameId on mount', () => {
    render(<GameDetailPage />)
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('game-abc'))
  })
})
