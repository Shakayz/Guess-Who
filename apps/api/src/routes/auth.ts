import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import bcrypt from 'bcryptjs'

const signUpSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(8),
})

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/signup', async (req, reply) => {
    const body = signUpSchema.parse(req.body)
    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) return reply.status(409).send({ error: 'Email already in use' })

    const hashed = await bcrypt.hash(body.password, 12)
    const user = await prisma.user.create({
      data: {
        username: body.username,
        email: body.email,
        passwordHash: hashed,
      },
    })
    const token = fastify.jwt.sign({ sub: user.id, username: user.username })
    return reply.send({ token, user: { id: user.id, username: user.username } })
  })

  fastify.post('/signin', async (req, reply) => {
    const body = signInSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }
    const valid = await bcrypt.compare(body.password, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' })
    const token = fastify.jwt.sign({ sub: user.id, username: user.username })
    return reply.send({ token, user: { id: user.id, username: user.username } })
  })

  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string }
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, username: true, email: true, avatarUrl: true,
        starCoins: true, goldCoins: true, rankTier: true, rankPoints: true,
        honorPoints: true, locale: true, createdAt: true,
      },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return reply.send(user)
  })
}
