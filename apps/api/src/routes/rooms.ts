import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { redis } from '../config/redis'
import { generateRoomCode } from '@imposter/shared'

const createRoomSchema = z.object({
  settings: z.object({
    maxPlayers:           z.number().min(3).max(20).default(10),
    imposterCount:        z.number().min(1).max(4).default(2),
    speakingTimeSeconds:  z.number().min(10).max(120).default(30),
    votingTimeSeconds:    z.number().min(15).max(120).default(30),
    wordPackId:           z.string().default('default'),
    isPrivate:            z.boolean().default(false),
    language:             z.enum(['en', 'fr', 'ar', 'es', 'it', 'pt', 'zh', 'de']).default('en'),
    categories:           z.array(z.string()).default([]),
    gameMode:             z.enum(['normal', 'special', 'ranked']).default('normal'),
  }).optional(),
})

export const roomRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate)

  // ── Check if the player is currently in an active game ──────────────────────
  fastify.get('/active', async (req, reply) => {
    const payload = req.user as { sub: string }
    req.log.info({ userId: payload.sub }, 'checking active game')

    // Find a game the user participates in that hasn't ended yet
    const participation = await prisma.gameParticipation.findFirst({
      where: { userId: payload.sub, game: { endedAt: null } },
      include: {
        game: {
          include: {
            room: { select: { id: true, code: true, hostId: true, maxPlayers: true, imposterCount: true, speakingTimeSeconds: true, votingTimeSeconds: true, wordPackId: true, isPrivate: true, language: true, createdAt: true } },
          },
        },
      },
    })

    if (!participation) {
      return reply.send({ active: false })
    }

    const room = participation.game.room

    // Get current Redis state for live player data
    const stateRaw = await redis.get(`room:${room.id}:state`)
    const state = stateRaw ? JSON.parse(stateRaw) : null

    if (!state || (state.status !== 'in_progress' && state.status !== 'voting')) {
      // Game record exists but Redis state is gone or game ended — not truly active
      return reply.send({ active: false })
    }

    return reply.send({
      active: true,
      roomCode: room.code,
      room: {
        id: room.id,
        code: room.code,
        hostId: room.hostId,
        status: state.status,
        players: state.players ?? [],
        currentRound: state.currentRound ?? 0,
        maxRounds: state.maxRounds ?? 0,
        createdAt: room.createdAt.toISOString(),
        settings: {
          maxPlayers: room.maxPlayers,
          minPlayers: 3,
          imposterCount: room.imposterCount,
          speakingTimeSeconds: room.speakingTimeSeconds,
          votingTimeSeconds: room.votingTimeSeconds,
          wordPackId: room.wordPackId,
          isPrivate: room.isPrivate,
          language: room.language as any,
          gameMode: state.gameMode ?? 'normal',
          categories: state.categories ?? [],
          enableDetective: state.enableDetective ?? false,
          enableDoubleAgent: state.enableDoubleAgent ?? false,
        },
      },
    })
  })

  fastify.post('/', async (req, reply) => {
    const { settings } = createRoomSchema.parse(req.body)
    const payload = req.user as { sub: string }
    req.log.info({ userId: payload.sub, gameMode: settings?.gameMode, isPrivate: settings?.isPrivate }, 'creating room')
    const host = await prisma.user.findUnique({ where: { id: payload.sub }, select: { locale: true } })
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
        language:             settings?.language ?? host?.locale ?? 'en',
      },
    })
    await redis.set(`room:${room.id}:state`, JSON.stringify({
      players: [],
      status: 'waiting',
      categories: settings?.categories ?? [],
      gameMode: settings?.gameMode ?? 'normal',
    }), 'EX', 21600)
    req.log.info({ userId: payload.sub, roomId: room.id, roomCode: room.code }, 'room created')
    return reply.status(201).send(room)
  })

  fastify.get('/:code', async (req, reply) => {
    const { code } = req.params as { code: string }
    req.log.info({ roomCode: code }, 'fetching room')
    const room = await prisma.room.findUnique({ where: { code }, include: { host: { select: { id: true, username: true } } } })
    if (!room) {
      req.log.warn({ roomCode: code }, 'room not found')
      return reply.status(404).send({ error: 'Room not found' })
    }
    return reply.send(room)
  })
}
