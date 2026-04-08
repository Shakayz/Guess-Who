import type { Player, Vote, PlayerRole } from '../types'

// ─── Team mapping ─────────────────────────────────────────────────────────────
// Roles grouped by the team whose victory condition they share.
// - Villager side: plays for villager win.
// - Imposter side: plays for imposter win.
// - Jester: solo team (wins alone if voted out).
// - Evil Twins (twin_villager + twin_imposter): paired team. They count toward
//   their respective villager/imposter sides for the head count, BUT if BOTH
//   are alive when any side would normally win, the evil_twins override fires.
const VILLAGER_SIDE_ROLES: readonly PlayerRole[] = [
  'villager',
  'detective',
  'guardian',
  'mayor',
  'judge',
  'revenant',
  'twin_villager',
] as const

const IMPOSTER_SIDE_ROLES: readonly PlayerRole[] = [
  'imposter',
  'double_agent',
  'infiltrator',
  'kamikaze',
  'corruptor',
  'inverter',
  'twin_imposter',
] as const

export function isVillagerSideRole(role: PlayerRole | undefined): boolean {
  return !!role && VILLAGER_SIDE_ROLES.includes(role)
}

export function isImposterSideRole(role: PlayerRole | undefined): boolean {
  return !!role && IMPOSTER_SIDE_ROLES.includes(role)
}

export function isJesterRole(role: PlayerRole | undefined): boolean {
  return role === 'jester'
}

export function isTwinRole(role: PlayerRole | undefined): boolean {
  return role === 'twin_villager' || role === 'twin_imposter'
}

export function countAlive(players: Player[]): { villagers: number; imposters: number; jesters: number } {
  const alive = players.filter((p) => p.status === 'alive')
  return {
    villagers: alive.filter((p) => isVillagerSideRole(p.role)).length,
    imposters: alive.filter((p) => isImposterSideRole(p.role)).length,
    jesters:   alive.filter((p) => isJesterRole(p.role)).length,
  }
}

/**
 * Standard 2-team win check + evil-twins override.
 *
 * Jester win is NOT handled here — it is triggered at vote-resolution time
 * when the jester is eliminated by vote. Jesters still alive are ignored in
 * this calculation (they don't count toward either team's head count).
 *
 * Evil twins: if both twins (twin_villager + twin_imposter, linked by
 * `twinPartnerUserId`) are alive at the moment a standard winner would
 * normally be announced, the outcome is upgraded to 'evil_twins' — both twins
 * win together. If one twin is dead when the standard winner is decided, the
 * standard result stands and the surviving twin is treated as an individual
 * LOSER at the results screen (their natural team may have won, but they
 * lose because their pair didn't).
 */
export function checkWinCondition(players: Player[]): 'villagers' | 'imposters' | 'evil_twins' | null {
  const { villagers, imposters } = countAlive(players)
  // No alive players at all — no winner (should not happen in practice)
  if (villagers === 0 && imposters === 0) return null

  let baseWinner: 'villagers' | 'imposters' | null = null
  if (imposters === 0) baseWinner = 'villagers'
  else if (imposters >= villagers) baseWinner = 'imposters'

  if (!baseWinner) return null

  // Evil twins override: both twins alive → evil_twins win together.
  const twinVillager = players.find((p) => p.role === 'twin_villager')
  const twinImposter = players.find((p) => p.role === 'twin_imposter')
  if (
    twinVillager &&
    twinImposter &&
    twinVillager.status === 'alive' &&
    twinImposter.status === 'alive' &&
    twinVillager.twinPartnerUserId === twinImposter.userId
  ) {
    return 'evil_twins'
  }

  return baseWinner
}

export function getMostVoted(votes: Vote[]): string | null {
  if (votes.length === 0) return null
  const tally: Record<string, number> = {}
  for (const v of votes) {
    tally[v.targetId] = (tally[v.targetId] ?? 0) + 1
  }
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
  if (sorted.length < 2 || sorted[0][1] !== sorted[1][1]) {
    return sorted[0][0]
  }
  return null // tie
}

/** Returns the IDs of players tied for most votes. Empty array if no votes. */
export function getTiedPlayerIds(votes: Vote[]): string[] {
  if (votes.length === 0) return []
  const tally: Record<string, number> = {}
  for (const v of votes) {
    tally[v.targetId] = (tally[v.targetId] ?? 0) + 1
  }
  const maxVotes = Math.max(...Object.values(tally))
  return Object.entries(tally)
    .filter(([, count]) => count === maxVotes)
    .map(([id]) => id)
}

// ─── Weighted tally (mayor double-vote + corruptor filter + inverter flip) ───

/**
 * Tallies votes while honoring all vote-manipulation roles:
 *
 * - **Mayor** (`mayorDoubleActive`): their vote counts twice.
 * - **Corruptor** (`corrupted` flag on target): votes cast by a corrupted
 *   player are silently dropped (the player still sees their vote; the tally
 *   just ignores it).
 * - **Inverter** (any alive player with `inverterActive`): once tallied, the
 *   result is flipped — the player with the LEAST votes gets "most voted".
 *   Ties on the flipped side still return a tie.
 *
 * Returns both the winner (or null on tie) and the tied IDs for tiebreaker
 * handling, so call sites don't need to tally twice.
 */
export function tallyVotes(
  votes: Vote[],
  players: Player[],
): { mostVotedId: string | null; tiedIds: string[]; weightedTally: Record<string, number>; inverted: boolean } {
  const inverted = players.some((p) => p.inverterActive === true)

  if (votes.length === 0) {
    return { mostVotedId: null, tiedIds: [], weightedTally: {}, inverted }
  }

  const mayorDoublers = new Set(
    players
      .filter((p) => p.role === 'mayor' && p.mayorDoubleActive === true)
      .map((p) => p.userId),
  )

  const corruptedVoters = new Set(
    players.filter((p) => p.corrupted === true).map((p) => p.userId),
  )

  const tally: Record<string, number> = {}
  for (const v of votes) {
    // Corruptor: silently drop votes from corrupted players.
    if (corruptedVoters.has(v.voterId)) continue
    const weight = mayorDoublers.has(v.voterId) ? 2 : 1
    tally[v.targetId] = (tally[v.targetId] ?? 0) + weight
  }

  const entries = Object.entries(tally)
  if (entries.length === 0) {
    return { mostVotedId: null, tiedIds: [], weightedTally: tally, inverted }
  }

  // Sort descending (for normal) or ascending (for inverted).
  const sorted = [...entries].sort((a, b) => (inverted ? a[1] - b[1] : b[1] - a[1]))
  const targetCount = sorted[0][1]
  const tiedIds = sorted.filter(([, c]) => c === targetCount).map(([id]) => id)
  const mostVotedId = tiedIds.length === 1 ? tiedIds[0] : null

  return { mostVotedId, tiedIds, weightedTally: tally, inverted }
}

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}
