import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { shopRoutes } from '../../routes/shop'
import { COIN_PACKS } from '@red-handed/shared'

// Shop now wires real Stripe Checkout. These tests exercise the routes that
// don't require Stripe credentials — the pack catalogue (public) and the 503
// fallback that guards the checkout path when STRIPE_SECRET_KEY is unset, which
// is the safe default for test/CI environments.

describe('Shop Routes', () => {
  let app: FastifyInstance

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
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /api/shop/packs', () => {
    it('returns the full pack catalogue (public, no auth required)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/shop/packs' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.packs).toHaveLength(COIN_PACKS.length)
      // The response intentionally strips Stripe price IDs — clients only need
      // display data, not billing identifiers.
      for (const pack of body.packs) {
        expect(pack).not.toHaveProperty('stripePriceId')
        expect(pack).toEqual(expect.objectContaining({
          id: expect.any(String),
          amount: expect.any(Number),
          priceCents: expect.any(Number),
          currency: expect.any(String),
          bonus: expect.any(Number),
        }))
      }
    })
  })

  describe('POST /api/shop/packs/:id/checkout', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/shop/packs/pack_500/checkout' })
      expect(res.statusCode).toBe(401)
    })

    it('returns 503 when Stripe is not configured', async () => {
      const token = app.jwt.sign({ sub: 'user-123' })
      const res = await app.inject({
        method: 'POST',
        url: '/api/shop/packs/pack_500/checkout',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(503)
      expect(res.json().error).toMatch(/not configured/i)
    })
  })

  describe('POST /api/shop/webhook', () => {
    it('returns 503 when Stripe is not configured', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/shop/webhook' })
      expect(res.statusCode).toBe(503)
    })
  })

  describe('GET /api/shop/purchases', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/shop/purchases' })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('Removed cosmetics routes', () => {
    it('GET /api/shop/cosmetics returns 404', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/shop/cosmetics' })
      expect(res.statusCode).toBe(404)
    })

    it('POST /api/shop/cosmetics/:id/purchase returns 404', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/shop/cosmetics/c1/purchase' })
      expect(res.statusCode).toBe(404)
    })
  })
})
