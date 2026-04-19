import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '../config/prisma'
import { redis } from '../config/redis'
import { EmailProviderError, sendPasswordResetEmail, sendVerificationEmail } from '../services/email'
import {
  xpProgressInLevel,
  EMAIL_VERIFICATION_REWARD,
  EMAIL_VERIFICATION_CODE_TTL_MINUTES,
} from '@red-handed/shared'
import { allocateReferralCode, creditInvitee, resolveInviter } from '../services/referral'
import { grantDailyLoginBonus } from '../services/dailyRewards'
import bcrypt from 'bcryptjs'

const SUPPORTED_LOCALES = ['en', 'fr', 'ar', 'es', 'it', 'pt', 'zh', 'de'] as const
const SUPPORTED_LOCALE_SET: ReadonlySet<string> = new Set(SUPPORTED_LOCALES)

const signUpSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(8),
  // Be lenient: clients now auto-detect device/browser language and send
  // whatever the OS reports (e.g. 'fr-FR', 'ru'). Strip the region tag and
  // fall back to 'en' when we don't ship a word pool for that language, so
  // auto-detection can never fail signup for an otherwise-valid account.
  locale: z
    .string()
    .transform((v) => {
      const base = v.split('-')[0].toLowerCase()
      return SUPPORTED_LOCALE_SET.has(base) ? base : 'en'
    })
    .default('en'),
  // Optional invite code — when present and valid, the new user is credited
  // via services/referral.creditInvitee() right after the account is created.
  // The inviter's reward is deferred until the invitee plays their first
  // ranked game (fired from the gameLoop). Invalid codes are logged and
  // ignored so a busted share link never blocks a legitimate signup.
  referralCode: z.string().trim().min(1).max(12).optional(),
})

