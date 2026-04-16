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
    // The rooms.ts handler now wraps the host debit + room.create in a single
    // prisma.$transaction (both to make the debit atomic with room creation and
    // to prevent the "debit-without-room" bug). The default $transaction mock
    // used in other tests is a bare vi.fn, so we install a pass-through that
    // runs the callback against the same prisma.user / prisma.room mocks.
    beforeEach(() => {
      ;(prisma as any).$transaction = vi.fn(async (fn: any) =>
        fn({ user: mockPrismaUser, room: mockPrismaRoom }),
      )
    })

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
      // Public lobby: no star-coin debit at creation.
      expect(mockPrismaUser.updateMany).not.toHaveBeenCalled()
      // Public lobby: the commitment-fee flag must not be set — the per-player
      // charge happens at game start for everyone.
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('room:'),
        expect.stringContaining('"hostPrepaid":false'),
        'EX',
        21600,
      )
    })

    it('creates a private room and debits the host 10 ⭐ atomically', async () => {
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

      // Debit ran through $transaction and only matched users with enough stars.
      expect(mockPrismaUser.updateMany).toHaveBeenCalledWith({
        where: { id: 'host-user-1', starCoins: { gte: 10 } },
        data:  { starCoins: { decrement: 10 } },
      })

      // Redis state must flag hostPrepaid so startGameForRoom consumes the fee
      // for the FIRST game only — every subsequent game charges the host again.
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('room:'),
        expect.stringContaining('"hostPrepaid":true'),
        'EX',
        21600,
      )
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('room:'),
        expect.stringContaining('"gameMode":"ranked"'),
        'EX',
        21600,
      )
    })

    it('refuses to create a private room when host lacks stars (402) and does not create a room', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({ locale: 'en' })
      // Atomic debit fails — WHERE clause matched zero rows (insufficient stars).
      mockPrismaUser.updateMany.mockResolvedValue({ count: 0 })

      const response = await app.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { settings: { isPrivate: true } },
      })

      expect(response.statusCode).toBe(402)
      expect(response.json()).toEqual({ error: 'INSUFFICIENT_STARS', required: 10 })
      // Critically: the transaction must have rolled back — no room row, no
      // Redis state, and certainly no coins burned without a room to show for
      // it.
      expect(mockPrismaRoom.create).not.toHaveBeenCalled()
      expect(mockRedis.set).not.toHaveBeenCalled()
    })

    it('does NOT leak a room when the charge transaction rejects mid-flight', async () => {
      // Simulate a DB failure INSIDE the transaction (e.g. unique-code
      // collision, connection drop) AFTER the debit. With the pre-fix code
      // the host had already lost 10 ⭐ with no room and no refund path;
      // with the transaction-scoped debit the whole thing rolls back, the
      // host's coins are safe, and we surface a 500.
      mockPrismaUser.findUnique.mockResolvedValue({ locale: 'en' })
      ;(prisma as any).$transaction = vi.fn().mockRejectedValue(new Error('DB connection lost'))

      const response = await app.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { settings: { isPrivate: true } },
      })

      expect(response.statusCode).toBe(500)
      expect(mockPrismaRoom.create).not.toHaveBeenCalled()
      expect(mockRedis.set).not.toHaveBeenCalled()
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
