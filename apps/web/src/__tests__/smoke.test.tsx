import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from '../store/auth'

// ---- Auth store tests (no mocking needed — zustand works in jsdom) ----

describe('auth store', () => {
  beforeEach(() => {
    // Reset the store between tests
    useAuthStore.setState({ token: null, user: null })
  })

  it('starts with null token', () => {
    const { token } = useAuthStore.getState()
    expect(token).toBeNull()
  })

  it('setAuth sets token and user', () => {
    const user = { id: '1', username: 'alice' }
    useAuthStore.getState().setAuth('my-token', user)

    const state = useAuthStore.getState()
    expect(state.token).toBe('my-token')
    expect(state.user).toEqual(user)
  })

  it('clearAuth clears token and user', () => {
    const user = { id: '1', username: 'alice' }
    useAuthStore.getState().setAuth('my-token', user)
    useAuthStore.getState().clearAuth()

    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
  })
})

// ---- ProtectedRoute smoke test ----

// Minimal ProtectedRoute replica (mirrors the one in App.tsx)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/auth" replace />
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it('redirects unauthenticated user to /auth', () => {
    function AuthPage() {
      return <div>Auth Page</div>
    }

    function HomePage() {
      return <div>Home Page</div>
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Auth Page')).toBeInTheDocument()
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    useAuthStore.setState({ token: 'valid-token', user: { id: '1', username: 'alice' } })

    function HomePage() {
      return <div>Home Page</div>
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/auth" element={<div>Auth Page</div>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Home Page')).toBeInTheDocument()
    expect(screen.queryByText('Auth Page')).not.toBeInTheDocument()
  })
})
