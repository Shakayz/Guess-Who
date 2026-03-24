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
    const queueKey = `matchmaking:${gameMode}`

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
    const entry = JSON.stringify({ userId, socketId: socket.id, categories: data?.categories ?? [] })
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
        // Unlikely — put back and abort
        for (const e of entries.reverse()) await redis.lpush(queueKey, e)
        return
      }

      const players = entries.map((e) => { try { return JSON.parse(e) } catch { return null } }).filter(Boolean)

      // Create room with first player as host
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
          language: 'en',
        },
      }).catch(() => null)
      if (!room) return

      // Init Redis state
      await redis.set(`room:${room.id}:state`, JSON.stringify({
        status: 'waiting',
        gameMode,
        categories: [],
        players: [],
        currentRound: 0,
        maxRounds: 5,
      }), 'EX', 86400)

      // Notify each matched player
      for (const player of players) {
        io.to(player.socketId).emit('matchmaking:found' as any, { roomCode: room.code })
      }
    }
  })

  socket.on('matchmaking:leave', async (data: { gameMode?: string }) => {
    const gameMode = data?.gameMode ?? 'normal'
    const queueKey = `matchmaking:${gameMode}`
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
