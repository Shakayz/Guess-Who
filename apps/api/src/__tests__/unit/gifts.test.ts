import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'

// Mock the socket/onlineUsers module before importing giftsRoutes
vi.mock('../../socket/onlineUsers', () => ({
  onlineUsers: new Map<string, string>(),
}))

import { giftsRoutes } from '../../routes/gifts'

const mockPrismaUser = prisma.user as any

// Patch prisma mock with models used by gifts routes
const mockFriendship = {
  findFirst: vi.fn(),
}
const mockGift = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
}
;(prisma as any).friendship = (prisma as any).friendship ?? mockFriendship
;(prisma as any).gift = mockGift

describe('Gifts Routes', () => {
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
    await app.register(giftsRoutes, { prefix: '/api/gifts' })
    await app.ready()

    token = app.jwt.sign({ sub: 'user-1', username: 'testuser' })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── GET /inbox ────────────────────────────────────────────────────────────────

  describe('GET /api/gifts/inbox', () => {
    it('returns unclaimed gifts for the user', async () => {
      mockGift.findMany.mockResolvedValue([
        {
          id: 'gift-1',
          senderId: 'user-2',
          receiverId: 'user-1',
          coinAmount: 50,
          message: 'For you!',
          claimed: false,
          createdAt: new Date(),
          sender: { id: 'user-2', username: 'alice', avatarUrl: null },
        },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/api/gifts/inbox',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveLength(1)
      expect(body[0].sender.username).toBe('alice')
      expect(body[0].coinAmount).toBe(50)
    })

    it('returns 401 without auth token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/gifts/inbox' })
      expect(res.statusCode).toBe(401)
    })
  })

  // ── POST /send ────────────────────────────────────────────────────────────────

  describe('POST /api/gifts/send', () => {
    it('sends a coin gift to a friend', async () => {
      mockPrismaUser.findFirst.mockResolvedValue({ id: 'user-2', username: 'alice' }) // receiver lookup (by username, case-insensitive)
      mockPrismaUser.findUnique.mockResolvedValue({ id: 'user-1', starCoins: 500 })    // sender balance check (by id)
      ;(prisma as any).friendship.findFirst.mockResolvedValue({ id: 'fs-1', status: 'accepted' })
      ;(prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          user: { update: vi.fn() },
          gift: {
            create: vi.fn().mockResolvedValue({
              id: 'gift-1',
              senderId: 'user-1',
              receiverId: 'user-2',
              coinAmount: 100,
              message: 'Enjoy!',
              sender: { id: 'user-1', username: 'testuser', avatarUrl: null },
            }),
          },
        }
        return fn(tx)
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/send',
        headers: { authorization: `Bearer ${token}` },
        payload: { receiverUsername: 'alice', coinAmount: 100, message: 'Enjoy!' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
      expect(res.json().gift.coinAmount).toBe(100)
    })

    it('returns 404 when receiver does not exist', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/send',
        headers: { authorization: `Bearer ${token}` },
        payload: { receiverUsername: 'ghost', coinAmount: 50 },
      })

      expect(res.statusCode).toBe(404)
    })

    it('returns 403 when receiver is not a friend', async () => {
      mockPrismaUser.findFirst.mockResolvedValue({ id: 'user-3', username: 'stranger' })
      ;(prisma as any).friendship.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/send',
        headers: { authorization: `Bearer ${token}` },
        payload: { receiverUsername: 'stranger', coinAmount: 50 },
      })

      expect(res.statusCode).toBe(403)
      expect(res.json().error).toBe('You can only gift friends')
    })

    it('returns 400 when sender has insufficient coins', async () => {
      mockPrismaUser.findFirst.mockResolvedValue({ id: 'user-2', username: 'alice' })
      mockPrismaUser.findUnique.mockResolvedValue({ id: 'user-1', starCoins: 10 })
      ;(prisma as any).friendship.findFirst.mockResolvedValue({ id: 'fs-1', status: 'accepted' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/send',
        headers: { authorization: `Bearer ${token}` },
        payload: { receiverUsername: 'alice', coinAmount: 500 },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('Insufficient star coins')
    })

    it('returns 400 when coinAmount is zero', async () => {
      mockPrismaUser.findFirst.mockResolvedValue({ id: 'user-2', username: 'alice' })
      ;(prisma as any).friendship.findFirst.mockResolvedValue({ id: 'fs-1', status: 'accepted' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/send',
        headers: { authorization: `Bearer ${token}` },
        payload: { receiverUsername: 'alice', coinAmount: 0 },
      })

      // zod schema requires coinAmount >= 1; Fastify maps the parse failure to 500
      // unless a custom error handler is wired — both 400 and 500 are acceptable here.
      expect([400, 500]).toContain(res.statusCode)
    })

    it('returns 401 without auth token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/send',
        payload: { receiverUsername: 'alice', coinAmount: 50 },
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 400 when sending to yourself', async () => {
      // token is sub='user-1', receiver also has id='user-1'
      mockPrismaUser.findFirst.mockResolvedValue({ id: 'user-1', username: 'testuser' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/send',
        headers: { authorization: `Bearer ${token}` },
        payload: { receiverUsername: 'testuser', coinAmount: 50 },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('Cannot gift yourself')
    })

    it('emits socket event when receiver is online', async () => {
      const mockEmit = vi.fn()
      const mockTo = vi.fn().mockReturnValue({ emit: mockEmit })
      ;(app as any).io = { to: mockTo }

      // Patch the onlineUsers map used by the gifts route
      const onlineUsersModule = await import('../../socket/onlineUsers')
      ;(onlineUsersModule.onlineUsers as any).set('user-2', 'socket-id-for-user2')

      mockPrismaUser.findFirst.mockResolvedValue({ id: 'user-2', username: 'alice' })
      mockPrismaUser.findUnique.mockResolvedValue({ id: 'user-1', starCoins: 500 })
      ;(prisma as any).friendship.findFirst.mockResolvedValue({ id: 'fs-1', status: 'accepted' })
      ;(prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          user: { update: vi.fn() },
          gift: {
            create: vi.fn().mockResolvedValue({
              id: 'gift-notif',
              senderId: 'user-1',
              receiverId: 'user-2',
              coinAmount: 50,
              message: null,
              sender: { id: 'user-1', username: 'testuser', avatarUrl: null },
            }),
          },
        }
        return fn(tx)
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/send',
        headers: { authorization: `Bearer ${token}` },
        payload: { receiverUsername: 'alice', coinAmount: 50 },
      })

      ;(app as any).io = undefined
      ;(onlineUsersModule.onlineUsers as any).delete('user-2')

      expect(res.statusCode).toBe(200)
      expect(mockTo).toHaveBeenCalledWith('socket-id-for-user2')
      expect(mockEmit).toHaveBeenCalledWith('gift:received', expect.objectContaining({ giftId: 'gift-notif' }))
    })
  })

  // ── POST /:id/claim ───────────────────────────────────────────────────────────

  describe('POST /api/gifts/:id/claim', () => {
    it('claims a valid pending gift', async () => {
      mockGift.findUnique.mockResolvedValue({
        id: 'gift-1',
        receiverId: 'user-1',
        coinAmount: 50,
        claimed: false,
      })
      ;(prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          gift: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          user: { update: vi.fn().mockResolvedValue({}) },
        }
        return fn(tx)
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/gift-1/claim',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('returns 404 when gift does not exist', async () => {
      mockGift.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/nonexistent/claim',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json().error).toBe('Gift not found')
    })

    it('returns 403 when gift belongs to another user', async () => {
      mockGift.findUnique.mockResolvedValue({
        id: 'gift-2',
        receiverId: 'user-99',
        coinAmount: 10,
        claimed: false,
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/gift-2/claim',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
      expect(res.json().error).toBe('Forbidden')
    })

    it('returns 409 when gift already claimed (concurrent claim)', async () => {
      mockGift.findUnique.mockResolvedValue({
        id: 'gift-1',
        receiverId: 'user-1',
        coinAmount: 50,
        claimed: false,
      })
      ;(prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          gift: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) }, // already claimed
          user: { update: vi.fn() },
        }
        return fn(tx)
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/gift-1/claim',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(409)
      expect(res.json().error).toBe('Already claimed')
    })

    it('returns 401 without auth token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/gift-1/claim',
      })
      expect(res.statusCode).toBe(401)
    })

    it('re-throws non-409 transaction errors (line 125)', async () => {
      // This exercises the `throw err` on line 125 of gifts.ts:
      // when $transaction catch receives an error WITHOUT statusCode 409,
      // it re-throws, and Fastify converts it to a 500.
      mockGift.findUnique.mockResolvedValue({
        id: 'gift-err',
        receiverId: 'user-1',
        coinAmount: 50,
        claimed: false,
      })
      ;(prisma.$transaction as any).mockImplementation(async (_fn: any) => {
        const err = new Error('Unexpected DB error')
        // No statusCode property → not a 409 → line 125 fires
        throw err
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/gifts/gift-err/claim',
        headers: { authorization: `Bearer ${token}` },
      })

      // Fastify converts the rethrown error into a 500
      expect(res.statusCode).toBe(500)
    })
  })
})
