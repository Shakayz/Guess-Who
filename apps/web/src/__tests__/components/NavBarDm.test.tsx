import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
const mockLocation = { pathname: '/' }
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}))

const mockClearAuth = vi.fn()
vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, clearAuth: mockClearAuth }),
}))

const mockSetActiveDm = vi.fn()
vi.mock('../../store/social', () => ({
  useSocialStore: (selector: (s: unknown) => unknown) =>
    selector({ activeDm: { friendId: 'f1', friendUsername: 'alice' }, setActiveDm: mockSetActiveDm, unreadCounts: {} }),
}))

vi.mock('../../lib/api', () => ({
  api: { patch: vi.fn().mockResolvedValue({}) },
}))

vi.mock('../../components/DmChatPanel', () => ({
  DmChatPanel: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="dm-chat-panel">
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

import { NavBar } from '../../components/NavBar'

describe('NavBar with active DM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'location', {
      value: { replace: vi.fn() },
      writable: true,
      configurable: true,
    })
  })

  it('renders DmChatPanel when activeDm is set', () => {
    render(<NavBar />)
    expect(screen.getByTestId('dm-chat-panel')).toBeInTheDocument()
  })

  it('calls setActiveDm(null) when DmChatPanel onClose is triggered', () => {
    render(<NavBar />)
    fireEvent.click(screen.getByText('close'))
    expect(mockSetActiveDm).toHaveBeenCalledWith(null)
  })
})
