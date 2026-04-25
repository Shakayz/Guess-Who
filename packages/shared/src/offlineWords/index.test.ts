/**
 * offlineWords/index.test.ts
 *
 * Covers the lazy locale-loader pair:
 *   - loadOfflineWords()    — code-split bundle resolver with EN fallback
 *   - pickRandomWordPair()  — category-aware random pick that drives offline games
 *
 * The interesting bits:
 *   - English is eagerly bundled (in-memory cache hit on the very first call).
 *   - Other locales are dynamic-imported on demand and then memoised — a
 *     repeat call must NOT re-import.
 *   - Unknown locale codes silently fall back to English so the lobby can't
 *     produce an empty word list (a soft fallback is the right thing because
 *     locale strings flow in from the user's browser settings).
 *   - pickRandomWordPair must restrict to the supplied categories, and treat
 *     an empty array as "any category" rather than picking nothing.
 */
import { describe, it, expect } from 'vitest'
import {
  loadOfflineWords,
  pickRandomWordPair,
  OFFLINE_WORD_PAIRS,
} from './index'
import type { WordCategory } from '../types'

// Deterministic shuffle — picks the first element. Lets us assert exactly
// which category and pair pickRandomWordPair will return.
const noShuffle = <T,>(arr: T[]): T[] => [...arr]

describe('OFFLINE_WORD_PAIRS', () => {
  it('exposes the eagerly-bundled English locale data as a typed map', () => {
    // The constant is the same object the loader returns for "en", so any
    // consumer that imports it directly stays in sync with cached lookups.
    expect(OFFLINE_WORD_PAIRS).toBeDefined()
    expect(typeof OFFLINE_WORD_PAIRS).toBe('object')
    const cats = Object.keys(OFFLINE_WORD_PAIRS) as WordCategory[]
    expect(cats.length).toBeGreaterThan(0)
    for (const cat of cats) {
      const pairs = OFFLINE_WORD_PAIRS[cat]
      expect(Array.isArray(pairs)).toBe(true)
      expect(pairs.length).toBeGreaterThan(0)
      expect(typeof pairs[0].villagerWord).toBe('string')
      expect(typeof pairs[0].redHandedWord).toBe('string')
    }
  })
})

describe('loadOfflineWords', () => {
  it('returns the eager EN bundle synchronously on the first call (no dynamic import)', async () => {
    const data = await loadOfflineWords('en')
    // Same reference — the eager export and the cache are the same object.
    expect(data).toBe(OFFLINE_WORD_PAIRS)
  })

  it('caches loaded locales — a second call returns the same reference', async () => {
    const a = await loadOfflineWords('fr')
    const b = await loadOfflineWords('fr')
    expect(a).toBe(b)
  })

  it('strips region tags so en-US, en-GB, fr-CA all hit the right base locale', async () => {
    const en = await loadOfflineWords('en-US')
    expect(en).toBe(OFFLINE_WORD_PAIRS)

    const fr1 = await loadOfflineWords('fr-CA')
    const fr2 = await loadOfflineWords('fr-FR')
    // Both region-tags resolve to the same cached `fr` bundle.
    expect(fr1).toBe(fr2)
  })

  it('falls back to English for unknown locale codes', async () => {
    // "xx" isn't in the loader map — should resolve to EN data, not throw.
    const xx = await loadOfflineWords('xx')
    expect(xx).toBe(OFFLINE_WORD_PAIRS)
  })

  it('caches the EN fallback so repeat unknown-locale calls don\'t re-fall-through', async () => {
    const a = await loadOfflineWords('zz')
    const b = await loadOfflineWords('zz')
    expect(a).toBe(b)
  })
})

describe('pickRandomWordPair', () => {
  it('returns a pair from the requested category when one is provided', async () => {
    const cats = Object.keys(OFFLINE_WORD_PAIRS) as WordCategory[]
    const target = cats[0]
    const pick = await pickRandomWordPair([target], noShuffle, 'en')
    expect(pick.category).toBe(target)
    expect(typeof pick.villagerWord).toBe('string')
    expect(typeof pick.redHandedWord).toBe('string')
    // Returned pair must actually exist in the source data.
    const found = OFFLINE_WORD_PAIRS[target].some(
      (p) => p.villagerWord === pick.villagerWord && p.redHandedWord === pick.redHandedWord,
    )
    expect(found).toBe(true)
  })

  it('treats an empty category list as "all categories" rather than picking nothing', async () => {
    const pick = await pickRandomWordPair([], noShuffle, 'en')
    // The category that comes out has to be one of the real ones — not
    // undefined, not an empty string. Confirms the empty-list branch took
    // the all-categories code path.
    expect(Object.keys(OFFLINE_WORD_PAIRS)).toContain(pick.category)
  })

  it('uses the provided shuffle function to choose the category and pair', async () => {
    // Force the LAST category and LAST pair via a reversing shuffle.
    const reverse = <T,>(arr: T[]): T[] => [...arr].reverse()
    const cats = Object.keys(OFFLINE_WORD_PAIRS) as WordCategory[]
    const expectedCategory = cats[cats.length - 1]
    const expectedPair = OFFLINE_WORD_PAIRS[expectedCategory][
      OFFLINE_WORD_PAIRS[expectedCategory].length - 1
    ]
    const pick = await pickRandomWordPair([], reverse, 'en')
    expect(pick.category).toBe(expectedCategory)
    expect(pick.villagerWord).toBe(expectedPair.villagerWord)
    expect(pick.redHandedWord).toBe(expectedPair.redHandedWord)
  })

  it('defaults to English when no locale is passed', async () => {
    const cats = Object.keys(OFFLINE_WORD_PAIRS) as WordCategory[]
    const pick = await pickRandomWordPair([cats[0]], noShuffle)
    // Shape check is enough — the EN fallback is the path that resolves the
    // pairsMap, and we'd have thrown if the resolver returned undefined.
    expect(pick.category).toBe(cats[0])
  })
})
