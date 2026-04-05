import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerChatHandlers } from '@/socket/handlers/chat'

// Minimal socket/io fakes ---------------------------------------------------

function makeSocket(rooms: string[], username?: string) {
  const listeners: Record<string, Function> = {}
  const socket = {
    rooms: new Set(rooms),
    id: 'socket-test-id',
    username,
    on: vi.fn((event: string, cb: Function) => { listeners[event] = cb }),
    _emit: (event: string, ...args: unknown[]) => listeners[event]?.(...args),
  }
  return socket as typeof socket & { username?: string }
}

function makeIo() {
  const emitted: Array<{ room: string; event: string; payload: unknown }> = []
  return {
    to: vi.fn((room: string) => ({
      emit: vi.fn((event: string, payload: unknown) => {
        emitted.push({ room, event, payload })
      }),
    })),
    _emitted: emitted,
  }
}

// ---------------------------------------------------------------------------

describe('registerChatHandlers', () => {
  let io: ReturnType<typeof makeIo>

  beforeEach(() => {
    io = makeIo()
  })

  it('emits chat:message to the correct room when text is valid', () => {
    const socket = makeSocket(['socket-test-id', 'room:lobby-42'], 'Alice')
    registerChatHandlers(io as any, socket as any)

    socket._emit('chat:send', 'Hello world')

    expect(io.to).toHaveBeenCalledWith('room:lobby-42')
    const msg = io._emitted[0]
    expect(msg.event).toBe('chat:message')
    expect((msg.payload as any).text).toBe('Hello world')
    expect((msg.payload as any).senderName).toBe('Alice')
  })

  it('strips HTML tags and entities from the message text (XSS sanitization)', () => {
    const socket = makeSocket(['socket-test-id', 'room:game-1'])
    registerChatHandlers(io as any, socket as any)

    socket._emit('chat:send', '<script>alert("xss")</script>Hello&amp;')

    expect(io._emitted.length).toBe(1)
    const msg = io._emitted[0].payload as any
    expect(msg.text).not.toContain('<script>')
    expect(msg.text).not.toContain('&amp;')
    expect(msg.text).toContain('Hello')
  })

  it('does not emit when the socket is not in a room', () => {
    const socket = makeSocket(['socket-test-id']) // no room: prefix
    registerChatHandlers(io as any, socket as any)

    socket._emit('chat:send', 'Hello')

    expect(io._emitted.length).toBe(0)
  })

  it('does not emit when text is empty after sanitization', () => {
    const socket = makeSocket(['socket-test-id', 'room:game-1'])
    registerChatHandlers(io as any, socket as any)

    // Only HTML tags — after stripping, nothing remains
    socket._emit('chat:send', '<b></b>   ')

    expect(io._emitted.length).toBe(0)
  })

  it('truncates messages longer than 200 characters', () => {
    const socket = makeSocket(['socket-test-id', 'room:game-1'], 'Bob')
    registerChatHandlers(io as any, socket as any)

    const longText = 'A'.repeat(300)
    socket._emit('chat:send', longText)

    const msg = io._emitted[0].payload as any
    expect(msg.text.length).toBe(200)
  })
})
