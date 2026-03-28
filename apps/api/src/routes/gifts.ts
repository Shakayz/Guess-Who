import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { onlineUsers } from '../socket'

const sendGiftSchema = z.object({
  receiverUsername: z.string().min(1),
  coinAmount:       z.number().int().min(0).optional().default(0),
  cosmeticId:       z.string().optional(),
  message:          z.string().max(200).optional(),
})

export const giftsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate)

  // GET /api/gifts/inbox — gifts received but not yet claimed
  fastify.get('/inbox', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const gifts = await prisma.gift.findMany({
      where: { receiverId: userId, claimed: false },
      include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(gifts)
  })

  // POST /api/gifts/send — send a gift to a friend
  fastify.post('/send', async (req, reply) => {
    const senderId = (req.user as { sub: string }).sub
    const body = sendGiftSchema.parse(req.body)

    if (!body.coinAmount && !body.cosmeticId) {
      return reply.status(400).send({ error: 'Must provide coinAmount or cosmeticId' })
    }

    // Resolve receiver
    const receiver = await prisma.user.findUnique({ where: { username: body.receiverUsername } })
    if (!receiver) return reply.status(404).send({ error: 'User not found' })
    if (receiver.id === senderId) return reply.status(400).send({ error: 'Cannot gift yourself' })

    // Verify friendship
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: senderId, addresseeId: receiver.id },
          { requesterId: receiver.id, addresseeId: senderId },
        ],
      },
    })
    if (!friendship) return reply.status(403).send({ error: 'You can only gift friends' })

    // Deduct sender coins if gifting coins
    if (body.coinAmount > 0) {
      const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { starCoins: true } })
      if (!sender || sender.starCoins < body.coinAmount) {
        return reply.status(400).send({ error: 'Insufficient star coins' })
      }
    }

    const gift = await prisma.$transaction(async (tx) => {
      if (body.coinAmount > 0) {
        await tx.user.update({ where: { id: senderId }, data: { starCoins: { decrement: body.coinAmount } } })
      }
      return tx.gift.create({
        data: {
          senderId,
          receiverId: receiver.id,
          coinAmount: body.coinAmount,
          cosmeticId: body.cosmeticId,
          message: body.message,
        },
        include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
      })
    })

    // Notify receiver if online
    const io = (fastify as any).io
    const receiverSocketId = onlineUsers.get(receiver.id)
    if (io && receiverSocketId) {
      io.to(receiverSocketId).emit('gift:received', {
        giftId: gift.id,
        from: gift.sender,
        coinAmount: gift.coinAmount,
        cosmeticId: gift.cosmeticId,
        message: gift.message,
      })
    }

    return reply.send({ success: true, gift })
  })

  // POST /api/gifts/:id/claim — claim a pending gift
  fastify.post('/:id/claim', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const { id } = req.params as { id: string }

    const gift = await prisma.gift.findUnique({ where: { id } })
    if (!gift) return reply.status(404).send({ error: 'Gift not found' })
    if (gift.receiverId !== userId) return reply.status(403).send({ error: 'Forbidden' })

    // ── Atomic claim: use updateMany with claimed:false filter to prevent double-claim
    // even under concurrent requests (no optimistic locking needed)
    await prisma.$transaction(async (tx) => {
      const result = await tx.gift.updateMany({
        where: { id, claimed: false },
        data:  { claimed: true },
      })
      // If 0 rows updated, gift was already claimed by a concurrent request
      if (result.count === 0) {
        throw Object.assign(new Error('Already claimed'), { statusCode: 409 })
      }
      if (gift.coinAmount > 0) {
        await tx.user.update({ where: { id: userId }, data: { starCoins: { increment: gift.coinAmount } } })
      }
      if (gift.cosmeticId) {
        await tx.userCosmetic.upsert({
          where: { userId_cosmeticId: { userId, cosmeticId: gift.cosmeticId } },
          update: {},
          create: { userId, cosmeticId: gift.cosmeticId },
        })
      }
    }).catch((err: any) => {
      if (err.statusCode === 409) return reply.status(409).send({ error: 'Already claimed' })
      throw err
    })

    return reply.send({ success: true })
  })
}
