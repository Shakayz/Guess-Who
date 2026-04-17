// Shared factories used by every evaluator file. Lets us define a
// progression tier (1/10/50/100/500/1000 wins) in one line and get both the
// AchievementDef entries AND the Evaluator check functions for free.

import type {
  AchievementDef,
  Category,
  Difficulty,
  Evaluator,
  EventContext,
  EventType,
  UserStats,
} from '../types'

export interface Tier {
  n: number
  difficulty: Difficulty
  stars: number
  xp: number
}

export interface ProgressionSpec {
  keyPrefix: string
  category: Category
  icon: string
  name: (n: number) => string
  description: (n: number) => string
  event: EventType
  /** Read the relevant count off UserStats. */
  getCount: (stats: UserStats, ctx: EventContext) => number
  tiers: Tier[]
  isSecret?: boolean
}

/**
 * Generate `tiers.length` achievements + matching evaluators from a single
 * spec. The evaluator fires when the user's count on stats >= the tier
 * threshold; since every call first consults the already-unlocked set in
 * evaluateEvent(), a tier only unlocks once.
 */
export function progression(spec: ProgressionSpec): {
  defs: AchievementDef[]
  evals: Evaluator[]
} {
  const defs: AchievementDef[] = []
  const evals: Evaluator[] = []
  for (const tier of spec.tiers) {
    const key = `${spec.keyPrefix}_${tier.n}`
    defs.push({
      key,
      name: spec.name(tier.n),
      description: spec.description(tier.n),
      icon: spec.icon,
      category: spec.category,
      difficulty: tier.difficulty,
      xpReward: tier.xp,
      coinReward: tier.stars,
      isSecret: spec.isSecret,
    })
    evals.push({
      key,
      event: spec.event,
      check: (ctx) => spec.getCount(ctx.stats, ctx) >= tier.n,
    })
  }
  return { defs, evals }
}

/** Shorthand for a single one-off achievement with its evaluator. */
export function single(
  def: AchievementDef,
  event: EventType,
  check: (ctx: EventContext) => boolean | Promise<boolean>,
): { defs: AchievementDef[]; evals: Evaluator[] } {
  return { defs: [def], evals: [{ key: def.key, event, check }] }
}

/** Concatenate many { defs, evals } results. */
export function merge(
  ...groups: Array<{ defs: AchievementDef[]; evals: Evaluator[] }>
): { defs: AchievementDef[]; evals: Evaluator[] } {
  return {
    defs: groups.flatMap((g) => g.defs),
    evals: groups.flatMap((g) => g.evals),
  }
}

// Standard tier templates so reward amounts stay consistent across categories.
// Rewards scale steeply with difficulty: bronze is intentionally tiny (a
// participation trophy), silver is modest, and the real payouts start at gold.
// This keeps players from farming 400+ stars from passive "play at hour XX"
// secrets while preserving meaningful payouts for genuinely hard achievements.

export const TIERS_6 = (thresholds: [number, number, number, number, number, number]): Tier[] => [
  { n: thresholds[0], difficulty: 'bronze',   stars: 5,    xp: 5 },
  { n: thresholds[1], difficulty: 'silver',   stars: 25,   xp: 20 },
  { n: thresholds[2], difficulty: 'gold',     stars: 100,  xp: 55 },
  { n: thresholds[3], difficulty: 'platinum', stars: 300,  xp: 140 },
  { n: thresholds[4], difficulty: 'diamond',  stars: 800,  xp: 300 },
  { n: thresholds[5], difficulty: 'mythic',   stars: 3500, xp: 700 },
]

export const TIERS_5 = (thresholds: [number, number, number, number, number]): Tier[] => [
  { n: thresholds[0], difficulty: 'bronze',   stars: 5,    xp: 5 },
  { n: thresholds[1], difficulty: 'silver',   stars: 25,   xp: 20 },
  { n: thresholds[2], difficulty: 'gold',     stars: 100,  xp: 55 },
  { n: thresholds[3], difficulty: 'platinum', stars: 300,  xp: 140 },
  { n: thresholds[4], difficulty: 'diamond',  stars: 800,  xp: 300 },
]

export const TIERS_4 = (thresholds: [number, number, number, number]): Tier[] => [
  { n: thresholds[0], difficulty: 'bronze',   stars: 5,    xp: 5 },
  { n: thresholds[1], difficulty: 'silver',   stars: 25,   xp: 20 },
  { n: thresholds[2], difficulty: 'gold',     stars: 100,  xp: 55 },
  { n: thresholds[3], difficulty: 'platinum', stars: 300,  xp: 140 },
]

export const TIERS_3 = (thresholds: [number, number, number]): Tier[] => [
  { n: thresholds[0], difficulty: 'bronze', stars: 5,   xp: 5 },
  { n: thresholds[1], difficulty: 'silver', stars: 25,  xp: 20 },
  { n: thresholds[2], difficulty: 'gold',   stars: 100, xp: 55 },
]

// Flat per-difficulty reward helper for one-off achievements.
// Bronze is tiny on purpose: it's a participation stamp, not a meaningful
// payout. Mythic is a massive jackpot reserved for "once in a lifetime" gates.
export const REWARD: Record<Difficulty, { stars: number; xp: number }> = {
  bronze:   { stars: 5,    xp: 5 },
  silver:   { stars: 30,   xp: 25 },
  gold:     { stars: 120,  xp: 70 },
  platinum: { stars: 350,  xp: 160 },
  diamond:  { stars: 900,  xp: 320 },
  mythic:   { stars: 4000, xp: 750 },
}
