import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { redis } from '../config/redis'
import { generateRoomCode } from '@imposter/shared'

const createRoomSchema = z.object({
  settings: z.object({
    maxPlayers:           z.number().min(4).max(20).default(10),
    imposterCount:        z.number().min(1).max(4).default(2),
    speakingTimeSeconds:  z.number().min(10).max(120).default(30),
    votingTimeSeconds:    z.number().min(15).max(120).default(30),
    wordPackId:           z.string().default('default'),
    isPrivate:            z.boolean().default(false),
    language:             z.enum(['en', 'fr', 'ar', 'es', 'de']).default('en'),
  }).optional(),
})

export const roomRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate)

  fastify.post('/', async (req, reply) => {
    const { settings } = createRoomSchema.parse(req.body)
    const payload = req.user as { sub: string }
    const code = generateRoomCode()
    const room = await prisma.room.create({
      data: {
        code,
        hostId: payload.sub,
        maxPlayers:           settings?.maxPlayers ?? 10,
        imposterCount:        settings?.imposterCount ?? 2,
        speakingTimeSeconds:  settings?.speakingTimeSeconds ?? 30,
        votingTimeSeconds:    settings?.votingTimeSeconds ?? 30,
        wordPackId:           settings?.wordPackId ?? 'default',
        isPrivate:            settings?.isPrivate ?? false,
        language:             settings?.language ?? 'en',
      },
    })
    await redis.set(`room:${room.id}:state`, JSON.stringify({ players: [], status: 'waiting' }), 'EX', 86400)
    return reply.status(201).send(room)
  })

  fastify.get('/:code', async (req, reply) => {
    const { code } = req.params as { code: string }
    const room = await prisma.room.findUnique({ where: { code }, include: { host: { select: { id: true, username: true } } } })
    if (!room) return reply.status(404).send({ error: 'Room not found' })
    return reply.send(room)
  })
}
