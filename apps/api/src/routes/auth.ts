import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import bcrypt from 'bcryptjs'

const SUPPORTED_LOCALES = ['en', 'fr', 'ar', 'es', 'it', 'pt', 'zh'] as const

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

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/signup', async (req, reply) => {
    let body: z.infer<typeof signUpSchema>
    try {
      body = signUpSchema.parse(req.body)
    } catch (err: any) {
      const message = err?.errors?.[0]?.message ?? 'Invalid input'
      return reply.status(400).send({ error: message })
    }

    try {
      const existingEmail = await prisma.user.findUnique({ where: { email: body.email } })
      if (existingEmail) return reply.status(409).send({ error: 'Email already in use' })

      const existingUsername = await prisma.user.findUnique({ where: { username: body.username } })
      if (existingUsername) return reply.status(409).send({ error: 'Username already taken' })

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

      const token = fastify.jwt.sign({ sub: user.id, username: user.username }, { expiresIn: '30d' })
      return reply.send({ token, user: { id: user.id, username: user.username, email: user.email } })
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const field = err?.meta?.target?.[0] ?? ''
        return reply.status(409).send({ error: field === 'email' ? 'Email already in use' : 'Username already taken' })
      }
      fastify.log.error(err, 'signup error')
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

    try {
      const isEmail = body.identifier.includes('@')
      const user = isEmail
        ? await prisma.user.findUnique({ where: { email: body.identifier } })
        : await prisma.user.findUnique({ where: { username: body.identifier } })
      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: 'Invalid credentials' })
      }
      const valid = await bcrypt.compare(body.password, user.passwordHash)
      if (!valid) return reply.status(401).send({ error: 'Invalid credentials' })

      const token = fastify.jwt.sign({ sub: user.id, username: user.username }, { expiresIn: '30d' })
      return reply.send({ token, user: { id: user.id, username: user.username } })
    } catch (err: any) {
      fastify.log.error(err, 'signin error')
      return reply.status(500).send({ error: 'Could not sign in. Please try again.' })
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
    return reply.send({
      ...user,
      honorTeamplayer: honorMap['teamplayer'] ?? 0,
      honorSharpMind:  honorMap['sharp_mind']  ?? 0,
      honorGoodSport:  honorMap['good_sport']  ?? 0,
    })
  })
}
