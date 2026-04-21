#!/usr/bin/env node
/**
 * Generates packages/shared/src/offlineWords.ts from the curated online pairs.
 *
 * Source of truth:
 *   - apps/api/prisma/seed.ts         (base pairs, parsed via regex)
 *   - apps/api/prisma/extended-pairs.ts (extended pairs, imported)
 *
 * Offline mode (pass-and-play) now uses exactly the same pair content as the
 * online database. The previous combinatorial generator (30/40-item pools ->
 * C(n,2) pairs) has been replaced — its output mixed items that did not form
 * semantically meaningful pairs.
 *
 * Output: 8 locales x 11 categories x 100 pairs = 8800 pairs total.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SEED = resolve(ROOT, 'apps/api/prisma/seed.ts')
const EXTENDED = resolve(ROOT, 'apps/api/prisma/extended-pairs.ts')
const V2 = resolve(ROOT, 'apps/api/prisma/v2-pairs.ts')
const V3 = resolve(ROOT, 'apps/api/prisma/v3-pairs.ts')
const OUT = resolve(ROOT, 'packages/shared/src/offlineWords.ts')

const LOCALES = ['en', 'fr', 'es', 'de', 'ar', 'it', 'pt', 'zh', 'ru', 'hi']
const CATEGORIES = [
  'food', 'animals', 'music', 'places', 'jobs',
  'sports', 'movies', 'tech', 'history', 'mangas', 'celebrities', 'variety',
]

// Target pair count per (locale, category). Each category should hit this
// floor via curated pairs in seed.ts + extended-pairs.ts. Raised from 30 to
// 40 as part of the V2 expansion.
const POOL_SIZE = 40

// ---------------------------------------------------------------------------
// Parse seed.ts base pairs via regex.
// Format: `{ wordA: '...', wordB: '...', difficulty: '...', category: '...', locale: '...' }`
// Handles escaped apostrophes inside strings (e.g. `'Jeanne d\'Arc'`).
// ---------------------------------------------------------------------------

function unescape(s) {
  return s.replace(/\\(['"\\])/g, '$1')
}

function parseSeed(content) {
  const re = /\{\s*wordA:\s*'((?:[^'\\]|\\.)*)',\s*wordB:\s*'((?:[^'\\]|\\.)*)',\s*difficulty:\s*'(\w+)',\s*category:\s*'(\w+)',\s*locale:\s*'(\w+)'\s*\}/g
  const out = []
  let m
  while ((m = re.exec(content)) !== null) {
    out.push({
      wordA: unescape(m[1]),
      wordB: unescape(m[2]),
      difficulty: m[3],
      category: m[4],
      locale: m[5],
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Collect all pairs grouped by locale → category.
// ---------------------------------------------------------------------------

const bucket = {}
for (const loc of LOCALES) {
  bucket[loc] = {}
  for (const cat of CATEGORIES) bucket[loc][cat] = { list: [], seen: new Set() }
}

// Order-insensitive dedup key: {A,B} == {B,A}.
function pushUnique(slot, a, b) {
  const [x, y] = [a, b].sort()
  const key = `${x}|${y}`
  if (slot.seen.has(key)) return
  slot.seen.add(key)
  slot.list.push({ a, b })
}

// Base pairs from seed.ts
const seedContent = readFileSync(SEED, 'utf8')
const basePairs = parseSeed(seedContent)
for (const p of basePairs) {
  const slot = bucket[p.locale]?.[p.category]
  if (slot) pushUnique(slot, p.wordA, p.wordB)
}

// Extended pairs from extended-pairs.ts (dynamic import, --experimental-strip-types)
const extModule = await import(pathToFileURL(EXTENDED).href)
for (const p of extModule.EXTENDED_PAIRS) {
  const slot = bucket[p.locale]?.[p.category]
  if (slot) pushUnique(slot, p.wordA, p.wordB)
}

// V2 pairs from v2-pairs.ts (dynamic import, --experimental-strip-types)
const v2Module = await import(pathToFileURL(V2).href)
for (const p of v2Module.V2_PAIRS) {
  const slot = bucket[p.locale]?.[p.category]
  if (slot) pushUnique(slot, p.wordA, p.wordB)
}

// V3 pairs from v3-pairs.ts (dynamic import, --experimental-strip-types)
const v3Module = await import(pathToFileURL(V3).href)
for (const p of v3Module.V3_PAIRS) {
  const slot = bucket[p.locale]?.[p.category]
  if (slot) pushUnique(slot, p.wordA, p.wordB)
}

// ---------------------------------------------------------------------------
// Count totals per locale/category.
// ---------------------------------------------------------------------------

let total = 0
const MIN_EXPECTED = 100
for (const loc of LOCALES) {
  for (const cat of CATEGORIES) {
    const n = bucket[loc][cat].list.length
    total += n
    if (n < MIN_EXPECTED) {
      console.warn(`[WARN] ${loc}/${cat} has ${n} pairs (expected >= ${MIN_EXPECTED})`)
    }
  }
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

function renderRecord(locale) {
  const lines = ['{']
  for (const cat of CATEGORIES) {
    lines.push(`  ${cat}: [`)
    for (const p of bucket[locale][cat].list) lines.push(renderPair(p))
    lines.push('  ],')
  }
  lines.push('}')
  return lines.join('\n')
}

const HEADER = `import type { WordCategory } from './types'

/**
 * Word pairs for offline / pass-and-play mode.
 * Each pair has a villagerWord and an redHandedWord -- similar but distinct.
 *
 * Generated by scripts/generate-offline-words.mjs from the curated
 * online database pairs (seed.ts + extended-pairs.ts).
 * Offline and online modes use the same pair content.
 *
 * 8 locales x 11 categories x 100+ pairs each (deduplicated).
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

const chunks = [HEADER]
for (const locale of LOCALES) {
  const name = LOCALE_CONST[locale]
  const keyword = locale === 'en' ? 'export const' : 'const'
  chunks.push(
    `\n${keyword} ${name}: Record<WordCategory, OfflineWordPair[]> = ${renderRecord(locale)}\n`,
  )
}
chunks.push(FOOTER)

writeFileSync(OUT, chunks.join(''), 'utf8')
console.log(`Wrote ${OUT}`)
console.log(`${LOCALES.length} locales x ${CATEGORIES.length} categories x 100 pairs = ${total} total`)
