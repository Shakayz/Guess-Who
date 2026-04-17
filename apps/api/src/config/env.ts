import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV:         z.enum(['development', 'test', 'production']).default('development'),
  PORT:             z.coerce.number().default(3001),
  LOG_LEVEL:        z.string().default('info'),
  DATABASE_URL:     z.string(),
  REDIS_URL:        z.string().default('redis://localhost:6379'),
  JWT_SECRET:       z.string().min(32),
  ALLOWED_ORIGINS:  z.string().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID:      z.string().optional(),
  GOOGLE_CLIENT_SECRET:  z.string().optional(),
  // Apple Sign In uses the popup flow — only the Services ID is needed
  // for the JWT audience check in routes/oauth.ts. Server-to-server
  // vars (TEAM_ID, KEY_ID, PRIVATE_KEY) are not required for this flow.
  APPLE_CLIENT_ID:    z.string().optional(),
  APP_URL:            z.string().default('http://localhost:5173'),
  RESEND_API_KEY:     z.string().optional(),
  SMTP_HOST:          z.string().optional(),
  SMTP_PORT:          z.coerce.number().default(587),
  SMTP_USER:          z.string().optional(),
  SMTP_PASS:          z.string().optional(),
  SMTP_FROM:          z.string().default('Red Handed ! <contact@redhanded-game.com>'),
  STRIPE_SECRET_KEY:      z.string().optional(),
  STRIPE_WEBHOOK_SECRET:  z.string().optional(),
  STRIPE_SUCCESS_URL:     z.string().default('http://localhost:5173/shop?checkout=success'),
  STRIPE_CANCEL_URL:      z.string().default('http://localhost:5173/shop?checkout=canceled'),
  // Per-environment Stripe Price IDs (test mode in staging, live mode in prod).
  // Left optional so the API still boots without payments configured; the shop
  // routes return a clear error if a pack's price ID is missing at checkout time.
  STRIPE_PRICE_ID_PACK_500:  z.string().optional(),
  STRIPE_PRICE_ID_PACK_1500: z.string().optional(),
  STRIPE_PRICE_ID_PACK_5000: z.string().optional(),
})

export const env = envSchema.parse(process.env)
