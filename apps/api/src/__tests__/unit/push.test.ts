/**
 * push.test.ts
 *
 * Tests for src/services/push.ts — the Expo Push thin client. We stub
 * global fetch and assert the outgoing request body + error handling.
 *
 * Contract under test:
 *   - Invalid / missing Expo tokens are dropped silently (no fetch).
 *   - sendPushNotification POSTs a single well-formed message.
 *   - sendPushNotifications chunks into batches of 100 (Expo's limit).
 *   - Expo `status: 'error'` tickets are logged but never throw (push is
 *     best-effort — an outage must not take the API down).
 *   - Network failures are swallowed for the same reason.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendPushNotification, sendPushNotifications } from '../../services/push'

const EXPO_URL = 'https://exp.host/--/api/v2/push/send'

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sendPushNotification', () => {
  it('drops invalid tokens without touching the network', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await sendPushNotification('', 'hi', 'msg')
    await sendPushNotification('not-a-valid-expo-token', 'hi', 'msg')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs a well-formed message to the Expo push endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ data: { status: 'ok' } }))
    vi.stubGlobal('fetch', fetchMock)

    await sendPushNotification(
      'ExponentPushToken[abc]',
      'Game ready',
      'It is your turn',
      { roomCode: 'ABCDEF' },
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe(EXPO_URL)
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(opts.body)
    expect(body).toEqual({
      to: 'ExponentPushToken[abc]',
      sound: 'default',
      title: 'Game ready',
      body: 'It is your turn',
      data: { roomCode: 'ABCDEF' },
    })
  })

  it('sends an empty data object when none is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ data: { status: 'ok' } }))
    vi.stubGlobal('fetch', fetchMock)

    await sendPushNotification('ExponentPushToken[x]', 't', 'b')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.data).toEqual({})
  })

  it('does not throw when Expo returns a ticket-level error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse({ data: { status: 'error', message: 'DeviceNotRegistered' } }),
      ),
    )

    await expect(
      sendPushNotification('ExponentPushToken[x]', 't', 'b'),
    ).resolves.toBeUndefined()
  })

  it('swallows network errors — push is best-effort', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network boom')))

    await expect(
      sendPushNotification('ExponentPushToken[x]', 't', 'b'),
    ).resolves.toBeUndefined()
  })
})

describe('sendPushNotifications', () => {
  it('no-ops with an empty array (no fetch)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await sendPushNotifications([])

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('filters out invalid tokens before batching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ data: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await sendPushNotifications([
      { pushToken: 'ExponentPushToken[ok]', title: 'a', body: 'b' },
      { pushToken: 'invalid', title: 'x', body: 'y' },
      { pushToken: '', title: 'z', body: 'z' },
    ])

    expect(fetchMock).toHaveBeenCalledOnce()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toHaveLength(1)
    expect(body[0].to).toBe('ExponentPushToken[ok]')
  })

  it('no-ops when every token is invalid (no fetch at all)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await sendPushNotifications([
      { pushToken: '', title: 'a', body: 'b' },
      { pushToken: 'nope', title: 'c', body: 'd' },
    ])

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('chunks large batches into requests of at most 100 notifications', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ data: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const notifications = Array.from({ length: 250 }, (_, i) => ({
      pushToken: `ExponentPushToken[${i}]`,
      title: `t${i}`,
      body: `b${i}`,
    }))

    await sendPushNotifications(notifications)

    // 250 / 100 → 3 batches of sizes 100, 100, 50
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const sizes = fetchMock.mock.calls.map((c: any[]) => JSON.parse(c[1].body).length)
    expect(sizes).toEqual([100, 100, 50])
  })

  it('sends default sound and empty data object per message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ data: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await sendPushNotifications([
      { pushToken: 'ExponentPushToken[1]', title: 't', body: 'b' },
      { pushToken: 'ExponentPushToken[2]', title: 't2', body: 'b2', data: { k: 1 } },
    ])

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body[0]).toEqual({
      to: 'ExponentPushToken[1]',
      sound: 'default',
      title: 't',
      body: 'b',
      data: {},
    })
    expect(body[1].data).toEqual({ k: 1 })
  })

  it('does not throw when individual tickets report errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse({
          data: [
            { status: 'ok' },
            { status: 'error', message: 'DeviceNotRegistered' },
          ],
        }),
      ),
    )

    await expect(
      sendPushNotifications([
        { pushToken: 'ExponentPushToken[a]', title: 't', body: 'b' },
        { pushToken: 'ExponentPushToken[b]', title: 't', body: 'b' },
      ]),
    ).resolves.toBeUndefined()
  })

  it('swallows network errors per batch — does not abort subsequent batches', async () => {
    const fetchMock = vi
      .fn()
      // First batch fails network-wise…
      .mockRejectedValueOnce(new Error('offline'))
      // …second batch succeeds. Both must be attempted.
      .mockResolvedValueOnce(okResponse({ data: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const notifications = Array.from({ length: 150 }, (_, i) => ({
      pushToken: `ExponentPushToken[${i}]`,
      title: 't',
      body: 'b',
    }))

    await expect(sendPushNotifications(notifications)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
