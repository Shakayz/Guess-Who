import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}))

vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, token: 'tok' }),
}))

vi.mock('../../store/social', () => ({
  useSocialStore: (selector: (s: unknown) => unknown) =>
    selector({ clearUnread: vi.fn(), activeDm: null }),
}))

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ messages: [] }),
    post: vi.fn().mockResolvedValue({
      id: 'msg1', senderId: 'u1', receiverId: 'u2', text: 'hi', read: true, createdAt: new Date().toISOString()
    }),
  },
}))

const mockSocketOn = vi.fn()
const mockSocketOff = vi.fn()
const mockSocketEmit = vi.fn()
vi.mock('../../lib/socket', () => ({
  getSocket: () => ({ on: mockSocketOn, off: mockSocketOff, emit: mockSocketEmit, connected: true }),
}))

import { DmChatPanel } from '../../components/DmChatPanel'

const friend = { id: 'u2', username: 'bob' }

describe('DmChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    expect(document.body).toBeInTheDocument()
  })

  it('shows the friend username in header', () => {
    render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    expect(screen.getByText('bob')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<DmChatPanel friend={friend} onClose={onClose} />)
    // The close button contains ✕
    const buttons = screen.getAllByRole('button')
    const closeBtn = buttons.find(btn => btn.textContent?.trim() === '✕')
    expect(closeBtn).toBeDefined()
    fireEvent.click(closeBtn!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows message input field', () => {
    render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
  })

  it('registers socket event listener on mount', () => {
    render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    expect(mockSocketOn).toHaveBeenCalledWith('dm:receive', expect.any(Function))
  })

  it('cleans up socket listener on unmount', () => {
    const { unmount } = render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    unmount()
    expect(mockSocketOff).toHaveBeenCalledWith('dm:receive', expect.any(Function))
  })

  it('can type in the message input', () => {
    render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Hello!' } })
    expect(input).toHaveValue('Hello!')
  })

  it('emits dm:send socket event when Enter is pressed', async () => {
    render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Hello!' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockSocketEmit).toHaveBeenCalledWith('dm:send', { toUserId: 'u2', text: 'Hello!' })
  })
})
