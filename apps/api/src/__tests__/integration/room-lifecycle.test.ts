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

  describe('GET /api/rooms/active', () => {
    it('returns active: false when user is not in any active game', async () => {
      ;(prisma as any).gameParticipation = { findFirst: vi.fn().mockResolvedValue(null) }

      const response = await app.inject({
        method: 'GET',
        url: '/api/rooms/active',
        headers: { authorization: `Bearer ${authToken}` },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().active).toBe(false)
    })

    it('returns active: false when Redis state is missing', async () => {
      const mockParticipation = {
        game: {
          room: {
            id: 'room-1', code: 'ABC123', hostId: 'host-user-1',
            maxPlayers: 10, imposterCount: 2, speakingTimeSeconds: 30,
            votingTimeSeconds: 30, wordPackId: 'default', isPrivate: false,
            language: 'en', createdAt: new Date('2025-01-01'),
          },
        },
      }
      ;(prisma as any).gameParticipation = { findFirst: vi.fn().mockResolvedValue(mockParticipation) }
      mockRedis.get.mockResolvedValue(null) // no Redis state

      const response = await app.inject({
        method: 'GET',
        url: '/api/rooms/active',
        headers: { authorization: `Bearer ${authToken}` },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().active).toBe(false)
    })

    it('returns active: false when Redis state is not in_progress or voting', async () => {
      const mockParticipation = {
        game: {
          room: {
            id: 'room-1', code: 'ABC123', hostId: 'host-user-1',
            maxPlayers: 10, imposterCount: 2, speakingTimeSeconds: 30,
            votingTimeSeconds: 30, wordPackId: 'default', isPrivate: false,
            language: 'en', createdAt: new Date('2025-01-01'),
          },
        },
      }
      ;(prisma as any).gameParticipation = { findFirst: vi.fn().mockResolvedValue(mockParticipation) }
      mockRedis.get.mockResolvedValue(JSON.stringify({ status: 'waiting', players: [] }))

      const response = await app.inject({
        method: 'GET',
        url: '/api/rooms/active',
        headers: { authorization: `Bearer ${authToken}` },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().active).toBe(false)
    })

    it('returns active room when game is in_progress', async () => {
      const room = {
        id: 'room-1', code: 'ABC123', hostId: 'host-user-1',
        maxPlayers: 10, imposterCount: 2, speakingTimeSeconds: 30,
        votingTimeSeconds: 30, wordPackId: 'default', isPrivate: false,
        language: 'en', createdAt: new Date('2025-01-01'),
      }
      const mockParticipation = { game: { room } }
      ;(prisma as any).gameParticipation = { findFirst: vi.fn().mockResolvedValue(mockParticipation) }
      mockRedis.get.mockResolvedValue(JSON.stringify({
        status: 'in_progress',
        players: [{ id: 'host-user-1', username: 'hostplayer' }],
        currentRound: 1,
        maxRounds: 3,
        gameMode: 'normal',
        categories: ['animals'],
        enableDetective: false,
        enableDoubleAgent: false,
      }))

      const response = await app.inject({
        method: 'GET',
        url: '/api/rooms/active',
        headers: { authorization: `Bearer ${authToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.active).toBe(true)
      expect(body.roomCode).toBe('ABC123')
      expect(body.room.status).toBe('in_progress')
      expect(body.room.players).toHaveLength(1)
    })

    it('returns active room when game is in voting state', async () => {
      const room = {
        id: 'room-2', code: 'XYZ789', hostId: 'host-user-1',
        maxPlayers: 8, imposterCount: 1, speakingTimeSeconds: 60,
        votingTimeSeconds: 30, wordPackId: 'default', isPrivate: true,
        language: 'fr', createdAt: new Date('2025-01-01'),
      }
      const mockParticipation = { game: { room } }
      ;(prisma as any).gameParticipation = { findFirst: vi.fn().mockResolvedValue(mockParticipation) }
      mockRedis.get.mockResolvedValue(JSON.stringify({
        status: 'voting',
        players: [],
        gameMode: 'ranked',
        categories: [],
      }))

      const response = await app.inject({
        method: 'GET',
        url: '/api/rooms/active',
        headers: { authorization: `Bearer ${authToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.active).toBe(true)
      expect(body.room.settings.isPrivate).toBe(true)
    })

    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/rooms/active',
      })
      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /api/rooms', () => {
    // Helper: the route now wraps the (optional) host debit + room.create in
    // a single prisma.$transaction. Wire the mock so the callback runs with a
    // tx that exposes both user.updateMany and room.create, and resolves to
    // whatever mockPrismaRoom.create returns.
    const wireTransaction = (debitCount = 1) => {
      ;(prisma as any).$transaction = vi.fn(async (fn: any) =>
        fn({
          user: { updateMany: vi.fn().mockResolvedValue({ count: debitCount }) },
          room: { create: mockPrismaRoom.create },
        }),
      )
    }

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
      wireTransaction()
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
      mockPrismaUser.updateMany.mockResolvedValue({ count: 1 })
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
      wireTransaction()
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

    // ── Security regression: private lobby charge is now atomic ──
    it('refuses private-lobby creation with 402 INSUFFICIENT_STARS when host is broke', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({ locale: 'en' })
      // debit returns count:0 → host doesn't have 10 ⭐
      wireTransaction(0)

      const response = await app.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { settings: { isPrivate: true } },
      })

      expect(response.statusCode).toBe(402)
      expect(response.json()).toEqual({ error: 'INSUFFICIENT_STARS', required: 10 })
      // Room must NOT be created when the charge fails.
      expect(mockPrismaRoom.create).not.toHaveBeenCalled()
    })

    it('does NOT leak a room when the charge transaction rejects (atomicity)', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({ locale: 'en' })
      // Simulate a DB failure INSIDE the transaction after the debit — the
      // whole thing rolls back. The old code charged the host first then
      // created the room separately, so a failure here would have left the
      // host 10 ⭐ poorer with no room. We now surface a 500 and the caller
      // can trust no coins were moved.
      ;(prisma as any).$transaction = vi.fn().mockRejectedValue(new Error('DB connection lost'))

      const response = await app.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { settings: { isPrivate: true } },
      })

      expect(response.statusCode).toBe(500)
      expect(mockPrismaRoom.create).not.toHaveBeenCalled()
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
