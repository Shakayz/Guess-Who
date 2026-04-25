import type { WordCategory } from '../types'
import EN_PAIRS from './en'

/**
 * Word pairs for offline / pass-and-play mode and online default rooms.
 * Each pair has a villagerWord and a redHandedWord — same category, different items.
 *
 * Locales are split into separate chunks; bundlers code-split them so a user
 * only downloads the data for their active locale (~600 KB) instead of the
 * full 5.8 MB. English is eagerly bundled as the always-available fallback.
 */
export interface OfflineWordPair {
  villagerWord: string
  redHandedWord: string
}

type LocaleData = Record<WordCategory, OfflineWordPair[]>

/** Eagerly-bundled English pairs — also used as the fallback for unknown locales. */
export const OFFLINE_WORD_PAIRS: LocaleData = EN_PAIRS

const LOADERS: Record<string, () => Promise<{ default: LocaleData }>> = {
  en: () => Promise.resolve({ default: EN_PAIRS }),
  fr: () => import('./fr'),
  es: () => import('./es'),
  de: () => import('./de'),
  ar: () => import('./ar'),
  it: () => import('./it'),
  pt: () => import('./pt'),
  zh: () => import('./zh'),
  ru: () => import('./ru'),
  hi: () => import('./hi'),
}

const cache = new Map<string, LocaleData>([['en', EN_PAIRS]])

/**
 * Load a locale's offline word pairs. Cached after first call.
 * Falls back to English data if the locale code is unknown.
 */
export async function loadOfflineWords(locale: string): Promise<LocaleData> {
  const key = locale.substring(0, 2)
  const cached = cache.get(key)
  if (cached) return cached
  const loader = LOADERS[key]
  if (!loader) {
    cache.set(key, EN_PAIRS)
    return EN_PAIRS
  }
  const mod = await loader()
  cache.set(key, mod.default)
  return mod.default
}

/**
 * Pick a random word pair from the given categories and locale.
 * Lazy-loads the locale chunk on first use, then resolves from cache.
 *
 * If `categories` is empty, picks across all categories.
 */
export async function pickRandomWordPair(
  categories: WordCategory[],
  shuffleFn: <T>(arr: T[]) => T[],
  locale?: string,
): Promise<OfflineWordPair & { category: WordCategory }> {
  const pairsMap = await loadOfflineWords(locale ?? 'en')
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
