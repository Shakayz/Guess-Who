import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { evaluateEvent } from '../services/achievements'

const createPackSchema = z.object({
  name:        z.string().min(1).max(60),
  description: z.string().max(200).optional(),
  locale:      z.enum(['en', 'fr', 'ar', 'es', 'de']).default('en'),
  isPublic:    z.boolean().default(false),
  pairs:       z.array(z.object({
    wordA:      z.string().min(1).max(60),
    wordB:      z.string().min(1).max(60),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    category:   z.string().default('general'),
  })).min(1).max(100),
})

// Returns true iff the caller currently holds an active premium subscription.
// Resolved by reading `premiumUntil` on the user — single source of truth.
async function isCallerPremium(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumUntil: true },
  })
  return !!(u?.premiumUntil && u.premiumUntil.getTime() > Date.now())
}

export const wordPacksRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/word-packs — browse public & approved packs
  //
  // Premium-flagged packs stay in the listing for everyone (so non-premium
  // users can see what they'd unlock), but their `locked` flag lets the UI
  // dim them and route taps to /premium instead of the game. The listing
  // always includes packs the caller authored, regardless of premium status.
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const premium = await isCallerPremium(userId)
    const packs = await prisma.wordPack.findMany({
      where: { OR: [{ isPublic: true, isApproved: true }, { authorId: userId }] },
      include: { _count: { select: { pairs: true } } },
      orderBy: { downloads: 'desc' },
    })
    const withLockFlag = packs.map((p) => ({
      ...p,
      locked: p.isPremium && !premium && p.authorId !== userId,
    }))
    return reply.send(withLockFlag)
  })

  // GET /api/word-packs/my — own packs
  fastify.get('/my', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const packs = await prisma.wordPack.findMany({
      where: { authorId: userId },
      include: { _count: { select: { pairs: true } }, pairs: true },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(packs)
  })

  // GET /api/word-packs/:id — get pack + pairs
  //
  // Premium-flagged packs return 402 (Payment Required) for non-premium
  // callers who don't author the pack. The client routes 402 responses to
  // /premium instead of surfacing a generic error. Owners always get their
  // own packs regardless of the premium flag so they can edit freely.
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const { id } = req.params as { id: string }
    const pack = await prisma.wordPack.findUnique({
      where: { id },
      include: { pairs: true },
    })
    if (!pack) return reply.status(404).send({ error: 'Pack not found' })
    // Only show if public+approved or owned by user
    if (!pack.isApproved && pack.authorId !== userId) {
      return reply.status(403).send({ error: 'Pack not available' })
    }
    if (pack.isPremium && pack.authorId !== userId) {
      const premium = await isCallerPremium(userId)
      if (!premium) {
        return reply.status(402).send({ error: 'premium_required' })
      }
    }
    return reply.send(pack)
  })

  // POST /api/word-packs — create a custom word pack
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const body = createPackSchema.parse(req.body)
    req.log.info({ userId, name: body.name, pairCount: body.pairs.length, isPublic: body.isPublic }, 'creating word pack')

    const pack = await prisma.wordPack.create({
      data: {
        name: body.name,
        description: body.description,
        locale: body.locale,
        isPublic: body.isPublic,
        isApproved: false,  // requires moderation before public
        authorId: userId,
        pairs: {
          create: body.pairs.map((p) => ({
            wordA: p.wordA,
            wordB: p.wordB,
            difficulty: p.difficulty,
            category: p.category,
          })),
        },
      },
      include: { pairs: true },
    })

    req.log.info({ userId, packId: pack.id, name: pack.name }, 'word pack created')
    // Fire word_pack_created achievement event
    await evaluateEvent((fastify as any).io ?? null, 'word_pack_created', { userId }).catch(() => {})
    return reply.status(201).send(pack)
  })

  // DELETE /api/word-packs/:id — delete own pack
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const { id } = req.params as { id: string }
    req.log.info({ userId, packId: id }, 'word pack delete attempt')
    const pack = await prisma.wordPack.findUnique({ where: { id } })
    if (!pack) return reply.status(404).send({ error: 'Pack not found' })
    if (pack.authorId !== userId) {
      req.log.warn({ userId, packId: id }, 'word pack delete forbidden')
      return reply.status(403).send({ error: 'Forbidden' })
    }
    await prisma.wordPack.delete({ where: { id } })
    req.log.info({ userId, packId: id }, 'word pack deleted')
    return reply.send({ success: true })
  })
}
