import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn(),
  },
}))

import bcrypt from 'bcryptjs'
import { authRoutes } from '../../routes/auth'

const mockPrismaUser = prisma.user as any

describe('Auth Routes - Unit Tests', () => {
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
    await app.register(authRoutes, { prefix: '/api/auth' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Signup Tests ─────────────────────────────────────────────────────────────

  describe('POST /api/auth/signup', () => {
    it('creates a user with valid data', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null)
      mockPrismaUser.create.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'securepassword123',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.token).toBeDefined()
      expect(body.user.id).toBe('user-1')
      expect(body.user.username).toBe('testuser')
      expect(body.user.email).toBe('test@example.com')
    })

    it('returns 409 when email is already in use', async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce({
        id: 'existing-user',
        email: 'taken@example.com',
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          username: 'newuser',
          email: 'taken@example.com',
          password: 'securepassword123',
        },
      })

      expect(response.statusCode).toBe(409)
      const body = response.json()
      expect(body.error).toBe('Email already in use')
    })

    it('returns 400 when password is too short', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'short',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 400 when username is too short', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          username: 'ab',
          email: 'test@example.com',
          password: 'securepassword123',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 400 when email is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          username: 'testuser',
          email: 'not-an-email',
          password: 'securepassword123',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 409 when username is already taken (after email check)', async () => {
      // First findUnique returns null (email not taken), second returns user (username taken)
      mockPrismaUser.findUnique
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: 'other-user', username: 'testuser' }) // username check

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          username: 'testuser',
          email: 'new@example.com',
          password: 'securepassword123',
        },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json().error).toBe('Username already taken')
    })

    it('returns 409 with P2002 error on email field', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null)
      mockPrismaUser.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint'), { code: 'P2002', meta: { target: ['email'] } })
      )

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          username: 'testuser',
          email: 'taken@example.com',
          password: 'securepassword123',
        },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json().error).toBe('Email already in use')
    })

    it('returns 409 with P2002 error on username field', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null)
      mockPrismaUser.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint'), { code: 'P2002', meta: { target: ['username'] } })
      )

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          username: 'takenuser',
          email: 'new@example.com',
          password: 'securepassword123',
        },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json().error).toBe('Username already taken')
    })

    it('returns 500 on unexpected error during signup', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null)
      mockPrismaUser.create.mockRejectedValue(new Error('DB connection lost'))

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'securepassword123',
        },
      })

      expect(response.statusCode).toBe(500)
      expect(response.json().error).toBe('Could not create account. Please try again.')
    })
  })

  // ── Signin Tests ─────────────────────────────────────────────────────────────

  describe('POST /api/auth/signin', () => {
    it('signs in with valid credentials using email', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: '$2a$12$hashedpassword',
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signin',
        payload: {
          identifier: 'test@example.com',
          password: 'securepassword123',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.token).toBeDefined()
      expect(body.user.id).toBe('user-1')
    })

    it('signs in with valid credentials using username', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        passwordHash: '$2a$12$hashedpassword',
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signin',
        payload: {
          identifier: 'testuser',
          password: 'securepassword123',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.token).toBeDefined()
    })

    it('returns 401 with wrong password', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        passwordHash: '$2a$12$hashedpassword',
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signin',
        payload: {
          identifier: 'test@example.com',
          password: 'wrongpassword',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Invalid credentials')
    })

    it('returns 401 when user does not exist', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signin',
        payload: {
          identifier: 'nonexistent@example.com',
          password: 'anypassword',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Invalid credentials')
    })

    it('returns 400 when identifier field is missing in signin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signin',
        payload: { password: 'somepassword' },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 500 on unexpected database error during signin', async () => {
      mockPrismaUser.findUnique.mockRejectedValue(new Error('DB unavailable'))

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signin',
        payload: {
          identifier: 'user@example.com',
          password: 'securepassword123',
        },
      })

      expect(response.statusCode).toBe(500)
      expect(response.json().error).toBe('Could not sign in. Please try again.')
    })

    it('returns 401 when user has no passwordHash (OAuth-only account)', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-oauth',
        username: 'oauthuser',
        email: 'oauth@gmail.com',
        passwordHash: null,
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signin',
        payload: {
          identifier: 'oauth@gmail.com',
          password: 'anypassword',
        },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json().error).toBe('Invalid credentials')
    })
  })

  // ── /me Tests ────────────────────────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('returns 401 without a token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      })

      expect(response.statusCode).toBe(401)
    })

    it('returns 404 when user is not found', async () => {
      const token = app.jwt.sign({ sub: 'deleted-user', username: 'gone' })
      mockPrismaUser.findUnique.mockResolvedValue(null)
      const mockHonor = prisma.honor as any
      mockHonor.groupBy.mockResolvedValue([])

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toBe('User not found')
    })

    it('returns user profile with valid token', async () => {
      const token = app.jwt.sign({ sub: 'user-1', username: 'testuser' })

      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: null,
        starCoins: 100,
        goldCoins: 50,
        rankTier: 'bronze',
        rankPoints: 250,
        honorPoints: 10,
        locale: 'en',
        createdAt: new Date('2025-01-01'),
      })

      const mockHonor = prisma.honor as any
      mockHonor.groupBy.mockResolvedValue([
        { type: 'teamplayer', _count: { type: 3 } },
        { type: 'sharp_mind', _count: { type: 5 } },
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.id).toBe('user-1')
      expect(body.username).toBe('testuser')
      expect(body.honorTeamplayer).toBe(3)
      expect(body.honorSharpMind).toBe(5)
      expect(body.honorGoodSport).toBe(0)
    })
  })
})
