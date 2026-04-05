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
  })

  // ── POST /setup-username ──────────────────────────────────────────────────────

  describe('POST /api/auth/setup-username', () => {
    it('sets username for a new OAuth user', async () => {
      const setupToken = app.jwt.sign({ sub: 'user-new', setup: true })

      mockPrismaUser.findUnique.mockResolvedValue(null)
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

      mockPrismaUser.findUnique.mockResolvedValue({ id: 'other-user', username: 'takenname' })

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
  })
})
