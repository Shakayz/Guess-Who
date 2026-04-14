import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
const mockLocation = { pathname: '/' }

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { BottomNav } from '../../components/BottomNav'

describe('BottomNav', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockLocation.pathname = '/'
  })

  it('renders all 6 nav tabs on the home page', () => {
    render(<BottomNav />)
    const nav = screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
    for (const key of [
      'nav.play',
      'nav.leaderboard',
      'nav.history',
      'nav.friends',
      'nav.profile',
      'nav.settings',
    ]) {
      expect(screen.getAllByText(key).length).toBeGreaterThan(0)
    }
  })

  it('marks the current route as active via aria-current', () => {
    mockLocation.pathname = '/leaderboard'
    render(<BottomNav />)
    const active = screen.getByRole('button', { name: 'nav.leaderboard' })
    expect(active.getAttribute('aria-current')).toBe('page')
  })

  it('navigates to the target path when a tab is clicked', () => {
    render(<BottomNav />)
    fireEvent.click(screen.getByRole('button', { name: 'nav.friends' }))
    expect(mockNavigate).toHaveBeenCalledWith('/friends')
  })

  it('hides itself on game pages', () => {
    mockLocation.pathname = '/game/ABC123'
    const { container } = render(<BottomNav />)
    expect(container.firstChild).toBeNull()
  })

  it('hides itself on lobby pages', () => {
    mockLocation.pathname = '/lobby/ABC123'
    const { container } = render(<BottomNav />)
    expect(container.firstChild).toBeNull()
  })

  it('hides itself on results pages', () => {
    mockLocation.pathname = '/results/ABC123'
    const { container } = render(<BottomNav />)
    expect(container.firstChild).toBeNull()
  })

  it('hides itself on the auth page', () => {
    mockLocation.pathname = '/auth'
    const { container } = render(<BottomNav />)
    expect(container.firstChild).toBeNull()
  })

  it('root path only matches exactly (not nested)', () => {
    // /friends should NOT mark the "/" tab as active.
    mockLocation.pathname = '/friends'
    render(<BottomNav />)
    const home = screen.getByRole('button', { name: 'nav.play' })
    expect(home.getAttribute('aria-current')).not.toBe('page')
  })
})
