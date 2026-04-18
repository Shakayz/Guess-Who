import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import { Server as SocketServer } from 'socket.io'
import { env } from './config/env'
import { rootLogger, getLogFilePath } from './config/logger'
import { authRoutes } from './routes/auth'
import { oauthRoutes } from './routes/oauth'
import { roomRoutes } from './routes/rooms'
import { userRoutes } from './routes/users'
import { shopRoutes } from './routes/shop'
import { friendsRoutes } from './routes/friends'
import { historyRoutes } from './routes/history'
import { messagesRoutes } from './routes/messages'
import { achievementRoutes } from './routes/achievements'
import { seasonPassRoutes } from './routes/seasonPass'
import { giftsRoutes } from './routes/gifts'
import { wordPacksRoutes } from './routes/wordPacks'
import { tutorialRoutes } from './routes/tutorial'
import { supportRoutes } from './routes/support'
import { registerSocketHandlers } from './socket'

export async function buildApp() {
  // Fastify shares our root pino instance so every HTTP request line lands in
  // the same structured log stream (stdout + apps/api/logs/api.log when
  // LOG_TO_FILE is on). See apps/api/src/config/logger.ts for details.
  const app = Fastify({ logger: rootLogger })

  const logFile = getLogFilePath()
  if (logFile) {
    rootLogger.info({ logFile }, 'api logs are being written to file')
  }

  // Plugins
  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  })
  await app.register(jwt, { secret: env.JWT_SECRET })
  await app.register(cookie)
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } })

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
  await app.register(friendsRoutes, { prefix: '/api/friends' })
  await app.register(historyRoutes, { prefix: '/api/history' })
  await app.register(messagesRoutes, { prefix: '/api/messages' })
  await app.register(achievementRoutes, { prefix: '/api/achievements' })
  await app.register(seasonPassRoutes, { prefix: '/api/season-pass' })
  await app.register(giftsRoutes, { prefix: '/api/gifts' })
  await app.register(wordPacksRoutes, { prefix: '/api/word-packs' })
  await app.register(tutorialRoutes, { prefix: '/api/tutorial' })
  await app.register(supportRoutes, { prefix: '/api/support' })

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // Socket.IO
  const io = new SocketServer(app.server, {
    cors: { origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()), credentials: true },
    transports: ['websocket', 'polling'],
  })
  registerSocketHandlers(io, app)

  return app
}
