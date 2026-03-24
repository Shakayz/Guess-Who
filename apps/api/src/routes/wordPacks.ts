import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma'

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

export const wordPacksRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/word-packs — browse public & approved packs
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const packs = await prisma.wordPack.findMany({
      where: { OR: [{ isPublic: true, isApproved: true }, { authorId: (req.user as any).sub }] },
      include: { _count: { select: { pairs: true } } },
      orderBy: { downloads: 'desc' },
    })
    return reply.send(packs)
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
    return reply.send(pack)
  })

  // POST /api/word-packs — create a custom word pack
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const body = createPackSchema.parse(req.body)

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

    return reply.status(201).send(pack)
  })

  // DELETE /api/word-packs/:id — delete own pack
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    const { id } = req.params as { id: string }
    const pack = await prisma.wordPack.findUnique({ where: { id } })
    if (!pack) return reply.status(404).send({ error: 'Pack not found' })
    if (pack.authorId !== userId) return reply.status(403).send({ error: 'Forbidden' })
    await prisma.wordPack.delete({ where: { id } })
    return reply.send({ success: true })
  })
}
