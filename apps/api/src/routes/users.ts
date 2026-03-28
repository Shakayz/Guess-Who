import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma'

const patchMeSchema = z.object({
  avatarUrl: z.string().url().optional().nullable(),
  locale: z.enum(['en', 'fr', 'ar', 'es', 'de']).optional(),
})

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate)

  // PATCH /api/users/me — update own profile fields
  fastify.patch('/me', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const body = patchMeSchema.parse(req.body)
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
        ...(body.locale !== undefined ? { locale: body.locale } : {}),
      },
      select: { id: true, username: true, avatarUrl: true, locale: true },
    })
    return reply.send(updated)
  })

  // POST /api/users/me/push-token — register device push token (mobile)
  fastify.post('/me/push-token', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const { token } = req.body as { token?: string }
    if (!token) return reply.status(400).send({ error: 'token is required' })
    await prisma.user.update({ where: { id: userId }, data: { pushToken: token } })
    return reply.send({ success: true })
  })

  // DELETE /api/users/me/push-token — unregister push token on logout
  fastify.delete('/me/push-token', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    await prisma.user.update({ where: { id: userId }, data: { pushToken: null } })
    return reply.send({ success: true })
  })

  fastify.get('/leaderboard', async (_req, reply) => {
    // Order by rankPoints descending (tier is derived from LP, so LP order = tier order)
    const users = await prisma.user.findMany({
      select: { id: true, username: true, avatarUrl: true, rankTier: true, rankPoints: true },
      orderBy: { rankPoints: 'desc' },
      take: 100,
    })
    return reply.send(users)
  })

  // GET /api/users/search?q=username
  fastify.get('/search', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { q } = req.query as { q?: string }
    if (!q || q.length < 2) return reply.send({ users: [] })
    const users = await prisma.user.findMany({
      where: {
        username: { contains: q, mode: 'insensitive' },
        NOT: { id: userId },
      },
      select: { id: true, username: true, avatarUrl: true },
      take: 10,
    })
    return reply.send({ users })
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

  // GET /api/users/:id/profile — public profile with stats
  fastify.get('/:id/profile', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, avatarUrl: true, rankTier: true,
        rankPoints: true, honorPoints: true, createdAt: true,
      },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    // Use parallel aggregated queries instead of fetching all participations
    const [totalGames, wins, asVillager, asImposter, survived, recentParticipations, honorsReceived] = await Promise.all([
      prisma.gameParticipation.count({ where: { userId: id } }),
      prisma.gameParticipation.count({
        where: {
          userId: id,
          OR: [
            { role: 'villager', game: { winnerTeam: 'villagers' } },
            { role: 'detective', game: { winnerTeam: 'villagers' } },
            { role: 'imposter', game: { winnerTeam: 'imposters' } },
            { role: 'double_agent', game: { winnerTeam: 'imposters' } },
          ],
        },
      }),
      prisma.gameParticipation.count({ where: { userId: id, role: { in: ['villager', 'detective'] } } }),
      prisma.gameParticipation.count({ where: { userId: id, role: { in: ['imposter', 'double_agent'] } } }),
      prisma.gameParticipation.count({ where: { userId: id, survived: true } }),
      prisma.gameParticipation.findMany({
        where: { userId: id },
        take: 8,
        orderBy: { game: { startedAt: 'desc' } },
        include: {
          game: {
            select: { id: true, winnerTeam: true, startedAt: true,
              _count: { select: { rounds: true } } },
          },
        },
      }),
      prisma.honor.groupBy({
        by: ['type'],
        where: { receiverId: id },
        _count: { type: true },
      }),
    ])

    const recentGames = recentParticipations.map((p) => ({
      gameId: p.game.id,
      role: p.role,
      survived: p.survived,
      winnerTeam: p.game.winnerTeam,
      didWin:
        (p.role === 'villager' && p.game.winnerTeam === 'villagers') ||
        (p.role === 'detective' && p.game.winnerTeam === 'villagers') ||
        (p.role === 'imposter' && p.game.winnerTeam === 'imposters') ||
        (p.role === 'double_agent' && p.game.winnerTeam === 'imposters'),
      rounds: p.game._count.rounds,
      playedAt: p.game.startedAt,
    }))

    return reply.send({
      ...user,
      stats: { totalGames, wins, losses: totalGames - wins, winRate: totalGames ? Math.round(wins / totalGames * 100) : 0, asVillager, asImposter, survived },
      recentGames,
      honors: honorsReceived.map((h) => ({ type: h.type, count: h._count.type })),
    })
  })
}
