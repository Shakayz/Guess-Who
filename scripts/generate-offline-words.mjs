#!/usr/bin/env node
/**
 * Generates packages/shared/src/offlineWords.ts from curated 30-item pools.
 *
 * Each of the 12 categories has a 30-item pool mixing diverse sub-types
 * (e.g. food mixes dishes, ingredients, spices, drinks, and cooking methods).
 * All C(30,2) = 435 pairs are generated per category.
 *
 * Pools use universally recognised terms so they apply across all locales.
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'packages/shared/src/offlineWords.ts')

const LOCALES = ['en', 'fr', 'es', 'de', 'ar', 'it', 'pt', 'zh', 'ru', 'hi']
const CATEGORIES = [
  'food', 'animals', 'music', 'places', 'jobs',
  'sports', 'movies', 'tech', 'history', 'mangas', 'celebrities', 'variety',
]

// ---------------------------------------------------------------------------
// 30-item pools per category, mixing diverse sub-types.
// C(30,2) = 435 pairs per category.
// ---------------------------------------------------------------------------

const POOLS = {
  // dishes, ingredients, spices, drinks, cooking methods
  food: [
    'Pizza', 'Sushi', 'Ramen', 'Risotto', 'Curry',
    'Truffle', 'Butter', 'Saffron', 'Olive Oil', 'Mango',
    'Cumin', 'Coriander', 'Vanilla', 'Turmeric', 'Cardamom',
    'Espresso', 'Champagne', 'Kombucha', 'Matcha', 'Smoothie',
    'Grilling', 'Fermentation', 'Sous Vide', 'Steaming', 'Sourdough',
    'Kimchi', 'Dim Sum', 'Fondue', 'Tartare', 'Sriracha',
  ],
  // species, habitats, animal groups, behaviors
  animals: [
    'Tiger', 'Eagle', 'Dolphin', 'Penguin', 'Octopus',
    'Wolf', 'Shark', 'Chameleon', 'Elephant', 'Pangolin',
    'Coral Reef', 'Savanna', 'Rainforest', 'Deep Sea', 'Tundra',
    'Pack', 'Flock', 'Colony', 'Hive', 'Swarm',
    'Migration', 'Hibernation', 'Camouflage', 'Metamorphosis', 'Nocturnal',
    'Venom', 'Predator', 'Symbiosis', 'Gorilla', 'Arctic Fox',
  ],
  // artists, genres, instruments, concepts
  music: [
    'Beatles', 'Mozart', 'Bob Marley', 'Beyonce', 'Chopin',
    'Guitar', 'Synthesizer', 'Violin', 'Sitar', 'Drums',
    'Jazz', 'Hip Hop', 'Reggae', 'Techno', 'Flamenco',
    'Opera', 'Chorus', 'Riff', 'Tempo', 'Harmony',
    'Vinyl', 'Concert', 'Grammy', 'Nashville', 'Acoustic',
    'DJ', 'Soprano', 'Ballad', 'Remix', 'Orchestra',
  ],
  // cities, landmarks, natural sites, regions, fictional places
  places: [
    'Paris', 'Tokyo', 'Cairo', 'Rio de Janeiro', 'Istanbul',
    'Machu Picchu', 'Colosseum', 'Taj Mahal', 'Stonehenge', 'Great Wall',
    'Sahara', 'Amazon', 'Great Barrier Reef', 'Niagara Falls', 'Mount Everest',
    'Caribbean', 'Patagonia', 'Scandinavia', 'Mediterranean', 'Alps',
    'Hogwarts', 'Narnia', 'Gotham', 'Atlantis', 'Mordor',
    'Venice', 'Kyoto', 'Havana', 'Santorini', 'Bermuda Triangle',
  ],
  // professions, roles, fields, historical trades
  jobs: [
    'Doctor', 'Architect', 'Chef', 'Pilot', 'Detective',
    'Professor', 'Surgeon', 'Journalist', 'Diplomat', 'Pharmacist',
    'Blacksmith', 'Cartographer', 'Alchemist', 'Scribe', 'Town Crier',
    'Curator', 'Sommelier', 'Midwife', 'Referee', 'Apprentice',
    'Veterinarian', 'Locksmith', 'Electrician', 'Barista', 'Auctioneer',
    'Archaeologist', 'Botanist', 'Astronomer', 'Forensic Scientist', 'Shepherd',
  ],
  // sports, positions, equipment, events, venues
  sports: [
    'Football', 'Tennis', 'Boxing', 'Surfing', 'Fencing',
    'Archery', 'Goalkeeper', 'Quarterback', 'Striker', 'Point Guard',
    'Racket', 'Javelin', 'Helmet', 'Hurdle', 'Shuttlecock',
    'Olympics', 'World Cup', 'Marathon', 'Super Bowl', 'Tour de France',
    'Stadium', 'Velodrome', 'Arena', 'Halfpipe', 'Court',
    'Karate', 'Cycling', 'Triathlon', 'Gymnastics', 'Polo',
  ],
  // film titles, directors, characters, genres, franchises
  movies: [
    'Star Wars', 'The Godfather', 'Inception', 'Jurassic Park', 'Spirited Away',
    'Spielberg', 'Kubrick', 'Hitchcock', 'Nolan', 'Tarantino',
    'Darth Vader', 'James Bond', 'Indiana Jones', 'Joker', 'Rocky',
    'Film Noir', 'Sci-Fi', 'Western', 'Horror', 'Animation',
    'Marvel', 'Pixar', 'IMAX', 'Soundtrack', 'Oscar',
    'Sequel', 'Box Office', 'Stunt Double', 'Screenplay', 'Blockbuster',
  ],
  // hardware, software, languages, protocols, concepts
  tech: [
    'SSD', 'GPU', 'Router', 'Motherboard', 'Raspberry Pi',
    'Python', 'Rust', 'JavaScript', 'SQL', 'C++',
    'Linux', 'Docker', 'Git', 'Kubernetes', 'Photoshop',
    'TCP', 'HTTP', 'Bluetooth', 'WebSocket', 'DNS',
    'Algorithm', 'Encryption', 'Cloud Computing', 'API', 'Machine Learning',
    'Blockchain', 'Firewall', 'Compiler', 'Database', 'Open Source',
  ],
  // figures, events, eras, empires, treaties
  history: [
    'Caesar', 'Cleopatra', 'Napoleon', 'Genghis Khan', 'Da Vinci',
    'World War II', 'French Revolution', 'Moon Landing', 'D-Day', 'Fall of Rome',
    'Renaissance', 'Bronze Age', 'Medieval', 'Enlightenment', 'Cold War',
    'Roman Empire', 'Ottoman Empire', 'Mongol Empire', 'Byzantine Empire', 'Aztec Empire',
    'Treaty of Versailles', 'Magna Carta', 'Silk Road', 'Rosetta Stone', 'Crusades',
    'Gladiator', 'Samurai', 'Pharaoh', 'Industrial Revolution', 'Pyramids',
  ],
  // characters, techniques, places, transformations, power systems
  mangas: [
    'Naruto', 'Goku', 'Luffy', 'Gojo', 'Levi',
    'Rasengan', 'Kamehameha', 'Bankai', 'Domain Expansion', 'Gear Fifth',
    'Grand Line', 'Soul Society', 'Hidden Leaf', 'Hueco Mundo', 'Wall Maria',
    'Super Saiyan', 'Sage Mode', 'Titan Form', 'Hollow Mask', 'Curse Mark',
    'Chakra', 'Haki', 'Nen', 'Cursed Energy', 'Reiatsu',
    'Zanpakuto', 'Devil Fruit', 'Sharingan', 'Stand', 'Kagune',
  ],
  // actors, athletes, musicians, influencers
  celebrities: [
    'Brad Pitt', 'Meryl Streep', 'Keanu Reeves', 'Denzel Washington', 'Zendaya',
    'Leonardo DiCaprio', 'Messi', 'Serena Williams', 'Usain Bolt', 'LeBron James',
    'Simone Biles', 'Taylor Swift', 'Drake', 'Beyonce', 'Adele',
    'Billie Eilish', 'Kendrick Lamar', 'BTS', 'Elon Musk', 'MrBeast',
    'Oprah Winfrey', 'Greta Thunberg', 'Kim Kardashian', 'Gordon Ramsay', 'David Beckham',
    'Rihanna', 'Lewis Hamilton', 'Emma Watson', 'Bad Bunny', 'Pedro Pascal',
  ],
  // games, mythology, science, brands, culture
  variety: [
    'Minecraft', 'Chess', 'Monopoly', 'Dragon', 'Vampire',
    'Phoenix', 'DNA', 'Telescope', 'Bitcoin', 'Yoga',
    'Nike', 'Netflix', 'Emoji', 'Podcast', 'Origami',
    'Diamond', 'Hurricane', 'Galaxy', 'iPhone', 'Utopia',
    'Fractal', 'Aurora', 'Sudoku', 'Halloween', 'Sunrise',
    'Stoicism', 'Copyright', 'Cyborg', 'Candle', 'Compass',
  ],
}

// ---------------------------------------------------------------------------
// Generate all C(n,2) pairs from a pool.
// ---------------------------------------------------------------------------

function generatePairs(pool) {
  const pairs = []
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      pairs.push({ a: pool[i], b: pool[j] })
    }
  }
  return pairs
}

const pairsByCategory = {}
for (const cat of CATEGORIES) {
  pairsByCategory[cat] = generatePairs(POOLS[cat])
}

// ---------------------------------------------------------------------------
// Render offlineWords.ts
// ---------------------------------------------------------------------------

function escapeLit(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function renderPair({ a, b }) {
  return `    { villagerWord: '${escapeLit(a)}', redHandedWord: '${escapeLit(b)}' },`
}

function renderRecord() {
  const lines = ['{']
  for (const cat of CATEGORIES) {
    lines.push(`  ${cat}: [`)
    for (const p of pairsByCategory[cat]) lines.push(renderPair(p))
    lines.push('  ],')
  }
  lines.push('}')
  return lines.join('\n')
}

const pairsPerLocale = CATEGORIES.reduce((sum, cat) => sum + pairsByCategory[cat].length, 0)

const HEADER = `import type { WordCategory } from './types'

/**
 * Word pairs for offline / pass-and-play mode.
 * Each pair has a villagerWord and a redHandedWord -- similar but distinct.
 *
 * Generated by scripts/generate-offline-words.mjs from curated 30-item pools.
 * Each category generates C(30,2) = 435 pairs from diverse sub-type pools.
 *
 * 10 locales x 12 categories x 435 pairs each.
 */
