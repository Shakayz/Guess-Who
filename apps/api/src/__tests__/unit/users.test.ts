import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'
import { userRoutes } from '../../routes/users'

const mockUser = prisma.user as any
const mockHonor = prisma.honor as any
const mockRedis = redis as any

// Prisma models used by /:id/profile that are not in setup.ts - patch them on the mock
const mockGameParticipation = {
  count: vi.fn(),
  findMany: vi.fn(),
}
;(prisma as any).gameParticipation = mockGameParticipation

describe('User Routes', () => {
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
    await app.register(userRoutes, { prefix: '/api/users' })
    await app.ready()

    token = app.jwt.sign({ sub: 'user-1', username: 'testuser' })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── PATCH /me ────────────────────────────────────────────────────────────────

  describe('PATCH /api/users/me', () => {
    it('updates user profile fields', async () => {
      mockUser.update.mockResolvedValue({
        id: 'user-1',
        username: 'newname',
        avatarUrl: 'https://example.com/avatar.png',
        locale: 'fr',
      })

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { username: 'newname', locale: 'fr', avatarUrl: 'https://example.com/avatar.png' },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.username).toBe('newname')
      expect(body.locale).toBe('fr')
    })

    it('returns 401 without token', async () => {
      const res = await app.inject({ method: 'PATCH', url: '/api/users/me', payload: {} })
      expect(res.statusCode).toBe(401)
    })

    it('rejects invalid locale', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { locale: 'xx' },
      })
      // Zod throws on invalid enum → Fastify returns 500
      expect(res.statusCode).toBeGreaterThanOrEqual(400)
    })
  })

  // ── POST /me/push-token ───────────────────────────────────────────────────────

  describe('POST /api/users/me/push-token', () => {
    it('registers a push token', async () => {
      mockUser.update.mockResolvedValue({ id: 'user-1' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/users/me/push-token',
        headers: { authorization: `Bearer ${token}` },
        payload: { token: 'ExponentPushToken[abc123]' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('returns 400 when token field is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/me/push-token',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 401 without auth', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/users/me/push-token', payload: { token: 'x' } })
      expect(res.statusCode).toBe(401)
    })
  })

  // ── DELETE /me/push-token ─────────────────────────────────────────────────────

  describe('DELETE /api/users/me/push-token', () => {
    it('unregisters push token', async () => {
      mockUser.update.mockResolvedValue({ id: 'user-1' })

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/users/me/push-token',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })
  })

  // ── GET /leaderboard ──────────────────────────────────────────────────────────

  describe('GET /api/users/leaderboard', () => {
    it('returns leaderboard from DB when cache is empty', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.set.mockResolvedValue('OK')
      mockUser.findMany.mockResolvedValue([
        { id: 'user-1', username: 'top', avatarUrl: null, rankTier: 'gold', rankPoints: 2000 },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/api/users/leaderboard',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toHaveLength(1)
      expect(res.json()[0].username).toBe('top')
    })

    it('returns cached leaderboard when available', async () => {
      const cached = [{ id: 'user-2', username: 'cached', rankPoints: 3000 }]
      mockRedis.get.mockResolvedValue(JSON.stringify(cached))

      const res = await app.inject({
        method: 'GET',
        url: '/api/users/leaderboard',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()[0].username).toBe('cached')
      expect(mockUser.findMany).not.toHaveBeenCalled()
    })
  })

  // ── GET /search ───────────────────────────────────────────────────────────────

  describe('GET /api/users/search', () => {
    it('returns matching users', async () => {
      mockUser.findMany.mockResolvedValue([
        { id: 'user-2', username: 'alice', avatarUrl: null },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/api/users/search?q=ali',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().users).toHaveLength(1)
    })

    it('returns empty list when query is too short', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/search?q=a',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().users).toHaveLength(0)
    })
  })

  // ── GET /:id ──────────────────────────────────────────────────────────────────

  describe('GET /api/users/:id', () => {
    it('returns a user by id', async () => {
      mockUser.findUnique.mockResolvedValue({
        id: 'user-2',
        username: 'alice',
        avatarUrl: null,
        rankTier: 'silver',
        rankPoints: 800,
        honorPoints: 5,
        createdAt: new Date('2025-01-01'),
        _count: { gameParticipations: 10 },
      })

      const res = await app.inject({
        method: 'GET',
        url: '/api/users/user-2',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().username).toBe('alice')
    })

    it('returns 404 for unknown user', async () => {
      mockUser.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: '/api/users/unknown-id',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ── GET /:id/profile ──────────────────────────────────────────────────────────

  describe('GET /api/users/:id/profile', () => {
    it('returns full profile with stats', async () => {
      mockUser.findUnique.mockResolvedValue({
        id: 'user-2',
        username: 'alice',
        avatarUrl: null,
        rankTier: 'gold',
        rankPoints: 2000,
        honorPoints: 20,
        createdAt: new Date('2025-01-01'),
      })
      mockGameParticipation.count
        .mockResolvedValueOnce(20)   // totalGames
        .mockResolvedValueOnce(12)   // wins
        .mockResolvedValueOnce(15)   // asVillager
        .mockResolvedValueOnce(5)    // asImposter
        .mockResolvedValueOnce(10)   // survived
      mockGameParticipation.findMany.mockResolvedValue([])
      mockHonor.groupBy.mockResolvedValue([
        { type: 'teamplayer', _count: { type: 3 } },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/api/users/user-2/profile',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.username).toBe('alice')
      expect(body.stats.totalGames).toBe(20)
      expect(body.stats.wins).toBe(12)
      expect(body.honors).toHaveLength(1)
    })

    it('returns 404 for unknown user', async () => {
      mockUser.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: '/api/users/nobody/profile',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })
})
