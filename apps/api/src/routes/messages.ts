import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/prisma'

export const messagesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/messages/:friendId — last 50 DMs with a friend
  fastify.get('/:friendId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { friendId } = req.params as { friendId: string }

    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })

    // Mark received as read
    await prisma.directMessage.updateMany({
      where: { senderId: friendId, receiverId: userId, read: false },
      data: { read: true },
    })

    return reply.send({ messages })
  })
}
