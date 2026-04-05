import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'
import { messagesRoutes } from '../../routes/messages'

// Patch prisma mock with models used by messages routes
const mockDirectMessage = {
  findMany: vi.fn(),
  updateMany: vi.fn(),
}
;(prisma as any).directMessage = mockDirectMessage

describe('Messages Routes', () => {
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
    await app.register(messagesRoutes, { prefix: '/api/messages' })
    await app.ready()

    token = app.jwt.sign({ sub: 'user-1', username: 'testuser' })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── GET /:friendId ─────────────────────────────────────────────────────────────

  describe('GET /api/messages/:friendId', () => {
    it('returns last 50 messages with a friend and marks them as read', async () => {
      mockDirectMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          senderId: 'user-2',
          receiverId: 'user-1',
          content: 'Hey!',
          read: false,
          createdAt: new Date('2025-06-01T10:00:00Z'),
        },
        {
          id: 'msg-2',
          senderId: 'user-1',
          receiverId: 'user-2',
          content: 'Hello!',
          read: true,
          createdAt: new Date('2025-06-01T10:01:00Z'),
        },
      ])
      mockDirectMessage.updateMany.mockResolvedValue({ count: 1 })

      const res = await app.inject({
        method: 'GET',
        url: '/api/messages/user-2',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.messages).toHaveLength(2)
      expect(body.messages[0].content).toBe('Hey!')
      // should mark received messages as read
      expect(mockDirectMessage.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ senderId: 'user-2', receiverId: 'user-1', read: false }),
          data: { read: true },
        })
      )
    })

    it('returns empty messages array when no conversation exists', async () => {
      mockDirectMessage.findMany.mockResolvedValue([])
      mockDirectMessage.updateMany.mockResolvedValue({ count: 0 })

      const res = await app.inject({
        method: 'GET',
        url: '/api/messages/user-3',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().messages).toHaveLength(0)
    })

    it('returns 401 without auth token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/messages/user-2',
      })

      expect(res.statusCode).toBe(401)
    })

    it('queries messages between the two users bidirectionally', async () => {
      mockDirectMessage.findMany.mockResolvedValue([])
      mockDirectMessage.updateMany.mockResolvedValue({ count: 0 })

      await app.inject({
        method: 'GET',
        url: '/api/messages/friend-42',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(mockDirectMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ senderId: 'user-1', receiverId: 'friend-42' }),
              expect.objectContaining({ senderId: 'friend-42', receiverId: 'user-1' }),
            ]),
          }),
          take: 50,
        })
      )
    })
  })
})