export interface OfflineWordPair {
  villagerWord: string
  redHandedWord: string
}
`

const LOCALE_CONST = {
  en: 'OFFLINE_WORD_PAIRS',
  fr: 'FR_PAIRS',
  es: 'ES_PAIRS',
  de: 'DE_PAIRS',
  ar: 'AR_PAIRS',
  it: 'IT_PAIRS',
  pt: 'PT_PAIRS',
  zh: 'ZH_PAIRS',
  ru: 'RU_PAIRS',
  hi: 'HI_PAIRS',
}

const FOOTER = `
export const OFFLINE_WORD_PAIRS_BY_LOCALE: Record<string, Record<WordCategory, OfflineWordPair[]>> = {
  en: OFFLINE_WORD_PAIRS,
  fr: FR_PAIRS,
  es: ES_PAIRS,
  de: DE_PAIRS,
  ar: AR_PAIRS,
  it: IT_PAIRS,
  pt: PT_PAIRS,
  zh: ZH_PAIRS,
  ru: RU_PAIRS,
  hi: HI_PAIRS,
}

/**
 * Pick a random word pair from the given categories and locale.
 * Falls back to English if locale data is not available.
 */
export function pickRandomWordPair(
  categories: WordCategory[],
  shuffleFn: <T>(arr: T[]) => T[],
  locale?: string,
): OfflineWordPair & { category: WordCategory } {
  const localeKey = locale?.substring(0, 2) ?? 'en'
  const pairsMap = OFFLINE_WORD_PAIRS_BY_LOCALE[localeKey] ?? OFFLINE_WORD_PAIRS
  const keys =
    categories.length > 0
      ? categories
      : (Object.keys(pairsMap) as WordCategory[])
  const shuffledKeys = shuffleFn(keys)
  const category = shuffledKeys[0]
  const pairs = pairsMap[category]
  const shuffledPairs = shuffleFn(pairs)
  return { ...shuffledPairs[0], category }
}
`

// Pools are universally recognised terms — same record for all locales.
const record = renderRecord()

const chunks = [HEADER]

// English: full export
chunks.push(
  `\nexport const OFFLINE_WORD_PAIRS: Record<WordCategory, OfflineWordPair[]> = ${record}\n`,
)

// Other locales: alias to the same data (terms are universal)
for (const locale of LOCALES) {
  if (locale === 'en') continue
  const name = LOCALE_CONST[locale]
  chunks.push(`\nconst ${name} = OFFLINE_WORD_PAIRS\n`)
}

chunks.push(FOOTER)

writeFileSync(OUT, chunks.join(''), 'utf8')
console.log(`Wrote ${OUT}`)
console.log(
  `${LOCALES.length} locales x ${CATEGORIES.length} categories x ${pairsByCategory[CATEGORIES[0]].length} pairs = ${LOCALES.length * pairsPerLocale} total`,
)
