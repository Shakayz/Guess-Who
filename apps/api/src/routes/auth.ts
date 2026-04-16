import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '../config/prisma'
import { redis } from '../config/redis'
import { sendPasswordResetEmail } from '../services/email'
import { xpProgressInLevel } from '@red-handed/shared'
import bcrypt from 'bcryptjs'

const SUPPORTED_LOCALES = ['en', 'fr', 'ar', 'es', 'it', 'pt', 'zh', 'de'] as const

const signUpSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(8),
  locale: z.string().transform((v) => v.split('-')[0].toLowerCase()).pipe(z.enum(SUPPORTED_LOCALES)).default('en'),
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

      const existingUsername = await prisma.user.findUnique({ where: { username: body.username } })
      if (existingUsername) {
        req.log.warn({ username: body.username }, 'signup failed: username already taken')
        return reply.status(409).send({ error: 'Username already taken' })
      }

      const hashed = await bcrypt.hash(body.password, 12)
      const user = await prisma.user.create({
        data: {
          username: body.username,
          email: body.email,
          passwordHash: hashed,
          locale: body.locale,
          emailVerified: true,
        },
      })

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
        : await prisma.user.findUnique({ where: { username: body.identifier } })
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

  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string }
    const [user, honors] = await Promise.all([
      prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true, username: true, email: true, avatarUrl: true,
          starCoins: true, goldCoins: true, rankTier: true, rankPoints: true,
          honorPoints: true, locale: true, createdAt: true,
          level: true, xp: true, hasPlayedRanked: true,
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
    return reply.send({
      ...user,
      // If the player has never played a ranked game, expose 'unranked' as the
      // public tier so the client can render the Unranked badge consistently.
      rankTier: user.hasPlayedRanked ? user.rankTier : 'unranked',
      xpInLevel: progress.current,
      xpForNextLevel: progress.needed,
      honorTeamplayer: honorMap['teamplayer'] ?? 0,
      honorSharpMind:  honorMap['sharp_mind']  ?? 0,
      honorGoodSport:  honorMap['good_sport']  ?? 0,
    })
  })
}
