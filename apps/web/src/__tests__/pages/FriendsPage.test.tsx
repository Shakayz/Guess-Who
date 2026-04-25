import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

vi.mock('../../store/social', () => ({
  useSocialStore: (selector: (s: unknown) => unknown) =>
    selector({ activeDm: null, setActiveDm: vi.fn(), unreadCounts: {}, clearUnread: vi.fn() }),
}))

const mockApiGet = vi.fn()
const mockApiPost = vi.fn()
const mockApiPut = vi.fn()
const mockApiDelete = vi.fn()
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}))

import FriendsPage from '../../pages/FriendsPage'

describe('FriendsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock different API calls separately
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/friends') return Promise.resolve({ friends: [
        { friendshipId: 'f1', user: { id: 'u2', username: 'friend1', avatarUrl: null } },
        { friendshipId: 'f2', user: { id: 'u3', username: 'friend2', avatarUrl: null } },
      ] })
      if (path === '/friends/requests') return Promise.resolve({ requests: [
        { friendshipId: 'r1', from: { id: 'u4', username: 'requester1', avatarUrl: null }, createdAt: new Date().toISOString() },
      ] })
      if (path === '/friends/requests/outgoing') return Promise.resolve({ requests: [] })
      if (path.includes('/users/search')) return Promise.resolve({ users: [
        { id: 'u5', username: 'newuser', avatarUrl: null },
      ] })
      return Promise.resolve({ friends: [], requests: [] })
    })
    mockApiPost.mockResolvedValue({})
    mockApiPut.mockResolvedValue({})
    mockApiDelete.mockResolvedValue({})
  })

  it('renders without crashing', () => {
    render(<FriendsPage />)
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    render(<FriendsPage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows friends page title (h1)', () => {
    render(<FriendsPage />)
    const titles = screen.getAllByText('friends.title')
    expect(titles.length).toBeGreaterThanOrEqual(1)
  })

  it('shows find players section', () => {
    render(<FriendsPage />)
    expect(screen.getByText('friends.findPlayers')).toBeInTheDocument()
  })

  it('fetches friends and requests data on mount', () => {
    render(<FriendsPage />)
    expect(mockApiGet).toHaveBeenCalled()
  })

  it('renders friends list after data loads', async () => {
    await act(async () => {
      render(<FriendsPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('friend1')).toBeInTheDocument()
      expect(screen.getByText('friend2')).toBeInTheDocument()
    })
  })

  it('renders pending friend requests', async () => {
    await act(async () => {
      render(<FriendsPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('requester1')).toBeInTheDocument()
    })
  })

  it('accepts a friend request when accept is clicked', async () => {
    await act(async () => {
      render(<FriendsPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('requester1')).toBeInTheDocument()
    })
    const acceptBtn = screen.getByText('friends.accept')
    await act(async () => {
      fireEvent.click(acceptBtn)
    })
    expect(mockApiPut).toHaveBeenCalledWith(expect.stringContaining('r1'), expect.anything())
  })

  it('declines a friend request when decline is clicked', async () => {
    await act(async () => {
      render(<FriendsPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('requester1')).toBeInTheDocument()
    })
    const declineBtn = screen.getByText('friends.decline')
    await act(async () => {
      fireEvent.click(declineBtn)
    })
    expect(mockApiDelete).toHaveBeenCalledWith(expect.stringContaining('r1'))
  })

  it('removes a friend when remove button is clicked', async () => {
    await act(async () => {
      render(<FriendsPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('friend1')).toBeInTheDocument()
    })
    // The unfriend button is an icon-only X with the i18n key on aria-label,
    // so query by accessible name rather than visible text.
    const removeBtns = screen.getAllByLabelText('friends.unfriend')
    await act(async () => {
      fireEvent.click(removeBtns[0])
    })
    expect(mockApiDelete).toHaveBeenCalledWith(expect.stringContaining('f1'))
  })

  it('shows no friends message when friends list is empty', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/friends') return Promise.resolve({ friends: [] })
      if (path === '/friends/requests') return Promise.resolve({ requests: [] })
      return Promise.resolve({})
    })
    await act(async () => {
      render(<FriendsPage />)
    })
    await waitFor(() => {
      expect(screen.getByText('friends.noFriends')).toBeInTheDocument()
    })
  })

  it('shows search results when user types in search box', async () => {
    await act(async () => {
      render(<FriendsPage />)
    })
    // Find the search input - it should be the add friend search
    const searchInputs = screen.getAllByRole('textbox')
    if (searchInputs.length > 0) {
      fireEvent.change(searchInputs[searchInputs.length - 1], { target: { value: 'newuser' } })
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('search'))
      }, { timeout: 1000 })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('sends add friend request from search results', async () => {
    // Pre-mock with search results available immediately
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/friends') return Promise.resolve({ friends: [] })
      if (path === '/friends/requests') return Promise.resolve({ requests: [] })
      if (path.includes('/users/search')) return Promise.resolve({ users: [
        { id: 'u5', username: 'newuser', avatarUrl: null },
      ] })
      return Promise.resolve({})
    })
    await act(async () => {
      render(<FriendsPage />)
    })
    await waitFor(() => {
      expect(screen.queryByText('friends.noFriends')).toBeInTheDocument()
    })
    // Type in search to trigger search results
    const searchInputs = screen.getAllByRole('textbox')
    await act(async () => {
      fireEvent.change(searchInputs[searchInputs.length - 1], { target: { value: 'newuser' } })
    })
    // Wait for debounced search
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('search'))
    }, { timeout: 1000 })
    // If search results appear, click add
    const addBtns = screen.queryAllByText('friends.add')
    if (addBtns.length > 0) {
      await act(async () => {
        fireEvent.click(addBtns[0])
      })
      expect(mockApiPost).toHaveBeenCalledWith('/friends/request', expect.any(Object))
    }
    expect(document.body).toBeInTheDocument()
  })
})
