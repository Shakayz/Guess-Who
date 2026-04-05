import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'
import { achievementRoutes } from '../../routes/achievements'

// Patch prisma mock with models used by achievements routes
const mockAchievement = {
  upsert: vi.fn().mockResolvedValue({}),
  findMany: vi.fn(),
}
const mockUserAchievement = {
  findMany: vi.fn(),
}
;(prisma as any).achievement = mockAchievement
;(prisma as any).userAchievement = mockUserAchievement

describe('Achievement Routes', () => {
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
    // upsert is called during plugin registration (seed logic)
    await app.register(achievementRoutes, { prefix: '/api/achievements' })
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

  describe('GET /api/achievements', () => {
    it('returns all achievements with user unlock status', async () => {
      const now = new Date('2025-06-01T12:00:00Z')

      mockAchievement.findMany.mockResolvedValue([
        { id: 'ach-1', key: 'first_win', name: 'First Win', description: 'Win your first game', icon: '🏆', createdAt: now },
        { id: 'ach-2', key: 'ten_wins', name: 'Veteran', description: 'Win 10 games', icon: '🎖️', createdAt: now },
      ])
      mockUserAchievement.findMany.mockResolvedValue([
        { achievementId: 'ach-1', userId: 'user-1', unlockedAt: now },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/api/achievements',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveLength(2)

      const firstWin = body.find((a: any) => a.key === 'first_win')
      expect(firstWin.unlocked).toBe(true)
      expect(firstWin.unlockedAt).toBeDefined()

      const tenWins = body.find((a: any) => a.key === 'ten_wins')
      expect(tenWins.unlocked).toBe(false)
      expect(tenWins.unlockedAt).toBeNull()
    })

    it('returns achievements with no unlocks for new user', async () => {
      mockAchievement.findMany.mockResolvedValue([
        { id: 'ach-1', key: 'first_win', name: 'First Win', description: 'Win your first game', icon: '🏆', createdAt: new Date() },
      ])
      mockUserAchievement.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: '/api/achievements',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body[0].unlocked).toBe(false)
      expect(body[0].unlockedAt).toBeNull()
    })

    it('returns 401 without auth token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/achievements' })
      expect(res.statusCode).toBe(401)
    })

    it('returns empty list when no achievements defined', async () => {
      mockAchievement.findMany.mockResolvedValue([])
      mockUserAchievement.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: '/api/achievements',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toHaveLength(0)
    })
  })
})
