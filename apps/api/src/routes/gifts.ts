import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { PREMIUM_PLANS } from '@red-handed/shared'
import { prisma } from '../config/prisma'
import { onlineUsers } from '../socket'
import { evaluateEvent } from '../services/achievements'

const sendGiftSchema = z.object({
  receiverUsername: z.string().min(1),
  coinAmount:       z.number().int().min(1),
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

  // POST /api/gifts/send — send a star-coin gift to a friend
  fastify.post('/send', async (req, reply) => {
    const senderId = (req.user as { sub: string }).sub
    const body = sendGiftSchema.parse(req.body)

    req.log.info({ senderId, receiverUsername: body.receiverUsername, coinAmount: body.coinAmount }, 'gift send attempt')

    // Resolve receiver
    const receiver = await prisma.user.findFirst({ where: { username: { equals: body.receiverUsername, mode: 'insensitive' } } })
    if (!receiver) {
      req.log.warn({ senderId, receiverUsername: body.receiverUsername }, 'gift failed: receiver not found')
      return reply.status(404).send({ error: 'User not found' })
    }
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

    // Deduct sender coins
    const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { starCoins: true } })
    if (!sender || sender.starCoins < body.coinAmount) {
      return reply.status(400).send({ error: 'Insufficient star coins' })
    }

    const gift = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: senderId }, data: { starCoins: { decrement: body.coinAmount } } })
      // Auto-credit the receiver. Gift is recorded `claimed: true` for
      // history; we no longer require the recipient to open the inbox.
      await tx.user.update({ where: { id: receiver.id }, data: { starCoins: { increment: body.coinAmount } } })
      return tx.gift.create({
        data: {
          senderId,
          receiverId: receiver.id,
          coinAmount: body.coinAmount,
          message: body.message,
          claimed: true,
        },
        include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
      })
    })

    req.log.info({ senderId, receiverId: receiver.id, giftId: gift.id, coinAmount: body.coinAmount }, 'gift sent and credited')

    // Notify receiver if online
    const io = (fastify as any).io
    const receiverSocketId = onlineUsers.get(receiver.id)
    if (io && receiverSocketId) {
      io.to(receiverSocketId).emit('gift:received', {
        giftId: gift.id,
        from: gift.sender,
        coinAmount: gift.coinAmount,
        premiumPlanId: null,
        message: gift.message,
      })
    }

    // Fire gift_sent / gift_received achievement events
    await Promise.all([
      evaluateEvent(io ?? null, 'gift_sent',     { userId: senderId,    otherUserId: receiver.id }),
      evaluateEvent(io ?? null, 'gift_received', { userId: receiver.id, otherUserId: senderId }),
    ]).catch(() => {})

    return reply.send({ success: true, gift })
  })

  // POST /api/gifts/:id/claim — claim a pending gift
  fastify.post('/:id/claim', async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const { id } = req.params as { id: string }
    req.log.info({ userId, giftId: id }, 'gift claim attempt')

    const gift = await prisma.gift.findUnique({ where: { id } })
    if (!gift) {
      req.log.warn({ userId, giftId: id }, 'gift not found')
      return reply.status(404).send({ error: 'Gift not found' })
    }
    if (gift.receiverId !== userId) return reply.status(403).send({ error: 'Forbidden' })

    // Premium gifts extend `receiver.premiumUntil` by the plan's interval,
    // monotonically — if the receiver already has premium past that point
    // (from a Stripe subscription or another gift), the entitlement isn't
    // shortened. This mirrors the server-side `extendPremium` helper used
    // by IAP verify/notification paths.
    const premiumPlan = gift.premiumPlanId
      ? PREMIUM_PLANS.find((p) => p.id === gift.premiumPlanId)
      : undefined
    if (gift.premiumPlanId && !premiumPlan) {
      req.log.error({ giftId: gift.id, planId: gift.premiumPlanId }, 'unknown premium plan on gift')
      return reply.status(500).send({ error: 'Invalid gift' })
    }

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
      if (premiumPlan) {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { premiumUntil: true } })
        const now = Date.now()
        const base = Math.max(user?.premiumUntil?.getTime() ?? 0, now)
        const extended = new Date(
          premiumPlan.interval === 'year'
            ? base + 365 * 24 * 60 * 60 * 1000
            : base + 30  * 24 * 60 * 60 * 1000,
        )
        await tx.user.update({ where: { id: userId }, data: { premiumUntil: extended } })
      }
    }).catch((err: any) => {
      if (err.statusCode === 409) return reply.status(409).send({ error: 'Already claimed' })
      throw err
    })

    req.log.info({ userId, giftId: id }, 'gift claimed')
    return reply.send({ success: true })
  })
}
