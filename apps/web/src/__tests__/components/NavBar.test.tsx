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

// NavBar now hydrates the star-coin chip via GET /auth/me, so the api mock
// needs a `get` stub too — without it, `api.get(...).then(...)` throws
// TypeError inside NavBar's mount effect and every test fails to render.
vi.mock('../../lib/api', () => ({
  api: {
    patch: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({ starCoins: 0 }),
  },
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

  it('shows the Red Handed brand logo', () => {
    render(<NavBar />)
    // Logo is now the masks.png image — alt text is the brand name.
    expect(screen.getByAltText('Red Handed')).toBeInTheDocument()
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
    fireEvent.click(screen.getByLabelText('Red Handed home'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('opens language dropdown on flag button click', () => {
    render(<NavBar />)
    // The language button is the one whose <img> src points at flagcdn.
    // This filter used to exclude the logo by its text content; the logo is
    // now an image too, so we select the language button by its flag image.
    const langButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('img[src*="flagcdn"]') !== null,
    )
    expect(langButton).toBeDefined()
    fireEvent.click(langButton!)
    expect(screen.getByText('English')).toBeInTheDocument()
  })

  it('changes language when a language option is selected', async () => {
    const { api } = await import('../../lib/api')
    render(<NavBar />)
    const langButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('img[src*="flagcdn"]') !== null,
    )
    fireEvent.click(langButton!)
    fireEvent.click(screen.getByText('Français'))
    expect(mockChangeLanguage).toHaveBeenCalledWith('fr')
    expect(api.patch).toHaveBeenCalledWith('/users/me', { locale: 'fr' })
  })

  it('closes language dropdown when clicking outside', () => {
    render(<NavBar />)
    const langButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('img[src*="flagcdn"]') !== null,
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
      btn => btn.querySelector('img[src*="flagcdn"]') !== null,
    )!
    fireEvent.click(langButton)
    expect(screen.getByText('English')).toBeInTheDocument()
    // Click inside the dropdown itself — should stay open
    fireEvent.mouseDown(langButton)
    expect(screen.getByText('English')).toBeInTheDocument()
  })

  it('shows checkmark for current language in dropdown', () => {
    render(<NavBar />)
    const langButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('img[src*="flagcdn"]') !== null,
    )!
    fireEvent.click(langButton)
    // The current language (en) should have a checkmark
    expect(screen.getByText('✓')).toBeInTheDocument()
  })
})
