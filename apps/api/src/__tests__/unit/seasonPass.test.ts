import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'
import { seasonPassRoutes } from '../../routes/seasonPass'

const mockPrismaUser = prisma.user as any

// Patch prisma mock with models used by season pass routes
const mockSeasonPass = {
  findFirst: vi.fn(),
}
const mockSeasonTier = {
  findUnique: vi.fn(),
}
const mockSeasonPassClaim = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
}
const mockUserCosmetic = {
  upsert: vi.fn(),
}
;(prisma as any).seasonPass = mockSeasonPass
;(prisma as any).seasonTier = mockSeasonTier
;(prisma as any).seasonPassClaim = mockSeasonPassClaim
;(prisma as any).userCosmetic = mockUserCosmetic

describe('Season Pass Routes', () => {
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
    await app.register(seasonPassRoutes, { prefix: '/api/season-pass' })
    await app.ready()

    token = app.jwt.sign({ sub: 'user-1', username: 'testuser' })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── GET /current ──────────────────────────────────────────────────────────────

  describe('GET /api/season-pass/current', () => {
    it('returns null when no active season exists', async () => {
      mockSeasonPass.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: '/api/season-pass/current',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toBeNull()
    })

    it('returns active season with user progress', async () => {
      const tierId = 'tier-1'
      mockSeasonPass.findFirst.mockResolvedValue({
        id: 'season-1',
        name: 'Summer 2025',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-08-31'),
        tiers: [
          { id: tierId, tierNumber: 1, xpRequired: 0, rewardType: 'starCoins', rewardValue: '100' },
          { id: 'tier-2', tierNumber: 2, xpRequired: 500, rewardType: 'starCoins', rewardValue: '200' },
        ],
      })
      mockPrismaUser.findUnique.mockResolvedValue({ seasonXp: 250 })
      mockSeasonPassClaim.findMany.mockResolvedValue([{ seasonTierId: tierId }])

      const res = await app.inject({
        method: 'GET',
        url: '/api/season-pass/current',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.id).toBe('season-1')
      expect(body.userXp).toBe(250)

      const tier1 = body.tiers.find((t: any) => t.id === tierId)
      expect(tier1.claimed).toBe(true)
      expect(tier1.unlocked).toBe(true)

      const tier2 = body.tiers.find((t: any) => t.id === 'tier-2')
      expect(tier2.claimed).toBe(false)
      expect(tier2.unlocked).toBe(false) // needs 500 XP, user has 250
    })

    it('returns 401 without auth token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/season-pass/current' })
      expect(res.statusCode).toBe(401)
    })
  })

  // ── POST /claim/:tierId ───────────────────────────────────────────────────────

  describe('POST /api/season-pass/claim/:tierId', () => {
    const now = new Date()
    const activeTier = {
      id: 'tier-1',
      tierNumber: 1,
      xpRequired: 100,
      rewardType: 'starCoins',
      rewardValue: '200',
      seasonPass: {
        id: 'season-1',
        startDate: new Date(now.getTime() - 86400000), // yesterday
        endDate: new Date(now.getTime() + 86400000),   // tomorrow
      },
    }

    it('claims a tier reward successfully', async () => {
      mockSeasonTier.findUnique.mockResolvedValue(activeTier)
      mockPrismaUser.findUnique.mockResolvedValue({ seasonXp: 500, goldCoins: 0 })
      mockSeasonPassClaim.findUnique.mockResolvedValue(null)
      ;(prisma.$transaction as any).mockImplementation(async (fn: any) => fn({
        seasonPassClaim: { create: vi.fn().mockResolvedValue({}) },
        user: { update: vi.fn().mockResolvedValue({}) },
      }))

      const res = await app.inject({
        method: 'POST',
        url: '/api/season-pass/claim/tier-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
      expect(res.json().rewardType).toBe('starCoins')
    })

    it('returns 404 when tier does not exist', async () => {
      mockSeasonTier.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/season-pass/claim/nonexistent',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })

    it('returns 400 when season is not active', async () => {
      mockSeasonTier.findUnique.mockResolvedValue({
        ...activeTier,
        seasonPass: {
          id: 'season-old',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-03-31'),
        },
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/season-pass/claim/tier-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('Season is not active')
    })

    it('returns 400 when user lacks required XP', async () => {
      mockSeasonTier.findUnique.mockResolvedValue(activeTier)
      mockPrismaUser.findUnique.mockResolvedValue({ seasonXp: 10, goldCoins: 0 })

      const res = await app.inject({
        method: 'POST',
        url: '/api/season-pass/claim/tier-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('Not enough season XP')
    })

    it('returns 409 when tier is already claimed', async () => {
      mockSeasonTier.findUnique.mockResolvedValue(activeTier)
      mockPrismaUser.findUnique.mockResolvedValue({ seasonXp: 500, goldCoins: 0 })
      mockSeasonPassClaim.findUnique.mockResolvedValue({ userId: 'user-1', seasonTierId: 'tier-1' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/season-pass/claim/tier-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(409)
      expect(res.json().error).toBe('Already claimed')
    })

    it('returns 401 without auth token', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/season-pass/claim/tier-1' })
      expect(res.statusCode).toBe(401)
    })

    it('returns 404 when user is not found during claim', async () => {
      mockSeasonTier.findUnique.mockResolvedValue(activeTier)
      mockPrismaUser.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/season-pass/claim/tier-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json().error).toBe('User not found')
    })

    it('claims a goldCoins reward (goldCoins branch is skipped but no error)', async () => {
      const goldTier = {
        ...activeTier,
        rewardType: 'goldCoins',
        rewardValue: '50',
      }
      mockSeasonTier.findUnique.mockResolvedValue(goldTier)
      mockPrismaUser.findUnique.mockResolvedValue({ seasonXp: 500, goldCoins: 0 })
      mockSeasonPassClaim.findUnique.mockResolvedValue(null)
      ;(prisma.$transaction as any).mockImplementation(async (fn: any) => fn({
        seasonPassClaim: { create: vi.fn().mockResolvedValue({}) },
        user: { update: vi.fn().mockResolvedValue({}) },
      }))

      const res = await app.inject({
        method: 'POST',
        url: '/api/season-pass/claim/tier-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().rewardType).toBe('goldCoins')
    })

    it('claims a cosmetic reward (upserts userCosmetic)', async () => {
      const cosmeticTier = {
        ...activeTier,
        rewardType: 'cosmetic',
        rewardValue: 'hat-cosmetic-123',
      }
      mockSeasonTier.findUnique.mockResolvedValue(cosmeticTier)
      mockPrismaUser.findUnique.mockResolvedValue({ seasonXp: 500, goldCoins: 0 })
      mockSeasonPassClaim.findUnique.mockResolvedValue(null)
      const mockUpsert = vi.fn().mockResolvedValue({})
      ;(prisma.$transaction as any).mockImplementation(async (fn: any) => fn({
        seasonPassClaim: { create: vi.fn().mockResolvedValue({}) },
        user: { update: vi.fn().mockResolvedValue({}) },
        userCosmetic: { upsert: mockUpsert },
      }))

      const res = await app.inject({
        method: 'POST',
        url: '/api/season-pass/claim/tier-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().rewardType).toBe('cosmetic')
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ cosmeticId: 'hat-cosmetic-123' }),
      }))
    })
  })
})
