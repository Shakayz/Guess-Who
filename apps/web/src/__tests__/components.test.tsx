import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mock react-router-dom ----
const mockNavigate = vi.fn()
const mockLocation = { pathname: '/' }

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}))

// ---- Mock react-i18next ----
const mockChangeLanguage = vi.fn()
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: mockChangeLanguage,
    },
  }),
}))

// ---- Mock stores ----
const mockClearAuth = vi.fn()
const mockSetActiveDm = vi.fn()

vi.mock('../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({
      user: { id: 'u1', username: 'testuser' },
      clearAuth: mockClearAuth,
    }),
}))

vi.mock('../store/social', () => ({
  useSocialStore: (selector: (s: unknown) => unknown) =>
    selector({
      activeDm: null,
      setActiveDm: mockSetActiveDm,
    }),
}))

// ---- Mock api ----
vi.mock('../lib/api', () => ({
  api: { patch: vi.fn().mockResolvedValue({}) },
}))

// ---- Mock DmChatPanel (used by NavBar) ----
vi.mock('../components/DmChatPanel', () => ({
  DmChatPanel: () => <div data-testid="dm-chat-panel" />,
}))

// ---- Mock socket (used by DmChatPanel in isolation tests) ----
const mockSocketOn = vi.fn()
const mockSocketOff = vi.fn()
const mockSocketEmit = vi.fn()
const mockSocket = {
  on: mockSocketOn,
  off: mockSocketOff,
  emit: mockSocketEmit,
}
vi.mock('../lib/socket', () => ({
  getSocket: () => mockSocket,
}))

import { BottomNav } from '../components/BottomNav'
import { NavBar } from '../components/NavBar'

// ---------------------------------------------------------------------------
// BottomNav tests
// ---------------------------------------------------------------------------

describe('BottomNav', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockLocation.pathname = '/'
  })

  it('renders all five navigation tabs', () => {
    render(<BottomNav />)
    // Labels come from t(key) which returns the key itself
    expect(screen.getByText('nav.play')).toBeInTheDocument()
    expect(screen.getByText('nav.leaderboard')).toBeInTheDocument()
    expect(screen.getByText('nav.history')).toBeInTheDocument()
    expect(screen.getByText('nav.friends')).toBeInTheDocument()
    expect(screen.getByText('nav.profile')).toBeInTheDocument()
  })

  it('navigates when a tab button is clicked', () => {
    render(<BottomNav />)
    fireEvent.click(screen.getByText('nav.leaderboard'))
    expect(mockNavigate).toHaveBeenCalledWith('/leaderboard')
  })

  it('returns null on /game/ paths', () => {
    mockLocation.pathname = '/game/abc'
    const { container } = render(<BottomNav />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null on /lobby/ paths', () => {
    mockLocation.pathname = '/lobby/xyz'
    const { container } = render(<BottomNav />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null on /auth paths', () => {
    mockLocation.pathname = '/auth'
    const { container } = render(<BottomNav />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a nav element when on a visible path', () => {
    mockLocation.pathname = '/'
    render(<BottomNav />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('navigates to profile when profile tab is clicked', () => {
    render(<BottomNav />)
    fireEvent.click(screen.getByText('nav.profile'))
    expect(mockNavigate).toHaveBeenCalledWith('/profile')
  })
})

// ---------------------------------------------------------------------------
// NavBar tests
// ---------------------------------------------------------------------------

describe('NavBar', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockClearAuth.mockReset()
    mockChangeLanguage.mockReset()
    mockLocation.pathname = '/'
  })

  it('renders the app brand name', () => {
    render(<NavBar />)
    expect(screen.getByText('Imposter')).toBeInTheDocument()
  })

  it('renders the current user username', () => {
    render(<NavBar />)
    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('renders the sign out button', () => {
    render(<NavBar />)
    expect(screen.getByText('nav.signOut')).toBeInTheDocument()
  })

  it('calls clearAuth and redirects on logout click', () => {
    // jsdom does not allow spying on window.location.replace directly,
    // so replace the whole location object with a writable copy.
    const replaceFn = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, replace: replaceFn },
      writable: true,
      configurable: true,
    })
    render(<NavBar />)
    fireEvent.click(screen.getByText('nav.signOut'))
    expect(mockClearAuth).toHaveBeenCalledTimes(1)
    expect(replaceFn).toHaveBeenCalledWith('/auth')
  })

  it('navigates home when logo button is clicked', () => {
    render(<NavBar />)
    fireEvent.click(screen.getByText('Imposter'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('opens the language dropdown on flag button click', () => {
    render(<NavBar />)
    // The language switcher button contains the flag image
    const langButton = screen.getAllByRole('button').find(
      (btn) => btn.querySelector('img') !== null && !btn.textContent?.includes('Imposter'),
    )
    expect(langButton).toBeDefined()
    fireEvent.click(langButton!)
    // Dropdown should now show language options
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Français')).toBeInTheDocument()
  })

  it('calls i18n.changeLanguage when a language option is selected', async () => {
    const { api } = await import('../lib/api')
    render(<NavBar />)
    // Open dropdown
    const langButton = screen.getAllByRole('button').find(
      (btn) => btn.querySelector('img') !== null && !btn.textContent?.includes('Imposter'),
    )
    fireEvent.click(langButton!)
    // Click French option
    fireEvent.click(screen.getByText('Français'))
    expect(mockChangeLanguage).toHaveBeenCalledWith('fr')
    expect(api.patch).toHaveBeenCalledWith('/users/me', { locale: 'fr' })
  })

  it('renders desktop nav links', () => {
    render(<NavBar />)
    // There should be nav.play, nav.leaderboard, etc. in the desktop nav section
    const playLinks = screen.getAllByText('nav.play')
    expect(playLinks.length).toBeGreaterThanOrEqual(1)
  })
})
