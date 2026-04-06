import type { Server } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import jwt from 'jsonwebtoken'
import pino from 'pino'
import { env } from '../config/env'
import { redis } from '../config/redis'
import { prisma } from '../config/prisma'
import { registerRoomHandlers } from './handlers/room'
import { registerGameHandlers } from './handlers/game'
import { registerChatHandlers } from './handlers/chat'
import { registerMatchmakingHandlers, cleanupEmptyQueue } from './handlers/matchmaking'
import { sendPushNotification } from '../services/push'

const log = pino({ name: 'socket' })

// Track online users: userId -> socketId (shared module)
import { onlineUsers } from './onlineUsers'
export { onlineUsers }

// Simple per-socket rate limiter to prevent event spam
const socketRateLimits = new WeakMap<object, Map<string, number[]>>()

function isRateLimited(socket: any, event: string, maxPerSecond: number = 5): boolean {
  let events = socketRateLimits.get(socket)
  if (!events) {
    events = new Map()
    socketRateLimits.set(socket, events)
  }
  const now = Date.now()
  let timestamps = events.get(event) ?? []
  // Keep only timestamps within the last second
  timestamps = timestamps.filter((t) => now - t < 1000)
  if (timestamps.length >= maxPerSecond) return true
  timestamps.push(now)
  events.set(event, timestamps)
  return false
}

