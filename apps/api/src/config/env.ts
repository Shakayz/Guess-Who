import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV:         z.enum(['development', 'test', 'production']).default('development'),
  PORT:             z.coerce.number().default(3001),
  LOG_LEVEL:        z.string().default('info'),
  DATABASE_URL:     z.string(),
  REDIS_URL:        z.string().default('redis://localhost:6379'),
  JWT_SECRET:       z.string().min(32),
  ALLOWED_ORIGINS:  z.string().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID:   z.string().optional(),
  GOOGLE_SECRET:      z.string().optional(),
  APPLE_CLIENT_ID:    z.string().optional(),
  APPLE_TEAM_ID:      z.string().optional(),
  APPLE_KEY_ID:       z.string().optional(),
  APPLE_PRIVATE_KEY:  z.string().optional(),
  APP_URL:            z.string().default('http://localhost:5173'),
})

export const env = envSchema.parse(process.env)
