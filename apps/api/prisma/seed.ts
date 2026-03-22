import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const WORD_PAIRS = [
  // food
  { wordA: 'Apple',       wordB: 'Pear',        difficulty: 'easy',   category: 'food' },
  { wordA: 'Chocolate',   wordB: 'Caramel',      difficulty: 'medium', category: 'food' },
  { wordA: 'Pizza',       wordB: 'Flatbread',    difficulty: 'easy',   category: 'food' },
  { wordA: 'Burger',      wordB: 'Sandwich',     difficulty: 'easy',   category: 'food' },
  { wordA: 'Sushi',       wordB: 'Sashimi',      difficulty: 'hard',   category: 'food' },
  // animals
  { wordA: 'Dog',         wordB: 'Wolf',         difficulty: 'easy',   category: 'animals' },
  { wordA: 'Lion',        wordB: 'Tiger',        difficulty: 'easy',   category: 'animals' },
  { wordA: 'Dolphin',     wordB: 'Porpoise',     difficulty: 'hard',   category: 'animals' },
  { wordA: 'Rabbit',      wordB: 'Hare',         difficulty: 'medium', category: 'animals' },
  { wordA: 'Crow',        wordB: 'Raven',        difficulty: 'medium', category: 'animals' },
  // music
  { wordA: 'Guitar',      wordB: 'Violin',       difficulty: 'medium', category: 'music' },
  { wordA: 'Piano',       wordB: 'Organ',        difficulty: 'medium', category: 'music' },
  { wordA: 'Drums',       wordB: 'Bongos',       difficulty: 'medium', category: 'music' },
  { wordA: 'Trumpet',     wordB: 'Trombone',     difficulty: 'hard',   category: 'music' },
  { wordA: 'Flute',       wordB: 'Recorder',     difficulty: 'medium', category: 'music' },
  // nature
  { wordA: 'Beach',       wordB: 'Desert',       difficulty: 'medium', category: 'nature' },
  { wordA: 'Sun',         wordB: 'Moon',         difficulty: 'easy',   category: 'nature' },
  { wordA: 'Hurricane',   wordB: 'Tornado',      difficulty: 'hard',   category: 'nature' },
  { wordA: 'River',       wordB: 'Stream',       difficulty: 'easy',   category: 'nature' },
  { wordA: 'Mountain',    wordB: 'Hill',         difficulty: 'easy',   category: 'nature' },
  // drinks
  { wordA: 'Coffee',      wordB: 'Tea',          difficulty: 'easy',   category: 'drinks' },
  { wordA: 'Lemonade',    wordB: 'Limeade',      difficulty: 'medium', category: 'drinks' },
  { wordA: 'Espresso',    wordB: 'Ristretto',    difficulty: 'hard',   category: 'drinks' },
  { wordA: 'Juice',       wordB: 'Smoothie',     difficulty: 'easy',   category: 'drinks' },
  // places
  { wordA: 'Castle',      wordB: 'Fort',         difficulty: 'medium', category: 'places' },
  { wordA: 'Library',     wordB: 'Bookstore',    difficulty: 'medium', category: 'places' },
  { wordA: 'Museum',      wordB: 'Gallery',      difficulty: 'medium', category: 'places' },
  { wordA: 'Hospital',    wordB: 'Clinic',       difficulty: 'easy',   category: 'places' },
  // transport
  { wordA: 'Ship',        wordB: 'Boat',         difficulty: 'easy',   category: 'transport' },
  { wordA: 'Submarine',   wordB: 'Torpedo',      difficulty: 'hard',   category: 'transport' },
  { wordA: 'Helicopter',  wordB: 'Drone',        difficulty: 'medium', category: 'transport' },
  { wordA: 'Bicycle',     wordB: 'Scooter',      difficulty: 'easy',   category: 'transport' },
  // jobs
  { wordA: 'Doctor',      wordB: 'Nurse',        difficulty: 'medium', category: 'jobs' },
  { wordA: 'Astronaut',   wordB: 'Cosmonaut',    difficulty: 'hard',   category: 'jobs' },
  { wordA: 'Chef',        wordB: 'Cook',         difficulty: 'easy',   category: 'jobs' },
  { wordA: 'Lawyer',      wordB: 'Solicitor',    difficulty: 'hard',   category: 'jobs' },
  // sports
  { wordA: 'Football',    wordB: 'Rugby',        difficulty: 'medium', category: 'sports' },
  { wordA: 'Tennis',      wordB: 'Badminton',    difficulty: 'medium', category: 'sports' },
  { wordA: 'Swimming',    wordB: 'Diving',       difficulty: 'easy',   category: 'sports' },
  { wordA: 'Boxing',      wordB: 'Wrestling',    difficulty: 'medium', category: 'sports' },
  // movies
  { wordA: 'Comedy',      wordB: 'Satire',       difficulty: 'hard',   category: 'movies' },
  { wordA: 'Thriller',    wordB: 'Horror',       difficulty: 'medium', category: 'movies' },
  { wordA: 'Animation',   wordB: 'Cartoon',      difficulty: 'easy',   category: 'movies' },
  // tech
  { wordA: 'Laptop',      wordB: 'Tablet',       difficulty: 'easy',   category: 'tech' },
  { wordA: 'Router',      wordB: 'Modem',        difficulty: 'medium', category: 'tech' },
  { wordA: 'Keyboard',    wordB: 'Trackpad',     difficulty: 'medium', category: 'tech' },
  // history
  { wordA: 'Parliament',  wordB: 'Congress',     difficulty: 'hard',   category: 'history' },
  { wordA: 'Kingdom',     wordB: 'Empire',       difficulty: 'medium', category: 'history' },
  { wordA: 'Treaty',      wordB: 'Accord',       difficulty: 'hard',   category: 'history' },
]

async function main() {
  console.log('Seeding database...')

  const existing = await prisma.wordPack.findFirst({ where: { name: 'General' } })
  if (!existing) {
    await prisma.wordPack.create({
      data: {
        name: 'General',
        description: 'A diverse set of word pairs across all categories',
        isPremium: false,
        locale: 'en',
        pairs: { create: WORD_PAIRS },
      },
    })
    console.log(`Created General word pack with ${WORD_PAIRS.length} pairs`)
  } else {
    console.log('General word pack already exists, skipping')
  }

  const ACHIEVEMENTS = [
    { key: 'first_win',         name: 'First Win',          description: 'Win your first game',                     icon: '🏆' },
    { key: 'imposter_wins',     name: 'Master Deceiver',    description: 'Win 5 games as the imposter',             icon: '🎭' },
    { key: 'perfect_detective', name: 'Eagle Eye',          description: 'Vote out the imposter correctly 10 times', icon: '🔍' },
    { key: 'veteran',           name: 'Veteran',            description: 'Play 50 games',                           icon: '⚔️' },
    { key: 'social_butterfly',  name: 'Social Butterfly',   description: 'Play with 5 different players',           icon: '🦋' },
    { key: 'perfect_game',      name: 'Perfect Game',       description: 'Win without any correct votes against you', icon: '⭐' },
  ]

  for (const ach of ACHIEVEMENTS) {
    await prisma.achievement.upsert({ where: { key: ach.key }, create: ach, update: {} })
  }
  console.log(`Seeded ${ACHIEVEMENTS.length} achievements`)
  console.log('Seed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
