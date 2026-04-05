import Redis from 'ioredis'
import pino from 'pino'
import { env } from './env'

const log = pino({ name: 'redis' })

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redis.on('connect', () => log.info('redis connected'))
redis.on('ready', () => log.info('redis ready'))
redis.on('error', (err) => log.error({ err }, 'redis error'))
redis.on('close', () => log.warn('redis connection closed'))
redis.on('reconnecting', () => log.info('redis reconnecting'))
