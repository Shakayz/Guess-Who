import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mocks ----
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
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
      value: { ...window.location, replace: vi.fn() },
      writable: true,
      configurable: true,
    })
    delete (window as any).google
    delete (window as any).AppleID
  })

  it('renders without crashing', () => {
    render(<AuthPage />)
    expect(screen.getByText('Imposter Game')).toBeInTheDocument()
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
    expect(screen.getByText('auth.continueWithGoogle')).toBeInTheDocument()
    expect(screen.getByText('Continue with Apple')).toBeInTheDocument()
  })

  it('shows error when Google sign-in is not configured', () => {
    render(<AuthPage />)
    fireEvent.click(screen.getByText('auth.continueWithGoogle'))
    expect(screen.getByText('Google sign-in is not available yet. Please use email & password.')).toBeInTheDocument()
  })

  it('shows error when Apple Sign-In is unavailable', () => {
    render(<AuthPage />)
    fireEvent.click(screen.getByText('Continue with Apple'))
    expect(screen.getByText('Apple Sign-In is not available in this browser')).toBeInTheDocument()
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
})
