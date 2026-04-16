import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../components/NavBar', () => ({
  NavBar: () => <div data-testid="navbar" />,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => (typeof opts === 'object' ? key : key),
  }),
}))

import HowToPlayPage from '../../pages/HowToPlayPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <HowToPlayPage />
    </MemoryRouter>,
  )
}

describe('HowToPlayPage', () => {
  it('renders the hero title', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('offline.howToPlay')
  })

  it('renders the NavBar', () => {
    renderPage()
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('describes the normal and special modes', () => {
    renderPage()
    expect(screen.getByText('offline.normal')).toBeInTheDocument()
    expect(screen.getByText('offline.special')).toBeInTheDocument()
  })

  it('lists base roles (villager, redHanded)', () => {
    renderPage()
    expect(screen.getAllByText('offline.villager').length).toBeGreaterThan(0)
    expect(screen.getAllByText('offline.redHanded').length).toBeGreaterThan(0)
  })

  it('lists all villager-side special roles', () => {
    renderPage()
    for (const key of [
      'offline.detective',
      'offline.guardian',
      'offline.mayor',
      'offline.judge',
      'offline.revenant',
    ]) {
      expect(screen.getByText(key)).toBeInTheDocument()
    }
  })

  it('lists all red-handed-side special roles', () => {
    renderPage()
    for (const key of [
      'offline.doubleAgent',
      'offline.infiltrator',
      'offline.kamikaze',
      'offline.corruptor',
      'offline.inverter',
    ]) {
      expect(screen.getByText(key)).toBeInTheDocument()
    }
  })
})
