import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'
import { historyRoutes } from '../../routes/history'

// Add models used by history routes
const mockGameParticipation = {
  count: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
}
const mockGame = {
  findUnique: vi.fn(),
}
;(prisma as any).gameParticipation = mockGameParticipation
;(prisma as any).game = mockGame

describe('History Routes', () => {
  let app: FastifyInstance
  let token: string

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
    await app.register(historyRoutes, { prefix: '/api/history' })
    await app.ready()

    token = app.jwt.sign({ sub: 'user-1', username: 'testuser' })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── GET / ─────────────────────────────────────────────────────────────────────

  describe('GET /api/history', () => {
    const makeParticipation = () => ({
      role: 'villager',
      survived: true,
      starCoinsEarned: 20,
      game: {
        id: 'game-1',
        startedAt: new Date('2025-06-01T10:00:00Z'),
        endedAt: new Date('2025-06-01T10:30:00Z'),
        winnerTeam: 'villagers',
        _count: { rounds: 3 },
        participations: [
          {
            userId: 'user-1',
            role: 'villager',
            survived: true,
            user: { id: 'user-1', username: 'testuser', avatarUrl: null },
          },
        ],
      },
    })

    it('returns paginated game history', async () => {
      mockGameParticipation.count.mockResolvedValue(1)
      mockGameParticipation.findMany.mockResolvedValue([makeParticipation()])

      const res = await app.inject({
        method: 'GET',
        url: '/api/history',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.games).toHaveLength(1)
      expect(body.total).toBe(1)
      expect(body.page).toBe(1)
      expect(body.totalPages).toBe(1)
      expect(body.games[0].myRole).toBe('villager')
    })

    it('uses page and limit query params', async () => {
      mockGameParticipation.count.mockResolvedValue(25)
      mockGameParticipation.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: '/api/history?page=2&limit=5',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.page).toBe(2)
      expect(body.totalPages).toBe(5)
    })

    it('returns 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/history' })
      expect(res.statusCode).toBe(401)
    })
  })

  // ── GET /:gameId ──────────────────────────────────────────────────────────────

  describe('GET /api/history/:gameId', () => {
    it('returns game details for a participant', async () => {
      mockGameParticipation.findUnique.mockResolvedValue({
        gameId: 'game-1',
        userId: 'user-1',
        role: 'villager',
        survived: true,
        starCoinsEarned: 20,
      })
      mockGame.findUnique.mockResolvedValue({
        id: 'game-1',
        startedAt: new Date('2025-06-01T10:00:00Z'),
        endedAt: new Date('2025-06-01T10:30:00Z'),
        winnerTeam: 'villagers',
        participations: [
          {
            userId: 'user-1',
            role: 'villager',
            survived: true,
            starCoinsEarned: 20,
            user: { id: 'user-1', username: 'testuser', avatarUrl: null },
          },
        ],
        rounds: [],
        chatMessages: [],
      })

      const res = await app.inject({
        method: 'GET',
        url: '/api/history/game-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.id).toBe('game-1')
      expect(body.myRole).toBe('villager')
    })

    it('returns 404 when user did not participate', async () => {
      mockGameParticipation.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: '/api/history/game-99',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })
})
