import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))
vi.mock('../../lib/api', () => ({ api: { get: apiGet, post: apiPost } }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../../components/NavBar', () => ({
  NavBar: () => <div data-testid="navbar" />,
}))

// Keep the burst animation a simple marker in the DOM.
vi.mock('../../components/achievements/ClaimBurst', () => ({
  ClaimBurst: ({ targetKey, stars }: { targetKey: string; stars: number }) => (
    <div data-testid="burst">{targetKey}:{stars}</div>
  ),
}))

import AchievementsPage from '../../pages/AchievementsPage'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AchievementsPage />
    </QueryClientProvider>,
  )
}

function mkRow(over: Partial<any> = {}) {
  return {
    id: '1',
    key: 'first_win',
    name: 'First Win',
    description: 'd',
    icon: '🏆',
    category: 'gameplay',
    difficulty: 'bronze',
    xpReward: 10,
    coinReward: 0,
    starsReward: 5,
    isSecret: false,
    unlocked: true,
    unlockedAt: '2026-01-01T00:00:00Z',
    claimed: false,
    claimedAt: null,
    ...over,
  }
}

describe('AchievementsPage', () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiPost.mockReset()
  })

  it('shows the page header and stats', async () => {
    apiGet.mockResolvedValue([mkRow(), mkRow({ id: '2', key: 'x', claimed: true })])
    renderPage()
    expect(screen.getByText(/achievements\.title/)).toBeInTheDocument()
    await screen.findByText('2/2') // unlocked/total
  })

  it('filters to the unclaimed tab by default', async () => {
    apiGet.mockResolvedValue([
      mkRow({ key: 'unclaimed_row' }),
      mkRow({ id: '2', key: 'claimed_row', claimed: true, claimedAt: '2026-01-02' }),
    ])
    renderPage()
    await waitFor(() => expect(screen.queryByText('First Win')).toBeInTheDocument())
    // Only the unclaimed row shows
    const cards = document.querySelectorAll('[id^="achievement-card-"]')
    expect(cards.length).toBe(1)
    expect(cards[0].id).toBe('achievement-card-unclaimed_row')
  })

  it('clicking Claimed filter shows the claimed rows', async () => {
    apiGet.mockResolvedValue([
      mkRow({ id: '1', key: 'a', claimed: false }),
      mkRow({ id: '2', key: 'b', claimed: true, claimedAt: '2026-01-02' }),
    ])
    renderPage()
    await screen.findByText('First Win')
    fireEvent.click(screen.getByText(/Claimed/))
    const cards = document.querySelectorAll('[id^="achievement-card-"]')
    expect(cards.length).toBe(1)
    expect(cards[0].id).toBe('achievement-card-b')
  })

  it('clicking a category pill filters rows', async () => {
    apiGet.mockResolvedValue([
      mkRow({ id: '1', key: 'gp', category: 'gameplay', name: 'Gameplay One' }),
      mkRow({ id: '2', key: 'so', category: 'social', name: 'Social One' }),
    ])
    renderPage()
    await screen.findByText('Gameplay One')
    expect(screen.getByText('Social One')).toBeInTheDocument()
    // The category pill label is "🤝 Social (…)". Match it via the 🤝 emoji.
    const buttons = Array.from(document.querySelectorAll('button'))
    const socialPill = buttons.find((b) => {
      const txt = b.textContent ?? ''
      return txt.includes('🤝') && txt.includes('Social')
    })
    expect(socialPill).toBeDefined()
    fireEvent.click(socialPill!)
    await waitFor(() => {
      expect(screen.queryByText('Gameplay One')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Social One')).toBeInTheDocument()
  })

  it('shows the empty state when the filter matches nothing', async () => {
    apiGet.mockResolvedValue([mkRow({ claimed: true, claimedAt: 'x' })])
    renderPage()
    await screen.findByText(/achievements\.emptyState/)
  })

  it('clicking Claim calls /achievements/:key/claim and triggers the burst', async () => {
    apiGet.mockResolvedValue([mkRow({ key: 'first_win', starsReward: 50 })])
    apiPost.mockResolvedValue({
      starsGranted: 50,
      xpGranted: 10,
      newBalance: 1000,
      claimedAt: '2026-01-02',
      achievement: { key: 'first_win', name: 'First Win', icon: '🏆', difficulty: 'bronze' },
    })
    renderPage()
    const claim = await screen.findByRole('button', { name: /achievements\.claim/ })
    fireEvent.click(claim)
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/achievements/first_win/claim', {})
    })
    expect(await screen.findByTestId('burst')).toHaveTextContent('first_win:50')
  })

  it('renders loading skeletons while the query is pending', () => {
    apiGet.mockReturnValue(new Promise(() => {}))
    const { container } = renderPage()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(9)
  })
})