const signInSchema = z.object({
  identifier: z.string().min(1), // email or username
  password: z.string(),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/signup', async (req, reply) => {
    let body: z.infer<typeof signUpSchema>
    try {
      body = signUpSchema.parse(req.body)
    } catch (err: any) {
      const message = err?.errors?.[0]?.message ?? 'Invalid input'
      return reply.status(400).send({ error: message })
    }

    req.log.info({ username: body.username }, 'signup attempt')

    try {
      const existingEmail = await prisma.user.findUnique({ where: { email: body.email } })
      if (existingEmail) {
        req.log.warn({ username: body.username }, 'signup failed: email already in use')
        return reply.status(409).send({ error: 'Email already in use' })
      }

      // Case-insensitive collision check: "Shakayz" blocks "shakayz" and
      // "sHakayz" so display names stay visually unique. The original casing
      // the user typed is still what gets stored and shown.
      const existingUsername = await prisma.user.findFirst({
        where: { username: { equals: body.username, mode: 'insensitive' } },
      })
      if (existingUsername) {
        req.log.warn({ username: body.username }, 'signup failed: username already taken')
        return reply.status(409).send({ error: 'Username already taken' })
      }

      const hashed = await bcrypt.hash(body.password, 12)
      // Resolve the inviter up-front (if a code was passed) so we can fail
      // fast on invalid ones without leaving an uncredited account lying
      // around. An unknown code is treated as "no referral" and logged — the
      // UX choice here is to never block a real signup on a typo'd share
      // link.
      let inviterId: string | null = null
      if (body.referralCode) {
        const inviter = await resolveInviter(body.referralCode)
        if (inviter) {
          inviterId = inviter.id
        } else {
          req.log.info({ referralCode: body.referralCode }, 'signup: unknown referral code, ignoring')
        }
      }

      // New accounts start unverified — they keep the default INITIAL_STAR_COINS
      // balance (20 ⭐) until they confirm their email through the
      // /api/auth/email/verify-code flow, at which point EMAIL_VERIFICATION_REWARD
      // is granted. OAuth signups (Google/Apple) skip this step because the
      // provider already attests the address.
      const referralCode = await allocateReferralCode()
      const user = await prisma.user.create({
        data: {
          username: body.username,
          email: body.email,
          passwordHash: hashed,
          locale: body.locale,
          emailVerified: false,
          referralCode,
        },
      })

      if (inviterId) {
        const credit = await creditInvitee(inviterId, user.id)
        if (credit) {
          req.log.info(
            { userId: user.id, inviterId, ...credit },
            'signup: invitee credited (inviter reward deferred to first ranked game)',
          )
        }
      }

      req.log.info({ userId: user.id, username: user.username }, 'signup successful')
      const token = fastify.jwt.sign({ sub: user.id, username: user.username }, { expiresIn: '30d' })
      return reply.send({ token, user: { id: user.id, username: user.username, email: user.email } })
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const field = err?.meta?.target?.[0] ?? ''
        return reply.status(409).send({ error: field === 'email' ? 'Email already in use' : 'Username already taken' })
      }
      req.log.error({ err }, 'signup error')
      return reply.status(500).send({ error: 'Could not create account. Please try again.' })
    }
  })

  fastify.post('/signin', async (req, reply) => {
    let body: z.infer<typeof signInSchema>
    try {
      body = signInSchema.parse(req.body)
    } catch (err: any) {
      const message = err?.errors?.[0]?.message ?? 'Invalid input'
      return reply.status(400).send({ error: message })
    }

    req.log.info('signin attempt')

    try {
      const isEmail = body.identifier.includes('@')
      const user = isEmail
        ? await prisma.user.findUnique({ where: { email: body.identifier } })
        : await prisma.user.findFirst({
            where: { username: { equals: body.identifier, mode: 'insensitive' } },
          })
      if (!user || !user.passwordHash) {
        req.log.warn('signin failed: invalid credentials')
        return reply.status(401).send({ error: 'Invalid credentials' })
      }
      const valid = await bcrypt.compare(body.password, user.passwordHash)
      if (!valid) {
        req.log.warn({ userId: user.id }, 'signin failed: wrong password')
        return reply.status(401).send({ error: 'Invalid credentials' })
      }

      req.log.info({ userId: user.id, username: user.username }, 'signin successful')
      const token = fastify.jwt.sign({ sub: user.id, username: user.username }, { expiresIn: '30d' })
      return reply.send({ token, user: { id: user.id, username: user.username } })
    } catch (err: any) {
      req.log.error({ err }, 'signin error')
      return reply.status(500).send({ error: 'Could not sign in. Please try again.' })
    }
  })

  fastify.post('/forgot-password', async (req, reply) => {
    let body: z.infer<typeof forgotPasswordSchema>
    try {
      body = forgotPasswordSchema.parse(req.body)
    } catch (err: any) {
      const message = err?.errors?.[0]?.message ?? 'Invalid input'
      return reply.status(400).send({ error: message })
    }

    req.log.info('forgot-password attempt')

    try {
      const user = await prisma.user.findUnique({ where: { email: body.email } })
      // Always return success to avoid email enumeration
      if (!user) {
        req.log.info('forgot-password: email not found (silent)')
        return reply.send({ message: 'If that email is registered, you will receive a reset link.' })
      }

      const token = crypto.randomBytes(32).toString('hex')
      await redis.set(`reset:${token}`, user.id, 'EX', 3600) // 1 hour TTL

      await sendPasswordResetEmail(body.email, token)

      req.log.info({ userId: user.id }, 'forgot-password: reset email sent')
      return reply.send({ message: 'If that email is registered, you will receive a reset link.' })
    } catch (err: any) {
      req.log.error({ err }, 'forgot-password error')
      return reply.status(500).send({ error: 'Could not process request. Please try again.' })
    }
  })

  fastify.post('/reset-password', async (req, reply) => {
    let body: z.infer<typeof resetPasswordSchema>
    try {
      body = resetPasswordSchema.parse(req.body)
    } catch (err: any) {
      const message = err?.errors?.[0]?.message ?? 'Invalid input'
      return reply.status(400).send({ error: message })
    }

    req.log.info('reset-password attempt')

    try {
      const userId = await redis.get(`reset:${body.token}`)
      if (!userId) {
        req.log.warn('reset-password: invalid or expired token')
        return reply.status(400).send({ error: 'Invalid or expired reset token' })
      }

      const hashed = await bcrypt.hash(body.password, 12)
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hashed },
      })

      await redis.del(`reset:${body.token}`)

      req.log.info({ userId }, 'reset-password: password updated')
      return reply.send({ message: 'Password has been reset successfully.' })
    } catch (err: any) {
      req.log.error({ err }, 'reset-password error')
      return reply.status(500).send({ error: 'Could not reset password. Please try again.' })
    }
  })

  // ─── Email verification (6-digit code) ──────────────────────────────────────
  //
  // Flow: signed-in user hits Settings → "Verify email" → POST /email/send-code
  // → we generate a 6-digit code, store it with a 15-minute expiry, and mail
  // it from contact@redhanded-game.com. They type it into Settings →
  // POST /email/verify-code → we check it and, on the first successful
  // verification, grant EMAIL_VERIFICATION_REWARD ⭐. Subsequent calls after
  // the account is already verified are no-ops.
  fastify.post(
    '/email/send-code',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const userId = (req.user as { sub: string }).sub
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, emailVerified: true },
      })
      if (!user) return reply.status(404).send({ error: 'User not found' })
      if (user.emailVerified) {
        return reply.send({ alreadyVerified: true })
      }

      // 6-digit zero-padded code. crypto.randomInt is uniform in [0, 1000000).
      const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
      const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_CODE_TTL_MINUTES * 60_000)

      await prisma.user.update({
        where: { id: userId },
        data: { emailVerificationCode: code, emailVerificationExpires: expiresAt },
      })

      let result
      try {
        result = await sendVerificationEmail(user.email, code)
      } catch (err) {
        req.log.error({ err, userId }, 'verification email send failed')
        if (err instanceof EmailProviderError) {
          // Surface the provider's status/reason so the operator can tell the
          // difference between a misconfigured server (503 / no-transport) and
          // a provider rejection (e.g. 422 unverified domain, 401 bad key).
          return reply.status(502).send({
            error: err.message,
            providerStatus: err.providerStatus,
          })
        }
        return reply.status(502).send({ error: 'Could not send verification email. Please try again.' })
      }

      req.log.info(
        { userId, ttlMinutes: EMAIL_VERIFICATION_CODE_TTL_MINUTES, transport: result.transport },
        'verification code sent',
      )
      return reply.send({
        success: true,
        ttlMinutes: EMAIL_VERIFICATION_CODE_TTL_MINUTES,
        transport: result.transport,
        providerId: result.transport === 'resend' ? result.providerId : undefined,
      })
    },
  )

  fastify.post(
    '/email/verify-code',
    { onRequest: [fastify.authenticate] },
    async (req, reply) => {
      const userId = (req.user as { sub: string }).sub
      const parsed = z
        .object({ code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits') })
        .safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid code' })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          emailVerified: true,
          emailVerificationCode: true,
          emailVerificationExpires: true,
          starCoins: true,
        },
      })
      if (!user) return reply.status(404).send({ error: 'User not found' })
      if (user.emailVerified) {
        return reply.send({ alreadyVerified: true, starCoins: user.starCoins, reward: 0 })
      }

      if (
        !user.emailVerificationCode ||
        !user.emailVerificationExpires ||
        user.emailVerificationExpires.getTime() < Date.now()
      ) {
        return reply.status(400).send({ error: 'Code expired. Request a new one.' })
      }
      if (user.emailVerificationCode !== parsed.data.code) {
        return reply.status(400).send({ error: 'Invalid code.' })
      }

      // Atomic guarded flip: only credit the reward on the first flip of
      // emailVerified (mirrors the tutorial.ts pattern so concurrent submits
      // can't double-credit).
      const flip = await prisma.user.updateMany({
        where: { id: userId, emailVerified: false },
        data: {
          emailVerified: true,
          emailVerificationCode: null,
          emailVerificationExpires: null,
          starCoins: { increment: EMAIL_VERIFICATION_REWARD },
        },
      })
      const justVerified = flip.count === 1

      const updated = await prisma.user.findUnique({
        where: { id: userId },
        select: { starCoins: true },
      })

      req.log.info(
        { userId, justVerified, reward: justVerified ? EMAIL_VERIFICATION_REWARD : 0 },
        'email verification result',
      )
      return reply.send({
        success: true,
        alreadyVerified: !justVerified,
        reward: justVerified ? EMAIL_VERIFICATION_REWARD : 0,
        starCoins: updated?.starCoins ?? 0,
      })
    },
  )

  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string }
    // Credit the +20 daily login bonus (idempotent per UTC day) before we read
    // the row, so the response reflects the freshly incremented starCoins in
    // the same request. `grantDailyLoginBonus` swallows its own errors — a
    // DB hiccup here must never block /me, since that would brick the app.
    const loginBonus = await grantDailyLoginBonus(payload.sub)
    const [user, honors] = await Promise.all([
      prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true, username: true, email: true, avatarUrl: true,
          starCoins: true, rankTier: true, rankPoints: true,
          honorPoints: true, locale: true, createdAt: true,
          level: true, xp: true, hasPlayedRanked: true,
          emailVerified: true,
          // Only one of these is non-null on a given OAuth-created account
          // (google/apple/discord), and all three are null on email-signup
          // users. Selected so the /me response can expose a single
          // `authProvider` string to drive the "Signed in with X" badge.
          googleId: true, appleId: true, discordId: true,
          dailyStreakCount: true, lastPlayedAt: true,
          premiumUntil: true,
        },
      }),
      prisma.honor.groupBy({
        by: ['type'],
        where: { receiverId: payload.sub },
        _count: { type: true },
      }),
    ])
    if (!user) return reply.status(404).send({ error: 'User not found' })
    const honorMap: Record<string, number> = {}
    for (const h of honors) honorMap[h.type] = h._count.type
    const progress = xpProgressInLevel(user.xp ?? 0)
    // Derive entitlement from the single source of truth. A user is premium
    // iff premiumUntil is set AND still in the future. The client never needs
    // to do this math itself.
    const isPremium = !!(user.premiumUntil && user.premiumUntil.getTime() > Date.now())
    // Collapse the three mutually-exclusive provider IDs into a single tag so
    // the client doesn't have to know about any specific one. 'email' covers
    // both traditional signups and the no-provider fallback.
    const authProvider: 'google' | 'apple' | 'discord' | 'email' =
      user.googleId ? 'google'
      : user.appleId ? 'apple'
      : user.discordId ? 'discord'
      : 'email'
    // Strip the raw provider IDs from the wire response — they're internal
    // lookup keys, not something the UI should ever render or key off of.
    const { googleId: _g, appleId: _a, discordId: _d, ...rest } = user
    return reply.send({
      ...rest,
      // If the player has never played a ranked game, expose 'unranked' as the
      // public tier so the client can render the Unranked badge consistently.
      rankTier: user.hasPlayedRanked ? user.rankTier : 'unranked',
      xpInLevel: progress.current,
      xpForNextLevel: progress.needed,
      isPremium,
      authProvider,
      honorTeamplayer: honorMap['teamplayer'] ?? 0,
      honorSharpMind:  honorMap['sharp_mind']  ?? 0,
      honorGoodSport:  honorMap['good_sport']  ?? 0,
      // 0 on every call except the first one of each UTC day, when it's
      // DAILY_BONUS (20). Lets the client show a "+20 ⭐ Daily login bonus"
      // toast without re-querying the wallet to detect the delta.
      dailyLoginBonusEarned: loginBonus.bonusGranted,
    })
  })
}
