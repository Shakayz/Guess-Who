import type { Server, Socket } from 'socket.io'
import { generateRoomCode, MATCHMAKING_CONFIG } from '@imposter/shared'
import type { MatchmakingStatus } from '@imposter/shared'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'
import { onlineUsers } from '../onlineUsers'

const { IDEAL_PLAYERS, MIN_PLAYERS, MAX_WAIT_SECONDS, TICK_INTERVAL_MS, THRESHOLDS } = MATCHMAKING_CONFIG

// ── Per-queue matchmaking windows ──────────────────────────────────────────────

interface MatchmakingWindow {
  startedAt: number
  interval: NodeJS.Timeout
}

const activeWindows = new Map<string, MatchmakingWindow>()

function getCurrentThreshold(elapsedSeconds: number): number {
  let minPlayers = IDEAL_PLAYERS
  for (const t of THRESHOLDS) {
    if (elapsedSeconds >= t.after) minPlayers = t.minPlayers
  }
  return minPlayers
}

function computeImposterCount(playerCount: number): number {
  if (playerCount <= 5) return 1
  if (playerCount <= 8) return 2
  return 3
}

async function broadcastStatus(io: Server<any, any>, queueKey: string, window: MatchmakingWindow) {
  const entries = await redis.lrange(queueKey, 0, -1)
  const elapsed = Math.floor((Date.now() - window.startedAt) / 1000)
  const currentThreshold = getCurrentThreshold(elapsed)

  const status: MatchmakingStatus = {
    queueSize: entries.length,
    needed: currentThreshold,
    elapsed,
    maxWait: MAX_WAIT_SECONDS,
    idealPlayers: IDEAL_PLAYERS,
  }

  for (const raw of entries) {
    try {
      const entry = JSON.parse(raw)
      const sid = onlineUsers.get(entry.userId)
      if (sid) io.to(sid).emit('matchmaking:status' as any, status)
    } catch {}
  }
}

async function executeMatch(io: Server<any, any>, queueKey: string, count: number) {
  // Pop entries from the queue
  const entries: string[] = []
  for (let i = 0; i < count; i++) {
    const e = await redis.lpop(queueKey)
    if (e) entries.push(e)
  }

  // Parse and filter to only online players
  const parsed = entries
    .map((e) => { try { return JSON.parse(e) } catch { return null } })
    .filter(Boolean)

  const players = parsed.filter((p: any) => onlineUsers.has(p.userId))

  if (players.length < MIN_PLAYERS) {
    // Not enough valid players — push all entries back
    for (const e of entries.reverse()) await redis.lpush(queueKey, e)
    return
  }

  // Extract locale from queue key: matchmaking:{gameMode}:{locale}
  const parts = queueKey.split(':')
  const gameMode = parts[1] ?? 'normal'
  const locale = parts[2] ?? 'en'

  const hostPlayer = players[0]
  const imposterCount = computeImposterCount(players.length)

  const room = await prisma.room.create({
    data: {
      code: generateRoomCode(),
      hostId: hostPlayer.userId,
      maxPlayers: IDEAL_PLAYERS,
      imposterCount,
      speakingTimeSeconds: 30,
      votingTimeSeconds: 30,
      isPrivate: false,
      language: locale,
    },
  }).catch(() => null)

  if (!room) {
    // Room creation failed — notify all players
    for (const p of players) {
      const sid = onlineUsers.get(p.userId)
      if (sid) io.to(sid).emit('matchmaking:error' as any, { message: 'Failed to create room. Please try again.' })
    }
    // Push entries back so players can retry
    for (const e of entries.reverse()) await redis.lpush(queueKey, e)
    return
  }

  const matchedCategories: string[] = hostPlayer.categories ?? []

  await redis.set(`room:${room.id}:state`, JSON.stringify({
    status: 'waiting',
    gameMode,
    categories: matchedCategories,
    players: [],
    currentRound: 0,
    maxRounds: 5,
    isMatchmade: true,
    expectedPlayers: players.length,
  }), 'EX', 21600)

  for (const player of players) {
    const sid = onlineUsers.get(player.userId)
    if (sid) io.to(sid).emit('matchmaking:found' as any, { roomCode: room.code })
  }

  // Reset window for remaining players in the queue
  const remaining = await redis.llen(queueKey)
  if (remaining > 0) {
    const window = activeWindows.get(queueKey)
    if (window) window.startedAt = Date.now()
  } else {
    stopMatchmakingWindow(queueKey)
  }
}

