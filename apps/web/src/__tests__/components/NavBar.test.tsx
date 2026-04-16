import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
const mockLocation = { pathname: '/' }

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}))

const mockChangeLanguage = vi.fn()
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: mockChangeLanguage },
  }),
}))

const mockClearAuth = vi.fn()
vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, clearAuth: mockClearAuth }),
}))

vi.mock('../../store/social', () => ({
  useSocialStore: (selector: (s: unknown) => unknown) =>
    selector({ activeDm: null, setActiveDm: vi.fn(), unreadCounts: {} }),
}))

vi.mock('../../lib/api', () => ({
  api: { patch: vi.fn().mockResolvedValue({}) },
}))

vi.mock('../../components/DmChatPanel', () => ({
  DmChatPanel: () => <div data-testid="dm-chat-panel" />,
}))

import { NavBar } from '../../components/NavBar'

describe('NavBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation.pathname = '/'
    mockNavigate.mockReset()
    mockClearAuth.mockReset()
    Object.defineProperty(window, 'location', {
      value: { replace: vi.fn() },
      writable: true,
      configurable: true,
    })
  })

  it('renders without crashing', () => {
    render(<NavBar />)
    expect(document.body).toBeInTheDocument()
  })

  it('shows the Red Handed brand name', () => {
    render(<NavBar />)
    expect(screen.getByText('Red Handed')).toBeInTheDocument()
  })

  it('shows the current user username', () => {
    render(<NavBar />)
    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('shows sign out button', () => {
    render(<NavBar />)
    expect(screen.getByText('nav.signOut')).toBeInTheDocument()
  })

  it('calls clearAuth and redirects on logout', () => {
    render(<NavBar />)
    fireEvent.click(screen.getByText('nav.signOut'))
    expect(mockClearAuth).toHaveBeenCalledTimes(1)
    expect(window.location.replace).toHaveBeenCalledWith('/auth')
  })

  it('navigates to home when logo is clicked', () => {
    render(<NavBar />)
    fireEvent.click(screen.getByText('Red Handed'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('opens language dropdown on flag button click', () => {
    render(<NavBar />)
    const langButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('img') !== null && !btn.textContent?.includes('Red Handed'),
    )
    expect(langButton).toBeDefined()
    fireEvent.click(langButton!)
    expect(screen.getByText('English')).toBeInTheDocument()
  })

  it('changes language when a language option is selected', async () => {
    const { api } = await import('../../lib/api')
    render(<NavBar />)
    const langButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('img') !== null && !btn.textContent?.includes('Red Handed'),
    )
    fireEvent.click(langButton!)
    fireEvent.click(screen.getByText('Français'))
    expect(mockChangeLanguage).toHaveBeenCalledWith('fr')
    expect(api.patch).toHaveBeenCalledWith('/users/me', { locale: 'fr' })
  })

  it('closes language dropdown when clicking outside', () => {
    render(<NavBar />)
    const langButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('img') !== null && !btn.textContent?.includes('Red Handed'),
    )
    fireEvent.click(langButton!)
    expect(screen.getByText('English')).toBeInTheDocument()
    // Simulate mousedown outside the dropdown
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('English')).not.toBeInTheDocument()
  })

  it('does not close dropdown when clicking inside the dropdown ref', () => {
    render(<NavBar />)
    const langButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('img') !== null && !btn.textContent?.includes('Red Handed'),
    )!
    fireEvent.click(langButton)
    expect(screen.getByText('English')).toBeInTheDocument()
    // Click inside the dropdown itself — should stay open
    fireEvent.mouseDown(langButton)
    expect(screen.getByText('English')).toBeInTheDocument()
  })

  it('does not render DmChatPanel when activeDm is null', () => {
    render(<NavBar />)
    expect(screen.queryByTestId('dm-chat-panel')).not.toBeInTheDocument()
  })

  it('shows checkmark for current language in dropdown', () => {
    render(<NavBar />)
    const langButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('img') !== null && !btn.textContent?.includes('Red Handed'),
    )!
    fireEvent.click(langButton)
    // The current language (en) should have a checkmark
    expect(screen.getByText('✓')).toBeInTheDocument()
  })
})
