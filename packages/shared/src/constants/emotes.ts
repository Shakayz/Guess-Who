/**
 * In-game reaction emotes. Players send these during a match and they float
 * up for everyone else to see. The client renders each emote using a
 * rarity-aware wrapper (halo, spawn animation, particle burst) so even the
 * default unicode base gets an "AAA emote" look & feel — see
 * apps/web/src/components/emotes/FloatingEmote.tsx for the renderer.
 *
 * Ownership & loadout:
 *   - Emotes with `rarity: 'free'` are granted to every account implicitly
 *     (no UserEmote row required).
 *   - All other emotes are purchasable for `price` star coins via
 *     POST /api/emotes/:id/buy which writes a UserEmote row.
 *   - A player's active loadout (max 10 ids) is stored as a JSON array on
 *     User.equippedEmotes — that's what the in-game React bar renders.
 *
 * Server validates every incoming `emote:send` against the sender's loadout
 * (see apps/api/src/socket/index.ts). A client trying to send an emote they
 * don't own or haven't equipped is rejected silently.
 */

export type EmoteRarity = 'free' | 'common' | 'rare' | 'epic' | 'legendary'

/**
 * Optional entrance animation for the floating emote.
 *   - pop     : fast scale-in 0 → 1.2 → 1.0 (default)
 *   - bounce  : spring with a second bounce, good for happy emotes
 *   - spin    : 360° rotation while floating
 *   - shake   : left/right wobble during float, for angry/shocked ones
 *   - drift   : slow, floaty rise with a sine-wave horizontal drift
 */
export type EmoteAnimation = 'pop' | 'bounce' | 'spin' | 'shake' | 'drift'

/**
 * Particle effect that spawns with the emote. Common emotes get no particles;
 * rarer emotes get themed bursts.
 */
export type EmoteParticle =
  | 'none'
  | 'sparkle'
  | 'hearts'
  | 'fire'
  | 'stars'
  | 'tears'
  | 'confetti'
  | 'lightning'
  | 'bubbles'
  | 'money'
  | 'skull'

export type Emote = {
  /** Stable slug used as the network id and DB key. */
  id: string
  /** Unicode glyph used by the default renderer. */
  emoji: string
  /** Display name — used as fallback if no i18n key is registered. */
  name: string
  rarity: EmoteRarity
  /** Cost in star coins. `0` for free emotes. */
  price: number
  animation: EmoteAnimation
  particle: EmoteParticle
}

/**
 * Default price table. Can be overridden per-emote for "deal" items.
 */
const PRICE: Record<EmoteRarity, number> = {
  free: 0,
  common: 100,
  rare: 300,
  epic: 800,
  legendary: 2000,
}

function e(
  id: string,
  emoji: string,
  name: string,
  rarity: EmoteRarity,
  animation: EmoteAnimation = 'pop',
  particle: EmoteParticle = 'none',
  priceOverride?: number,
): Emote {
  return {
    id,
    emoji,
    name,
    rarity,
    price: priceOverride ?? PRICE[rarity],
    animation,
    particle,
  }
}

