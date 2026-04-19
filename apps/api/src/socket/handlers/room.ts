import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents, WordCategory } from '@red-handed/shared'
import { shuffleArray, pickRandomWordPair } from '@red-handed/shared'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'
import { childLogger } from '../../config/logger'
import { startRound, forfeitPlayer } from '../gameLoop'
import { onlineUsers } from '../onlineUsers'
import { sendPushNotifications } from '../../services/push'
import { DAILY_COST } from '../../services/dailyRewards'

const log = childLogger('socket:room')

// Default word pairs when no word pack is configured
const FALLBACK_WORDS = [
  { wordA: 'Apple',   wordB: 'Pear'   },
  { wordA: 'Dog',     wordB: 'Wolf'   },
  { wordA: 'Guitar',  wordB: 'Violin' },
  { wordA: 'Beach',   wordB: 'Desert' },
  { wordA: 'Coffee',  wordB: 'Tea'    },
]

/**
 * Remove a user from a waiting lobby's Redis state. Idempotent and safe to
 * call when the user isn't actually a member. Handles three outcomes:
 *
 *  - Lobby is empty after removal → delete Redis state and flip the Postgres
 *    row to `status='closed'` so the public browser drops it immediately.
 *  - Removed player was the host → promote the next remaining player and
 *    broadcast `room:host-changed`.
 *  - Otherwise → persist the updated state and broadcast `player:left`.
 *
 * Bails out without mutating state if the game has already started
 * (`in_progress` / `voting` / `starting`) — mid-game departures go through
 * `forfeitPlayer` in the `room:leave` handler, not here. Takes a per-room
 * mutex so concurrent joins/leaves can't clobber each other.
 *
 * Returns `true` if the lobby was torn down (last player out).
 */
export async function removeUserFromWaitingLobby(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomId: string,
  userId: string,
  leavingSocketId?: string,
): Promise<boolean> {
  const lockKey = `room:${roomId}:join-lock`
  let lockAcquired = false
  for (let i = 0; i < 15; i++) {
    const result = await (redis as any).set(lockKey, '1', 'PX', 5000, 'NX')
    if (result === 'OK') { lockAcquired = true; break }
    await new Promise((r) => setTimeout(r, 25))
  }
  if (!lockAcquired) {
    log.warn({ roomId, userId }, 'removeUserFromWaitingLobby: could not acquire lock, skipping')
    return false
  }

  try {
    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return false
    const state = JSON.parse(stateRaw)

    // Only this helper's concern — mid-game handling is up to the caller.
    if (state.status !== 'waiting') return false

    const wasMember = Array.isArray(state.players) && state.players.some((p: any) => p.userId === userId)
    if (!wasMember) return false

    state.players = state.players.filter((p: any) => p.userId !== userId)
    const roomKey = `room:${roomId}`

    if (state.players.length === 0) {
      await redis.del(`room:${roomId}:state`)
      await prisma.room.update({
        where: { id: roomId },
        data:  { status: 'closed' },
      }).catch(() => {})
      log.info({ roomId, userId }, 'waiting lobby closed (last player removed)')
      if (leavingSocketId) io.to(roomKey).emit('player:left', leavingSocketId)
      return true
    }

    // Someone remains — reassign host if the leaver was hosting.
    const room = await prisma.room.findUnique({ where: { id: roomId } }).catch(() => null)
    if (room && room.hostId === userId) {
      const newHost = state.players[0]
      newHost.isHost  = true
      newHost.isReady = true
      await prisma.room.update({
        where: { id: roomId },
        data:  { hostId: newHost.userId },
      }).catch(() => {})
      io.to(roomKey).emit('room:host-changed' as any, {
        newHostId:       newHost.userId,
        newHostUsername: newHost.username,
      })
    }

    await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)
    if (leavingSocketId) io.to(roomKey).emit('player:left', leavingSocketId)
    return false
  } finally {
    await redis.del(lockKey).catch(() => {})
  }
}

