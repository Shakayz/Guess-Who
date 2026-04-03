import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { shuffleArray } from '@imposter/shared'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'
import { startRound, forfeitPlayer } from '../gameLoop'
import { onlineUsers } from '../onlineUsers'

// Default word pairs when no word pack is configured
const FALLBACK_WORDS = [
  { wordA: 'Apple',   wordB: 'Pear'   },
  { wordA: 'Dog',     wordB: 'Wolf'   },
  { wordA: 'Guitar',  wordB: 'Violin' },
  { wordA: 'Beach',   wordB: 'Desert' },
  { wordA: 'Coffee',  wordB: 'Tea'    },
]

export function registerRoomHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
  const userId: string = (socket as any).userId
  const username: string = (socket as any).username

  socket.on('room:join', async ({ roomCode }) => {
    try {
      const room = await prisma.room.findUnique({ where: { code: roomCode } })
      if (!room) {
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' })
        return
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
          // ── Block if room is full ─────────────────────────────────────────────
          if (state.players.length >= room.maxPlayers) {
            socket.emit('error', { code: 'ROOM_FULL', message: 'Room is full' })
            await socket.leave(`room:${room.id}`)
            return
          }
          state.players.push({
            id: socket.id,
            userId,
            username,
            avatarUrl: null,
            role: undefined,
            status: 'alive',
            isHost: room.hostId === userId,
            isReady: room.hostId === userId, // host auto-ready
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
              votes: currentRoundData?.votes ?? [],
              timeRemainingSeconds,
              currentRound: currentRoundData,
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
          minPlayers: 4,
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
      }
      io.to(`room:${room.id}`).emit('room:updated', roomPayload as any)
    } catch (err) {
      console.error('room:join error', err)
      socket.emit('error', { code: 'INTERNAL', message: 'Server error' })
    }
  })

  socket.on('room:settings' as any, async (newSettings: any) => {
    const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
    if (!roomKey) return
    const roomId = roomKey.split(':')[1]
    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room || room.hostId !== userId) return

    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return
    const state = JSON.parse(stateRaw)
    // Merge allowed settings fields
    if (newSettings.gameMode)             state.gameMode = newSettings.gameMode
    if (newSettings.categories)           state.categories = newSettings.categories
    if (newSettings.maxRounds         !== undefined) state.maxRounds         = newSettings.maxRounds

    // Special roles only allowed in 'special' mode — force-disable in normal mode
    if (state.gameMode === 'normal') {
      state.enableDetective   = false
      state.enableDoubleAgent = false
    } else {
      if (newSettings.enableDetective   !== undefined) state.enableDetective   = newSettings.enableDetective
      if (newSettings.enableDoubleAgent !== undefined) state.enableDoubleAgent = newSettings.enableDoubleAgent
    }
    await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 21600)

    // Persist numeric settings to Prisma
    const dbUpdate: Record<string, number> = {}
    if (typeof newSettings.maxPlayers === 'number')          dbUpdate.maxPlayers          = Math.min(20, Math.max(4,   newSettings.maxPlayers))
    if (typeof newSettings.imposterCount === 'number')       dbUpdate.imposterCount       = Math.min(4,  Math.max(1,   newSettings.imposterCount))
    if (typeof newSettings.speakingTimeSeconds === 'number') dbUpdate.speakingTimeSeconds = Math.min(120, Math.max(10, newSettings.speakingTimeSeconds))
    if (typeof newSettings.votingTimeSeconds === 'number')   dbUpdate.votingTimeSeconds   = Math.min(120, Math.max(15, newSettings.votingTimeSeconds))
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
        maxPlayers: updatedRoom.maxPlayers, minPlayers: 4, imposterCount: updatedRoom.imposterCount,
        speakingTimeSeconds: updatedRoom.speakingTimeSeconds, votingTimeSeconds: updatedRoom.votingTimeSeconds,
        wordPackId: updatedRoom.wordPackId, isPrivate: updatedRoom.isPrivate, language: updatedRoom.language as any,
        gameMode: state.gameMode ?? 'normal', categories: state.categories ?? [],
        enableDetective: state.enableDetective ?? false,
        enableDoubleAgent: state.enableDoubleAgent ?? false,
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
        maxPlayers: room.maxPlayers, minPlayers: 4, imposterCount: room.imposterCount,
        speakingTimeSeconds: room.speakingTimeSeconds, votingTimeSeconds: room.votingTimeSeconds,
        wordPackId: room.wordPackId, isPrivate: room.isPrivate, language: room.language as any,
        gameMode: state.gameMode ?? 'normal', categories: state.categories ?? [],
        enableDetective: state.enableDetective ?? false,
        enableDoubleAgent: state.enableDoubleAgent ?? false,
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

      // ── Mutex: prevent concurrent game:start calls ───────────────────────────
      const startLockKey = `room:${roomId}:start-lock`
      const lockAcquired = (await (redis as any).set(startLockKey, '1', 'PX', 10000, 'NX')) === 'OK'
      if (!lockAcquired) {
        socket.emit('error', { code: 'GAME_ALREADY_STARTED', message: 'A game is already in progress' })
        return
      }

      try {
      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (!stateRaw) return
      const state = JSON.parse(stateRaw)

      // ── Guard: prevent double-start ──────────────────────────────────────────
      if (state.status === 'in_progress' || state.status === 'voting') {
        socket.emit('error', { code: 'GAME_ALREADY_STARTED', message: 'A game is already in progress' })
        return
      }

      if (state.players.length < 4) {
        socket.emit('error', { code: 'NOT_ENOUGH_PLAYERS', message: 'Need at least 4 players' })
        return
      }

      // ── Guard: all players must be ready ─────────────────────────────────────
      const notReady = state.players.filter((p: any) => !p.isReady)
      if (notReady.length > 0) {
        socket.emit('error', { code: 'PLAYERS_NOT_READY', message: 'All players must be ready' })
        return
      }

      // Assign roles
      const players: any[] = shuffleArray([...state.players])
      const imposterCount = Math.min(room.imposterCount, Math.floor(players.length / 3))
      const enableDetective   = state.enableDetective   ?? false
      const enableDoubleAgent = state.enableDoubleAgent ?? false

      let roleIdx = 0
      players.forEach((p) => {
        if (roleIdx < imposterCount) {
          p.role = 'imposter'
        } else if (enableDoubleAgent && roleIdx === imposterCount) {
          p.role = 'double_agent'  // wins with imposters, receives imposter word
        } else if (enableDetective && roleIdx === imposterCount + (enableDoubleAgent ? 1 : 0)) {
          p.role = 'detective'
          p.detectiveRevealUsed = false
        } else {
          p.role = 'villager'
        }
        roleIdx++
      })

      // Pick words — respect room.wordPackId + filter by selected categories
      const selectedCategories: string[] = state.categories ?? []
      let wordPair = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)]
      try {
        const categoryFilter = selectedCategories.length === 0 ? {} : { category: { in: selectedCategories } }

        // Prefer the room's configured word pack; fall back to any non-premium pack
        const pack = room.wordPackId && room.wordPackId !== 'default'
          ? await prisma.wordPack.findUnique({
              where: { id: room.wordPackId },
              include: { pairs: { where: categoryFilter } },
            })
          : await prisma.wordPack.findFirst({
              where: { isPremium: false },
              include: { pairs: { where: categoryFilter } },
            })

        if (pack && pack.pairs.length > 0) {
          const pair = pack.pairs[Math.floor(Math.random() * pack.pairs.length)]
          wordPair = { wordA: pair.wordA, wordB: pair.wordB }
        }
      } catch { /* use fallback */ }

      // Create DB records in a single transaction for consistency
      const { game, round } = await prisma.$transaction(async (tx) => {
        const game = await tx.game.create({ data: { roomId } })
        const round = await tx.round.create({
          data: { gameId: game.id, roundNumber: 1, villagerWord: wordPair.wordA, imposterWord: wordPair.wordB },
        })
        await tx.gameParticipation.createMany({
          data: players.map((p: any) => ({
            gameId: game.id,
            userId: p.userId,
            role: p.role,
            survived: true,
          })),
          skipDuplicates: true,
        })
        return { game, round }
      })

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

      // Step 1 — broadcast room status change to the whole room so ALL lobby clients navigate
      // (fallback in case individual game:started delivery fails for any player)
      io.to(`room:${roomId}`).emit('room:updated', {
        id: room.id,
        code: room.code,
        hostId: room.hostId,
        status: 'in_progress',
        players: state.players,
        currentRound: 1,
        maxRounds: state.maxRounds ?? 0,
        createdAt: room.createdAt.toISOString(),
        settings: {
          maxPlayers: room.maxPlayers,
          minPlayers: 4,
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
      } as any)

      // Step 2 — send each player their private word/role via direct socket
      // Try both onlineUsers map AND the player's socket.id from state (more reliable)
      for (const playerData of players) {
        const getsImposterWord = playerData.role === 'imposter' || playerData.role === 'double_agent'
        const payload = {
          round: roundPayload as any,
          yourWord: getsImposterWord ? wordPair.wordB : wordPair.wordA,
          yourRole: playerData.role,
          yourVillagerWord: playerData.role === 'double_agent' ? wordPair.wordA : undefined,
        }
        // Send via onlineUsers (most up-to-date socket ID)
        const sid = onlineUsers.get(playerData.userId)
        if (sid) io.to(sid).emit('game:started', payload)
        // Also send via the socket.id stored in player state (backup for stale onlineUsers)
        if (playerData.id && playerData.id !== sid) {
          io.to(playerData.id).emit('game:started', payload)
        }
      }

      // Start speaking phase after a short delay (give clients time to navigate)
      setTimeout(() => {
        startRound(io, roomId, room.speakingTimeSeconds, room.votingTimeSeconds)
      }, 3000)
      } finally {
        await redis.del(startLockKey)
      }
    } catch (err) {
      console.error('game:start error', err)
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
      console.error('detective:reveal error', err)
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
      console.error('game:forfeit error', err)
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
      console.error('game:leave-eliminated error', err)
    }
  })

  socket.on('room:leave', async () => {
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
