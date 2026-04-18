import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

const mockApiGet = vi.fn()
const mockApiPost = vi.fn()
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}))

const seasonData = {
  id: 's1',
  name: 'Season 1: The Beginning',
  startDate: new Date('2024-01-01').toISOString(),
  endDate: new Date('2024-03-31').toISOString(),
  userXp: 250,
  tiers: [
    { id: 't1', tierNumber: 1, xpRequired: 100, rewardType: 'starCoins', rewardValue: '50', isPremium: false, claimed: true, unlocked: true },
    { id: 't2', tierNumber: 2, xpRequired: 200, rewardType: 'starCoins', rewardValue: '75', isPremium: false, claimed: false, unlocked: true },
    { id: 't3', tierNumber: 3, xpRequired: 300, rewardType: 'title', rewardValue: 'Champion', isPremium: true, claimed: false, unlocked: false },
  ],
}

import SeasonPassPage from '../../pages/SeasonPassPage'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('SeasonPassPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue(null)
    mockApiPost.mockResolvedValue({})
  })

  it('renders without crashing', () => {
    render(<SeasonPassPage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    render(<SeasonPassPage />, { wrapper })
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows the season pass title', () => {
    render(<SeasonPassPage />, { wrapper })
    expect(screen.getByText('Season Pass')).toBeInTheDocument()
  })

  it('shows no active season message when season data is null', async () => {
    mockApiGet.mockResolvedValue(null)
    await act(async () => {
      render(<SeasonPassPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('No active season pass')).toBeInTheDocument()
    })
  })

  it('fetches season data on mount', () => {
    render(<SeasonPassPage />, { wrapper })
    expect(mockApiGet).toHaveBeenCalledWith('/season-pass/current')
  })

  it('renders season name when data is available', async () => {
    mockApiGet.mockResolvedValueOnce(seasonData)
    await act(async () => {
      render(<SeasonPassPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('Season 1: The Beginning')).toBeInTheDocument()
    })
  })

  it('renders tier list when season data is available', async () => {
    mockApiGet.mockResolvedValueOnce(seasonData)
    await act(async () => {
      render(<SeasonPassPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('Season Tiers')).toBeInTheDocument()
    })
  })

  it('shows claimed status for claimed tiers', async () => {
    mockApiGet.mockResolvedValueOnce(seasonData)
    await act(async () => {
      render(<SeasonPassPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('Claimed')).toBeInTheDocument()
    })
  })

  it('shows Claim button for unlocked but unclaimed tiers', async () => {
    mockApiGet.mockResolvedValueOnce(seasonData)
    await act(async () => {
      render(<SeasonPassPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('Claim')).toBeInTheDocument()
    })
  })

  it('shows Locked status for locked tiers', async () => {
    mockApiGet.mockResolvedValueOnce(seasonData)
    await act(async () => {
      render(<SeasonPassPage />, { wrapper })
    })
    await waitFor(() => {
      const lockedEls = screen.getAllByText('Locked')
      expect(lockedEls.length).toBeGreaterThan(0)
    })
  })

  it('shows PREMIUM badge for premium tiers', async () => {
    mockApiGet.mockResolvedValueOnce(seasonData)
    await act(async () => {
      render(<SeasonPassPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('PREMIUM')).toBeInTheDocument()
    })
  })

  it('renders XP progress bar when season is active', async () => {
    mockApiGet.mockResolvedValueOnce(seasonData)
    await act(async () => {
      render(<SeasonPassPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('250 XP')).toBeInTheDocument()
    })
  })

  it('handles claim button click', async () => {
    mockApiGet.mockResolvedValueOnce(seasonData)
    mockApiPost.mockResolvedValueOnce({})
    await act(async () => {
      render(<SeasonPassPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('Claim')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Claim'))
    })
    expect(mockApiPost).toHaveBeenCalledWith(expect.stringContaining('t2'), expect.anything())
  })

  it('renders starCoins reward type with correct label', async () => {
    mockApiGet.mockResolvedValueOnce(seasonData)
    await act(async () => {
      render(<SeasonPassPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText(/50 Star Coins/)).toBeInTheDocument()
    })
  })

  it('renders title reward type with correct value', async () => {
    mockApiGet.mockResolvedValueOnce(seasonData)
    await act(async () => {
      render(<SeasonPassPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText(/Champion/)).toBeInTheDocument()
    })
  })
})
