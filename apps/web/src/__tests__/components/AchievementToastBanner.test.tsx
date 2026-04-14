import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { useSocialStore } from '../../store/social'
import { AchievementToastBanner } from '../../components/achievements/AchievementToastBanner'

describe('AchievementToastBanner', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    useSocialStore.setState({ achievementToasts: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when there are no toasts', () => {
    const { container } = render(<AchievementToastBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders one button per toast with its name and icon', () => {
    useSocialStore.setState({
      achievementToasts: [
        { id: '1', key: 'a', name: 'Clutch!', icon: '🏆', difficulty: 'gold', starsReward: 50 },
        { id: '2', key: 'b', name: 'Streak',  icon: '🔥', difficulty: 'silver', starsReward: 20 },
      ],
    })
    render(<AchievementToastBanner />)
    expect(screen.getByText('Clutch!')).toBeInTheDocument()
    expect(screen.getByText('Streak')).toBeInTheDocument()
    expect(screen.getByText('🏆')).toBeInTheDocument()
    expect(screen.getByText('🔥')).toBeInTheDocument()
  })

  it('clicking a toast navigates to /achievements and dismisses the toast', () => {
    useSocialStore.setState({
      achievementToasts: [
        { id: 't1', key: 'a', name: 'Clutch!', icon: '🏆', difficulty: 'gold', starsReward: 50 },
      ],
    })
    render(<AchievementToastBanner />)
    fireEvent.click(screen.getByText('Clutch!'))
    expect(mockNavigate).toHaveBeenCalledWith('/achievements')
    expect(useSocialStore.getState().achievementToasts).toHaveLength(0)
  })

  it('shows the star reward and claim-now label', () => {
    useSocialStore.setState({
      achievementToasts: [
        { id: 't1', key: 'a', name: 'Clutch!', icon: '🏆', difficulty: 'gold', starsReward: 75 },
      ],
    })
    render(<AchievementToastBanner />)
    expect(screen.getByText(/achievements\.claimNow · \+75⭐/)).toBeInTheDocument()
  })

  it('auto-dismisses a toast after 6 seconds', () => {
    vi.useFakeTimers()
    useSocialStore.setState({
      achievementToasts: [
        { id: 'auto', key: 'x', name: 'Auto', icon: '🎯', difficulty: 'bronze', starsReward: 5 },
      ],
    })
    render(<AchievementToastBanner />)
    expect(useSocialStore.getState().achievementToasts).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(6000)
    })
    expect(useSocialStore.getState().achievementToasts).toHaveLength(0)
  })

  it('falls back to bronze ring when difficulty is unknown', () => {
    useSocialStore.setState({
      achievementToasts: [
        { id: 't1', key: 'x', name: 'Mystery', icon: '❓', difficulty: 'ultra', starsReward: 1 },
      ],
    })
    const { container } = render(<AchievementToastBanner />)
    // className contains "ring-amber-700" only for bronze fallback
    expect((container.querySelector('button') as HTMLElement).className).toMatch(/ring-amber-700/)
  })
})
