import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { apiPost } = vi.hoisted(() => ({ apiPost: vi.fn() }))
vi.mock('../../lib/api', () => ({ api: { post: apiPost } }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import ForgotPasswordPage from '../../pages/ForgotPasswordPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  )
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => apiPost.mockReset())

  it('renders the title and email input', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/auth\.forgotPassword/)
    expect(screen.getByPlaceholderText('auth.email')).toBeInTheDocument()
  })

  it('submits the form and shows the sent card on success', async () => {
    apiPost.mockResolvedValueOnce({})
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('auth.email'), {
      target: { value: 'user@test.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /auth\.sendResetLink/ }))
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/auth/forgot-password', { email: 'user@test.com' })
    })
    expect(await screen.findByText('auth.resetLinkSent')).toBeInTheDocument()
  })

  it('renders the API error message on failure', async () => {
    apiPost.mockRejectedValueOnce(new Error('email not found'))
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('auth.email'), {
      target: { value: 'missing@test.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /auth\.sendResetLink/ }))
    expect(await screen.findByText(/email not found/)).toBeInTheDocument()
  })

  it('disables the submit button while loading', async () => {
    let resolve!: () => void
    apiPost.mockReturnValueOnce(
      new Promise<void>((r) => {
        resolve = r
      }),
    )
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('auth.email'), {
      target: { value: 'user@test.com' },
    })
    const button = screen.getByRole('button', { name: /auth\.sendResetLink/ })
    fireEvent.click(button)
    await waitFor(() => expect(button).toBeDisabled())
    resolve()
  })

  it('renders the back-to-login link', () => {
    renderPage()
    const link = screen.getByText('auth.backToLogin')
    expect(link.closest('a')?.getAttribute('href')).toBe('/auth')
  })
})
