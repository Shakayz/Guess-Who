import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { shuffleArray } from '@imposter/shared'
import { prisma } from '../../config/prisma'
import { redis } from '../../config/redis'
import { startRound } from '../gameLoop'

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

      // Atomic-safe join: use a short retry loop to avoid race condition when
      // multiple players join simultaneously and overwrite each other's state.
      let state: any
      for (let attempt = 0; attempt < 3; attempt++) {
        const stateRaw = await redis.get(`room:${room.id}:state`)
        state = stateRaw ? JSON.parse(stateRaw) : { players: [], status: 'waiting' }
        const alreadyIn = state.players.find((p: any) => p.userId === userId)
        if (alreadyIn) break
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
        // SET NX-style: only save if key hasn't changed (best-effort)
        const saved = await redis.set(`room:${room.id}:state`, JSON.stringify(state), 'EX', 86400)
        if (saved === 'OK') break
        await new Promise((r) => setTimeout(r, 20))
      }

      const roomPayload = {
        id: room.id,
        code: room.code,
        hostId: room.hostId,
        status: state.status,
        players: state.players,
        currentRound: state.currentRound ?? 0,
        maxRounds: state.maxRounds ?? 5,
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
    if (newSettings.gameMode)   state.gameMode = newSettings.gameMode
    if (newSettings.categories) state.categories = newSettings.categories
    await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)

    const roomPayload = {
      id: room.id, code: room.code, hostId: room.hostId,
      status: state.status, players: state.players,
      currentRound: 0, maxRounds: 5, createdAt: room.createdAt.toISOString(),
      settings: {
        maxPlayers: room.maxPlayers, minPlayers: 4, imposterCount: room.imposterCount,
        speakingTimeSeconds: room.speakingTimeSeconds, votingTimeSeconds: room.votingTimeSeconds,
        wordPackId: room.wordPackId, isPrivate: room.isPrivate, language: room.language as any,
        gameMode: state.gameMode ?? 'normal', categories: state.categories ?? [],
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
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) return

    const roomPayload = {
      id: room.id, code: room.code, hostId: room.hostId,
      status: state.status, players: state.players,
      currentRound: 0, maxRounds: 5, createdAt: room.createdAt.toISOString(),
      settings: { maxPlayers: room.maxPlayers, minPlayers: 4, imposterCount: room.imposterCount,
        speakingTimeSeconds: room.speakingTimeSeconds, votingTimeSeconds: room.votingTimeSeconds,
        wordPackId: room.wordPackId, isPrivate: room.isPrivate, language: room.language as any },
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

      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (!stateRaw) return
      const state = JSON.parse(stateRaw)

      if (state.players.length < 4) {
        socket.emit('error', { code: 'NOT_ENOUGH_PLAYERS', message: 'Need at least 4 players' })
        return
      }

      // Assign roles
      const players: any[] = shuffleArray([...state.players])
      const imposterCount = Math.min(room.imposterCount, Math.floor(players.length / 3))
      players.forEach((p, i) => { p.role = i < imposterCount ? 'imposter' : 'villager' })

      // Pick words — filter by categories for normal mode, all for ranked
      const gameMode: string = state.gameMode ?? 'normal'
      const selectedCategories: string[] = state.categories ?? []
      let wordPair = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)]
      try {
        const pack = await prisma.wordPack.findFirst({
          include: {
            pairs: {
              where: gameMode === 'ranked' || selectedCategories.length === 0
                ? {}
                : { category: { in: selectedCategories } },
            },
          },
          where: { isPremium: false },
        })
        if (pack && pack.pairs.length > 0) {
          const pair = pack.pairs[Math.floor(Math.random() * pack.pairs.length)]
          wordPair = { wordA: pair.wordA, wordB: pair.wordB }
        }
      } catch { /* use fallback */ }

      // Create DB records
      const game = await prisma.game.create({ data: { roomId } })
      const round = await prisma.round.create({
        data: { gameId: game.id, roundNumber: 1, villagerWord: wordPair.wordA, imposterWord: wordPair.wordB },
      })

      // Create participation records for all players
      await prisma.gameParticipation.createMany({
        data: players.map((p: any) => ({
          gameId: game.id,
          userId: p.userId,
          role: p.role,
          survived: true,
        })),
        skipDuplicates: true,
      })

      state.status = 'in_progress'
      state.gameId = game.id
      state.currentRound = 1
      state.rounds = [{ id: round.id, roundNumber: 1, votes: [], clues: [],
        speakingOrder: players.map((p: any) => p.userId) }]
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
      await prisma.room.update({ where: { id: roomId }, data: { status: 'in_progress' } })

      const roundPayload = {
        id: round.id, roundNumber: 1,
        speakingOrder: players.map((p: any) => p.userId),
        clues: [], votes: [], eliminatedPlayerId: null, eliminatedRole: null, wordReveal: null,
      }

      // Emit game:started to each socket individually with their word
      const sockets = await io.in(`room:${roomId}`).fetchSockets()
      for (const s of sockets) {
        const socketUserId = (s as any).userId
        const playerData = players.find((p: any) => p.userId === socketUserId)
        if (!playerData) continue
        const isImposter = playerData.role === 'imposter'
        s.emit('game:started', {
          round: roundPayload as any,
          yourWord: isImposter ? wordPair.wordB : wordPair.wordA,
          yourRole: playerData.role,
        })
      }

      // Start speaking phase after a short delay (give clients time to navigate)
      setTimeout(() => {
        startRound(io, roomId, room.speakingTimeSeconds, room.votingTimeSeconds)
      }, 3000)
    } catch (err) {
      console.error('game:start error', err)
      socket.emit('error', { code: 'INTERNAL', message: 'Server error' })
    }
  })

  socket.on('room:leave', async () => {
    const roomKeys = [...socket.rooms].filter((r) => r.startsWith('room:'))
    for (const roomKey of roomKeys) {
      const roomId = roomKey.split(':')[1]
      const stateRaw = await redis.get(`room:${roomId}:state`)
      if (stateRaw) {
        const state = JSON.parse(stateRaw)
        state.players = state.players.filter((p: any) => p.userId !== userId)
        await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
      }
      await socket.leave(roomKey)
    }
  })
}
