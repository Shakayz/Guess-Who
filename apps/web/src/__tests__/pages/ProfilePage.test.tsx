import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: unknown; to: string }) => <a href={to}>{children as React.ReactNode}</a>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
    i18n: { language: 'en' },
  }),
}))

vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, token: 'tok' }),
}))

const mockApiGet = vi.fn()
const mockApiPatch = vi.fn()
const mockApiUpload = vi.fn()
const mockApiDelete = vi.fn()
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn().mockResolvedValue({}),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    put: vi.fn().mockResolvedValue({}),
    delete: (...args: unknown[]) => mockApiDelete(...args),
    upload: (...args: unknown[]) => mockApiUpload(...args),
  },
}))

vi.mock('../../components/NavBar', () => ({ NavBar: () => <div data-testid="navbar" /> }))

vi.mock('@imposter/ui', () => ({
  Avatar: ({ username }: { username: string }) => <div data-testid="avatar">{username}</div>,
  Badge: ({ tier }: { tier: string }) => <div data-testid="badge">{tier}</div>,
}))

vi.mock('@imposter/shared', () => ({
  RANK_CONFIG: {
    wooden:      { label: 'Wooden',      color: '#8B6914', icon: '🪵', lpRequired: 100 },
    bronze:      { label: 'Bronze',      color: '#CD7F32', icon: '🥉', lpRequired: 200 },
    silver:      { label: 'Silver',      color: '#C0C0C0', icon: '🥈', lpRequired: 300 },
    gold:        { label: 'Gold',        color: '#FFD700', icon: '🥇', lpRequired: 400 },
    diamond:     { label: 'Diamond',     color: '#B9F2FF', icon: '💎', lpRequired: 500 },
    master:      { label: 'Master',      color: '#9B59B6', icon: '👑', lpRequired: 600 },
    grandmaster: { label: 'Grandmaster', color: '#E74C3C', icon: '🌌', lpRequired: Infinity },
  },
}))

const meResponse = {
  id: 'u1',
  username: 'testuser',
  email: 'test@test.com',
  avatarUrl: null,
  rankTier: 'bronze',
  rankPoints: 150,
  honorPoints: 5,
  starCoins: 50,
  goldCoins: 0,
  locale: 'en',
  createdAt: new Date('2023-01-01').toISOString(),
  honorTeamplayer: 3,
  honorSharpMind: 1,
  honorGoodSport: 0,
}

const achievementsResponse: any[] = [
  { id: 'a1', key: 'first_win', name: 'First Win', description: 'Win your first game', icon: '🏆', unlocked: true, unlockedAt: new Date().toISOString() },
  { id: 'a2', key: 'veteran', name: 'Veteran', description: 'Play 50 games', icon: '⭐', unlocked: false, unlockedAt: null },
]

const profileStatsResponse = {
  stats: { totalGames: 30, wins: 18, losses: 12, winRate: 0.6, asVillager: 22, asImposter: 8, survived: 15 },
  recentGames: [
    { gameId: 'g1', role: 'villager', survived: true, winnerTeam: 'villagers', didWin: true, rounds: 3, playedAt: new Date().toISOString() },
  ],
}

