import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/prisma'
import { sendPushNotification } from '../services/push'
import { evaluateEvent } from '../services/achievements'

export const friendsRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /api/friends — list accepted friends with presence (online + last seen)
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: { id: true, username: true, avatarUrl: true, lastSeenAt: true } },
        addressee: { select: { id: true, username: true, avatarUrl: true, lastSeenAt: true } },
      },
      take: 200,
    })
    const online: Map<string, string> | undefined = (fastify as any).onlineUsers
    const friends = friendships.map((f) => {
      const other = f.requesterId === userId ? f.addressee : f.requester
      return {
        friendshipId: f.id,
        user: {
          id: other.id,
          username: other.username,
          avatarUrl: other.avatarUrl,
          lastSeenAt: other.lastSeenAt,
          isOnline: online ? online.has(other.id) : false,
        },
      }
    })
    return reply.send({ friends })
  })

  // GET /api/friends/requests — pending incoming requests
  fastify.get('/requests', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const requests = await prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'pending' },
      include: {
        requester: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({
      requests: requests.map((r) => ({
        friendshipId: r.id,
        from: r.requester,
        createdAt: r.createdAt,
      })),
    })
  })

  // GET /api/friends/requests/outgoing — pending requests the current user sent
  fastify.get('/requests/outgoing', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const requests = await prisma.friendship.findMany({
      where: { requesterId: userId, status: 'pending' },
      include: {
        addressee: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({
      requests: requests.map((r) => ({
        friendshipId: r.id,
        to: r.addressee,
        createdAt: r.createdAt,
      })),
    })
  })

  // POST /api/friends/request — send friend request by username or user id
  fastify.post('/request', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { username, toUserId } = req.body as { username?: string; toUserId?: string }
    if (!username && !toUserId) {
      return reply.status(400).send({ error: 'username or toUserId required' })
    }

    req.log.info({ userId, targetUsername: username, targetUserId: toUserId }, 'friend request attempt')

    // Narrow the select to the fields this handler actually uses. Without it,
    // Prisma generates `SELECT *` which 500s when staging is behind on a
    // migration that added a User column (same drift class as 7c11906's
    // shop self-heal). Only `id` and `pushToken` are read below.
    const targetSelect = { id: true, pushToken: true } as const
    const target = toUserId
      ? await prisma.user.findUnique({ where: { id: toUserId }, select: targetSelect })
      : await prisma.user.findFirst({ where: { username: { equals: username!, mode: 'insensitive' } }, select: targetSelect })
    if (!target) {
      req.log.warn({ userId, targetUsername: username, targetUserId: toUserId }, 'friend request failed: user not found')
      return reply.status(404).send({ error: 'User not found' })
    }
    if (target.id === userId) return reply.status(400).send({ error: 'Cannot add yourself' })

    // Check existing — covers either direction. Any row (regardless of its
    // status string) means we already have a relationship on file, so returning
    // a clean 400 beats falling through and blowing up on the unique index
    // with a Prisma P2002 that Fastify surfaces as a 500.
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: target.id },
          { requesterId: target.id, addresseeId: userId },
        ],
      },
    })
    if (existing) {
      if (existing.status === 'accepted') return reply.status(400).send({ error: 'Already friends' })
      if (existing.status === 'pending') return reply.status(400).send({ error: 'Request already sent' })
      // Any other lingering status (legacy 'declined', etc.) — don't fall
      // through to create() and blow up on the unique index.
      return reply.status(409).send({ error: 'Existing relationship', status: existing.status })
    }

    let friendship
    try {
      friendship = await prisma.friendship.create({
        data: { requesterId: userId, addresseeId: target.id, status: 'pending' },
      })
    } catch (err: any) {
      // P2002 = unique constraint violation on (requesterId, addresseeId).
      // Can happen if two requests race past the existence check above; treat
      // it as "already sent" rather than 500 so the UI can show a useful msg.
      if (err?.code === 'P2002') {
        req.log.warn({ userId, targetUserId: target.id }, 'friend request race: duplicate')
        return reply.status(400).send({ error: 'Request already sent' })
      }
      req.log.error({ err, userId, targetUserId: target.id }, 'friend request: create failed')
      throw err
    }

    req.log.info({ userId, targetUserId: target.id, friendshipId: friendship.id }, 'friend request sent')

    // Side-effects (socket + push). Wrapped so a transient failure in either
    // doesn't poison the successful create — the DB row is already committed
    // and the client should get its 201 back regardless.
    try {
      const io = (fastify as any).io
      if (io) {
        const requester = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, avatarUrl: true } })
        // Emit to the target's per-user room so every tab/device gets the
        // incoming-request popup — not just the most recently connected socket
        // (same multi-tab reasoning as commit 256a8fb for game events).
        io.to(`user:${target.id}`).emit('friend:request', { friendshipId: friendship.id, from: { id: userId, ...requester } })
      }

      if (target.pushToken) {
        const requesterUser = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } })
        sendPushNotification(
          target.pushToken,
          'New Friend Request',
          `${requesterUser?.username ?? 'Someone'} sent you a friend request`,
          { type: 'friend_request', friendshipId: friendship.id },
        ).catch((err) => req.log.error({ err }, 'push: friend request notification error'))
      }
    } catch (err) {
      req.log.error({ err, friendshipId: friendship.id }, 'friend request: side-effect failed (continuing)')
    }

    return reply.status(201).send({ friendship: { id: friendship.id, status: friendship.status } })
  })

  // PUT /api/friends/:id/accept
  fastify.put('/:id/accept', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { id } = req.params as { id: string }
    req.log.info({ userId, friendshipId: id }, 'friend accept attempt')
    const f = await prisma.friendship.findUnique({ where: { id } })
    if (!f || f.addresseeId !== userId) return reply.status(404).send({ error: 'Not found' })
    if (f.status !== 'pending') return reply.status(400).send({ error: 'Not pending' })
    const updated = await prisma.friendship.update({ where: { id }, data: { status: 'accepted' } })
    req.log.info({ userId, friendshipId: id, requesterId: f.requesterId }, 'friend request accepted')

    // Notify requester (every tab/device) AND echo to the accepter's own tabs
    // so both sides' friend lists can refresh and a "now friends" toast can
    // fire on whichever surface the user happens to be looking at.
    const accepter = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } })
    const requester = await prisma.user.findUnique({ where: { id: f.requesterId }, select: { username: true, pushToken: true } })
    const io = (fastify as any).io
    if (io) {
      io.to(`user:${f.requesterId}`).emit('friend:accepted', { friendshipId: id, by: { id: userId, username: accepter?.username } })
      io.to(`user:${userId}`).emit('friend:accepted', { friendshipId: id, by: { id: f.requesterId, username: requester?.username } })
    }

    // Push notification to requester
    if (requester?.pushToken) {
      sendPushNotification(
        requester.pushToken,
        'Friend Request Accepted',
        `${accepter?.username ?? 'Someone'} accepted your friend request`,
        { type: 'friend_accepted', friendshipId: id },
      ).catch((err) => req.log.error({ err }, 'push: friend accepted notification error'))
    }

    // Fire friend_added achievement event for BOTH sides of the new friendship.
    await Promise.all([
      evaluateEvent(io ?? null, 'friend_added', { userId, otherUserId: f.requesterId }),
      evaluateEvent(io ?? null, 'friend_added', { userId: f.requesterId, otherUserId: userId }),
    ]).catch(() => {})

    return reply.send({ friendship: { id: updated.id, status: updated.status } })
  })

  // DELETE /api/friends/:id — decline or unfriend
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { id } = req.params as { id: string }
    req.log.info({ userId, friendshipId: id }, 'friend delete/decline attempt')
    const f = await prisma.friendship.findUnique({ where: { id } })
    if (!f || (f.requesterId !== userId && f.addresseeId !== userId)) {
      return reply.status(404).send({ error: 'Not found' })
    }
    await prisma.friendship.delete({ where: { id } })
    req.log.info({ userId, friendshipId: id }, 'friendship deleted')
    return reply.send({ success: true })
  })
}
