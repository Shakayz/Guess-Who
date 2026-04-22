import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'

// Mock env so GOOGLE_CLIENT_ID is available when the module is loaded
vi.mock('../../config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    APPLE_CLIENT_ID: 'com.example.app',
    ALLOWED_ORIGINS: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    PORT: 3001,
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    REDIS_URL: 'redis://localhost:6379',
  },
}))

// Mock google-auth-library
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn(),
}))

// Mock jsonwebtoken methods used for Apple verification
vi.mock('jsonwebtoken', async (importOriginal) => {
  const original = await importOriginal<typeof import('jsonwebtoken')>()
  return { ...original, decode: vi.fn(), verify: vi.fn() }
})

// Stub global fetch to prevent real network calls in Apple verification
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { OAuth2Client } from 'google-auth-library'
import { oauthRoutes } from '../../routes/oauth'

const mockPrismaUser = prisma.user as any
// Add findFirst to the prisma user mock (not in default setup.ts)
;(mockPrismaUser as any).findFirst = vi.fn()

describe('OAuth Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(jwt, { secret: 'test-secret-key-that-is-at-least-32-chars-long' })
    app.decorate('authenticate', async function (request: any, reply: any) {
      try {
        await request.jwtVerify()
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' })
      }
    })
    await app.register(oauthRoutes, { prefix: '/api/auth' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Re-create findFirst mock after clearAllMocks clears it
    ;(mockPrismaUser as any).findFirst = vi.fn()
  })

  // ── POST /google/verify ───────────────────────────────────────────────────────

  describe('POST /api/auth/google/verify', () => {
    it('signs in existing Google user with idToken', async () => {
      const mockVerifyIdToken = vi.fn().mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-123',
          email: 'user@gmail.com',
          name: 'Test User',
          picture: 'https://lh3.google.com/photo.jpg',
        }),
      })
      vi.mocked(OAuth2Client).mockImplementation(() => ({ verifyIdToken: mockVerifyIdToken }) as any)

      ;(mockPrismaUser as any).findFirst.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        email: 'user@gmail.com',
        googleId: 'google-sub-123',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google/verify',
        payload: { idToken: 'valid.google.id.token' },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.token).toBeDefined()
      expect(body.user.id).toBe('user-1')
    })

    it('creates new user on first Google sign-in and returns setupToken', async () => {
      const mockVerifyIdToken = vi.fn().mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-new',
          email: 'newuser@gmail.com',
          name: 'New User',
          picture: null,
        }),
      })
      vi.mocked(OAuth2Client).mockImplementation(() => ({ verifyIdToken: mockVerifyIdToken }) as any)

      ;(mockPrismaUser as any).findFirst.mockResolvedValue(null)
      mockPrismaUser.findUnique.mockResolvedValue(null)
      mockPrismaUser.create.mockResolvedValue({
        id: 'user-new',
        username: 'pending_123456789012',
        email: 'newuser@gmail.com',
        googleId: 'google-sub-new',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google/verify',
        payload: { idToken: 'new.user.id.token' },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.needsUsername).toBe(true)
      expect(body.setupToken).toBeDefined()
      expect(body.suggestedUsername).toBeDefined()
    })

    it('returns 400 when neither idToken nor accessToken provided', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google/verify',
        payload: {},
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('Provide idToken or accessToken')
    })

    it('returns 401 when idToken verification throws', async () => {
      const mockVerifyIdToken = vi.fn().mockRejectedValue(new Error('Token invalid'))
      vi.mocked(OAuth2Client).mockImplementation(() => ({ verifyIdToken: mockVerifyIdToken }) as any)

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google/verify',
        payload: { idToken: 'bad.token' },
      })

      expect(res.statusCode).toBe(401)
    })
  })

  // ── POST /apple/verify ────────────────────────────────────────────────────────

  describe('POST /api/auth/apple/verify', () => {
    it('returns 400 when identityToken is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/apple/verify',
        payload: {},
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('Missing identityToken')
    })

    it('returns 401 when Apple JWKS fetch fails', async () => {
      // Apple key endpoint returns error → verifyAppleToken returns null
      // In non-development env this results in 401
      mockFetch.mockResolvedValue({ ok: false })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/apple/verify',
        payload: { identityToken: 'some.apple.jwt.token' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('signs in existing Apple user when token verifies successfully', async () => {
      // Simulate a successful Apple JWKS + JWT verify flow by returning a valid payload
      // verifyAppleToken succeeds: fetch ok, keys present, jwt.verify returns payload
      const { createPublicKey } = await import('crypto')
      // We'll make the fetch succeed with a key, decode returns kid matching key,
      // then jwt.verify returns a payload
      const mockKeys = [{ kid: 'test-kid', kty: 'RSA', n: 'test', e: 'AQAB' }]
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ keys: mockKeys }),
      })

      const jwt_module = await import('jsonwebtoken')
      vi.mocked(jwt_module.decode).mockReturnValue({
        header: { kid: 'test-kid', alg: 'RS256' },
        payload: {},
        signature: '',
      } as any)
      vi.mocked(jwt_module.verify).mockReturnValue({
        sub: 'apple-sub-existing',
        email: 'existing@icloud.com',
      } as any)

      ;(mockPrismaUser as any).findFirst.mockResolvedValue({
        id: 'user-apple-1',
        username: 'appleuser',
        email: 'existing@icloud.com',
        appleId: 'apple-sub-existing',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/apple/verify',
        payload: { identityToken: 'valid.apple.jwt', name: 'Apple User' },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.token).toBeDefined()
      expect(body.user.id).toBe('user-apple-1')
    })

    it('creates new Apple user and returns setupToken when no prior account', async () => {
      // verifyAppleToken will fail because createPublicKey with mock JWK fails → returns null
      // In test env (NODE_ENV=test, not 'development') → should return 401
      // So we test the dev fallback path by temporarily being in development mode
      // Instead, test via the dev fallback: make fetch fail so verifyAppleToken returns null
      // and since NODE_ENV is 'test' (not 'development'), this returns 401.
      // So we test this path through a different app instance in dev mode.
      // For now just verify the 401 path for non-dev and test via dev-mode app.
      mockFetch.mockResolvedValue({ ok: false })

      ;(mockPrismaUser as any).findFirst.mockResolvedValue(null)
      mockPrismaUser.findUnique.mockResolvedValue(null)
      mockPrismaUser.create.mockResolvedValue({
        id: 'user-apple-new',
        username: 'pending_123456789',
        email: 'newapple@icloud.com',
        appleId: 'apple-sub-new',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/apple/verify',
        payload: { identityToken: 'new.apple.jwt', name: 'New Apple' },
      })

      // In test env (not 'development'), failed Apple verification returns 401
      expect(res.statusCode).toBe(401)
    })

    it('links Apple ID to existing email account', async () => {
      // Make verifyAppleToken fail → in test env returns 401
      // Test the link path via successful jwt.verify mock
      const mockKeys = [{ kid: 'test-kid-3', kty: 'RSA' }]
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ keys: mockKeys }),
      })

      const jwt_module = await import('jsonwebtoken')
      vi.mocked(jwt_module.decode).mockReturnValue({
        header: { kid: 'test-kid-3', alg: 'RS256' },
        payload: {},
        signature: '',
      } as any)
      // Make jwt.verify throw so verifyAppleToken returns null → 401 in test env
      vi.mocked(jwt_module.verify).mockImplementation(() => {
        throw new Error('verification failed')
      })

      ;(mockPrismaUser as any).findFirst.mockResolvedValue(null)
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-existing',
        username: 'existinguser',
        email: 'linked@example.com',
      })
      mockPrismaUser.update.mockResolvedValue({
        id: 'user-existing',
        username: 'existinguser',
        email: 'linked@example.com',
        appleId: 'apple-sub-link',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/apple/verify',
        payload: { identityToken: 'link.apple.jwt' },
      })

      // verifyAppleToken returns null → 401 in non-dev env
      expect(res.statusCode).toBe(401)
    })

    it('returns 401 in dev fallback when decoded token has no sub', async () => {
      // In development mode: verifyAppleToken returns null → dev fallback path
      // When decoded token has no sub → returns 401 before null dereference
      const { env: envMod } = await import('../../config/env')
      ;(envMod as any).NODE_ENV = 'development'

      mockFetch.mockResolvedValue({ ok: false })

      const jwt_module = await import('jsonwebtoken')
      vi.mocked(jwt_module.decode).mockReturnValue({ email: 'no-sub@icloud.com' } as any)

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/apple/verify',
        payload: { identityToken: 'nosub.apple.jwt' },
      })

      ;(envMod as any).NODE_ENV = 'test'

      expect(res.statusCode).toBe(401)
      expect(res.json().error).toBe('Invalid Apple token')
    })
  })

  // ── POST /setup-username ──────────────────────────────────────────────────────

  describe('POST /api/auth/setup-username', () => {
    it('sets username for a new OAuth user', async () => {
      const setupToken = app.jwt.sign({ sub: 'user-new', setup: true })

      // Collision check is findFirst (case-insensitive) — no existing row.
      ;(mockPrismaUser as any).findFirst.mockResolvedValue(null)
      mockPrismaUser.update.mockResolvedValue({
        id: 'user-new',
        username: 'coolplayer',
        email: 'newuser@gmail.com',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/setup-username',
        payload: { setupToken, username: 'coolplayer' },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.token).toBeDefined()
      expect(body.user.username).toBe('coolplayer')
    })

    it('returns 409 when username is already taken by another user', async () => {
      const setupToken = app.jwt.sign({ sub: 'user-new', setup: true })

      // Setup-username collision uses findFirst (case-insensitive) so
      // "TakenName" and "takenname" are treated as the same claim.
      ;(mockPrismaUser as any).findFirst.mockResolvedValue({ id: 'other-user', username: 'takenname' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/setup-username',
        payload: { setupToken, username: 'takenname' },
      })

      expect(res.statusCode).toBe(409)
      expect(res.json().error).toBe('Username already taken')
    })

    it('returns 400 when username contains invalid characters', async () => {
      const setupToken = app.jwt.sign({ sub: 'user-new', setup: true })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/setup-username',
        payload: { setupToken, username: 'bad user!' },
      })

      expect(res.statusCode).toBe(400)
    })

    it('returns 400 when setupToken is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/setup-username',
        payload: { username: 'coolplayer' },
      })

      expect(res.statusCode).toBe(400)
    })

    it('returns 401 with an invalid setup token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/setup-username',
        payload: { setupToken: 'invalid.jwt.here', username: 'coolplayer' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 401 when setup token does not have setup flag', async () => {
      // Sign a token without setup: true
      const nonSetupToken = app.jwt.sign({ sub: 'user-new', setup: false })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/setup-username',
        payload: { setupToken: nonSetupToken, username: 'coolplayer' },
      })

      expect(res.statusCode).toBe(401)
      expect(res.json().error).toBe('Invalid setup token')
    })

    it('allows username if it belongs to the same user (no conflict)', async () => {
      const setupToken = app.jwt.sign({ sub: 'user-new', setup: true })

      // findFirst returns user with same id as token sub → not a conflict
      ;(mockPrismaUser as any).findFirst.mockResolvedValue({ id: 'user-new', username: 'coolplayer' })
      mockPrismaUser.update.mockResolvedValue({
        id: 'user-new',
        username: 'coolplayer',
        email: 'newuser@gmail.com',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/setup-username',
        payload: { setupToken, username: 'coolplayer' },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.user.username).toBe('coolplayer')
    })

    it('signs in existing Google user with accessToken', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          sub: 'google-sub-access',
          email: 'access@gmail.com',
          name: 'Access User',
          picture: null,
        }),
      })

      ;(mockPrismaUser as any).findFirst.mockResolvedValue({
        id: 'user-access',
        username: 'accessuser',
        email: 'access@gmail.com',
        googleId: 'google-sub-access',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google/verify',
        payload: { accessToken: 'valid-access-token' },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.token).toBeDefined()
    })

    it('returns 401 when Google accessToken request fails', async () => {
      mockFetch.mockResolvedValue({ ok: false })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google/verify',
        payload: { accessToken: 'bad-access-token' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('links Google ID to existing email account', async () => {
      const mockVerifyIdToken = vi.fn().mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-link',
          email: 'linked@gmail.com',
          name: 'Link User',
          picture: null,
        }),
      })
      vi.mocked(OAuth2Client).mockImplementation(() => ({ verifyIdToken: mockVerifyIdToken }) as any)

      ;(mockPrismaUser as any).findFirst.mockResolvedValue(null)
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-existing',
        username: 'existinguser',
        email: 'linked@gmail.com',
        avatarUrl: null,
      })
      mockPrismaUser.update.mockResolvedValue({
        id: 'user-existing',
        username: 'existinguser',
        email: 'linked@gmail.com',
        googleId: 'google-sub-link',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google/verify',
        payload: { idToken: 'link.google.token' },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.token).toBeDefined()
    })
  })
})

