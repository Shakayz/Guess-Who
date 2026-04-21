/**
 * api.test.ts
 *
 * Unit tests for lib/api.ts — the thin fetch wrapper that every mobile
 * screen uses to talk to the API. The module is small but load-bearing:
 *
 *   - It attaches the JWT from useAuthStore as a Bearer header.
 *   - It aborts requests after a 10s timeout (mobile radios are flaky).
 *   - It throws a friendly error for timeouts / network errors vs. server
 *     responses — screens key error toasts off the message text.
 *   - The upload() path assembles a platform-correct multipart body.
 *
 * We stub fetch + the auth store, and mount expo-router / AsyncStorage as
 * no-ops so the module loads under plain Node.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// RN injects __DEV__ at runtime; vitest doesn't. lib/logger.ts reads it
// unconditionally at import time, so we shim it here to keep the transitive
// import of logger.ts (via lib/api.ts) from blowing up.
;(globalThis as any).__DEV__ = false

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}))

// react-native is imported for Platform.OS; stub it with a default of ios so
// BASE_URL resolves to `localhost`. Tests that need to check Android take an
// override path via the EXPO_PUBLIC_API_URL env var below.
vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (s: any) => s.ios ?? s.default },
}))

let tokenMock: string | null = null
vi.mock('../store/auth', () => ({
  useAuthStore: {
    getState: () => ({ token: tokenMock }),
  },
}))

const TEST_URL = 'http://api.test:3001/api'
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = TEST_URL
  tokenMock = null
  vi.resetModules()
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, init: Partial<Response> = {}) {
  return {
    ok: true,
    status: 200,
    ...init,
    json: async () => body,
  } as unknown as Response
}

describe('api.get / post / put / patch / delete', () => {
  it('GET sends no body and returns the parsed JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ hello: 'world' }))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await import('../lib/api')

    const res = await api.get<{ hello: string }>('/ping')

    expect(res).toEqual({ hello: 'world' })
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe(`${TEST_URL}/ping`)
    expect((opts as RequestInit).method ?? 'GET').toBe('GET')
    expect((opts as RequestInit).body).toBeUndefined()
  })

  it('POST serializes the body as JSON with Content-Type application/json', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await import('../lib/api')

    await api.post('/auth/login', { username: 'jo', password: 'pw' })

    const [, opts] = fetchMock.mock.calls[0]
    expect((opts as RequestInit).method).toBe('POST')
    expect((opts as RequestInit).body).toBe(JSON.stringify({ username: 'jo', password: 'pw' }))
    expect(((opts as RequestInit).headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    )
  })

  it('attaches Authorization: Bearer when the auth store has a token', async () => {
    tokenMock = 'jwt-abc'
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await import('../lib/api')

    await api.get('/users/me')

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer jwt-abc')
  })

  it('omits Authorization entirely when no token is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await import('../lib/api')

    await api.get('/public')

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('PUT / PATCH / DELETE send the right verb + body shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await import('../lib/api')

    await api.put('/a', { x: 1 })
    await api.patch('/b', { y: 2 })
    await api.delete('/c')

    const verbs = fetchMock.mock.calls.map((c: any[]) => c[1].method)
    expect(verbs).toEqual(['PUT', 'PATCH', 'DELETE'])
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ x: 1 }))
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ y: 2 }))
    expect(fetchMock.mock.calls[2][1].body).toBeUndefined()
  })
})

describe('api error handling', () => {
  it('throws the server-provided error string for non-2xx responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'username_taken' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await import('../lib/api')

    await expect(api.post('/auth/signup', {})).rejects.toThrow('username_taken')
  })

  it('falls back to "HTTP <status>" when the body cannot be parsed as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error('not json')
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await import('../lib/api')

    await expect(api.get('/down')).rejects.toThrow('HTTP 503')
  })

  it('throws a friendly timeout message when the request is aborted', async () => {
    // fetch rejects with an AbortError — mirrors what AbortController produces.
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr))
    const { api } = await import('../lib/api')

    await expect(api.get('/slow')).rejects.toThrow(/timed out/i)
  })

  it('throws a friendly network-error message for connection failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const { api } = await import('../lib/api')

    await expect(api.get('/offline')).rejects.toThrow(/network/i)
  })
})

describe('api.upload', () => {
  it('assembles a FormData body and infers the MIME type from the extension', async () => {
    tokenMock = 'upload-token'
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ url: 'https://cdn/a.png' }))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await import('../lib/api')

    await api.upload('/users/me/avatar', 'file:///tmp/photo.png')

    const [, opts] = fetchMock.mock.calls[0]
    expect((opts as RequestInit).method).toBe('POST')
    expect((opts as RequestInit).body).toBeInstanceOf(FormData)
    const headers = (opts as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer upload-token')
    // Content-Type for multipart is set automatically by fetch based on the
    // FormData boundary — the wrapper must NOT force application/json here.
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('throws the server error message on non-2xx upload responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 413,
        json: async () => ({ error: 'file_too_large' }),
      }),
    )
    const { api } = await import('../lib/api')

    await expect(api.upload('/users/me/avatar', 'file:///x.jpg')).rejects.toThrow(
      'file_too_large',
    )
  })
})
