import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
    // Submit the form directly rather than clicking by name (multiple buttons share the same name)
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
})
