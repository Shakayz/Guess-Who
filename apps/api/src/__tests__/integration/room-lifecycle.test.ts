import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'

// Mock the shared package's generateRoomCode
vi.mock('@imposter/shared', () => ({
  generateRoomCode: vi.fn().mockReturnValue('ABC123'),
}))

import { roomRoutes } from '../../routes/rooms'

const mockPrismaUser = prisma.user as any
const mockPrismaRoom = prisma.room as any
const mockRedis = redis as any

describe('Room Lifecycle - Integration Tests', () => {
  let app: FastifyInstance
  let authToken: string

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
    await app.register(roomRoutes, { prefix: '/api/rooms' })
    await app.ready()

    authToken = app.jwt.sign({ sub: 'host-user-1', username: 'hostplayer' })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/rooms', () => {
    it('creates a room with default settings', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({ locale: 'en' })
      mockPrismaRoom.create.mockResolvedValue({
        id: 'room-1',
        code: 'ABC123',
        hostId: 'host-user-1',
        maxPlayers: 10,
        imposterCount: 2,
        speakingTimeSeconds: 30,
        votingTimeSeconds: 30,
        wordPackId: 'default',
        isPrivate: false,
        language: 'en',
      })
      mockRedis.set.mockResolvedValue('OK')

      const response = await app.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {},
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.code).toBe('ABC123')
      expect(body.hostId).toBe('host-user-1')
      expect(body.maxPlayers).toBe(10)
    })

    it('creates a room with custom settings', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({ locale: 'en' })
      mockPrismaRoom.create.mockResolvedValue({
        id: 'room-2',
        code: 'ABC123',
        hostId: 'host-user-1',
        maxPlayers: 8,
        imposterCount: 1,
        speakingTimeSeconds: 60,
        votingTimeSeconds: 45,
        wordPackId: 'custom-pack',
        isPrivate: true,
        language: 'fr',
      })
      mockRedis.set.mockResolvedValue('OK')

      const response = await app.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          settings: {
            maxPlayers: 8,
            imposterCount: 1,
            speakingTimeSeconds: 60,
            votingTimeSeconds: 45,
            wordPackId: 'custom-pack',
            isPrivate: true,
            language: 'fr',
            categories: ['animals', 'food'],
            gameMode: 'ranked',
          },
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.maxPlayers).toBe(8)
      expect(body.isPrivate).toBe(true)

      // Verify Redis was called to store room state
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('room:'),
        expect.stringContaining('"gameMode":"ranked"'),
        'EX',
        21600,
      )
    })

    it('requires authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/rooms',
        payload: {},
      })

      expect(response.statusCode).toBe(401)
    })

    it('validates room settings constraints', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          settings: {
            maxPlayers: 100, // exceeds max of 20
          },
        },
      })

      // Zod validation should reject maxPlayers > 20
      expect(response.statusCode).toBeGreaterThanOrEqual(400)
    })
  })

  describe('GET /api/rooms/:code', () => {
    it('returns a room by code', async () => {
      mockPrismaRoom.findUnique.mockResolvedValue({
        id: 'room-1',
        code: 'ABC123',
        hostId: 'host-user-1',
        maxPlayers: 10,
        host: { id: 'host-user-1', username: 'hostplayer' },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/rooms/ABC123',
        headers: { authorization: `Bearer ${authToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.code).toBe('ABC123')
      expect(body.host.username).toBe('hostplayer')
    })

    it('returns 404 for nonexistent room', async () => {
      mockPrismaRoom.findUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/rooms/NOPE99',
        headers: { authorization: `Bearer ${authToken}` },
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
