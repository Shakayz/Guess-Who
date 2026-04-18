import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { redis } from '../config/redis'
import { xpProgressInLevel, USERNAME_CHANGE_COST, SOCIAL_SHARE_REWARD } from '@red-handed/shared'
import { evaluateEvent } from '../services/achievements'
import { ensureReferralCode } from '../services/referral'
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

    // Username changes are gated behind USERNAME_CHANGE_COST ⭐. A patch that
    // re-submits the CURRENT username is treated as a no-op and stays free so
    // clients can safely include the field in a mixed update.
    let chargedCoins = false
    let newStarCoins: number | undefined
    if (body.username !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, starCoins: true },
      })
      if (!current) return reply.status(404).send({ error: 'User not found' })

      if (body.username !== current.username) {
        if (current.starCoins < USERNAME_CHANGE_COST) {
          req.log.info(
            { userId, balance: current.starCoins, cost: USERNAME_CHANGE_COST },
            'username change blocked: insufficient stars',
          )
          return reply.status(402).send({
            error: 'not_enough_coins',
            cost: USERNAME_CHANGE_COST,
            starCoins: current.starCoins,
          })
        }

        // Atomic guarded debit: the `starCoins >= cost` predicate prevents a
        // race where two concurrent patches could both see enough balance.
        const debit = await prisma.user.updateMany({
          where: { id: userId, starCoins: { gte: USERNAME_CHANGE_COST } },
          data: { starCoins: { decrement: USERNAME_CHANGE_COST } },
        })
        if (debit.count !== 1) {
          return reply.status(402).send({
            error: 'not_enough_coins',
            cost: USERNAME_CHANGE_COST,
            starCoins: current.starCoins,
          })
        }
        chargedCoins = true
      }
    }

    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
          ...(body.locale !== undefined ? { locale: body.locale } : {}),
          ...(body.username !== undefined ? { username: body.username } : {}),
        },
        select: { id: true, username: true, avatarUrl: true, locale: true, starCoins: true },
      })
      newStarCoins = updated.starCoins
      req.log.info(
        { userId, chargedCoins, cost: chargedCoins ? USERNAME_CHANGE_COST : 0 },
        'profile update committed',
      )
      return reply.send({ ...updated, charged: chargedCoins ? USERNAME_CHANGE_COST : 0 })
    } catch (err: any) {
      // Prisma P2002 on the username unique index → refund the debit so the
      // player isn't charged for a name that turned out to be taken.
      if (chargedCoins) {
        await prisma.user.update({
          where: { id: userId },
          data: { starCoins: { increment: USERNAME_CHANGE_COST } },
        }).catch((refundErr) => {
          req.log.error({ userId, refundErr }, 'failed to refund username change cost')
        })
      }
      if (err?.code === 'P2002') {
        return reply.status(409).send({ error: 'Username already taken' })
      }
      throw err
    }
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

  // GET /api/users/me/referral — fetch (and lazily generate) the caller's
  // shareable referral code plus a live count of accepted invites. Also
  // returns `invitedBy` when the caller signed up through someone else's
  // code, so the profile can render a "Invited by @xxx" line. The count
  // is cheap (indexed foreign key) and avoids a second round-trip from the UI.
  // `shareRewardClaimed` lets the ReferralCard hide the one-time +50⭐ CTA
  // once the user has taken it, without a second request.
  fastify.get('/me/referral', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const code = await ensureReferralCode(userId)
    const [invitedCount, me] = await Promise.all([
      prisma.user.count({ where: { referredByUserId: userId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          sharedAppAt: true,
          referredBy: {
            select: { id: true, username: true, avatarUrl: true },
          },
        },
      }),
    ])
    return reply.send({
      code,
      invitedCount,
      invitedBy: me?.referredBy ?? null,
      shareRewardClaimed: !!me?.sharedAppAt,
    })
  })

  // POST /api/users/me/claim-share-reward — one-time star-coin reward for
  // tapping the in-app "share on social media" button. We can't verify that
  // an external share actually happened (no platform exposes a reliable
  // "did user X post URL Y" check), so the reward is trust-on-click —
  // capped at once per account via the `sharedAppAt` column. The updateMany
  // guard (WHERE sharedAppAt IS NULL) makes concurrent claims safe: exactly
  // one row will match, the second gets a 409.
  fastify.post('/me/claim-share-reward', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const { platform } = (req.body ?? {}) as { platform?: string }

    const flip = await prisma.user.updateMany({
      where: { id: userId, sharedAppAt: null },
      data:  { sharedAppAt: new Date() },
    })
    if (flip.count !== 1) {
      req.log.info({ userId, platform }, 'share reward claim blocked: already claimed')
      return reply.status(409).send({ error: 'already_claimed' })
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data:  { starCoins: { increment: SOCIAL_SHARE_REWARD } },
      select: { starCoins: true },
    })

    req.log.info(
      { userId, platform, reward: SOCIAL_SHARE_REWARD },
      'share reward claimed',
    )
    return reply.send({
      starsGranted: SOCIAL_SHARE_REWARD,
      newBalance: updated.starCoins,
    })
  })

  // POST /api/users/me/push-token — register device push token (mobile)
  fastify.post('/me/push-token', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const { token } = req.body as { token?: string }
    if (!token) return reply.status(400).send({ error: 'token is required' })
    await prisma.user.update({ where: { id: userId }, data: { pushToken: token } })
    req.log.info({ userId }, 'push token registered')
    return reply.send({ success: true })
  })

  // DELETE /api/users/me/push-token — unregister push token on logout
  fastify.delete('/me/push-token', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    await prisma.user.update({ where: { id: userId }, data: { pushToken: null } })
    req.log.info({ userId }, 'push token cleared')
    return reply.send({ success: true })
  })

  // PUT /api/users/me/password — change password
  fastify.put('/me/password', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string }
    req.log.info({ userId }, 'password change attempt')

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.passwordHash) {
      req.log.warn({ userId }, 'password change failed: OAuth account has no password')
      return reply.status(400).send({ error: 'OAuth accounts cannot change password' })
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      req.log.warn({ userId }, 'password change failed: current password incorrect')
      return reply.status(401).send({ error: 'Current password is incorrect' })
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashed } })
    req.log.info({ userId }, 'password changed')
    return reply.send({ success: true })
  })

  // DELETE /api/users/me — delete own account
  fastify.delete('/me', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    req.log.warn({ userId }, 'account deletion requested')
    await prisma.user.delete({ where: { id: userId } })
    req.log.warn({ userId }, 'account deleted')
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

    req.log.info({ blockerId, blockedId: userId }, 'user blocked')
    return reply.send({ success: true })
  })

  // DELETE /api/users/:userId/block — unblock a player
  fastify.delete('/:userId/block', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const blockerId = (req.user as { sub: string }).sub
    const { userId } = req.params as { userId: string }
    await prisma.block.deleteMany({ where: { blockerId, blockedId: userId } })
    req.log.info({ blockerId, blockedId: userId }, 'user unblocked')
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
    if (!VALID_REASONS.includes(reason)) {
      req.log.warn({ reporterId, reportedId: userId, reason }, 'invalid report reason')
      return reply.status(400).send({ error: 'Invalid reason' })
    }

    await prisma.report.create({
      data: { reporterId, reportedId: userId, reason, details: details?.slice(0, 500) },
    })

    req.log.warn({ reporterId, reportedId: userId, reason }, 'user reported')
    return reply.send({ success: true })
  })

  // GET /api/users/:id/profile — public profile with stats
  fastify.get('/:id/profile', async (req, reply) => {
    type HonorCount = { type: string; count: number }
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

      const [totalGames, wins, asVillager, asRedHanded, survived] = await Promise.all([
        prisma.gameParticipation.count({
          where: { userId: id, game: gameModeFilter },
        }),
        prisma.gameParticipation.count({
          where: {
            userId: id,
            OR: [
              { role: 'villager',     game: { winnerTeam: 'villagers', ...gameModeFilter } },
              { role: 'detective',    game: { winnerTeam: 'villagers', ...gameModeFilter } },
              { role: 'red_handed',     game: { winnerTeam: 'red_handed', ...gameModeFilter } },
              { role: 'double_agent', game: { winnerTeam: 'red_handed', ...gameModeFilter } },
            ],
          },
        }),
        prisma.gameParticipation.count({
          where: { userId: id, role: { in: ['villager', 'detective'] }, game: gameModeFilter },
        }),
        prisma.gameParticipation.count({
          where: { userId: id, role: { in: ['red_handed', 'double_agent'] }, game: gameModeFilter },
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
        asRedHanded,
        survived,
      }
    }

    // Honors received by this user, bucketed by the gameMode they were
    // gifted in. Honors with no gameId (gifted outside a game) go into the
    // "unranked" bucket.
    //
    // NOTE: Honor has no Prisma relation to Game (only a scalar gameId), so
    // we can't filter through a `game` nested where. Fetch THIS user's honors
    // (small, bounded set) and resolve the gameMode for the games they
    // reference — much cheaper than scanning the full games table, and safe
    // against Postgres parameter limits on large deployments.
    const computeHonorBuckets = async () => {
      const honors = await prisma.honor.findMany({
        where: { receiverId: id },
        select: { type: true, gameId: true },
      })
      if (honors.length === 0) return { ranked: [] as HonorCount[], unranked: [] as HonorCount[] }

      const referencedGameIds = Array.from(
        new Set(honors.map((h) => h.gameId).filter((g): g is string => g !== null)),
      )
      const games = referencedGameIds.length > 0
        ? await prisma.game.findMany({
            where: { id: { in: referencedGameIds } },
            select: { id: true, gameMode: true },
          })
        : []
      const modeById = new Map(games.map((g) => [g.id, g.gameMode]))

      const rankedCounts = new Map<string, number>()
      const unrankedCounts = new Map<string, number>()
      for (const h of honors) {
        const gm = h.gameId ? modeById.get(h.gameId) : undefined
        const bucket = gm === 'ranked' ? rankedCounts : unrankedCounts
        bucket.set(h.type, (bucket.get(h.type) ?? 0) + 1)
      }
      const toArray = (m: Map<string, number>): HonorCount[] =>
        Array.from(m.entries()).map(([type, count]) => ({ type, count }))
      return { ranked: toArray(rankedCounts), unranked: toArray(unrankedCounts) }
    }

    const [statsRanked, statsUnranked, honorBuckets, recentParticipations] = await Promise.all([
      statsForMode('ranked'),
      statsForMode('unranked'),
      computeHonorBuckets(),
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

    const { ranked: honorsRanked, unranked: honorsUnranked } = honorBuckets

    const recentGames = recentParticipations.map((p) => ({
      gameId: p.game.id,
      role: p.role,
      survived: p.survived,
      winnerTeam: p.game.winnerTeam,
      gameMode: p.game.gameMode,
      didWin:
        (p.role === 'villager' && p.game.winnerTeam === 'villagers') ||
        (p.role === 'detective' && p.game.winnerTeam === 'villagers') ||
        (p.role === 'red_handed' && p.game.winnerTeam === 'red_handed') ||
        (p.role === 'double_agent' && p.game.winnerTeam === 'red_handed'),
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
    const asRedHanded = statsRanked.asRedHanded + statsUnranked.asRedHanded
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
        asRedHanded,
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
