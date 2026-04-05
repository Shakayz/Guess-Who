import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/prisma'

// ─── Achievement Definitions ─────────────────────────────────────────────────
// Categories: gameplay, social, ranked, imposter, detective, milestones, secret
// Difficulties: bronze, silver, gold, platinum, diamond

const DEFAULT_ACHIEVEMENTS = [
  // ── GAMEPLAY — Bronze (Easy) ───────────────────────────────────────────────
  { key: 'first_game',          name: 'Welcome!',              description: 'Play your very first game',                          icon: '🎮', category: 'gameplay',   difficulty: 'bronze',   xpReward: 10,  coinReward: 10 },
  { key: 'first_win',           name: 'First Victory',         description: 'Win your very first game',                           icon: '🏆', category: 'gameplay',   difficulty: 'bronze',   xpReward: 15,  coinReward: 20 },
  { key: 'first_vote',          name: 'Democracy!',            description: 'Cast your first vote',                               icon: '🗳️', category: 'gameplay',   difficulty: 'bronze',   xpReward: 5,   coinReward: 5 },
  { key: 'first_clue',          name: 'Speak Up',              description: 'Submit your first clue',                             icon: '💬', category: 'gameplay',   difficulty: 'bronze',   xpReward: 5,   coinReward: 5 },
  { key: 'survivor',            name: 'Survivor',              description: 'Survive all rounds without being eliminated',        icon: '💪', category: 'gameplay',   difficulty: 'bronze',   xpReward: 15,  coinReward: 15 },
  { key: 'correct_voter',       name: 'Good Eye',              description: 'Vote correctly to eliminate an imposter',            icon: '👁️', category: 'gameplay',   difficulty: 'bronze',   xpReward: 10,  coinReward: 10 },

  // ── GAMEPLAY — Silver (Medium) ─────────────────────────────────────────────
  { key: 'ten_wins',            name: 'Veteran',               description: 'Win 10 games total',                                 icon: '🎖️', category: 'gameplay',   difficulty: 'silver',   xpReward: 30,  coinReward: 50 },
  { key: 'ten_games',           name: 'Regular',               description: 'Play 10 games',                                     icon: '🎯', category: 'gameplay',   difficulty: 'silver',   xpReward: 20,  coinReward: 30 },
  { key: 'five_streak',         name: 'On Fire',               description: 'Win 5 games in a row',                               icon: '🔥', category: 'gameplay',   difficulty: 'silver',   xpReward: 40,  coinReward: 60 },
  { key: 'survived_5',          name: 'Hard to Kill',          description: 'Survive all rounds in 5 different games',            icon: '🛡️', category: 'gameplay',   difficulty: 'silver',   xpReward: 25,  coinReward: 40 },
  { key: 'vote_streak_3',       name: 'Sherlock',              description: 'Vote out the imposter 3 games in a row',             icon: '🔍', category: 'gameplay',   difficulty: 'silver',   xpReward: 30,  coinReward: 50 },

  // ── GAMEPLAY — Gold (Hard) ─────────────────────────────────────────────────
  { key: 'fifty_wins',          name: 'Champion',              description: 'Win 50 games total',                                 icon: '👑', category: 'gameplay',   difficulty: 'gold',     xpReward: 60,  coinReward: 100 },
  { key: 'fifty_games',         name: 'Dedicated',             description: 'Play 50 games',                                     icon: '📊', category: 'gameplay',   difficulty: 'gold',     xpReward: 40,  coinReward: 75 },
  { key: 'ten_streak',          name: 'Unstoppable',           description: 'Win 10 games in a row',                              icon: '⚡', category: 'gameplay',   difficulty: 'gold',     xpReward: 80,  coinReward: 150 },
  { key: 'survived_20',         name: 'Indestructible',        description: 'Survive all rounds in 20 different games',           icon: '🏰', category: 'gameplay',   difficulty: 'gold',     xpReward: 50,  coinReward: 100 },

  // ── GAMEPLAY — Platinum (Very Hard) ────────────────────────────────────────
  { key: 'hundred_wins',        name: 'Legend',                description: 'Win 100 games total',                                icon: '🌟', category: 'gameplay',   difficulty: 'platinum', xpReward: 100, coinReward: 200 },
  { key: 'two_hundred_games',   name: 'Obsessed',             description: 'Play 200 games',                                    icon: '💎', category: 'gameplay',   difficulty: 'platinum', xpReward: 80,  coinReward: 150 },
  { key: 'twenty_streak',       name: 'Godlike',               description: 'Win 20 games in a row',                              icon: '🌌', category: 'gameplay',   difficulty: 'platinum', xpReward: 150, coinReward: 300 },

  // ── GAMEPLAY — Diamond (Nearly Impossible) ─────────────────────────────────
  { key: 'five_hundred_wins',   name: 'Mythical',             description: 'Win 500 games total',                                icon: '🐉', category: 'gameplay',   difficulty: 'diamond',  xpReward: 250, coinReward: 500 },
  { key: 'thousand_games',      name: 'Eternal',              description: 'Play 1000 games',                                   icon: '♾️', category: 'gameplay',    difficulty: 'diamond',  xpReward: 200, coinReward: 400 },

  // ── IMPOSTER — Bronze ──────────────────────────────────────────────────────
  { key: 'first_imposter',      name: 'First Disguise',       description: 'Win a game as the imposter',                         icon: '🎭', category: 'imposter',   difficulty: 'bronze',   xpReward: 15,  coinReward: 20 },
  { key: 'tricked_one',         name: 'Trickster',            description: 'Win as imposter when someone voted for you',          icon: '🃏', category: 'imposter',   difficulty: 'bronze',   xpReward: 20,  coinReward: 25 },

  // ── IMPOSTER — Silver ──────────────────────────────────────────────────────
  { key: 'imposter_x5',         name: 'Con Artist',           description: 'Win 5 games as the imposter',                        icon: '🎪', category: 'imposter',   difficulty: 'silver',   xpReward: 30,  coinReward: 50 },
  { key: 'imposter_survived',   name: 'Untouchable',          description: 'Win as imposter without getting any votes',           icon: '👻', category: 'imposter',   difficulty: 'silver',   xpReward: 40,  coinReward: 60 },
  { key: 'blended_in',          name: 'Blended In',           description: 'Submit a clue that gets no suspicion as imposter',   icon: '🫥', category: 'imposter',   difficulty: 'silver',   xpReward: 25,  coinReward: 40 },

  // ── IMPOSTER — Gold ────────────────────────────────────────────────────────
  { key: 'imposter_x10',        name: 'Master of Deception',  description: 'Win 10 games as the imposter',                       icon: '🕵️', category: 'imposter',   difficulty: 'gold',     xpReward: 60,  coinReward: 100 },
  { key: 'perfect_imposter',    name: 'Perfect Imposter',     description: 'Win as imposter without being voted out once',       icon: '💯', category: 'imposter',   difficulty: 'gold',     xpReward: 60,  coinReward: 100 },
  { key: 'fooled_detective',    name: 'Fooled the Detective', description: 'Win as imposter when a detective was in the game',   icon: '🕶️', category: 'imposter',   difficulty: 'gold',     xpReward: 50,  coinReward: 80 },

  // ── IMPOSTER — Platinum ────────────────────────────────────────────────────
  { key: 'imposter_x25',        name: 'Shadow Master',        description: 'Win 25 games as the imposter',                       icon: '🌑', category: 'imposter',   difficulty: 'platinum', xpReward: 100, coinReward: 200 },
  { key: 'imposter_streak_3',   name: 'Triple Agent',         description: 'Win 3 imposter games in a row',                      icon: '🔱', category: 'imposter',   difficulty: 'platinum', xpReward: 80,  coinReward: 150 },

  // ── IMPOSTER — Diamond ─────────────────────────────────────────────────────
  { key: 'imposter_x50',        name: 'Phantom',              description: 'Win 50 games as the imposter',                       icon: '👤', category: 'imposter',   difficulty: 'diamond',  xpReward: 200, coinReward: 400 },

  // ── DETECTIVE — Bronze ─────────────────────────────────────────────────────
  { key: 'first_reveal',        name: 'First Investigation',  description: 'Use the detective reveal ability for the first time', icon: '🔎', category: 'detective',  difficulty: 'bronze',   xpReward: 10,  coinReward: 10 },

  // ── DETECTIVE — Silver ─────────────────────────────────────────────────────
  { key: 'detective_wins_5',    name: 'Inspector',            description: 'Win 5 games as detective',                           icon: '🕵️‍♂️', category: 'detective', difficulty: 'silver',   xpReward: 30,  coinReward: 50 },
  { key: 'reveal_imposter',     name: 'Exposed!',             description: 'Reveal an imposter using detective ability',          icon: '📸', category: 'detective',  difficulty: 'silver',   xpReward: 25,  coinReward: 40 },

  // ── DETECTIVE — Gold ───────────────────────────────────────────────────────
  { key: 'detective_wins_15',   name: 'Chief Inspector',      description: 'Win 15 games as detective',                          icon: '🏅', category: 'detective',  difficulty: 'gold',     xpReward: 60,  coinReward: 100 },
  { key: 'double_agent_buster', name: 'Saw Through You',      description: 'Reveal a double agent using detective ability',       icon: '🎯', category: 'detective',  difficulty: 'gold',     xpReward: 50,  coinReward: 80 },

  // ── DETECTIVE — Platinum ───────────────────────────────────────────────────
  { key: 'detective_wins_30',   name: 'Legendary Detective',  description: 'Win 30 games as detective',                          icon: '🦅', category: 'detective',  difficulty: 'platinum', xpReward: 100, coinReward: 200 },

  // ── SOCIAL — Bronze ────────────────────────────────────────────────────────
  { key: 'first_friend',        name: 'First Friend',         description: 'Add your first friend',                               icon: '🤗', category: 'social',     difficulty: 'bronze',   xpReward: 10,  coinReward: 10 },
  { key: 'first_honor',         name: 'Respectful',           description: 'Give your first honor to another player',             icon: '🤝', category: 'social',     difficulty: 'bronze',   xpReward: 5,   coinReward: 5 },
  { key: 'first_dm',            name: 'Hello!',               description: 'Send your first direct message',                      icon: '✉️', category: 'social',     difficulty: 'bronze',   xpReward: 5,   coinReward: 5 },

  // ── SOCIAL — Silver ────────────────────────────────────────────────────────
  { key: 'social_butterfly',    name: 'Social Butterfly',     description: 'Make 5 friends',                                      icon: '🦋', category: 'social',     difficulty: 'silver',   xpReward: 20,  coinReward: 30 },
  { key: 'honor_giver_5',       name: 'Generous',             description: 'Give honor to 5 different players',                   icon: '💝', category: 'social',     difficulty: 'silver',   xpReward: 20,  coinReward: 30 },
  { key: 'honor_receiver_5',    name: 'Beloved',              description: 'Receive 5 honors from other players',                 icon: '💖', category: 'social',     difficulty: 'silver',   xpReward: 20,  coinReward: 30 },
  { key: 'gifter',              name: 'Gift Giver',           description: 'Send 3 gifts to friends',                             icon: '🎁', category: 'social',     difficulty: 'silver',   xpReward: 25,  coinReward: 40 },

  // ── SOCIAL — Gold ──────────────────────────────────────────────────────────
  { key: 'popular',             name: 'Popular',              description: 'Make 20 friends',                                     icon: '🌟', category: 'social',     difficulty: 'gold',     xpReward: 50,  coinReward: 80 },
  { key: 'honor_giver_25',      name: 'Philanthropist',       description: 'Give honor to 25 different players',                  icon: '👼', category: 'social',     difficulty: 'gold',     xpReward: 50,  coinReward: 80 },
  { key: 'honor_receiver_25',   name: 'Fan Favorite',         description: 'Receive 25 honors from other players',                icon: '⭐', category: 'social',     difficulty: 'gold',     xpReward: 50,  coinReward: 80 },

  // ── SOCIAL — Platinum ──────────────────────────────────────────────────────
  { key: 'influencer',          name: 'Influencer',           description: 'Make 50 friends',                                     icon: '📢', category: 'social',     difficulty: 'platinum', xpReward: 80,  coinReward: 150 },
  { key: 'honor_receiver_100',  name: 'Icon',                 description: 'Receive 100 honors from other players',               icon: '🏛️', category: 'social',     difficulty: 'platinum', xpReward: 100, coinReward: 200 },

  // ── RANKED — Bronze ────────────────────────────────────────────────────────
  { key: 'first_ranked',        name: 'Ranked Debut',         description: 'Play your first ranked game',                         icon: '⚔️', category: 'ranked',     difficulty: 'bronze',   xpReward: 15,  coinReward: 20 },
  { key: 'first_ranked_win',    name: 'Ranked Victor',        description: 'Win your first ranked game',                          icon: '🗡️', category: 'ranked',     difficulty: 'bronze',   xpReward: 20,  coinReward: 30 },

  // ── RANKED — Silver ────────────────────────────────────────────────────────
  { key: 'reach_bronze',        name: 'Bronze Tier',          description: 'Reach Bronze rank',                                   icon: '🥉', category: 'ranked',     difficulty: 'silver',   xpReward: 30,  coinReward: 50 },
  { key: 'ranked_wins_10',      name: 'Ranked Warrior',       description: 'Win 10 ranked games',                                 icon: '⚔️', category: 'ranked',     difficulty: 'silver',   xpReward: 35,  coinReward: 60 },

  // ── RANKED — Gold ──────────────────────────────────────────────────────────
  { key: 'reach_silver',        name: 'Silver Tier',          description: 'Reach Silver rank',                                   icon: '🥈', category: 'ranked',     difficulty: 'gold',     xpReward: 50,  coinReward: 100 },
  { key: 'reach_gold',          name: 'Gold Tier',            description: 'Reach Gold rank',                                     icon: '🥇', category: 'ranked',     difficulty: 'gold',     xpReward: 60,  coinReward: 120 },
  { key: 'ranked_wins_25',      name: 'Ranked Champion',      description: 'Win 25 ranked games',                                 icon: '🏆', category: 'ranked',     difficulty: 'gold',     xpReward: 60,  coinReward: 100 },

  // ── RANKED — Platinum ──────────────────────────────────────────────────────
  { key: 'reach_diamond',       name: 'Diamond Tier',         description: 'Reach Diamond rank',                                  icon: '💎', category: 'ranked',     difficulty: 'platinum', xpReward: 100, coinReward: 200 },
  { key: 'reach_master',        name: 'Master Tier',          description: 'Reach Master rank',                                   icon: '👑', category: 'ranked',     difficulty: 'platinum', xpReward: 120, coinReward: 250 },
  { key: 'ranked_wins_50',      name: 'Ranked Legend',        description: 'Win 50 ranked games',                                 icon: '🌟', category: 'ranked',     difficulty: 'platinum', xpReward: 100, coinReward: 200 },

  // ── RANKED — Diamond ───────────────────────────────────────────────────────
  { key: 'reach_grandmaster',   name: 'Grandmaster',          description: 'Reach Grandmaster rank',                              icon: '🌌', category: 'ranked',     difficulty: 'diamond',  xpReward: 250, coinReward: 500 },
  { key: 'ranked_wins_100',     name: 'Ranked Immortal',      description: 'Win 100 ranked games',                                icon: '♾️', category: 'ranked',      difficulty: 'diamond',  xpReward: 200, coinReward: 400 },

  // ── MILESTONES — Bronze ────────────────────────────────────────────────────
  { key: 'customizer',          name: 'Customizer',           description: 'Change your profile picture for the first time',      icon: '📸', category: 'milestones', difficulty: 'bronze',   xpReward: 5,   coinReward: 5 },
  { key: 'word_pack_creator',   name: 'Creator',              description: 'Create your first custom word pack',                  icon: '📝', category: 'milestones', difficulty: 'bronze',   xpReward: 15,  coinReward: 20 },
  { key: 'shopper',             name: 'Shopper',              description: 'Buy your first cosmetic item from the shop',          icon: '🛍️', category: 'milestones', difficulty: 'bronze',   xpReward: 10,  coinReward: 0 },

  // ── MILESTONES — Silver ────────────────────────────────────────────────────
  { key: 'coins_500',           name: 'Coin Collector',       description: 'Earn a total of 500 star coins',                      icon: '⭐', category: 'milestones', difficulty: 'silver',   xpReward: 25,  coinReward: 50 },
  { key: 'week_streak',         name: 'Weekly Player',        description: 'Play at least 1 game every day for 7 days',           icon: '📅', category: 'milestones', difficulty: 'silver',   xpReward: 30,  coinReward: 50 },

  // ── MILESTONES — Gold ──────────────────────────────────────────────────────
  { key: 'coins_2500',          name: 'Rich',                 description: 'Earn a total of 2500 star coins',                     icon: '💰', category: 'milestones', difficulty: 'gold',     xpReward: 50,  coinReward: 100 },
  { key: 'month_streak',        name: 'Devoted',              description: 'Play at least 1 game every day for 30 days',          icon: '🗓️', category: 'milestones', difficulty: 'gold',     xpReward: 60,  coinReward: 120 },
  { key: 'all_categories',      name: 'Well Rounded',         description: 'Play a game in every word category',                  icon: '📚', category: 'milestones', difficulty: 'gold',     xpReward: 40,  coinReward: 80 },

  // ── MILESTONES — Platinum ──────────────────────────────────────────────────
  { key: 'coins_10000',         name: 'Mogul',                description: 'Earn a total of 10,000 star coins',                   icon: '🤑', category: 'milestones', difficulty: 'platinum', xpReward: 100, coinReward: 200 },

  // ── SECRET — Various difficulties (hidden until unlocked) ──────────────────
  { key: 'night_owl',           name: 'Night Owl',            description: 'Play a game between 2 AM and 5 AM',                   icon: '🦉', category: 'secret',     difficulty: 'bronze',   xpReward: 15,  coinReward: 25,  isSecret: true },
  { key: 'early_bird',          name: 'Early Bird',           description: 'Play a game between 5 AM and 7 AM',                   icon: '🐦', category: 'secret',     difficulty: 'bronze',   xpReward: 15,  coinReward: 25,  isSecret: true },
  { key: 'unanimous_vote',      name: 'Consensus',            description: 'Be in a game where everyone votes the same player',   icon: '🤝', category: 'secret',     difficulty: 'silver',   xpReward: 30,  coinReward: 50,  isSecret: true },
  { key: 'last_second_vote',    name: 'Clutch',               description: 'Cast the deciding vote in the last 3 seconds',        icon: '⏱️', category: 'secret',     difficulty: 'silver',   xpReward: 30,  coinReward: 50,  isSecret: true },
  { key: 'comeback_king',       name: 'Comeback King',        description: 'Win a game after being the most voted player',        icon: '👊', category: 'secret',     difficulty: 'gold',     xpReward: 50,  coinReward: 100, isSecret: true },
  { key: 'perfect_game',        name: 'Flawless',             description: 'Win a game where your team never lost a round',       icon: '✨', category: 'secret',     difficulty: 'platinum', xpReward: 100, coinReward: 200, isSecret: true },
  { key: 'one_hp',              name: 'One HP',               description: 'Win as the last surviving villager',                  icon: '❤️', category: 'secret',     difficulty: 'gold',     xpReward: 60,  coinReward: 100, isSecret: true },
  { key: 'betrayed',            name: 'Betrayed!',            description: 'Get eliminated by your friend\'s vote',               icon: '🗡️', category: 'secret',     difficulty: 'bronze',   xpReward: 10,  coinReward: 15,  isSecret: true },
  { key: 'full_lobby',          name: 'Full House',           description: 'Play a game with the maximum 20 players',             icon: '🏠', category: 'secret',     difficulty: 'silver',   xpReward: 25,  coinReward: 40,  isSecret: true },
  { key: 'polyglot',            name: 'Polyglot',             description: 'Play games in 3 different languages',                 icon: '🌍', category: 'secret',     difficulty: 'gold',     xpReward: 40,  coinReward: 80,  isSecret: true },
] as const

