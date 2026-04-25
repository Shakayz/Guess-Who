import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Default-room word pairs are shipped in the client bundle (and read on the
// server via @red-handed/shared.pickRandomWordPair), not seeded into the DB.
// The DB's WordPack/WordPair tables are reserved for user-authored and
// premium packs; nothing is seeded for them at install time.

async function main() {
  console.log('Seeding database...')

  // ── Achievements ──────────────────────────────────────────────────────────
  const ACHIEVEMENTS = [
    { key: 'first_win',        name: 'First Win',           description: 'Win your very first game',                     icon: '🏆' },
    { key: 'first_red_handed', name: 'First Imposter',     description: 'Win a game as the imposter',                  icon: '🎭' },
    { key: 'perfect_red_handed', name: 'Perfect Imposter', description: 'Win as imposter without being voted out once', icon: '🌟' },
    { key: 'ten_wins',         name: 'Veteran',             description: 'Win 10 games total',                          icon: '🎖️' },
    { key: 'red_handed_x10',   name: 'Master of Deception', description: 'Win 10 games as the imposter',              icon: '🕵️' },
    { key: 'honor_giver_5',    name: 'Generous',            description: 'Give honor to 5 different players',           icon: '🤝' },
    { key: 'honor_receiver_5', name: 'Beloved',             description: 'Receive 5 honors from other players',         icon: '💖' },
    { key: 'survivor',         name: 'Survivor',            description: 'Survive all rounds without being eliminated', icon: '💪' },
    { key: 'correct_voter',    name: 'Good Eye',            description: 'Vote correctly to eliminate the imposter',  icon: '👁️' },
    { key: 'social_butterfly', name: 'Social Butterfly',    description: 'Make 5 friends',                              icon: '🦋' },
    // Level milestones — keep in sync with packages/shared LEVEL_MILESTONES
    { key: 'reach_level_5',    name: 'Apprentice',          description: 'Reach player level 5',                         icon: '⚡', category: 'milestones', difficulty: 'bronze',   xpReward: 25 },
    { key: 'reach_level_10',   name: 'Initiate',            description: 'Reach player level 10',                        icon: '⚡', category: 'milestones', difficulty: 'bronze',   xpReward: 50 },
    { key: 'reach_level_25',   name: 'Adept',               description: 'Reach player level 25',                        icon: '⚡', category: 'milestones', difficulty: 'silver',   xpReward: 100 },
    { key: 'reach_level_50',   name: 'Expert',              description: 'Reach player level 50',                        icon: '⚡', category: 'milestones', difficulty: 'silver',   xpReward: 200 },
    { key: 'reach_level_100',  name: 'Centurion',           description: 'Reach player level 100',                       icon: '🌟', category: 'milestones', difficulty: 'gold',     xpReward: 500 },
    { key: 'reach_level_250',  name: 'Veteran of the Game', description: 'Reach player level 250',                       icon: '🌟', category: 'milestones', difficulty: 'platinum', xpReward: 1000 },
    { key: 'reach_level_500',  name: 'Legendary',           description: 'Reach player level 500',                       icon: '👑', category: 'milestones', difficulty: 'diamond',  xpReward: 2500 },
    { key: 'reach_level_1000', name: 'Imposter God',      description: 'Reach the maximum level of 1000',              icon: '👑', category: 'milestones', difficulty: 'diamond',  xpReward: 10000 },
  ]
  for (const ach of ACHIEVEMENTS) {
    await prisma.achievement.upsert({ where: { key: ach.key }, create: ach, update: {} })
  }
  console.log(`Seeded ${ACHIEVEMENTS.length} achievements`)

  // ── Season Pass ───────────────────────────────────────────────────────────
  try {
    const now = new Date()
    const seasonStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const seasonEnd   = new Date(now.getFullYear(), now.getMonth() + 3, 0)

    const existingSeason = await (prisma as any).seasonPass.findFirst({
      where: { startDate: { lte: now }, endDate: { gte: now } },
    })

    if (!existingSeason) {
      await (prisma as any).seasonPass.create({
        data: {
          name: 'Season 1 — Shadow Realm',
          startDate: seasonStart,
          endDate:   seasonEnd,
          isPremium: false,
          tiers: {
            create: [
              { tierNumber: 1,  xpRequired: 0,    rewardType: 'starCoins', rewardValue: '50',  isPremium: false },
              { tierNumber: 2,  xpRequired: 200,  rewardType: 'starCoins', rewardValue: '100', isPremium: false },
              { tierNumber: 3,  xpRequired: 500,  rewardType: 'starCoins', rewardValue: '150', isPremium: false },
              { tierNumber: 4,  xpRequired: 900,  rewardType: 'starCoins', rewardValue: '10',  isPremium: true  },
              { tierNumber: 5,  xpRequired: 1400, rewardType: 'starCoins', rewardValue: '200', isPremium: false },
              { tierNumber: 6,  xpRequired: 2000, rewardType: 'starCoins', rewardValue: '250', isPremium: false },
              { tierNumber: 7,  xpRequired: 2700, rewardType: 'starCoins', rewardValue: '25',  isPremium: true  },
              { tierNumber: 8,  xpRequired: 3500, rewardType: 'starCoins', rewardValue: '300', isPremium: false },
              { tierNumber: 9,  xpRequired: 4400, rewardType: 'starCoins', rewardValue: '400', isPremium: false },
              { tierNumber: 10, xpRequired: 5500, rewardType: 'starCoins', rewardValue: '50',  isPremium: true  },
            ],
          },
        },
      })
      console.log('Created Season 1 — Shadow Realm season pass with 10 tiers')
    } else {
      console.log('Active season pass already exists, skipping')
    }
  } catch {
    console.log('Skipped season pass seeding (table may not exist)')
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
