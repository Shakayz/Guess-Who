// ─── Offline-mode role registry ────────────────────────────────────────────────
//
// Single source of truth for the 15 special roles used by both the web and
// native pass-and-play screens. Each entry is platform-agnostic: only the
// i18n keys, an emoji icon, a `team` for grouping, and a `colorToken` are
// stored. UI layers translate the colorToken into Tailwind classes (web or
// NativeWind).

/**
 * Offline role keys. Mirrors the camelCase identifiers used in
 * `apps/web/src/pages/OfflinePage.tsx`. The online server uses snake_case
 * via `PlayerRole` in `../types`; mappings between the two are intentionally
 * kept inside the consumers (web/native) so this module stays standalone.
 */
export type OfflineRole =
  | 'villager'
  | 'red_handed'
  | 'detective'
  | 'doubleAgent'
  | 'guardian'
  | 'mayor'
  | 'judge'
  | 'revenant'
  | 'infiltrator'
  | 'jester'
  | 'kamikaze'
  | 'corruptor'
  | 'inverter'
  | 'twinVillager'
  | 'twinRedHanded'

export type OfflineTeam = 'villager' | 'red_handed' | 'pair' | 'neutral'

/** Role accent colour. Matches Tailwind palette names so consumers can plug
 *  it directly into their own classname builders without a translation table. */
export type OfflineRoleColor =
  | 'emerald'
  | 'red'
  | 'blue'
  | 'amber'
  | 'yellow'
  | 'indigo'
  | 'teal'
  | 'fuchsia'
  | 'pink'
  | 'orange'
  | 'rose'
  | 'purple'

export interface OfflineRoleDef {
  key: OfflineRole
  team: OfflineTeam
  iconEmoji: string
  colorToken: OfflineRoleColor
  /** i18next key for the human-readable role name. */
  i18nLabelKey: string
  /** i18next key for the short rule description (used on cards & HTP). */
  i18nDescKey: string
  /** i18next key for the long-form first-person instruction shown on the
   *  role-reveal card during the dealing phase. */
  i18nInstructionKey: string
}

/** Roles that play for the redHanded team (know the redHanded word). */
export const EVIL_OFFLINE_ROLES: readonly OfflineRole[] = [
  'red_handed',
  'doubleAgent',
  'infiltrator',
  'kamikaze',
  'corruptor',
  'inverter',
  'twinRedHanded',
] as const

export function isEvilOfflineRole(role: OfflineRole): boolean {
  return EVIL_OFFLINE_ROLES.includes(role)
}

/** Number of post-death vote rounds for the Revenant. */
export const REVENANT_POST_DEATH_ROUNDS = 2

