import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// i18n stub: prefer the `defaultValue` fallback when the component supplies one,
// so the test sees the real English copy instead of the raw key.
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

// Stub the API. The shop hits GET /auth/me and GET /shop/cosmetics on mount.
const mockGet = vi.fn()
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: vi.fn(),
  },
}))

vi.mock('../../lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
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
        return Promise.resolve({ starCoins: 125, goldCoins: 3 })
      }
      if (url === '/shop/cosmetics') {
        return Promise.resolve([
          { id: '1', name: 'Shadow Cloak', type: 'avatar_outfit', price: 200, currency: 'star', icon: '🦇', isNew: true },
          { id: '2', name: 'Gold Crown',   type: 'avatar_accessory', price: 150, currency: 'star', icon: '👑' },
        ])
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
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows the coin-packs "coming soon" notice on the Coins tab (default)', () => {
    renderShop()
    expect(screen.getByText(/shop\.packsUnavailable/)).toBeInTheDocument()
  })

  it('lists the free earning mechanics so players without coins see alternatives', () => {
    renderShop()
    // The three earn rows — daily bonus / streak / game reward — are the
    // actual earning channels the server implements in dailyRewards.ts.
    expect(screen.getByText('shop.earnDailyBonus')).toBeInTheDocument()
    expect(screen.getByText('shop.earnStreak')).toBeInTheDocument()
    expect(screen.getByText('shop.earnGameReward')).toBeInTheDocument()
  })

  it('switches to Cosmetics tab and renders items from the API', async () => {
    renderShop()
    fireEvent.click(screen.getByText('shop.tabCosmetics'))
    await waitFor(() => {
      expect(screen.getByText('Shadow Cloak')).toBeInTheDocument()
      expect(screen.getByText('Gold Crown')).toBeInTheDocument()
    })
  })

  it('shows NEW badge for new cosmetic items', async () => {
    renderShop()
    fireEvent.click(screen.getByText('shop.tabCosmetics'))
    await waitFor(() => {
      expect(screen.getByText('NEW')).toBeInTheDocument()
    })
  })

  it('switches to Season tab and shows the "coming soon" copy', () => {
    renderShop()
    fireEvent.click(screen.getByText('shop.tabSeason'))
    expect(screen.getByText('shop.seasonComingSoon')).toBeInTheDocument()
  })

  it('can switch back to the Coins tab from Cosmetics', async () => {
    renderShop()
    fireEvent.click(screen.getByText('shop.tabCosmetics'))
    fireEvent.click(screen.getByText('shop.tabCoins'))
    await waitFor(() => {
      expect(screen.getByText(/shop\.packsUnavailable/)).toBeInTheDocument()
    })
  })
})
