import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('../../lib/api', () => ({ api: { get: apiGet } }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { AchievementSummaryChip } from '../../components/achievements/AchievementSummaryChip'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('AchievementSummaryChip', () => {
  beforeEach(() => {
    apiGet.mockReset()
  })

  it('shows a loading placeholder until the query resolves', async () => {
    apiGet.mockReturnValue(new Promise(() => {})) // never resolves
    wrap(<AchievementSummaryChip onOpen={vi.fn()} />)
    expect(screen.getByText('…')).toBeInTheDocument()
  })

  it('fetches /achievements/summary', async () => {
    apiGet.mockResolvedValue({ total: 10, unlocked: 3, unclaimedCount: 0, unclaimedStars: 0 })
    wrap(<AchievementSummaryChip onOpen={vi.fn()} />)
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/achievements/summary'))
  })

  it('renders unlocked/total progress once data arrives', async () => {
    apiGet.mockResolvedValue({ total: 50, unlocked: 12, unclaimedCount: 0, unclaimedStars: 0 })
    wrap(<AchievementSummaryChip onOpen={vi.fn()} />)
    expect(await screen.findByText('12/50')).toBeInTheDocument()
  })

  it('renders the unclaimed pill when rewards are waiting', async () => {
    apiGet.mockResolvedValue({ total: 20, unlocked: 10, unclaimedCount: 4, unclaimedStars: 55 })
    wrap(<AchievementSummaryChip onOpen={vi.fn()} />)
    expect(await screen.findByText(/4 profile\.unclaimed · \+55⭐/)).toBeInTheDocument()
  })

  it('renders the "play to unlock" hint when nothing is pending', async () => {
    apiGet.mockResolvedValue({ total: 10, unlocked: 0, unclaimedCount: 0, unclaimedStars: 0 })
    wrap(<AchievementSummaryChip onOpen={vi.fn()} />)
    expect(await screen.findByText(/profile\.playToUnlock/)).toBeInTheDocument()
  })

  it('clicking the chip calls onOpen', async () => {
    apiGet.mockResolvedValue({ total: 10, unlocked: 0, unclaimedCount: 0, unclaimedStars: 0 })
    const onOpen = vi.fn()
    wrap(<AchievementSummaryChip onOpen={onOpen} />)
    const chip = await screen.findByRole('button')
    fireEvent.click(chip)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('caps the progress bar at 100% when unlocked > total', async () => {
    apiGet.mockResolvedValue({ total: 2, unlocked: 5, unclaimedCount: 0, unclaimedStars: 0 })
    const { container } = wrap(<AchievementSummaryChip onOpen={vi.fn()} />)
    await screen.findByText('5/2')
    const bar = container.querySelector('[style*="width"]') as HTMLElement
    // Either inline 100% or a computed value — simply ensure it doesn't overflow
    expect(bar.style.width).toBe('100%')
  })
})
