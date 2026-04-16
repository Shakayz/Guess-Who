import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/prisma'

export const historyRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /api/history?page=1&limit=10&mode=ranked|unranked
  // `mode` filters by game.gameMode:
  //   - 'ranked'   → only ranked games
  //   - 'unranked' → normal + special (lobby) games
  //   - omitted    → all games (legacy behavior)
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { page = '1', limit = '10', mode } = req.query as {
      page?: string; limit?: string; mode?: string
    }
    const p = Math.max(1, parseInt(page))
    const l = Math.min(50, Math.max(1, parseInt(limit)))
    const modeFilter: 'ranked' | 'unranked' | undefined =
      mode === 'ranked' || mode === 'unranked' ? mode : undefined
    req.log.info({ userId, page: p, limit: l, mode: modeFilter }, 'fetching game history')
    const skip = (p - 1) * l

    const gameModeWhere = modeFilter === 'ranked'
      ? { gameMode: 'ranked' }
      : modeFilter === 'unranked'
        ? { gameMode: { not: 'ranked' } }
        : undefined
    const where = gameModeWhere
      ? { userId, game: gameModeWhere }
      : { userId }

    const [total, participations] = await Promise.all([
      prisma.gameParticipation.count({ where }),
      prisma.gameParticipation.findMany({
        where,
        skip,
        take: l,
        orderBy: { createdAt: 'desc' },
        select: {
          role: true,
          survived: true,
          starCoinsEarned: true,
          game: {
            select: {
              id: true,
              startedAt: true,
              endedAt: true,
              winnerTeam: true,
              gameMode: true,
              _count: { select: { rounds: true } },
              participations: {
                select: {
                  userId: true,
                  role: true,
                  survived: true,
                  user: { select: { id: true, username: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      }),
    ])

    const games = participations.map((p) => ({
      id: p.game.id,
      startedAt: p.game.startedAt,
      endedAt: p.game.endedAt,
      winnerTeam: p.game.winnerTeam,
      gameMode: p.game.gameMode,
      myRole: p.role,
      survived: p.survived,
      starCoinsEarned: p.starCoinsEarned,
      roundCount: p.game._count.rounds,
      players: p.game.participations.map((gp) => ({
        userId: gp.userId,
        username: gp.user.username,
        avatarUrl: gp.user.avatarUrl,
        role: gp.role,
        survived: gp.survived,
      })),
    }))

    reply.header('Cache-Control', 'private, max-age=60')
    return reply.send({ games, total, page: p, totalPages: Math.ceil(total / l) })
  })

  // GET /api/history/:gameId — detailed game
  fastify.get('/:gameId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { gameId } = req.params as { gameId: string }
    req.log.info({ userId, gameId }, 'fetching game detail')

    // Verify user participated
    const participation = await prisma.gameParticipation.findUnique({
      where: { gameId_userId: { gameId, userId } },
    })
    if (!participation) {
      req.log.warn({ userId, gameId }, 'game detail not found or unauthorized')
      return reply.status(404).send({ error: 'Game not found' })
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participations: {
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            clues: { orderBy: { createdAt: 'asc' } },
            votes: true,
          },
        },
        chatMessages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!game) return reply.status(404).send({ error: 'Game not found' })

    reply.header('Cache-Control', 'private, max-age=3600')
    return reply.send({
      id: game.id,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      winnerTeam: game.winnerTeam,
      myRole: participation.role,
      participations: game.participations.map((p) => ({
        userId: p.userId,
        username: p.user.username,
        avatarUrl: p.user.avatarUrl,
        role: p.role,
        survived: p.survived,
        starCoinsEarned: p.starCoinsEarned,
      })),
      rounds: game.rounds.map((r) => ({
        id: r.id,
        roundNumber: r.roundNumber,
        villagerWord: r.villagerWord,
        redHandedWord: r.redHandedWord,
        eliminatedId: r.eliminatedId,
        eliminatedRole: r.eliminatedRole,
        clues: r.clues.map((c) => ({ playerId: c.playerId, text: c.text, createdAt: c.createdAt })),
        votes: r.votes.map((v) => ({ voterId: v.voterId, targetId: v.targetId })),
      })),
      chatMessages: game.chatMessages,
    })
  })
}