export function registerSocketHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>, fastify?: any) {
  // Attach onlineUsers and io to fastify for use in HTTP routes
  if (fastify) {
    ;(fastify as any).onlineUsers = onlineUsers
    ;(fastify as any).io = io
  }

  // Auth middleware — verify JWT from handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) {
      log.warn({ socketId: socket.id }, 'socket auth failed: missing token')
      return next(new Error('Missing token'))
    }
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; username: string }
      ;(socket as any).userId = payload.sub
      ;(socket as any).username = payload.username
      socket.data.userId = payload.sub
      socket.data.username = payload.username
      next()
    } catch {
      log.warn({ socketId: socket.id }, 'socket auth failed: invalid token')
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', async (socket) => {
    const userId: string = (socket as any).userId
    log.info({ socketId: socket.id, userId }, 'socket connected')

    // Track online user — delete stale entry first to avoid race with old socket
    onlineUsers.set(userId, socket.id)

    registerRoomHandlers(io, socket)
    registerGameHandlers(io, socket)
    registerChatHandlers(io, socket)
    registerMatchmakingHandlers(io, socket)

    // DM: send a direct message to another user
    ;(socket as any).on('dm:send', async (data: { toUserId: string; text: string }) => {
      if (isRateLimited(socket, 'dm:send', 3)) return
      if (!socket.data.userId) return
      if (!data.text?.trim() || !data.toUserId) return
      try {
        log.info({ senderId: socket.data.userId, toUserId: data.toUserId }, 'dm:send')
        const msg = await prisma.directMessage.create({
          data: {
            senderId: socket.data.userId,
            receiverId: data.toUserId,
            text: data.text.trim().slice(0, 1000),
          },
        })
        const sender = await prisma.user.findUnique({
          where: { id: socket.data.userId },
          select: { username: true, avatarUrl: true },
        })
        const payload = {
          id: msg.id,
          senderId: msg.senderId,
          senderUsername: sender?.username,
          text: msg.text,
          createdAt: msg.createdAt,
        }
        // Send to recipient if online
        const recipientSocketId = onlineUsers.get(data.toUserId)
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('dm:receive' as any, payload)
        }
        // Confirm to sender
        socket.emit('dm:receive' as any, payload)
      } catch {}
    })

    // Room invite: invite an online user to a room
    socket.on('room:invite' as any, async (data: { toUserId: string; roomCode: string }) => {
      if (!socket.data.userId || !data.toUserId || !data.roomCode) return
      const targetSocketId = onlineUsers.get(data.toUserId)
      if (targetSocketId) {
        io.to(targetSocketId).emit('room:invited' as any, {
          fromUserId: socket.data.userId,
          fromUsername: socket.data.username,
          roomCode: data.roomCode,
        })
      }

      // Push notification to invited user (even if they're offline)
      try {
        const targetUser = await prisma.user.findUnique({
          where: { id: data.toUserId },
          select: { pushToken: true },
        })
        if (targetUser?.pushToken) {
          sendPushNotification(
            targetUser.pushToken,
            'Room Invite',
            `${socket.data.username ?? 'A friend'} invited you to join a game!`,
            { type: 'room_invite', roomCode: data.roomCode },
          ).catch((err) => log.error({ err }, 'push: room invite notification error'))
        }
      } catch {}
    })

    // Game chat: send a message in the current game room
    socket.on('gamechat:send' as any, async (data: { text: string }) => {
      if (!socket.data.userId || !data.text?.trim()) return
      const roomCode = socket.data.roomCode
      if (!roomCode) return
      try {
        const room = await prisma.room.findUnique({
          where: { code: roomCode },
          include: { games: { orderBy: { startedAt: 'desc' }, take: 1 } },
        })
        const game = room?.games[0]
        if (!room || !game) return
        const msg = await prisma.gameChatMessage.create({
          data: {
            gameId: game.id,
            userId: socket.data.userId,
            username: socket.data.username ?? 'unknown',
            text: data.text.trim().slice(0, 500),
          },
        })
        io.to(`room:${room.id}`).emit('gamechat:message' as any, {
          id: msg.id,
          userId: msg.userId,
          username: msg.username,
          text: msg.text,
          createdAt: msg.createdAt,
        })
      } catch {}
    })

    // Dead chat: join the eliminated-players-only room
    socket.on('deadchat:join' as any, async () => {
      if (!socket.data.userId || !socket.data.roomCode) return
      const room = await prisma.room.findUnique({ where: { code: socket.data.roomCode } }).catch(() => null)
      if (!room) return
      // Only allow if actually eliminated
      const stateRaw = await redis.get(`room:${room.id}:state`)
      if (!stateRaw) return
      const state = JSON.parse(stateRaw)
      const player = state.players.find((p: any) => p.userId === userId)
      if (player && player.status === 'eliminated') {
        await socket.join(`dead:${room.id}`)
      }
    })

    // Dead chat: send a message visible only to eliminated players
    socket.on('deadchat:send' as any, async (data: { text: string }) => {
      if (!socket.data.userId || !data.text?.trim() || !socket.data.roomCode) return
      const room = await prisma.room.findUnique({ where: { code: socket.data.roomCode } }).catch(() => null)
      if (!room) return
      // Must be in the dead room
      if (!socket.rooms.has(`dead:${room.id}`)) return
      const msg = {
        id: `dc_${Date.now()}_${userId}`,
        userId,
        username: socket.data.username ?? 'ghost',
        text: data.text.trim().slice(0, 500),
        createdAt: new Date().toISOString(),
      }
      io.to(`dead:${room.id}`).emit('deadchat:message' as any, msg)
    })

    // Emote: quick reaction broadcast to the room
    socket.on('emote:send' as any, (data: { emoji: string }) => {
      if (isRateLimited(socket, 'emote:send', 2)) return
      if (!socket.data.userId) return
      const roomKey = [...socket.rooms].find((r) => r.startsWith('room:'))
      if (!roomKey) return
      const allowed = ['👍', '😮', '🤔', '😂', '😱']
      if (!allowed.includes(data.emoji)) {
        log.warn({ userId: socket.data.userId, emoji: data.emoji }, 'emote:send rejected: invalid emoji')
        return
      }
      log.info({ userId: socket.data.userId, emoji: data.emoji, room: roomKey }, 'emote:send')
      io.to(roomKey).emit('emote:receive' as any, {
        userId: socket.data.userId,
        username: socket.data.username,
        emoji: data.emoji,
      })
    })

    // Detective: privately reveal a player's role (one-time ability)
    socket.on('detective:reveal' as any, async (data: { targetUserId: string }) => {
      if (!socket.data.userId || !data.targetUserId) return
      const roomCode = socket.data.roomCode
      if (!roomCode) return
      log.info({ userId: socket.data.userId, targetUserId: data.targetUserId, roomCode }, 'detective:reveal attempt')
      try {
        const room = await prisma.room.findUnique({ where: { code: roomCode } }).catch(() => null)
        if (!room) return
        const stateRaw = await redis.get(`room:${room.id}:state`)
        if (!stateRaw) return
        const state = JSON.parse(stateRaw)

        const detective = state.players.find((p: any) => p.userId === userId && p.role === 'detective')
        if (!detective) return
        if (detective.detectiveRevealUsed) {
          socket.emit('error', { code: 'ABILITY_USED', message: 'Detective reveal already used' })
          return
        }

        // Target must be alive — no wasting ability on eliminated players
        const target = state.players.find((p: any) => p.userId === data.targetUserId && p.status === 'alive')
        if (!target) {
          socket.emit('error', { code: 'TARGET_ELIMINATED', message: 'That player has already been eliminated' })
          return
        }

        detective.detectiveRevealUsed = true
        await redis.set(`room:${room.id}:state`, JSON.stringify(state), 'EX', 86400)

        log.info({ userId: socket.data.userId, targetUserId: data.targetUserId, role: target.role }, 'detective:reveal result sent')
        socket.emit('detective:reveal-result' as any, {
          targetUserId: data.targetUserId,
          targetUsername: target.username,
          role: target.role,
        })
      } catch (err) {
        log.error({ err, userId: socket.data.userId }, 'detective:reveal error')
      }
    })

    // Guardian: protect a player from elimination (one-time ability, voting phase only)
    socket.on('guardian:protect' as any, async (data: { targetUserId: string }) => {
      if (!socket.data.userId || !data.targetUserId) return
      const roomCode = socket.data.roomCode
      if (!roomCode) return
      log.info({ userId: socket.data.userId, targetUserId: data.targetUserId, roomCode }, 'guardian:protect attempt')
      try {
        const room = await prisma.room.findUnique({ where: { code: roomCode } }).catch(() => null)
        if (!room) return
        const stateRaw = await redis.get(`room:${room.id}:state`)
        if (!stateRaw) return
        const state = JSON.parse(stateRaw)

        if (state.status !== 'voting') return

        const guardian = state.players.find((p: any) => p.userId === userId && p.role === 'guardian')
        if (!guardian) return
        if (guardian.guardianProtectUsed) {
          socket.emit('error', { code: 'ABILITY_USED', message: 'Guardian protection already used' })
          return
        }

        const target = state.players.find((p: any) => p.userId === data.targetUserId && p.status === 'alive')
        if (!target) return

        guardian.guardianProtectUsed = true
        target.guardianProtected = true
        await redis.set(`room:${room.id}:state`, JSON.stringify(state), 'EX', 86400)

        log.info({ userId: socket.data.userId, targetUserId: data.targetUserId }, 'guardian:protect result sent')
        socket.emit('guardian:protect-ack' as any, { targetUserId: data.targetUserId, targetUsername: target.username })
      } catch (err) {
        log.error({ err, userId: socket.data.userId }, 'guardian:protect error')
      }
    })

    // Honor: give an honor to a player after a game (once per target per game)
    socket.on('honor:give' as any, async (data: { targetUserId: string; honorType: string; gameId?: string }) => {
      if (!socket.data.userId || !data.targetUserId || !data.honorType) return
      if (data.targetUserId === userId) return
      const VALID_HONOR_TYPES = ['teamplayer', 'sharp_mind', 'good_sport']
      if (!VALID_HONOR_TYPES.includes(data.honorType)) return
      log.info({ userId, targetUserId: data.targetUserId, honorType: data.honorType, gameId: data.gameId }, 'honor:give')
      try {
        // ── One honor per sender → target per game ────────────────────────────
        if (data.gameId) {
          const existing = await prisma.honor.findFirst({
            where: { senderId: userId, receiverId: data.targetUserId, gameId: data.gameId },
          })
          if (existing) return
        }
        await prisma.$transaction([
          prisma.honor.create({
            data: {
              senderId:   userId,
              receiverId: data.targetUserId,
              type:       data.honorType,
              gameId:     data.gameId ?? null,
            },
          }),
          prisma.user.update({
            where: { id: data.targetUserId },
            data:  { honorPoints: { increment: 1 } },
          }),
        ])
        // Notify receiver if online
        const recipientSocketId = onlineUsers.get(data.targetUserId)
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('honor:received' as any, {
            fromUserId: userId,
            fromUsername: socket.data.username,
            honorType: data.honorType,
          })
        }
      } catch (err) {
        log.error({ err, userId }, 'honor:give error')
      }
    })

    // Game chat: fetch history for the current game room
    socket.on('gamechat:history' as any, async () => {
      if (!socket.data.userId || !socket.data.roomCode) return
      try {
        const room = await prisma.room.findUnique({
          where: { code: socket.data.roomCode },
          include: { games: { orderBy: { startedAt: 'desc' }, take: 1 } },
        })
        const game = room?.games[0]
        if (!game) { socket.emit('gamechat:history' as any, { messages: [] }); return }
        const messages = await prisma.gameChatMessage.findMany({
          where: { gameId: game.id },
          orderBy: { createdAt: 'asc' },
        })
        socket.emit('gamechat:history' as any, { messages })
      } catch {}
    })

    socket.on('disconnect', async () => {
      log.info({ socketId: socket.id, userId }, 'socket disconnected')
      // Remove from online users map
      onlineUsers.delete(userId)
      // Remove player from any matchmaking queues
      try {
        const queueKeys = await redis.keys('matchmaking:*')
        for (const queueKey of queueKeys) {
          const entries = await redis.lrange(queueKey, 0, -1)
          for (const entry of entries) {
            try {
              if (JSON.parse(entry).userId === userId) {
                await redis.lrem(queueKey, 0, entry)
                break
              }
            } catch {}
          }
        }
        // Clean up empty matchmaking windows
        for (const queueKey of queueKeys) {
          await cleanupEmptyQueue(queueKey)
        }
      } catch {}
      // Remove player from any rooms they were in
      const roomKeys = [...socket.rooms].filter((r) => r.startsWith('room:'))
      for (const roomKey of roomKeys) {
        const roomId = roomKey.split(':')[1]
        const stateRaw = await redis.get(`room:${roomId}:state`)
        if (!stateRaw) continue
        const state = JSON.parse(stateRaw)

        const wasInGame = state.status === 'in_progress' || state.status === 'voting'

        if (wasInGame) {
          // Mid-game: mark as eliminated (forfeit), don't remove from player list
          const player = state.players.find((p: any) => p.userId === userId)
          if (player && player.status === 'alive') player.status = 'eliminated'
        } else {
          // In lobby: remove the player entirely
          state.players = state.players.filter((p: any) => p.userId !== userId)
        }

        // ── Host reassignment ───────────────────────────────────────────────
        // Only reassign host if game is in waiting state (mid-game host loss is cosmetic only)
        if (!wasInGame && state.players.length > 0) {
          const room = await prisma.room.findUnique({ where: { id: roomId } }).catch(() => null)
          if (room && room.hostId === userId) {
            // Promote the first remaining player to host
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

        await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
        io.to(roomKey).emit('player:left', socket.id)
      }
    })
  })
}
