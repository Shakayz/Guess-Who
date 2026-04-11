// ─── Offline-mode vote resolution ──────────────────────────────────────────────
//
// Pure functions used by the pass-and-play screen to filter out silenced
// voters (Corruptor), tally votes with mayor-double / inverter / skip
// support, and resolve elimination ties via Judge or fall-through.

import type { OfflineRole } from './roleConfig'

/** Minimal player shape used by the vote resolution helpers. Consumers can
 *  pass any object that has a `name` and a `role` field. */
export interface VotablePlayer {
  name: string
  role: OfflineRole
  isEliminated?: boolean
}

export interface VoteRecord {
  voterName: string
  targetName: string
}

/**
 * Compute the set of voter-names whose votes are silently dropped because
 * a still-alive Corruptor targeted them. A Corruptor's silence ends the
 * moment that Corruptor is eliminated.
 */
export function applyCorruptorSilencing(
  alivePlayers: readonly VotablePlayer[],
  corruptorTargets: Readonly<Record<string, string>>,
): Set<string> {
  const silenced = new Set<string>()
  for (const p of alivePlayers) {
    if (p.role !== 'corruptor') continue
    const tgt = corruptorTargets[p.name]
    if (tgt) silenced.add(tgt)
  }
  return silenced
}

export interface FilteredTally {
  /** targetName → counted votes (after silencing). */
  tally: Record<string, number>
  /** Total counted votes (sum of tally values). */
  totalCounted: number
}

/**
 * Build a vote tally that respects Corruptor silencing. Mayor double-votes
 * should already be present in the input array (the caller appends an extra
 * record when the Mayor toggle is on).
 */
export function tallyFilteredVotes(
  votes: readonly VoteRecord[],
  silencedVoterNames: ReadonlySet<string>,
): FilteredTally {
  const tally: Record<string, number> = {}
  let totalCounted = 0
  for (const v of votes) {
    if (silencedVoterNames.has(v.voterName)) continue
    tally[v.targetName] = (tally[v.targetName] ?? 0) + 1
    totalCounted += 1
  }
  return { tally, totalCounted }
}

export interface ResolveEliminationOptions {
  /** When true, the player with the FEWEST votes is eliminated instead. */
  inverterActive?: boolean
}

export interface EliminationResolution {
  /** Names of every candidate at the threshold (1 = clean, 2+ = tie). */
  topCandidates: string[]
  /** Whether the threshold-tied set is bigger than 1. */
  isTie: boolean
  /** The eliminated player when there's no tie; null on tie/empty/no-vote. */
  eliminatedName: string | null
}

/**
 * Determine who gets eliminated from a filtered tally.
 *
 * - Empty tally → nothing eliminated.
 * - Single top candidate → that player.
 * - Multiple top candidates → tie (caller decides whether to bring in a Judge).
 *
 * `inverterActive` flips the threshold so the FEWEST-voted candidate is
 * targeted instead — used by the Inverter once-per-game ability.
 */
export function resolveElimination(
  tally: Readonly<Record<string, number>>,
  options: ResolveEliminationOptions = {},
): EliminationResolution {
  const values = Object.values(tally)
  if (values.length === 0) {
    return { topCandidates: [], isTie: false, eliminatedName: null }
  }
  const threshold = options.inverterActive ? Math.min(...values) : Math.max(...values)
  const topCandidates = Object.entries(tally)
    .filter(([, c]) => c === threshold)
    .map(([n]) => n)
  if (topCandidates.length > 1) {
    return { topCandidates, isTie: true, eliminatedName: null }
  }
  return { topCandidates, isTie: false, eliminatedName: topCandidates[0] }
}

/**
 * Find an eligible Judge for breaking a tie. The Judge must be alive AND
 * not be one of the tied candidates (the rules say a Judge cannot save
 * themselves).
 */
export function findEligibleJudge(
  alivePlayers: readonly VotablePlayer[],
  tiedCandidates: readonly string[],
): VotablePlayer | undefined {
  return alivePlayers.find(
    (p) => p.role === 'judge' && !tiedCandidates.includes(p.name),
  )
}

/**
 * High-level helper that runs the full pipeline: silence → tally → resolve.
 * Returns everything the caller needs to render a vote-result screen.
 */
export interface FinalizedRoundOutcome {
  silencedVoterNames: Set<string>
  filtered: FilteredTally
  resolution: EliminationResolution
  judgeForTie: VotablePlayer | null
}

export function finalizeRound(
  votes: readonly VoteRecord[],
  alivePlayers: readonly VotablePlayer[],
  corruptorTargets: Readonly<Record<string, string>>,
  options: ResolveEliminationOptions = {},
): FinalizedRoundOutcome {
  const silencedVoterNames = applyCorruptorSilencing(alivePlayers, corruptorTargets)
  const filtered = tallyFilteredVotes(votes, silencedVoterNames)
  const resolution = resolveElimination(filtered.tally, options)
  const judgeForTie = resolution.isTie
    ? findEligibleJudge(alivePlayers, resolution.topCandidates) ?? null
    : null
  return { silencedVoterNames, filtered, resolution, judgeForTie }
}
