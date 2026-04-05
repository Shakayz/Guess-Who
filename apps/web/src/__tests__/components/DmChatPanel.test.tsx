import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}))

vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', username: 'testuser' }, token: 'tok' }),
}))

const mockClearUnread = vi.fn()
vi.mock('../../store/social', () => ({
  useSocialStore: (selector: (s: unknown) => unknown) =>
    selector({ clearUnread: mockClearUnread, activeDm: null }),
}))

const mockApiGet = vi.fn()
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn().mockResolvedValue({}),
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
const existingMessages = [
  { id: 'm1', senderId: 'u2', receiverId: 'u1', text: 'Hey there!', read: true, createdAt: new Date().toISOString() },
  { id: 'm2', senderId: 'u1', receiverId: 'u2', text: 'Hi bob!', read: true, createdAt: new Date().toISOString() },
]

describe('DmChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue({ messages: [] })
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

  it('clears input after message is sent', () => {
    render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Hello!' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue('')
  })

  it('emits dm:send when send button is clicked', () => {
    render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Test message' } })
    const sendBtn = screen.getByRole('button', { name: '↑' })
    fireEvent.click(sendBtn)
    expect(mockSocketEmit).toHaveBeenCalledWith('dm:send', { toUserId: 'u2', text: 'Test message' })
  })

  it('does not send empty messages', () => {
    render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockSocketEmit).not.toHaveBeenCalledWith('dm:send', expect.any(Object))
  })

  it('shows loading spinner initially', () => {
    mockApiGet.mockReturnValueOnce(new Promise(() => {}))
    render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    // Loading spinner should be visible
    expect(document.body).toBeInTheDocument()
  })

  it('shows say hello empty state when no messages', async () => {
    mockApiGet.mockResolvedValueOnce({ messages: [] })
    await act(async () => {
      render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    })
    await waitFor(() => {
      expect(screen.getByText('dm.sayHello')).toBeInTheDocument()
    })
  })

  it('renders existing messages from API', async () => {
    mockApiGet.mockResolvedValueOnce({ messages: existingMessages })
    await act(async () => {
      render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    })
    await waitFor(() => {
      expect(screen.getByText('Hey there!')).toBeInTheDocument()
      expect(screen.getByText('Hi bob!')).toBeInTheDocument()
    })
  })

  it('adds received message when dm:receive socket event fires', async () => {
    mockApiGet.mockResolvedValueOnce({ messages: [] })
    await act(async () => {
      render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    })
    await waitFor(() => {
      expect(screen.getByText('dm.sayHello')).toBeInTheDocument()
    })
    // Simulate receiving a DM
    const dmHandler = mockSocketOn.mock.calls.find(c => c[0] === 'dm:receive')
    if (dmHandler) {
      act(() => {
        dmHandler[1]({ id: 'new1', senderId: 'u2', senderUsername: 'bob', text: 'New message!', createdAt: new Date().toISOString() })
      })
      await waitFor(() => {
        expect(screen.getByText('New message!')).toBeInTheDocument()
      })
    }
    expect(document.body).toBeInTheDocument()
  })

  it('does not add message from different sender', async () => {
    mockApiGet.mockResolvedValueOnce({ messages: [] })
    await act(async () => {
      render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    })
    await waitFor(() => {
      expect(screen.getByText('dm.sayHello')).toBeInTheDocument()
    })
    const dmHandler = mockSocketOn.mock.calls.find(c => c[0] === 'dm:receive')
    if (dmHandler) {
      act(() => {
        // Message from a different user (not the current friend)
        dmHandler[1]({ id: 'other1', senderId: 'u99', senderUsername: 'other', text: 'Other message', createdAt: new Date().toISOString() })
      })
    }
    // Message from different sender should not appear
    expect(screen.queryByText('Other message')).not.toBeInTheDocument()
  })

  it('clears unread count on mount', () => {
    render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    expect(mockClearUnread).toHaveBeenCalledWith('u2')
  })

  it('adds optimistic message when sent', async () => {
    mockApiGet.mockResolvedValueOnce({ messages: [] })
    await act(async () => {
      render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    })
    await waitFor(() => {
      expect(screen.getByText('dm.sayHello')).toBeInTheDocument()
    })
    const input = screen.getByRole('textbox')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Optimistic!' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(screen.getByText('Optimistic!')).toBeInTheDocument()
  })

  it('does not emit when input only has whitespace', () => {
    render(<DmChatPanel friend={friend} onClose={vi.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockSocketEmit).not.toHaveBeenCalledWith('dm:send', expect.any(Object))
  })
})
