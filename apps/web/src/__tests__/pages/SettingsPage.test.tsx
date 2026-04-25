import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { apiPut, apiDelete, mockNavigate, mockChangeLanguage, mockClearAuth } = vi.hoisted(() => ({
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  mockNavigate: vi.fn(),
  mockChangeLanguage: vi.fn(),
  mockClearAuth: vi.fn(),
}))

vi.mock('../../lib/api', () => ({ api: { put: apiPut, delete: apiDelete } }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: mockChangeLanguage },
  }),
}))
vi.mock('../../components/NavBar', () => ({
  NavBar: () => <div data-testid="navbar" />,
}))
vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: null, token: null, clearAuth: mockClearAuth }),
}))

import SettingsPage from '../../pages/SettingsPage'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  apiPut.mockReset()
  apiDelete.mockReset()
  mockNavigate.mockReset()
  mockChangeLanguage.mockReset()
  mockClearAuth.mockReset()
  localStorage.clear()
  // Pretend Notification permission is not granted by default.
  ;(global as any).Notification = {
    permission: 'default',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  }
})

describe('SettingsPage', () => {
  it('renders the Settings title', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Settings/i)
  })

  it('renders all major sections', () => {
    renderPage()
    for (const title of [/Sound/, /Notifications/, /Language/, /Account/, /Legal/]) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0)
    }
  })

  it('sound toggle defaults to on and persists changes to localStorage', () => {
    renderPage()
    const [soundToggle] = screen.getAllByRole('switch')
    expect(soundToggle.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(soundToggle)
    expect(soundToggle.getAttribute('aria-checked')).toBe('false')
    expect(localStorage.getItem('sound_enabled')).toBe('false')
  })

  it('changing the language dropdown calls i18n.changeLanguage', () => {
    renderPage()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'fr' } })
    expect(mockChangeLanguage).toHaveBeenCalledWith('fr')
  })

  it('shows validation error when new passwords do not match', () => {
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('Current password'), {
      target: { value: 'oldpass123' },
    })
    fireEvent.change(screen.getByPlaceholderText('New password'), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), {
      target: { value: 'different' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }))
    expect(screen.getByText(/New passwords do not match/i)).toBeInTheDocument()
    expect(apiPut).not.toHaveBeenCalled()
  })

  it('rejects short passwords without hitting the API', () => {
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('Current password'), {
      target: { value: 'oldpass123' },
    })
    fireEvent.change(screen.getByPlaceholderText('New password'), {
      target: { value: 'short' },
    })
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), {
      target: { value: 'short' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }))
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(apiPut).not.toHaveBeenCalled()
  })

  it('submits valid password change and shows success', async () => {
    apiPut.mockResolvedValueOnce({})
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('Current password'), {
      target: { value: 'oldpass123' },
    })
    fireEvent.change(screen.getByPlaceholderText('New password'), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), {
      target: { value: 'newpass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }))
    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith('/users/me/password', {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
      })
    })
    expect(await screen.findByText(/Password changed successfully/)).toBeInTheDocument()
  })

  it('opens the delete confirmation modal and disables delete until "DELETE" typed', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Delete My Account/ }))
    const input = screen.getByPlaceholderText('Type DELETE to confirm')
    expect(input).toBeInTheDocument()
    const confirmBtn = screen.getByRole('button', { name: /^Delete Account$/ })
    expect(confirmBtn).toBeDisabled()
    fireEvent.change(input, { target: { value: 'DELETE' } })
    expect(confirmBtn).not.toBeDisabled()
  })

  it('cancels the delete flow', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Delete My Account/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }))
    expect(screen.queryByPlaceholderText('Type DELETE to confirm')).not.toBeInTheDocument()
  })

  it('confirming delete calls /users/me and clears auth', async () => {
    apiDelete.mockResolvedValueOnce({})
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Delete My Account/ }))
    fireEvent.change(screen.getByPlaceholderText('Type DELETE to confirm'), {
      target: { value: 'DELETE' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Delete Account$/ }))
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/users/me'))
    expect(mockClearAuth).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/auth', { replace: true })
  })

  it('renders footer legal links', () => {
    renderPage()
    const termsLink = screen.getByText(/Terms of Service/)
    const privacyLink = screen.getByText(/Privacy Policy/)
    expect(termsLink.closest('a')?.getAttribute('href')).toBe('/terms')
    expect(privacyLink.closest('a')?.getAttribute('href')).toBe('/privacy')
  })

  it('notification toggle requests permission when turned on', async () => {
    renderPage()
    // Switches in DOM order: sound, music, notifications. Notifications is 3rd.
    const switches = screen.getAllByRole('switch')
    const notifToggle = switches[2]
    fireEvent.click(notifToggle)
    await waitFor(() => {
      expect((global as any).Notification.requestPermission).toHaveBeenCalled()
    })
  })
})
