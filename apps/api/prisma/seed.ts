import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const WORD_PAIRS = [
  { wordA: 'Apple',       wordB: 'Pear',        difficulty: 'easy',   category: 'food' },
  { wordA: 'Dog',         wordB: 'Wolf',         difficulty: 'easy',   category: 'animals' },
  { wordA: 'Guitar',      wordB: 'Violin',       difficulty: 'medium', category: 'music' },
  { wordA: 'Beach',       wordB: 'Desert',       difficulty: 'medium', category: 'nature' },
  { wordA: 'Coffee',      wordB: 'Tea',          difficulty: 'easy',   category: 'drinks' },
  { wordA: 'Lion',        wordB: 'Tiger',        difficulty: 'easy',   category: 'animals' },
  { wordA: 'Piano',       wordB: 'Organ',        difficulty: 'medium', category: 'music' },
  { wordA: 'Sun',         wordB: 'Moon',         difficulty: 'easy',   category: 'nature' },
  { wordA: 'Castle',      wordB: 'Fort',         difficulty: 'medium', category: 'places' },
  { wordA: 'Ship',        wordB: 'Boat',         difficulty: 'easy',   category: 'transport' },
  { wordA: 'Doctor',      wordB: 'Nurse',        difficulty: 'medium', category: 'jobs' },
  { wordA: 'Chocolate',   wordB: 'Caramel',      difficulty: 'medium', category: 'food' },
  { wordA: 'Hurricane',   wordB: 'Tornado',      difficulty: 'hard',   category: 'nature' },
  { wordA: 'Submarine',   wordB: 'Torpedo',      difficulty: 'hard',   category: 'military' },
  { wordA: 'Astronaut',   wordB: 'Cosmonaut',    difficulty: 'hard',   category: 'jobs' },
  { wordA: 'Parliament',  wordB: 'Congress',     difficulty: 'hard',   category: 'politics' },
]

async function main() {
  console.log('Seeding database...')

  // Default word pack
  const existing = await prisma.wordPack.findFirst({ where: { name: 'General' } })
  if (!existing) {
    await prisma.wordPack.create({
      data: {
        name: 'General',
        description: 'A general set of word pairs for all ages',
        isPremium: false,
        locale: 'en',
        pairs: {
          create: WORD_PAIRS,
        },
      },
    })
    console.log(`Created default word pack with ${WORD_PAIRS.length} pairs`)
  } else {
    console.log('Default word pack already exists, skipping')
  }

  // Default achievements
  const ACHIEVEMENTS = [
    { key: 'first_win',        name: 'First Win',         description: 'Win your first game',               icon: '🏆' },
    { key: 'imposter_wins',    name: 'Master Deceiver',   description: 'Win 5 games as the imposter',       icon: '🎭' },
    { key: 'perfect_detective',name: 'Eagle Eye',         description: 'Vote out the imposter correctly 10 times', icon: '🔍' },
    { key: 'veteran',          name: 'Veteran',           description: 'Play 50 games',                     icon: '⚔️' },
  ]

  for (const ach of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: ach.key },
      create: ach,
      update: {},
    })
  }
  console.log(`Seeded ${ACHIEVEMENTS.length} achievements`)

  console.log('Seed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
