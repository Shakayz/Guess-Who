import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { Server as SocketServer } from 'socket.io'
import { env } from './config/env'
import { authRoutes } from './routes/auth'
import { oauthRoutes } from './routes/oauth'
import { roomRoutes } from './routes/rooms'
import { userRoutes } from './routes/users'
import { shopRoutes } from './routes/shop'
import { registerSocketHandlers } from './socket'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  // Plugins
  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(','),
    credentials: true,
  })
  await app.register(jwt, { secret: env.JWT_SECRET })
  await app.register(cookie)
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

  // Decorate authenticate helper used by protected routes
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(oauthRoutes, { prefix: '/api/auth' })
  await app.register(roomRoutes, { prefix: '/api/rooms' })
  await app.register(userRoutes, { prefix: '/api/users' })
  await app.register(shopRoutes, { prefix: '/api/shop' })

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // Socket.IO
  const io = new SocketServer(app.server, {
    cors: { origin: env.ALLOWED_ORIGINS.split(','), credentials: true },
    transports: ['websocket', 'polling'],
  })
  registerSocketHandlers(io)

  return app
}