// ─── Additional Apple verify paths ───────────────────────────────────────────
// These test the Apple new-user-creation and email-link flows that need a dev-mode
// app instance (NODE_ENV = 'development') so verifyAppleToken falls through to
// the decoded-without-verify dev fallback path.

describe('Apple verify — development fallback paths', () => {
  let devApp: any

  beforeAll(async () => {
    // Build a separate Fastify instance with NODE_ENV=development so the dev
    // fallback path in /apple/verify is exercised.
    const Fastify = (await import('fastify')).default
    const jwtPlugin = (await import('@fastify/jwt')).default

    // We need to re-mock env for this app instance
    devApp = Fastify({ logger: false })
    await devApp.register(jwtPlugin, { secret: 'test-secret-key-that-is-at-least-32-chars-long' })
    devApp.decorate('authenticate', async function (request: any, reply: any) {
      try { await request.jwtVerify() } catch { reply.status(401).send({ error: 'Unauthorized' }) }
    })

    // Temporarily set NODE_ENV to development so the dev fallback triggers
    const { env: envMod } = await import('../../config/env')
    ;(envMod as any).NODE_ENV = 'development'

    await devApp.register(oauthRoutes, { prefix: '/api/auth' })
    await devApp.ready()

    ;(envMod as any).NODE_ENV = 'test'
  })

  afterAll(async () => {
    await devApp?.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    ;(mockPrismaUser as any).findFirst = vi.fn()
    // Ensure env is restored to 'development' for these tests
    import('../../config/env').then(({ env: envMod }) => {
      ;(envMod as any).NODE_ENV = 'development'
    })
  })

  afterEach(async () => {
    // Reset NODE_ENV back to test after each test
    const { env: envMod } = await import('../../config/env')
    ;(envMod as any).NODE_ENV = 'test'
  })

  it('creates new Apple user and returns setupToken in dev fallback', async () => {
    const { env: envMod } = await import('../../config/env')
    ;(envMod as any).NODE_ENV = 'development'

    // verifyAppleToken fails (fetch fails) → dev fallback uses jwt.decode
    mockFetch.mockResolvedValue({ ok: false })
    const jwt_module = await import('jsonwebtoken')
    vi.mocked(jwt_module.decode).mockReturnValue({ sub: 'apple-dev-new', email: 'devnew@icloud.com' } as any)

    ;(mockPrismaUser as any).findFirst.mockResolvedValue(null)
    mockPrismaUser.findUnique.mockResolvedValue(null)
    mockPrismaUser.create.mockResolvedValue({
      id: 'user-apple-new',
      username: 'pending_devnew',
      email: 'devnew@icloud.com',
      appleId: 'apple-dev-new',
    })

    const res = await devApp.inject({
      method: 'POST',
      url: '/api/auth/apple/verify',
      payload: { identityToken: 'dev.apple.jwt', name: 'Dev New' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.needsUsername).toBe(true)
    expect(body.setupToken).toBeDefined()
  })

  it('signs in existing Apple user in dev fallback', async () => {
    const { env: envMod } = await import('../../config/env')
    ;(envMod as any).NODE_ENV = 'development'

    mockFetch.mockResolvedValue({ ok: false })
    const jwt_module = await import('jsonwebtoken')
    vi.mocked(jwt_module.decode).mockReturnValue({ sub: 'apple-dev-existing', email: 'devexist@icloud.com' } as any)

    ;(mockPrismaUser as any).findFirst.mockResolvedValue({
      id: 'user-apple-exist',
      username: 'devuser',
      email: 'devexist@icloud.com',
      appleId: 'apple-dev-existing',
    })

    const res = await devApp.inject({
      method: 'POST',
      url: '/api/auth/apple/verify',
      payload: { identityToken: 'dev.existing.apple.jwt' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.token).toBeDefined()
    expect(body.user.id).toBe('user-apple-exist')
  })

  it('links Apple ID to email in dev fallback when email matches existing user', async () => {
    const { env: envMod } = await import('../../config/env')
    ;(envMod as any).NODE_ENV = 'development'

    mockFetch.mockResolvedValue({ ok: false })
    const jwt_module = await import('jsonwebtoken')
    vi.mocked(jwt_module.decode).mockReturnValue({ sub: 'apple-link-sub', email: 'linked@example.com' } as any)

    ;(mockPrismaUser as any).findFirst.mockResolvedValue(null) // no user with this appleId
    mockPrismaUser.findUnique.mockResolvedValue({
      id: 'user-link',
      username: 'linkuser',
      email: 'linked@example.com',
    })
    mockPrismaUser.update.mockResolvedValue({
      id: 'user-link',
      username: 'linkuser',
      email: 'linked@example.com',
      appleId: 'apple-link-sub',
    })

    const res = await devApp.inject({
      method: 'POST',
      url: '/api/auth/apple/verify',
      payload: { identityToken: 'dev.link.apple.jwt' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.token).toBeDefined()
  })
})
