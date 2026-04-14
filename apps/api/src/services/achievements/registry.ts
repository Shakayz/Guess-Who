// Central registry — combines every evaluator module into two exported arrays:
//   DEFAULT_ACHIEVEMENTS → used by the boot-time seed loop in routes/achievements.ts
//   EVALUATORS           → used by evaluateEvent() in index.ts
//
// The total should exceed 400 achievements. The seed loop is idempotent so
// adding new entries here is a zero-downtime operation.

import type { AchievementDef, Evaluator, EventType } from './types'
import { childLogger } from '../../config/logger'
import { GAME_END_DEFS, GAME_END_EVALS } from './evaluators/gameEnd'

const log = childLogger('achievements:registry')
import { SOCIAL_DEFS, SOCIAL_EVALS } from './evaluators/social'
import { RANKED_DEFS, RANKED_EVALS } from './evaluators/ranked'
import { ECONOMY_DEFS, ECONOMY_EVALS } from './evaluators/economy'
import { MILESTONES_DEFS, MILESTONES_EVALS } from './evaluators/milestones'
import { META_DEFS, META_EVALS } from './evaluators/meta'
import { EXTRAS_DEFS, EXTRAS_EVALS } from './evaluators/extras'

// ─── Combine all definitions ────────────────────────────────────────────────

const ALL_DEFS: AchievementDef[] = [
  ...GAME_END_DEFS,
  ...SOCIAL_DEFS,
  ...RANKED_DEFS,
  ...ECONOMY_DEFS,
  ...MILESTONES_DEFS,
  ...META_DEFS,
  ...EXTRAS_DEFS,
]

const ALL_EVALS: Evaluator[] = [
  ...GAME_END_EVALS,
  ...SOCIAL_EVALS,
  ...RANKED_EVALS,
  ...ECONOMY_EVALS,
  ...MILESTONES_EVALS,
  ...META_EVALS,
  ...EXTRAS_EVALS,
]

// ─── De-duplicate by key ─────────────────────────────────────────────────────
// Multiple evaluator files occasionally need the same achievement key. We
// keep the first def seen and allow multiple evaluators per key (a single
// achievement can fire on more than one event type — e.g. rank tier fires on
// both rank_changed AND game_end).

const seen = new Set<string>()
const dedupedDefs: AchievementDef[] = []
for (const def of ALL_DEFS) {
  if (seen.has(def.key)) continue
  seen.add(def.key)
  dedupedDefs.push(def)
}

// Sanity warning if any evaluator references a key missing from the defs.
const defKeys = new Set(dedupedDefs.map((d) => d.key))
for (const ev of ALL_EVALS) {
  if (!defKeys.has(ev.key)) {
    log.warn({ key: ev.key }, 'evaluator references unknown achievement key')
  }
}

export const DEFAULT_ACHIEVEMENTS: readonly AchievementDef[] = Object.freeze(dedupedDefs)
export const EVALUATORS: readonly Evaluator[] = Object.freeze(ALL_EVALS)

// Map of EventType → candidate evaluators, built once at module load.
// evaluateEvent() reads from here in O(1).
export const EVALUATORS_BY_EVENT: Record<EventType, Evaluator[]> = (() => {
  const map: Record<EventType, Evaluator[]> = {
    game_end: [],
    friend_added: [],
    honor_given: [],
    honor_received: [],
    dm_sent: [],
    gift_sent: [],
    gift_received: [],
    daily_login: [],
    shop_purchase: [],
    cosmetic_equipped: [],
    word_pack_created: [],
    avatar_changed: [],
    level_up: [],
    rank_changed: [],
    achievement_unlocked: [],
    achievement_claimed: [],
  }
  for (const ev of ALL_EVALS) {
    if (map[ev.event]) map[ev.event].push(ev)
  }
  return map
})()

// Quick diagnostics exposed for tests and for the /achievements route boot log.
export const REGISTRY_STATS = Object.freeze({
  totalAchievements: dedupedDefs.length,
  totalEvaluators: ALL_EVALS.length,
  byCategory: dedupedDefs.reduce<Record<string, number>>((acc, d) => {
    acc[d.category] = (acc[d.category] ?? 0) + 1
    return acc
  }, {}),
  byDifficulty: dedupedDefs.reduce<Record<string, number>>((acc, d) => {
    acc[d.difficulty] = (acc[d.difficulty] ?? 0) + 1
    return acc
  }, {}),
})
