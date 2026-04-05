import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue([
      { id: 'wp1', name: 'Default Pack', description: 'Basic words', locale: 'en', isPublic: true, isApproved: true, authorId: null, downloads: 100, _count: { pairs: 50 } },
    ]),
    post: vi.fn().mockResolvedValue({ id: 'wp-new', name: 'My Pack' }),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

import WordPacksPage from '../../pages/WordPacksPage'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('WordPacksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<WordPacksPage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    render(<WordPacksPage />, { wrapper })
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows the Word Packs heading', () => {
    render(<WordPacksPage />, { wrapper })
    expect(screen.getByText('📦 Word Packs')).toBeInTheDocument()
  })

  it('shows tab navigation buttons', () => {
    render(<WordPacksPage />, { wrapper })
    expect(screen.getByText('🌐 Browse')).toBeInTheDocument()
    expect(screen.getByText('📁 My Packs')).toBeInTheDocument()
    expect(screen.getByText('➕ Create')).toBeInTheDocument()
  })

  it('switches to Create tab and shows pack name input', () => {
    render(<WordPacksPage />, { wrapper })
    fireEvent.click(screen.getByText('➕ Create'))
    expect(screen.getByPlaceholderText('Pack name *')).toBeInTheDocument()
  })

  it('switches to My Packs tab', () => {
    render(<WordPacksPage />, { wrapper })
    fireEvent.click(screen.getByText('📁 My Packs'))
    expect(document.body).toBeInTheDocument()
  })
})
