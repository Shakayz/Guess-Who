import type { Server, Socket } from 'socket.io'
import { generateRoomCode, MATCHMAKING_CONFIG, SUPPORTED_LOCALES } from '@red-handed/shared'
import type { MatchmakingStatus } from '@red-handed/shared'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'
import { childLogger } from '../../config/logger'
import { onlineUsers } from '../onlineUsers'
import { DAILY_COST } from '../../services/dailyRewards'
import { sendPushNotifications } from '../../services/push'

async function pushMatchFoundNotifications(userIds: string[], roomCode: string) {
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, pushToken: { not: null } },
      select: { pushToken: true },
    })
    const notifications = users
      .filter((u) => u.pushToken)
      .map((u) => ({
        pushToken: u.pushToken as string,
        title: 'Match found!',
        body: 'Your game is ready — tap to join.',
        data: { type: 'matchmaking_found', roomCode },
      }))
    if (notifications.length > 0) {
      await sendPushNotifications(notifications)
    }
  } catch (err) {
    log.error({ err, roomCode }, 'push: matchmaking notification error')
  }
}

const log = childLogger('socket:matchmaking')

const { IDEAL_PLAYERS, MIN_PLAYERS, MAX_WAIT_SECONDS, TICK_INTERVAL_MS, THRESHOLDS } = MATCHMAKING_CONFIG

// ── Ranked matchmaking config (LoL-inspired LP window widening) ───────────────
const RANKED_PLAYERS = 10
const RANKED_TICK_MS = 2000
const RANKED_LP_THRESHOLDS = [
  { after:  0, lpRange:  50 },   // 0-15s: ±50 LP
  { after: 15, lpRange: 100 },   // 15-30s: ±100 LP
  { after: 30, lpRange: 200 },   // 30-45s: ±200 LP
  { after: 45, lpRange: 400 },   // 45s+: ±400 LP (cap)
]

function getRankedLPRange(elapsedSeconds: number): number {
  let range = 50
  for (const t of RANKED_LP_THRESHOLDS) {
    if (elapsedSeconds >= t.after) range = t.lpRange
  }
  return range
}

// ── Room creation ─────────────────────────────────────────────────────────────
// Dedicated helper so both unranked and ranked matchmaking go through the same
// error-surfacing + retry path. The previous inline `.catch(() => null)` ate
// every Prisma error (unique-constraint collisions, missing columns from a
// half-applied migration, FK violations) and surfaced a generic "Failed to
// create room" to clients with no way to diagnose in the logs.
//
// Behaviour:
//   • Logs the real Prisma error (name + message + code, not the whole stack
//     so prod logs stay readable).
//   • Retries up to 3 times on the unique-constraint path so a rare 6-char
//     code collision doesn't kill a match.
//   • Returns null on terminal failure so callers can bounce players back.

type RoomCreateInput = {
  hostId: string
  maxPlayers: number
  redHandedCount: number
  isPrivate: boolean
  language: string
}

async function createRoomWithRetry(input: RoomCreateInput, ctx: { queueKey: string }) {
  let lastErr: unknown = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await prisma.room.create({
        data: {
          code: generateRoomCode(),
          hostId: input.hostId,
          maxPlayers: input.maxPlayers,
          redHandedCount: input.redHandedCount,
          speakingTimeSeconds: 30,
          votingTimeSeconds: 30,
          isPrivate: input.isPrivate,
          language: input.language,
        },
      })
    } catch (err: any) {
      lastErr = err
      // Prisma P2002 = unique-constraint violation. The only unique column on
      // Room is `code`, so this is always a room-code collision. Retry with a
      // fresh code; any other error is terminal.
      if (err?.code === 'P2002') continue
      break
    }
  }
  const e = lastErr as any
  log.error(
    {
      queueKey: ctx.queueKey,
      hostId: input.hostId,
      errorName: e?.name,
      errorCode: e?.code,
      errorMessage: e?.message,
    },
    'match execute failed: room creation error',
  )
  return null
}

// ── Per-queue matchmaking windows ──────────────────────────────────────────────

interface MatchmakingWindow {
  startedAt: number
  interval: NodeJS.Timeout
}

const activeWindows = new Map<string, MatchmakingWindow>()

