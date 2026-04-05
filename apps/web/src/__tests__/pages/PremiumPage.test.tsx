import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

import PremiumPage from '../../pages/PremiumPage'

describe('PremiumPage', () => {
  it('renders without crashing', () => {
    render(<PremiumPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    render(<PremiumPage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows the Go Premium heading', () => {
    render(<PremiumPage />)
    expect(screen.getByText('Go Premium')).toBeInTheDocument()
  })

  it('shows pricing info', () => {
    render(<PremiumPage />)
    expect(screen.getByText('/ month')).toBeInTheDocument()
    expect(screen.getByText('/ year')).toBeInTheDocument()
  })

  it('shows premium perks', () => {
    render(<PremiumPage />)
    expect(screen.getByText('No Ads')).toBeInTheDocument()
    expect(screen.getByText('Unlimited Games')).toBeInTheDocument()
  })
})
