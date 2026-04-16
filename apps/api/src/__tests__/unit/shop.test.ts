import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { shopRoutes } from '../../routes/shop'

// Cosmetics were removed from the game design — the active /cosmetics
// catalog and purchase endpoints are gone. Only the disabled premium
// stubs remain on the shop router, and the cosmetics path should now 404.

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
