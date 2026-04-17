import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { AchievementFilters } from '../../components/achievements/AchievementFilters'

describe('AchievementFilters', () => {
  const baseProps = {
    category: 'all' as const,
    state: 'all' as const,
    onCategoryChange: vi.fn(),
    onStateChange: vi.fn(),
    counts: {},
  }

  it('renders all 11 category pills', () => {
    render(<AchievementFilters {...baseProps} />)
    for (const label of [
      'All',
      'Gameplay',
      'Imposter',
      'Detective',
      'Special',
      'Social',
      'Ranked',
      'Milestones',
      'Economy',
      'Meta',
      'Secret',
    ]) {
      expect(screen.getAllByText(new RegExp(label)).length).toBeGreaterThan(0)
    }
  })

  it('renders all 4 state pills', () => {
    render(<AchievementFilters {...baseProps} />)
    for (const label of ['All', 'Unclaimed', 'Claimed', 'Locked']) {
      expect(screen.getAllByText(new RegExp(label)).length).toBeGreaterThan(0)
    }
  })

  it('clicking a category pill fires onCategoryChange with its value', () => {
    const onCategoryChange = vi.fn()
    render(<AchievementFilters {...baseProps} onCategoryChange={onCategoryChange} />)
    fireEvent.click(screen.getByText(/Gameplay/))
    expect(onCategoryChange).toHaveBeenCalledWith('gameplay')
  })

  it('clicking a state pill fires onStateChange with its value', () => {
    const onStateChange = vi.fn()
    render(<AchievementFilters {...baseProps} onStateChange={onStateChange} />)
    fireEvent.click(screen.getByText(/Unclaimed/))
    expect(onStateChange).toHaveBeenCalledWith('unclaimed')
  })

  it('renders numeric count next to a category when provided', () => {
    render(<AchievementFilters {...baseProps} counts={{ gameplay: 7 }} />)
    expect(screen.getByText('(7)')).toBeInTheDocument()
  })

  it('omits the count marker when no count is provided for a category', () => {
    render(<AchievementFilters {...baseProps} counts={{}} />)
    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument()
  })

  it('highlights the currently active category pill', () => {
    const { container } = render(
      <AchievementFilters {...baseProps} category="social" />,
    )
    const socialPill = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Social'),
    )!
    expect(socialPill.className).toContain('bg-brand-600')
  })

  it('highlights the currently active state pill', () => {
    const { container } = render(
      <AchievementFilters {...baseProps} state="claimed" />,
    )
    const claimedPill = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Claimed'),
    )!
    expect(claimedPill.className).toContain('bg-amber-500')
  })
})
