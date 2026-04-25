/**
 * PremiumBadge.test.tsx
 *
 * The badge is a single source of truth for the "premium" chip — used in
 * the NavBar, profile pages, lobbies, and the player profile page. Anything
 * that breaks the visual contract (label text, ARIA, size variants) ripples
 * across the whole UI, so the tests pin all three.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  // The component calls `t('badge.premium', 'Premium')`. Tests assert against
  // the visible default — the i18n bundle isn't loaded here.
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}))

import { PremiumBadge } from '../../components/PremiumBadge'

describe('PremiumBadge', () => {
  it('renders the default "Premium" label and a crown emoji', () => {
    render(<PremiumBadge />)
    // The label text appears on both aria-label and the visible <span>.
    // getAllByText avoids the multiple-match crash.
    expect(screen.getAllByText('Premium').length).toBeGreaterThan(0)
    expect(screen.getByText('👑')).toBeInTheDocument()
  })

  it('uses the supplied title prop in place of the i18n default', () => {
    render(<PremiumBadge title="Founder" />)
    expect(screen.getAllByText('Founder').length).toBeGreaterThan(0)
    // The default label must not appear when an override is provided.
    expect(screen.queryByText('Premium')).not.toBeInTheDocument()
  })

  it('exposes the label via aria-label for screen-readers (the visible text is hidden on small screens)', () => {
    render(<PremiumBadge />)
    expect(screen.getByLabelText('Premium')).toBeInTheDocument()
  })

  it('keeps the crown emoji aria-hidden so it does not duplicate the label for SR users', () => {
    render(<PremiumBadge />)
    const crown = screen.getByText('👑')
    expect(crown).toHaveAttribute('aria-hidden')
  })

  it.each([
    ['xs', 'text-[10px]'],
    ['sm', 'text-[11px]'],
    ['md', 'text-sm'],
  ] as const)('applies the right size class for size="%s"', (size, expectedClass) => {
    const { container } = render(<PremiumBadge size={size} />)
    const span = container.querySelector('span')!
    expect(span.className).toContain(expectedClass)
  })

  it('defaults to size="sm" when no size prop is provided', () => {
    const { container } = render(<PremiumBadge />)
    const span = container.querySelector('span')!
    expect(span.className).toContain('text-[11px]')
  })
})