/** Start a game for a room — used by both game:start handler and matchmaking auto-start */
async function startGameForRoom(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomId: string,
) {
  const startLockKey = `room:${roomId}:start-lock`
  // 30s TTL — covers the full charge + game-creation transaction even under
  // heavy DB latency. The previous 10s value could expire mid-start, which
  // (combined with state.status still being 'waiting') opened a window for a
  // duplicate game:start to re-charge every player.
  const lockAcquired = (await (redis as any).set(startLockKey, '1', 'PX', 30000, 'NX')) === 'OK'
  if (!lockAcquired) return

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) return

    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return
    const state = JSON.parse(stateRaw)

    // 'starting' is our intermediate status that guards against a stale-lock
    // re-entry: even if the Redis lock were to expire, a concurrent game:start
    // will see 'starting' here and bail before any coins are touched.
    if (state.status === 'in_progress' || state.status === 'voting' || state.status === 'starting') return
    if (state.players.length < 3) return
    // All players must be ready (matchmade rooms auto-ready everyone)
    if (state.players.some((p: any) => !p.isReady)) return

    // Pin the Redis state to 'starting' BEFORE we do anything that could
    // fail. Any concurrent call short-circuits on the `state.status ===
    // 'starting'` check above; on failure we rewind to the previous status
    // so the host can retry.
    const previousStatus: string = state.status
    state.status = 'starting'
    // We also consume `hostPrepaid` here when it applies — atomically with
    // the status pin so concurrent `game:start` calls cannot double-spend
    // the prepayment from POST /rooms. The actual *charge* happens inside
    // the big $transaction further down; this flag just tracks whether the
    // host owes money for this specific start.
    const consumedHostPrepaid = room.isPrivate === true && state.hostPrepaid === true
    if (consumedHostPrepaid) {
      state.hostPrepaid = false
    }
    await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)

    // Assign roles
    const players: any[] = shuffleArray([...state.players])
    const redHandedCount = Math.min(room.redHandedCount, Math.floor(players.length / 3))
    const detectiveCount    = Math.max(0, state.detectiveCount    ?? (state.enableDetective   ? 1 : 0))
    const doubleAgentCount  = Math.max(0, state.doubleAgentCount  ?? (state.enableDoubleAgent ? 1 : 0))
    const guardianCount     = Math.max(0, state.guardianCount     ?? 0)
    // ── New special-mode roles ────────────────────────────────────────────────
    // Capped to 1 per game for mayor and jester; infiltrator can go up to 2.
    const mayorCount        = Math.min(1, Math.max(0, state.mayorCount       ?? 0))
    const infiltratorCount  = Math.max(0, state.infiltratorCount ?? 0)
    const jesterCount       = Math.min(1, Math.max(0, state.jesterCount      ?? 0))
    // ── 6-role expansion pack (judge / revenant / kamikaze / corruptor / inverter / evil-twins) ─
    const judgeCount        = Math.min(1, Math.max(0, state.judgeCount       ?? 0))
    const revenantCount     = Math.min(1, Math.max(0, state.revenantCount    ?? 0))
    const kamikazeCount     = Math.min(2, Math.max(0, state.kamikazeCount    ?? 0))
    const corruptorCount    = Math.min(1, Math.max(0, state.corruptorCount   ?? 0))
    const inverterCount     = Math.min(1, Math.max(0, state.inverterCount    ?? 0))
    // evilTwinsEnabled = 0 | 1. When enabled, uses exactly 2 slots (one villager, one redHanded twin).
    const evilTwinsEnabled  = Math.min(1, Math.max(0, state.evilTwinsEnabled ?? 0))
    const evilTwinSlots     = evilTwinsEnabled * 2

    // redHandedCount is the TOTAL evil budget; special evil roles come from within it.
    const specialEvilCount = doubleAgentCount + infiltratorCount + kamikazeCount + corruptorCount + inverterCount + evilTwinsEnabled
    const normalRedHanded = Math.max(0, redHandedCount - specialEvilCount)

    // Safety: total non-villager slots must not exceed player count.
    // redHandedCount already includes special evil roles, so don't double-count.
    const totalSpecial =
      redHandedCount +
      detectiveCount + guardianCount + mayorCount + jesterCount +
      judgeCount + revenantCount +
      evilTwinsEnabled // +1 for twin_villager (villager-side half)
    if (totalSpecial > players.length) {
      log.warn({ roomId, totalSpecial, playerCount: players.length }, 'too many special roles — some will fall through to villager')
    }

    // Cumulative bounds — each role occupies a contiguous slice of the
    // shuffled players array. normalRedHanded fills whatever is left after
    // special evil roles are subtracted from redHandedCount.
    const bounds = {
      redHanded:    normalRedHanded,
      doubleAgent: normalRedHanded + doubleAgentCount,
      infiltrator: normalRedHanded + doubleAgentCount + infiltratorCount,
      kamikaze:    normalRedHanded + doubleAgentCount + infiltratorCount + kamikazeCount,
      corruptor:   normalRedHanded + doubleAgentCount + infiltratorCount + kamikazeCount + corruptorCount,
      inverter:    normalRedHanded + doubleAgentCount + infiltratorCount + kamikazeCount + corruptorCount + inverterCount,
      twinRedHanded: normalRedHanded + doubleAgentCount + infiltratorCount + kamikazeCount + corruptorCount + inverterCount + evilTwinsEnabled,
      detective:   normalRedHanded + doubleAgentCount + infiltratorCount + kamikazeCount + corruptorCount + inverterCount + evilTwinsEnabled + detectiveCount,
      guardian:    normalRedHanded + doubleAgentCount + infiltratorCount + kamikazeCount + corruptorCount + inverterCount + evilTwinsEnabled + detectiveCount + guardianCount,
      mayor:       normalRedHanded + doubleAgentCount + infiltratorCount + kamikazeCount + corruptorCount + inverterCount + evilTwinsEnabled + detectiveCount + guardianCount + mayorCount,
      judge:       normalRedHanded + doubleAgentCount + infiltratorCount + kamikazeCount + corruptorCount + inverterCount + evilTwinsEnabled + detectiveCount + guardianCount + mayorCount + judgeCount,
      revenant:    normalRedHanded + doubleAgentCount + infiltratorCount + kamikazeCount + corruptorCount + inverterCount + evilTwinsEnabled + detectiveCount + guardianCount + mayorCount + judgeCount + revenantCount,
      twinVillager: normalRedHanded + doubleAgentCount + infiltratorCount + kamikazeCount + corruptorCount + inverterCount + evilTwinsEnabled + detectiveCount + guardianCount + mayorCount + judgeCount + revenantCount + evilTwinsEnabled,
      jester:      normalRedHanded + doubleAgentCount + infiltratorCount + kamikazeCount + corruptorCount + inverterCount + evilTwinsEnabled + detectiveCount + guardianCount + mayorCount + judgeCount + revenantCount + evilTwinsEnabled + jesterCount,
    }
    let roleIdx = 0
    players.forEach((p) => {
      if (roleIdx < bounds.redHanded) {
        p.role = 'red_handed'
      } else if (roleIdx < bounds.doubleAgent) {
        p.role = 'double_agent'
      } else if (roleIdx < bounds.infiltrator) {
        p.role = 'infiltrator'
      } else if (roleIdx < bounds.kamikaze) {
        p.role = 'kamikaze'
      } else if (roleIdx < bounds.corruptor) {
        p.role = 'corruptor'
      } else if (roleIdx < bounds.inverter) {
        p.role = 'inverter'
        p.inverterUsed = false
        p.inverterActive = false
      } else if (roleIdx < bounds.twinRedHanded) {
        p.role = 'twin_red_handed'
      } else if (roleIdx < bounds.detective) {
        p.role = 'detective'
        p.detectiveRevealUsed = false
      } else if (roleIdx < bounds.guardian) {
        p.role = 'guardian'
        p.guardianProtectUsed = false
      } else if (roleIdx < bounds.mayor) {
        p.role = 'mayor'
        p.mayorDoubleVoteUsed = false
        p.mayorDoubleActive = false
      } else if (roleIdx < bounds.judge) {
        p.role = 'judge'
      } else if (roleIdx < bounds.revenant) {
        p.role = 'revenant'
      } else if (roleIdx < bounds.twinVillager) {
        p.role = 'twin_villager'
      } else if (roleIdx < bounds.jester) {
        p.role = 'jester'
      } else {
        p.role = 'villager'
      }
      roleIdx++
    })

    // Evil twins pairing: link the two twins so each knows the other.
    if (evilTwinsEnabled) {
      const twinV = players.find((p: any) => p.role === 'twin_villager')
      const twinI = players.find((p: any) => p.role === 'twin_red_handed')
      if (twinV && twinI) {
        twinV.twinPartnerUserId = twinI.userId
        twinI.twinPartnerUserId = twinV.userId
      }
    }

    // ── Log the final role distribution so we can audit assignment fairness
    // from apps/api/logs/api.log when a game feels off.
    const roleDistribution = players.reduce<Record<string, number>>((acc, p) => {
      const key = (p.role as string) ?? 'unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    log.info(
      {
        roomId,
        gameMode: state.gameMode ?? 'normal',
        playerCount: players.length,
        roles: roleDistribution,
      },
      'roles assigned for new game',
    )

    // Pick words. The default path draws from the shared offline pair bank so
    // online/unranked/ranked/create-lobby games use the *exact same* curated
    // pairs as offline mode, locale-aware and with working category filtering.
    // Only custom word packs (room.wordPackId set to a real pack id) still go
    // through the DB — that's where user-authored content lives.
    const selectedCategories: string[] = state.categories ?? []
    const roomLocale: string = (room as any).language ?? 'en'
    let wordPair = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)]
    let wordCategory: string | undefined
    try {
      if (room.wordPackId && room.wordPackId !== 'default') {
        const categoryFilter = selectedCategories.length === 0 ? {} : { category: { in: selectedCategories } }
        const pack = await prisma.wordPack.findUnique({
          where: { id: room.wordPackId },
          include: { pairs: { where: { ...categoryFilter, locale: roomLocale } } },
        })
        if (pack && pack.pairs.length > 0) {
          const pair = pack.pairs[Math.floor(Math.random() * pack.pairs.length)]
          wordPair = { wordA: pair.wordA, wordB: pair.wordB }
          wordCategory = pair.category
        } else {
          const pair = pickRandomWordPair(selectedCategories as WordCategory[], shuffleArray, roomLocale)
          wordPair = { wordA: pair.villagerWord, wordB: pair.redHandedWord }
          wordCategory = pair.category
        }
      } else {
        const pair = pickRandomWordPair(selectedCategories as WordCategory[], shuffleArray, roomLocale)
        wordPair = { wordA: pair.villagerWord, wordB: pair.redHandedWord }
        wordCategory = pair.category
      }
    } catch { /* use FALLBACK_WORDS */ }

    // Randomly swap which word goes to villagers vs redHanded
    if (Math.random() < 0.5) {
      wordPair = { wordA: wordPair.wordB, wordB: wordPair.wordA }
    }

    // ── Atomic: charge 10 ⭐ per game + create Game/Round/GameParticipation in
    // ONE transaction. Before this change the debit and the game-creation
    // lived in TWO separate transactions with ~150 lines of logic between
    // them; if the second transaction failed, coins had already committed
    // and players lost 10 ⭐ with no game. Now any failure — insufficient
    // stars, DB error during game create, anything — rolls the entire thing
    // back so no one is ever charged for a game that didn't start.
    //
    // Three charging cases:
    //   1. Public/matchmade room → every player pays 10 ⭐ at every start.
    //   2. Private lobby, FIRST game → `state.hostPrepaid` flag (set at POST
    //      /rooms) covers it; we already consumed the flag above when pinning
    //      status to 'starting'.
    //   3. Private lobby, subsequent game → charge the host 10 ⭐. The flag
    //      is never re-set (buildResetState drops it), so the host cannot
    //      farm unlimited games on a single 10 ⭐ commitment fee.
    // Premium subscribers play for free — the "Unlimited Games" perk.
    // Resolve premium status for every user who might be charged in this
    // transaction so we can skip their debit without an extra round-trip
    // inside the $transaction.
    const chargeableUserIds = room.isPrivate === false
      ? players.map((p: any) => p.userId as string)
      : (!consumedHostPrepaid ? [room.hostId] : [])
    const premiumRows = chargeableUserIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: chargeableUserIds } },
          select: { id: true, premiumUntil: true },
        })
    const now = Date.now()
    const premiumUserIds = new Set(
      premiumRows
        .filter((u) => u.premiumUntil && u.premiumUntil.getTime() > now)
        .map((u) => u.id),
    )

    let game: { id: string }
    let round: { id: string; roundNumber: number }
    try {
      const result = await prisma.$transaction(async (tx) => {
        if (room.isPrivate === false) {
          // Case 1 — charge everyone except premium subscribers
          for (const p of players) {
            if (premiumUserIds.has(p.userId)) continue
            const debit = await tx.user.updateMany({
              where: { id: p.userId, starCoins: { gte: DAILY_COST } },
              data:  { starCoins: { decrement: DAILY_COST } },
            })
            if (debit.count === 0) {
              const err: any = new Error('INSUFFICIENT_STARS')
              err.failedUserId = p.userId
              throw err
            }
          }
        } else if (!consumedHostPrepaid && !premiumUserIds.has(room.hostId)) {
          // Case 3 — subsequent private-lobby game, charge host (free for premium)
          const debit = await tx.user.updateMany({
            where: { id: room.hostId, starCoins: { gte: DAILY_COST } },
            data:  { starCoins: { decrement: DAILY_COST } },
          })
          if (debit.count === 0) {
            const err: any = new Error('INSUFFICIENT_STARS')
            err.failedUserId = room.hostId
            throw err
          }
        }
        // Case 2 — prepaid, nothing to debit. Flag was already consumed above.
        const game = await tx.game.create({
          data: {
            roomId,
            // Persist gameMode so /profile can filter ranked vs unranked stats
            gameMode: (state.gameMode as string | undefined) ?? 'normal',
          },
        })
        const round = await tx.round.create({
          data: { gameId: game.id, roundNumber: 1, villagerWord: wordPair.wordA, redHandedWord: wordPair.wordB },
        })
        await tx.gameParticipation.createMany({
          data: players.map((p: any) => ({
            gameId: game.id, userId: p.userId, role: p.role, survived: true,
          })),
          skipDuplicates: true,
        })
        return { game, round }
      })
      game = result.game
      round = result.round
    } catch (err: any) {
      // Rewind Redis state on failure — put the status back AND restore the
      // hostPrepaid flag we consumed speculatively, so the host can retry
      // without losing their commitment fee.
      state.status = previousStatus
      if (consumedHostPrepaid) {
        state.hostPrepaid = true
      }
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)
      if (err?.message === 'INSUFFICIENT_STARS') {
        log.warn({ roomId, failedUserId: err.failedUserId }, 'game start refused: insufficient stars (charges rolled back)')
        io.to(`room:${roomId}`).emit('game:start:failed' as any, {
          reason: 'INSUFFICIENT_STARS',
          userId: err.failedUserId ?? '',
          required: DAILY_COST,
        })
      } else {
        log.error({ err, roomId }, 'game start failed — charges rolled back')
        io.to(`room:${roomId}`).emit('game:start:failed' as any, {
          reason: 'INTERNAL',
          userId: '',
          required: DAILY_COST,
        })
      }
      // Release the start-lock immediately so the host can retry.
      await (redis as any).del(startLockKey)
      return
    }

    state.players = players
    state.status = 'in_progress'
    state.gameId = game.id
    state.currentRound = 1
    state.villagerWord = wordPair.wordA
    state.redHandedWord = wordPair.wordB
    state.wordCategory = wordCategory
    state.rounds = [{ id: round.id, roundNumber: 1, votes: [], clues: [],
      speakingOrder: players.map((p: any) => p.userId) }]
    await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)
    await prisma.room.update({ where: { id: roomId }, data: { status: 'in_progress' } })

    const roundPayload = {
      id: round.id, roundNumber: 1,
      speakingOrder: players.map((p: any) => p.userId),
      clues: [], votes: [], eliminatedPlayerId: null, eliminatedRole: null, wordReveal: null,
    }

    io.to(`room:${roomId}`).emit('room:updated', {
      id: room.id, code: room.code, hostId: room.hostId,
      status: 'in_progress', players: state.players,
      currentRound: 1, maxRounds: state.maxRounds ?? 0,
      createdAt: room.createdAt.toISOString(),
      settings: {
        maxPlayers: room.maxPlayers, minPlayers: 3, redHandedCount: room.redHandedCount,
        speakingTimeSeconds: room.speakingTimeSeconds, votingTimeSeconds: room.votingTimeSeconds,
        wordPackId: room.wordPackId, isPrivate: room.isPrivate, isPublic: room.isPublic, language: room.language as any,
        gameMode: state.gameMode ?? 'normal', categories: state.categories ?? [],
        detectiveCount: state.detectiveCount ?? (state.enableDetective ? 1 : 0), doubleAgentCount: state.doubleAgentCount ?? (state.enableDoubleAgent ? 1 : 0),
        guardianCount: state.guardianCount ?? 0,
        mayorCount: state.mayorCount ?? 0,
        infiltratorCount: state.infiltratorCount ?? 0,
        jesterCount: state.jesterCount ?? 0,
        judgeCount: state.judgeCount ?? 0,
        revenantCount: state.revenantCount ?? 0,
        kamikazeCount: state.kamikazeCount ?? 0,
        corruptorCount: state.corruptorCount ?? 0,
        inverterCount: state.inverterCount ?? 0,
        evilTwinsEnabled: state.evilTwinsEnabled ?? 0,
        vocalMode: state.vocalMode ?? false,
        vocalSpeakingTimeSeconds: state.vocalSpeakingTimeSeconds ?? 10,
      },
    } as any)

    // Roles that get the RED_HANDED word. All other roles get the villager word.
    // Kamikaze, corruptor, inverter, twin_red_handed play on the redHanded team
    // and must know the redHanded word. Infiltrator blends in and plays redHanded
    // team but receives the VILLAGER word (the whole point of the role).
    const redHandedWordRoles = new Set([
      'red_handed', 'double_agent', 'kamikaze', 'corruptor', 'inverter', 'twin_red_handed',
    ])

    for (const playerData of players) {
      const getsRedHandedWord = redHandedWordRoles.has(playerData.role)
      const payload = {
        round: roundPayload as any,
        yourWord: getsRedHandedWord ? wordPair.wordB : wordPair.wordA,
        yourRole: playerData.role,
        yourVillagerWord: playerData.role === 'double_agent' ? wordPair.wordA : undefined,
        yourCategory: wordCategory,
      }
      const sid = onlineUsers.get(playerData.userId)
      if (sid) io.to(sid).emit('game:started', payload)
      if (playerData.id && playerData.id !== sid) {
        io.to(playerData.id).emit('game:started', payload)
      }

      // Evil twins: tell each twin about their partner's identity + role.
      if (playerData.twinPartnerUserId) {
        const partner = players.find((pp: any) => pp.userId === playerData.twinPartnerUserId)
        if (partner) {
          const twinPayload = {
            twinUserId: partner.userId,
            twinUsername: partner.username,
            twinRole: partner.role,
          }
          if (sid) io.to(sid).emit('twin:partner' as any, twinPayload)
          if (playerData.id && playerData.id !== sid) {
            io.to(playerData.id).emit('twin:partner' as any, twinPayload)
          }
        }
      }
    }

    // Send push notifications to all players that the game is starting
    const playerUserIds = players.map((p: any) => p.userId)
    const pushUsers = await prisma.user.findMany({
      where: { id: { in: playerUserIds }, pushToken: { not: null } },
      select: { id: true, pushToken: true },
    }).catch(() => [])
    if (pushUsers.length > 0) {
      sendPushNotifications(
        pushUsers
          .filter((u) => u.pushToken)
          .map((u) => ({
            pushToken: u.pushToken!,
            title: 'Game Starting!',
            body: 'Your role has been assigned.',
            data: { type: 'game_start', roomId },
          })),
      ).catch((err) => log.error({ err, roomId }, 'push: game start notification error'))
    }

    setTimeout(() => {
      startRound(io, roomId, room.speakingTimeSeconds, room.votingTimeSeconds)
    }, 3000)
  } finally {
    await redis.del(startLockKey)
  }
}

