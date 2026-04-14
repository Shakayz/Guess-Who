import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../components/NavBar', () => ({
  NavBar: () => <div data-testid="navbar" />,
}))

import TermsPage from '../../pages/TermsPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <TermsPage />
    </MemoryRouter>,
  )
}

describe('TermsPage', () => {
  it('renders the Terms of Service title', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Terms of Service/i)
  })

  it('shows a back-to-settings link', () => {
    renderPage()
    const link = screen.getByText(/Back to Settings/i)
    expect(link.closest('a')?.getAttribute('href')).toBe('/settings')
  })

  it('mounts the shared NavBar', () => {
    renderPage()
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('renders more than one h2 section heading', () => {
    renderPage()
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(5)
  })
})
