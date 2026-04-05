import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

// Mock the shared package's generateRoomCode
vi.mock('@imposter/shared', () => ({
  generateRoomCode: vi.fn().mockReturnValue('XYZABC'),
}))

import { authRoutes } from '../../routes/auth'
import { roomRoutes } from '../../routes/rooms'

const mockPrismaUser = prisma.user as any
const mockPrismaRoom = prisma.room as any
const mockHonor = prisma.honor as any
const mockRedis = redis as any

describe('E2E User Journey', () => {
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

    // Health check
    app.get('/health', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }))

    await app.register(authRoutes, { prefix: '/api/auth' })
    await app.register(roomRoutes, { prefix: '/api/rooms' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('full journey: health check -> signup -> create room -> verify room exists', async () => {
    // Step 1: Health check
    const healthRes = await app.inject({
      method: 'GET',
      url: '/health',
    })
    expect(healthRes.statusCode).toBe(200)
    expect(healthRes.json().status).toBe('ok')

    // Step 2: Sign up a new user
    mockPrismaUser.findUnique.mockResolvedValue(null)
    mockPrismaUser.create.mockResolvedValue({
      id: 'e2e-user-1',
      username: 'e2eplayer',
      email: 'e2e@example.com',
    })

    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        username: 'e2eplayer',
        email: 'e2e@example.com',
        password: 'e2epassword123',
      },
    })

    expect(signupRes.statusCode).toBe(200)
    const { token, user } = signupRes.json()
    expect(token).toBeDefined()
    expect(user.username).toBe('e2eplayer')

    // Step 3: Create a room
    mockPrismaUser.findUnique.mockResolvedValue({ locale: 'en' })
    mockPrismaRoom.create.mockResolvedValue({
      id: 'e2e-room-1',
      code: 'XYZABC',
      hostId: 'e2e-user-1',
      maxPlayers: 10,
      imposterCount: 2,
      speakingTimeSeconds: 30,
      votingTimeSeconds: 30,
      wordPackId: 'default',
      isPrivate: false,
      language: 'en',
    })
    mockRedis.set.mockResolvedValue('OK')

    const createRoomRes = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        settings: {
          maxPlayers: 10,
          imposterCount: 2,
          gameMode: 'normal',
        },
      },
    })

    expect(createRoomRes.statusCode).toBe(201)
    const room = createRoomRes.json()
    expect(room.code).toBe('XYZABC')
    expect(room.hostId).toBe('e2e-user-1')

    // Step 4: Verify the room exists by looking it up
    mockPrismaRoom.findUnique.mockResolvedValue({
      id: 'e2e-room-1',
      code: 'XYZABC',
      hostId: 'e2e-user-1',
      maxPlayers: 10,
      host: { id: 'e2e-user-1', username: 'e2eplayer' },
    })

    const getRoomRes = await app.inject({
      method: 'GET',
      url: '/api/rooms/XYZABC',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(getRoomRes.statusCode).toBe(200)
    const fetchedRoom = getRoomRes.json()
    expect(fetchedRoom.code).toBe('XYZABC')
    expect(fetchedRoom.host.username).toBe('e2eplayer')
  })

  it('journey: signup -> access /me profile -> verify user data', async () => {
    // Sign up
    mockPrismaUser.findUnique.mockResolvedValue(null)
    mockPrismaUser.create.mockResolvedValue({
      id: 'e2e-user-2',
      username: 'profileuser',
      email: 'profile@example.com',
    })

    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        username: 'profileuser',
        email: 'profile@example.com',
        password: 'profilepass123',
      },
    })

    const { token } = signupRes.json()

    // Access profile
    mockPrismaUser.findUnique.mockResolvedValue({
      id: 'e2e-user-2',
      username: 'profileuser',
      email: 'profile@example.com',
      avatarUrl: null,
      starCoins: 0,
      goldCoins: 0,
      rankTier: 'wooden',
      rankPoints: 0,
      honorPoints: 0,
      locale: 'en',
      createdAt: new Date('2025-01-01'),
    })
    mockHonor.groupBy.mockResolvedValue([])

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(meRes.statusCode).toBe(200)
    const profile = meRes.json()
    expect(profile.username).toBe('profileuser')
    expect(profile.starCoins).toBe(0)
    expect(profile.rankTier).toBe('wooden')
    expect(profile.honorTeamplayer).toBe(0)
    expect(profile.honorSharpMind).toBe(0)
    expect(profile.honorGoodSport).toBe(0)
  })

  it('unauthenticated user cannot create rooms or access profile', async () => {
    const roomRes = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: {},
    })
    expect(roomRes.statusCode).toBe(401)

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    })
    expect(meRes.statusCode).toBe(401)
  })
})
