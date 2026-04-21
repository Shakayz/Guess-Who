import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'
import { friendsRoutes } from '../../routes/friends'

const mockUser = prisma.user as any

// Add friendship model to the mock
const mockFriendship = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}
;(prisma as any).friendship = mockFriendship

describe('Friends Routes', () => {
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
    await app.register(friendsRoutes, { prefix: '/api/friends' })
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

  describe('GET /api/friends', () => {
    it('returns list of accepted friends', async () => {
      mockFriendship.findMany.mockResolvedValue([
        {
          id: 'fs-1',
          requesterId: 'user-1',
          addresseeId: 'user-2',
          status: 'accepted',
          requester: { id: 'user-1', username: 'testuser', avatarUrl: null },
          addressee: { id: 'user-2', username: 'alice', avatarUrl: null },
        },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/api/friends',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.friends).toHaveLength(1)
      expect(body.friends[0].user.username).toBe('alice')
    })

    it('returns 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/friends' })
      expect(res.statusCode).toBe(401)
    })
  })

  // ── GET /requests ─────────────────────────────────────────────────────────────

  describe('GET /api/friends/requests', () => {
    it('returns pending incoming requests', async () => {
      mockFriendship.findMany.mockResolvedValue([
        {
          id: 'fs-2',
          requesterId: 'user-3',
          addresseeId: 'user-1',
          status: 'pending',
          createdAt: new Date('2025-01-01'),
          requester: { id: 'user-3', username: 'bob', avatarUrl: null },
        },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/api/friends/requests',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.requests).toHaveLength(1)
      expect(body.requests[0].from.username).toBe('bob')
    })
  })

  // ── POST /request ─────────────────────────────────────────────────────────────

  describe('POST /api/friends/request', () => {
    it('sends a friend request', async () => {
      mockUser.findFirst.mockResolvedValue({ id: 'user-2', username: 'alice' })
      mockFriendship.findFirst.mockResolvedValue(null)
      mockFriendship.create.mockResolvedValue({ id: 'fs-3', status: 'pending' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/friends/request',
        headers: { authorization: `Bearer ${token}` },
        payload: { username: 'alice' },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json().friendship.status).toBe('pending')
    })

    it('returns 400 when username is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/friends/request',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 when target user does not exist', async () => {
      mockUser.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/friends/request',
        headers: { authorization: `Bearer ${token}` },
        payload: { username: 'ghost' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('returns 400 when already friends', async () => {
      mockUser.findFirst.mockResolvedValue({ id: 'user-2', username: 'alice' })
      mockFriendship.findFirst.mockResolvedValue({ id: 'fs-1', status: 'accepted' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/friends/request',
        headers: { authorization: `Bearer ${token}` },
        payload: { username: 'alice' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('Already friends')
    })

    it('returns 400 when request already pending', async () => {
      mockUser.findFirst.mockResolvedValue({ id: 'user-2', username: 'alice' })
      mockFriendship.findFirst.mockResolvedValue({ id: 'fs-1', status: 'pending' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/friends/request',
        headers: { authorization: `Bearer ${token}` },
        payload: { username: 'alice' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('Request already sent')
    })

    it('returns 400 when trying to add yourself', async () => {
      // The token is signed with sub='user-1', target also has id='user-1'
      mockUser.findFirst.mockResolvedValue({ id: 'user-1', username: 'testuser' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/friends/request',
        headers: { authorization: `Bearer ${token}` },
        payload: { username: 'testuser' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('Cannot add yourself')
    })

    it('sends socket notification when target is online', async () => {
      const mockEmit = vi.fn()
      const mockTo = vi.fn().mockReturnValue({ emit: mockEmit })
      const mockIo = { to: mockTo }

      // Attach mock io and onlineUsers to the app
      ;(app as any).io = mockIo
      ;(app as any).onlineUsers = new Map([['user-2', 'socket-id-2']])

      mockUser.findFirst.mockResolvedValue({ id: 'user-2', username: 'alice' }) // target lookup (by username, case-insensitive)
      mockUser.findUnique.mockResolvedValue({ username: 'testuser', avatarUrl: null }) // requester lookup (by id)
      mockFriendship.findFirst.mockResolvedValue(null)
      mockFriendship.create.mockResolvedValue({ id: 'fs-notify', status: 'pending' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/friends/request',
        headers: { authorization: `Bearer ${token}` },
        payload: { username: 'alice' },
      })

      // Cleanup
      ;(app as any).io = undefined
      ;(app as any).onlineUsers = undefined

      expect(res.statusCode).toBe(201)
      expect(mockTo).toHaveBeenCalledWith('socket-id-2')
      expect(mockEmit).toHaveBeenCalledWith('friend:request', expect.objectContaining({ friendshipId: 'fs-notify' }))
    })
  })

  // ── PUT /:id/accept ───────────────────────────────────────────────────────────

  describe('PUT /api/friends/:id/accept', () => {
    it('accepts a pending request', async () => {
      mockFriendship.findUnique.mockResolvedValue({
        id: 'fs-2',
        requesterId: 'user-3',
        addresseeId: 'user-1',
        status: 'pending',
      })
      mockFriendship.update.mockResolvedValue({ id: 'fs-2', status: 'accepted' })

      const res = await app.inject({
        method: 'PUT',
        url: '/api/friends/fs-2/accept',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().friendship.status).toBe('accepted')
    })

    it('returns 404 when friendship not found', async () => {
      mockFriendship.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'PUT',
        url: '/api/friends/nope/accept',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
    })

    it('returns 400 when request is not pending', async () => {
      mockFriendship.findUnique.mockResolvedValue({
        id: 'fs-1',
        requesterId: 'user-3',
        addresseeId: 'user-1',
        status: 'accepted',
      })

      const res = await app.inject({
        method: 'PUT',
        url: '/api/friends/fs-1/accept',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(400)
    })

    it('emits socket event when requester is online upon accept', async () => {
      const mockEmit = vi.fn()
      const mockTo = vi.fn().mockReturnValue({ emit: mockEmit })
      ;(app as any).io = { to: mockTo }
      ;(app as any).onlineUsers = new Map([['user-3', 'socket-id-3']])

      mockFriendship.findUnique.mockResolvedValue({
        id: 'fs-2',
        requesterId: 'user-3',
        addresseeId: 'user-1',
        status: 'pending',
      })
      mockFriendship.update.mockResolvedValue({ id: 'fs-2', status: 'accepted' })
      mockUser.findUnique.mockResolvedValue({ username: 'testuser' })

      const res = await app.inject({
        method: 'PUT',
        url: '/api/friends/fs-2/accept',
        headers: { authorization: `Bearer ${token}` },
      })

      ;(app as any).io = undefined
      ;(app as any).onlineUsers = undefined

      expect(res.statusCode).toBe(200)
      expect(mockTo).toHaveBeenCalledWith('socket-id-3')
      expect(mockEmit).toHaveBeenCalledWith('friend:accepted', expect.objectContaining({ friendshipId: 'fs-2' }))
    })
  })

  // ── DELETE /:id ───────────────────────────────────────────────────────────────

  describe('DELETE /api/friends/:id', () => {
    it('removes a friendship', async () => {
      mockFriendship.findUnique.mockResolvedValue({
        id: 'fs-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'accepted',
      })
      mockFriendship.delete.mockResolvedValue({ id: 'fs-1' })

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/friends/fs-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('returns 404 when friendship not found', async () => {
      mockFriendship.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/friends/nope',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
    })
  })
})
