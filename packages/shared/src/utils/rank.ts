import { RANK_TIERS, RANK_CONFIG } from '../constants'
import type { RankTier } from '../types'

/**
 * Derives the rank tier from an absolute (cumulative) LP total.
 *
 * Band map derived from RANK_CONFIG.lpRequired thresholds:
 *   wooden:      0   – 99
 *   bronze:      100 – 199
 *   silver:      200 – 299
 *   gold:        300 – 399
 *   diamond:     400 – 499
 *   master:      500 – 599
 *   grandmaster: 600+
 */
export function getTierFromLP(lp: number): RankTier {
  // Walk tiers from highest to lowest.
  // A player belongs to the highest tier whose lower bound they meet.
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    const tier = RANK_TIERS[i]
    const lowerBound = i === 0 ? 0 : RANK_CONFIG[RANK_TIERS[i - 1]].lpRequired
    if (lp >= lowerBound) return tier
  }
  return 'wooden'
}

/**
 * Applies an LP delta and computes the resulting rank state.
 *
 * Rules:
 * - Global floor: LP is clamped to 0 — no player ever goes negative.
 * - Wooden players can't demote (their lower bound is already 0).
 * - All other tiers can dip below their threshold, triggering a demotion.
 */
export function computeRankUpdate(
  currentLP: number,
  lpDelta: number,
): { newLP: number; newTier: RankTier; promoted: boolean; demoted: boolean } {
  const oldTier = getTierFromLP(currentLP)
  const newLP   = Math.max(0, currentLP + lpDelta)
  const newTier = getTierFromLP(newLP)

  const idx      = (t: RankTier) => RANK_TIERS.indexOf(t)
  const promoted = idx(newTier) > idx(oldTier)
  const demoted  = idx(newTier) < idx(oldTier)

  return { newLP, newTier, promoted, demoted }
}
