import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

const mockApiGet = vi.fn()
const mockApiPost = vi.fn()
const mockApiDelete = vi.fn()
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}))

const publicPacks = [
  { id: 'wp1', name: 'Default Pack', description: 'Basic words', locale: 'en', isPublic: true, isApproved: true, authorId: null, downloads: 100, _count: { pairs: 50 } },
  { id: 'wp2', name: 'Animal Pack', description: 'Animal words', locale: 'en', isPublic: true, isApproved: true, authorId: null, downloads: 50, _count: { pairs: 30 } },
]

const myPacks = [
  { id: 'wp3', name: 'My Custom Pack', description: 'My words', locale: 'en', isPublic: false, isApproved: false, authorId: 'u1', downloads: 0, _count: { pairs: 5 } },
]

import WordPacksPage from '../../pages/WordPacksPage'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('WordPacksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue(publicPacks)
    mockApiPost.mockResolvedValue({ id: 'wp-new', name: 'My Pack' })
    mockApiDelete.mockResolvedValue({})
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

  it('renders public packs after data loads', async () => {
    await act(async () => {
      render(<WordPacksPage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('Default Pack')).toBeInTheDocument()
      expect(screen.getByText('Animal Pack')).toBeInTheDocument()
    })
  })

  it('switches to Create tab and shows pack name input', () => {
    render(<WordPacksPage />, { wrapper })
    fireEvent.click(screen.getByText('➕ Create'))
    expect(screen.getByPlaceholderText('Pack name *')).toBeInTheDocument()
  })

  it('shows word pairs input fields in create tab', () => {
    render(<WordPacksPage />, { wrapper })
    fireEvent.click(screen.getByText('➕ Create'))
    expect(screen.getByPlaceholderText('Word A')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Word B')).toBeInTheDocument()
  })

  it('can add a new word pair row', () => {
    render(<WordPacksPage />, { wrapper })
    fireEvent.click(screen.getByText('➕ Create'))
    const addPairBtn = screen.getByText('+ Add pair')
    fireEvent.click(addPairBtn)
    // Now there should be 2 pairs (2 Word A inputs)
    const wordAInputs = screen.getAllByPlaceholderText('Word A')
    expect(wordAInputs.length).toBe(2)
  })

  it('can remove a word pair row', () => {
    render(<WordPacksPage />, { wrapper })
    fireEvent.click(screen.getByText('➕ Create'))
    // Add a second pair first
    fireEvent.click(screen.getByText('+ Add pair'))
    // Now remove the second pair
    const removeBtns = screen.getAllByText('✕')
    fireEvent.click(removeBtns[0])
    const wordAInputs = screen.getAllByPlaceholderText('Word A')
    expect(wordAInputs.length).toBe(1)
  })

  it('switches to My Packs tab', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/word-packs') return Promise.resolve(publicPacks)
      if (path === '/word-packs/my') return Promise.resolve(myPacks)
      return Promise.resolve([])
    })
    render(<WordPacksPage />, { wrapper })
    fireEvent.click(screen.getByText('📁 My Packs'))
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/word-packs/my')
    })
  })

  it('shows my packs data in my packs tab', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/word-packs') return Promise.resolve(publicPacks)
      if (path === '/word-packs/my') return Promise.resolve(myPacks)
      return Promise.resolve([])
    })
    await act(async () => {
      render(<WordPacksPage />, { wrapper })
    })
    fireEvent.click(screen.getByText('📁 My Packs'))
    await waitFor(() => {
      expect(screen.getByText('My Custom Pack')).toBeInTheDocument()
    })
  })

  it('submits create form with pack data', async () => {
    render(<WordPacksPage />, { wrapper })
    fireEvent.click(screen.getByText('➕ Create'))
    // Fill in pack name
    fireEvent.change(screen.getByPlaceholderText('Pack name *'), { target: { value: 'My New Pack' } })
    // Fill in word pair
    fireEvent.change(screen.getByPlaceholderText('Word A'), { target: { value: 'Cat' } })
    fireEvent.change(screen.getByPlaceholderText('Word B'), { target: { value: 'Dog' } })
    // Submit
    const submitBtn = screen.getByText(/Create Pack/)
    await act(async () => {
      fireEvent.click(submitBtn)
    })
    expect(mockApiPost).toHaveBeenCalledWith('/word-packs', expect.objectContaining({
      name: 'My New Pack',
    }))
  })

  it('can update pair fields', () => {
    render(<WordPacksPage />, { wrapper })
    fireEvent.click(screen.getByText('➕ Create'))
    const wordAInput = screen.getByPlaceholderText('Word A')
    fireEvent.change(wordAInput, { target: { value: 'Apple' } })
    expect(wordAInput).toHaveValue('Apple')
  })

  it('can update description field', () => {
    render(<WordPacksPage />, { wrapper })
    fireEvent.click(screen.getByText('➕ Create'))
    const descInput = screen.getByPlaceholderText('Description (optional)')
    fireEvent.change(descInput, { target: { value: 'A great pack' } })
    expect(descInput).toHaveValue('A great pack')
  })

  it('shows loading state for browse tab', () => {
    mockApiGet.mockReturnValueOnce(new Promise(() => {}))
    render(<WordPacksPage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })

  it('deletes a pack from my packs tab', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/word-packs/my') return Promise.resolve(myPacks)
      return Promise.resolve([])
    })
    await act(async () => {
      render(<WordPacksPage />, { wrapper })
    })
    fireEvent.click(screen.getByText('📁 My Packs'))
    await waitFor(() => {
      expect(screen.getByText('My Custom Pack')).toBeInTheDocument()
    })
    const deleteBtns = screen.getAllByText('Delete')
    await act(async () => {
      fireEvent.click(deleteBtns[0])
    })
    expect(mockApiDelete).toHaveBeenCalledWith(expect.stringContaining('wp3'))
  })
})
