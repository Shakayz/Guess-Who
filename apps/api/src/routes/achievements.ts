import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/prisma'

// Seed definitions for default achievements
const DEFAULT_ACHIEVEMENTS = [
  { key: 'first_win',         name: 'First Win',          description: 'Win your very first game',                       icon: '🏆' },
  { key: 'first_imposter',    name: 'First Imposter',      description: 'Win a game as the imposter',                     icon: '🎭' },
  { key: 'perfect_imposter',  name: 'Perfect Imposter',    description: 'Win as imposter without being voted out once',    icon: '🌟' },
  { key: 'ten_wins',          name: 'Veteran',             description: 'Win 10 games total',                             icon: '🎖️' },
  { key: 'imposter_x10',      name: 'Master of Deception', description: 'Win 10 games as the imposter',                   icon: '🕵️' },
  { key: 'honor_giver_5',     name: 'Generous',            description: 'Give honor to 5 different players',              icon: '🤝' },
  { key: 'honor_receiver_5',  name: 'Beloved',             description: 'Receive 5 honors from other players',            icon: '💖' },
  { key: 'survivor',          name: 'Survivor',            description: 'Survive all rounds without being eliminated',     icon: '💪' },
  { key: 'correct_voter',     name: 'Good Eye',            description: 'Vote correctly to eliminate the imposter',       icon: '👁️' },
  { key: 'social_butterfly',  name: 'Social Butterfly',    description: 'Make 5 friends',                                 icon: '🦋' },
] as const

export const achievementRoutes: FastifyPluginAsync = async (fastify) => {
  // Ensure default achievements exist
  for (const a of DEFAULT_ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where:  { key: a.key },
      update: {},
      create: { key: a.key, name: a.name, description: a.description, icon: a.icon },
    }).catch(() => {})
  }

  // GET /api/achievements — all achievements + user unlock status
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub

    const [achievements, userAchievements] = await Promise.all([
      prisma.achievement.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.userAchievement.findMany({ where: { userId } }),
    ])

    const unlockedMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua.unlockedAt]))

    return reply.send(
      achievements.map((a) => ({
        id: a.id,
        key: a.key,
        name: a.name,
        description: a.description,
        icon: a.icon,
        unlocked: unlockedMap.has(a.id),
        unlockedAt: unlockedMap.get(a.id) ?? null,
      }))
    )
  })
}