export { DEFAULT_ACHIEVEMENTS }

export const achievementRoutes: FastifyPluginAsync = async (fastify) => {
  // Ensure default achievements exist
  for (const a of DEFAULT_ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where:  { key: a.key },
      update: { name: a.name, description: a.description, icon: a.icon, category: a.category, difficulty: a.difficulty, xpReward: a.xpReward, coinReward: a.coinReward, isSecret: a.isSecret ?? false },
      create: { key: a.key, name: a.name, description: a.description, icon: a.icon, category: a.category, difficulty: a.difficulty, xpReward: a.xpReward, coinReward: a.coinReward, isSecret: a.isSecret ?? false },
    }).catch(() => {})
  }

  // GET /api/achievements — all achievements + user unlock status
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    req.log.info({ userId }, 'fetching achievements')

    const [achievements, userAchievements] = await Promise.all([
      prisma.achievement.findMany({ orderBy: [{ difficulty: 'asc' }, { category: 'asc' }, { createdAt: 'asc' }] }),
      prisma.userAchievement.findMany({ where: { userId } }),
    ])

    const unlockedMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua.unlockedAt]))

    // Difficulty order for sorting
    const difficultyOrder: Record<string, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3, diamond: 4 }

    const result = achievements
      .map((a) => ({
        id: a.id,
        key: a.key,
        name: a.name,
        description: a.isSecret && !unlockedMap.has(a.id) ? '???' : a.description,
        icon: a.isSecret && !unlockedMap.has(a.id) ? '🔒' : a.icon,
        category: a.category,
        difficulty: a.difficulty,
        xpReward: a.xpReward,
        coinReward: a.coinReward,
        isSecret: a.isSecret,
        unlocked: unlockedMap.has(a.id),
        unlockedAt: unlockedMap.get(a.id) ?? null,
      }))
      .sort((a, b) => (difficultyOrder[a.difficulty] ?? 0) - (difficultyOrder[b.difficulty] ?? 0))

    return reply.send(result)
  })

  // GET /api/achievements/stats — summary stats
  fastify.get('/stats', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub
    req.log.info({ userId }, 'fetching achievement stats')

    const [total, unlocked] = await Promise.all([
      prisma.achievement.count(),
      prisma.userAchievement.count({ where: { userId } }),
    ])

    const byDifficulty = await prisma.achievement.groupBy({
      by: ['difficulty'],
      _count: true,
    })

    const unlockedByDifficulty = await prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: { select: { difficulty: true } } },
    })

    const unlockedDiffCounts: Record<string, number> = {}
    for (const ua of unlockedByDifficulty) {
      const d = ua.achievement.difficulty
      unlockedDiffCounts[d] = (unlockedDiffCounts[d] ?? 0) + 1
    }

    return reply.send({
      total,
      unlocked,
      percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0,
      byDifficulty: byDifficulty.map((d) => ({
        difficulty: d.difficulty,
        total: d._count,
        unlocked: unlockedDiffCounts[d.difficulty] ?? 0,
      })),
    })
  })
}
