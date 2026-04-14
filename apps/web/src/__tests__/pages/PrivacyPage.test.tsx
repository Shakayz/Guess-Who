import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

// Stub NavBar: avoids pulling in auth/social/api mocks for a static page test.
vi.mock('../../components/NavBar', () => ({
  NavBar: () => <div data-testid="navbar" />,
}))

import PrivacyPage from '../../pages/PrivacyPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  )
}

describe('PrivacyPage', () => {
  it('renders the privacy policy title', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Privacy Policy/i)
  })

  it('shows a back-to-settings link', () => {
    renderPage()
    const link = screen.getByText(/Back to Settings/i)
    expect(link).toBeInTheDocument()
    expect(link.closest('a')?.getAttribute('href')).toBe('/settings')
  })

  it('renders the 10 numbered policy sections', () => {
    renderPage()
    for (const title of [
      /1\. Data We Collect/,
      /2\. How We Use Your Data/,
      /3\. Data Sharing/,
      /4\. Data Retention/,
      /5\. Account Deletion/,
      /6\. Children's Privacy/,
      /7\. Cookies and Local Storage/,
      /8\. Security/,
      /9\. Changes to This Policy/,
      /10\. Contact/,
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it('exposes a mailto contact link', () => {
    renderPage()
    const link = screen.getByText(/privacy@imposter\.game/)
    expect(link.closest('a')?.getAttribute('href')).toBe('mailto:privacy@imposter.game')
  })

  it('renders NavBar', () => {
    renderPage()
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })
})