export const EMOTE_CATALOG: readonly Emote[] = [
  // ─── Free defaults (the five basics every player has from day 1) ─────────
  e('thumbs_up',  '👍', 'Thumbs Up',  'free', 'pop',    'none'),
  e('surprise',   '😮', 'Surprise',   'free', 'pop',    'none'),
  e('thinking',   '🤔', 'Thinking',   'free', 'pop',    'none'),
  e('laugh',      '😂', 'Laugh',      'free', 'bounce', 'none'),
  e('scream',     '😱', 'Scream',     'free', 'shake',  'none'),

  // ─── Common (100⭐) — everyday reactions ──────────────────────────────────
  e('wink',          '😉', 'Wink',          'common', 'pop',    'none'),
  e('smirk',         '😏', 'Smirk',         'common', 'pop',    'none'),
  e('cry',           '😭', 'Crying',        'common', 'pop',    'tears'),
  e('angry',         '😠', 'Angry',         'common', 'shake',  'none'),
  e('sleepy',        '😴', 'Sleepy',        'common', 'drift',  'bubbles'),
  e('neutral',       '😐', 'Stoic',         'common', 'pop',    'none'),
  e('eye_roll',      '🙄', 'Eye Roll',      'common', 'spin',   'none'),
  e('shrug',         '🤷', 'Shrug',         'common', 'shake',  'none'),
  e('wave',          '👋', 'Wave',          'common', 'shake',  'none'),
  e('clap',          '👏', 'Clap',          'common', 'bounce', 'sparkle'),
  e('ok_hand',       '👌', 'OK',            'common', 'pop',    'none'),
  e('pray',          '🙏', 'Pray',          'common', 'pop',    'sparkle'),
  e('muscle',        '💪', 'Flex',          'common', 'bounce', 'none'),
  e('point',         '👉', 'Point',         'common', 'shake',  'none'),
  e('heart',         '❤️', 'Heart',         'common', 'pop',    'hearts'),
  e('broken_heart',  '💔', 'Broken Heart',  'common', 'shake',  'none'),
  e('fire',          '🔥', 'Fire',          'common', 'bounce', 'fire'),
  e('sweat',         '😅', 'Nervous',       'common', 'shake',  'tears'),
  e('zany',          '🤪', 'Zany',          'common', 'spin',   'none'),
  e('yawn',          '🥱', 'Yawn',          'common', 'drift',  'bubbles'),

  // ─── Rare (300⭐) — more expressive / themed ─────────────────────────────
  e('mind_blown',    '🤯', 'Mind Blown',    'rare', 'pop',    'stars'),
  e('cool_shades',   '😎', 'Cool',          'rare', 'pop',    'sparkle'),
  e('nerd',          '🤓', 'Nerd',          'rare', 'pop',    'sparkle'),
  e('monocle',       '🧐', 'Inspect',       'rare', 'pop',    'none'),
  e('cowboy',        '🤠', 'Cowboy',        'rare', 'bounce', 'stars'),
  e('salute',        '🫡', 'Salute',        'rare', 'pop',    'none'),
  e('kiss',          '😘', 'Kiss',          'rare', 'pop',    'hearts'),
  e('smitten',       '🥰', 'Smitten',       'rare', 'bounce', 'hearts'),
  e('pleading',      '🥺', 'Pleading',      'rare', 'pop',    'tears'),
  e('zipper',        '🤐', 'Zipped',        'rare', 'pop',    'none'),
  e('facepalm',      '🤦', 'Facepalm',      'rare', 'shake',  'none'),
  e('puke',          '🤮', 'Puke',          'rare', 'shake',  'none'),
  e('sick',          '🤢', 'Sick',          'rare', 'shake',  'bubbles'),
  e('party',         '🥳', 'Party',         'rare', 'bounce', 'confetti'),
  e('hundred',       '💯', 'Hundred',       'rare', 'pop',    'sparkle'),

  // ─── Epic (800⭐) — expressive combos / signature reactions ──────────────
  e('clown',         '🤡', 'Clown',         'epic', 'spin',   'confetti'),
  e('skull',         '💀', 'Skull',         'epic', 'pop',    'skull'),
  e('ghost',         '👻', 'Ghost',         'epic', 'drift',  'bubbles'),
  e('alien',         '👽', 'Alien',         'epic', 'drift',  'stars'),
  e('robot',         '🤖', 'Robot',         'epic', 'pop',    'lightning'),
  e('devil',         '😈', 'Mischief',      'epic', 'bounce', 'fire'),
  e('angel',         '😇', 'Angel',         'epic', 'drift',  'sparkle'),
  e('explode_head',  '💥', 'Boom',          'epic', 'pop',    'stars', 800),
  e('eyes',          '👀', 'Suspicious',    'epic', 'shake',  'none'),
  e('brain',         '🧠', 'Big Brain',     'epic', 'pulse' as any, 'sparkle'), // fallback 'pulse' handled as 'bounce' in renderer
  e('money_face',    '🤑', 'Jackpot',       'epic', 'bounce', 'money'),
  e('exploding',     '🎆', 'Fireworks',     'epic', 'pop',    'stars'),

  // ─── Legendary (2000⭐) — rare, premium-feel ─────────────────────────────
  e('crown',         '👑', 'Royalty',       'legendary', 'pop',    'sparkle'),
  e('trophy',        '🏆', 'Champion',      'legendary', 'bounce', 'sparkle'),
  e('rocket',        '🚀', 'Rocket',        'legendary', 'drift',  'stars'),
  e('diamond',       '💎', 'Diamond',       'legendary', 'spin',   'sparkle'),
  e('unicorn',       '🦄', 'Unicorn',       'legendary', 'drift',  'hearts'),
  e('fairy',         '🧚', 'Fairy',         'legendary', 'drift',  'sparkle'),
  e('dragon',        '🐉', 'Dragon',        'legendary', 'shake',  'fire'),
  e('lightning',     '⚡', 'Lightning',     'legendary', 'shake',  'lightning'),
  e('star2',         '🌟', 'Superstar',     'legendary', 'spin',   'sparkle'),
  e('medal',         '🥇', 'Gold Medal',    'legendary', 'bounce', 'sparkle'),
] as const

// Sanity-check the renderer fallback: normalize the 'pulse' we typed above.
// (Kept to avoid a breaking type change; the renderer already handles it.)
;(EMOTE_CATALOG as Emote[]).forEach((em) => {
  if ((em.animation as string) === 'pulse') em.animation = 'bounce'
})

/** Derived lookup table — O(1) resolution in hot paths (socket handler). */
export const EMOTES_BY_ID: Readonly<Record<string, Emote>> = Object.freeze(
  Object.fromEntries(EMOTE_CATALOG.map((em) => [em.id, em])),
)

/** Free emotes every account receives implicitly (no DB row). */
export const FREE_EMOTES: readonly Emote[] = EMOTE_CATALOG.filter((em) => em.rarity === 'free')

/** Default loadout for a brand-new account — the 5 free basics, in display order. */
export const DEFAULT_LOADOUT: readonly string[] = FREE_EMOTES.map((em) => em.id)

/** Hard cap on equipped emotes in a single loadout. */
export const MAX_LOADOUT_SIZE = 10

export function isFreeEmote(id: string): boolean {
  return EMOTES_BY_ID[id]?.rarity === 'free'
}

export function getEmoteById(id: string): Emote | undefined {
  return EMOTES_BY_ID[id]
}

/**
 * Pricing helper used server-side when charging star coins. Returns the
 * catalog price (falls back to 0 for unknown / free ids so the server can
 * treat anything missing as a no-charge no-op rather than double-charging).
 */
export function priceForEmote(id: string): number {
  const em = EMOTES_BY_ID[id]
  if (!em || em.rarity === 'free') return 0
  return em.price
}