async function tickMatchmakingQueue(io: Server<any, any>, queueKey: string, window: MatchmakingWindow) {
  // Simple lock to prevent concurrent tick processing
  const lockKey = `${queueKey}:lock`
  const acquired = await (redis as any).set(lockKey, '1', 'PX', 2000, 'NX')
  if (acquired !== 'OK') return

  try {
    const queueLength = await redis.llen(queueKey)

    if (queueLength === 0) {
      stopMatchmakingWindow(queueKey)
      return
    }

    const elapsedSeconds = Math.floor((Date.now() - window.startedAt) / 1000)
    const currentThreshold = getCurrentThreshold(elapsedSeconds)

    // Broadcast status to all waiting players
    await broadcastStatus(io, queueKey, window)

    // Instant match if we have ideal number of players
    if (queueLength >= IDEAL_PLAYERS) {
      await executeMatch(io, queueKey, IDEAL_PLAYERS)
      return
    }

    // Threshold match
    if (queueLength >= currentThreshold) {
      await executeMatch(io, queueKey, Math.min(queueLength, IDEAL_PLAYERS))
      return
    }

    // Force start at max wait time if we have enough players
    if (elapsedSeconds >= MAX_WAIT_SECONDS && queueLength >= MIN_PLAYERS) {
      await executeMatch(io, queueKey, queueLength)
      return
    }

    // Not enough players even after max wait — reset timer and keep waiting
    if (elapsedSeconds >= MAX_WAIT_SECONDS && queueLength < MIN_PLAYERS) {
      window.startedAt = Date.now()
    }
  } finally {
    await redis.del(lockKey)
  }
}

function startMatchmakingWindow(io: Server<any, any>, queueKey: string) {
  if (activeWindows.has(queueKey)) return

  const window: MatchmakingWindow = {
    startedAt: Date.now(),
    interval: setInterval(() => tickMatchmakingQueue(io, queueKey, window), TICK_INTERVAL_MS),
  }
  activeWindows.set(queueKey, window)
}

function stopMatchmakingWindow(queueKey: string) {
  const window = activeWindows.get(queueKey)
  if (window) {
    clearInterval(window.interval)
    activeWindows.delete(queueKey)
  }
}

/** Called from disconnect handler to tear down empty queue windows */
export async function cleanupEmptyQueue(queueKey: string) {
  const len = await redis.llen(queueKey)
  if (len === 0) stopMatchmakingWindow(queueKey)
}

// ── Socket handlers ────────────────────────────────────────────────────────────

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

    // ── Ranked mode: use instant-match at 4 players (legacy behavior) ──
    if (gameMode === 'ranked') {
      const queueLength = await redis.llen(queueKey)
      socket.emit('matchmaking:status' as any, {
        queueSize: queueLength,
        needed: MIN_PLAYERS,
        elapsed: 0,
        maxWait: 0,
        idealPlayers: MIN_PLAYERS,
      } satisfies MatchmakingStatus)

      if (queueLength >= MIN_PLAYERS) {
        await executeMatch(io, queueKey, MIN_PLAYERS)
      }
      return
    }

    // ── Unranked: start progressive matchmaking window ──
    startMatchmakingWindow(io, queueKey)

    // Send immediate status to the joining player
    const queueLength = await redis.llen(queueKey)
    const window = activeWindows.get(queueKey)
    const elapsed = window ? Math.floor((Date.now() - window.startedAt) / 1000) : 0

    socket.emit('matchmaking:status' as any, {
      queueSize: queueLength,
      needed: getCurrentThreshold(elapsed),
      elapsed,
      maxWait: MAX_WAIT_SECONDS,
      idealPlayers: IDEAL_PLAYERS,
    } satisfies MatchmakingStatus)
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

    // Clean up window if queue is now empty
    await cleanupEmptyQueue(queueKey)
  })
}
