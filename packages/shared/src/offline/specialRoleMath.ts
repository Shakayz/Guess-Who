// ─── Special-role count math (offline + lobby) ────────────────────────────────
//
// Pure functions that compute the legal min/max for each special role given a
// player count and the current selection. Both the offline pass-and-play
// screen and the online lobby use these to clamp +/- steppers and to auto
// reduce overflow when the player count drops.

export interface SpecialRoleCounts {
  detective:   number
  guardian:    number
  mayor:       number
  judge:       number
  revenant:    number
  doubleAgent: number
  infiltrator: number
  kamikaze:    number
  corruptor:   number
  inverter:    number
  /** 0 or 1: enables the paired twin_villager + twin_red_handed duo. */
  evilTwins:   number
  jester:      number
}

export const ZERO_SPECIAL_COUNTS: Readonly<SpecialRoleCounts> = Object.freeze({
  detective:   0,
  guardian:    0,
  mayor:       0,
  judge:       0,
  revenant:    0,
  doubleAgent: 0,
  infiltrator: 0,
  kamikaze:    0,
  corruptor:   0,
  inverter:    0,
  evilTwins:   0,
  jester:      0,
})

/**
 * Default redHanded count for a given table size.
 * 3-4 players → 1 redHanded, 5-7 → 2, 8-11 → 3, 12+ → 4.
 */
export function getDefaultRedHandedCount(playerCount: number): number {
  if (playerCount <= 4) return 1
  if (playerCount <= 7) return 2
  if (playerCount <= 11) return 3
  return 4
}

/**
 * Hard cap on redHanded: redHanded never exceed 1/3 of players, but always
 * at least 1, and never more than 6 (server-side ranked rule).
 */
export function maxRedHandedFor(playerCount: number): number {
  return Math.max(1, Math.min(6, Math.floor(playerCount / 3)))
}

/** Minimum players required for a given mode. */
export function minPlayersFor(mode: 'normal' | 'special'): number {
  return mode === 'special' ? 5 : 3
}

/** Counts a single Evil Twins toggle as 1 red-handed-side slot AND 1 villager-side
 *  slot, since it produces twinRedHanded + twinVillager. */
export interface RoleHeadroom {
  /** Total evil-side players = redHandedCount (which now includes special evil roles). */
  currentEvil: number
  /** Total villager-side specials currently selected. Does not include base villagers. */
  currentGoodSpecial: number
  /** Headroom for additional special evil roles within the redHandedCount budget. */
  evilHeadroom: number
  /** Headroom for villager-side specials. Always leaves at least 1 plain villager. */
  goodHeadroom: number
}

export function computeRoleHeadroom(
  playerCount: number,
  redHandedCount: number,
  counts: SpecialRoleCounts,
): RoleHeadroom {
  // redHandedCount is now the TOTAL evil-side budget. Special evil roles
  // come from within it; evilHeadroom = how many more specials can be added.
  const evilExtras =
    counts.doubleAgent +
    counts.infiltrator +
    counts.kamikaze +
    counts.corruptor +
    counts.inverter +
    counts.evilTwins
  const currentEvil = redHandedCount
  const evilHeadroom = Math.max(0, redHandedCount - evilExtras)

  const currentGoodSpecial =
    counts.detective + counts.guardian + counts.mayor + counts.judge + counts.revenant
  // redHandedCount already includes all evil roles; evilTwins adds 1 villager-side slot
  const slotsUsed = redHandedCount + currentGoodSpecial + counts.evilTwins // +twinVillager
  // Allow all villager slots to be special (no forced plain villager)
  const goodHeadroom = Math.max(0, playerCount - slotsUsed)

  return { currentEvil, currentGoodSpecial, evilHeadroom, goodHeadroom }
}

export interface MaxSpecialCounts {
  detective:   number
  guardian:    number
  mayor:       number
  judge:       number
  revenant:    number
  doubleAgent: number
  infiltrator: number
  kamikaze:    number
  corruptor:   number
  inverter:    number
  evilTwins:   number
  jester:      number
}

/**
 * Per-role hard caps (not counting headroom). These mirror the in-game design
 * limits independent of player count.
 */
export const ROLE_HARD_CAPS: Readonly<MaxSpecialCounts> = Object.freeze({
  detective:   3,
  guardian:    2,
  mayor:       1,
  judge:       1,
  revenant:    1,
  doubleAgent: 2,
  infiltrator: 2,
  kamikaze:    2,
  corruptor:   1,
  inverter:    1,
  evilTwins:   1,
  jester:      1,
})

