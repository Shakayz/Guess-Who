import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { redis } from '../config/redis'
import { generateRoomCode } from '@red-handed/shared'

const createRoomSchema = z.object({
  settings: z.object({
    maxPlayers:           z.number().min(3).max(20).default(10),
    redHandedCount:        z.number().min(1).max(6).default(2),
    speakingTimeSeconds:  z.number().min(10).max(120).default(30),
    votingTimeSeconds:    z.number().min(15).max(120).default(30),
    wordPackId:           z.string().default('default'),
    isPrivate:            z.boolean().default(false),
    // Discoverability toggle for Custom Lobbies. When true, the room appears
    // in the public-lobby browser. Has no effect on pricing — the host is
    // only charged when the game actually starts (see startGameForRoom).
    isPublic:             z.boolean().default(false),
    language:             z.enum(['en', 'fr', 'ar', 'es', 'it', 'pt', 'zh', 'de', 'ru', 'hi']).default('en'),
    categories:           z.array(z.string()).default([]),
    gameMode:             z.enum(['normal', 'special', 'ranked']).default('normal'),
    // Vocal mode: per-player speak-out-loud turns (unranked only). Ranked is
    // force-disabled below when the room is actually created.
    vocalMode:                z.boolean().default(false),
    vocalSpeakingTimeSeconds: z.number().min(5).max(60).default(10),
    // Blind role mode (normal-mode only). Players see their word but not
    // their role; roles reveal on elimination / game end.
    blindMode:                z.boolean().default(false),
  })
    .refine(
      (s) => s.gameMode === 'ranked' || s.redHandedCount <= Math.floor(s.maxPlayers / 3),
      {
        message: 'redHandedCount must be at most floor(maxPlayers / 3) (1 redHanded per 3 players)',
        path: ['redHandedCount'],
      },
    )
    .optional(),
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
            room: { select: { id: true, code: true, hostId: true, maxPlayers: true, redHandedCount: true, speakingTimeSeconds: true, votingTimeSeconds: true, wordPackId: true, isPrivate: true, isPublic: true, language: true, createdAt: true } },
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
          redHandedCount: room.redHandedCount,
          speakingTimeSeconds: room.speakingTimeSeconds,
          votingTimeSeconds: room.votingTimeSeconds,
          wordPackId: room.wordPackId,
          isPrivate: room.isPrivate,
          isPublic: room.isPublic,
          language: room.language as any,
          gameMode: state.gameMode ?? 'normal',
          categories: state.categories ?? [],
          enableDetective: state.enableDetective ?? false,
          enableDoubleAgent: state.enableDoubleAgent ?? false,
          vocalMode: state.vocalMode ?? false,
          vocalSpeakingTimeSeconds: state.vocalSpeakingTimeSeconds ?? 10,
          blindMode: state.blindMode ?? false,
        },
      },
    })
  })

  fastify.post('/', async (req, reply) => {
    const { settings } = createRoomSchema.parse(req.body)
    const payload = req.user as { sub: string }
    req.log.info({ userId: payload.sub, gameMode: settings?.gameMode, isPrivate: settings?.isPrivate }, 'creating room')
    const host = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { locale: true },
    })
    const code = generateRoomCode()

    // Ranked games are locked at 10 players / 3 redHanded, regardless of
    // what the client sends. All other modes honour the submitted values.
    const isRanked = settings?.gameMode === 'ranked'
    const rankedMaxPlayers    = 10
    const rankedRedHandedCount = 3

    const isPrivateLobby = settings?.isPrivate === true
    // No coin charge at lobby creation — the host is only billed when the game
    // actually starts (see startGameForRoom in socket/handlers/room.ts). This
    // way a host who creates a lobby but never gets enough players — or simply
    // backs out — never loses coins for a game that didn't happen.
    const room = await prisma.room.create({
      data: {
        code,
        hostId: payload.sub,
        maxPlayers:           isRanked ? rankedMaxPlayers    : (settings?.maxPlayers ?? 10),
        redHandedCount:       isRanked ? rankedRedHandedCount : (settings?.redHandedCount ?? 2),
        speakingTimeSeconds:  settings?.speakingTimeSeconds ?? 30,
        votingTimeSeconds:    settings?.votingTimeSeconds ?? 30,
        wordPackId:           settings?.wordPackId ?? 'default',
        isPrivate:            settings?.isPrivate ?? false,
        // Ranked matchmaking rooms can never be public; only Custom
        // Lobbies (isPrivate=true) opt in to the public browser.
        isPublic:             !isRanked && isPrivateLobby && (settings?.isPublic ?? false),
        language:             settings?.language ?? host?.locale ?? 'en',
      },
    })
    // Ranked never uses vocal mode — it's typed-clue only.
    const vocalMode = !isRanked && (settings?.vocalMode ?? false)
    const vocalSpeakingTimeSeconds = Math.min(60, Math.max(5, settings?.vocalSpeakingTimeSeconds ?? 10))
    // Blind role mode is a normal-mode exclusive.
    const blindMode = (settings?.gameMode ?? 'normal') === 'normal' && !!settings?.blindMode

    await redis.set(`room:${room.id}:state`, JSON.stringify({
      players: [],
      status: 'waiting',
      categories: settings?.categories ?? [],
      gameMode: settings?.gameMode ?? 'normal',
      vocalMode,
      vocalSpeakingTimeSeconds,
      blindMode,
    }), 'EX', 21600)
    req.log.info({ userId: payload.sub, roomId: room.id, roomCode: room.code }, 'room created')
    return reply.status(201).send(room)
  })

  // ── Public lobby browser ─────────────────────────────────────────────
  // Lists every Custom Lobby whose host has opted in to discovery
  // (isPublic=true) and is still in the `waiting` phase. Live player counts
  // come from Redis (the Postgres Room row has no `players` column — it only
  // stores the host-set config).
  fastify.get('/public', async (_req, reply) => {
    const rooms = await prisma.room.findMany({
      where: { isPublic: true, isPrivate: true, status: 'waiting' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { host: { select: { id: true, username: true } } },
    })

    if (rooms.length === 0) {
      return reply.send({ lobbies: [] })
    }

    // Batch the Redis reads — one round-trip instead of N.
    const stateKeys = rooms.map((r) => `room:${r.id}:state`)
    const stateRaws = await redis.mget(...stateKeys)

    // Ghost-lobby reaper: if the socket.io room channel is empty, nobody is
    // actually connected even though Redis still lists players. This happens
    // when every occupant's socket died unexpectedly (e.g. the server crashed
    // mid-lobby and the disconnect handler never ran, or a proxy dropped the
    // WebSocket without a FIN). Close such rooms on sight so they stop
    // appearing in the browser.
    const io = (fastify as any).io as import('socket.io').Server | undefined

    const lobbies = (await Promise.all(rooms.map(async (room, idx) => {
      const raw = stateRaws[idx]
      const state = raw ? JSON.parse(raw) : null
      // Drop stale rows where Redis has evicted the state or the game has
      // already advanced past `waiting` — prevents the browser from
      // surfacing lobbies the host abandoned.
      if (!state || state.status !== 'waiting') return null
      const players = Array.isArray(state.players) ? state.players : []
      // Defensive: empty lobbies are closed by the leave/disconnect handlers,
      // but filter here too so any pre-existing stale row never surfaces.
      if (players.length === 0) return null

      // Liveness check against the socket.io adapter. If no socket is in the
      // `room:<id>` channel, the lobby is a ghost — every previous occupant
      // disconnected without triggering cleanup. Close it and skip.
      const channelSize = io?.sockets?.adapter?.rooms?.get(`room:${room.id}`)?.size ?? 0
      if (channelSize === 0) {
        try {
          await redis.del(`room:${room.id}:state`)
          await prisma.room.update({ where: { id: room.id }, data: { status: 'closed' } })
          fastify.log.info({ roomId: room.id, code: room.code }, 'ghost lobby reaped from /public')
        } catch (err) {
          fastify.log.error({ err, roomId: room.id }, 'ghost lobby reap failed')
        }
        return null
      }

      return {
        code: room.code,
        host: room.host,
        playerCount: players.length,
        maxPlayers: room.maxPlayers,
        gameMode: state.gameMode ?? 'normal',
        categories: state.categories ?? [],
        vocalMode: !!state.vocalMode,
        language: room.language,
        createdAt: room.createdAt.toISOString(),
      }
    })))
      .filter((l): l is NonNullable<typeof l> => l !== null)
      // Full lobbies last — they're not joinable but worth showing as social proof.
      .sort((a, b) => {
        const aFull = a.playerCount >= a.maxPlayers ? 1 : 0
        const bFull = b.playerCount >= b.maxPlayers ? 1 : 0
        return aFull - bFull
      })

    return reply.send({ lobbies })
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
