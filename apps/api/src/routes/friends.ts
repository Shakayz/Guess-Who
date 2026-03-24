import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/prisma'

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

  // POST /api/friends/request — send friend request by username
  fastify.post('/request', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { username } = req.body as { username?: string }
    if (!username) return reply.status(400).send({ error: 'username required' })

    const target = await prisma.user.findUnique({ where: { username } })
    if (!target) return reply.status(404).send({ error: 'User not found' })
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

    // Real-time notification via socket if target is online
    const targetSocketId = (fastify as any).onlineUsers?.get(target.id)
    if (targetSocketId) {
      const io = (fastify as any).io
      if (io) {
        const requester = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, avatarUrl: true } })
        io.to(targetSocketId).emit('friend:request', { friendshipId: friendship.id, from: { id: userId, ...requester } })
      }
    }

    return reply.status(201).send({ friendship: { id: friendship.id, status: friendship.status } })
  })

  // PUT /api/friends/:id/accept
  fastify.put('/:id/accept', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { id } = req.params as { id: string }
    const f = await prisma.friendship.findUnique({ where: { id } })
    if (!f || f.addresseeId !== userId) return reply.status(404).send({ error: 'Not found' })
    if (f.status !== 'pending') return reply.status(400).send({ error: 'Not pending' })
    const updated = await prisma.friendship.update({ where: { id }, data: { status: 'accepted' } })

    // Notify requester
    const requesterSocketId = (fastify as any).onlineUsers?.get(f.requesterId)
    if (requesterSocketId) {
      const io = (fastify as any).io
      const accepter = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } })
      io?.to(requesterSocketId).emit('friend:accepted', { friendshipId: id, by: { id: userId, username: accepter?.username } })
    }

    return reply.send({ friendship: { id: updated.id, status: updated.status } })
  })

  // DELETE /api/friends/:id — decline or unfriend
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { id } = req.params as { id: string }
    const f = await prisma.friendship.findUnique({ where: { id } })
    if (!f || (f.requesterId !== userId && f.addresseeId !== userId)) {
      return reply.status(404).send({ error: 'Not found' })
    }
    await prisma.friendship.delete({ where: { id } })
    return reply.send({ success: true })
  })
}
