import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'
import { tutorialRoutes, TUTORIAL_COMPLETION_REWARD } from '../../routes/tutorial'

const mockPrismaUser = prisma.user as any

describe('Tutorial Routes', () => {
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
    await app.register(tutorialRoutes, { prefix: '/api/tutorial' })
    await app.ready()

    token = app.jwt.sign({ sub: 'user-1', username: 'testuser' })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── GET /api/tutorial/status ────────────────────────────────────────────────

  describe('GET /api/tutorial/status', () => {
    it('returns completed=false and the reward amount for a new user', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({ tutorialCompleted: false })

      const res = await app.inject({
        method: 'GET',
        url: '/api/tutorial/status',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ completed: false, reward: TUTORIAL_COMPLETION_REWARD })
    })

    it('returns completed=true once the user has finished the tutorial', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({ tutorialCompleted: true })

      const res = await app.inject({
        method: 'GET',
        url: '/api/tutorial/status',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().completed).toBe(true)
    })

    it('returns 401 without an auth token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tutorial/status' })
      expect(res.statusCode).toBe(401)
    })

    it('returns 404 if the user does not exist', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: '/api/tutorial/status',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ── POST /api/tutorial/complete ─────────────────────────────────────────────

  describe('POST /api/tutorial/complete', () => {
    it('grants 50 star coins the first time the tutorial is completed', async () => {
      // updateMany flips the flag atomically; count===1 means we just credited.
      mockPrismaUser.updateMany.mockResolvedValue({ count: 1 })
      mockPrismaUser.findUnique.mockResolvedValue({ starCoins: 150 })

      const res = await app.inject({
        method: 'POST',
        url: '/api/tutorial/complete',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(true)
      expect(body.alreadyCompleted).toBe(false)
      expect(body.reward).toBe(TUTORIAL_COMPLETION_REWARD)
      expect(body.starCoins).toBe(150)

      // Critical: the update MUST flip the flag AND increment coins atomically
      // using the `tutorialCompleted: false` guard so concurrent requests
      // can't double-grant the reward. We use updateMany (not update) so a
      // no-op returns { count: 0 } instead of throwing P2025 on a retry.
      expect(mockPrismaUser.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1', tutorialCompleted: false },
          data: expect.objectContaining({
            tutorialCompleted: true,
            starCoins: { increment: TUTORIAL_COMPLETION_REWARD },
          }),
        }),
      )
    })

    it('does not re-grant coins if the tutorial was already completed', async () => {
      // count===0 means the guard rejected the update (flag already true)
      mockPrismaUser.updateMany.mockResolvedValue({ count: 0 })
      mockPrismaUser.findUnique.mockResolvedValue({ starCoins: 200 })

      const res = await app.inject({
        method: 'POST',
        url: '/api/tutorial/complete',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(true)
      expect(body.alreadyCompleted).toBe(true)
      expect(body.reward).toBe(0)
      expect(body.starCoins).toBe(200)
    })

    it('returns a clean alreadyCompleted=true on a retry after a prior success (no P2025)', async () => {
      // Regression: the old code used prisma.user.update with a non-unique
      // where guard, which threw P2025 when the flag had already been
      // flipped by a concurrent call — surfacing as a 500 ("Impossible de
      // créditer votre récompense pour le moment — réessayez") to the user.
      // With updateMany we just get count:0 and report alreadyCompleted.
      mockPrismaUser.updateMany.mockResolvedValue({ count: 0 })
      mockPrismaUser.findUnique.mockResolvedValue({ starCoins: 150 })

      const res = await app.inject({
        method: 'POST',
        url: '/api/tutorial/complete',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({
        success: true,
        alreadyCompleted: true,
        reward: 0,
        starCoins: 150,
      })
    })

    it('returns 401 without an auth token', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/tutorial/complete' })
      expect(res.statusCode).toBe(401)
    })

    it('returns 404 if the user does not exist', async () => {
      mockPrismaUser.updateMany.mockResolvedValue({ count: 0 })
      mockPrismaUser.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/tutorial/complete',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })
})
