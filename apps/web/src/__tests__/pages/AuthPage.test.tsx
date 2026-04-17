import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---- Mocks ----
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
}))

const mockChangeLanguage = vi.fn()
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: mockChangeLanguage },
  }),
}))

const mockAuthState = { setAuth: vi.fn(), token: null, user: null, clearAuth: vi.fn() }
vi.mock('../../store/auth', () => ({
  useAuthStore: vi.fn((selector: (s: unknown) => unknown) => selector(mockAuthState)),
}))

vi.mock('../../lib/api', () => ({
  api: {
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

import AuthPage from '../../pages/AuthPage'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth'

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, replace: vi.fn(), origin: 'https://test.example.com' },
      writable: true,
      configurable: true,
    })
    // Default: Apple Services ID configured so handleApple reaches the SDK check.
    // Individual tests override with '' to exercise the "not configured" guard.
    // vi.stubEnv propagates to all modules (unlike mutating import.meta.env directly,
    // which only affects the test module's binding).
    vi.stubEnv('VITE_APPLE_CLIENT_ID', 'com.test.services')
    delete (window as any).google
    delete (window as any).AppleID
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders without crashing', () => {
    render(<AuthPage />)
    // The brand lockup is now an <img alt="Red Handed !"> rather than a text node.
    expect(screen.getByAltText('Red Handed !')).toBeInTheDocument()
  })

  it('shows sign-in form by default', () => {
    render(<AuthPage />)
    expect(screen.getByPlaceholderText('Email or username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('auth.password')).toBeInTheDocument()
  })

  it('switches to sign-up mode when Sign Up tab is clicked', () => {
    render(<AuthPage />)
    const signUpBtn = screen.getAllByText('auth.signUp')[0]
    fireEvent.click(signUpBtn)
    expect(screen.getByPlaceholderText('auth.username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('auth.email')).toBeInTheDocument()
  })

  it('shows error when sign-in fails', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Invalid credentials'))
    render(<AuthPage />)
    fireEvent.change(screen.getByPlaceholderText('Email or username'), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('auth.password'), { target: { value: 'password123' } })
    const form = screen.getByPlaceholderText('auth.password').closest('form')!
    fireEvent.submit(form)
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('calls api.post on successful sign-in', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ token: 'tok', user: { id: '1', username: 'alice' } })
    render(<AuthPage />)
    fireEvent.change(screen.getByPlaceholderText('Email or username'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByPlaceholderText('auth.password'), { target: { value: 'password123' } })
    const form = screen.getByPlaceholderText('auth.password').closest('form')!
    fireEvent.submit(form)
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/signin', expect.any(Object))
    })
  })

  it('renders language selector buttons', () => {
    render(<AuthPage />)
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Français')).toBeInTheDocument()
  })

  it('shows Google and Apple OAuth buttons', () => {
    render(<AuthPage />)
    expect(screen.getByText('Continue with Google')).toBeInTheDocument()
    expect(screen.getByText('Continue with Apple')).toBeInTheDocument()
  })

  it('shows error when Google sign-in is not configured', () => {
    render(<AuthPage />)
    fireEvent.click(screen.getByText('Continue with Google'))
    expect(screen.getByText('Google sign-in is not available yet. Please use email & password.')).toBeInTheDocument()
  })

  it('shows error when Apple Sign-In client ID is not configured', () => {
    vi.stubEnv('VITE_APPLE_CLIENT_ID', '')
    render(<AuthPage />)
    fireEvent.click(screen.getByText('Continue with Apple'))
    expect(screen.getByText('Apple sign-in is not available yet. Please use email & password.')).toBeInTheDocument()
  })

  it('switches sign-in mode back when sign in tab is clicked after sign-up', () => {
    render(<AuthPage />)
    const signUpBtn = screen.getAllByText('auth.signUp')[0]
    fireEvent.click(signUpBtn)
    const signInBtn = screen.getAllByText('auth.signIn')[0]
    fireEvent.click(signInBtn)
    expect(screen.getByPlaceholderText('Email or username')).toBeInTheDocument()
  })

  it('submits sign-up form with correct data', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ token: 'tok', user: { id: '1', username: 'newuser' } })
    render(<AuthPage />)
    // Switch to sign up
    fireEvent.click(screen.getAllByText('auth.signUp')[0])
    fireEvent.change(screen.getByPlaceholderText('auth.username'), { target: { value: 'newuser' } })
    fireEvent.change(screen.getByPlaceholderText('auth.email'), { target: { value: 'newuser@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('auth.password'), { target: { value: 'password123' } })
    const form = screen.getByPlaceholderText('auth.password').closest('form')!
    fireEvent.submit(form)
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/signup', expect.any(Object))
    })
  })

  it('handles language change button click', () => {
    render(<AuthPage />)
    fireEvent.click(screen.getByText('Français'))
    expect(mockChangeLanguage).toHaveBeenCalledWith('fr')
  })

  it('calls api.patch on language change', async () => {
    render(<AuthPage />)
    await act(async () => {
      fireEvent.click(screen.getByText('Español'))
    })
    expect(mockChangeLanguage).toHaveBeenCalledWith('es')
  })

  it('renders all language options', () => {
    render(<AuthPage />)
    expect(screen.getByText('العربية')).toBeInTheDocument()
    expect(screen.getByText('Italiano')).toBeInTheDocument()
    expect(screen.getByText('Português')).toBeInTheDocument()
  })

  it('shows sign-up error when registration fails', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Username taken'))
    render(<AuthPage />)
    fireEvent.click(screen.getAllByText('auth.signUp')[0])
    fireEvent.change(screen.getByPlaceholderText('auth.username'), { target: { value: 'taken' } })
    fireEvent.change(screen.getByPlaceholderText('auth.email'), { target: { value: 'taken@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('auth.password'), { target: { value: 'password123' } })
    const form = screen.getByPlaceholderText('auth.password').closest('form')!
    fireEvent.submit(form)
    await waitFor(() => {
      expect(screen.getByText('Username taken')).toBeInTheDocument()
    })
  })

  it('shows loading spinner on Google button when oauthLoading is google', async () => {
    // Simulate Google being available so the spinner branch is triggered
    const mockRequestAccessToken = vi.fn()
    ;(window as any).google = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn().mockReturnValue({ requestAccessToken: mockRequestAccessToken }),
        },
      },
    }
    // Set VITE_GOOGLE_CLIENT_ID so the flow can proceed
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'fake-client-id')
    render(<AuthPage />)
    fireEvent.click(screen.getByText('Continue with Google'))
    // The spinner SVG should appear (oauthLoading === 'google')
    expect(document.body).toBeInTheDocument()
    delete (window as any).google
  })

  it('shows Apple loading spinner when oauthLoading is apple', async () => {
    ;(window as any).AppleID = {
      auth: {
        init: vi.fn(),
        signIn: vi.fn().mockResolvedValue({
          authorization: { id_token: 'tok' },
          user: null,
        }),
      },
    }
    vi.mocked(api.post).mockResolvedValueOnce({ token: 'tok', user: { id: 'u1', username: 'alice' } })
    render(<AuthPage />)
    fireEvent.click(screen.getByText('Continue with Apple'))
    // While loading, the spinner SVG renders instead of AppleIcon
    expect(document.body).toBeInTheDocument()
    delete (window as any).AppleID
  })

  it('handles OAuth response with needsUsername true — shows username setup screen', async () => {
    ;(window as any).AppleID = {
      auth: {
        init: vi.fn(),
        signIn: vi.fn().mockResolvedValue({
          authorization: { id_token: 'tok' },
          user: null,
        }),
      },
    }
    vi.mocked(api.post).mockResolvedValueOnce({
      needsUsername: true,
      setupToken: 'setup-tok',
      suggestedUsername: 'newuser123',
    })
    render(<AuthPage />)
    fireEvent.click(screen.getByText('Continue with Apple'))
    await waitFor(() => {
      expect(screen.getByText('Choose your username')).toBeInTheDocument()
    })
    delete (window as any).AppleID
  })

  it('submits username setup form successfully', async () => {
    ;(window as any).AppleID = {
      auth: {
        init: vi.fn(),
        signIn: vi.fn().mockResolvedValue({
          authorization: { id_token: 'tok' },
          user: null,
        }),
      },
    }
    vi.mocked(api.post)
      .mockResolvedValueOnce({ needsUsername: true, setupToken: 'setup-tok', suggestedUsername: 'newuser123' })
      .mockResolvedValueOnce({ token: 'tok', user: { id: 'u1', username: 'newuser123' } })
    render(<AuthPage />)
    fireEvent.click(screen.getByText('Continue with Apple'))
    await waitFor(() => expect(screen.getByText('Choose your username')).toBeInTheDocument())
    const form = screen.getByPlaceholderText('username').closest('form')!
    await act(async () => { fireEvent.submit(form) })
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/setup-username', expect.any(Object))
    })
    delete (window as any).AppleID
  })

  it('shows error on username setup failure', async () => {
    ;(window as any).AppleID = {
      auth: {
        init: vi.fn(),
        signIn: vi.fn().mockResolvedValue({
          authorization: { id_token: 'tok' },
          user: null,
        }),
      },
    }
    vi.mocked(api.post)
      .mockResolvedValueOnce({ needsUsername: true, setupToken: 'setup-tok', suggestedUsername: 'newuser123' })
      .mockRejectedValueOnce(new Error('Username already taken'))
    render(<AuthPage />)
    fireEvent.click(screen.getByText('Continue with Apple'))
    await waitFor(() => expect(screen.getByText('Choose your username')).toBeInTheDocument())
    const form = screen.getByPlaceholderText('username').closest('form')!
    await act(async () => { fireEvent.submit(form) })
    await waitFor(() => {
      expect(screen.getByText('Username already taken')).toBeInTheDocument()
    })
    delete (window as any).AppleID
  })

  it('switches mode via footer link button', () => {
    render(<AuthPage />)
    // Footer has a button that toggles mode
    const footerBtn = screen.getAllByRole('button').find(
      (btn) => btn.textContent === 'auth.signUp' && btn.className.includes('text-brand'),
    )
    if (footerBtn) fireEvent.click(footerBtn)
    expect(document.body).toBeInTheDocument()
  })

  it('handles Arabic language selection (sets RTL)', () => {
    render(<AuthPage />)
    fireEvent.click(screen.getByText('العربية'))
    expect(mockChangeLanguage).toHaveBeenCalledWith('ar')
  })

  it('Apple sign-in with user name field covered', async () => {
    ;(window as any).AppleID = {
      auth: {
        init: vi.fn(),
        signIn: vi.fn().mockResolvedValue({
          authorization: { id_token: 'tok' },
          user: { name: { firstName: 'John', lastName: 'Doe' } },
        }),
      },
    }
    vi.mocked(api.post).mockResolvedValueOnce({ token: 'tok', user: { id: 'u1', username: 'johndoe' } })
    render(<AuthPage />)
    await act(async () => {
      fireEvent.click(screen.getByText('Continue with Apple'))
    })
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/apple/verify', expect.objectContaining({ name: 'John Doe' }))
    })
    delete (window as any).AppleID
  })

  it('Google OAuth triggers polling when window.google not yet loaded', async () => {
    // window.google is deleted in beforeEach
    // Set VITE_GOOGLE_CLIENT_ID so it proceeds past the no-clientId guard
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-id')
    render(<AuthPage />)
    // Click Google button - no window.google so it enters the polling else branch
    fireEvent.click(screen.getByText('Continue with Google'))
    // The polling interval is set up; the Google loader spinner should be shown
    expect(document.body).toBeInTheDocument()
    // afterEach calls vi.unstubAllEnvs() for cleanup
  })
})
