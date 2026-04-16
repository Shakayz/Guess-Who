// Batch-fetches all stats any evaluator might need in ~6 parallel queries.
// Callers pass the returned struct into every evaluator.check(ctx) invocation,
// so 400 evaluators share one fetch instead of running 400 individual queries.

import { prisma } from '../../config/prisma'
import type { UserStats } from './types'

const VILLAGER_SIDE_ROLES = [
  'villager', 'detective', 'guardian', 'mayor', 'judge', 'revenant', 'twin_villager',
]
const IMPOSTER_SIDE_ROLES = [
  'imposter', 'double_agent', 'infiltrator', 'kamikaze', 'corruptor', 'inverter', 'twin_imposter',
]

function empty(): UserStats {
  return {
    totalGames: 0,
    totalWins: 0,
    totalImposterWins: 0,
    totalVillagerWins: 0,
    totalJesterWins: 0,
    survivedWins: 0,
    winsByRole: {},
    gamesByRole: {},
    friendCount: 0,
    honorGivenCount: 0,
    honorReceivedCount: 0,
    distinctHonorGivers: 0,
    dmSentCount: 0,
    giftSentCount: 0,
    giftReceivedCount: 0,
    starCoinsCurrent: 0,
    rankedGames: 0,
    rankedWins: 0,
    rankTier: 'wooden',
    rankPoints: 0,
    achievementsUnlockedCount: 0,
    achievementsClaimedCount: 0,
    dailyStreakCount: 0,
    wordPacksCreated: 0,
    languagesPlayed: 0,
    distinctWordPacks: 0,
  }
}

/**
 * Parallel-fetch every user stat an evaluator might read. Returns a frozen
 * struct. Any query failure degrades to zeros rather than throwing, so a
 * transient DB hiccup doesn't block a game-end unlock pass.
 */
export async function buildUserStats(userId: string): Promise<UserStats> {
  try {
    const [
      userRow,
      gameParticipations,
      friendCount,
      honorGiven,
      honorReceived,
      distinctHonorGivers,
      dmSent,
      giftSent,
      giftReceived,
      achievementsRows,
      wordPackRows,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          starCoins: true,
          rankTier: true,
          rankPoints: true,
          dailyStreakCount: true,
        },
      }),
      // One scan of game_participations joined with games — we compute all
      // per-role and per-winner aggregates in JS to avoid 6 separate queries.
      prisma.gameParticipation.findMany({
        where: { userId },
        select: {
          role: true,
          survived: true,
          game: { select: { winnerTeam: true, gameMode: true } },
        },
      }),
      prisma.friendship.count({
        where: {
          status: 'accepted',
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
      }),
      prisma.honor.count({ where: { senderId: userId } }),
      prisma.honor.count({ where: { receiverId: userId } }),
      prisma.honor.findMany({
        where: { receiverId: userId },
        select: { senderId: true },
        distinct: ['senderId'],
      }),
      prisma.directMessage.count({ where: { senderId: userId } }).catch(() => 0),
      prisma.gift.count({ where: { senderId: userId } }).catch(() => 0),
      prisma.gift.count({ where: { receiverId: userId } }).catch(() => 0),
      prisma.userAchievement.findMany({
        where: { userId },
        select: { claimedAt: true },
      }),
      prisma.wordPack.count({ where: { authorId: userId } }).catch(() => 0),
    ])

    const stats = empty()
    if (userRow) {
      stats.starCoinsCurrent = userRow.starCoins
      stats.rankTier = userRow.rankTier
      stats.rankPoints = userRow.rankPoints
      stats.dailyStreakCount = userRow.dailyStreakCount
    }

    for (const p of gameParticipations) {
      stats.totalGames++
      stats.gamesByRole[p.role] = (stats.gamesByRole[p.role] ?? 0) + 1
      const mode = p.game.gameMode
      if (mode === 'ranked') stats.rankedGames++

      const team = p.game.winnerTeam
      if (!team) continue

      const isVillagerSide = VILLAGER_SIDE_ROLES.includes(p.role)
      const isImposterSide = IMPOSTER_SIDE_ROLES.includes(p.role)
      const isJester = p.role === 'jester'
      const isTwin = p.role === 'twin_villager' || p.role === 'twin_imposter'

      const won =
        (team === 'villagers' && isVillagerSide) ||
        (team === 'imposters' && isImposterSide) ||
        (team === 'jester' && isJester) ||
        (team === 'evil_twins' && isTwin)

      if (won) {
        stats.totalWins++
        stats.winsByRole[p.role] = (stats.winsByRole[p.role] ?? 0) + 1
        if (isImposterSide) stats.totalImposterWins++
        if (isVillagerSide) stats.totalVillagerWins++
        if (isJester) stats.totalJesterWins++
        if (p.survived) stats.survivedWins++
        if (mode === 'ranked') stats.rankedWins++
      }
    }

    stats.friendCount = friendCount
    stats.honorGivenCount = honorGiven
    stats.honorReceivedCount = honorReceived
    stats.distinctHonorGivers = distinctHonorGivers.length
    stats.dmSentCount = dmSent
    stats.giftSentCount = giftSent
    stats.giftReceivedCount = giftReceived
    stats.achievementsUnlockedCount = achievementsRows.length
    stats.achievementsClaimedCount = achievementsRows.filter((a) => a.claimedAt !== null).length
    stats.wordPacksCreated = wordPackRows

    return Object.freeze(stats)
  } catch {
    return Object.freeze(empty())
  }
}
