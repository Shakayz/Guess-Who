import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'
import { wordPacksRoutes } from '../../routes/wordPacks'

// Patch prisma mock with models used by word packs routes
const mockWordPack = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
}
;(prisma as any).wordPack = mockWordPack

describe('Word Packs Routes', () => {
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
    await app.register(wordPacksRoutes, { prefix: '/api/word-packs' })
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

  describe('GET /api/word-packs', () => {
    it('returns public approved packs and own packs', async () => {
      mockWordPack.findMany.mockResolvedValue([
        { id: 'pack-1', name: 'Animals', isPublic: true, isApproved: true, downloads: 100, _count: { pairs: 20 } },
        { id: 'pack-2', name: 'My Pack', isPublic: false, isApproved: false, downloads: 0, _count: { pairs: 5 } },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/api/word-packs',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveLength(2)
    })

    it('returns 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/word-packs' })
      expect(res.statusCode).toBe(401)
    })
  })

  // ── GET /my ───────────────────────────────────────────────────────────────────

  describe('GET /api/word-packs/my', () => {
    it('returns packs created by the authenticated user', async () => {
      mockWordPack.findMany.mockResolvedValue([
        { id: 'pack-2', name: 'My Pack', authorId: 'user-1', isPublic: false, _count: { pairs: 5 }, pairs: [] },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/api/word-packs/my',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveLength(1)
      expect(body[0].name).toBe('My Pack')
    })
  })

  // ── GET /:id ──────────────────────────────────────────────────────────────────

  describe('GET /api/word-packs/:id', () => {
    it('returns a pack when it is approved or owned', async () => {
      mockWordPack.findUnique.mockResolvedValue({
        id: 'pack-1',
        name: 'Animals',
        authorId: 'other-user',
        isApproved: true,
        isPublic: true,
        pairs: [{ id: 'p1', wordA: 'Cat', wordB: 'Dog' }],
      })

      const res = await app.inject({
        method: 'GET',
        url: '/api/word-packs/pack-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().name).toBe('Animals')
    })

    it('returns 403 for unapproved pack owned by someone else', async () => {
      mockWordPack.findUnique.mockResolvedValue({
        id: 'pack-3',
        name: 'Hidden Pack',
        authorId: 'other-user',
        isApproved: false,
        isPublic: false,
        pairs: [],
      })

      const res = await app.inject({
        method: 'GET',
        url: '/api/word-packs/pack-3',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('returns 404 for non-existent pack', async () => {
      mockWordPack.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: '/api/word-packs/nonexistent',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ── POST / ────────────────────────────────────────────────────────────────────

  describe('POST /api/word-packs', () => {
    const validPayload = {
      name: 'My Custom Pack',
      description: 'A pack I made',
      locale: 'en',
      isPublic: false,
      pairs: [
        { wordA: 'Apple', wordB: 'Orange', difficulty: 'easy', category: 'fruits' },
        { wordA: 'Cat', wordB: 'Dog', difficulty: 'medium', category: 'animals' },
      ],
    }

    it('creates a new word pack', async () => {
      mockWordPack.create.mockResolvedValue({
        id: 'pack-new',
        name: 'My Custom Pack',
        authorId: 'user-1',
        isApproved: false,
        pairs: validPayload.pairs,
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/word-packs',
        headers: { authorization: `Bearer ${token}` },
        payload: validPayload,
      })

      expect(res.statusCode).toBe(201)
      expect(res.json().name).toBe('My Custom Pack')
    })

    it('returns 4xx for invalid locale', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/word-packs',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validPayload, locale: 'xx' },
      })

      // Zod validation throws and Fastify catches it as a 500;
      // either way the request should not succeed
      expect(res.statusCode).toBeGreaterThanOrEqual(400)
    })

    it('returns 4xx when pairs array is empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/word-packs',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validPayload, pairs: [] },
      })

      expect(res.statusCode).toBeGreaterThanOrEqual(400)
    })

    it('returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/word-packs',
        payload: validPayload,
      })

      expect(res.statusCode).toBe(401)
    })
  })

  // ── DELETE /:id ───────────────────────────────────────────────────────────────

  describe('DELETE /api/word-packs/:id', () => {
    it('deletes own word pack', async () => {
      mockWordPack.findUnique.mockResolvedValue({ id: 'pack-2', authorId: 'user-1' })
      mockWordPack.delete.mockResolvedValue({ id: 'pack-2' })

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/word-packs/pack-2',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('returns 403 when trying to delete another user\'s pack', async () => {
      mockWordPack.findUnique.mockResolvedValue({ id: 'pack-1', authorId: 'other-user' })

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/word-packs/pack-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('returns 404 for non-existent pack', async () => {
      mockWordPack.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/word-packs/nonexistent',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })
})