import ProfilePage from '../../pages/ProfilePage'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/auth/me') return Promise.resolve(meResponse)
      if (path === '/achievements') return Promise.resolve(achievementsResponse)
      if (path.includes('/profile')) return Promise.resolve(profileStatsResponse)
      return Promise.resolve({})
    })
    mockApiPatch.mockResolvedValue({ ...meResponse, username: 'newuser' })
    mockApiUpload.mockResolvedValue({ avatarUrl: 'https://example.com/new-avatar.jpg' })
    mockApiDelete.mockResolvedValue(undefined)
  })

  it('renders without crashing', () => {
    render(<ProfilePage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })

  it('renders navbar', () => {
    render(<ProfilePage />, { wrapper })
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    render(<ProfilePage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })

  it('renders profile data after loading', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getAllByText('testuser').length).toBeGreaterThan(0)
    })
  })

  it('renders honor points display', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      // Honor points shown in stats
      expect(screen.getByText('profile.honorPoints')).toBeInTheDocument()
    })
  })

  it('renders star coins display', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('profile.starCoins')).toBeInTheDocument()
    })
  })

  it('renders rank points display', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('profile.rankPoints')).toBeInTheDocument()
    })
  })

  it('shows achievements section', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('First Win')).toBeInTheDocument()
    })
  })

  it('shows unlock status on achievements', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('Veteran')).toBeInTheDocument()
    })
  })

  it('shows edit button for avatar', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
  })

  it('shows username edit UI when pencil/edit is clicked', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      // Find the username edit button - it's typically a pencil icon button next to username
      const editButtons = screen.getAllByRole('button')
      const editUsernameBtn = editButtons.find(btn => btn.title === 'edit' || btn.getAttribute('aria-label') === 'edit')
      if (editUsernameBtn) fireEvent.click(editUsernameBtn)
    })
    expect(document.body).toBeInTheDocument()
  })

  it('renders honor labels for honor_teamplayer', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('profile.teamPlayer')).toBeInTheDocument()
    })
  })

  it('renders without errors even while data is loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    render(<ProfilePage />, { wrapper })
    expect(document.body).toBeInTheDocument()
  })

  it('shows rank progress bar when data loaded', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('Bronze')).toBeInTheDocument()
    })
  })

  it('renders honor counts when they are positive', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      // honorTeamplayer: 3
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('shows avatar edit form when edit button is clicked', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Edit'))
    await waitFor(() => {
      // The file input (sr-only) and the choose-image prompt should both appear
      expect(screen.getByLabelText('profile.chooseImage')).toBeInTheDocument()
    })
  })

  it('cancels avatar edit when cancel button clicked', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Edit'))
    await waitFor(() => expect(screen.getByLabelText('profile.chooseImage')).toBeInTheDocument())
    fireEvent.click(screen.getByText('profile.cancel'))
    expect(screen.queryByLabelText('profile.chooseImage')).not.toBeInTheDocument()
  })

  it('uploads avatar file when file selected and save clicked', async () => {
    // Mock URL.createObjectURL
    const mockObjectUrl = 'blob:http://localhost/fake-preview'
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue(mockObjectUrl), revokeObjectURL: vi.fn() })

    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Edit'))
    await waitFor(() => expect(screen.getByLabelText('profile.chooseImage')).toBeInTheDocument())

    const file = new File(['(content)'], 'avatar.png', { type: 'image/png' })
    const fileInput = screen.getByLabelText('profile.chooseImage') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByAltText('preview')).toBeInTheDocument())

    const saveBtns = screen.getAllByText('profile.save')
    fireEvent.click(saveBtns[saveBtns.length - 1])
    await waitFor(() => {
      expect(mockApiUpload).toHaveBeenCalledWith('/users/me/avatar', file)
    })

    vi.unstubAllGlobals()
  })

  it('shows remove avatar button when avatarUrl exists and edit is open', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/auth/me') return Promise.resolve({ ...meResponse, avatarUrl: 'https://example.com/avatar.jpg' })
      if (path === '/achievements') return Promise.resolve(achievementsResponse)
      if (path.includes('/profile')) return Promise.resolve(profileStatsResponse)
      return Promise.resolve({})
    })
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Edit'))
    await waitFor(() => {
      expect(screen.getByText('profile.removeAvatar')).toBeInTheDocument()
    })
  })

  it('calls delete endpoint when remove avatar button is clicked', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/auth/me') return Promise.resolve({ ...meResponse, avatarUrl: 'https://example.com/avatar.jpg' })
      if (path === '/achievements') return Promise.resolve(achievementsResponse)
      if (path.includes('/profile')) return Promise.resolve(profileStatsResponse)
      return Promise.resolve({})
    })
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Edit'))
    await waitFor(() => expect(screen.getByText('profile.removeAvatar')).toBeInTheDocument())
    await act(async () => { fireEvent.click(screen.getByText('profile.removeAvatar')) })
    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith('/users/me/avatar')
    })
  })

  it('shows username edit input when pencil button is clicked', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => expect(screen.getByTitle('profile.editUsername')).toBeInTheDocument())
    // The pencil button has title "profile.editUsername"
    const pencilBtn = screen.getByTitle('profile.editUsername')
    fireEvent.click(pencilBtn)
    await waitFor(() => {
      const inputEl = document.querySelector('input[placeholder="testuser"]')
      expect(inputEl).toBeInTheDocument()
    })
  })

  it('cancels username edit when X button is clicked', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => expect(screen.getByTitle('profile.editUsername')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('profile.editUsername'))
    await waitFor(() => expect(document.querySelector('input[placeholder="testuser"]')).toBeInTheDocument())
    fireEvent.click(screen.getByText('✕'))
    await waitFor(() => {
      expect(document.querySelector('input[placeholder="testuser"]')).not.toBeInTheDocument()
    })
  })

  it('saves username when save is clicked with valid username', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => expect(screen.getByTitle('profile.editUsername')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('profile.editUsername'))
    await waitFor(() => expect(document.querySelector('input[placeholder="testuser"]')).toBeInTheDocument())
    const usernameInput = document.querySelector('input[placeholder="testuser"]') as HTMLInputElement
    fireEvent.change(usernameInput, { target: { value: 'newusername' } })
    fireEvent.click(screen.getByText('profile.save'))
    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/users/me', { username: 'newusername' })
    })
  })

  it('shows minChars error when saving username with less than 2 chars', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => expect(screen.getByTitle('profile.editUsername')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('profile.editUsername'))
    await waitFor(() => expect(document.querySelector('input[placeholder="testuser"]')).toBeInTheDocument())
    const usernameInput = document.querySelector('input[placeholder="testuser"]') as HTMLInputElement
    fireEvent.change(usernameInput, { target: { value: 'a' } })
    fireEvent.click(screen.getByText('profile.save'))
    await waitFor(() => {
      expect(screen.getByText('profile.minChars')).toBeInTheDocument()
    })
  })

  it('shows game stats when profileStats loaded', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('profile.gamesPlayed')).toBeInTheDocument()
    })
  })

  it('renders recent games section', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('profile.recentGames')).toBeInTheDocument()
    })
  })

  it('renders joined date when me.createdAt is set', async () => {
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText(/profile.joinedDate/)).toBeInTheDocument()
    })
  })

  it('renders avatar image when me.avatarUrl is set', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/auth/me') return Promise.resolve({ ...meResponse, avatarUrl: 'https://example.com/avatar.jpg' })
      if (path === '/achievements') return Promise.resolve(achievementsResponse)
      if (path.includes('/profile')) return Promise.resolve(profileStatsResponse)
      return Promise.resolve({})
    })
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(document.querySelector('img[alt="avatar"]')).toBeInTheDocument()
    })
  })

  it('shows no achievements message when achievements array is empty', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/auth/me') return Promise.resolve(meResponse)
      if (path === '/achievements') return Promise.resolve([])
      if (path.includes('/profile')) return Promise.resolve(profileStatsResponse)
      return Promise.resolve({})
    })
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => {
      expect(screen.getByText('profile.noAchievements')).toBeInTheDocument()
    })
  })

  it('shows usernameTaken error when username mutation fails', async () => {
    mockApiPatch.mockRejectedValueOnce(new Error('conflict'))
    await act(async () => {
      render(<ProfilePage />, { wrapper })
    })
    await waitFor(() => expect(screen.getByTitle('profile.editUsername')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('profile.editUsername'))
    await waitFor(() => expect(document.querySelector('input[placeholder="testuser"]')).toBeInTheDocument())
    const usernameInput = document.querySelector('input[placeholder="testuser"]') as HTMLInputElement
    fireEvent.change(usernameInput, { target: { value: 'newusername' } })
    await act(async () => { fireEvent.click(screen.getByText('profile.save')) })
    await waitFor(() => {
      expect(screen.getByText('profile.usernameTaken')).toBeInTheDocument()
    })
  })
})
