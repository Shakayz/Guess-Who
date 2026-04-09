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
// Per the plan: bronze 10-25, silver 30-60, gold 75-150, platinum 200-350,
// diamond 500-800, mythic 1500-3000.

export const TIERS_6 = (thresholds: [number, number, number, number, number, number]): Tier[] => [
  { n: thresholds[0], difficulty: 'bronze',   stars: 15,   xp: 10 },
  { n: thresholds[1], difficulty: 'silver',   stars: 40,   xp: 25 },
  { n: thresholds[2], difficulty: 'gold',     stars: 100,  xp: 50 },
  { n: thresholds[3], difficulty: 'platinum', stars: 250,  xp: 120 },
  { n: thresholds[4], difficulty: 'diamond',  stars: 600,  xp: 250 },
  { n: thresholds[5], difficulty: 'mythic',   stars: 2000, xp: 500 },
]

export const TIERS_5 = (thresholds: [number, number, number, number, number]): Tier[] => [
  { n: thresholds[0], difficulty: 'bronze',   stars: 15,   xp: 10 },
  { n: thresholds[1], difficulty: 'silver',   stars: 40,   xp: 25 },
  { n: thresholds[2], difficulty: 'gold',     stars: 100,  xp: 50 },
  { n: thresholds[3], difficulty: 'platinum', stars: 250,  xp: 120 },
  { n: thresholds[4], difficulty: 'diamond',  stars: 600,  xp: 250 },
]

export const TIERS_4 = (thresholds: [number, number, number, number]): Tier[] => [
  { n: thresholds[0], difficulty: 'bronze', stars: 15,  xp: 10 },
  { n: thresholds[1], difficulty: 'silver', stars: 40,  xp: 25 },
  { n: thresholds[2], difficulty: 'gold',   stars: 100, xp: 50 },
  { n: thresholds[3], difficulty: 'platinum', stars: 250, xp: 120 },
]

export const TIERS_3 = (thresholds: [number, number, number]): Tier[] => [
  { n: thresholds[0], difficulty: 'bronze', stars: 15, xp: 10 },
  { n: thresholds[1], difficulty: 'silver', stars: 40, xp: 25 },
  { n: thresholds[2], difficulty: 'gold',   stars: 100, xp: 50 },
]

// Flat per-difficulty reward helper for one-off achievements.
export const REWARD: Record<Difficulty, { stars: number; xp: number }> = {
  bronze:   { stars: 15,   xp: 10 },
  silver:   { stars: 45,   xp: 30 },
  gold:     { stars: 120,  xp: 60 },
  platinum: { stars: 280,  xp: 140 },
  diamond:  { stars: 650,  xp: 260 },
  mythic:   { stars: 2500, xp: 550 },
}