function getCurrentThreshold(elapsedSeconds: number): number {
  let minPlayers: number = IDEAL_PLAYERS
  for (const t of THRESHOLDS) {
    if (elapsedSeconds >= t.after) minPlayers = t.minPlayers
  }
  return minPlayers
}

function computeRedHandedCount(playerCount: number): number {
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
    log.warn({ queueKey, requested: count, online: players.length }, 'match execute aborted: not enough online players')
    for (const e of entries.reverse()) await redis.lpush(queueKey, e)
    return
  }

  // Extract locale + vocal flag from queue key: matchmaking:{gameMode}:{locale}[:v1]
  // The trailing `:v1` segment (if present) signals the vocal-mode queue partition.
  const parts = queueKey.split(':')
  const gameMode = parts[1] ?? 'normal'
  const locale = parts[2] ?? 'en'
  const vocalMode = parts[3] === 'v1'

  const hostPlayer = players[0]
  const redHandedCount = computeRedHandedCount(players.length)
  // Clamp vocal speaking time to the same [5, 60] band the lobby editor uses.
  // We take the host's preference; everyone in this queue already opted into
  // vocal mode, so the host sets the exact turn length.
  const vocalSpeakingTimeSeconds = vocalMode
    ? Math.max(5, Math.min(60, Number(hostPlayer?.vocalSpeakingTimeSeconds) || 10))
    : 10

  const room = await createRoomWithRetry({
    hostId: hostPlayer.userId,
    maxPlayers: IDEAL_PLAYERS,
    redHandedCount,
    isPrivate: false,
    language: locale,
  }, { queueKey })

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

  log.info({ queueKey, roomId: room.id, roomCode: room.code, playerCount: players.length }, 'match found')

  // Unranked (normal/special) plays across ALL categories combined, matching
  // ranked. Category filtering is reserved for create-lobby and offline, which
  // are the customizable modes. Queue entries may still carry `categories`
  // from older clients — we intentionally ignore them here.
  const matchedCategories: string[] = []

  await redis.set(`room:${room.id}:state`, JSON.stringify({
    status: 'waiting',
    gameMode,
    categories: matchedCategories,
    players: [],
    currentRound: 0,
    maxRounds: 5,
    isMatchmade: true,
    expectedPlayers: players.length,
    vocalMode,
    vocalSpeakingTimeSeconds,
  }), 'EX', 21600)

  for (const player of players) {
    const sid = onlineUsers.get(player.userId)
    if (sid) io.to(sid).emit('matchmaking:found' as any, { roomCode: room.code })
  }

  // Push to all matched players — covers backgrounded mobile users who
  // minimized the app while queuing.
  pushMatchFoundNotifications(players.map((p) => p.userId), room.code).catch(() => {})

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

/**
 * Ranked matchmaking tick — LP-based skill matching (LoL-inspired).
 * Sorts queue by LP, uses sliding window to find 10 players within LP range.
 * LP range widens over time for each player based on their wait time.
 */
async function tickRankedQueue(io: Server<any, any>, queueKey: string, window: MatchmakingWindow) {
  const lockKey = `${queueKey}:lock`
  const acquired = await (redis as any).set(lockKey, '1', 'PX', 3000, 'NX')
  if (acquired !== 'OK') return

  try {
    const rawEntries = await redis.lrange(queueKey, 0, -1)
    if (rawEntries.length === 0) {
      stopMatchmakingWindow(queueKey)
      return
    }

    // Parse and filter to online players only
    const players = rawEntries
      .map((e) => { try { return JSON.parse(e) } catch { return null } })
      .filter((p: any) => p && onlineUsers.has(p.userId))

    // Broadcast status to all waiting players
    const now = Date.now()
    for (const p of players) {
      const elapsed = Math.floor((now - (p.joinedAt ?? window.startedAt)) / 1000)
      const sid = onlineUsers.get(p.userId)
      if (sid) {
        io.to(sid).emit('matchmaking:status' as any, {
          queueSize: players.length,
          needed: RANKED_PLAYERS,
          elapsed,
          maxWait: 90,
          idealPlayers: RANKED_PLAYERS,
        } satisfies MatchmakingStatus)
      }
    }

    if (players.length < RANKED_PLAYERS) return // not enough yet

    // Sort by LP for sliding window
    players.sort((a: any, b: any) => (a.rankPoints ?? 0) - (b.rankPoints ?? 0))

    // Find the best group of 10 using sliding window
    // The LP range allowed is determined by the LONGEST-waiting player in any candidate group
    for (let i = 0; i <= players.length - RANKED_PLAYERS; i++) {
      const group = players.slice(i, i + RANKED_PLAYERS)
      const minLP = group[0].rankPoints ?? 0
      const maxLP = group[RANKED_PLAYERS - 1].rankPoints ?? 0
      const lpSpread = maxLP - minLP

      // Use the widest LP window among the group (longest waiter gets priority).
      // Premium players get a +15s "head start" on LP window widening so they
      // match faster at the edge of their skill band.
      const widestRange = Math.max(
        ...group.map((p: any) => {
          const elapsed = Math.floor((now - (p.joinedAt ?? window.startedAt)) / 1000)
          const bonus = p.isPremium ? 15 : 0
          return getRankedLPRange(elapsed + bonus)
        })
      )

      if (lpSpread <= widestRange * 2) {
        // Valid match! Remove these players from queue and create match
        for (const p of group) {
          const raw = rawEntries.find((e) => {
            try { return JSON.parse(e).userId === p.userId } catch { return false }
          })
          if (raw) await redis.lrem(queueKey, 1, raw)
        }
        await executeRankedMatch(io, queueKey, group)

        const remaining = await redis.llen(queueKey)
        if (remaining === 0) stopMatchmakingWindow(queueKey)
        else window.startedAt = Date.now()
        return
      }
    }
  } finally {
    await redis.del(lockKey)
  }
}

