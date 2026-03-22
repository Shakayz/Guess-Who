import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/prisma'

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate)

  fastify.get('/leaderboard', async (_req, reply) => {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, avatarUrl: true, rankTier: true, rankPoints: true },
      orderBy: [{ rankTier: 'desc' }, { rankPoints: 'desc' }],
      take: 100,
    })
    return reply.send(users)
  })

  fastify.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, avatarUrl: true, rankTier: true,
        rankPoints: true, honorPoints: true, createdAt: true,
        _count: { select: { gameParticipations: true } },
      },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return reply.send(user)
  })
}
