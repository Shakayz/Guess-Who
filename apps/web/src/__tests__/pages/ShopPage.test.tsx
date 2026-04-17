import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// i18n stub: return the defaultValue when one is provided (with interpolation),
// otherwise return the raw key so we can match keys directly in assertions.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      if (opts && typeof opts === 'object' && typeof opts.defaultValue === 'string') {
        return opts.defaultValue.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? ''))
      }
      return key
    },
    i18n: { language: 'en' },
  }),
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

// The shop hits GET /auth/me on mount. No cosmetics endpoint anymore — they
// were removed from the game design when avatars were dropped.
const mockGet = vi.fn()
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: vi.fn(),
  },
}))

import ShopPage from '../../pages/ShopPage'

function renderShop() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/shop']}>
        <ShopPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ShopPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockImplementation((url: string) => {
      if (url === '/auth/me') {
        return Promise.resolve({ starCoins: 125 })
      }
      return Promise.resolve(null)
    })
  })

  it('renders without crashing', () => {
    renderShop()
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    renderShop()
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows the live star-coin balance in the header chip', async () => {
    renderShop()
    // Comes from the /auth/me mock, formatted via toLocaleString (just "125" here).
    await waitFor(() => {
      expect(screen.getByText('125')).toBeInTheDocument()
    })
  })

  it('shows the coin-packs "coming soon" notice on the Coins tab (default)', async () => {
    renderShop()
    // The tab now renders loading skeletons first and only falls back to the
    // "coming soon" notice after the /shop/packs query resolves (null / []).
    await waitFor(() => {
      expect(screen.getByText(/shop\.packsUnavailable/)).toBeInTheDocument()
    })
  })

  it('lists the free earning mechanics so players without coins see alternatives', () => {
    renderShop()
    // Earn rows: daily bonus + streak come from dailyRewards.ts; level-up and
    // achievement coins come from gameLoop.applyXpAndLevel + claimable
    // achievement rewards. Per-game base reward was removed by design.
    expect(screen.getByText('shop.earnDailyBonus')).toBeInTheDocument()
    expect(screen.getByText('shop.earnStreak')).toBeInTheDocument()
    expect(screen.getByText('shop.earnLevelUp')).toBeInTheDocument()
    expect(screen.getByText('shop.earnAchievements')).toBeInTheDocument()
    expect(screen.queryByText('shop.earnGameReward')).not.toBeInTheDocument()
  })

  it('does not expose a cosmetics tab (removed from game design)', () => {
    renderShop()
    expect(screen.queryByText('shop.tabCosmetics')).not.toBeInTheDocument()
  })

  it('switches to Premium tab and shows the "coming soon" copy', () => {
    renderShop()
    fireEvent.click(screen.getByText('shop.tabPremium'))
    expect(screen.getByText(/shop\.premiumComingSoon/)).toBeInTheDocument()
  })

  it('can switch back to the Coins tab from Premium', async () => {
    renderShop()
    fireEvent.click(screen.getByText('shop.tabPremium'))
    fireEvent.click(screen.getByText('shop.tabCoins'))
    await waitFor(() => {
      expect(screen.getByText(/shop\.packsUnavailable/)).toBeInTheDocument()
    })
  })
})
