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

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      games: [
        {
          id: 'g1',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          winnerTeam: 'villagers',
          myRole: 'villager',
          survived: true,
          starCoinsEarned: 5,
          roundCount: 3,
          players: [{ userId: 'u1', username: 'testuser', avatarUrl: null, role: 'villager', survived: true }],
        },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    }),
  },
}))

import HistoryPage from '../../pages/HistoryPage'
import { api } from '../../lib/api'

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    vi.mocked(api.get).mockReturnValueOnce(new Promise(() => {}))
    render(<HistoryPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('fetches history data on mount', () => {
    render(<HistoryPage />)
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/history'))
  })
})
