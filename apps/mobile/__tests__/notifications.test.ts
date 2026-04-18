/**
 * notifications.test.ts
 *
 * lib/notifications.ts owns the full push-registration flow: permission
 * request → channel setup on Android → Expo token fetch → server upload.
 *
 * What we test here:
 *   - Non-physical devices (simulators) short-circuit to null with no
 *     permission prompt (otherwise the simulator throws).
 *   - Permission denial returns null and never calls the token API.
 *   - Android creates a MAX-importance channel so game invites actually pop.
 *   - When a JWT is available the Expo token is POSTed to the backend; when
 *     no JWT, the backend call is skipped (we still return the token so the
 *     caller can retry later).
 *   - unregisterPushNotifications hits DELETE with the auth header.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

;(globalThis as any).__DEV__ = false

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}))

const platformOsRef: { os: 'ios' | 'android' } = { os: 'ios' }
vi.mock('react-native', () => ({
  Platform: {
    get OS() { return platformOsRef.os },
    select: (s: any) => s[platformOsRef.os] ?? s.default,
  },
}))

const deviceRef: { isDevice: boolean } = { isDevice: true }
vi.mock('expo-device', () => ({
  get isDevice() { return deviceRef.isDevice },
}))

const permissionsRef: { existing: string; afterRequest: string } = {
  existing: 'granted',
  afterRequest: 'granted',
}
const getPermissionsAsyncMock = vi.fn()
const requestPermissionsAsyncMock = vi.fn()
const setChannelMock = vi.fn()
const getPushTokenMock = vi.fn()
const setNotificationHandlerMock = vi.fn()

vi.mock('expo-notifications', () => ({
  AndroidImportance: { MAX: 5 },
  setNotificationHandler: (h: unknown) => setNotificationHandlerMock(h),
  getPermissionsAsync: (...a: unknown[]) => getPermissionsAsyncMock(...a),
  requestPermissionsAsync: (...a: unknown[]) => requestPermissionsAsyncMock(...a),
  setNotificationChannelAsync: (...a: unknown[]) => setChannelMock(...a),
  getExpoPushTokenAsync: (...a: unknown[]) => getPushTokenMock(...a),
}))

let tokenMock: string | null = null
vi.mock('../store/auth', () => ({
  useAuthStore: { getState: () => ({ token: tokenMock }) },
}))

beforeEach(() => {
  platformOsRef.os = 'ios'
  deviceRef.isDevice = true
  tokenMock = null
  vi.resetModules()
  vi.unstubAllGlobals()
  getPermissionsAsyncMock.mockReset()
  requestPermissionsAsyncMock.mockReset()
  setChannelMock.mockReset()
  getPushTokenMock.mockReset()
  setNotificationHandlerMock.mockReset()

  getPermissionsAsyncMock.mockImplementation(async () => ({ status: permissionsRef.existing }))
  requestPermissionsAsyncMock.mockImplementation(async () => ({ status: permissionsRef.afterRequest }))
  setChannelMock.mockResolvedValue(undefined)
  getPushTokenMock.mockResolvedValue({ data: 'ExponentPushToken[abcdef]' })

  permissionsRef.existing = 'granted'
  permissionsRef.afterRequest = 'granted'
})

describe('registerForPushNotifications — simulator / permission paths', () => {
  it('returns null on non-physical devices (simulator) without asking for permission', async () => {
    deviceRef.isDevice = false
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { registerForPushNotifications } = await import('../lib/notifications')
    const result = await registerForPushNotifications()

    expect(result).toBeNull()
    expect(getPermissionsAsyncMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null when the user denies permission', async () => {
    permissionsRef.existing = 'undetermined'
    permissionsRef.afterRequest = 'denied'

    const { registerForPushNotifications } = await import('../lib/notifications')
    const result = await registerForPushNotifications()

    expect(result).toBeNull()
    expect(requestPermissionsAsyncMock).toHaveBeenCalled()
    expect(getPushTokenMock).not.toHaveBeenCalled()
  })

  it('skips the permission request when status is already granted', async () => {
    const { registerForPushNotifications } = await import('../lib/notifications')
    await registerForPushNotifications()
    expect(getPermissionsAsyncMock).toHaveBeenCalled()
    expect(requestPermissionsAsyncMock).not.toHaveBeenCalled()
  })
})

describe('registerForPushNotifications — Android channel setup', () => {
  it('creates the MAX-importance default channel on Android', async () => {
    platformOsRef.os = 'android'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))

    const { registerForPushNotifications } = await import('../lib/notifications')
    await registerForPushNotifications()

    expect(setChannelMock).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({
        name: 'default',
        importance: 5, // AndroidImportance.MAX
      }),
    )
  })

  it('does NOT create a channel on iOS', async () => {
    const { registerForPushNotifications } = await import('../lib/notifications')
    await registerForPushNotifications()
    expect(setChannelMock).not.toHaveBeenCalled()
  })
})

describe('registerForPushNotifications — backend registration', () => {
  it('POSTs the Expo token to /users/me/push-token when authenticated', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test/api'
    tokenMock = 'jwt-token'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    const { registerForPushNotifications } = await import('../lib/notifications')
    const tokenReturned = await registerForPushNotifications()

    expect(tokenReturned).toBe('ExponentPushToken[abcdef]')
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/api/users/me/push-token')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer jwt-token')
    expect(JSON.parse(opts.body)).toEqual({ token: 'ExponentPushToken[abcdef]' })
  })

  it('still returns the token even if there is no JWT — caller retries later', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { registerForPushNotifications } = await import('../lib/notifications')
    const tokenReturned = await registerForPushNotifications()

    expect(tokenReturned).toBe('ExponentPushToken[abcdef]')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still returns the token when backend registration fails (best-effort)', async () => {
    tokenMock = 'jwt-token'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const { registerForPushNotifications } = await import('../lib/notifications')
    const tokenReturned = await registerForPushNotifications()

    expect(tokenReturned).toBe('ExponentPushToken[abcdef]')
  })
})

describe('unregisterPushNotifications', () => {
  it('is a no-op without a JWT (nothing to unregister against)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { unregisterPushNotifications } = await import('../lib/notifications')
    await unregisterPushNotifications()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('hits DELETE /users/me/push-token with the Bearer header when authenticated', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test/api'
    tokenMock = 'jwt-token'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const { unregisterPushNotifications } = await import('../lib/notifications')
    await unregisterPushNotifications()

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/api/users/me/push-token')
    expect(opts.method).toBe('DELETE')
    expect(opts.headers.Authorization).toBe('Bearer jwt-token')
  })

  it('swallows network errors — logout must not fail because push-token removal failed', async () => {
    tokenMock = 'jwt-token'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const { unregisterPushNotifications } = await import('../lib/notifications')
    await expect(unregisterPushNotifications()).resolves.toBeUndefined()
  })
})
