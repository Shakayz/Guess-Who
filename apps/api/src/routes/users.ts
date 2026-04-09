import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { redis } from '../config/redis'
import { xpProgressInLevel } from '@imposter/shared'
import { evaluateEvent } from '../services/achievements'
import bcrypt from 'bcryptjs'

const patchMeSchema = z.object({
  avatarUrl: z.string().url().optional().nullable(),
  locale: z.enum(['en', 'fr', 'ar', 'es', 'de', 'it', 'pt', 'zh']).optional(),
  username: z.string().min(2).max(20).regex(/^[a-zA-Z0-9_]+$/).optional(),
})

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate)

  // PATCH /api/users/me — update own profile fields
  fastify.patch('/me', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const body = patchMeSchema.parse(req.body)
    req.log.info({ userId, fields: Object.keys(body) }, 'profile update')
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
        ...(body.locale !== undefined ? { locale: body.locale } : {}),
        ...(body.username !== undefined ? { username: body.username } : {}),
      },
      select: { id: true, username: true, avatarUrl: true, locale: true },
    })
    return reply.send(updated)
  })

  // POST /api/users/me/avatar — upload profile picture as base64 data URL
  fastify.post('/me/avatar', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    req.log.info({ userId }, 'avatar upload attempt')

    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedMimeTypes.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Invalid file type. Allowed: jpeg, png, gif, webp' })
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    if (buffer.byteLength > 5 * 1024 * 1024) {
      return reply.status(400).send({ error: 'File too large. Maximum size is 5MB' })
    }

    const base64 = buffer.toString('base64')
    const avatarUrl = `data:${data.mimetype};base64,${base64}`

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, username: true, avatarUrl: true, locale: true },
    })

    req.log.info({ userId, mimetype: data.mimetype, bytes: buffer.byteLength }, 'avatar uploaded')
    // Fire avatar_changed achievement event
    await evaluateEvent((fastify as any).io ?? null, 'avatar_changed', { userId }).catch(() => {})
    return reply.send(updated)
  })

  // DELETE /api/users/me/avatar — remove profile picture
  fastify.delete('/me/avatar', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
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

  // PUT /api/users/me/password — change password
  fastify.put('/me/password', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.passwordHash) return reply.status(400).send({ error: 'OAuth accounts cannot change password' })

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: 'Current password is incorrect' })

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashed } })
    return reply.send({ success: true })
  })

  // DELETE /api/users/me — delete own account
  fastify.delete('/me', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    await prisma.user.delete({ where: { id: userId } })
    return reply.send({ success: true })
  })

  fastify.get('/leaderboard', async (req, reply) => {
    const { locale } = req.query as { locale?: string }
    const lang = (locale ?? 'en').split('-')[0]
    const cacheKey = `leaderboard:top100:${lang}`
    const cached = await redis.get(cacheKey)
    if (cached) return reply.send(JSON.parse(cached))

    const users = await prisma.user.findMany({
      where: { locale: lang },
      select: { id: true, username: true, avatarUrl: true, rankTier: true, rankPoints: true },
      orderBy: { rankPoints: 'desc' },
      take: 100,
    })
    await redis.set(cacheKey, JSON.stringify(users), 'EX', 300) // 5 min cache
    return reply.send(users)
  })

  // GET /api/users/search?q=username
  fastify.get('/search', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { q } = req.query as { q?: string }
    if (!q || q.length < 2) return reply.send({ users: [] })
    req.log.info({ userId, queryLength: q?.length }, 'user search')
    const users = await prisma.user.findMany({
      where: {
        username: { contains: q, mode: 'insensitive' },
        NOT: { id: userId },
      },
      select: { id: true, username: true, avatarUrl: true },
      take: 10,
    })

    // Annotate each result with the current user's friendship status so the
    // client can render the correct action (Add / Pending / Accept / Friend)
    // without first clicking and getting a misleading error.
    let friendships: { id: string; requesterId: string; addresseeId: string; status: string }[] = []
    if (users.length > 0) {
      const otherIds = users.map((u) => u.id)
      friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { requesterId: userId, addresseeId: { in: otherIds } },
            { requesterId: { in: otherIds }, addresseeId: userId },
          ],
        },
        select: { id: true, requesterId: true, addresseeId: true, status: true },
      })
    }

    const byOtherId = new Map<string, { id: string; status: 'accepted' | 'pending_outgoing' | 'pending_incoming' }>()
    for (const f of friendships) {
      const otherId = f.requesterId === userId ? f.addresseeId : f.requesterId
      let status: 'accepted' | 'pending_outgoing' | 'pending_incoming'
      if (f.status === 'accepted') status = 'accepted'
      else if (f.requesterId === userId) status = 'pending_outgoing'
      else status = 'pending_incoming'
      byOtherId.set(otherId, { id: f.id, status })
    }

    const result = users.map((u) => ({
      ...u,
      friendship: byOtherId.get(u.id) ?? null,
    }))

    return reply.send({ users: result })
  })

  fastify.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, avatarUrl: true, rankTier: true,
        rankPoints: true, honorPoints: true, createdAt: true,
        level: true, xp: true, hasPlayedRanked: true,
        _count: { select: { gameParticipations: true } },
      },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    const progress = xpProgressInLevel(user.xp ?? 0)
    return reply.send({
      ...user,
      rankTier: user.hasPlayedRanked ? user.rankTier : 'unranked',
      xpInLevel: progress.current,
      xpForNextLevel: progress.needed,
    })
  })

  // POST /api/users/:userId/block — block a player
  fastify.post('/:userId/block', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const blockerId = (req.user as { sub: string }).sub
    const { userId } = req.params as { userId: string }
    if (blockerId === userId) return reply.status(400).send({ error: 'Cannot block yourself' })

    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId: userId } },
      update: {},
      create: { blockerId, blockedId: userId },
    })

    // Also remove any existing friendship
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: blockerId, addresseeId: userId },
          { requesterId: userId, addresseeId: blockerId },
        ],
      },
    })

    return reply.send({ success: true })
  })

  // DELETE /api/users/:userId/block — unblock a player
  fastify.delete('/:userId/block', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const blockerId = (req.user as { sub: string }).sub
    const { userId } = req.params as { userId: string }
    await prisma.block.deleteMany({ where: { blockerId, blockedId: userId } })
    return reply.send({ success: true })
  })

  // GET /api/users/blocked — get list of blocked users
  fastify.get('/blocked', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const blocks = await prisma.block.findMany({
      where: { blockerId: userId },
      include: { blocked: { select: { id: true, username: true, avatarUrl: true } } },
    })
    return reply.send(blocks.map((b) => b.blocked))
  })

  // POST /api/users/:userId/report — report a player
  fastify.post('/:userId/report', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const reporterId = (req.user as { sub: string }).sub
    const { userId } = req.params as { userId: string }
    const { reason, details } = req.body as { reason: string; details?: string }

    const VALID_REASONS = ['cheating', 'harassment', 'hate_speech', 'inappropriate_name', 'spam', 'other']
    if (!VALID_REASONS.includes(reason)) return reply.status(400).send({ error: 'Invalid reason' })

    await prisma.report.create({
      data: { reporterId, reportedId: userId, reason, details: details?.slice(0, 500) },
    })

    return reply.send({ success: true })
  })

  // GET /api/users/:id/profile — public profile with stats
  fastify.get('/:id/profile', async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, avatarUrl: true, rankTier: true,
        rankPoints: true, honorPoints: true, createdAt: true,
        level: true, xp: true, hasPlayedRanked: true,
      },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    // Helper that builds the same set of stat queries scoped by gameMode.
    // mode = 'ranked' → only games where game.gameMode === 'ranked'
    // mode = 'unranked' → all other game modes (normal + special)
    const statsForMode = async (mode: 'ranked' | 'unranked') => {
      const gameModeFilter = mode === 'ranked'
        ? { gameMode: 'ranked' }
        : { gameMode: { not: 'ranked' } }

      const [totalGames, wins, asVillager, asImposter, survived] = await Promise.all([
        prisma.gameParticipation.count({
          where: { userId: id, game: gameModeFilter },
        }),
        prisma.gameParticipation.count({
          where: {
            userId: id,
            OR: [
              { role: 'villager',     game: { winnerTeam: 'villagers', ...gameModeFilter } },
              { role: 'detective',    game: { winnerTeam: 'villagers', ...gameModeFilter } },
              { role: 'imposter',     game: { winnerTeam: 'imposters', ...gameModeFilter } },
              { role: 'double_agent', game: { winnerTeam: 'imposters', ...gameModeFilter } },
            ],
          },
        }),
        prisma.gameParticipation.count({
          where: { userId: id, role: { in: ['villager', 'detective'] }, game: gameModeFilter },
        }),
        prisma.gameParticipation.count({
          where: { userId: id, role: { in: ['imposter', 'double_agent'] }, game: gameModeFilter },
        }),
        prisma.gameParticipation.count({
          where: { userId: id, survived: true, game: gameModeFilter },
        }),
      ])
      return {
        totalGames,
        wins,
        losses: totalGames - wins,
        winRate: totalGames ? Math.round((wins / totalGames) * 100) : 0,
        asVillager,
        asImposter,
        survived,
      }
    }

    // Honors are grouped by type and joined to game.gameMode via Honor.gameId.
    // Honors with no gameId (gifted outside a game) are bucketed as "unranked".
    const honorsForMode = async (mode: 'ranked' | 'unranked') => {
      const gameModeFilter =
        mode === 'ranked'
          ? { game: { gameMode: 'ranked' } }
          : {
              OR: [
                { game: { gameMode: { not: 'ranked' } } },
                { gameId: null },
              ],
            }
      const grouped = await prisma.honor.groupBy({
        by: ['type'],
        where: { receiverId: id, ...gameModeFilter },
        _count: { type: true },
      })
      return grouped.map((h) => ({ type: h.type, count: h._count.type }))
    }

    const [statsRanked, statsUnranked, honorsRanked, honorsUnranked, recentParticipations] = await Promise.all([
      statsForMode('ranked'),
      statsForMode('unranked'),
      honorsForMode('ranked'),
      honorsForMode('unranked'),
      prisma.gameParticipation.findMany({
        where: { userId: id },
        take: 8,
        orderBy: { game: { startedAt: 'desc' } },
        include: {
          game: {
            select: {
              id: true, winnerTeam: true, startedAt: true, gameMode: true,
              _count: { select: { rounds: true } },
            },
          },
        },
      }),
    ])

    const recentGames = recentParticipations.map((p) => ({
      gameId: p.game.id,
      role: p.role,
      survived: p.survived,
      winnerTeam: p.game.winnerTeam,
      gameMode: p.game.gameMode,
      didWin:
        (p.role === 'villager' && p.game.winnerTeam === 'villagers') ||
        (p.role === 'detective' && p.game.winnerTeam === 'villagers') ||
        (p.role === 'imposter' && p.game.winnerTeam === 'imposters') ||
        (p.role === 'double_agent' && p.game.winnerTeam === 'imposters'),
      rounds: p.game._count.rounds,
      playedAt: p.game.startedAt,
    }))

    const progress = xpProgressInLevel(user.xp ?? 0)
    // Lifetime totals (sum of both buckets) — kept for backward compat with
    // any client that hasn't been updated yet.
    const totalGames = statsRanked.totalGames + statsUnranked.totalGames
    const wins      = statsRanked.wins      + statsUnranked.wins
    const losses    = totalGames - wins
    const asVillager = statsRanked.asVillager + statsUnranked.asVillager
    const asImposter = statsRanked.asImposter + statsUnranked.asImposter
    const survived   = statsRanked.survived   + statsUnranked.survived

    // Lifetime honors (merged by type) for back-compat too.
    const lifetimeHonors = new Map<string, number>()
    for (const h of honorsRanked)   lifetimeHonors.set(h.type, (lifetimeHonors.get(h.type) ?? 0) + h.count)
    for (const h of honorsUnranked) lifetimeHonors.set(h.type, (lifetimeHonors.get(h.type) ?? 0) + h.count)

    return reply.send({
      ...user,
      rankTier: user.hasPlayedRanked ? user.rankTier : 'unranked',
      xpInLevel: progress.current,
      xpForNextLevel: progress.needed,
      stats: {
        totalGames,
        wins,
        losses,
        winRate: totalGames ? Math.round((wins / totalGames) * 100) : 0,
        asVillager,
        asImposter,
        survived,
      },
      statsRanked,
      statsUnranked,
      recentGames,
      honors: Array.from(lifetimeHonors.entries()).map(([type, count]) => ({ type, count })),
      honorsRanked,
      honorsUnranked,
    })
  })
}
