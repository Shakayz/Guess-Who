import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---- Mock socket.io-client ----
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockRemoveAllListeners = vi.fn()

const mockSocketInstance = {
  connected: false,
  auth: {} as Record<string, unknown>,
  connect: mockConnect,
  disconnect: mockDisconnect,
  removeAllListeners: mockRemoveAllListeners,
  on: vi.fn(),
}

const mockIo = vi.fn(() => mockSocketInstance)

vi.mock('socket.io-client', () => ({
  io: mockIo,
}))

// ---- Mock auth store ----
vi.mock('../store/auth', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({ token: 'mock-token' })),
  },
}))

// ---- Mock shared: fall through to the real exports so any runtime constant
// socket.ts or its transitive imports need (TUTORIAL_COMPLETION_REWARD,
// MATCHMAKING_CONFIG, …) keeps working. Types are stripped at build time.
vi.mock('@red-handed/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
}))

describe('socket', () => {
  beforeEach(() => {
    // Reset mocks and clear the module cache so the singleton `socket` is null
    vi.resetModules()
    mockIo.mockClear()
    mockConnect.mockClear()
    mockDisconnect.mockClear()
    mockRemoveAllListeners.mockClear()
    mockSocketInstance.connected = false
    mockSocketInstance.auth = {}
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('getSocket creates a socket.io instance on first call', async () => {
    const { getSocket } = await import('../lib/socket')
    const socket = getSocket()
    expect(mockIo).toHaveBeenCalledTimes(1)
    expect(socket).toBe(mockSocketInstance)
  })

  it('getSocket returns the same instance on subsequent calls (singleton)', async () => {
    const { getSocket } = await import('../lib/socket')
    const s1 = getSocket()
    const s2 = getSocket()
    expect(mockIo).toHaveBeenCalledTimes(1)
    expect(s1).toBe(s2)
  })

  it('connectSocket calls connect() when socket is not connected', async () => {
    const { connectSocket } = await import('../lib/socket')
    mockSocketInstance.connected = false
    connectSocket()
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  it('connectSocket updates socket auth with the current token', async () => {
    const { connectSocket } = await import('../lib/socket')
    connectSocket()
    expect(mockSocketInstance.auth).toEqual({ token: 'mock-token' })
  })

  it('disconnectSocket removes listeners, disconnects, and nulls the singleton', async () => {
    const { getSocket, disconnectSocket } = await import('../lib/socket')
    // Initialise the singleton
    getSocket()
    disconnectSocket()
    expect(mockRemoveAllListeners).toHaveBeenCalledTimes(1)
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
    // After disconnect a fresh getSocket() should create a new instance
    mockIo.mockClear()
    getSocket()
    expect(mockIo).toHaveBeenCalledTimes(1)
  })

  it('updateSocketAuth does nothing when socket is null (not yet initialised)', async () => {
    // Do NOT call getSocket() — singleton is null
    const { updateSocketAuth } = await import('../lib/socket')
    // Should not throw
    expect(() => updateSocketAuth()).not.toThrow()
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('updateSocketAuth updates auth token on existing socket', async () => {
    const { getSocket, updateSocketAuth } = await import('../lib/socket')
    // Initialise the socket first
    getSocket()
    mockSocketInstance.connected = true
    updateSocketAuth()
    expect(mockSocketInstance.auth).toEqual({ token: 'mock-token' })
  })

  it('updateSocketAuth reconnects socket when disconnected', async () => {
    const { getSocket, updateSocketAuth } = await import('../lib/socket')
    getSocket()
    mockSocketInstance.connected = false
    updateSocketAuth()
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  it('connectSocket does not call connect() when already connected', async () => {
    const { connectSocket } = await import('../lib/socket')
    mockSocketInstance.connected = true
    connectSocket()
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('disconnectSocket is safe to call when socket is already null', async () => {
    const { disconnectSocket } = await import('../lib/socket')
    // Socket was never initialised — should not throw
    expect(() => disconnectSocket()).not.toThrow()
  })
})
