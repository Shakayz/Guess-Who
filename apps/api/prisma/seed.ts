import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const WORD_PAIRS = [
  // ── Food ────────────────────────────────────────────────────────────────────
  { wordA: 'Apple',        wordB: 'Pear',          difficulty: 'easy',   category: 'food' },
  { wordA: 'Chocolate',    wordB: 'Caramel',        difficulty: 'medium', category: 'food' },
  { wordA: 'Pizza',        wordB: 'Flatbread',      difficulty: 'easy',   category: 'food' },
  { wordA: 'Burger',       wordB: 'Sandwich',       difficulty: 'easy',   category: 'food' },
  { wordA: 'Sushi',        wordB: 'Sashimi',        difficulty: 'hard',   category: 'food' },
  { wordA: 'Croissant',    wordB: 'Muffin',         difficulty: 'medium', category: 'food' },
  { wordA: 'Ice Cream',    wordB: 'Sorbet',         difficulty: 'medium', category: 'food' },
  { wordA: 'Steak',        wordB: 'Ribs',           difficulty: 'medium', category: 'food' },
  { wordA: 'Pasta',        wordB: 'Noodles',        difficulty: 'easy',   category: 'food' },
  { wordA: 'Taco',         wordB: 'Burrito',        difficulty: 'easy',   category: 'food' },
  { wordA: 'Waffle',       wordB: 'Pancake',        difficulty: 'easy',   category: 'food' },
  { wordA: 'Curry',        wordB: 'Stew',           difficulty: 'medium', category: 'food' },

  // ── Animals ─────────────────────────────────────────────────────────────────
  { wordA: 'Dog',          wordB: 'Wolf',           difficulty: 'easy',   category: 'animals' },
  { wordA: 'Lion',         wordB: 'Tiger',          difficulty: 'easy',   category: 'animals' },
  { wordA: 'Dolphin',      wordB: 'Porpoise',       difficulty: 'hard',   category: 'animals' },
  { wordA: 'Rabbit',       wordB: 'Hare',           difficulty: 'medium', category: 'animals' },
  { wordA: 'Crow',         wordB: 'Raven',          difficulty: 'medium', category: 'animals' },
  { wordA: 'Cat',          wordB: 'Lynx',           difficulty: 'medium', category: 'animals' },
  { wordA: 'Horse',        wordB: 'Donkey',         difficulty: 'easy',   category: 'animals' },
  { wordA: 'Elephant',     wordB: 'Mammoth',        difficulty: 'hard',   category: 'animals' },
  { wordA: 'Penguin',      wordB: 'Puffin',         difficulty: 'hard',   category: 'animals' },
  { wordA: 'Shark',        wordB: 'Barracuda',      difficulty: 'hard',   category: 'animals' },
  { wordA: 'Crocodile',    wordB: 'Alligator',      difficulty: 'hard',   category: 'animals' },
  { wordA: 'Cheetah',      wordB: 'Leopard',        difficulty: 'medium', category: 'animals' },

  // ── Music ────────────────────────────────────────────────────────────────────
  { wordA: 'Guitar',       wordB: 'Violin',         difficulty: 'medium', category: 'music' },
  { wordA: 'Piano',        wordB: 'Organ',          difficulty: 'medium', category: 'music' },
  { wordA: 'Drums',        wordB: 'Bongos',         difficulty: 'medium', category: 'music' },
  { wordA: 'Trumpet',      wordB: 'Trombone',       difficulty: 'hard',   category: 'music' },
  { wordA: 'Flute',        wordB: 'Recorder',       difficulty: 'medium', category: 'music' },
  { wordA: 'Hip-Hop',      wordB: 'Rap',            difficulty: 'easy',   category: 'music' },
  { wordA: 'Jazz',         wordB: 'Blues',          difficulty: 'medium', category: 'music' },
  { wordA: 'Opera',        wordB: 'Musical',        difficulty: 'hard',   category: 'music' },
  { wordA: 'DJ',           wordB: 'Producer',       difficulty: 'medium', category: 'music' },
  { wordA: 'Rock',         wordB: 'Metal',          difficulty: 'medium', category: 'music' },
  { wordA: 'Saxophone',    wordB: 'Clarinet',       difficulty: 'hard',   category: 'music' },
  { wordA: 'Harp',         wordB: 'Lute',           difficulty: 'hard',   category: 'music' },

  // ── Nature ───────────────────────────────────────────────────────────────────
  { wordA: 'Beach',        wordB: 'Desert',         difficulty: 'medium', category: 'nature' },
  { wordA: 'Sun',          wordB: 'Moon',           difficulty: 'easy',   category: 'nature' },
  { wordA: 'Hurricane',    wordB: 'Tornado',        difficulty: 'hard',   category: 'nature' },
  { wordA: 'River',        wordB: 'Stream',         difficulty: 'easy',   category: 'nature' },
  { wordA: 'Mountain',     wordB: 'Hill',           difficulty: 'easy',   category: 'nature' },
  { wordA: 'Forest',       wordB: 'Jungle',         difficulty: 'easy',   category: 'nature' },
  { wordA: 'Lake',         wordB: 'Pond',           difficulty: 'easy',   category: 'nature' },
  { wordA: 'Volcano',      wordB: 'Geyser',         difficulty: 'hard',   category: 'nature' },
  { wordA: 'Rainbow',      wordB: 'Aurora',         difficulty: 'hard',   category: 'nature' },
  { wordA: 'Cave',         wordB: 'Tunnel',         difficulty: 'medium', category: 'nature' },
  { wordA: 'Glacier',      wordB: 'Iceberg',        difficulty: 'medium', category: 'nature' },
  { wordA: 'Coral Reef',   wordB: 'Seabed',         difficulty: 'hard',   category: 'nature' },

  // ── Drinks ───────────────────────────────────────────────────────────────────
  { wordA: 'Coffee',       wordB: 'Tea',            difficulty: 'easy',   category: 'drinks' },
  { wordA: 'Lemonade',     wordB: 'Limeade',        difficulty: 'medium', category: 'drinks' },
  { wordA: 'Espresso',     wordB: 'Ristretto',      difficulty: 'hard',   category: 'drinks' },
  { wordA: 'Juice',        wordB: 'Smoothie',       difficulty: 'easy',   category: 'drinks' },
  { wordA: 'Milkshake',    wordB: 'Frappe',         difficulty: 'medium', category: 'drinks' },
  { wordA: 'Beer',         wordB: 'Cider',          difficulty: 'medium', category: 'drinks' },
  { wordA: 'Wine',         wordB: 'Champagne',      difficulty: 'medium', category: 'drinks' },
  { wordA: 'Cocktail',     wordB: 'Mocktail',       difficulty: 'hard',   category: 'drinks' },
  { wordA: 'Cola',         wordB: 'Soda',           difficulty: 'easy',   category: 'drinks' },
  { wordA: 'Hot Chocolate',wordB: 'Chai',           difficulty: 'medium', category: 'drinks' },

  // ── Places ───────────────────────────────────────────────────────────────────
  { wordA: 'Castle',       wordB: 'Fort',           difficulty: 'medium', category: 'places' },
  { wordA: 'Library',      wordB: 'Bookstore',      difficulty: 'medium', category: 'places' },
  { wordA: 'Museum',       wordB: 'Gallery',        difficulty: 'medium', category: 'places' },
  { wordA: 'Hospital',     wordB: 'Clinic',         difficulty: 'easy',   category: 'places' },
  { wordA: 'Airport',      wordB: 'Train Station',  difficulty: 'easy',   category: 'places' },
  { wordA: 'Park',         wordB: 'Garden',         difficulty: 'easy',   category: 'places' },
  { wordA: 'Temple',       wordB: 'Church',         difficulty: 'medium', category: 'places' },
  { wordA: 'Prison',       wordB: 'Dungeon',        difficulty: 'medium', category: 'places' },
  { wordA: 'Stadium',      wordB: 'Arena',          difficulty: 'medium', category: 'places' },
  { wordA: 'School',       wordB: 'University',     difficulty: 'easy',   category: 'places' },
  { wordA: 'Palace',       wordB: 'Mansion',        difficulty: 'medium', category: 'places' },
  { wordA: 'Lighthouse',   wordB: 'Watchtower',     difficulty: 'hard',   category: 'places' },

  // ── Transport ────────────────────────────────────────────────────────────────
  { wordA: 'Ship',         wordB: 'Boat',           difficulty: 'easy',   category: 'transport' },
  { wordA: 'Submarine',    wordB: 'Torpedo',        difficulty: 'hard',   category: 'transport' },
  { wordA: 'Helicopter',   wordB: 'Drone',          difficulty: 'medium', category: 'transport' },
  { wordA: 'Bicycle',      wordB: 'Scooter',        difficulty: 'easy',   category: 'transport' },
  { wordA: 'Car',          wordB: 'Van',            difficulty: 'easy',   category: 'transport' },
  { wordA: 'Motorcycle',   wordB: 'Moped',          difficulty: 'medium', category: 'transport' },
  { wordA: 'Train',        wordB: 'Tram',           difficulty: 'easy',   category: 'transport' },
  { wordA: 'Plane',        wordB: 'Jet',            difficulty: 'easy',   category: 'transport' },
  { wordA: 'Rocket',       wordB: 'Shuttle',        difficulty: 'hard',   category: 'transport' },
  { wordA: 'Cable Car',    wordB: 'Gondola',        difficulty: 'hard',   category: 'transport' },
  { wordA: 'Hovercraft',   wordB: 'Hydrofoil',      difficulty: 'hard',   category: 'transport' },

  // ── Jobs ─────────────────────────────────────────────────────────────────────
  { wordA: 'Doctor',       wordB: 'Nurse',          difficulty: 'medium', category: 'jobs' },
  { wordA: 'Astronaut',    wordB: 'Cosmonaut',      difficulty: 'hard',   category: 'jobs' },
  { wordA: 'Chef',         wordB: 'Cook',           difficulty: 'easy',   category: 'jobs' },
  { wordA: 'Lawyer',       wordB: 'Solicitor',      difficulty: 'hard',   category: 'jobs' },
  { wordA: 'Teacher',      wordB: 'Professor',      difficulty: 'medium', category: 'jobs' },
  { wordA: 'Pilot',        wordB: 'Co-Pilot',       difficulty: 'medium', category: 'jobs' },
  { wordA: 'Detective',    wordB: 'Inspector',      difficulty: 'medium', category: 'jobs' },
  { wordA: 'Firefighter',  wordB: 'Paramedic',      difficulty: 'medium', category: 'jobs' },
  { wordA: 'Architect',    wordB: 'Engineer',       difficulty: 'medium', category: 'jobs' },
  { wordA: 'Journalist',   wordB: 'Reporter',       difficulty: 'medium', category: 'jobs' },
  { wordA: 'Surgeon',      wordB: 'Dentist',        difficulty: 'medium', category: 'jobs' },
  { wordA: 'Magician',     wordB: 'Illusionist',    difficulty: 'hard',   category: 'jobs' },

  // ── Sports ───────────────────────────────────────────────────────────────────
  { wordA: 'Football',     wordB: 'Rugby',          difficulty: 'medium', category: 'sports' },
  { wordA: 'Tennis',       wordB: 'Badminton',      difficulty: 'medium', category: 'sports' },
  { wordA: 'Swimming',     wordB: 'Diving',         difficulty: 'easy',   category: 'sports' },
  { wordA: 'Boxing',       wordB: 'Wrestling',      difficulty: 'medium', category: 'sports' },
  { wordA: 'Basketball',   wordB: 'Volleyball',     difficulty: 'easy',   category: 'sports' },
  { wordA: 'Golf',         wordB: 'Croquet',        difficulty: 'hard',   category: 'sports' },
  { wordA: 'Skiing',       wordB: 'Snowboarding',   difficulty: 'medium', category: 'sports' },
  { wordA: 'Surfing',      wordB: 'Wakeboarding',   difficulty: 'hard',   category: 'sports' },
  { wordA: 'Cycling',      wordB: 'Triathlon',      difficulty: 'hard',   category: 'sports' },
  { wordA: 'Archery',      wordB: 'Darts',          difficulty: 'medium', category: 'sports' },
  { wordA: 'Judo',         wordB: 'Karate',         difficulty: 'medium', category: 'sports' },
  { wordA: 'Baseball',     wordB: 'Cricket',        difficulty: 'medium', category: 'sports' },

  // ── Movies ───────────────────────────────────────────────────────────────────
  { wordA: 'Comedy',       wordB: 'Satire',         difficulty: 'hard',   category: 'movies' },
  { wordA: 'Thriller',     wordB: 'Horror',         difficulty: 'medium', category: 'movies' },
  { wordA: 'Animation',    wordB: 'Cartoon',        difficulty: 'easy',   category: 'movies' },
  { wordA: 'Action',       wordB: 'Adventure',      difficulty: 'easy',   category: 'movies' },
  { wordA: 'Sci-Fi',       wordB: 'Fantasy',        difficulty: 'medium', category: 'movies' },
  { wordA: 'Romance',      wordB: 'Drama',          difficulty: 'medium', category: 'movies' },
  { wordA: 'Documentary',  wordB: 'Biopic',         difficulty: 'hard',   category: 'movies' },
  { wordA: 'Western',      wordB: 'Epic',           difficulty: 'hard',   category: 'movies' },
  { wordA: 'Heist',        wordB: 'Spy',            difficulty: 'medium', category: 'movies' },
  { wordA: 'Superhero',    wordB: 'Villain',        difficulty: 'easy',   category: 'movies' },

  // ── Tech ─────────────────────────────────────────────────────────────────────
  { wordA: 'Laptop',       wordB: 'Tablet',         difficulty: 'easy',   category: 'tech' },
  { wordA: 'Router',       wordB: 'Modem',          difficulty: 'medium', category: 'tech' },
  { wordA: 'Keyboard',     wordB: 'Trackpad',       difficulty: 'medium', category: 'tech' },
  { wordA: 'Smartphone',   wordB: 'Phablet',        difficulty: 'hard',   category: 'tech' },
  { wordA: 'Headphones',   wordB: 'Earbuds',        difficulty: 'easy',   category: 'tech' },
  { wordA: 'CPU',          wordB: 'GPU',            difficulty: 'medium', category: 'tech' },
  { wordA: 'VR Headset',   wordB: 'AR Glasses',     difficulty: 'hard',   category: 'tech' },
  { wordA: 'Smartwatch',   wordB: 'Fitness Tracker',difficulty: 'medium', category: 'tech' },
  { wordA: 'Cloud',        wordB: 'Server',         difficulty: 'medium', category: 'tech' },
  { wordA: 'Chatbot',      wordB: 'AI Assistant',   difficulty: 'medium', category: 'tech' },
  { wordA: 'USB',          wordB: 'Bluetooth',      difficulty: 'medium', category: 'tech' },

  // ── History ──────────────────────────────────────────────────────────────────
  { wordA: 'Parliament',   wordB: 'Congress',       difficulty: 'hard',   category: 'history' },
  { wordA: 'Kingdom',      wordB: 'Empire',         difficulty: 'medium', category: 'history' },
  { wordA: 'Treaty',       wordB: 'Accord',         difficulty: 'hard',   category: 'history' },
  { wordA: 'Revolution',   wordB: 'Rebellion',      difficulty: 'hard',   category: 'history' },
  { wordA: 'Pharaoh',      wordB: 'Emperor',        difficulty: 'medium', category: 'history' },
  { wordA: 'Gladiator',    wordB: 'Warrior',        difficulty: 'medium', category: 'history' },
  { wordA: 'Crusade',      wordB: 'Conquest',       difficulty: 'hard',   category: 'history' },
  { wordA: 'Colony',       wordB: 'Republic',       difficulty: 'hard',   category: 'history' },
  { wordA: 'Viking',       wordB: 'Pirate',         difficulty: 'medium', category: 'history' },
  { wordA: 'Pyramid',      wordB: 'Colosseum',      difficulty: 'medium', category: 'history' },
  { wordA: 'Samurai',      wordB: 'Knight',         difficulty: 'medium', category: 'history' },
  { wordA: 'Renaissance',  wordB: 'Enlightenment',  difficulty: 'hard',   category: 'history' },

  // ── Mangas ───────────────────────────────────────────────────────────────────
  { wordA: 'Naruto',       wordB: 'Sasuke',         difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Goku',         wordB: 'Vegeta',         difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Luffy',        wordB: 'Zoro',           difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Ichigo',       wordB: 'Rukia',          difficulty: 'medium', category: 'mangas' },
  { wordA: 'Edward',       wordB: 'Alphonse',       difficulty: 'medium', category: 'mangas' },
  { wordA: 'Light',        wordB: 'L',              difficulty: 'medium', category: 'mangas' },
  { wordA: 'Eren',         wordB: 'Levi',           difficulty: 'medium', category: 'mangas' },
  { wordA: 'Deku',         wordB: 'Bakugo',         difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Gojo',         wordB: 'Sukuna',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Tanjiro',      wordB: 'Zenitsu',        difficulty: 'easy',   category: 'mangas' },
  { wordA: 'Kakashi',      wordB: 'Itachi',         difficulty: 'medium', category: 'mangas' },
  { wordA: 'Saitama',      wordB: 'Genos',          difficulty: 'medium', category: 'mangas' },
  { wordA: 'Natsu',        wordB: 'Gray',           difficulty: 'medium', category: 'mangas' },
  { wordA: 'Meliodas',     wordB: 'Ban',            difficulty: 'hard',   category: 'mangas' },
  { wordA: 'Shoto',        wordB: 'Kirishima',      difficulty: 'medium', category: 'mangas' },

  // ── Action ───────────────────────────────────────────────────────────────────
  { wordA: 'Sword',        wordB: 'Dagger',         difficulty: 'easy',   category: 'action' },
  { wordA: 'Shield',       wordB: 'Armor',          difficulty: 'easy',   category: 'action' },
  { wordA: 'Grenade',      wordB: 'Bomb',           difficulty: 'medium', category: 'action' },
  { wordA: 'Ninja',        wordB: 'Samurai',        difficulty: 'medium', category: 'action' },
  { wordA: 'Sniper',       wordB: 'Soldier',        difficulty: 'medium', category: 'action' },
  { wordA: 'Dragon',       wordB: 'Phoenix',        difficulty: 'medium', category: 'action' },
  { wordA: 'Assassin',     wordB: 'Spy',            difficulty: 'hard',   category: 'action' },
  { wordA: 'Katana',       wordB: 'Machete',        difficulty: 'medium', category: 'action' },
  { wordA: 'Laser',        wordB: 'Missile',        difficulty: 'medium', category: 'action' },
  { wordA: 'Punch',        wordB: 'Kick',           difficulty: 'easy',   category: 'action' },
  { wordA: 'Sneak',        wordB: 'Ambush',         difficulty: 'hard',   category: 'action' },
  { wordA: 'Crossbow',     wordB: 'Bow',            difficulty: 'medium', category: 'action' },
  { wordA: 'Pistol',       wordB: 'Rifle',          difficulty: 'easy',   category: 'action' },
  { wordA: 'Explosion',    wordB: 'Eruption',       difficulty: 'hard',   category: 'action' },

  // ── Célébrités ───────────────────────────────────────────────────────────────
  { wordA: 'Beyoncé',      wordB: 'Rihanna',        difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'Michael Jackson', wordB: 'Prince',      difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Madonna',      wordB: 'Lady Gaga',      difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Brad Pitt',    wordB: 'Leonardo DiCaprio', difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Ronaldo',      wordB: 'Messi',          difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'LeBron',       wordB: 'Kobe',           difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Elon Musk',    wordB: 'Jeff Bezos',     difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Taylor Swift', wordB: 'Ariana Grande',  difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'Will Smith',   wordB: 'Denzel Washington', difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Drake',        wordB: 'Kanye West',     difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'Shakira',      wordB: 'Jennifer Lopez', difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Cristiano',    wordB: 'Neymar',         difficulty: 'easy',   category: 'celebrities' },
  { wordA: 'Eminem',       wordB: 'Jay-Z',          difficulty: 'medium', category: 'celebrities' },
  { wordA: 'Adele',        wordB: 'Billie Eilish',  difficulty: 'medium', category: 'celebrities' },

  // ── Mix ──────────────────────────────────────────────────────────────────────
  { wordA: 'Left',         wordB: 'Right',          difficulty: 'easy',   category: 'mix' },
  { wordA: 'Day',          wordB: 'Night',          difficulty: 'easy',   category: 'mix' },
  { wordA: 'Hot',          wordB: 'Cold',           difficulty: 'easy',   category: 'mix' },
  { wordA: 'Summer',       wordB: 'Winter',         difficulty: 'easy',   category: 'mix' },
  { wordA: 'Fire',         wordB: 'Ice',            difficulty: 'easy',   category: 'mix' },
  { wordA: 'King',         wordB: 'Queen',          difficulty: 'easy',   category: 'mix' },
  { wordA: 'Hero',         wordB: 'Villain',        difficulty: 'easy',   category: 'mix' },
  { wordA: 'Angel',        wordB: 'Demon',          difficulty: 'medium', category: 'mix' },
  { wordA: 'Past',         wordB: 'Future',         difficulty: 'medium', category: 'mix' },
  { wordA: 'Heaven',       wordB: 'Hell',           difficulty: 'medium', category: 'mix' },
  { wordA: 'Reality',      wordB: 'Dream',          difficulty: 'medium', category: 'mix' },
  { wordA: 'Truth',        wordB: 'Lie',            difficulty: 'medium', category: 'mix' },
  { wordA: 'Love',         wordB: 'Hate',           difficulty: 'easy',   category: 'mix' },
  { wordA: 'War',          wordB: 'Peace',          difficulty: 'medium', category: 'mix' },
  { wordA: 'Chaos',        wordB: 'Order',          difficulty: 'hard',   category: 'mix' },
  { wordA: 'Life',         wordB: 'Death',          difficulty: 'medium', category: 'mix' },
]

async function main() {
  console.log('Seeding database...')

  // Upsert the General word pack with all pairs
  const existing = await prisma.wordPack.findFirst({ where: { name: 'General' } })

  if (existing) {
    // Delete old pairs and recreate to keep data fresh
    await prisma.wordPair.deleteMany({ where: { packId: existing.id } })
    await prisma.wordPair.createMany({
      data: WORD_PAIRS.map((p) => ({ ...p, packId: existing.id })),
    })
    console.log(`Updated General word pack with ${WORD_PAIRS.length} pairs`)
  } else {
    await prisma.wordPack.create({
      data: {
        name: 'General',
        description: 'A diverse set of word pairs across all 16 categories',
        isPremium: false,
        locale: 'en',
        pairs: { create: WORD_PAIRS },
      },
    })
    console.log(`Created General word pack with ${WORD_PAIRS.length} pairs`)
  }

  // ── Achievements ─────────────────────────────────────────────────────────────
  const ACHIEVEMENTS = [
    { key: 'first_win',        name: 'First Win',          description: 'Win your very first game',                     icon: '🏆' },
    { key: 'first_imposter',   name: 'First Imposter',     description: 'Win a game as the imposter',                   icon: '🎭' },
    { key: 'perfect_imposter', name: 'Perfect Imposter',   description: 'Win as imposter without being voted out once', icon: '🌟' },
    { key: 'ten_wins',         name: 'Veteran',            description: 'Win 10 games total',                          icon: '🎖️' },
    { key: 'imposter_x10',     name: 'Master of Deception',description: 'Win 10 games as the imposter',                icon: '🕵️' },
    { key: 'honor_giver_5',    name: 'Generous',           description: 'Give honor to 5 different players',           icon: '🤝' },
    { key: 'honor_receiver_5', name: 'Beloved',            description: 'Receive 5 honors from other players',         icon: '💖' },
    { key: 'survivor',         name: 'Survivor',           description: 'Survive all rounds without being eliminated', icon: '💪' },
    { key: 'correct_voter',    name: 'Good Eye',           description: 'Vote correctly to eliminate the imposter',    icon: '👁️' },
    { key: 'social_butterfly', name: 'Social Butterfly',   description: 'Make 5 friends',                              icon: '🦋' },
  ]
  for (const ach of ACHIEVEMENTS) {
    await prisma.achievement.upsert({ where: { key: ach.key }, create: ach, update: {} })
  }
  console.log(`Seeded ${ACHIEVEMENTS.length} achievements`)

  // ── Cosmetics ─────────────────────────────────────────────────────────────────
  const COSMETICS = [
    // Avatars (star coins)
    { type: 'avatar', name: 'Shadow Fox',    description: 'A sleek dark fox', imageUrl: '/cosmetics/avatar_fox.png',    price: 200,  currency: 'star' },
    { type: 'avatar', name: 'Neon Wolf',     description: 'Glowing cyber wolf', imageUrl: '/cosmetics/avatar_wolf.png', price: 350,  currency: 'star' },
    { type: 'avatar', name: 'Crystal Bird',  description: 'Icy blue bird',    imageUrl: '/cosmetics/avatar_bird.png',   price: 300,  currency: 'star' },
    { type: 'avatar', name: 'Gold Dragon',   description: 'Legendary dragon', imageUrl: '/cosmetics/avatar_dragon.png', price: 500,  currency: 'gold' },
    { type: 'avatar', name: 'Phantom Cat',   description: 'Mystery cat',      imageUrl: '/cosmetics/avatar_cat.png',    price: 150,  currency: 'star' },
    // Card backgrounds
    { type: 'card_background', name: 'Midnight',     description: 'Dark starry night',   imageUrl: '/cosmetics/bg_midnight.png',   price: 100, currency: 'star' },
    { type: 'card_background', name: 'Sunset',       description: 'Orange sunset glow',  imageUrl: '/cosmetics/bg_sunset.png',     price: 100, currency: 'star' },
    { type: 'card_background', name: 'Aurora',       description: 'Northern lights',     imageUrl: '/cosmetics/bg_aurora.png',     price: 250, currency: 'star' },
    { type: 'card_background', name: 'Royal Gold',   description: 'Gilded luxury theme', imageUrl: '/cosmetics/bg_gold.png',       price: 300, currency: 'gold' },
    // Badges
    { type: 'badge', name: 'Detective Badge',  description: 'I found the imposter!', imageUrl: '/cosmetics/badge_detective.png', price: 200, currency: 'star' },
    { type: 'badge', name: 'Imposter Badge',   description: 'Master of deception',   imageUrl: '/cosmetics/badge_imposter.png',  price: 200, currency: 'star' },
    { type: 'badge', name: 'Crown Badge',      description: 'Top player',            imageUrl: '/cosmetics/badge_crown.png',     price: 500, currency: 'gold' },
    // Titles
    { type: 'title', name: 'The Imposter',   description: 'You look sus',         imageUrl: '/cosmetics/title_imposter.png',  price: 150, currency: 'star' },
    { type: 'title', name: 'The Detective',  description: 'Eyes everywhere',      imageUrl: '/cosmetics/title_detective.png', price: 150, currency: 'star' },
    { type: 'title', name: 'The Legendary',  description: 'Beyond compare',       imageUrl: '/cosmetics/title_legend.png',    price: 400, currency: 'gold' },
    // Word effects
    { type: 'word_effect', name: 'Fire Words',    description: 'Flaming text on reveal', imageUrl: '/cosmetics/fx_fire.png',     price: 200, currency: 'star' },
    { type: 'word_effect', name: 'Glitch Words',  description: 'Glitchy digital effect', imageUrl: '/cosmetics/fx_glitch.png',   price: 250, currency: 'star' },
    { type: 'word_effect', name: 'Galaxy Words',  description: 'Space particle effect',  imageUrl: '/cosmetics/fx_galaxy.png',   price: 350, currency: 'gold' },
  ]
  for (const c of COSMETICS) {
    await prisma.cosmetic.upsert({
      where: { id: c.name.replace(/\s+/g, '_').toLowerCase() },
      create: { ...c, id: c.name.replace(/\s+/g, '_').toLowerCase() },
      update: {},
    }).catch(async () => {
      // If upsert fails (no id match), check by name
      const existing = await prisma.cosmetic.findFirst({ where: { name: c.name } })
      if (!existing) await prisma.cosmetic.create({ data: c })
    })
  }
  console.log(`Seeded ${COSMETICS.length} cosmetics`)

  // ── Season Pass ───────────────────────────────────────────────────────────────
  const now = new Date()
  const seasonStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const seasonEnd   = new Date(now.getFullYear(), now.getMonth() + 3, 0) // end of quarter

  const existingSeason = await prisma.seasonPass.findFirst({
    where: { startDate: { lte: now }, endDate: { gte: now } },
  })

  if (!existingSeason) {
    await prisma.seasonPass.create({
      data: {
        name: 'Season 1 — Shadow Realm',
        startDate: seasonStart,
        endDate: seasonEnd,
        isPremium: false,
        tiers: {
          create: [
            { tierNumber: 1,  xpRequired: 0,    rewardType: 'starCoins', rewardValue: '50',  isPremium: false },
            { tierNumber: 2,  xpRequired: 200,  rewardType: 'starCoins', rewardValue: '100', isPremium: false },
            { tierNumber: 3,  xpRequired: 500,  rewardType: 'starCoins', rewardValue: '150', isPremium: false },
            { tierNumber: 4,  xpRequired: 900,  rewardType: 'goldCoins', rewardValue: '10',  isPremium: true  },
            { tierNumber: 5,  xpRequired: 1400, rewardType: 'starCoins', rewardValue: '200', isPremium: false },
            { tierNumber: 6,  xpRequired: 2000, rewardType: 'starCoins', rewardValue: '250', isPremium: false },
            { tierNumber: 7,  xpRequired: 2700, rewardType: 'goldCoins', rewardValue: '25',  isPremium: true  },
            { tierNumber: 8,  xpRequired: 3500, rewardType: 'starCoins', rewardValue: '300', isPremium: false },
            { tierNumber: 9,  xpRequired: 4400, rewardType: 'starCoins', rewardValue: '400', isPremium: false },
            { tierNumber: 10, xpRequired: 5500, rewardType: 'goldCoins', rewardValue: '50',  isPremium: true  },
          ],
        },
      },
    })
    console.log('Created Season 1 — Shadow Realm season pass with 10 tiers')
  } else {
    console.log('Active season pass already exists, skipping')
  }

  console.log(`Seed complete. Total pairs: ${WORD_PAIRS.length}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
