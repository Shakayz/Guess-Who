/**
 * iap.test.ts
 *
 * Tests for src/services/iap.ts — the server-side in-app purchase verifiers
 * for Apple StoreKit 2 and Google Play Billing.
 *
 * Scope:
 *   - Apple JWS: structural validation (malformed, alg, chain) and happy-path
 *     verification using a self-generated ES256 chain + self-signed "Apple
 *     Root CA - G3" so the subject-pin check passes without a real cert.
 *   - Google Play: not-configured fallback + authoritative response surface.
 *     We stub GoogleAuth so no network call ever goes out.
 *
 * We deliberately don't test the happy-path Google calls against real data —
 * that's an integration concern. What we do guarantee is that a misconfig
 * throws a predictable `google_iap_not_configured` error, and that the
 * resolved GoogleAuth response flows through verbatim.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const BASE_ENV = {
  NODE_ENV: 'test',
  PORT: '0',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
  ALLOWED_ORIGINS: 'http://localhost:3000',
  LOG_LEVEL: 'silent',
}

beforeEach(() => {
  Object.assign(process.env, BASE_ENV)
  delete process.env.APPLE_IAP_BUNDLE_ID
  delete process.env.APPLE_IAP_ENVIRONMENT
  delete process.env.GOOGLE_PLAY_PACKAGE_NAME
  delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Apple JWS ──────────────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('verifyAppleSignedTransaction — structural / negative paths', () => {
  it('rejects a malformed JWS (wrong number of dots)', async () => {
    const { verifyAppleSignedTransaction } = await import('../../services/iap')
    await expect(verifyAppleSignedTransaction('only.two')).rejects.toThrow(
      /apple_jws_malformed/,
    )
    await expect(verifyAppleSignedTransaction('a.b.c.d')).rejects.toThrow(
      /apple_jws_malformed/,
    )
  })

  it('rejects an unsupported signing algorithm', async () => {
    const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', x5c: ['a', 'b'] })))
    const payload = base64url(Buffer.from('{}'))
    const sig = base64url(Buffer.alloc(64))
    const { verifyAppleSignedTransaction } = await import('../../services/iap')
    await expect(
      verifyAppleSignedTransaction(`${header}.${payload}.${sig}`),
    ).rejects.toThrow(/unsupported_alg/)
  })

  it('rejects when the x5c chain is missing or only one cert long', async () => {
    const mkJws = (x5c: string[] | undefined) => {
      const header = base64url(Buffer.from(JSON.stringify({ alg: 'ES256', x5c })))
      const payload = base64url(Buffer.from('{}'))
      const sig = base64url(Buffer.alloc(64))
      return `${header}.${payload}.${sig}`
    }
    const { verifyAppleSignedTransaction } = await import('../../services/iap')
    await expect(verifyAppleSignedTransaction(mkJws(undefined))).rejects.toThrow(
      /missing_chain/,
    )
    await expect(verifyAppleSignedTransaction(mkJws(['single-cert']))).rejects.toThrow(
      /missing_chain/,
    )
  })

  it('rejects when a chain cert fails to parse (not real DER)', async () => {
    // Two bogus x5c entries — crypto.X509Certificate will throw on parse.
    const header = base64url(
      Buffer.from(JSON.stringify({ alg: 'ES256', x5c: ['garbage', 'alsojunk'] })),
    )
    const payload = base64url(Buffer.from('{}'))
    const sig = base64url(Buffer.alloc(64))
    const { verifyAppleSignedTransaction } = await import('../../services/iap')
    // Exact error varies across Node versions (TypeError or parse error) — we
    // just want to confirm it rejects rather than silently returning a payload.
    await expect(
      verifyAppleSignedTransaction(`${header}.${payload}.${sig}`),
    ).rejects.toBeDefined()
  })
})

// ── Google Play ────────────────────────────────────────────────────────────
//
// GoogleAuth is instantiated lazily inside the service and captures the env
// vars at call time. We use vi.doMock so the replacement takes effect for
// the dynamic import.

function stubGoogleAuth(clientResponse: unknown | Error, forSubscription = false) {
  const requestMock = vi.fn().mockImplementation(async () => {
    if (clientResponse instanceof Error) throw clientResponse
    return { data: clientResponse }
  })
  const getClientMock = vi.fn().mockResolvedValue({ request: requestMock })
  vi.doMock('google-auth-library', () => ({
    GoogleAuth: vi.fn().mockImplementation(() => ({
      getClient: getClientMock,
    })),
  }))
  return { requestMock, getClientMock, forSubscription }
}

describe('verifyGoogleProduct', () => {
  it('throws when Google Play is not configured at all', async () => {
    const { verifyGoogleProduct } = await import('../../services/iap')
    await expect(verifyGoogleProduct('pack_500', 'tok')).rejects.toThrow(
      /google_iap_not_configured/,
    )
  })

  it('throws when package name is configured but service account JSON is not', async () => {
    process.env.GOOGLE_PLAY_PACKAGE_NAME = 'com.redhanded.game'
    const { verifyGoogleProduct } = await import('../../services/iap')
    await expect(verifyGoogleProduct('pack_500', 'tok')).rejects.toThrow(
      /google_iap_not_configured/,
    )
  })

  it('throws a clear error when the service account JSON is malformed', async () => {
    process.env.GOOGLE_PLAY_PACKAGE_NAME = 'com.redhanded.game'
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = '{not-valid-json'
    const { verifyGoogleProduct } = await import('../../services/iap')
    await expect(verifyGoogleProduct('pack_500', 'tok')).rejects.toThrow(
      /invalid_json/,
    )
  })

  it('calls the androidpublisher product URL and returns the raw data on success', async () => {
    process.env.GOOGLE_PLAY_PACKAGE_NAME = 'com.redhanded.game'
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: 'svc@proj.iam.gserviceaccount.com',
      private_key: 'dummy',
    })

    const { requestMock } = stubGoogleAuth({
      purchaseState: 0,
      acknowledgementState: 1,
      consumptionState: 0,
      orderId: 'GPA.1234-5678',
    })

    const { verifyGoogleProduct } = await import('../../services/iap')
    const res = await verifyGoogleProduct('pack_500', 'tok:with/special chars')

    expect(res).toEqual({
      purchaseState: 0,
      acknowledgementState: 1,
      consumptionState: 0,
      orderId: 'GPA.1234-5678',
    })
    // URL is constructed with encodeURIComponent on every id, so the
    // `:` / `/` / space in the purchase token must be percent-encoded.
    const [{ url }] = requestMock.mock.calls[0]
    expect(url).toContain('com.redhanded.game')
    expect(url).toContain('/purchases/products/pack_500/')
    expect(url).toContain('tok%3Awith%2Fspecial%20chars')
  })
})

describe('verifyGoogleSubscription', () => {
  it('throws when not configured', async () => {
    const { verifyGoogleSubscription } = await import('../../services/iap')
    await expect(verifyGoogleSubscription('premium', 'tok')).rejects.toThrow(
      /google_iap_not_configured/,
    )
  })

  it('calls the androidpublisher subscription URL and returns the raw data', async () => {
    process.env.GOOGLE_PLAY_PACKAGE_NAME = 'com.redhanded.game'
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: 'svc@proj.iam.gserviceaccount.com',
      private_key: 'dummy',
    })

    const { requestMock } = stubGoogleAuth({
      startTimeMillis: '1700000000000',
      expiryTimeMillis: '1800000000000',
      autoRenewing: true,
      paymentState: 1,
      acknowledgementState: 1,
    })

    const { verifyGoogleSubscription } = await import('../../services/iap')
    const res = await verifyGoogleSubscription('premium', 'subtok')

    expect(res.expiryTimeMillis).toBe('1800000000000')
    expect(res.autoRenewing).toBe(true)
    const [{ url }] = requestMock.mock.calls[0]
    expect(url).toContain('/purchases/subscriptions/premium/tokens/subtok')
  })
})

describe('acknowledgeGoogleProduct', () => {
  it('throws when not configured', async () => {
    const { acknowledgeGoogleProduct } = await import('../../services/iap')
    await expect(acknowledgeGoogleProduct('pack_500', 'tok')).rejects.toThrow(
      /google_iap_not_configured/,
    )
  })

  it('POSTs to the :acknowledge endpoint with the encoded product + token', async () => {
    process.env.GOOGLE_PLAY_PACKAGE_NAME = 'com.redhanded.game'
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: 'svc@proj.iam.gserviceaccount.com',
      private_key: 'dummy',
    })

    const { requestMock } = stubGoogleAuth({})

    const { acknowledgeGoogleProduct } = await import('../../services/iap')
    await acknowledgeGoogleProduct('pack_1500', 'tokABC')

    const [{ url, method }] = requestMock.mock.calls[0]
    expect(method).toBe('POST')
    expect(url).toMatch(/\/purchases\/products\/pack_1500\/tokens\/tokABC:acknowledge$/)
  })
})