/** Neutral roles (jester) only unlock at 10+ players. */
export const NEUTRAL_UNLOCK_PLAYER_COUNT = 10

export function isNeutralUnlocked(playerCount: number): boolean {
  return playerCount >= NEUTRAL_UNLOCK_PLAYER_COUNT
}

/**
 * Compute the maximum legal value for every role stepper given the current
 * selection. Each result is `min(hardCap, currentValue + headroom)` so the UI
 * never produces a value above what the player count allows.
 */
export function computeMaxRoleCounts(
  playerCount: number,
  redHandedCount: number,
  counts: SpecialRoleCounts,
): MaxSpecialCounts {
  const { evilHeadroom, goodHeadroom } = computeRoleHeadroom(
    playerCount,
    redHandedCount,
    counts,
  )
  const neutralUnlocked = isNeutralUnlocked(playerCount)

  return {
    detective:   Math.min(ROLE_HARD_CAPS.detective,   counts.detective   + goodHeadroom),
    guardian:    Math.min(ROLE_HARD_CAPS.guardian,    counts.guardian    + goodHeadroom),
    mayor:       Math.min(ROLE_HARD_CAPS.mayor,       counts.mayor       + goodHeadroom),
    judge:       Math.min(ROLE_HARD_CAPS.judge,       counts.judge       + goodHeadroom),
    revenant:    Math.min(ROLE_HARD_CAPS.revenant,    counts.revenant    + goodHeadroom),
    doubleAgent: Math.min(ROLE_HARD_CAPS.doubleAgent, counts.doubleAgent + evilHeadroom),
    infiltrator: Math.min(ROLE_HARD_CAPS.infiltrator, counts.infiltrator + evilHeadroom),
    kamikaze:    Math.min(ROLE_HARD_CAPS.kamikaze,    counts.kamikaze    + evilHeadroom),
    corruptor:   Math.min(ROLE_HARD_CAPS.corruptor,   counts.corruptor   + evilHeadroom),
    inverter:    Math.min(ROLE_HARD_CAPS.inverter,    counts.inverter    + evilHeadroom),
    evilTwins:   Math.min(ROLE_HARD_CAPS.evilTwins,   counts.evilTwins   + Math.min(evilHeadroom, goodHeadroom)),
    jester:      neutralUnlocked
      ? Math.min(ROLE_HARD_CAPS.jester, counts.jester + goodHeadroom)
      : 0,
  }
}

/**
 * Auto-reduce special evil-side counts when they exceed redHandedCount.
 * redHandedCount is the total evil budget; special evil roles must fit within it.
 * Roles are decremented in reverse priority order so the most exotic roles
 * disappear first while the baseline redHanded count is preserved.
 *
 * Returns the (possibly mutated) counts AND a flag indicating whether anything
 * changed. Pure: the input is not mutated.
 */
export function autoReduceOverflow(
  _playerCount: number,
  redHandedCount: number,
  counts: SpecialRoleCounts,
): { counts: SpecialRoleCounts; changed: boolean } {
  const evilExtras =
    counts.doubleAgent +
    counts.infiltrator +
    counts.kamikaze +
    counts.corruptor +
    counts.inverter +
    counts.evilTwins
  const excess = Math.max(0, evilExtras - redHandedCount)
  if (excess === 0) return { counts, changed: false }

  // Reduce in reverse priority order: evilTwins → inverter → corruptor →
  // kamikaze → infiltrator → doubleAgent.
  const next: SpecialRoleCounts = { ...counts }
  let remaining = excess
  const reducers: (keyof SpecialRoleCounts)[] = [
    'evilTwins',
    'inverter',
    'corruptor',
    'kamikaze',
    'infiltrator',
    'doubleAgent',
  ]
  for (const k of reducers) {
    if (remaining <= 0) break
    const cur = next[k]
    if (cur <= 0) continue
    const reduceBy = Math.min(cur, remaining)
    next[k] = cur - reduceBy
    remaining -= reduceBy
  }
  return { counts: next, changed: true }
}

/**
 * Clamp redHanded count to the legal range for a given player count.
 * Used by the lobby +/- stepper to enforce ≤ 1/3 of players and ≤ 6.
 */
export function clampRedHandedCount(playerCount: number, requested: number): number {
  return Math.max(1, Math.min(maxRedHandedFor(playerCount), requested))
}
