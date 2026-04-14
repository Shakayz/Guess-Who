import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { apiPost, mockNavigate } = vi.hoisted(() => ({
  apiPost: vi.fn(),
  mockNavigate: vi.fn(),
}))

vi.mock('../../lib/api', () => ({ api: { post: apiPost } }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import ResetPasswordPage from '../../pages/ResetPasswordPage'

function renderPage(token = 'abc123') {
  return render(
    <MemoryRouter initialEntries={[`/reset-password?token=${token}`]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  )
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    apiPost.mockReset()
    mockNavigate.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('renders the reset password title and two password inputs', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/auth\.resetPassword/)
    expect(screen.getByPlaceholderText('auth.newPassword')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('auth.confirmPassword')).toBeInTheDocument()
  })

  it('disables submit when no token is in the URL', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )
    const submit = screen.getAllByRole('button').find((b) =>
      b.textContent?.includes('auth.resetPassword'),
    )!
    expect(submit).toBeDisabled()
  })

  it('shows a mismatch error when passwords differ', async () => {
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('auth.newPassword'), {
      target: { value: 'password1' },
    })
    fireEvent.change(screen.getByPlaceholderText('auth.confirmPassword'), {
      target: { value: 'password2' },
    })
    fireEvent.click(screen.getAllByRole('button').find((b) =>
      b.textContent?.includes('auth.resetPassword'),
    )!)
    expect(await screen.findByText(/Passwords do not match/i)).toBeInTheDocument()
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('posts the new password on matching submit', async () => {
    apiPost.mockResolvedValueOnce({})
    renderPage('tok-xyz')
    fireEvent.change(screen.getByPlaceholderText('auth.newPassword'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.change(screen.getByPlaceholderText('auth.confirmPassword'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.click(screen.getAllByRole('button').find((b) =>
      b.textContent?.includes('auth.resetPassword'),
    )!)
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'tok-xyz',
        password: 'newpassword123',
      })
    })
    expect(await screen.findByText('auth.passwordReset')).toBeInTheDocument()
  })

  it('navigates to /auth 3s after a successful reset', async () => {
    vi.useFakeTimers()
    apiPost.mockResolvedValueOnce({})
    renderPage('token')
    fireEvent.change(screen.getByPlaceholderText('auth.newPassword'), {
      target: { value: 'newpassword1' },
    })
    fireEvent.change(screen.getByPlaceholderText('auth.confirmPassword'), {
      target: { value: 'newpassword1' },
    })
    fireEvent.click(screen.getAllByRole('button').find((b) =>
      b.textContent?.includes('auth.resetPassword'),
    )!)
    // Drain microtasks so the submit handler's await resolves.
    await vi.runAllTimersAsync()
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(mockNavigate).toHaveBeenCalledWith('/auth')
  })

  it('surfaces the API error on failure', async () => {
    apiPost.mockRejectedValueOnce(new Error('invalid token'))
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('auth.newPassword'), {
      target: { value: 'newpassword1' },
    })
    fireEvent.change(screen.getByPlaceholderText('auth.confirmPassword'), {
      target: { value: 'newpassword1' },
    })
    fireEvent.click(screen.getAllByRole('button').find((b) =>
      b.textContent?.includes('auth.resetPassword'),
    )!)
    expect(await screen.findByText(/invalid token/)).toBeInTheDocument()
  })
})