export const OFFLINE_ROLE_REGISTRY: Readonly<Record<OfflineRole, OfflineRoleDef>> = {
  villager:     { key: 'villager',     team: 'villager', iconEmoji: '🟢', colorToken: 'emerald', i18nLabelKey: 'offline.villager',     i18nDescKey: 'offline.htpVillagerDesc',     i18nInstructionKey: 'offline.roleInstructionVillager' },
  red_handed:   { key: 'red_handed',     team: 'red_handed', iconEmoji: '🔴', colorToken: 'red',     i18nLabelKey: 'offline.redHanded',     i18nDescKey: 'offline.htpRedHandedDesc',     i18nInstructionKey: 'offline.roleInstructionRedHanded' },
  detective:    { key: 'detective',    team: 'villager', iconEmoji: '🔍', colorToken: 'blue',    i18nLabelKey: 'offline.detective',    i18nDescKey: 'offline.htpDetectiveDesc',    i18nInstructionKey: 'offline.roleInstructionDetective' },
  doubleAgent:  { key: 'doubleAgent',  team: 'red_handed', iconEmoji: '🕵️', colorToken: 'amber',   i18nLabelKey: 'offline.doubleAgent',  i18nDescKey: 'offline.htpDoubleAgentDesc',  i18nInstructionKey: 'offline.roleInstructionDoubleAgent' },
  guardian:     { key: 'guardian',     team: 'villager', iconEmoji: '🛡️', colorToken: 'yellow',  i18nLabelKey: 'offline.guardian',     i18nDescKey: 'offline.htpGuardianDesc',     i18nInstructionKey: 'offline.roleInstructionGuardian' },
  mayor:        { key: 'mayor',        team: 'villager', iconEmoji: '👑', colorToken: 'indigo',  i18nLabelKey: 'offline.mayor',        i18nDescKey: 'offline.htpMayorDesc',        i18nInstructionKey: 'offline.roleInstructionMayor' },
  judge:        { key: 'judge',        team: 'villager', iconEmoji: '⚖️', colorToken: 'emerald', i18nLabelKey: 'offline.judge',        i18nDescKey: 'offline.htpJudgeDesc',        i18nInstructionKey: 'offline.roleInstructionJudge' },
  revenant:     { key: 'revenant',     team: 'villager', iconEmoji: '👻', colorToken: 'teal',    i18nLabelKey: 'offline.revenant',     i18nDescKey: 'offline.htpRevenantDesc',     i18nInstructionKey: 'offline.roleInstructionRevenant' },
  infiltrator:  { key: 'infiltrator',  team: 'red_handed', iconEmoji: '🥷', colorToken: 'fuchsia', i18nLabelKey: 'offline.infiltrator',  i18nDescKey: 'offline.htpInfiltratorDesc',  i18nInstructionKey: 'offline.roleInstructionInfiltrator' },
  jester:       { key: 'jester',       team: 'neutral',  iconEmoji: '🃏', colorToken: 'pink',    i18nLabelKey: 'offline.jester',       i18nDescKey: 'offline.htpJesterDesc',       i18nInstructionKey: 'offline.roleInstructionJester' },
  kamikaze:     { key: 'kamikaze',     team: 'red_handed', iconEmoji: '💥', colorToken: 'red',     i18nLabelKey: 'offline.kamikaze',     i18nDescKey: 'offline.htpKamikazeDesc',     i18nInstructionKey: 'offline.roleInstructionKamikaze' },
  corruptor:    { key: 'corruptor',    team: 'red_handed', iconEmoji: '🕷️', colorToken: 'orange',  i18nLabelKey: 'offline.corruptor',    i18nDescKey: 'offline.htpCorruptorDesc',    i18nInstructionKey: 'offline.roleInstructionCorruptor' },
  inverter:     { key: 'inverter',     team: 'red_handed', iconEmoji: '🔄', colorToken: 'rose',    i18nLabelKey: 'offline.inverter',     i18nDescKey: 'offline.htpInverterDesc',     i18nInstructionKey: 'offline.roleInstructionInverter' },
  twinVillager: { key: 'twinVillager', team: 'pair',     iconEmoji: '👯', colorToken: 'purple',  i18nLabelKey: 'offline.twinVillager', i18nDescKey: 'offline.htpEvilTwinsDesc',    i18nInstructionKey: 'offline.roleInstructionTwinVillager' },
  twinRedHanded: { key: 'twinRedHanded', team: 'pair',     iconEmoji: '👯', colorToken: 'purple',  i18nLabelKey: 'offline.twinRedHanded', i18nDescKey: 'offline.htpEvilTwinsDesc',    i18nInstructionKey: 'offline.roleInstructionTwinRedHanded' },
}

/** Roles grouped by team for the lobby steppers and how-to-play accordion.
 *  Order within each group matches the existing web layout. */
export const VILLAGER_OFFLINE_ROLES: readonly OfflineRole[] = [
  'detective',
  'guardian',
  'mayor',
  'judge',
  'revenant',
] as const

export const RED_HANDED_OFFLINE_ROLES: readonly OfflineRole[] = [
  'doubleAgent',
  'infiltrator',
  'kamikaze',
  'corruptor',
  'inverter',
] as const

export const NEUTRAL_OFFLINE_ROLES: readonly OfflineRole[] = ['jester'] as const

/** A `Pair` slot consumes one player from each side; UI shows it as a single
 *  toggle ("Evil Twins") that becomes the twin_red_handed + twin_villager duo. */
export const PAIR_OFFLINE_ROLES: readonly OfflineRole[] = ['twinRedHanded', 'twinVillager'] as const