/** Create a ranked match room for the given 10 players */
async function executeRankedMatch(io: Server<any, any>, queueKey: string, players: any[]) {
  const parts = queueKey.split(':')
  const locale = parts[2] ?? 'en'
  const hostPlayer = players[0]
  // Ranked is locked at exactly 7 villagers + 3 redHanded.
  const redHandedCount = 3

  const room = await createRoomWithRetry({
    hostId: hostPlayer.userId,
    maxPlayers: RANKED_PLAYERS,
    redHandedCount,
    isPrivate: false,
    language: locale,
  }, { queueKey })

  if (!room) {
    for (const p of players) {
      const sid = onlineUsers.get(p.userId)
      if (sid) io.to(sid).emit('matchmaking:error' as any, { message: 'Failed to create room.' })
    }
    return
  }

  log.info({ queueKey, roomId: room.id, roomCode: room.code, playerCount: players.length }, 'ranked match found')

  await redis.set(`room:${room.id}:state`, JSON.stringify({
    status: 'waiting',
    gameMode: 'ranked',
    categories: [], // ranked uses ALL categories
    players: [],
    currentRound: 0,
    maxRounds: 0, // unlimited rounds for ranked
    isMatchmade: true,
    expectedPlayers: players.length,
  }), 'EX', 21600)

  for (const player of players) {
    const sid = onlineUsers.get(player.userId)
    if (sid) io.to(sid).emit('matchmaking:found' as any, { roomCode: room.code })
  }

  pushMatchFoundNotifications(players.map((p) => p.userId), room.code).catch(() => {})
}

