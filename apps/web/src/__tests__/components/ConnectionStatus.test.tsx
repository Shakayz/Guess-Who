import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

type Handler = (...args: unknown[]) => void
interface FakeSocket {
  connected: boolean
  listeners: Map<string, Handler[]>
  on: (ev: string, fn: Handler) => void
  off: (ev: string, fn: Handler) => void
  emit: (ev: string, ...args: unknown[]) => void
}

function makeSocket(connected = true): FakeSocket {
  const listeners = new Map<string, Handler[]>()
  return {
    connected,
    listeners,
    on(ev, fn) {
      const arr = listeners.get(ev) ?? []
      arr.push(fn)
      listeners.set(ev, arr)
    },
    off(ev, fn) {
      listeners.set(ev, (listeners.get(ev) ?? []).filter((h) => h !== fn))
    },
    emit(ev, ...args) {
      for (const fn of listeners.get(ev) ?? []) fn(...args)
    },
  }
}

let socket: FakeSocket

vi.mock('../../lib/socket', () => ({
  getSocket: () => socket,
}))

beforeEach(() => {
  socket = makeSocket(true)
  vi.useRealTimers()
})

describe('ConnectionStatus', () => {
  it('renders nothing while the socket is connected', async () => {
    const { ConnectionStatus } = await import('../../components/ConnectionStatus')
    const { container } = render(<ConnectionStatus />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the disconnected banner immediately when socket starts offline', async () => {
    socket.connected = false
    const { ConnectionStatus } = await import('../../components/ConnectionStatus')
    render(<ConnectionStatus />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Connection lost/i)).toBeInTheDocument()
  })

  it('shows the disconnected banner after a disconnect event', async () => {
    const { ConnectionStatus } = await import('../../components/ConnectionStatus')
    render(<ConnectionStatus />)
    act(() => socket.emit('disconnect'))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Connection lost/i)).toBeInTheDocument()
  })

  it('shows "Reconnected" then hides after 2s when connect fires', async () => {
    vi.useFakeTimers()
    socket.connected = false
    const { ConnectionStatus } = await import('../../components/ConnectionStatus')
    render(<ConnectionStatus />)
    act(() => socket.emit('connect'))
    expect(screen.getByText(/Reconnected/i)).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('unsubscribes from socket events on unmount', async () => {
    const { ConnectionStatus } = await import('../../components/ConnectionStatus')
    const { unmount } = render(<ConnectionStatus />)
    expect(socket.listeners.get('connect')?.length).toBe(1)
    expect(socket.listeners.get('disconnect')?.length).toBe(1)
    unmount()
    expect(socket.listeners.get('connect')?.length ?? 0).toBe(0)
    expect(socket.listeners.get('disconnect')?.length ?? 0).toBe(0)
  })
})
