import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

import ShopPage from '../../pages/ShopPage'

describe('ShopPage', () => {
  it('renders without crashing', () => {
    render(<ShopPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    render(<ShopPage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows the shop title', () => {
    render(<ShopPage />)
    expect(screen.getByText('shop.shop')).toBeInTheDocument()
  })

  it('shows tab navigation with correct labels', () => {
    render(<ShopPage />)
    expect(screen.getByText('💰 Gold Coins')).toBeInTheDocument()
    expect(screen.getByText('👑 Season Pass')).toBeInTheDocument()
  })

  it('does not expose a cosmetics tab', () => {
    render(<ShopPage />)
    expect(screen.queryByText('🎨 Cosmetics')).not.toBeInTheDocument()
  })

  it('shows coins tab content by default', () => {
    render(<ShopPage />)
    expect(screen.getByText('Gold Coin Packs')).toBeInTheDocument()
  })

  it('switches to Season Pass tab when clicked', () => {
    render(<ShopPage />)
    fireEvent.click(screen.getByText('👑 Season Pass'))
    // Season pass content should appear
    expect(screen.getByText('Season Pass')).toBeInTheDocument()
  })

  it('shows season pass perks when season tab is selected', () => {
    render(<ShopPage />)
    fireEvent.click(screen.getByText('👑 Season Pass'))
    expect(screen.getByText(/XP boost/)).toBeInTheDocument()
  })

  it('shows wallet with star coins and gold coins', () => {
    render(<ShopPage />)
    expect(screen.getByText('100')).toBeInTheDocument() // star coins
    expect(screen.getByText('0')).toBeInTheDocument()   // gold coins
  })

  it('can switch back to coins tab from season tab', () => {
    render(<ShopPage />)
    fireEvent.click(screen.getByText('👑 Season Pass'))
    fireEvent.click(screen.getByText('💰 Gold Coins'))
    expect(screen.getByText('Gold Coin Packs')).toBeInTheDocument()
  })

  it('shows gold coins description text in coins tab', () => {
    render(<ShopPage />)
    // Gold coins tab is default
    expect(screen.getByText(/Gold Coins are used for/i)).toBeInTheDocument()
  })
})
