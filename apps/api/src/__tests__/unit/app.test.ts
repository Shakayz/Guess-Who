import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Mock socket.io before importing app
vi.mock('socket.io', () => ({
  Server: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    use: vi.fn(),
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  })),
}))

// Mock all route plugins to isolate app builder tests
vi.mock('../../routes/auth', () => ({ authRoutes: async () => {} }))
vi.mock('../../routes/oauth', () => ({ oauthRoutes: async () => {} }))
vi.mock('../../routes/rooms', () => ({ roomRoutes: async () => {} }))
vi.mock('../../routes/users', () => ({ userRoutes: async () => {} }))
vi.mock('../../routes/shop', () => ({ shopRoutes: async () => {} }))
vi.mock('../../routes/friends', () => ({ friendsRoutes: async () => {} }))
vi.mock('../../routes/history', () => ({ historyRoutes: async () => {} }))
vi.mock('../../routes/messages', () => ({ messagesRoutes: async () => {} }))
vi.mock('../../routes/achievements', () => ({ achievementRoutes: async () => {} }))
vi.mock('../../routes/seasonPass', () => ({ seasonPassRoutes: async () => {} }))
vi.mock('../../routes/gifts', () => ({ giftsRoutes: async () => {} }))
vi.mock('../../routes/wordPacks', () => ({ wordPacksRoutes: async () => {} }))
vi.mock('../../socket', () => ({ registerSocketHandlers: vi.fn() }))

import { buildApp } from '../../app'

describe('App Builder', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('builds the app successfully', () => {
    expect(app).toBeDefined()
    expect(app.server).toBeDefined()
  })

  it('health check returns status ok with timestamp', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
    expect(typeof body.timestamp).toBe('string')
    // Verify it is a valid ISO timestamp
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
  })

  it('returns 404 for unknown routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/nonexistent-route',
    })

    expect(response.statusCode).toBe(404)
  })

  it('includes CORS headers in responses', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'http://localhost:3000',
      },
    })

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })
})
