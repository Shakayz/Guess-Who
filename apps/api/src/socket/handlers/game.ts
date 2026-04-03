import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { redis } from '../../config/redis'
import { prisma } from '../../config/prisma'
import { tryEarlyResolve, tryEarlyVoting, eliminatePlayerForWord } from '../gameLoop'

// Whole-word, case-insensitive match
function containsWord(text: string, word: string): boolean {
  if (!word) return false
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
  const w = normalize(word).replace(/\s+/g, '\\s+')
  return new RegExp(`(?:^|\\s)${w}(?:\\s|$)`).test(normalize(text))
}

export function registerGameHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
  const userId: string = (socket as any).userId

  socket.on('vote:cast', async (targetPlayerId) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith('room:'))?.split(':')[1]
    if (!roomId) return

    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return
    const state = JSON.parse(stateRaw)

    const currentRound = state.rounds?.[state.currentRound - 1]
    if (!currentRound || state.status !== 'voting') return

    // ── Validate voter is alive ───────────────────────────────────────────────
    const voter = state.players.find((p: any) => p.userId === userId && p.status === 'alive')
    if (!voter) return

    // ── Validate target exists and is alive ───────────────────────────────────
    const target = state.players.find((p: any) => p.userId === targetPlayerId && p.status === 'alive')
    if (!target) return

    // ── Cannot vote for yourself ──────────────────────────────────────────────
    if (targetPlayerId === userId) return

    // Record vote (by userId, one vote per player)
    const existingVote = currentRound.votes?.find((v: any) => v.voterId === userId)
    if (!existingVote) {
      currentRound.votes = [
        ...(currentRound.votes ?? []),
        { voterId: userId, targetId: targetPlayerId, timestamp: new Date().toISOString() },
      ]
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
      io.to(`room:${roomId}`).emit('round:vote-cast', { voterId: userId, hasVoted: true })
      const alivePlayers = state.players.filter((p: any) => p.status === 'alive')
      io.to(`room:${roomId}`).emit('vote:update' as any, {
        voteCount: currentRound.votes.length,
        totalVoters: alivePlayers.length,
      })
      // Resolve immediately if all alive players have voted
      await tryEarlyResolve(io, roomId)
    }
  })

  socket.on('clue:submit', async (text) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith('room:'))?.split(':')[1]
    if (!roomId) return

    // ── Validate clue text ────────────────────────────────────────────────────
    if (typeof text !== 'string') return
    const sanitized = text.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, '').trim().slice(0, 300)
    if (!sanitized) return

    const stateRaw = await redis.get(`room:${roomId}:state`)
    if (!stateRaw) return
    const state = JSON.parse(stateRaw)

    const currentRound = state.rounds?.[state.currentRound - 1]
    if (!currentRound) return

    // ── Any alive player who hasn't submitted yet can submit a clue ─────────
    const clues: any[] = currentRound.clues ?? []
    const alreadySubmitted = clues.some((c: any) => c.playerId === userId)
    if (alreadySubmitted) return

    const player = state.players.find((p: any) => p.userId === userId && p.status === 'alive')
    if (!player) return

    const clue = {
      playerId: userId,
      text: sanitized,
      timestamp: new Date().toISOString(),
      flaggedForWord: false,
      flagVotes: [],
    }
    currentRound.clues = [...(currentRound.clues ?? []), clue]
    await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)
    io.to(`room:${roomId}`).emit('round:clue-submitted', clue)

    // ── Word detection (check BEFORE early voting so elimination takes priority) ─
    const villagerWord: string = state.villagerWord ?? ''
    const imposterWord: string = state.imposterWord ?? ''
    const role: string = player.role ?? 'villager'

    const forbidden: string[] = []
    if (role === 'villager' || role === 'detective') forbidden.push(villagerWord)
    else if (role === 'imposter') forbidden.push(imposterWord)
    else if (role === 'double_agent') forbidden.push(villagerWord, imposterWord)

    if (forbidden.some((w) => containsWord(sanitized, w))) {
      // Mark clue as flagged and eliminate player
      clue.flaggedForWord = true
      player.status = 'eliminated'
      currentRound.eliminationReason = 'said_word'
      currentRound.eliminatedPlayerId = userId
      currentRound.eliminatedRole = player.role
      await redis.set(`room:${roomId}:state`, JSON.stringify(state), 'EX', 86400)

      // Get username from the player's room state entry (no fetchSockets needed)
      const username = player.username ?? (socket as any).username ?? userId.slice(0, 6)

      io.to(`room:${roomId}`).emit('round:word-said' as any, {
        playerId: userId,
        username,
        clueText: sanitized,
        role: player.role,
      })

      // Also emit the updated flagged clue to all players
      io.to(`room:${roomId}`).emit('round:clue-submitted', clue)

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { speakingTimeSeconds: true, votingTimeSeconds: true },
      })
      await eliminatePlayerForWord(io, roomId, room?.speakingTimeSeconds ?? 60, room?.votingTimeSeconds ?? 30)
      return
    }

    // All alive players submitted? → move to voting early
    await tryEarlyVoting(io, roomId)
  })
}
