import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { AchievementCard, type AchievementCardData } from '../../components/achievements/AchievementCard'

function makeAchievement(overrides: Partial<AchievementCardData> = {}): AchievementCardData {
  return {
    id: 'a1',
    key: 'first_win',
    name: 'First Win',
    description: 'Win your first game',
    icon: '🏆',
    category: 'gameplay',
    difficulty: 'bronze',
    xpReward: 100,
    coinReward: 0,
    starsReward: 10,
    isSecret: false,
    unlocked: false,
    unlockedAt: null,
    claimed: false,
    claimedAt: null,
    ...overrides,
  }
}

describe('AchievementCard', () => {
  it('renders name, description, icon, rewards', () => {
    render(<AchievementCard achievement={makeAchievement()} onClaim={vi.fn()} isClaiming={false} />)
    expect(screen.getByText('First Win')).toBeInTheDocument()
    expect(screen.getByText('Win your first game')).toBeInTheDocument()
    expect(screen.getByText('🏆')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('100 XP')).toBeInTheDocument()
  })

  it('locked state shows emoji icon and no claim button', () => {
    const { container } = render(
      <AchievementCard
        achievement={makeAchievement({ unlocked: false })}
        onClaim={vi.fn()}
        isClaiming={false}
      />,
    )
    const card = container.querySelector('[data-state]')
    expect(card?.getAttribute('data-state')).toBe('locked')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('secret locked achievements show a lock icon instead of the emoji', () => {
    render(
      <AchievementCard
        achievement={makeAchievement({ unlocked: false, isSecret: true })}
        onClaim={vi.fn()}
        isClaiming={false}
      />,
    )
    expect(screen.getByText('🔒')).toBeInTheDocument()
  })

  it('unclaimed state renders a claim button', () => {
    render(
      <AchievementCard
        achievement={makeAchievement({ unlocked: true, claimed: false })}
        onClaim={vi.fn()}
        isClaiming={false}
      />,
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText(/achievements\.claim/)).toBeInTheDocument()
  })

  it('onClaim is called with the achievement key when the button is clicked', () => {
    const onClaim = vi.fn()
    render(
      <AchievementCard
        achievement={makeAchievement({ unlocked: true, claimed: false, key: 'first_win' })}
        onClaim={onClaim}
        isClaiming={false}
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClaim).toHaveBeenCalledWith('first_win')
  })

  it('claim button is disabled and shows "…" while isClaiming is true', () => {
    render(
      <AchievementCard
        achievement={makeAchievement({ unlocked: true, claimed: false })}
        onClaim={vi.fn()}
        isClaiming
      />,
    )
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText('…')).toBeInTheDocument()
  })

  it('claimed state shows the claimed badge and hides the claim button', () => {
    render(
      <AchievementCard
        achievement={makeAchievement({ unlocked: true, claimed: true })}
        onClaim={vi.fn()}
        isClaiming={false}
      />,
    )
    expect(screen.getByText(/achievements\.claimed/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic'] as const)(
    'applies styling for difficulty=%s',
    (difficulty) => {
      const { container } = render(
        <AchievementCard
          achievement={makeAchievement({ difficulty })}
          onClaim={vi.fn()}
          isClaiming={false}
        />,
      )
      const card = container.querySelector('[data-difficulty]') as HTMLElement
      expect(card.getAttribute('data-difficulty')).toBe(difficulty)
    },
  )

  it('uses the key in its DOM id so animations can target the card', () => {
    const { container } = render(
      <AchievementCard
        achievement={makeAchievement({ key: 'my_key' })}
        onClaim={vi.fn()}
        isClaiming={false}
      />,
    )
    expect(container.querySelector('#achievement-card-my_key')).not.toBeNull()
  })
})
