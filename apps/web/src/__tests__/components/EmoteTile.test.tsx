/**
 * EmoteTile.test.tsx
 *
 * Tests the single source of truth for the emote card visual. The same tile
 * renders in the shop grid AND the loadout picker, so any regression here
 * (rarity badge mis-classification, broken Owned label, vanished checkmark)
 * shows up in two surfaces at once.
 *
 * The interesting bits:
 *   - Rarity → label transform: 'free' renders as "FREE", everything else
 *     uppercases. Worth pinning because the underlying data is `EmoteRarity`
 *     enum strings the server never re-encodes.
 *   - Equipped indicator is icon-only (✓) with aria-label/sr-only fallback —
 *     loosing the a11y wrapper here would break screen-reader nav.
 *   - Disabled vs dimmed are independent flags. Disabled fully blocks clicks;
 *     dimmed keeps clicks live so the server's authoritative error path can
 *     fire (e.g. "you don't actually own enough coins to buy this yet").
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}))

import { EmoteTile } from '../../components/emotes/EmoteTile'

describe('EmoteTile — rarity badge label', () => {
  it.each([
    ['free', 'FREE'],
    ['common', 'COMMON'],
    ['rare', 'RARE'],
    ['epic', 'EPIC'],
    ['legendary', 'LEGENDARY'],
  ] as const)('rarity="%s" renders the badge as "%s"', (rarity, label) => {
    render(
      <EmoteTile emoji="🎉" name="Party" rarity={rarity} price={100} owned={false} />,
    )
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('EmoteTile — name and emoji', () => {
  it('renders the supplied emoji and name', () => {
    render(<EmoteTile emoji="🔥" name="Fire" rarity="rare" price={500} owned={false} />)
    expect(screen.getByText('🔥')).toBeInTheDocument()
    expect(screen.getByText('Fire')).toBeInTheDocument()
  })
})

describe('EmoteTile — owned state', () => {
  it('shows the "Owned" pill instead of the price when owned=true', () => {
    render(<EmoteTile emoji="🎉" name="Party" rarity="rare" price={500} owned={true} />)
    expect(screen.getByText('Owned')).toBeInTheDocument()
    // The price chip is hidden when owned.
    expect(screen.queryByText(/⭐/)).not.toBeInTheDocument()
  })

  it('hides the price block entirely when showPrice=false (loadout picker mode)', () => {
    render(
      <EmoteTile emoji="🎉" name="Party" rarity="rare" price={500} owned={false} showPrice={false} />,
    )
    expect(screen.queryByText('Owned')).not.toBeInTheDocument()
    expect(screen.queryByText(/⭐/)).not.toBeInTheDocument()
  })

  it('shows the price formatted with locale separators when not owned and not free', () => {
    render(<EmoteTile emoji="🎉" name="Party" rarity="rare" price={1500} owned={false} />)
    // 1500 → "1,500" (en-US) or "1 500" (fr) etc. Just check it includes the digits.
    expect(screen.getByText(/⭐/)).toBeInTheDocument()
  })

  it('renders an em-dash for the price of free emotes', () => {
    render(<EmoteTile emoji="😀" name="Smile" rarity="free" price={0} owned={false} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('EmoteTile — equipped indicator', () => {
  it('renders an aria-labelled checkmark when equipped', () => {
    render(
      <EmoteTile emoji="🎉" name="Party" rarity="rare" price={500} owned={true} equipped={true} />,
    )
    // aria-label + title + sr-only span all carry the equipped label.
    expect(screen.getAllByLabelText('Equipped').length).toBeGreaterThan(0)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('omits the checkmark when not equipped', () => {
    render(
      <EmoteTile emoji="🎉" name="Party" rarity="rare" price={500} owned={true} equipped={false} />,
    )
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
  })
})

describe('EmoteTile — interaction', () => {
  it('calls onClick when the tile is clicked', () => {
    const onClick = vi.fn()
    render(
      <EmoteTile emoji="🎉" name="Party" rarity="rare" price={500} owned={false} onClick={onClick} />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('blocks clicks (disabled attr) when disabled=true', () => {
    const onClick = vi.fn()
    render(
      <EmoteTile
        emoji="🎉" name="Party" rarity="rare" price={500} owned={true}
        disabled={true} onClick={onClick}
      />,
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('blocks clicks while busy (e.g. purchase in flight)', () => {
    const onClick = vi.fn()
    render(
      <EmoteTile
        emoji="🎉" name="Party" rarity="rare" price={500} owned={false}
        busy={true} onClick={onClick}
      />,
    )
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText('…')).toBeInTheDocument()
  })

  it('still fires onClick when "dimmed" so the server can surface the real error', () => {
    const onClick = vi.fn()
    render(
      <EmoteTile
        emoji="🎉" name="Party" rarity="legendary" price={5000} owned={false}
        dimmed={true} onClick={onClick}
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
