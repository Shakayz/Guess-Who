import type { Server, Socket } from 'socket.io'
import { generateRoomCode } from '@imposter/shared'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'

const QUEUE_MIN = 4

export function registerMatchmakingHandlers(
  io: Server<any, any>,
  socket: Socket<any, any>,
) {
  const userId: string = (socket as any).userId

  socket.on('matchmaking:join', async (data: { gameMode: string; categories: string[] }) => {
    const gameMode = data?.gameMode ?? 'normal'

    // Fetch user's locale from DB — the queue is language-scoped
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } })
    const locale = user?.locale ?? 'en'
    const queueKey = `matchmaking:${gameMode}:${locale}`

    // Remove stale entry if any (in case of reconnect)
    const current = await redis.lrange(queueKey, 0, -1)
    for (const entry of current) {
      try {
        const parsed = JSON.parse(entry)
        if (parsed.userId === userId) {
          await redis.lrem(queueKey, 0, entry)
        }
      } catch {}
    }

    // Add to queue
    const entry = JSON.stringify({ userId, socketId: socket.id, categories: data?.categories ?? [], locale })
    await redis.rpush(queueKey, entry)
    await redis.expire(queueKey, 300) // 5-min TTL

    const queueLength = await redis.llen(queueKey)
    socket.emit('matchmaking:status' as any, { queueSize: queueLength, needed: QUEUE_MIN })

    if (queueLength >= QUEUE_MIN) {
      // Pop exactly QUEUE_MIN entries
      const entries: string[] = []
      for (let i = 0; i < QUEUE_MIN; i++) {
        const e = await redis.lpop(queueKey)
        if (e) entries.push(e)
      }
      if (entries.length < QUEUE_MIN) {
        for (const e of entries.reverse()) await redis.lpush(queueKey, e)
        return
      }

      const players = entries
        .map((e) => { try { return JSON.parse(e) } catch { return null } })
        .filter(Boolean)

      if (players.length < QUEUE_MIN) {
        for (const e of entries.reverse()) await redis.lpush(queueKey, e)
        return
      }

      // Create room with first player as host, using shared locale
      const hostPlayer = players[0]
      const room = await prisma.room.create({
        data: {
          code: generateRoomCode(),
          hostId: hostPlayer.userId,
          maxPlayers: 10,
          imposterCount: 2,
          speakingTimeSeconds: 30,
          votingTimeSeconds: 30,
          isPrivate: false,
          language: locale,
        },
      }).catch(() => null)

      if (!room) {
        for (const p of players) {
          io.to(p.socketId).emit('matchmaking:error' as any, { message: 'Failed to create room. Please try again.' })
        }
        return
      }

      await redis.set(`room:${room.id}:state`, JSON.stringify({
        status: 'waiting',
        gameMode,
        categories: [],
        players: [],
        currentRound: 0,
        maxRounds: 5,
      }), 'EX', 86400)

      for (const player of players) {
        io.to(player.socketId).emit('matchmaking:found' as any, { roomCode: room.code })
      }
    }
  })

  socket.on('matchmaking:leave', async (data: { gameMode?: string }) => {
    const gameMode = data?.gameMode ?? 'normal'
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } })
    const locale = user?.locale ?? 'en'
    const queueKey = `matchmaking:${gameMode}:${locale}`
    const current = await redis.lrange(queueKey, 0, -1)
    for (const entry of current) {
      try {
        if (JSON.parse(entry).userId === userId) {
          await redis.lrem(queueKey, 0, entry)
          break
        }
      } catch {}
    }
    socket.emit('matchmaking:left' as any, {})
  })
}
