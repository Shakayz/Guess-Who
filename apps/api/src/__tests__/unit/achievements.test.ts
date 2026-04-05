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
  count: vi.fn().mockResolvedValue(0),
  groupBy: vi.fn().mockResolvedValue([]),
}
const mockUserAchievement = {
  findMany: vi.fn(),
  count: vi.fn().mockResolvedValue(0),
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
        { id: 'ach-1', key: 'first_win', name: 'First Victory', description: 'Win your first game', icon: '🏆', category: 'gameplay', difficulty: 'bronze', xpReward: 15, coinReward: 20, isSecret: false, createdAt: now },
        { id: 'ach-2', key: 'ten_wins', name: 'Veteran', description: 'Win 10 games', icon: '🎖️', category: 'gameplay', difficulty: 'silver', xpReward: 30, coinReward: 50, isSecret: false, createdAt: now },
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
        { id: 'ach-1', key: 'first_win', name: 'First Victory', description: 'Win your first game', icon: '🏆', category: 'gameplay', difficulty: 'bronze', xpReward: 15, coinReward: 20, isSecret: false, createdAt: new Date() },
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

    it('hides secret achievement details when not unlocked', async () => {
      const now = new Date()
      mockAchievement.findMany.mockResolvedValue([
        { id: 'ach-s1', key: 'night_owl', name: 'Night Owl', description: 'Play at 2 AM', icon: '🦉', category: 'secret', difficulty: 'bronze', xpReward: 15, coinReward: 25, isSecret: true, createdAt: now },
      ])
      mockUserAchievement.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: '/api/achievements',
        headers: { authorization: `Bearer ${token}` },
      })

      const body = res.json()
      expect(body[0].description).toBe('???')
      expect(body[0].icon).toBe('🔒')
      expect(body[0].isSecret).toBe(true)
    })

    it('reveals secret achievement details when unlocked', async () => {
      const now = new Date()
      mockAchievement.findMany.mockResolvedValue([
        { id: 'ach-s1', key: 'night_owl', name: 'Night Owl', description: 'Play at 2 AM', icon: '🦉', category: 'secret', difficulty: 'bronze', xpReward: 15, coinReward: 25, isSecret: true, createdAt: now },
      ])
      mockUserAchievement.findMany.mockResolvedValue([
        { achievementId: 'ach-s1', userId: 'user-1', unlockedAt: now },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/api/achievements',
        headers: { authorization: `Bearer ${token}` },
      })

      const body = res.json()
      expect(body[0].description).toBe('Play at 2 AM')
      expect(body[0].icon).toBe('🦉')
    })

    it('includes category, difficulty, and reward fields', async () => {
      const now = new Date()
      mockAchievement.findMany.mockResolvedValue([
        { id: 'ach-1', key: 'first_win', name: 'First Victory', description: 'Win', icon: '🏆', category: 'gameplay', difficulty: 'bronze', xpReward: 15, coinReward: 20, isSecret: false, createdAt: now },
      ])
      mockUserAchievement.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: '/api/achievements',
        headers: { authorization: `Bearer ${token}` },
      })

      const body = res.json()
      expect(body[0].category).toBe('gameplay')
      expect(body[0].difficulty).toBe('bronze')
      expect(body[0].xpReward).toBe(15)
      expect(body[0].coinReward).toBe(20)
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

  // ── GET /stats ──────────────────────────────────────────────────────────────

  describe('GET /api/achievements/stats', () => {
    it('returns achievement stats summary', async () => {
      mockAchievement.count.mockResolvedValue(75)
      mockUserAchievement.count.mockResolvedValue(10)
      mockAchievement.groupBy.mockResolvedValue([
        { difficulty: 'bronze', _count: 20 },
        { difficulty: 'silver', _count: 20 },
        { difficulty: 'gold', _count: 15 },
        { difficulty: 'platinum', _count: 12 },
        { difficulty: 'diamond', _count: 8 },
      ])
      mockUserAchievement.findMany.mockResolvedValue([
        { achievement: { difficulty: 'bronze' } },
        { achievement: { difficulty: 'bronze' } },
        { achievement: { difficulty: 'silver' } },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/api/achievements/stats',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(75)
      expect(body.unlocked).toBe(10)
      expect(body.percentage).toBe(13)
      expect(body.byDifficulty).toHaveLength(5)
    })

    it('returns 401 without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/achievements/stats' })
      expect(res.statusCode).toBe(401)
    })
  })
})
