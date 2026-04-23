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
  // Discord OAuth (authorization-code flow). The web client redirects the user
  // to Discord's consent screen, Discord sends them back to the app with a
  // short-lived `code`, then the client POSTs that code to /auth/discord/verify
  // — the server exchanges it for an access token and fetches the profile. The
  // redirect_uri that Discord sees must match what we pass during exchange, so
  // the client always sends its own redirectUri alongside the code.
  DISCORD_CLIENT_ID:     z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
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
  // Premium subscription Price IDs (recurring). Monthly/yearly plans share the
  // same Stripe product; each interval gets its own Price. Optional so the API
  // still boots without premium configured — /api/shop/premium/checkout returns
  // 503 if the requested plan's price id is missing.
  STRIPE_PRICE_ID_PREMIUM_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ID_PREMIUM_YEARLY:  z.string().optional(),
  // Where Stripe sends the user back from the Billing Portal (manage / cancel
  // subscription). Defaults to the Premium page so the returning user lands on
  // a meaningful screen.
  STRIPE_PORTAL_RETURN_URL: z.string().default('http://localhost:5173/premium'),

  // ── Apple in-app purchase (App Store Server API) ─────────────────────────
  // Used to verify signed JWS transactions the mobile client sends after a
  // StoreKit 2 purchase, and to process App Store Server Notifications v2.
  // All optional so the API boots without IAP configured; the iOS verify
  // endpoint returns 503 if APPLE_IAP_BUNDLE_ID is missing.
  APPLE_IAP_BUNDLE_ID:   z.string().optional(),                         // e.g. com.redhanded.game
  APPLE_IAP_ISSUER_ID:   z.string().optional(),                         // App Store Connect team issuer UUID
  APPLE_IAP_KEY_ID:      z.string().optional(),                         // in-app purchase P8 key id (10 chars)
  APPLE_IAP_PRIVATE_KEY: z.string().optional(),                         // PEM contents of the P8 key (newlines allowed)
  APPLE_IAP_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),

  // ── Google Play billing (Google Play Developer API) ───────────────────────
  // Used to verify purchase tokens via purchases.products.get and
  // purchases.subscriptions.get, and to handle Real-Time Developer
  // Notifications. Service account must have "View financial data" on the
  // linked Play Console app. JSON is the full service-account credential
  // file contents (stringified); parsed lazily in the verifier.
  GOOGLE_PLAY_PACKAGE_NAME:         z.string().optional(),              // e.g. com.redhanded.game
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: z.string().optional(),
})

export const env = envSchema.parse(process.env)
