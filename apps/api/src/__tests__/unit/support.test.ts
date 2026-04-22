/**
 * support.test.ts
 *
 * Tests for src/routes/support.ts — the /api/support/contact route that
 * forwards a logged-in user's message to the support inbox.
 *
 * We mount the route on a bare Fastify instance (same pattern as shop.test.ts
 * and oauth.test.ts), stub the `authenticate` decorator, mock Prisma via the
 * setup file, and mock the email service directly.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import { prisma } from '../../config/prisma'

// The route imports sendSupportMessage from services/email. We mock that so
// the test never reaches the real SMTP / Resend code path. The mock has to be
// in place BEFORE the route module is imported, so we use vi.mock at top level.
const sendSupportMessageMock = vi.fn()
vi.mock('../../services/email', () => ({
  sendSupportMessage: (...args: unknown[]) => sendSupportMessageMock(...args),
}))

import { supportRoutes } from '../../routes/support'

const mockPrisma = prisma as any

describe('Support Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(jwt, { secret: 'test-secret-key-that-is-at-least-32-chars-long' })
    app.decorate('authenticate', async function (request: any, reply: any) {
      try {
        await request.jwtVerify()
      } catch {
        reply.status(401).send({ error: 'Unauthorized' })
      }
    })
    await app.register(supportRoutes, { prefix: '/api/support' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    sendSupportMessageMock.mockReset()
  })

  describe('POST /api/support/contact', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/support/contact',
        payload: { subject: 'help', message: 'please help me' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('400s on a short subject', async () => {
      const token = app.jwt.sign({ sub: 'u1' })
      const res = await app.inject({
        method: 'POST',
        url: '/api/support/contact',
        headers: { authorization: `Bearer ${token}` },
        payload: { subject: 'hi', message: 'a detailed message here' },
      })
      expect(res.statusCode).toBe(400)
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('400s on a short message', async () => {
      const token = app.jwt.sign({ sub: 'u1' })
      const res = await app.inject({
        method: 'POST',
        url: '/api/support/contact',
        headers: { authorization: `Bearer ${token}` },
        payload: { subject: 'Help me', message: 'too short' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('400s when the user has no email on file', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ email: null, username: 'jo' })
      const token = app.jwt.sign({ sub: 'u1' })
      const res = await app.inject({
        method: 'POST',
        url: '/api/support/contact',
        headers: { authorization: `Bearer ${token}` },
        payload: { subject: 'Need help', message: 'I have a real question.' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/email missing/i)
      expect(sendSupportMessageMock).not.toHaveBeenCalled()
    })

    it('forwards a valid message to sendSupportMessage with the user context', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: 'player@example.com',
        username: 'player42',
      })
      sendSupportMessageMock.mockResolvedValueOnce(undefined)

      const token = app.jwt.sign({ sub: 'u1' })
      const res = await app.inject({
        method: 'POST',
        url: '/api/support/contact',
        headers: { authorization: `Bearer ${token}` },
        payload: { subject: 'Stuck in a game', message: 'I cannot leave the lobby.' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ success: true })
      expect(sendSupportMessageMock).toHaveBeenCalledWith({
        fromEmail: 'player@example.com',
        username: 'player42',
        userId: 'u1',
        subject: 'Stuck in a game',
        message: 'I cannot leave the lobby.',
      })
    })

    it('502s when the email provider fails — message was not delivered', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: 'player@example.com',
        username: 'player',
      })
      sendSupportMessageMock.mockRejectedValueOnce(new Error('smtp down'))

      const token = app.jwt.sign({ sub: 'u1' })
      const res = await app.inject({
        method: 'POST',
        url: '/api/support/contact',
        headers: { authorization: `Bearer ${token}` },
        payload: { subject: 'A subject', message: 'A long enough message body.' },
      })

      expect(res.statusCode).toBe(502)
      expect(res.json().error).toMatch(/Could not deliver/i)
    })

    it('trims whitespace from subject and message before validation', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: 'p@e.com',
        username: 'p',
      })
      sendSupportMessageMock.mockResolvedValueOnce(undefined)

      const token = app.jwt.sign({ sub: 'u1' })
      const res = await app.inject({
        method: 'POST',
        url: '/api/support/contact',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          subject: '   Real subject   ',
          message: '   Plenty of body text here   ',
        },
      })

      expect(res.statusCode).toBe(200)
      const call = sendSupportMessageMock.mock.calls[0][0]
      expect(call.subject).toBe('Real subject')
      expect(call.message).toBe('Plenty of body text here')
    })
  })
})
