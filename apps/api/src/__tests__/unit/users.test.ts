import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
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
    await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } })
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

  // ── POST /me/avatar ───────────────────────────────────────────────────────────

  describe('POST /api/users/me/avatar', () => {
    it('uploads a valid PNG and stores base64 data URL', async () => {
      mockUser.update.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        avatarUrl: 'data:image/png;base64,abc',
        locale: 'en',
      })

      // Build a minimal multipart body for a 1x1 PNG (89 bytes)
      const boundary = 'TestBoundary123'
      const pngBytes = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
        '2e00000000c4944415478016360f8cfc00000000200015e178e5600000000049454e44ae426082',
        'hex',
      )
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`),
        pngBytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ])

      const res = await app.inject({
        method: 'POST',
        url: '/api/users/me/avatar',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: body,
      })

      expect(res.statusCode).toBe(200)
      const json = res.json()
      expect(json.avatarUrl).toBe('data:image/png;base64,abc')
      expect(mockUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ avatarUrl: expect.stringMatching(/^data:image\/png;base64,/) }),
        }),
      )
    })

    it('rejects unsupported mime type', async () => {
      const boundary = 'TestBoundary456'
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\n`),
        Buffer.from('hello'),
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ])

      const res = await app.inject({
        method: 'POST',
        url: '/api/users/me/avatar',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: body,
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/invalid file type/i)
    })

    it('returns 400 when no file is attached', async () => {
      const boundary = 'TestBoundaryEmpty'
      const body = Buffer.from(`--${boundary}--\r\n`)

      const res = await app.inject({
        method: 'POST',
        url: '/api/users/me/avatar',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: body,
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/no file/i)
    })

    it('returns 401 without token', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/users/me/avatar', payload: '' })
      expect(res.statusCode).toBe(401)
    })
  })

  // ── DELETE /me/avatar ─────────────────────────────────────────────────────────

  describe('DELETE /api/users/me/avatar', () => {
    it('sets avatarUrl to null', async () => {
      mockUser.update.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        avatarUrl: null,
        locale: 'en',
      })

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/users/me/avatar',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().avatarUrl).toBeNull()
      expect(mockUser.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { avatarUrl: null } }),
      )
    })

    it('returns 401 without token', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/users/me/avatar' })
      expect(res.statusCode).toBe(401)
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

    it('computes didWin correctly for all roles', async () => {
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
        .mockResolvedValueOnce(4)   // totalGames
        .mockResolvedValueOnce(2)   // wins
        .mockResolvedValueOnce(2)   // asVillager
        .mockResolvedValueOnce(2)   // asImposter
        .mockResolvedValueOnce(2)   // survived

      mockGameParticipation.findMany.mockResolvedValue([
        {
          role: 'villager',
          survived: true,
          game: { id: 'g1', winnerTeam: 'villagers', startedAt: new Date(), _count: { rounds: 2 } },
        },
        {
          role: 'imposter',
          survived: false,
          game: { id: 'g2', winnerTeam: 'imposters', startedAt: new Date(), _count: { rounds: 3 } },
        },
        {
          role: 'detective',
          survived: true,
          game: { id: 'g3', winnerTeam: 'villagers', startedAt: new Date(), _count: { rounds: 1 } },
        },
        {
          role: 'double_agent',
          survived: false,
          game: { id: 'g4', winnerTeam: 'imposters', startedAt: new Date(), _count: { rounds: 2 } },
        },
      ])
      mockHonor.groupBy.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: '/api/users/user-2/profile',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.recentGames).toHaveLength(4)

      const g1 = body.recentGames.find((g: any) => g.gameId === 'g1')
      expect(g1.didWin).toBe(true) // villager + villagers win

      const g2 = body.recentGames.find((g: any) => g.gameId === 'g2')
      expect(g2.didWin).toBe(true) // imposter + imposters win

      const g3 = body.recentGames.find((g: any) => g.gameId === 'g3')
      expect(g3.didWin).toBe(true) // detective + villagers win

      const g4 = body.recentGames.find((g: any) => g.gameId === 'g4')
      expect(g4.didWin).toBe(true) // double_agent + imposters win
    })

    it('returns winRate as 0 when totalGames is 0', async () => {
      mockUser.findUnique.mockResolvedValue({
        id: 'user-new',
        username: 'newbie',
        avatarUrl: null,
        rankTier: 'wooden',
        rankPoints: 0,
        honorPoints: 0,
        createdAt: new Date(),
      })
      mockGameParticipation.count.mockResolvedValue(0)
      mockGameParticipation.findMany.mockResolvedValue([])
      mockHonor.groupBy.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: '/api/users/user-new/profile',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().stats.winRate).toBe(0)
    })
  })
})
