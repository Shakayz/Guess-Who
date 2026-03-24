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

    const participations = await prisma.gameParticipation.findMany({
      where: { userId: id },
      include: {
        game: {
          select: { id: true, winnerTeam: true, startedAt: true, endedAt: true,
            _count: { select: { rounds: true } } },
        },
      },
      orderBy: { game: { startedAt: 'desc' } },
    })

    const totalGames = participations.length
    const wins = participations.filter((p) =>
      (p.role === 'villager' && p.game.winnerTeam === 'villagers') ||
      (p.role === 'imposter' && p.game.winnerTeam === 'imposters')
    ).length
    const asVillager = participations.filter((p) => p.role === 'villager').length
    const asImposter = participations.filter((p) => p.role === 'imposter').length
    const survived   = participations.filter((p) => p.survived).length

    const recentGames = participations.slice(0, 8).map((p) => ({
      gameId: p.game.id,
      role: p.role,
      survived: p.survived,
      winnerTeam: p.game.winnerTeam,
      didWin:
        (p.role === 'villager' && p.game.winnerTeam === 'villagers') ||
        (p.role === 'imposter' && p.game.winnerTeam === 'imposters'),
      rounds: p.game._count.rounds,
      playedAt: p.game.startedAt,
    }))

    const honorsReceived = await prisma.honor.groupBy({
      by: ['type'],
      where: { receiverId: id },
      _count: { type: true },
    })

    return reply.send({
      ...user,
      stats: { totalGames, wins, losses: totalGames - wins, winRate: totalGames ? Math.round(wins / totalGames * 100) : 0, asVillager, asImposter, survived },
      recentGames,
      honors: honorsReceived.map((h) => ({ type: h.type, count: h._count.type })),
    })
  })
}
