import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'
import { shopRoutes } from '../../routes/shop'

const mockPrismaUser = prisma.user as any
const mockRedis = redis as any

const mockCosmetic = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
}
const mockUserCosmetic = {
  create: vi.fn(),
}
;(prisma as any).cosmetic = mockCosmetic
;(prisma as any).userCosmetic = mockUserCosmetic

describe('Shop Routes', () => {
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
    await app.register(shopRoutes, { prefix: '/api/shop' })
    await app.ready()

    token = app.jwt.sign({ sub: 'user-1', username: 'testuser' })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── GET /cosmetics ────────────────────────────────────────────────────────────

  describe('GET /api/shop/cosmetics', () => {
    it('returns cosmetics from DB and caches them', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.set.mockResolvedValue('OK')
      mockCosmetic.findMany.mockResolvedValue([
        { id: 'c1', name: 'Blue Hat', currency: 'star', price: 100, createdAt: new Date() },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/api/shop/cosmetics',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveLength(1)
      expect(body[0].name).toBe('Blue Hat')
      expect(mockRedis.set).toHaveBeenCalled()
    })

    it('returns cached cosmetics when available', async () => {
      const cached = [{ id: 'c2', name: 'Red Cape', currency: 'star', price: 200 }]
      mockRedis.get.mockResolvedValue(JSON.stringify(cached))

      const res = await app.inject({
        method: 'GET',
        url: '/api/shop/cosmetics',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()[0].name).toBe('Red Cape')
      expect(mockCosmetic.findMany).not.toHaveBeenCalled()
    })
  })

  // ── POST /cosmetics/:id/purchase ──────────────────────────────────────────────

  describe('POST /api/shop/cosmetics/:id/purchase', () => {
    it('purchases a cosmetic with sufficient star coins', async () => {
      mockCosmetic.findUnique.mockResolvedValue({ id: 'c1', name: 'Blue Hat', currency: 'star', price: 100 })
      mockPrismaUser.findUnique.mockResolvedValue({ id: 'user-1', starCoins: 500 })
      ;(prisma.$transaction as any).mockResolvedValue(undefined)

      const res = await app.inject({
        method: 'POST',
        url: '/api/shop/cosmetics/c1/purchase',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('returns 401 without auth token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/shop/cosmetics/c1/purchase',
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 404 when cosmetic does not exist', async () => {
      mockCosmetic.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/shop/cosmetics/nonexistent/purchase',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })

    it('returns 400 when user has insufficient funds', async () => {
      mockCosmetic.findUnique.mockResolvedValue({ id: 'c1', name: 'Blue Hat', currency: 'star', price: 500 })
      mockPrismaUser.findUnique.mockResolvedValue({ id: 'user-1', starCoins: 100 })

      const res = await app.inject({
        method: 'POST',
        url: '/api/shop/cosmetics/c1/purchase',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('Insufficient funds')
    })

    it('returns 400 for gold coin cosmetics (disabled)', async () => {
      mockCosmetic.findUnique.mockResolvedValue({ id: 'c2', name: 'Premium Cape', currency: 'gold', price: 50 })
      mockPrismaUser.findUnique.mockResolvedValue({ id: 'user-1', starCoins: 999, goldCoins: 999 })

      const res = await app.inject({
        method: 'POST',
        url: '/api/shop/cosmetics/c2/purchase',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/Gold coin/i)
    })
  })

  // ── Disabled premium routes ───────────────────────────────────────────────────

  describe('Disabled premium routes', () => {
    it('GET /api/shop/packs returns 503', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/shop/packs' })
      expect(res.statusCode).toBe(503)
    })

    it('POST /api/shop/packs/:id/checkout returns 503', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/shop/packs/some-pack/checkout' })
      expect(res.statusCode).toBe(503)
    })

    it('POST /api/shop/webhook returns 503', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/shop/webhook' })
      expect(res.statusCode).toBe(503)
      expect(res.json().error).toMatch(/temporarily disabled/i)
    })

    it('GET /api/shop/purchases returns 503', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/shop/purchases' })
      expect(res.statusCode).toBe(503)
      expect(res.json().error).toMatch(/temporarily unavailable/i)
    })
  })

  describe('POST /api/shop/cosmetics/:id/purchase - edge cases', () => {
    it('returns 404 when user is not found', async () => {
      mockCosmetic.findUnique.mockResolvedValue({ id: 'c1', name: 'Blue Hat', currency: 'star', price: 100 })
      mockPrismaUser.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/shop/cosmetics/c1/purchase',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json().error).toBe('User not found')
    })
  })
})
