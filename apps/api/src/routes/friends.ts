import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/prisma'
import { sendPushNotification } from '../services/push'
import { evaluateEvent } from '../services/achievements'

export const friendsRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /api/friends — list accepted friends
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: { id: true, username: true, avatarUrl: true } },
        addressee: { select: { id: true, username: true, avatarUrl: true } },
      },
      take: 200,
    })
    const friends = friendships.map((f) => ({
      friendshipId: f.id,
      user: f.requesterId === userId ? f.addressee : f.requester,
    }))
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

    const target = toUserId
      ? await prisma.user.findUnique({ where: { id: toUserId } })
      : await prisma.user.findUnique({ where: { username: username! } })
    if (!target) {
      req.log.warn({ userId, targetUsername: username, targetUserId: toUserId }, 'friend request failed: user not found')
      return reply.status(404).send({ error: 'User not found' })
    }
    if (target.id === userId) return reply.status(400).send({ error: 'Cannot add yourself' })

    // Check existing
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
    }

    const friendship = await prisma.friendship.create({
      data: { requesterId: userId, addresseeId: target.id, status: 'pending' },
    })

    req.log.info({ userId, targetUserId: target.id, friendshipId: friendship.id }, 'friend request sent')

    // Real-time notification via socket if target is online
    const targetSocketId = (fastify as any).onlineUsers?.get(target.id)
    if (targetSocketId) {
      const io = (fastify as any).io
      if (io) {
        const requester = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, avatarUrl: true } })
        io.to(targetSocketId).emit('friend:request', { friendshipId: friendship.id, from: { id: userId, ...requester } })
      }
    }

    // Push notification to target user
    if (target.pushToken) {
      const requesterUser = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } })
      sendPushNotification(
        target.pushToken,
        'New Friend Request',
        `${requesterUser?.username ?? 'Someone'} sent you a friend request`,
        { type: 'friend_request', friendshipId: friendship.id },
      ).catch((err) => req.log.error({ err }, 'push: friend request notification error'))
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

    // Notify requester
    const accepter = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } })
    const requesterSocketId = (fastify as any).onlineUsers?.get(f.requesterId)
    if (requesterSocketId) {
      const io = (fastify as any).io
      io?.to(requesterSocketId).emit('friend:accepted', { friendshipId: id, by: { id: userId, username: accepter?.username } })
    }

    // Push notification to requester
    const requester = await prisma.user.findUnique({ where: { id: f.requesterId }, select: { pushToken: true } })
    if (requester?.pushToken) {
      sendPushNotification(
        requester.pushToken,
        'Friend Request Accepted',
        `${accepter?.username ?? 'Someone'} accepted your friend request`,
        { type: 'friend_accepted', friendshipId: id },
      ).catch((err) => req.log.error({ err }, 'push: friend accepted notification error'))
    }

    // Fire friend_added achievement event for BOTH sides of the new friendship.
    const io = (fastify as any).io ?? null
    await Promise.all([
      evaluateEvent(io, 'friend_added', { userId, otherUserId: f.requesterId }),
      evaluateEvent(io, 'friend_added', { userId: f.requesterId, otherUserId: userId }),
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
