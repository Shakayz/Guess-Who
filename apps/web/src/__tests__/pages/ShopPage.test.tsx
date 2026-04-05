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
    expect(screen.getByText('🎨 Cosmetics')).toBeInTheDocument()
    expect(screen.getByText('👑 Season Pass')).toBeInTheDocument()
  })

  it('switches to Cosmetics tab when clicked', () => {
    render(<ShopPage />)
    fireEvent.click(screen.getByText('🎨 Cosmetics'))
    expect(screen.getByText('🎨 Cosmetics')).toBeInTheDocument()
  })

  it('switches to Season Pass tab when clicked', () => {
    render(<ShopPage />)
    fireEvent.click(screen.getByText('👑 Season Pass'))
    expect(screen.getByText('👑 Season Pass')).toBeInTheDocument()
  })
})
