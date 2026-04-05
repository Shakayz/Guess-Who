import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue(null),
    post: vi.fn().mockResolvedValue({}),
  },
}))

import SeasonPassPage from '../../pages/SeasonPassPage'
import { api } from '../../lib/api'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('SeasonPassPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<SeasonPassPage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    render(<SeasonPassPage />, { wrapper })
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows the season pass title', () => {
    render(<SeasonPassPage />, { wrapper })
    expect(screen.getByText('Season Pass')).toBeInTheDocument()
  })

  it('shows no active season message when season data is null', () => {
    render(<SeasonPassPage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })

  it('fetches season data on mount', () => {
    render(<SeasonPassPage />, { wrapper })
    expect(api.get).toHaveBeenCalledWith('/season-pass/current')
  })
})
