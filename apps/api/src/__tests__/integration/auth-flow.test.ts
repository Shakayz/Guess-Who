import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn(),
  },
}))

import bcrypt from 'bcryptjs'
import { authRoutes } from '../../routes/auth'

const mockPrismaUser = prisma.user as any
const mockHonor = prisma.honor as any

describe('Auth Flow - Integration Tests', () => {
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

  it('full flow: signup -> get token -> use token for /me', async () => {
    // Step 1: Sign up
    mockPrismaUser.findUnique.mockResolvedValue(null)
    mockPrismaUser.create.mockResolvedValue({
      id: 'user-new',
      username: 'newplayer',
      email: 'new@example.com',
    })

    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        username: 'newplayer',
        email: 'new@example.com',
        password: 'strongpassword123',
      },
    })

    expect(signupRes.statusCode).toBe(200)
    const { token } = signupRes.json()
    expect(token).toBeDefined()

    // Step 2: Use token to access /me
    mockPrismaUser.findUnique.mockResolvedValue({
      id: 'user-new',
      username: 'newplayer',
      email: 'new@example.com',
      avatarUrl: null,
      starCoins: 0,
      goldCoins: 0,
      rankTier: 'wooden',
      rankPoints: 0,
      honorPoints: 0,
      locale: 'en',
      createdAt: new Date('2025-06-01'),
    })
    mockHonor.groupBy.mockResolvedValue([])

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(meRes.statusCode).toBe(200)
    const profile = meRes.json()
    expect(profile.id).toBe('user-new')
    expect(profile.username).toBe('newplayer')
  })

  it('full flow: signin -> get token -> use token', async () => {
    // Step 1: Sign in
    mockPrismaUser.findUnique.mockResolvedValue({
      id: 'user-existing',
      username: 'existingplayer',
      email: 'existing@example.com',
      passwordHash: '$2a$12$hashedpassword',
    })
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const signinRes = await app.inject({
      method: 'POST',
      url: '/api/auth/signin',
      payload: {
        identifier: 'existing@example.com',
        password: 'correctpassword',
      },
    })

    expect(signinRes.statusCode).toBe(200)
    const { token } = signinRes.json()
    expect(token).toBeDefined()

    // Step 2: Use token to access /me
    mockPrismaUser.findUnique.mockResolvedValue({
      id: 'user-existing',
      username: 'existingplayer',
      email: 'existing@example.com',
      avatarUrl: null,
      starCoins: 500,
      goldCoins: 100,
      rankTier: 'silver',
      rankPoints: 1200,
      honorPoints: 25,
      locale: 'en',
      createdAt: new Date('2024-12-01'),
    })
    mockHonor.groupBy.mockResolvedValue([
      { type: 'good_sport', _count: { type: 10 } },
    ])

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(meRes.statusCode).toBe(200)
    const profile = meRes.json()
    expect(profile.id).toBe('user-existing')
    expect(profile.honorGoodSport).toBe(10)
  })

  it('returns 401 with an invalid token', async () => {
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Bearer invalid.token.here' },
    })

    expect(meRes.statusCode).toBe(401)
  })

  it('returns 401 with an expired token', async () => {
    // Sign a token that expired 1 hour ago by using a negative iat
    const expiredToken = app.jwt.sign(
      { sub: 'user-1', username: 'testuser', iat: Math.floor(Date.now() / 1000) - 7200 },
      { expiresIn: '1h' },
    )

    // The token was issued 2h ago with 1h expiry, so it is expired

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${expiredToken}` },
    })

    expect(meRes.statusCode).toBe(401)
  })
})
