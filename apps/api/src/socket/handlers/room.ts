import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { shuffleArray } from '@imposter/shared'
import pino from 'pino'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'
import { startRound, forfeitPlayer } from '../gameLoop'
import { onlineUsers } from '../onlineUsers'
import { sendPushNotifications } from '../../services/push'

const log = pino({ name: 'socket:room' })

// Default word pairs when no word pack is configured
const FALLBACK_WORDS = [
  { wordA: 'Apple',   wordB: 'Pear'   },
  { wordA: 'Dog',     wordB: 'Wolf'   },
  { wordA: 'Guitar',  wordB: 'Violin' },
  { wordA: 'Beach',   wordB: 'Desert' },
  { wordA: 'Coffee',  wordB: 'Tea'    },
]

/** Start a game for a room — used by both game:start handler and matchmaking auto-start */
async function startGameForRoom(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomId: string,
) {
  const startLockKey = `room:${roomId}:start-lock`
  const lockAcquired = (await (redis as any).set(startLockKey, '1', 'PX', 10000, 'NX')) === 'OK'
  if (!lockAcquired) return

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) return

    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return
    const state = JSON.parse(stateRaw)

    if (state.status === 'in_progress' || state.status === 'voting') return
    if (state.players.length < 3) return
    // All players must be ready (matchmade rooms auto-ready everyone)
    if (state.players.some((p: any) => !p.isReady)) return

    // Assign roles
    const players: any[] = shuffleArray([...state.players])
    const imposterCount = Math.min(room.imposterCount, Math.floor(players.length / 3))
    const detectiveCount   = Math.max(0, state.detectiveCount   ?? (state.enableDetective   ? 1 : 0))
    const doubleAgentCount = Math.max(0, state.doubleAgentCount ?? (state.enableDoubleAgent ? 1 : 0))
    const guardianCount    = Math.max(0, state.guardianCount ?? 0)

    let roleIdx = 0
    players.forEach((p) => {
      if (roleIdx < imposterCount) {
        p.role = 'imposter'
      } else if (roleIdx < imposterCount + doubleAgentCount) {
        p.role = 'double_agent'
      } else if (roleIdx < imposterCount + doubleAgentCount + detectiveCount) {
        p.role = 'detective'
        p.detectiveRevealUsed = false
      } else if (roleIdx < imposterCount + doubleAgentCount + detectiveCount + guardianCount) {
        p.role = 'guardian'
        p.guardianProtectUsed = false
      } else {
        p.role = 'villager'
      }
      roleIdx++
    })

    // Pick words
    const selectedCategories: string[] = state.categories ?? []
    let wordPair = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)]
    try {
      const categoryFilter = selectedCategories.length === 0 ? {} : { category: { in: selectedCategories } }
      const roomLocale: string = (room as any).language ?? 'en'
      const pack = room.wordPackId && room.wordPackId !== 'default'
        ? await prisma.wordPack.findUnique({
            where: { id: room.wordPackId },
            include: { pairs: { where: { ...categoryFilter, locale: roomLocale } } },
          })
        : await prisma.wordPack.findFirst({
            where: { isPremium: false, isApproved: true, locale: roomLocale, authorId: null },
            include: { pairs: { where: categoryFilter } },
          })
      if (pack && pack.pairs.length > 0) {
        const pair = pack.pairs[Math.floor(Math.random() * pack.pairs.length)]
        wordPair = { wordA: pair.wordA, wordB: pair.wordB }
      }
    } catch { /* use fallback */ }

    // Randomly swap which word goes to villagers vs imposters
    if (Math.random() < 0.5) {
      wordPair = { wordA: wordPair.wordB, wordB: wordPair.wordA }
    }

    const { game, round } = await prisma.$transaction(async (tx) => {
      const game = await tx.game.create({ data: { roomId } })
      const round = await tx.round.create({
        data: { gameId: game.id, roundNumber: 1, villagerWord: wordPair.wordA, imposterWord: wordPair.wordB },
      })
      await tx.gameParticipation.createMany({
        data: players.map((p: any) => ({
          gameId: game.id, userId: p.userId, role: p.role, survived: true,
        })),
        skipDuplicates: true,
      })
      return { game, round }
    })

    state.players = players
    state.status = 'in_progress'
    state.gameId = game.id
    state.currentRound = 1
    state.villagerWord = wordPair.wordA
    state.imposterWord = wordPair.wordB
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
        maxPlayers: room.maxPlayers, minPlayers: 3, imposterCount: room.imposterCount,
        speakingTimeSeconds: room.speakingTimeSeconds, votingTimeSeconds: room.votingTimeSeconds,
        wordPackId: room.wordPackId, isPrivate: room.isPrivate, language: room.language as any,
        gameMode: state.gameMode ?? 'normal', categories: state.categories ?? [],
        detectiveCount: state.detectiveCount ?? (state.enableDetective ? 1 : 0), doubleAgentCount: state.doubleAgentCount ?? (state.enableDoubleAgent ? 1 : 0),
        guardianCount: state.guardianCount ?? 0,
      },
    } as any)

    for (const playerData of players) {
      const getsImposterWord = playerData.role === 'imposter' || playerData.role === 'double_agent'
      const payload = {
        round: roundPayload as any,
        yourWord: getsImposterWord ? wordPair.wordB : wordPair.wordA,
        yourRole: playerData.role,
        yourVillagerWord: playerData.role === 'double_agent' ? wordPair.wordA : undefined,
      }
      const sid = onlineUsers.get(playerData.userId)
      if (sid) io.to(sid).emit('game:started', payload)
      if (playerData.id && playerData.id !== sid) {
        io.to(playerData.id).emit('game:started', payload)
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

      // ── Language check: joiner must speak the room's language ────────────────
      // The host is exempt (they set the room language). Normalize both codes to
      // 2-letter base so 'en-US' matches 'en', etc.
      if (room.hostId !== userId) {
        const playerUser = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } })
        const playerLocale = (playerUser?.locale ?? 'en').split('-')[0]
        const roomLanguage = room.language.split('-')[0]
        if (roomLanguage !== playerLocale) {
          socket.emit('error', { code: 'LANGUAGE_MISMATCH', message: 'This room is in a different language. You can only join rooms that match your language.' })
          await socket.leave(`room:${room.id}`)
          return
        }
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
            avatarUrl: null,
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
            const getsImposterWord = alreadyIn.role === 'imposter' || alreadyIn.role === 'double_agent'
            const rounds: any[] = state.rounds ?? []
            const currentRoundData = rounds.find((r: any) => r.roundNumber === state.currentRound) ?? null
            socket.emit('game:started', {
              round: currentRoundData,
              yourWord: getsImposterWord ? state.imposterWord : state.villagerWord,
              yourRole: alreadyIn.role,
              yourVillagerWord: alreadyIn.role === 'double_agent' ? state.villagerWord : undefined,
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
          imposterCount: room.imposterCount,
          speakingTimeSeconds: room.speakingTimeSeconds,
          votingTimeSeconds: room.votingTimeSeconds,
          wordPackId: room.wordPackId,
          isPrivate: room.isPrivate,
          language: room.language as any,
          gameMode: state.gameMode ?? 'normal',
          categories: state.categories ?? [],
          detectiveCount: state.detectiveCount ?? (state.enableDetective ? 1 : 0),
          doubleAgentCount: state.doubleAgentCount ?? (state.enableDoubleAgent ? 1 : 0),
          guardianCount: state.guardianCount ?? 0,
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

    // Special roles only allowed in 'special' mode — force-disable in normal mode
    if (state.gameMode === 'normal') {
      state.detectiveCount   = 0
      state.doubleAgentCount = 0
      state.guardianCount    = 0
    } else {
      if (newSettings.detectiveCount   !== undefined) state.detectiveCount   = Math.max(0, Math.min(3, newSettings.detectiveCount))
      if (newSettings.doubleAgentCount !== undefined) state.doubleAgentCount = Math.max(0, Math.min(2, newSettings.doubleAgentCount))
      if (newSettings.guardianCount    !== undefined) state.guardianCount    = Math.max(0, Math.min(2, newSettings.guardianCount))
    }
    await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)

    // Persist numeric and language settings to Prisma
    const SUPPORTED_LOCALES = ['en', 'fr', 'ar', 'es', 'it', 'pt', 'zh', 'de']
    const dbUpdate: Record<string, number | string> = {}
    // Min 3 players (was incorrectly clamped to 4 here, even though the rest
    // of the codebase advertises 3 as the minimum).
    if (typeof newSettings.maxPlayers === 'number')          dbUpdate.maxPlayers          = Math.min(20, Math.max(3,   newSettings.maxPlayers))
    if (typeof newSettings.imposterCount === 'number')       dbUpdate.imposterCount       = Math.min(4,  Math.max(1,   newSettings.imposterCount))
    if (typeof newSettings.speakingTimeSeconds === 'number') dbUpdate.speakingTimeSeconds = Math.min(120, Math.max(10, newSettings.speakingTimeSeconds))
    if (typeof newSettings.votingTimeSeconds === 'number')   dbUpdate.votingTimeSeconds   = Math.min(120, Math.max(15, newSettings.votingTimeSeconds))
    if (typeof newSettings.language === 'string' && SUPPORTED_LOCALES.includes(newSettings.language)) dbUpdate.language = newSettings.language

    // Enforce the 1/3 imposter rule on the resolved (final) values, no matter
    // which field changed in this update. imposterCount must be ≤ floor(maxPlayers/3).
    const finalMaxPlayers = (dbUpdate.maxPlayers as number | undefined) ?? room.maxPlayers
    const finalImposterCount = (dbUpdate.imposterCount as number | undefined) ?? room.imposterCount
    const cappedImposters = Math.max(1, Math.min(finalImposterCount, Math.floor(finalMaxPlayers / 3)))
    if (cappedImposters !== finalImposterCount) {
      dbUpdate.imposterCount = cappedImposters
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
        maxPlayers: updatedRoom.maxPlayers, minPlayers: 3, imposterCount: updatedRoom.imposterCount,
        speakingTimeSeconds: updatedRoom.speakingTimeSeconds, votingTimeSeconds: updatedRoom.votingTimeSeconds,
        wordPackId: updatedRoom.wordPackId, isPrivate: updatedRoom.isPrivate, language: updatedRoom.language as any,
        gameMode: state.gameMode ?? 'normal', categories: state.categories ?? [],
        detectiveCount: state.detectiveCount ?? (state.enableDetective ? 1 : 0),
        doubleAgentCount: state.doubleAgentCount ?? (state.enableDoubleAgent ? 1 : 0),
        guardianCount: state.guardianCount ?? 0,
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
        maxPlayers: room.maxPlayers, minPlayers: 3, imposterCount: room.imposterCount,
        speakingTimeSeconds: room.speakingTimeSeconds, votingTimeSeconds: room.votingTimeSeconds,
        wordPackId: room.wordPackId, isPrivate: room.isPrivate, language: room.language as any,
        gameMode: state.gameMode ?? 'normal', categories: state.categories ?? [],
        detectiveCount: state.detectiveCount ?? (state.enableDetective ? 1 : 0),
        doubleAgentCount: state.doubleAgentCount ?? (state.enableDoubleAgent ? 1 : 0),
        guardianCount: state.guardianCount ?? 0,
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

      socket.emit('detective:result', {
        targetUserId: target.userId,
        targetUsername: target.username,
        role: target.role,
      })
    } catch (err) {
      log.error({ err, userId }, 'detective:reveal error')
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
          // Voluntary leave during game = forfeit (guaranteed LP loss)
          await forfeitPlayer(io, roomId, userId)
        } else {
          // In lobby: remove the player entirely
          state.players = state.players.filter((p: any) => p.userId !== userId)

          // ── Host reassignment ─────────────────────────────────────────────
          const room = await prisma.room.findUnique({ where: { id: roomId } }).catch(() => null)
          if (room && room.hostId === userId && state.players.length > 0) {
            const newHost = state.players[0]
            newHost.isHost  = true
            newHost.isReady = true
            await prisma.room.update({
              where: { id: roomId },
              data:  { hostId: newHost.userId },
            }).catch(() => {})
            io.to(roomKey).emit('room:host-changed' as any, { newHostId: newHost.userId, newHostUsername: newHost.username })
          }
        }

        await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)
        io.to(roomKey).emit('player:left', socket.id)
      }
      await socket.leave(roomKey)
    }
  })
}