/** Exported for matchmaking auto-start */
export { startGameForRoom as autoStartMatchmadeGame }

export function registerRoomHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
  const userId: string = (socket as any).userId
  const username: string = (socket as any).username

  socket.on('room:join', async ({ roomCode }) => {
    log.info({ userId, roomCode }, 'room:join attempt')
    try {
      const room = await prisma.room.findUnique({ where: { code: roomCode } })
      if (!room) {
        log.warn({ userId, roomCode }, 'room:join failed: room not found')
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' })
        return
      }

      const joiningUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { locale: true, premiumUntil: true, avatarUrl: true },
      })
      const isPremium = !!(joiningUser?.premiumUntil && joiningUser.premiumUntil.getTime() > Date.now())

      // ── Language check: joiner must speak the room's language ────────────────
      // The host is exempt (they set the room language). Normalize both codes to
      // 2-letter base so 'en-US' matches 'en', etc.
      if (room.hostId !== userId) {
        const playerLocale = (joiningUser?.locale ?? 'en').split('-')[0]
        const roomLanguage = room.language.split('-')[0]
        if (roomLanguage !== playerLocale) {
          socket.emit('error', {
            code: 'LANGUAGE_MISMATCH',
            message: 'This room is in a different language. You can only join rooms that match your language.',
            // Include the room's language so the client can show a CTA
            // ("Switch to Spanish to join") without guessing.
            roomLanguage,
          } as any)
          await socket.leave(`room:${room.id}`)
          return
        }
      }

      // ── Evict from any stale waiting lobbies before joining the new one ──
      // If the player navigated away from a previous lobby page without clicking
      // "Leave" (browser back, creating a new lobby from Home, closing a duplicate
      // tab), the socket is still a member of the old socket.io room AND the old
      // Redis state still lists them as a player. That's how ghost rows ended up
      // in the public browser ("hosted by X" showing 1/10 when X is actually in
      // a different lobby). Evicting here keeps a user in at most one waiting
      // lobby at a time, and tears the old one down if it empties out.
      const staleRoomKeys = [...socket.rooms].filter(
        (r) => r.startsWith('room:') && r !== `room:${room.id}`,
      )
      for (const staleRoomKey of staleRoomKeys) {
        const staleRoomId = staleRoomKey.split(':')[1]
        try {
          await removeUserFromWaitingLobby(io, staleRoomId, userId, socket.id)
        } catch (err) {
          log.error({ err, staleRoomId, userId }, 'failed to evict user from stale lobby on join')
        }
        await socket.leave(staleRoomKey)
      }

      await socket.join(`room:${room.id}`)
      socket.data.roomCode = room.code

      // Atomic join: acquire a short-lived per-room mutex so concurrent joins
      // don't overwrite each other's Redis state.
      const lockKey = `room:${room.id}:join-lock`
      let lockAcquired = false
      for (let i = 0; i < 15; i++) {
        const result = await (redis as any).set(lockKey, '1', 'PX', 5000, 'NX')
        if (result === 'OK') { lockAcquired = true; break }
        await new Promise((r) => setTimeout(r, 25))
      }
      if (!lockAcquired) {
        socket.emit('error', { code: 'ROOM_BUSY', message: 'Room is busy, please try again' })
        await socket.leave(`room:${room.id}`)
        return
      }

      let state: any
      try {
        const stateRaw = await redis.get(`room:${room.id}:state`)
        state = stateRaw ? JSON.parse(stateRaw) : { players: [], status: 'waiting' }
        const alreadyIn = state.players.find((p: any) => p.userId === userId)

        // ── Block kicked players from rejoining this lobby ──────────────────────
        // Host can re-invite to clear the ban (see room:invite handler).
        const bannedList: string[] = Array.isArray(state.bannedUserIds) ? state.bannedUserIds : []
        if (!alreadyIn && room.hostId !== userId && bannedList.includes(userId)) {
          socket.emit('error', { code: 'KICKED_FROM_ROOM', message: 'You were removed from this lobby by the host' })
          await socket.leave(`room:${room.id}`)
          return
        }

        // ── Block forfeited players from rejoining the same game ────────────────
        if (alreadyIn && alreadyIn.status === 'forfeited') {
          socket.emit('error', { code: 'PLAYER_FORFEITED', message: 'You forfeited this game and cannot rejoin' })
          await socket.leave(`room:${room.id}`)
          return
        }

        if (!alreadyIn) {
          // ── Block new joins if game is already running ────────────────────────
          if (state.status === 'in_progress' || state.status === 'voting') {
            socket.emit('error', { code: 'GAME_IN_PROGRESS', message: 'This game is already in progress' })
            await socket.leave(`room:${room.id}`)
            return
          }
          // ── Block if player is currently in another active game ───────────────
          const activeParticipation = await prisma.gameParticipation.findFirst({
            where: { userId, game: { endedAt: null } },
            select: { game: { select: { roomId: true } } },
          }).catch(() => null)
          if (activeParticipation && activeParticipation.game.roomId !== room.id) {
            socket.emit('error', { code: 'ALREADY_IN_GAME', message: 'You are already in an active game. Finish your current game first.' })
            await socket.leave(`room:${room.id}`)
            return
          }
          // ── Block if room is full ─────────────────────────────────────────────
          if (state.players.length >= room.maxPlayers) {
            socket.emit('error', { code: 'ROOM_FULL', message: 'Room is full' })
            await socket.leave(`room:${room.id}`)
            return
          }
          const isMatchmade = state.isMatchmade ?? false
          state.players.push({
            id: socket.id,
            userId,
            username,
            avatarUrl: joiningUser?.avatarUrl ?? null,
            isPremium,
            role: undefined,
            status: 'alive',
            isHost: room.hostId === userId,
            isReady: room.hostId === userId || isMatchmade, // auto-ready in matchmade rooms
            honorGiven: false,
          })
          await redis.set(`room:${room.id}:state`, JSON.stringify(state), 'EX', 21600)
        } else {
          // Reconnection: update socket.id for the existing player entry
          alreadyIn.id = socket.id
          await redis.set(`room:${room.id}:state`, JSON.stringify(state), 'EX', 21600)

          // Re-send word/role + full phase sync if game is already in progress
          if (state.status === 'in_progress' || state.status === 'voting') {
            const getsRedHandedWord = alreadyIn.role === 'red_handed' || alreadyIn.role === 'double_agent'
            const rounds: any[] = state.rounds ?? []
            const currentRoundData = rounds.find((r: any) => r.roundNumber === state.currentRound) ?? null
            socket.emit('game:started', {
              round: currentRoundData,
              yourWord: getsRedHandedWord ? state.redHandedWord : state.villagerWord,
              yourRole: alreadyIn.role,
              yourVillagerWord: alreadyIn.role === 'double_agent' ? state.villagerWord : undefined,
              yourCategory: state.wordCategory,
            })

            // Emit full phase sync so reconnecting client can resume at the correct phase
            const elapsedSeconds = state.phaseStartedAt
              ? Math.floor((Date.now() - state.phaseStartedAt) / 1000)
              : 0
            const timeRemainingSeconds = Math.max(
              0,
              (state.phaseDurationSeconds ?? 0) - elapsedSeconds,
            )
            socket.emit('game:sync', {
              phase: state.status === 'voting' ? 'voting' : 'speaking',
              currentSpeakerId: state.currentSpeakerId ?? null,
              speakingOrder: currentRoundData?.speakingOrder ?? [],
              clues: currentRoundData?.clues ?? [],
              votes: state.tiebreakerActive ? (state.tiebreakerVotes ?? []) : (currentRoundData?.votes ?? []),
              timeRemainingSeconds,
              currentRound: currentRoundData,
              tiebreakerActive: state.tiebreakerActive ?? false,
              tiebreakerPlayerIds: state.tiebreakerPlayerIds ?? [],
              tiebreakerPhase: state.tiebreakerPhase ?? undefined,
            })
          }
        }
      } finally {
        if (lockAcquired) await redis.del(lockKey)
      }

      const roomPayload = {
        id: room.id,
        code: room.code,
        hostId: room.hostId,
        status: state.status,
        players: state.players,
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
          detectiveCount: state.detectiveCount ?? (state.enableDetective ? 1 : 0),
          doubleAgentCount: state.doubleAgentCount ?? (state.enableDoubleAgent ? 1 : 0),
          guardianCount: state.guardianCount ?? 0,
          mayorCount: state.mayorCount ?? 0,
          infiltratorCount: state.infiltratorCount ?? 0,
          jesterCount: state.jesterCount ?? 0,
          judgeCount: state.judgeCount ?? 0,
          revenantCount: state.revenantCount ?? 0,
          kamikazeCount: state.kamikazeCount ?? 0,
          corruptorCount: state.corruptorCount ?? 0,
          inverterCount: state.inverterCount ?? 0,
          evilTwinsEnabled: state.evilTwinsEnabled ?? 0,
          vocalMode: state.vocalMode ?? false,
          vocalSpeakingTimeSeconds: state.vocalSpeakingTimeSeconds ?? 10,
          isMatchmade: state.isMatchmade ?? false,
        },
      }
      io.to(`room:${room.id}`).emit('room:updated', roomPayload as any)

      // ── Auto-start matchmade games when all expected players have joined ──
      if (
        state.isMatchmade &&
        state.status === 'waiting' &&
        state.expectedPlayers &&
        state.players.length >= state.expectedPlayers
      ) {
        // Trigger game start after a short delay for clients to render
        setTimeout(async () => {
          try {
            // Re-check state to avoid starting if status changed
            const freshRaw = await redis.get(`room:${room.id}:state`)
            if (!freshRaw) return
            const freshState = JSON.parse(freshRaw)
            if (freshState.status !== 'waiting') return
            await startGameForRoom(io, room.id)
          } catch (err) {
            log.error({ err, roomId: room.id }, 'matchmaking auto-start error')
          }
        }, 2000)
      }
    } catch (err) {
      log.error({ err, userId, roomCode }, 'room:join error')
      socket.emit('error', { code: 'INTERNAL', message: 'Server error' })
    }
  })

  socket.on('room:settings' as any, async (newSettings: any) => {
    const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
    if (!roomKey) return
    const roomId = roomKey.split(':')[1]
    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room || room.hostId !== userId) return
    log.info({ userId, roomId, roomCode: room.code }, 'room:settings updated by host')

    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return
    const state = JSON.parse(stateRaw)
    // Merge allowed settings fields
    if (newSettings.gameMode)                        state.gameMode = newSettings.gameMode
    if (newSettings.categories !== undefined)         state.categories = newSettings.categories
    if (newSettings.maxRounds         !== undefined) state.maxRounds         = newSettings.maxRounds

    // ── Vocal mode (unranked only) ───────────────────────────────────────────
    if (newSettings.vocalMode !== undefined) {
      state.vocalMode = !!newSettings.vocalMode
    }
    if (typeof newSettings.vocalSpeakingTimeSeconds === 'number') {
      state.vocalSpeakingTimeSeconds = Math.min(60, Math.max(5, Math.round(newSettings.vocalSpeakingTimeSeconds)))
    }
    // Ranked never uses vocal mode — force-disable regardless of what the
    // client sends.
    if (state.gameMode === 'ranked') {
      state.vocalMode = false
    }

    // Special roles only allowed in 'special' mode — force-disable in normal mode
    if (state.gameMode === 'normal') {
      state.detectiveCount    = 0
      state.doubleAgentCount  = 0
      state.guardianCount     = 0
      state.mayorCount        = 0
      state.infiltratorCount  = 0
      state.jesterCount       = 0
      state.judgeCount        = 0
      state.revenantCount     = 0
      state.kamikazeCount     = 0
      state.corruptorCount    = 0
      state.inverterCount     = 0
      state.evilTwinsEnabled  = 0
    } else {
      if (newSettings.detectiveCount    !== undefined) state.detectiveCount    = Math.max(0, Math.min(3, newSettings.detectiveCount))
      if (newSettings.doubleAgentCount  !== undefined) state.doubleAgentCount  = Math.max(0, Math.min(2, newSettings.doubleAgentCount))
      if (newSettings.guardianCount     !== undefined) state.guardianCount     = Math.max(0, Math.min(2, newSettings.guardianCount))
      if (newSettings.mayorCount        !== undefined) state.mayorCount        = Math.max(0, Math.min(1, newSettings.mayorCount))
      if (newSettings.infiltratorCount  !== undefined) state.infiltratorCount  = Math.max(0, Math.min(2, newSettings.infiltratorCount))
      if (newSettings.jesterCount       !== undefined) state.jesterCount       = Math.max(0, Math.min(1, newSettings.jesterCount))
      if (newSettings.judgeCount        !== undefined) state.judgeCount        = Math.max(0, Math.min(1, newSettings.judgeCount))
      if (newSettings.revenantCount     !== undefined) state.revenantCount     = Math.max(0, Math.min(1, newSettings.revenantCount))
      if (newSettings.kamikazeCount     !== undefined) state.kamikazeCount     = Math.max(0, Math.min(2, newSettings.kamikazeCount))
      if (newSettings.corruptorCount    !== undefined) state.corruptorCount    = Math.max(0, Math.min(1, newSettings.corruptorCount))
      if (newSettings.inverterCount     !== undefined) state.inverterCount     = Math.max(0, Math.min(1, newSettings.inverterCount))
      if (newSettings.evilTwinsEnabled  !== undefined) state.evilTwinsEnabled  = Math.max(0, Math.min(1, newSettings.evilTwinsEnabled ? 1 : 0))
    }
    await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)

    // Persist numeric and language settings to Prisma
    const SUPPORTED_LOCALES = ['en', 'fr', 'ar', 'es', 'it', 'pt', 'zh', 'de', 'ru', 'hi']
    const dbUpdate: Record<string, number | string> = {}
    // Min 3 players (was incorrectly clamped to 4 here, even though the rest
    // of the codebase advertises 3 as the minimum).
    if (typeof newSettings.maxPlayers === 'number')          dbUpdate.maxPlayers          = Math.min(20, Math.max(3,   newSettings.maxPlayers))
    if (typeof newSettings.redHandedCount === 'number')       dbUpdate.redHandedCount       = Math.min(6,  Math.max(1,   newSettings.redHandedCount))
    if (typeof newSettings.speakingTimeSeconds === 'number') dbUpdate.speakingTimeSeconds = Math.min(120, Math.max(10, newSettings.speakingTimeSeconds))
    if (typeof newSettings.votingTimeSeconds === 'number')   dbUpdate.votingTimeSeconds   = Math.min(120, Math.max(15, newSettings.votingTimeSeconds))
    if (typeof newSettings.language === 'string' && SUPPORTED_LOCALES.includes(newSettings.language)) dbUpdate.language = newSettings.language

    // Ranked games are locked at 10 players + 3 redHanded. Any client
    // attempt to change these values is ignored.
    if (state.gameMode === 'ranked') {
      dbUpdate.maxPlayers    = 10
      dbUpdate.redHandedCount = 3
    }

    // Enforce the 1/3 redHanded rule on the resolved (final) values, no matter
    // which field changed in this update. redHandedCount must be ≤ floor(maxPlayers/3).
    const finalMaxPlayers = (dbUpdate.maxPlayers as number | undefined) ?? room.maxPlayers
    const finalRedHandedCount = (dbUpdate.redHandedCount as number | undefined) ?? room.redHandedCount
    const evilCap = Math.max(1, Math.floor(finalMaxPlayers / 3))
    const cappedRedHanded = Math.max(1, Math.min(finalRedHandedCount, evilCap))
    if (cappedRedHanded !== finalRedHandedCount) {
      dbUpdate.redHandedCount = cappedRedHanded
    }

    // In special mode, enforce that special evil roles fit within redHandedCount.
    // redHandedCount is the total evil budget; specials must not exceed it.
    if (state.gameMode === 'special') {
      const specialKeys = [
        'doubleAgentCount',
        'infiltratorCount',
        'kamikazeCount',
        'corruptorCount',
        'inverterCount',
        'evilTwinsEnabled',
      ] as const

      let sumSpecialEvil =
        (state.doubleAgentCount ?? 0)
        + (state.infiltratorCount ?? 0)
        + (state.kamikazeCount ?? 0)
        + (state.corruptorCount ?? 0)
        + (state.inverterCount ?? 0)
        + (state.evilTwinsEnabled ?? 0)

      if (sumSpecialEvil > cappedRedHanded) {
        // Reduce in reverse priority order until specials fit within redHandedCount.
        for (let i = specialKeys.length - 1; i >= 0 && sumSpecialEvil > cappedRedHanded; i--) {
          const key = specialKeys[i]
          const current = (state as any)[key] ?? 0
          const excess = sumSpecialEvil - cappedRedHanded
          const reduceBy = Math.min(current, excess)
          ;(state as any)[key] = current - reduceBy
          sumSpecialEvil -= reduceBy
        }
      }
    }
    const updatedRoom = Object.keys(dbUpdate).length > 0
      ? await prisma.room.update({ where: { id: roomId }, data: dbUpdate })
      : room

    const roomPayload = {
      id: updatedRoom.id, code: updatedRoom.code, hostId: updatedRoom.hostId,
      status: state.status, players: state.players,
      currentRound: state.currentRound ?? 0,
      maxRounds: state.maxRounds ?? 0,
      createdAt: updatedRoom.createdAt.toISOString(),
      settings: {
        maxPlayers: updatedRoom.maxPlayers, minPlayers: 3, redHandedCount: updatedRoom.redHandedCount,
        speakingTimeSeconds: updatedRoom.speakingTimeSeconds, votingTimeSeconds: updatedRoom.votingTimeSeconds,
        wordPackId: updatedRoom.wordPackId, isPrivate: updatedRoom.isPrivate, isPublic: updatedRoom.isPublic, language: updatedRoom.language as any,
        gameMode: state.gameMode ?? 'normal', categories: state.categories ?? [],
        detectiveCount: state.detectiveCount ?? (state.enableDetective ? 1 : 0),
        doubleAgentCount: state.doubleAgentCount ?? (state.enableDoubleAgent ? 1 : 0),
        guardianCount: state.guardianCount ?? 0,
        mayorCount: state.mayorCount ?? 0,
        infiltratorCount: state.infiltratorCount ?? 0,
        jesterCount: state.jesterCount ?? 0,
        judgeCount: state.judgeCount ?? 0,
        revenantCount: state.revenantCount ?? 0,
        kamikazeCount: state.kamikazeCount ?? 0,
        corruptorCount: state.corruptorCount ?? 0,
        inverterCount: state.inverterCount ?? 0,
        evilTwinsEnabled: state.evilTwinsEnabled ?? 0,
        vocalMode: state.vocalMode ?? false,
        vocalSpeakingTimeSeconds: state.vocalSpeakingTimeSeconds ?? 10,
        isMatchmade: state.isMatchmade ?? false,
      },
    }
    io.to(`room:${roomId}`).emit('room:updated', roomPayload as any)
  })

  socket.on('player:ready', async (isReady) => {
    const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
    if (!roomKey) return
    const roomId = roomKey.split(':')[1]

    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return
    const state = JSON.parse(stateRaw)

    const player = state.players.find((p: any) => p.userId === userId)
    if (player) {
      player.isReady = isReady
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) return

    const roomPayload = {
      id: room.id, code: room.code, hostId: room.hostId,
      status: state.status, players: state.players,
      currentRound: state.currentRound ?? 0,
      maxRounds: state.maxRounds ?? 0,
      createdAt: room.createdAt.toISOString(),
      settings: {
        maxPlayers: room.maxPlayers, minPlayers: 3, redHandedCount: room.redHandedCount,
        speakingTimeSeconds: room.speakingTimeSeconds, votingTimeSeconds: room.votingTimeSeconds,
        wordPackId: room.wordPackId, isPrivate: room.isPrivate, isPublic: room.isPublic, language: room.language as any,
        gameMode: state.gameMode ?? 'normal', categories: state.categories ?? [],
        detectiveCount: state.detectiveCount ?? (state.enableDetective ? 1 : 0),
        doubleAgentCount: state.doubleAgentCount ?? (state.enableDoubleAgent ? 1 : 0),
        guardianCount: state.guardianCount ?? 0,
        mayorCount: state.mayorCount ?? 0,
        infiltratorCount: state.infiltratorCount ?? 0,
        jesterCount: state.jesterCount ?? 0,
        judgeCount: state.judgeCount ?? 0,
        revenantCount: state.revenantCount ?? 0,
        kamikazeCount: state.kamikazeCount ?? 0,
        corruptorCount: state.corruptorCount ?? 0,
        inverterCount: state.inverterCount ?? 0,
        evilTwinsEnabled: state.evilTwinsEnabled ?? 0,
        vocalMode: state.vocalMode ?? false,
        vocalSpeakingTimeSeconds: state.vocalSpeakingTimeSeconds ?? 10,
        isMatchmade: state.isMatchmade ?? false,
      },
    }
    io.to(`room:${roomId}`).emit('room:updated', roomPayload as any)
  })

  socket.on('game:start', async () => {
    try {
      const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
      if (!roomKey) return
      const roomId = roomKey.split(':')[1]

      const room = await prisma.room.findUnique({ where: { id: roomId } })
      if (!room || room.hostId !== userId) return

      log.info({ userId, roomId, roomCode: room.code }, 'game:start requested by host')
      await startGameForRoom(io, roomId)
    } catch (err) {
      log.error({ err, userId }, 'game:start error')
      socket.emit('error', { code: 'INTERNAL', message: 'Server error' })
    }
  })

  socket.on('detective:reveal', async ({ targetUserId }) => {
    try {
      const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
      if (!roomKey) return
      const roomId = roomKey.split(':')[1]

      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (!stateRaw) return
      const state = JSON.parse(stateRaw)

      const detective = state.players.find((p: any) => p.userId === userId)
      if (!detective || detective.role !== 'detective') return

      if (detective.detectiveRevealUsed) {
        socket.emit('error', { code: 'DETECTIVE_USED', message: 'Reveal already used' })
        return
      }

      const target = state.players.find((p: any) => p.userId === targetUserId)
      if (!target) return

      detective.detectiveRevealUsed = true
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)

      // ── Infiltrator dissimulation ──
      // The Infiltrator plays on the redHanded team but is shown as a plain
      // 'villager' to the Detective. Without this, the Infiltrator would be
      // trivially outed.
      const revealedRole = target.role === 'infiltrator' ? 'villager' : target.role

      socket.emit('detective:result', {
        targetUserId: target.userId,
        targetUsername: target.username,
        role: revealedRole,
      })
    } catch (err) {
      log.error({ err, userId }, 'detective:reveal error')
    }
  })

  // ── Mayor: activate one-shot double-vote for the current voting phase ────────
  socket.on('mayor:activate-double' as any, async () => {
    try {
      const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
      if (!roomKey) return
      const roomId = roomKey.split(':')[1]

      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (!stateRaw) return
      const state = JSON.parse(stateRaw)

      const mayor = state.players.find((p: any) => p.userId === userId)
      if (!mayor || mayor.role !== 'mayor') return

      if (mayor.mayorDoubleVoteUsed) {
        socket.emit('error', { code: 'MAYOR_USED', message: 'Double vote already used' })
        return
      }

      // Can only activate during voting phase
      if (state.status !== 'voting') {
        socket.emit('error', { code: 'MAYOR_WRONG_PHASE', message: 'Can only activate during voting phase' })
        return
      }

      // Mayor must still be alive to use the ability
      if (mayor.status !== 'alive') return

      mayor.mayorDoubleVoteUsed = true
      mayor.mayorDoubleActive = true
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)

      socket.emit('mayor:double-ack' as any, { userId })
      log.info({ userId, roomId }, 'mayor:activate-double used')
    } catch (err) {
      log.error({ err, userId }, 'mayor:activate-double error')
    }
  })

  // ── Inverter: activate one-shot vote inversion for the current voting phase ──
  socket.on('inverter:activate' as any, async () => {
    try {
      const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
      if (!roomKey) return
      const roomId = roomKey.split(':')[1]

      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (!stateRaw) return
      const state = JSON.parse(stateRaw)

      const inverter = state.players.find((p: any) => p.userId === userId)
      if (!inverter || inverter.role !== 'inverter') return
      if (inverter.inverterUsed) {
        socket.emit('error', { code: 'INVERTER_USED', message: 'Inversion already used' })
        return
      }
      if (state.status !== 'voting') {
        socket.emit('error', { code: 'INVERTER_WRONG_PHASE', message: 'Can only activate during voting' })
        return
      }
      if (inverter.status !== 'alive') return

      inverter.inverterUsed = true
      inverter.inverterActive = true
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)

      socket.emit('inverter:activate-ack' as any, { userId })
      log.info({ userId, roomId }, 'inverter:activate used')
    } catch (err) {
      log.error({ err, userId }, 'inverter:activate error')
    }
  })

  // ── Corruptor: pick a target whose votes are silently dropped ───────────────
  // Choose once per game. Persists until the corruptor dies (then auto-cleared).
  socket.on('corruptor:pick-target' as any, async ({ targetUserId }: { targetUserId: string }) => {
    try {
      const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
      if (!roomKey) return
      const roomId = roomKey.split(':')[1]

      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (!stateRaw) return
      const state = JSON.parse(stateRaw)

      const corruptor = state.players.find((p: any) => p.userId === userId)
      if (!corruptor || corruptor.role !== 'corruptor') return
      if (corruptor.corruptorTargetUserId) {
        socket.emit('error', { code: 'CORRUPTOR_USED', message: 'Target already chosen' })
        return
      }
      if (corruptor.status !== 'alive') return
      if (targetUserId === userId) return  // can't corrupt yourself

      const target = state.players.find((p: any) => p.userId === targetUserId && p.status === 'alive')
      if (!target) return

      corruptor.corruptorTargetUserId = targetUserId
      target.corrupted = true
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)

      socket.emit('corruptor:target-ack' as any, { targetUserId, targetUsername: target.username })
      log.info({ userId, roomId, targetUserId }, 'corruptor:pick-target used')
    } catch (err) {
      log.error({ err, userId }, 'corruptor:pick-target error')
    }
  })

  // ── Kamikaze: pick a victim to drag along when eliminated by vote ────────────
  // This handler is only valid while a kamikaze-pending state is active for
  // this player (set by gameLoop on vote-elimination of the kamikaze).
  socket.on('kamikaze:pick-target' as any, async ({ targetUserId }: { targetUserId: string }) => {
    try {
      const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
      if (!roomKey) return
      const roomId = roomKey.split(':')[1]

      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (!stateRaw) return
      const state = JSON.parse(stateRaw)

      if (state.kamikazePendingUserId !== userId) return  // not your turn

      const kamikaze = state.players.find((p: any) => p.userId === userId)
      if (!kamikaze || kamikaze.role !== 'kamikaze') return

      const target = state.players.find((p: any) => p.userId === targetUserId && p.status === 'alive')
      if (!target) return
      if (targetUserId === userId) return  // can't target self

      // Resolve immediately via the gameLoop helper
      const { resolveKamikazeSelection } = await import('../gameLoop')
      await resolveKamikazeSelection(io, roomId, userId, targetUserId)
      log.info({ userId, roomId, targetUserId }, 'kamikaze:pick-target used')
    } catch (err) {
      log.error({ err, userId }, 'kamikaze:pick-target error')
    }
  })

  // ── Judge: decide who to eliminate during a tiebreaker ──────────────────────
  socket.on('judge:pick-elimination' as any, async ({ targetUserId }: { targetUserId: string }) => {
    try {
      const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
      if (!roomKey) return
      const roomId = roomKey.split(':')[1]

      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (!stateRaw) return
      const state = JSON.parse(stateRaw)

      if (state.judgeDecisionPendingUserId !== userId) return

      const judge = state.players.find((p: any) => p.userId === userId)
      if (!judge || judge.role !== 'judge' || judge.status !== 'alive') return

      const tiedIds: string[] = state.tiebreakerPlayerIds ?? []
      if (!tiedIds.includes(targetUserId)) return  // must be one of the tied candidates

      const { resolveJudgeDecision } = await import('../gameLoop')
      await resolveJudgeDecision(io, roomId, userId, targetUserId)
      log.info({ userId, roomId, targetUserId }, 'judge:pick-elimination used')
    } catch (err) {
      log.error({ err, userId }, 'judge:pick-elimination error')
    }
  })

  // ── Guardian: protect a player from elimination (one-time ability) ───────────
  socket.on('guardian:protect' as any, async ({ targetUserId }: { targetUserId: string }) => {
    try {
      const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
      if (!roomKey) return
      const roomId = roomKey.split(':')[1]

      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (!stateRaw) return
      const state = JSON.parse(stateRaw)

      const guardian = state.players.find((p: any) => p.userId === userId)
      if (!guardian || guardian.role !== 'guardian') return

      if (guardian.guardianProtectUsed) {
        socket.emit('error', { code: 'GUARDIAN_USED', message: 'Protection already used' })
        return
      }

      // Can only protect during voting phase
      if (state.status !== 'voting') return

      const target = state.players.find((p: any) => p.userId === targetUserId && p.status === 'alive')
      if (!target) return

      guardian.guardianProtectUsed = true
      target.guardianProtected = true
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)

      socket.emit('guardian:protect-ack' as any, { targetUserId, targetUsername: target.username })
      log.info({ userId, roomId, targetUserId }, 'guardian:protect used')
    } catch (err) {
      log.error({ err, userId }, 'guardian:protect error')
    }
  })

  // ── Forfeit (alive player quits mid-game — guaranteed LP loss) ───────────────
  socket.on('game:forfeit', async () => {
    try {
      const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
      if (!roomKey) return
      const roomId = roomKey.split(':')[1]
      await forfeitPlayer(io, roomId, userId)
      // Leave the socket room so the player stops receiving game events
      await socket.leave(roomKey)
    } catch (err) {
      log.error({ err, userId }, 'game:forfeit error')
    }
  })

  // ── Eliminated player leaves game view (no LP penalty, just removes from state) ──
  socket.on('game:leave-eliminated', async () => {
    try {
      const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
      if (!roomKey) return
      const roomId = roomKey.split(':')[1]

      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (!stateRaw) {
        await socket.leave(roomKey)
        return
      }
      const state = JSON.parse(stateRaw)
      const player = state.players.find((p: any) => p.userId === userId)

      // Only allow leaving if the player is actually eliminated (not forfeited, not alive)
      if (player && player.status === 'eliminated') {
        await socket.leave(roomKey)
      }
    } catch (err) {
      log.error({ err, userId }, 'game:leave-eliminated error')
    }
  })

  socket.on('room:transfer-host', async ({ targetUserId }) => {
    try {
      if (!targetUserId || targetUserId === userId) return
      const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
      if (!roomKey) return
      const roomId = roomKey.split(':')[1]

      const room = await prisma.room.findUnique({ where: { id: roomId } })
      if (!room || room.hostId !== userId) return

      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (!stateRaw) return
      const state = JSON.parse(stateRaw)

      // Host transfer is only meaningful before the game starts — role
      // assignments bake in the current host during game:start.
      if (state.status !== 'waiting') return

      const target = state.players.find((p: any) => p.userId === targetUserId)
      if (!target) return

      state.players.forEach((p: any) => {
        p.isHost = p.userId === targetUserId
        if (p.userId === targetUserId) p.isReady = true
      })
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)
      await prisma.room.update({ where: { id: roomId }, data: { hostId: targetUserId } }).catch(() => {})

      io.to(roomKey).emit('room:host-changed' as any, {
        newHostId:       targetUserId,
        newHostUsername: target.username,
      })

      const roomPayload = {
        id: room.id, code: room.code, hostId: targetUserId,
        status: state.status, players: state.players,
        currentRound: state.currentRound ?? 0,
        maxRounds: state.maxRounds ?? 0,
        createdAt: room.createdAt.toISOString(),
        settings: {
          maxPlayers: room.maxPlayers, minPlayers: 3, redHandedCount: room.redHandedCount,
          speakingTimeSeconds: room.speakingTimeSeconds, votingTimeSeconds: room.votingTimeSeconds,
          wordPackId: room.wordPackId, isPrivate: room.isPrivate, isPublic: room.isPublic, language: room.language as any,
          gameMode: state.gameMode ?? 'normal', categories: state.categories ?? [],
          detectiveCount: state.detectiveCount ?? (state.enableDetective ? 1 : 0),
          doubleAgentCount: state.doubleAgentCount ?? (state.enableDoubleAgent ? 1 : 0),
          guardianCount: state.guardianCount ?? 0,
          mayorCount: state.mayorCount ?? 0,
          infiltratorCount: state.infiltratorCount ?? 0,
          jesterCount: state.jesterCount ?? 0,
          judgeCount: state.judgeCount ?? 0,
          revenantCount: state.revenantCount ?? 0,
          kamikazeCount: state.kamikazeCount ?? 0,
          corruptorCount: state.corruptorCount ?? 0,
          inverterCount: state.inverterCount ?? 0,
          evilTwinsEnabled: state.evilTwinsEnabled ?? 0,
          vocalMode: state.vocalMode ?? false,
          vocalSpeakingTimeSeconds: state.vocalSpeakingTimeSeconds ?? 10,
          isMatchmade: state.isMatchmade ?? false,
        },
      }
      io.to(roomKey).emit('room:updated', roomPayload as any)
      log.info({ userId, roomId, targetUserId }, 'room:transfer-host succeeded')
    } catch (err) {
      log.error({ err, userId, targetUserId }, 'room:transfer-host error')
    }
  })

  socket.on('room:kick-player', async ({ targetUserId }) => {
    try {
      if (!targetUserId || targetUserId === userId) return
      const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
      if (!roomKey) return
      const roomId = roomKey.split(':')[1]

      const room = await prisma.room.findUnique({ where: { id: roomId } })
      if (!room || room.hostId !== userId) return

      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (!stateRaw) return
      const state = JSON.parse(stateRaw)

      // Kicks only make sense in the waiting lobby. Once the game has started,
      // player removal flows through forfeit instead.
      if (state.status !== 'waiting') return

      const target = state.players.find((p: any) => p.userId === targetUserId)
      if (!target) return
      // Host cannot kick themselves through this path (defense-in-depth).
      if (target.isHost) return

      state.players = state.players.filter((p: any) => p.userId !== targetUserId)
      const banned: string[] = Array.isArray(state.bannedUserIds) ? state.bannedUserIds : []
      if (!banned.includes(targetUserId)) banned.push(targetUserId)
      state.bannedUserIds = banned
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)

      // Boot the target's socket from the room channel and notify them.
      const targetSocketId = target.id as string | undefined
      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId)
        if (targetSocket) {
          targetSocket.emit('room:kicked', { byUsername: username })
          await targetSocket.leave(roomKey)
        } else {
          io.to(targetSocketId).emit('room:kicked', { byUsername: username })
        }
      }
      // Also notify the user anywhere else they may be connected (different tab).
      const liveSocketId = onlineUsers.get(targetUserId)
      if (liveSocketId && liveSocketId !== targetSocketId) {
        io.to(liveSocketId).emit('room:kicked', { byUsername: username })
      }

      io.to(roomKey).emit('player:left', targetSocketId ?? '')

      const roomPayload = {
        id: room.id, code: room.code, hostId: room.hostId,
        status: state.status, players: state.players,
        currentRound: state.currentRound ?? 0,
        maxRounds: state.maxRounds ?? 0,
        createdAt: room.createdAt.toISOString(),
        settings: {
          maxPlayers: room.maxPlayers, minPlayers: 3, redHandedCount: room.redHandedCount,
          speakingTimeSeconds: room.speakingTimeSeconds, votingTimeSeconds: room.votingTimeSeconds,
          wordPackId: room.wordPackId, isPrivate: room.isPrivate, isPublic: room.isPublic, language: room.language as any,
          gameMode: state.gameMode ?? 'normal', categories: state.categories ?? [],
          detectiveCount: state.detectiveCount ?? (state.enableDetective ? 1 : 0),
          doubleAgentCount: state.doubleAgentCount ?? (state.enableDoubleAgent ? 1 : 0),
          guardianCount: state.guardianCount ?? 0,
          mayorCount: state.mayorCount ?? 0,
          infiltratorCount: state.infiltratorCount ?? 0,
          jesterCount: state.jesterCount ?? 0,
          judgeCount: state.judgeCount ?? 0,
          revenantCount: state.revenantCount ?? 0,
          kamikazeCount: state.kamikazeCount ?? 0,
          corruptorCount: state.corruptorCount ?? 0,
          inverterCount: state.inverterCount ?? 0,
          evilTwinsEnabled: state.evilTwinsEnabled ?? 0,
          vocalMode: state.vocalMode ?? false,
          vocalSpeakingTimeSeconds: state.vocalSpeakingTimeSeconds ?? 10,
          isMatchmade: state.isMatchmade ?? false,
        },
      }
      io.to(roomKey).emit('room:updated', roomPayload as any)
      log.info({ userId, roomId, targetUserId }, 'room:kick-player succeeded')
    } catch (err) {
      log.error({ err, userId, targetUserId }, 'room:kick-player error')
    }
  })

  socket.on('room:leave', async () => {
    log.info({ userId }, 'room:leave')
    const roomKeys = [...socket.rooms].filter((r) => r.startsWith('room:'))
    for (const roomKey of roomKeys) {
      const roomId = roomKey.split(':')[1]
      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (stateRaw) {
        const state = JSON.parse(stateRaw)
        const isInGame = state.status === 'in_progress' || state.status === 'voting'

        if (isInGame) {
          // Voluntary leave during game = forfeit (guaranteed LP loss).
          // forfeitPlayer persists its own state mutations; we just broadcast.
          await forfeitPlayer(io, roomId, userId)
          io.to(roomKey).emit('player:left', socket.id)
        } else {
          // Waiting lobby: delegate to the shared helper so the empty→close
          // and host-reassignment paths stay consistent with room:join's
          // stale-lobby eviction.
          await removeUserFromWaitingLobby(io, roomId, userId, socket.id)
        }
      }
      await socket.leave(roomKey)
    }
  })
}
