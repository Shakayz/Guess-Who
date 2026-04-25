/**
 * socket.test.ts
 *
 * Unit tests for lib/socket.ts — the singleton wrapper around socket.io-client
 * that every realtime screen uses.
 *
 * Contract:
 *   - connectSocket() is a no-op if already connected (no duplicate handshakes).
 *   - Without a JWT, connectSocket() refuses to even create a socket.
 *   - The socket is opened with websocket transport, exponential backoff, and
 *     infinite reconnection attempts (mobile network may flap for minutes).
 *   - disconnectSocket() calls .disconnect() and drops the singleton so the
 *     next connectSocket() actually reconnects.
 *   - getSocket() lazily opens the connection if one doesn't exist.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

;(globalThis as any).__DEV__ = false

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (s: any) => s.ios ?? s.default },
}))

let tokenMock: string | null = null
vi.mock('../store/auth', () => ({
  useAuthStore: {
    getState: () => ({ token: tokenMock }),
  },
}))

// socket.io-client is the module under stub. We expose a fresh FakeSocket
// instance per `io()` call so tests can drive events + assert on emit calls.
//
// vitest's `Mock` defaults are stricter now — typing fields as the bare
// `ReturnType<typeof vi.fn>` collapses to a function signature that fails to
// accept the typed (event, cb) handlers we install below. Use the loose
// `Mock<any[], any>` form so the assignment compiles.
type AnyMock = Mock<any[], any>
interface FakeIOManager {
  on: AnyMock
}
interface FakeSocket {
  id: string
  connected: boolean
  io: FakeIOManager
  _events: Map<string, Function[]>
  on: AnyMock
  emit: AnyMock
  disconnect: AnyMock
  _fire: (event: string, ...args: unknown[]) => void
}

let socketInstances: FakeSocket[] = []
let lastIoArgs: unknown[] | null = null

function makeFakeSocket(): FakeSocket {
  const events = new Map<string, Function[]>()
  const on = vi.fn((event: string, cb: Function) => {
    const arr = events.get(event) ?? []
    arr.push(cb)
    events.set(event, arr)
  })
  const mgrEvents = new Map<string, Function[]>()
  const mgrOn = vi.fn((event: string, cb: Function) => {
    const arr = mgrEvents.get(event) ?? []
    arr.push(cb)
    mgrEvents.set(event, arr)
  })
  return {
    id: 'sock-1',
    connected: false,
    io: { on: mgrOn },
    _events: events,
    on,
    emit: vi.fn(),
    disconnect: vi.fn(function (this: FakeSocket) {
      this.connected = false
    }),
    _fire: (event: string, ...args: unknown[]) => {
      for (const cb of events.get(event) ?? []) cb(...args)
    },
  }
}

vi.mock('socket.io-client', () => ({
  io: vi.fn((...args: unknown[]) => {
    lastIoArgs = args
    const s = makeFakeSocket()
    socketInstances.push(s)
    return s as any
  }),
}))

beforeEach(() => {
  tokenMock = null
  socketInstances = []
  lastIoArgs = null
  vi.resetModules()
  delete process.env.EXPO_PUBLIC_SOCKET_URL
})

describe('connectSocket', () => {
  it('returns a no-token sentinel without calling io() when no JWT is present', async () => {
    const { connectSocket } = await import('../lib/socket')
    const result = connectSocket()
    // The implementation returns `null as unknown as AppSocket` in this case —
    // callers that see a falsy return must skip realtime. What matters is
    // that no underlying socket got created.
    expect(socketInstances).toHaveLength(0)
    expect(result).toBeFalsy()
  })

  it('opens a websocket connection with the expected options when a JWT is present', async () => {
    tokenMock = 'jwt-token'
    process.env.EXPO_PUBLIC_SOCKET_URL = 'http://api.example:3001'

    const { connectSocket } = await import('../lib/socket')
    const s = connectSocket()

    expect(socketInstances).toHaveLength(1)
    expect(s).toBe(socketInstances[0])
    const [url, opts] = lastIoArgs as [string, Record<string, unknown>]
    expect(url).toBe('http://api.example:3001')
    expect(opts).toMatchObject({
      auth: { token: 'jwt-token' },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    })
  })

  it('is idempotent when the existing socket is connected (no duplicate io() call)', async () => {
    tokenMock = 'jwt'
    const { connectSocket } = await import('../lib/socket')
    const first = connectSocket()
    // Simulate the server handshake completing.
    ;(first as any).connected = true

    const second = connectSocket()
    expect(second).toBe(first)
    expect(socketInstances).toHaveLength(1)
  })

  it('registers listeners for connect / disconnect / connect_error on the socket', async () => {
    tokenMock = 'jwt'
    const { connectSocket } = await import('../lib/socket')
    connectSocket()

    const sock = socketInstances[0]
    const registered = new Set((sock.on as any).mock.calls.map((c: any[]) => c[0]))
    expect(registered.has('connect')).toBe(true)
    expect(registered.has('disconnect')).toBe(true)
    expect(registered.has('connect_error')).toBe(true)
  })

  it('registers reconnect listeners on the io Manager (not the socket)', async () => {
    tokenMock = 'jwt'
    const { connectSocket } = await import('../lib/socket')
    connectSocket()

    const sock = socketInstances[0]
    const mgrEvents = new Set((sock.io.on as any).mock.calls.map((c: any[]) => c[0]))
    // Manager-level events fire through socket.io itself
    expect(mgrEvents.has('reconnect_attempt')).toBe(true)
    expect(mgrEvents.has('reconnect')).toBe(true)
    expect(mgrEvents.has('reconnect_failed')).toBe(true)
  })

  it('tolerates repeated connect_error events — listeners do not throw', async () => {
    tokenMock = 'jwt'
    const { connectSocket } = await import('../lib/socket')
    connectSocket()

    const sock = socketInstances[0]
    expect(() => {
      sock._fire('connect_error', new Error('network down'))
      sock._fire('connect_error', new Error('still down'))
      sock._fire('connect_error', new Error('still down'))
    }).not.toThrow()
  })
})

describe('getSocket', () => {
  it('lazily opens the connection on first access', async () => {
    tokenMock = 'jwt'
    const { getSocket } = await import('../lib/socket')

    const s = getSocket()
    expect(socketInstances).toHaveLength(1)
    expect(s).toBe(socketInstances[0])
  })

  it('returns the existing socket instance across repeated calls', async () => {
    tokenMock = 'jwt'
    const { getSocket } = await import('../lib/socket')
    const first = getSocket()
    const second = getSocket()
    expect(first).toBe(second)
  })
})

describe('disconnectSocket', () => {
  it('calls .disconnect() on the underlying socket and resets the singleton', async () => {
    tokenMock = 'jwt'
    const { connectSocket, disconnectSocket, getSocket } = await import('../lib/socket')
    const first = connectSocket()
    ;(first as any).connected = true

    disconnectSocket()

    expect((first as any).disconnect).toHaveBeenCalledOnce()
    // After disconnect, the next getSocket() must create a FRESH socket
    // (the old one is gone, not reused).
    getSocket()
    expect(socketInstances).toHaveLength(2)
  })

  it('is a no-op when no socket was ever created', async () => {
    const { disconnectSocket } = await import('../lib/socket')
    expect(() => disconnectSocket()).not.toThrow()
  })
})