function startMatchmakingWindow(io: Server<any, any>, queueKey: string, ranked = false) {
  if (activeWindows.has(queueKey)) return

  const tickMs = ranked ? RANKED_TICK_MS : TICK_INTERVAL_MS
  const tickFn = ranked
    ? () => tickRankedQueue(io, queueKey, window)
    : () => tickMatchmakingQueue(io, queueKey, window)

  const window: MatchmakingWindow = {
    startedAt: Date.now(),
    interval: setInterval(tickFn, tickMs),
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

  socket.on('matchmaking:join', async (data: { gameMode: string; categories: string[]; vocalMode?: boolean; vocalSpeakingTimeSeconds?: number; locale?: string }) => {
    const gameMode = data?.gameMode ?? 'normal'
    // Vocal mode is only valid for unranked queues (normal/special). Ranked is
    // always text-only to keep competitive integrity — mirror the lobby rule.
    const vocalMode = gameMode !== 'ranked' && !!data?.vocalMode
    const vocalSpeakingTimeSeconds = Math.max(5, Math.min(60, Number(data?.vocalSpeakingTimeSeconds) || 10))

    // Fetch user's stored locale + balance from DB. The DB locale is a fallback
    // only — we prefer the language the user has actively selected in the UI
    // header (sent on the join payload) so flag changes group players together
    // immediately instead of waiting for the DB write to round-trip.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true, starCoins: true },
    })
    const requestedLocale = typeof data?.locale === 'string' ? data.locale.split('-')[0].toLowerCase() : ''
    const locale = (SUPPORTED_LOCALES as readonly string[]).includes(requestedLocale)
      ? requestedLocale
      : (user?.locale ?? 'en')

    // Preventive insufficient-stars check — saves the player from waiting in
    // queue only to be kicked out of startGameForRoom with INSUFFICIENT_STARS.
    if ((user?.starCoins ?? 0) < DAILY_COST) {
      log.info({ userId, starCoins: user?.starCoins }, 'matchmaking:join refused: insufficient stars')
      socket.emit('matchmaking:error' as any, {
        reason: 'INSUFFICIENT_STARS',
        required: DAILY_COST,
        message: `You need at least ${DAILY_COST} ⭐ to start a game.`,
      })
      return
    }

    // Partition vocal-opt-in players into their own queue so they never get
    // surprised by a silent lobby (and vice versa). The `:v1` suffix is the
    // signal picked up by executeMatch to flip the room's vocalMode flag.
    const queueKey = vocalMode
      ? `matchmaking:${gameMode}:${locale}:v1`
      : `matchmaking:${gameMode}:${locale}`
    log.info({ userId, gameMode, locale, vocalMode, queueKey }, 'matchmaking:join')

    // Remove stale entries across every supported-locale partition (text +
    // vocal). The user may have switched the language flag or vocal toggle
    // since their last join, and we never want a ghost entry to keep them
    // double-counted in another bucket.
    const staleKeys = SUPPORTED_LOCALES.flatMap((loc) => [
      `matchmaking:${gameMode}:${loc}`,
      `matchmaking:${gameMode}:${loc}:v1`,
    ])
    for (const key of staleKeys) {
      const current = await redis.lrange(key, 0, -1)
      for (const entry of current) {
        try {
          const parsed = JSON.parse(entry)
          if (parsed.userId === userId) {
            await redis.lrem(key, 0, entry)
          }
        } catch {}
      }
    }

    // Fetch rank points + premium status for ranked queue
    const userFull = await prisma.user.findUnique({
      where: { id: userId },
      select: { rankPoints: true, premiumUntil: true },
    })
    const rankPoints = userFull?.rankPoints ?? 0
    const isPremium = !!(userFull?.premiumUntil && userFull.premiumUntil.getTime() > Date.now())

    // Add to queue
    const entry = JSON.stringify({ userId, socketId: socket.id, categories: data?.categories ?? [], locale, rankPoints, isPremium, vocalSpeakingTimeSeconds, joinedAt: Date.now() })
    await redis.rpush(queueKey, entry)
    await redis.expire(queueKey, 300) // 5-min TTL

    // ── Ranked mode: LP-based skill matching with widening window ──
    if (gameMode === 'ranked') {
      startMatchmakingWindow(io, queueKey, true)

      const queueLength = await redis.llen(queueKey)
      socket.emit('matchmaking:status' as any, {
        queueSize: queueLength,
        needed: RANKED_PLAYERS,
        elapsed: 0,
        maxWait: 90,
        idealPlayers: RANKED_PLAYERS,
      } satisfies MatchmakingStatus)
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
    // We can't trust user.locale from the DB anymore — joins now key on the
    // UI-selected language, which may differ from the stored locale. Scan
    // every supported-locale partition (text + vocal) so we never leave a
    // ghost entry behind. The list is small (~10) so it's cheap.
    const queueKeys = SUPPORTED_LOCALES.flatMap((loc) => [
      `matchmaking:${gameMode}:${loc}`,
      `matchmaking:${gameMode}:${loc}:v1`,
    ])
    log.info({ userId, gameMode }, 'matchmaking:leave')
    for (const queueKey of queueKeys) {
      const current = await redis.lrange(queueKey, 0, -1)
      for (const entry of current) {
        try {
          if (JSON.parse(entry).userId === userId) {
            await redis.lrem(queueKey, 0, entry)
            break
          }
        } catch {}
      }
    }
    socket.emit('matchmaking:left' as any, {})

    // Clean up windows if queues are now empty
    for (const queueKey of queueKeys) {
      await cleanupEmptyQueue(queueKey)
    }
  })
}
