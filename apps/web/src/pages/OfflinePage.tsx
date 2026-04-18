import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { WORD_CATEGORIES, shuffleArray, OFFLINE_WORD_PAIRS, pickRandomWordPair } from '@red-handed/shared'
import type { WordCategory } from '@red-handed/shared'
import { SoundManager } from '../lib/sounds'
import { HapticManager } from '../lib/haptics'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'dealing' | 'playing' | 'results'
type GameMode = 'normal' | 'special'

// All role types available in offline pass-and-play. Mechanics with special
// runtime requirements (kamikaze drag-down, corruptor silent drop, inverter
// vote flip, revenant post-death votes, evil twins paired win) are documented
// on the role card and resolved manually by the players.
type PlayerRoleType =
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

interface PlayerRole {
  name: string
  role: PlayerRoleType
  word: string
  isEliminated: boolean
  /** Set to true when a Jester wins by being voted out. */
  jesterWon?: boolean
  /** For Evil Twins: the name of their twin partner. */
  twinPartner?: string
}

interface VoteRecord {
  voterName: string
  targetName: string
}

interface SpecialRoleCounts {
  detective: number
  doubleAgent: number
  guardian: number
  mayor: number
  judge: number
  revenant: number
  infiltrator: number
  jester: number
  kamikaze: number
  corruptor: number
  inverter: number
  evilTwins: number // 0 or 1: enables the paired twin_villager + twin_red_handed duo
}

interface GameSettings {
  names: string[]
  redHandedCount: number
  detectiveCount: number
  doubleAgentCount: number
  guardianCount: number
  mayorCount: number
  judgeCount: number
  revenantCount: number
  infiltratorCount: number
  jesterCount: number
  kamikazeCount: number
  corruptorCount: number
  inverterCount: number
  evilTwinsCount: number
  categories: WordCategory[]
  gameMode: GameMode
}

// ─── Role helpers ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRoleConfig(t: any): Record<PlayerRoleType, { label: string; icon: string; color: string; bgClass: string; borderClass: string; textClass: string; badgeClass: string }> {
  return {
    villager:     { label: t('offline.villager'),                         icon: '🟢', color: 'emerald', bgClass: 'bg-emerald-950/70', borderClass: 'border-emerald-700/60', textClass: 'text-emerald-400', badgeClass: 'text-emerald-500' },
    red_handed:   { label: t('offline.redHanded'),                         icon: '🔴', color: 'red',     bgClass: 'bg-red-950/70',     borderClass: 'border-red-700/60',     textClass: 'text-red-400',     badgeClass: 'text-red-500' },
    detective:    { label: t('offline.detective'),                        icon: '🔍', color: 'blue',    bgClass: 'bg-blue-950/70',    borderClass: 'border-blue-700/60',    textClass: 'text-blue-400',    badgeClass: 'text-blue-500' },
    doubleAgent:  { label: t('offline.doubleAgent'),                      icon: '🕵️', color: 'amber',   bgClass: 'bg-amber-950/70',   borderClass: 'border-amber-700/60',   textClass: 'text-amber-400',   badgeClass: 'text-amber-500' },
    guardian:     { label: t('offline.guardian'),                         icon: '🛡️', color: 'yellow',  bgClass: 'bg-yellow-950/70',  borderClass: 'border-yellow-700/60',  textClass: 'text-yellow-400',  badgeClass: 'text-yellow-500' },
    mayor:        { label: t('offline.mayor',        'Mayor'),            icon: '👑', color: 'indigo',  bgClass: 'bg-indigo-950/70',  borderClass: 'border-indigo-700/60',  textClass: 'text-indigo-400',  badgeClass: 'text-indigo-500' },
    judge:        { label: t('offline.judge',        'Judge'),            icon: '⚖️', color: 'emerald', bgClass: 'bg-emerald-950/70', borderClass: 'border-emerald-700/60', textClass: 'text-emerald-300', badgeClass: 'text-emerald-500' },
    revenant:     { label: t('offline.revenant',     'Revenant'),         icon: '👻', color: 'teal',    bgClass: 'bg-teal-950/70',    borderClass: 'border-teal-700/60',    textClass: 'text-teal-300',    badgeClass: 'text-teal-500' },
    infiltrator:  { label: t('offline.infiltrator',  'Infiltrator'),      icon: '🥷', color: 'fuchsia', bgClass: 'bg-fuchsia-950/70', borderClass: 'border-fuchsia-700/60', textClass: 'text-fuchsia-400', badgeClass: 'text-fuchsia-500' },
    jester:       { label: t('offline.jester',       'Jester'),           icon: '🃏', color: 'pink',    bgClass: 'bg-pink-950/70',    borderClass: 'border-pink-700/60',    textClass: 'text-pink-400',    badgeClass: 'text-pink-500' },
    kamikaze:     { label: t('offline.kamikaze',     'Kamikaze'),         icon: '💥', color: 'red',     bgClass: 'bg-red-950/70',     borderClass: 'border-red-700/60',     textClass: 'text-red-300',     badgeClass: 'text-red-500' },
    corruptor:    { label: t('offline.corruptor',    'Corruptor'),        icon: '🕷️', color: 'orange',  bgClass: 'bg-orange-950/70',  borderClass: 'border-orange-700/60',  textClass: 'text-orange-300', badgeClass: 'text-orange-500' },
    inverter:     { label: t('offline.inverter',     'Inverter'),         icon: '🔄', color: 'rose',    bgClass: 'bg-rose-950/70',    borderClass: 'border-rose-700/60',    textClass: 'text-rose-300',    badgeClass: 'text-rose-500' },
    twinVillager: { label: t('offline.twinVillager', 'Villager Twin'),    icon: '👯', color: 'purple',  bgClass: 'bg-purple-950/70',  borderClass: 'border-purple-700/60',  textClass: 'text-purple-300', badgeClass: 'text-purple-500' },
    twinRedHanded: { label: t('offline.twinRedHanded', 'Imposter Twin'),    icon: '👯', color: 'purple',  bgClass: 'bg-purple-950/70',  borderClass: 'border-purple-700/60',  textClass: 'text-purple-300', badgeClass: 'text-purple-500' },
  }
}

// RedHanded-side roles play for the redHanded team (know the redHanded word).
const EVIL_ROLES: PlayerRoleType[] = [
  'red_handed', 'doubleAgent', 'infiltrator', 'kamikaze', 'corruptor', 'inverter', 'twinRedHanded',
]

/** Number of post-death vote rounds for the Revenant. */
const REVENANT_POST_DEATH_ROUNDS = 2

function isEvilRole(role: PlayerRoleType) {
  return EVIL_ROLES.includes(role)
}

/**
 * On the reveal card, clarify which base team a *special* role plays for —
 * e.g. a Mayor is still a Villager, a Corruptor is still an RedHanded. Returns
 * `null` for roles where this would be redundant (villager/redHanded) or
 * misleading (jester is solo, twins win as a pair).
 */
function getBaseTeamForReveal(role: PlayerRoleType): 'villager' | 'red_handed' | null {
  switch (role) {
    case 'detective':
    case 'guardian':
    case 'mayor':
    case 'judge':
    case 'revenant':
      return 'villager'
    case 'doubleAgent':
    case 'infiltrator':
    case 'kamikaze':
    case 'corruptor':
    case 'inverter':
      return 'red_handed'
    default:
      return null
  }
}

const LANGUAGES = [
  { code: 'en', label: 'English', flag: 'gb' },
  { code: 'fr', label: 'Français', flag: 'fr' },
  { code: 'ar', label: 'العربية', flag: 'sa' },
  { code: 'es', label: 'Español', flag: 'es' },
  { code: 'it', label: 'Italiano', flag: 'it' },
  { code: 'pt', label: 'Português', flag: 'br' },
  { code: 'zh', label: '中文', flag: 'cn' },
  { code: 'de', label: 'Deutsch', flag: 'de' },
  { code: 'ru', label: 'Русский', flag: 'ru' },
  { code: 'hi', label: 'हिन्दी', flag: 'in' },
]

// ─── Sub-component: Role stepper (used in setup phase) ──────────────────────

interface RoleStepperProps {
  icon: string
  label: string
  description: string
  value: number
  max: number
  onChange: (v: number) => void
  accent: 'emerald' | 'red' | 'sky' | 'purple'
  lockedReason?: string | null
}

function RoleStepper({ icon, label, description, value, max, onChange, accent, lockedReason }: RoleStepperProps) {
  const isLocked = !!lockedReason
  const canDec = !isLocked && value > 0
  const canInc = !isLocked && value < max
  const ACCENT = {
    emerald: 'border-emerald-700/40 bg-emerald-950/40 text-emerald-300',
    red:     'border-red-700/40 bg-red-950/40 text-red-300',
    sky:     'border-sky-700/40 bg-sky-950/40 text-sky-300',
    purple:  'border-purple-700/40 bg-purple-950/40 text-purple-300',
  } as const
  return (
    <div
      title={isLocked ? lockedReason! : description}
      className={[
        'flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-colors',
        isLocked
          ? 'bg-neutral-900/40 border-neutral-800/60 opacity-50'
          : 'bg-neutral-900/50 border-neutral-800/60 hover:border-neutral-700',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={['inline-flex items-center justify-center w-8 h-8 rounded-lg border text-base shrink-0', ACCENT[accent]].join(' ')}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{label}</p>
          <p className="text-[10px] text-neutral-500 leading-tight line-clamp-2">
            {isLocked ? lockedReason : description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => { if (canDec) onChange(value - 1) }}
          disabled={!canDec}
          className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >−</button>
        <span className={`text-base font-mono font-bold w-7 text-center ${isLocked ? 'text-neutral-600' : 'text-white'}`}>
          {value}
        </span>
        <button
          type="button"
          onClick={() => { if (canInc) onChange(value + 1) }}
          disabled={!canInc}
          className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >+</button>
      </div>
    </div>
  )
}

// ─── Sub-component: Setup Phase ──────────────────────────────────────────────

interface SetupPhaseProps {
  initialSettings: GameSettings | null
  onStart: (
    names: string[],
    redHandedCount: number,
    counts: SpecialRoleCounts,
    categories: WordCategory[],
    gameMode: GameMode,
  ) => void
}

function SetupPhase({ initialSettings, onStart }: SetupPhaseProps) {
  const { t, i18n } = useTranslation()
  const [names, setNames] = useState<string[]>(initialSettings?.names ?? ['', '', ''])
  const [redHandedCount, setRedHandedCount] = useState(initialSettings?.redHandedCount ?? 1)
  const [detectiveCount, setDetectiveCount] = useState(initialSettings?.detectiveCount ?? 1)
  const [doubleAgentCount, setDoubleAgentCount] = useState(initialSettings?.doubleAgentCount ?? 0)
  const [guardianCount, setGuardianCount] = useState(initialSettings?.guardianCount ?? 0)
  const [mayorCount, setMayorCount] = useState(initialSettings?.mayorCount ?? 0)
  const [judgeCount, setJudgeCount] = useState(initialSettings?.judgeCount ?? 0)
  const [revenantCount, setRevenantCount] = useState(initialSettings?.revenantCount ?? 0)
  const [infiltratorCount, setInfiltratorCount] = useState(initialSettings?.infiltratorCount ?? 0)
  const [jesterCount, setJesterCount] = useState(initialSettings?.jesterCount ?? 0)
  const [kamikazeCount, setKamikazeCount] = useState(initialSettings?.kamikazeCount ?? 0)
  const [corruptorCount, setCorruptorCount] = useState(initialSettings?.corruptorCount ?? 0)
  const [inverterCount, setInverterCount] = useState(initialSettings?.inverterCount ?? 0)
  const [evilTwinsCount, setEvilTwinsCount] = useState(initialSettings?.evilTwinsCount ?? 0)
  const [categories, setCategories] = useState<WordCategory[]>(initialSettings?.categories ?? [])
  const [gameMode, setGameMode] = useState<GameMode>(initialSettings?.gameMode ?? 'normal')

  const filledCount = names.filter((n) => n.trim().length > 0).length
  const minPlayers = gameMode === 'special' ? 5 : 3
  const canStart = filledCount >= minPlayers

  // Auto-add player slots when switching to special mode (minimum 5)
  useEffect(() => {
    if (gameMode === 'special' && names.length < 5) {
      setNames((prev) => [...prev, ...Array(5 - prev.length).fill('')])
    }
  }, [gameMode])

  // Cap redHanded count to floor(N/3) so redHanded never exceed 1/3 of players.
  // Examples: 3p→1, 4p→1, 5p→1, 6p→2, 9p→3, 12p→4. Always at least 1.
  const maxRedHanded = Math.max(1, Math.floor(filledCount / 3))

  // Auto-adjust redHanded count to stay within the 1/3 rule whenever the
  // player count changes (even when replaying with previous settings).
  useEffect(() => {
    if (redHandedCount > maxRedHanded) {
      setRedHandedCount(maxRedHanded)
    }
  }, [filledCount, maxRedHanded])

  // In special mode, special evil roles must fit within redHandedCount.
  // Decrease the special roles whenever they exceed the redHanded budget.
  useEffect(() => {
    const evilExtras =
      doubleAgentCount + infiltratorCount + kamikazeCount +
      corruptorCount + inverterCount + evilTwinsCount
    const excess = Math.max(0, evilExtras - redHandedCount)
    if (excess > 0) {
      // Reduce in reverse priority order: evilTwins → inverter → corruptor →
      // kamikaze → infiltrator → doubleAgent (preserve the baseline redHanded).
      let remaining = excess
      const reducers: [number, (n: number) => void][] = [
        [evilTwinsCount,   setEvilTwinsCount],
        [inverterCount,    setInverterCount],
        [corruptorCount,   setCorruptorCount],
        [kamikazeCount,    setKamikazeCount],
        [infiltratorCount, setInfiltratorCount],
        [doubleAgentCount, setDoubleAgentCount],
      ]
      for (const [current, setter] of reducers) {
        if (remaining <= 0) break
        const reduceBy = Math.min(current, remaining)
        if (reduceBy > 0) {
          setter(current - reduceBy)
          remaining -= reduceBy
        }
      }
    }
  }, [
    filledCount, redHandedCount, doubleAgentCount, infiltratorCount,
    kamikazeCount, corruptorCount, inverterCount, evilTwinsCount,
  ])

  // Auto-adjust double agent availability based on player count
  useEffect(() => {
    if (initialSettings) return
    if (filledCount >= 6 && doubleAgentCount === 0 && gameMode === 'special') {
      setDoubleAgentCount(1)
    } else if (filledCount < 6 && doubleAgentCount > 0) {
      setDoubleAgentCount(0)
    }
  }, [filledCount, gameMode])

  const addPlayer = () => {
    if (names.length < 20) setNames((prev) => [...prev, ''])
  }

  const removePlayer = (i: number) => {
    if (names.length <= 3) return
    setNames((prev) => prev.filter((_, idx) => idx !== i))
  }

  const updateName = (i: number, val: string) => {
    setNames((prev) => prev.map((n, idx) => (idx === i ? val : n)))
  }

  const toggleCategory = (key: WordCategory) => {
    setCategories((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    )
  }

  const handleStart = () => {
    const validNames = names.map((n) => n.trim()).filter((n) => n.length > 0)
    if (validNames.length < 3) return
    const zeroCounts: SpecialRoleCounts = {
      detective: 0, doubleAgent: 0, guardian: 0, mayor: 0, judge: 0,
      revenant: 0, infiltrator: 0, jester: 0, kamikaze: 0, corruptor: 0,
      inverter: 0, evilTwins: 0,
    }
    const specialCounts: SpecialRoleCounts = gameMode === 'special'
      ? {
          detective:   detectiveCount,
          doubleAgent: doubleAgentCount,
          guardian:    guardianCount,
          mayor:       mayorCount,
          judge:       judgeCount,
          revenant:    revenantCount,
          infiltrator: infiltratorCount,
          jester:      jesterCount,
          kamikaze:    kamikazeCount,
          corruptor:   corruptorCount,
          inverter:    inverterCount,
          evilTwins:   evilTwinsCount,
        }
      : zeroCounts
    onStart(validNames, redHandedCount, specialCounts, categories, gameMode)
  }

  // Special evil roles must fit within redHandedCount budget.
  // Evil Twins takes 1 slot on each side (twin_red_handed + twin_villager).
  const evilExtras =
    doubleAgentCount + infiltratorCount + kamikazeCount +
    corruptorCount + inverterCount + evilTwinsCount
  const evilHeadroom = Math.max(0, redHandedCount - evilExtras)

  const maxDoubleAgents = Math.min(2, doubleAgentCount + evilHeadroom)
  const maxInfiltrators = Math.min(2, infiltratorCount + evilHeadroom)
  const maxKamikaze     = Math.min(2, kamikazeCount    + evilHeadroom)
  const maxCorruptor    = Math.min(1, corruptorCount   + evilHeadroom)
  const maxInverter     = Math.min(1, inverterCount    + evilHeadroom)

  // Villager-side special slots. evilTwins adds 1 villager-side slot (twinVillager).
  const currentGoodSpecial =
    detectiveCount + guardianCount + mayorCount + judgeCount + revenantCount
  const slotsUsed = redHandedCount + currentGoodSpecial + evilTwinsCount // +twinVillager
  const goodHeadroom = Math.max(0, filledCount - slotsUsed)

  const maxDetectives = Math.min(3, detectiveCount + goodHeadroom)
  const maxGuardians  = Math.min(2, guardianCount  + goodHeadroom)
  const maxMayor      = Math.min(1, mayorCount     + goodHeadroom)
  const maxJudge      = Math.min(1, judgeCount     + goodHeadroom)
  const maxRevenant   = Math.min(1, revenantCount  + goodHeadroom)

  // Neutral roles (jester) only unlock with ≥ 10 players.
  const neutralUnlocked = filledCount >= 10
  const maxJester = neutralUnlocked ? Math.min(1, jesterCount + goodHeadroom) : 0

  // Evil Twins (pair): consumes 1 slot on each side.
  const maxEvilTwins = Math.min(1, evilTwinsCount + Math.min(evilHeadroom, goodHeadroom))

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Language selector */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
          {t('offline.language')}
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                i18n.changeLanguage(lang.code)
                document.documentElement.dir = lang.code === 'ar' ? 'rtl' : 'ltr'
              }}
              className={[
                'flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs font-medium transition-all',
                i18n.language?.startsWith(lang.code)
                  ? 'bg-brand-950/60 border-brand-600/60 text-brand-400 shadow-md shadow-brand-950/30'
                  : 'bg-neutral-800/40 border-neutral-700/40 text-neutral-400 hover:border-neutral-600/60 hover:text-neutral-300',
              ].join(' ')}
            >
              <img
                src={`https://flagcdn.com/24x18/${lang.flag}.png`}
                alt={lang.label}
                className="w-6 h-4 rounded-sm object-cover"
              />
              <span className="truncate w-full text-center text-[10px]">{lang.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="text-center flex flex-col items-center">
        <img
          src="/masks.png"
          alt=""
          aria-hidden="true"
          className="w-20 h-20 md:w-24 md:h-24 object-contain select-none pointer-events-none mb-3"
        />
        <h1 className="text-3xl font-extrabold text-white mb-1">{t('offline.title')}</h1>
        <p className="text-brand-400 font-semibold text-lg">{t('offline.passAndPlay')}</p>
      </div>

      {/* Game mode selector */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          {t('offline.gameMode')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setGameMode('normal')}
            className={[
              'flex flex-col items-center gap-1.5 px-4 py-3.5 rounded-xl border-2 transition-all',
              gameMode === 'normal'
                ? 'bg-brand-950/60 border-brand-600/60 shadow-lg shadow-brand-950/30'
                : 'bg-neutral-800/40 border-neutral-700/40 hover:border-neutral-600/60',
            ].join(' ')}
          >
            <span className="text-2xl">🎲</span>
            <span className={['text-sm font-bold', gameMode === 'normal' ? 'text-brand-400' : 'text-neutral-400'].join(' ')}>
              {t('offline.normal')}
            </span>
            <span className={['text-[10px] leading-tight text-center', gameMode === 'normal' ? 'text-brand-500/70' : 'text-neutral-600'].join(' ')}>
              {t('offline.normalDesc')}
            </span>
          </button>
          <button
            onClick={() => setGameMode('special')}
            className={[
              'flex flex-col items-center gap-1.5 px-4 py-3.5 rounded-xl border-2 transition-all',
              gameMode === 'special'
                ? 'bg-amber-950/60 border-amber-600/60 shadow-lg shadow-amber-950/30'
                : 'bg-neutral-800/40 border-neutral-700/40 hover:border-neutral-600/60',
            ].join(' ')}
          >
            <span className="text-2xl">⚡</span>
            <span className={['text-sm font-bold', gameMode === 'special' ? 'text-amber-400' : 'text-neutral-400'].join(' ')}>
              {t('offline.special')}
            </span>
            <span className={['text-[10px] leading-tight text-center', gameMode === 'special' ? 'text-amber-500/70' : 'text-neutral-600'].join(' ')}>
              {t('offline.specialDesc')}
            </span>
          </button>
        </div>
        {gameMode === 'special' && (
          <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl p-3 space-y-1.5">
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">🔍</span>
              <span className="text-blue-400 font-semibold shrink-0">{t('offline.detective')}</span>
              <span className="text-neutral-500">— {t('offline.htpDetectiveDesc')}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">🕵️</span>
              <span className="text-amber-400 font-semibold shrink-0">{t('offline.doubleAgent')}</span>
              <span className="text-neutral-500">— {t('offline.htpDoubleAgentDesc')}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">🛡️</span>
              <span className="text-yellow-400 font-semibold shrink-0">{t('offline.guardian')}</span>
              <span className="text-neutral-500">— {t('offline.htpGuardianDesc')}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">⚖️</span>
              <span className="text-indigo-400 font-semibold shrink-0">{t('offline.mayor')}</span>
              <span className="text-neutral-500">— {t('offline.htpMayorDesc')}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">🥷</span>
              <span className="text-fuchsia-400 font-semibold shrink-0">{t('offline.infiltrator')}</span>
              <span className="text-neutral-500">— {t('offline.htpInfiltratorDesc')}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">🃏</span>
              <span className="text-pink-400 font-semibold shrink-0">{t('offline.jester')}</span>
              <span className="text-neutral-500">— {t('offline.htpJesterDesc')}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">👨‍⚖️</span>
              <span className="text-emerald-300 font-semibold shrink-0">{t('offline.judge')}</span>
              <span className="text-neutral-500">— {t('offline.htpJudgeDesc')}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">👻</span>
              <span className="text-teal-300 font-semibold shrink-0">{t('offline.revenant')}</span>
              <span className="text-neutral-500">— {t('offline.htpRevenantDesc')}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">💥</span>
              <span className="text-red-300 font-semibold shrink-0">{t('offline.kamikaze')}</span>
              <span className="text-neutral-500">— {t('offline.htpKamikazeDesc')}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">🕷️</span>
              <span className="text-orange-300 font-semibold shrink-0">{t('offline.corruptor')}</span>
              <span className="text-neutral-500">— {t('offline.htpCorruptorDesc')}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">🔄</span>
              <span className="text-rose-300 font-semibold shrink-0">{t('offline.inverter')}</span>
              <span className="text-neutral-500">— {t('offline.htpInverterDesc')}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0">👯</span>
              <span className="text-purple-300 font-semibold shrink-0">{t('offline.evilTwins')}</span>
              <span className="text-neutral-500">— {t('offline.htpEvilTwinsDesc')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Player names */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          {t('offline.players')} ({names.length}/20)
        </p>
        <div className="space-y-2">
          {names.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-neutral-600 text-sm w-5 text-right shrink-0">{i + 1}.</span>
              <input
                className="flex-1 bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600/50 transition-all"
                placeholder={t('offline.playerPlaceholder', { n: i + 1 })}
                value={name}
                onChange={(e) => updateName(i, e.target.value)}
                maxLength={24}
              />
              {names.length > 3 && (
                <button
                  onClick={() => removePlayer(i)}
                  className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-red-900/40 hover:text-red-400 text-neutral-500 flex items-center justify-center transition-colors text-sm font-bold shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {names.length < 20 && (
          <button
            onClick={addPlayer}
            className="w-full py-2 rounded-xl border border-dashed border-neutral-700 text-neutral-500 hover:border-brand-700/50 hover:text-brand-400 text-sm font-semibold transition-all"
          >
            {t('offline.addPlayer')}
          </button>
        )}
      </div>

      {/* RedHanded count */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
          {t('offline.redHandedCount')}
        </p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => {
            const allowed = n <= maxRedHanded
            return (
              <button
                key={n}
                onClick={() => { if (allowed) setRedHandedCount(n) }}
                disabled={!allowed}
                className={[
                  'flex-1 py-3 rounded-xl border font-bold text-lg transition-all',
                  !allowed
                    ? 'bg-neutral-900/40 border-neutral-800/40 text-neutral-700 cursor-not-allowed opacity-40'
                    : redHandedCount === n
                    ? 'bg-red-950/60 border-red-700/60 text-red-400 shadow-md shadow-red-950/30'
                    : 'bg-neutral-800/60 border-neutral-700/40 text-neutral-400 hover:border-neutral-600/60 hover:text-neutral-300',
                ].join(' ')}
              >
                {n}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-neutral-600 mt-2">
          {filledCount >= 6 ? t('offline.recommendHigh') : t('offline.recommendLow')}
        </p>
      </div>

      {/* Special role counts — grouped by team, all roles from the online lobby */}
      {gameMode === 'special' && (
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-5">
          {/* Villager side */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
              🟢 {t('offline.teamVillagers', 'Villagers')}
            </p>
            <RoleStepper
              icon="🔍"
              label={t('offline.detective')}
              description={t('offline.htpDetectiveDesc', 'Once per round, secretly reveals another player\'s role.')}
              value={detectiveCount}
              max={maxDetectives}
              onChange={setDetectiveCount}
              accent="emerald"
            />
            <RoleStepper
              icon="🛡️"
              label={t('offline.guardian')}
              description={t('offline.htpGuardianDesc', 'Protects one player from elimination each round.')}
              value={guardianCount}
              max={maxGuardians}
              onChange={setGuardianCount}
              accent="emerald"
            />
            <RoleStepper
              icon="👑"
              label={t('offline.mayor', 'Mayor')}
              description={t('offline.htpMayorDesc', 'Villager whose vote counts double during the voting phase.')}
              value={mayorCount}
              max={maxMayor}
              onChange={setMayorCount}
              accent="emerald"
            />
            <RoleStepper
              icon="⚖️"
              label={t('offline.judge', 'Judge')}
              description={t('offline.htpJudgeDesc', 'In a tied vote, the Judge decides who gets eliminated — but cannot save themselves.')}
              value={judgeCount}
              max={maxJudge}
              onChange={setJudgeCount}
              accent="emerald"
            />
            <RoleStepper
              icon="👻"
              label={t('offline.revenant', 'Revenant')}
              description={t('offline.htpRevenantDesc', 'After being voted out, secretly casts votes for 2 more rounds.')}
              value={revenantCount}
              max={maxRevenant}
              onChange={setRevenantCount}
              accent="emerald"
            />
          </div>

          {/* RedHanded side */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
              🔴 {t('offline.teamRedHanded', 'Imposter')}
            </p>
            <RoleStepper
              icon="🕵️"
              label={t('offline.doubleAgent')}
              description={t('offline.htpDoubleAgentDesc', 'Knows the imposter word and plays for them, but looks like a villager.')}
              value={doubleAgentCount}
              max={maxDoubleAgents}
              onChange={setDoubleAgentCount}
              accent="red"
            />
            <RoleStepper
              icon="🥷"
              label={t('offline.infiltrator', 'Infiltrator')}
              description={t('offline.htpInfiltratorDesc', 'Knows the villager word but plays for the redHanded. Appears as villager to the detective.')}
              value={infiltratorCount}
              max={maxInfiltrators}
              onChange={setInfiltratorCount}
              accent="red"
            />
            <RoleStepper
              icon="💥"
              label={t('offline.kamikaze', 'Kamikaze')}
              description={t('offline.htpKamikazeDesc', 'If voted out, takes one player of their choice down with them.')}
              value={kamikazeCount}
              max={maxKamikaze}
              onChange={setKamikazeCount}
              accent="red"
            />
            <RoleStepper
              icon="🕷️"
              label={t('offline.corruptor', 'Corruptor')}
              description={t('offline.htpCorruptorDesc', 'Picks one target at game start — their votes are silently dropped until the Corruptor dies.')}
              value={corruptorCount}
              max={maxCorruptor}
              onChange={setCorruptorCount}
              accent="red"
            />
            <RoleStepper
              icon="🔄"
              label={t('offline.inverter', 'Inverter')}
              description={t('offline.htpInverterDesc', 'Once per game, flips the vote tally — the player with the fewest votes is eliminated instead.')}
              value={inverterCount}
              max={maxInverter}
              onChange={setInverterCount}
              accent="red"
            />
          </div>

          {/* Pair */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-purple-400">
              👯 {t('offline.teamPair', 'Pair')}
            </p>
            <RoleStepper
              icon="👯"
              label={t('offline.evilTwins', 'Evil Twins')}
              description={t('offline.htpEvilTwinsDesc', 'A linked pair (one villager, one redHanded) who win together if both survive. Counts as 2 players.')}
              value={evilTwinsCount}
              max={maxEvilTwins}
              onChange={setEvilTwinsCount}
              accent="purple"
            />
          </div>

          {/* Neutral */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">
              ⚪ {t('offline.teamNeutral', 'Neutral')}
            </p>
            <RoleStepper
              icon="🃏"
              label={t('offline.jester', 'Jester')}
              description={t('offline.htpJesterDesc', 'Solo role. Wins alone if voted out by the group.')}
              value={jesterCount}
              max={maxJester}
              onChange={setJesterCount}
              accent="sky"
              lockedReason={neutralUnlocked ? null : t('offline.neutralUnlockHint', 'Unlocks at 10+ players.')}
            />
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
            {t('offline.wordCategories')}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setCategories(WORD_CATEGORIES.map((c) => c.key as WordCategory))}
              className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors"
            >
              {t('offline.all')}
            </button>
            <span className="text-neutral-700">·</span>
            <button
              onClick={() => setCategories([])}
              className="text-[11px] text-neutral-500 hover:text-neutral-400 transition-colors"
            >
              {t('offline.random')}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {WORD_CATEGORIES.map((cat) => {
            const selected = categories.includes(cat.key as WordCategory)
            const isAll = categories.length === 0
            return (
              <button
                key={cat.key}
                onClick={() => toggleCategory(cat.key as WordCategory)}
                className={[
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  selected
                    ? 'bg-brand-950/60 border-brand-700/50 text-brand-300 ring-1 ring-brand-700/20'
                    : isAll
                      ? 'bg-neutral-800/40 border-neutral-700/30 text-neutral-400 hover:border-neutral-600/50'
                      : 'bg-neutral-900/40 border-neutral-800/40 text-neutral-600 hover:border-neutral-700/50',
              ].join(' ')}
              >
                <span>{cat.icon}</span>
                <span className="truncate">{t(`home.cat.${cat.key}`, cat.label)}</span>
              </button>
            )
          })}
        </div>
        {categories.length === 0 && (
          <p className="text-[10px] text-neutral-600">{t('offline.randomHint')}</p>
        )}
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!canStart}
        className="w-full py-4 rounded-2xl font-bold text-lg text-white bg-brand-600 hover:bg-brand-500 shadow-2xl shadow-brand-600/25 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-600"
      >
        {t('offline.startGame')}
      </button>

      {!canStart && (
        <p className="text-center text-neutral-600 text-xs">
          {gameMode === 'special' ? t('offline.needPlayersSpecial') : t('offline.needPlayers')}
        </p>
      )}

      {/* How to play */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          {t('offline.howToPlay')}
        </p>

        {/* How it works — shown first so players understand the flow before reading roles */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-neutral-300">{t('offline.htpHowItWorks')}</p>
          <ol className="space-y-1 ml-1 list-decimal list-inside text-xs text-neutral-500 leading-relaxed">
            <li>{t('offline.htpStep1')}</li>
            <li>{t('offline.htpStep2')}</li>
            <li>{t('offline.htpStep3')}</li>
            <li>{t('offline.htpStep4')}</li>
          </ol>
        </div>

        <div className="border-t border-neutral-800/60" />

        {/* Normal mode */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎲</span>
            <span className="text-sm font-bold text-brand-400">{t('offline.normal')}</span>
            <span className="text-[10px] text-neutral-600 px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700/40">{t('offline.htpMinPlayers', { count: 3 })}</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">{t('offline.htpNormalDesc')}</p>
          <div className="space-y-1 ml-1">
            <div className="flex items-center gap-2 text-xs">
              <span>🟢</span>
              <span className="text-emerald-400 font-semibold">{t('offline.villager')}</span>
              <span className="text-neutral-500">— {t('offline.htpVillagerDesc')}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span>🔴</span>
              <span className="text-red-400 font-semibold">{t('offline.redHanded')}</span>
              <span className="text-neutral-500">— {t('offline.htpRedHandedDesc')}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-800/60" />

        {/* Special mode — grouped by team */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <span className="text-sm font-bold text-amber-400">{t('offline.special')}</span>
            <span className="text-[10px] text-neutral-600 px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700/40">{t('offline.htpMinPlayers', { count: 5 })}</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">{t('offline.htpSpecialDesc')}</p>

          {/* 🟢 Villagers */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
              🟢 {t('offline.teamVillagers', 'Villagers')}
            </p>
            <div className="ml-1 space-y-1">
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">🔍</span>
                <span className="text-blue-400 font-semibold shrink-0">{t('offline.detective')}</span>
                <span className="text-neutral-500">— {t('offline.htpDetectiveDesc')}</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">🛡️</span>
                <span className="text-yellow-400 font-semibold shrink-0">{t('offline.guardian')}</span>
                <span className="text-neutral-500">— {t('offline.htpGuardianDesc')}</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">👑</span>
                <span className="text-indigo-400 font-semibold shrink-0">{t('offline.mayor', 'Mayor')}</span>
                <span className="text-neutral-500">— {t('offline.htpMayorDesc', 'Villager whose vote counts double once per game.')}</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">⚖️</span>
                <span className="text-emerald-300 font-semibold shrink-0">{t('offline.judge', 'Judge')}</span>
                <span className="text-neutral-500">— {t('offline.htpJudgeDesc', 'In a tied vote, the Judge decides who gets eliminated — but cannot save themselves.')}</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">👻</span>
                <span className="text-teal-300 font-semibold shrink-0">{t('offline.revenant', 'Revenant')}</span>
                <span className="text-neutral-500">— {t('offline.htpRevenantDesc', 'After dying, the Revenant secretly casts votes for 2 more rounds.')}</span>
              </div>
            </div>
          </div>

          {/* 🔴 RedHanded */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
              🔴 {t('offline.teamRedHanded', 'Imposter')}
            </p>
            <div className="ml-1 space-y-1">
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">🕵️</span>
                <span className="text-amber-400 font-semibold shrink-0">{t('offline.doubleAgent')}</span>
                <span className="text-neutral-500">— {t('offline.htpDoubleAgentDesc')}</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">🥷</span>
                <span className="text-fuchsia-400 font-semibold shrink-0">{t('offline.infiltrator', 'Infiltrator')}</span>
                <span className="text-neutral-500">— {t('offline.htpInfiltratorDesc', 'Knows the villager word, but plays for the imposters. Appears as villager to the detective.')}</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">💥</span>
                <span className="text-red-300 font-semibold shrink-0">{t('offline.kamikaze', 'Kamikaze')}</span>
                <span className="text-neutral-500">— {t('offline.htpKamikazeDesc', 'If voted out, takes one player of their choice down with them — even a guardian-protected one.')}</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">🕷️</span>
                <span className="text-orange-300 font-semibold shrink-0">{t('offline.corruptor', 'Corruptor')}</span>
                <span className="text-neutral-500">— {t('offline.htpCorruptorDesc', 'Picks one target at game start — their votes are silently dropped until the Corruptor dies.')}</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">🔄</span>
                <span className="text-rose-300 font-semibold shrink-0">{t('offline.inverter', 'Inverter')}</span>
                <span className="text-neutral-500">— {t('offline.htpInverterDesc', 'Once per game, flips the vote tally — the player with the fewest votes is eliminated instead.')}</span>
              </div>
            </div>
          </div>

          {/* 👯 Pair */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-purple-400">
              👯 {t('offline.teamPair', 'Pair')}
            </p>
            <div className="ml-1 space-y-1">
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">👯</span>
                <span className="text-purple-300 font-semibold shrink-0">{t('offline.evilTwins', 'Evil Twins')}</span>
                <span className="text-neutral-500">— {t('offline.htpEvilTwinsDesc', 'A linked pair (one villager, one imposter) who win together if both survive — but lose individually if separated.')}</span>
              </div>
            </div>
          </div>

          {/* ⚪ Neutral */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">
              ⚪ {t('offline.teamNeutral', 'Neutral')}
            </p>
            <div className="ml-1 space-y-1">
              <div className="flex items-start gap-2 text-xs">
                <span className="shrink-0">🃏</span>
                <span className="text-pink-400 font-semibold shrink-0">{t('offline.jester', 'Jester')}</span>
                <span className="text-neutral-500">— {t('offline.htpJesterDesc', 'Solo role. Wins alone if voted out by the group.')}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Sub-component: Dealing Phase ────────────────────────────────────────────

interface DealingPhaseProps {
  players: PlayerRole[]
  gameMode: GameMode
  wordPair: { villagerWord: string; redHandedWord: string }
  onDone: () => void
}

function DealingPhase({ players, gameMode, wordPair, onDone }: DealingPhaseProps) {
  const { t } = useTranslation()
  const ROLES = getRoleConfig(t)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showingCard, setShowingCard] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const current = players[currentIndex]
  const rc = ROLES[current.role]

  const handleReady = () => {
    setShowingCard(true)
    // Play the reveal stinger and a success haptic as the card flips in —
    // this is the single biggest "ooh" moment of offline pass-and-play,
    // so we lean on sound + vibration + the stamp-in keyframe together.
    SoundManager.play('reveal')
    HapticManager.success()
    setTimeout(() => setRevealed(true), 50)
  }

  const handleGotIt = () => {
    SoundManager.play('click')
    HapticManager.light()
    setShowingCard(false)
    setRevealed(false)
    const next = currentIndex + 1
    if (next >= players.length) {
      onDone()
    } else {
      setCurrentIndex(next)
    }
  }

  const getRoleInstruction = (role: PlayerRoleType) => {
    switch (role) {
      case 'red_handed':     return t('offline.roleInstructionRedHanded')
      case 'villager':     return t('offline.roleInstructionVillager')
      case 'detective':    return t('offline.roleInstructionDetective')
      case 'doubleAgent':  return t('offline.roleInstructionDoubleAgent')
      case 'guardian':     return t('offline.roleInstructionGuardian')
      case 'mayor':        return t('offline.roleInstructionMayor',        'You are the Mayor. Your vote counts double during the voting phase.')
      case 'judge':        return t('offline.roleInstructionJudge',        'You are the Judge. If a vote ends in a tie, you pick who gets eliminated.')
      case 'revenant':     return t('offline.roleInstructionRevenant',     'You are the Revenant. If you get voted out, you still cast votes for the next 2 rounds (announce a player when eliminated).')
      case 'infiltrator':  return t('offline.roleInstructionInfiltrator',  'You are the Infiltrator. You know the VILLAGER word but you play for the redHanded. Blend in and help them win — you look like a villager to the Detective.')
      case 'jester':       return t('offline.roleInstructionJester',       'You are the Jester. You win alone if the group votes you out. Act suspicious without being too obvious.')
      case 'kamikaze':     return t('offline.roleInstructionKamikaze',     'You are a Kamikaze redHanded. If you get voted out, pick one player to take down with you — they are eliminated too.')
      case 'corruptor':    return t('offline.roleInstructionCorruptor',    'You are the Corruptor. At game start, secretly pick one target — their votes don\'t count until you are eliminated.')
      case 'inverter':     return t('offline.roleInstructionInverter',     'You are the Inverter. Once per game, before a vote is tallied, call "Invert!" — the player with the FEWEST votes is eliminated instead.')
      case 'twinVillager': return t('offline.roleInstructionTwinVillager', 'You are the Villager Twin. You and the RedHanded Twin win together if both survive — work with your twin without getting caught.')
      case 'twinRedHanded': return t('offline.roleInstructionTwinRedHanded', 'You are the RedHanded Twin. You and the Villager Twin win together if both survive — protect your twin.')
    }
  }

  // Determine card color classes
  const cardBg = rc.bgClass
  const cardBorder = rc.borderClass
  const cardShadow = `shadow-${rc.color}-950/40`
  const wordBg = `bg-${rc.color}-900/30`
  const wordBorder = `border-${rc.color}-800/40`
  const wordLabelColor = `text-${rc.color}-600`
  const wordValueColor = `text-${rc.color}-300`
  const wordGlow = rc.color === 'emerald' ? 'drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]'
    : rc.color === 'red' ? 'drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]'
    : rc.color === 'blue' ? 'drop-shadow-[0_0_12px_rgba(96,165,250,0.5)]'
    : rc.color === 'yellow' ? 'drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]'
    : 'drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]'
  const btnBg = rc.color === 'emerald' ? 'bg-emerald-700 hover:bg-emerald-600'
    : rc.color === 'red' ? 'bg-red-700 hover:bg-red-600'
    : rc.color === 'blue' ? 'bg-blue-700 hover:bg-blue-600'
    : rc.color === 'yellow' ? 'bg-yellow-700 hover:bg-yellow-600'
    : 'bg-amber-700 hover:bg-amber-600'
  const btnShadow = `shadow-${rc.color}-950/40`
  const instructionColor = `text-${rc.color}-600/70`

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-slide-up">
      {/* Progress dots */}
      <div className="flex gap-1.5">
        {players.map((_, i) => (
          <div
            key={i}
            className={[
              'w-2 h-2 rounded-full transition-all',
              i < currentIndex
                ? 'bg-brand-500'
                : i === currentIndex
                  ? 'bg-brand-400 scale-125'
                  : 'bg-neutral-700',
            ].join(' ')}
          />
        ))}
      </div>

      {!showingCard ? (
        <div className="text-center space-y-6 px-4">
          <div className="text-6xl">📱</div>
          <div>
            <p className="text-neutral-400 text-lg mb-2">{t('offline.passDevice')}</p>
            <p className="text-3xl font-extrabold text-brand-400">{current.name}</p>
          </div>
          <p className="text-neutral-600 text-sm">
            {t('offline.playerOf', { current: currentIndex + 1, total: players.length })}
          </p>
          <button
            onClick={handleReady}
            className="px-10 py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-lg transition-all active:scale-[0.97] shadow-xl shadow-brand-600/20"
          >
            {t('offline.imReady')}
          </button>
        </div>
      ) : (
        <div
          className={[
            'w-full max-w-sm mx-auto',
            revealed ? 'opacity-100 animate-flip-in' : 'opacity-0 scale-75',
          ].join(' ')}
        >
          <div className={`relative rounded-3xl border-2 p-8 text-center space-y-6 shadow-2xl ${cardBg} ${cardBorder} ${cardShadow} animate-glow-pulse`}>
            {/* Soft rotating accent ring — AAA card-reveal shimmer */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl overflow-hidden">
              <div className="absolute -inset-1/2 opacity-20 bg-gradient-conic from-transparent via-white/10 to-transparent animate-ray-spin" />
            </div>

            <div className="text-6xl animate-pop-in">{rc.icon}</div>

            <div>
              <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${rc.badgeClass}`}>
                {t('offline.yourRole')}
              </p>
              <p className={`text-2xl font-extrabold ${rc.textClass} animate-stamp-in`}>
                {rc.label}
              </p>
              {(() => {
                const baseTeam = getBaseTeamForReveal(current.role)
                if (!baseTeam) return null
                const teamClass = baseTeam === 'villager' ? 'text-emerald-400' : 'text-red-400'
                const teamIcon = baseTeam === 'villager' ? '🟢' : '🔴'
                return (
                  <p className={`mt-1 text-sm font-semibold ${teamClass}`}>
                    {teamIcon} {t(`offline.${baseTeam}`)}
                  </p>
                )
              })()}
            </div>

            {current.role === 'doubleAgent' ? (
              <div className="space-y-3">
                <div className={`px-6 py-3 rounded-2xl border bg-emerald-900/30 border-emerald-800/40`}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-emerald-600">
                    {t('offline.villagerWord')}
                  </p>
                  <p className="text-2xl font-black tracking-tight text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]">
                    {wordPair.villagerWord}
                  </p>
                </div>
                <div className={`px-6 py-3 rounded-2xl border bg-red-900/30 border-red-800/40`}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-red-600">
                    {t('offline.redHandedWord')}
                  </p>
                  <p className="text-2xl font-black tracking-tight text-red-300 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
                    {wordPair.redHandedWord}
                  </p>
                </div>
              </div>
            ) : (
              <div className={`px-6 py-4 rounded-2xl border ${wordBg} ${wordBorder}`}>
                <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${wordLabelColor}`}>
                  {t('offline.yourWord')}
                </p>
                <p className={`text-3xl font-black tracking-tight ${wordValueColor} ${wordGlow}`}>
                  {current.word}
                </p>
              </div>
            )}

            {current.role === 'detective' && (
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl px-4 py-2.5 text-xs text-blue-400/80 font-medium">
                {t('offline.detectiveTip')}
              </div>
            )}

            {current.role === 'doubleAgent' && (
              <div className="bg-amber-900/20 border border-amber-800/30 rounded-xl px-4 py-2.5 text-xs text-amber-400/80 font-medium">
                {t('offline.doubleAgentTip')}
              </div>
            )}

            {current.role === 'guardian' && (
              <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-xl px-4 py-2.5 text-xs text-yellow-400/80 font-medium">
                {t('offline.guardianTip')}
              </div>
            )}

            {(current.role === 'twinRedHanded' || current.role === 'twinVillager') && current.twinPartner && (
              <div className="flex items-center gap-2 bg-purple-950/40 border border-purple-800/40 rounded-xl px-4 py-2.5 text-sm font-semibold text-purple-300">
                <span>👯</span>
                <span>{t('game.twinPartnerBanner', { name: current.twinPartner, defaultValue: 'Your twin: {{name}}' })}</span>
              </div>
            )}

            <p className={`text-xs leading-relaxed ${instructionColor}`}>
              {getRoleInstruction(current.role)}
            </p>

            <button
              onClick={handleGotIt}
              className={`w-full py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.97] ${btnBg} text-white shadow-lg ${btnShadow}`}
            >
              {currentIndex < players.length - 1 ? t('offline.gotItPass') : t('offline.gotItStart')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-component: Speaking Timer ───────────────────────────────────────────

interface SpeakingTimerProps {
  defaultSeconds?: number
}

function SpeakingTimer({ defaultSeconds = 30 }: SpeakingTimerProps) {
  const { t } = useTranslation()
  const [totalSeconds, setTotalSeconds] = useState(defaultSeconds)
  const [remaining, setRemaining] = useState(defaultSeconds)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pct = remaining / totalSeconds
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - pct)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            // Time-up: warning pulse + long haptic
            SoundManager.play('timer_warning')
            HapticManager.warning()
            return 0
          }
          // Last-5-second countdown gets a clicky tick + soft vibration
          // so players get a "crunch time" feel without needing to look.
          if (r <= 6) {
            SoundManager.play('timer_tick')
            HapticManager.selection()
          }
          return r - 1
        })
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  const handleReset = () => {
    setRunning(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRemaining(totalSeconds)
  }

  const colorClass = pct > 0.5 ? 'stroke-brand-500' : pct > 0.25 ? 'stroke-amber-500' : 'stroke-red-500'
  const isUrgent = running && remaining > 0 && remaining <= 5
  const isExpired = remaining === 0 && totalSeconds > 0

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">{t('offline.speakingTimer')}</p>

      <div className="flex items-center gap-4">
        <div
          className={[
            'relative w-24 h-24 shrink-0 rounded-full',
            isUrgent ? 'animate-urgent-pulse' : running ? 'animate-breathe' : '',
            isExpired ? 'animate-shake' : '',
          ].join(' ')}
        >
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-neutral-800"
            />
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`transition-all duration-1000 ${colorClass}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-extrabold text-white tabular-nums">{remaining}</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex gap-1.5">
            {[15, 30, 45, 60].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setTotalSeconds(s)
                  setRemaining(s)
                  setRunning(false)
                  if (intervalRef.current) clearInterval(intervalRef.current)
                }}
                className={[
                  'flex-1 py-1 rounded-lg text-xs font-bold transition-all border',
                  totalSeconds === s
                    ? 'bg-brand-950/60 border-brand-700/50 text-brand-400'
                    : 'bg-neutral-800/60 border-neutral-700/40 text-neutral-500 hover:text-neutral-300',
                ].join(' ')}
              >
                {s}s
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setRunning((r) => !r)}
              disabled={remaining === 0}
              className={[
                'flex-1 py-2 rounded-xl font-bold text-sm transition-all border disabled:opacity-40',
                running
                  ? 'bg-amber-900/40 border-amber-700/40 text-amber-400 hover:bg-amber-900/60'
                  : 'bg-brand-600 hover:bg-brand-500 border-transparent text-white',
              ].join(' ')}
            >
              {running ? `⏸ ${t('offline.pause')}` : remaining === totalSeconds ? `▶ ${t('offline.start')}` : `▶ ${t('offline.resume')}`}
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/60 text-neutral-400 hover:text-white text-sm font-bold transition-all"
            >
              ↺
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-component: Vote Phase (pass-and-play voting) ─────────────────────────

interface VotePhaseProps {
  allVoters: PlayerRole[]
  alivePlayers: PlayerRole[]
  detectiveUsedSet: Set<string>
  revealedRoles: Record<string, PlayerRoleType>
  protectedPlayers: Set<string>
  mayorDoubleVoteUsedSet: Set<string>
  inverterUsedSet: Set<string>
  inverterActiveThisRound: boolean
  corruptorTargets: Record<string, string>
  ghostVoterNames: Set<string>
  revenantGhostRounds: Record<string, number>
  onDetectiveReveal: (detectiveName: string, targetName: string, targetRole: PlayerRoleType) => void
  onGuardianProtect: (guardianName: string, targetName: string) => void
  onMayorDoubleVote: (mayorName: string) => void
  onInverterActivate: () => void
  onCorruptorPick: (corruptorName: string, targetName: string) => void
  onVotesDone: (votes: VoteRecord[], eliminated: PlayerRole | null, extras?: VoteExtras) => void
}

type VoteStep = 'pass' | 'voting'

// ─── Sub-component: Judge Tie-Break (pass-and-play) ──────────────────────────

interface JudgeTieBreakPhaseProps {
  judge: PlayerRole
  candidates: string[]
  onDecide: (targetName: string) => void
}

function JudgeTieBreakPhase({ judge, candidates, onDecide }: JudgeTieBreakPhaseProps) {
  const { t } = useTranslation()
  const [ready, setReady] = useState(false)

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="text-center">
        <h2 className="text-xl font-extrabold text-white">⚖️ {t('game.judgePickTitle')}</h2>
      </div>

      {!ready ? (
        <div className="text-center space-y-5 py-6">
          <div className="text-5xl">📱</div>
          <div>
            <p className="text-neutral-400 text-base mb-2">{t('offline.passDevice')}</p>
            <p className="text-2xl font-extrabold text-emerald-300">{judge.name}</p>
          </div>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto">{t('game.judgePickDesc')}</p>
          <button
            onClick={() => setReady(true)}
            className="px-8 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold transition-all active:scale-[0.97]"
          >
            {t('offline.imReadyToVote')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-neutral-500 text-center">{t('game.judgePickDesc')}</p>
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
            {candidates.map((name) => (
              <button
                key={name}
                onClick={() => onDecide(name)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-800/60 hover:bg-emerald-900/30 border border-neutral-700/40 hover:border-emerald-700/50 transition-all active:scale-[0.98]"
              >
                <span className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-base shrink-0">
                  {name[0].toUpperCase()}
                </span>
                <span className="text-white text-sm font-semibold flex-1 min-w-0 truncate text-left">
                  {name}
                </span>
                <span className="text-emerald-400 text-xs font-bold">⚖️ →</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-component: Kamikaze Drag-Down (pass-and-play) ───────────────────────

interface KamikazeDragPhaseProps {
  kamikaze: PlayerRole
  targets: PlayerRole[]
  onDragDown: (victimName: string) => void
}

function KamikazeDragPhase({ kamikaze, targets, onDragDown }: KamikazeDragPhaseProps) {
  const { t } = useTranslation()
  const [ready, setReady] = useState(false)

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="text-center">
        <h2 className="text-xl font-extrabold text-white">💥 {t('game.kamikazePickTitle')}</h2>
      </div>

      {!ready ? (
        <div className="text-center space-y-5 py-6">
          <div className="text-5xl">📱</div>
          <div>
            <p className="text-neutral-400 text-base mb-2">{t('offline.passDevice')}</p>
            <p className="text-2xl font-extrabold text-red-300">{kamikaze.name}</p>
          </div>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto">{t('game.kamikazePickDesc')}</p>
          <button
            onClick={() => setReady(true)}
            className="px-8 py-3.5 rounded-2xl bg-red-700 hover:bg-red-600 text-white font-bold transition-all active:scale-[0.97]"
          >
            {t('offline.imReadyToVote')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-neutral-500 text-center">{t('game.kamikazePickDesc')}</p>
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
            {targets.map((p) => (
              <button
                key={p.name}
                onClick={() => onDragDown(p.name)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-800/60 hover:bg-red-900/30 border border-neutral-700/40 hover:border-red-700/50 transition-all active:scale-[0.98]"
              >
                <span className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-base shrink-0">
                  {p.name[0].toUpperCase()}
                </span>
                <span className="text-white text-sm font-semibold flex-1 min-w-0 truncate text-left">
                  {p.name}
                </span>
                <span className="text-red-400 text-xs font-bold">💥 →</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function VotePhase({
  allVoters,
  alivePlayers,
  detectiveUsedSet,
  revealedRoles,
  protectedPlayers,
  mayorDoubleVoteUsedSet,
  inverterUsedSet,
  inverterActiveThisRound,
  corruptorTargets,
  ghostVoterNames,
  revenantGhostRounds,
  onDetectiveReveal,
  onGuardianProtect,
  onMayorDoubleVote,
  onInverterActivate,
  onCorruptorPick,
  onVotesDone,
}: VotePhaseProps) {
  const { t } = useTranslation()
  const ROLES = getRoleConfig(t)
  const [voterIndex, setVoterIndex] = useState(0)
  const [step, setStep] = useState<VoteStep>('pass')
  const [votes, setVotes] = useState<VoteRecord[]>([])
  // Track which guardians have protected this round (within VotePhase)
  const [guardianProtectedThisRound, setGuardianProtectedThisRound] = useState<Set<string>>(new Set())
  // Mayor: is the current voter using their double-vote on this ballot?
  const [mayorDoublingThisVote, setMayorDoublingThisVote] = useState(false)

  const voter = allVoters[voterIndex]
  const isGhostVoter = voter ? ghostVoterNames.has(voter.name) : false

  // Reset mayor toggle whenever the voter changes
  useEffect(() => {
    setMayorDoublingThisVote(false)
  }, [voterIndex])

  const isDetective = voter?.role === 'detective'
  const isGuardian = voter?.role === 'guardian'
  const isMayor = voter?.role === 'mayor'
  const isInverter = voter?.role === 'inverter'
  const isCorruptor = voter?.role === 'corruptor'
  const canInvestigate = isDetective && !detectiveUsedSet.has(voter.name)
  const canProtect = isGuardian && !guardianProtectedThisRound.has(voter.name) && !isGhostVoter
  const canDoubleVote = isMayor && !mayorDoubleVoteUsedSet.has(voter.name) && !isGhostVoter
  const canActivateInverter = isInverter && !inverterUsedSet.has(voter.name) && !inverterActiveThisRound && !isGhostVoter
  const needsCorruptorPick = isCorruptor && !corruptorTargets[voter.name] && !isGhostVoter
  // Corruptor reminder: once they've picked, highlight that target on every later vote turn
  const corruptedTargetName = isCorruptor && !needsCorruptorPick ? corruptorTargets[voter.name] : null

  const finalizeRound = (newVotes: VoteRecord[]) => {
    // Apply Corruptor silencing: votes cast by a silenced voter don't count
    const aliveCorruptors = alivePlayers.filter((p) => p.role === 'corruptor')
    const silenced = new Set<string>()
    for (const c of aliveCorruptors) {
      const tgt = corruptorTargets[c.name]
      if (tgt) silenced.add(tgt)
    }
    const tally: Record<string, number> = {}
    for (const v of newVotes) {
      if (silenced.has(v.voterName)) continue
      tally[v.targetName] = (tally[v.targetName] ?? 0) + 1
    }
    const tallyValues = Object.values(tally)
    if (tallyValues.length === 0) {
      onVotesDone(newVotes, null)
      return
    }
    const maxVotes = Math.max(...tallyValues)
    const minVotes = Math.min(...tallyValues)
    const threshold = inverterActiveThisRound ? minVotes : maxVotes
    const topCandidates = Object.entries(tally)
      .filter(([, c]) => c === threshold)
      .map(([n]) => n)
    if (topCandidates.length > 1) {
      // Tie — check for an eligible Judge (alive, not in the tied set)
      const eligibleJudge = alivePlayers.find(
        (p) => p.role === 'judge' && !topCandidates.includes(p.name),
      )
      if (eligibleJudge) {
        onVotesDone(newVotes, null, { judgeTie: { judge: eligibleJudge, candidates: topCandidates } })
      } else {
        onVotesDone(newVotes, null)
      }
    } else {
      const eliminated = alivePlayers.find((p) => p.name === topCandidates[0]) ?? null
      onVotesDone(newVotes, eliminated)
    }
  }

  const castVote = (targetName: string) => {
    const extra: VoteRecord[] = mayorDoublingThisVote ? [{ voterName: voter.name, targetName }] : []
    const newVotes: VoteRecord[] = [...votes, { voterName: voter.name, targetName }, ...extra]
    if (mayorDoublingThisVote) onMayorDoubleVote(voter.name)
    const nextIndex = voterIndex + 1

    if (nextIndex >= allVoters.length) {
      finalizeRound(newVotes)
    } else {
      setVotes(newVotes)
      setVoterIndex(nextIndex)
      setStep('pass')
    }
  }

  const skipVote = () => {
    // Don't allow corruptors to skip before picking their target
    if (needsCorruptorPick) return
    const nextIndex = voterIndex + 1
    if (nextIndex >= allVoters.length) {
      finalizeRound(votes)
    } else {
      setVoterIndex(nextIndex)
      setStep('pass')
    }
  }

  const handleDetectiveInvestigate = (target: PlayerRole) => {
    // Infiltrator appears as Villager to the Detective
    const revealedAs: PlayerRoleType = target.role === 'infiltrator' ? 'villager' : target.role
    onDetectiveReveal(voter.name, target.name, revealedAs)
  }

  const handleGuardianProtect = (targetName: string) => {
    onGuardianProtect(voter.name, targetName)
    setGuardianProtectedThisRound((prev) => new Set(prev).add(voter.name))
  }

  // Target list: never the voter themselves; ghost revenants can never be targeted
  const otherPlayers = alivePlayers.filter(
    (p) => p.name !== voter?.name && !ghostVoterNames.has(p.name),
  )

  const voterRoleInfo = voter ? ROLES[voter.role] : null

  if (!voter) {
    return null
  }

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="text-center">
        <p className="text-neutral-400 text-sm mb-1">
          {t('offline.voteOf', { current: voterIndex + 1, total: allVoters.length })}
        </p>
        <h2 className="text-xl font-extrabold text-white">{t('offline.votingPhase')}</h2>
        {step === 'voting' && voterRoleInfo && (
          <div className="mt-2 flex justify-center">
            <div
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold',
                voterRoleInfo.bgClass,
                voterRoleInfo.borderClass,
                voterRoleInfo.textClass,
              ].join(' ')}
            >
              <span className="text-sm leading-none">{voterRoleInfo.icon}</span>
              <span className="text-neutral-300">{voter.name}</span>
              <span className="text-neutral-600">·</span>
              <span>{voterRoleInfo.label}</span>
            </div>
          </div>
        )}
        {step === 'voting' && isGhostVoter && (
          <p className="mt-2 text-[11px] text-teal-300 font-semibold">
            👻 {t('game.revenantGhostVoter', { count: revenantGhostRounds[voter.name] ?? 0 })}
          </p>
        )}
        {step === 'voting' && (voter.role === 'twinRedHanded' || voter.role === 'twinVillager') && voter.twinPartner && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/40 border border-purple-800/40 text-xs font-semibold text-purple-300">
            <span>👯</span>
            <span>{t('game.twinPartnerBanner', { name: voter.twinPartner, defaultValue: 'Your twin: {{name}}' })}</span>
          </div>
        )}
      </div>

      {step === 'pass' ? (
        <div className="text-center space-y-5 py-6">
          <div className="text-5xl">{isGhostVoter ? '👻' : '📱'}</div>
          <div>
            <p className="text-neutral-400 text-base mb-2">{t('offline.passDevice')}</p>
            <p className="text-2xl font-extrabold text-brand-400">{voter.name}</p>
          </div>
          <button
            onClick={() => setStep('voting')}
            className="px-8 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all active:scale-[0.97]"
          >
            {t('offline.imReadyToVote')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mayor double-vote toggle */}
          {canDoubleVote && (
            <button
              onClick={() => setMayorDoublingThisVote((v) => !v)}
              className={[
                'w-full py-2.5 rounded-xl border text-sm font-bold transition-all active:scale-[0.98]',
                mayorDoublingThisVote
                  ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-200'
                  : 'bg-indigo-900/30 hover:bg-indigo-900/50 border-indigo-800/50 text-indigo-300',
              ].join(' ')}
            >
              👑 {mayorDoublingThisVote ? t('game.mayorDoubleVoteActive') : t('game.mayorDoubleVoteBtn')}
            </button>
          )}
          {isMayor && mayorDoubleVoteUsedSet.has(voter.name) && !canDoubleVote && (
            <div className="text-center text-[11px] text-indigo-500/80">
              👑 {t('game.mayorDoubleVoteUsed')}
            </div>
          )}

          {/* Inverter activate button */}
          {canActivateInverter && (
            <button
              onClick={onInverterActivate}
              className="w-full py-2.5 rounded-xl border border-rose-800/50 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 text-sm font-bold transition-all active:scale-[0.98]"
            >
              🔄 {t('game.inverterActivateBtn')}
            </button>
          )}
          {isInverter && inverterActiveThisRound && (
            <div className="text-center text-[11px] text-rose-300 font-semibold">
              🔄 {t('game.inverterActive')}
            </div>
          )}
          {isInverter && inverterUsedSet.has(voter.name) && !inverterActiveThisRound && (
            <div className="text-center text-[11px] text-rose-500/80">
              🔄 {t('game.inverterUsed')}
            </div>
          )}

          {/* Corruptor pick prompt */}
          {needsCorruptorPick && (
            <div className="rounded-xl border border-orange-800/50 bg-orange-950/40 px-4 py-3 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-0.5">
                🕷️ {t('game.corruptorPickTitle')}
              </p>
              <p className="text-[11px] text-orange-300/80">{t('game.corruptorPickDesc')}</p>
            </div>
          )}

          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
              {t('offline.whoIsRedHanded', { name: voter.name })}
            </p>
            <div className="space-y-2">
              {otherPlayers.map((p) => {
                const revealed = revealedRoles[p.name]
                const revealedRc = revealed ? ROLES[revealed] : null
                const isCorruptedTarget = corruptedTargetName === p.name
                return (
                  <div
                    key={p.name}
                    className={[
                      'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
                      isCorruptedTarget
                        ? 'bg-orange-950/30 border-orange-500/70'
                        : 'bg-neutral-800/60 border-neutral-700/40',
                    ].join(' ')}
                  >
                    <span className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-base shrink-0">
                      {p.name[0].toUpperCase()}
                    </span>
                    <span className="text-white text-sm font-semibold flex-1 min-w-0 truncate">
                      {p.name}
                      {isCorruptedTarget && (
                        <span
                          className="ml-2 text-xs text-orange-400"
                          title={t('game.corruptorPickDesc')}
                        >
                          🕷️
                        </span>
                      )}
                      {isDetective && revealedRc && (
                        <span className={`ml-2 text-xs ${revealedRc.textClass}`}>
                          {revealedRc.icon} {revealedRc.label}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Detective investigate button */}
                      {canInvestigate && !revealed && (
                        <button
                          onClick={() => handleDetectiveInvestigate(p)}
                          className="w-9 h-9 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700/40 flex items-center justify-center text-blue-400 transition-all active:scale-90"
                          title={t('offline.investigate')}
                        >
                          🔍
                        </button>
                      )}
                      {/* Guardian protect button */}
                      {canProtect && !protectedPlayers.has(p.name) && (
                        <button
                          onClick={() => handleGuardianProtect(p.name)}
                          className="w-9 h-9 rounded-lg bg-yellow-900/40 hover:bg-yellow-800/60 border border-yellow-700/40 flex items-center justify-center text-yellow-400 transition-all active:scale-90"
                          title={t('offline.protect')}
                        >
                          🛡️
                        </button>
                      )}
                      {/* Protected indicator */}
                      {isGuardian && protectedPlayers.has(p.name) && (
                        <span className="w-9 h-9 rounded-lg bg-yellow-900/20 border border-yellow-800/30 flex items-center justify-center text-yellow-500/50">
                          🛡️
                        </span>
                      )}
                      {/* Corruptor corrupt button (first vote only) */}
                      {needsCorruptorPick && (
                        <button
                          onClick={() => onCorruptorPick(voter.name, p.name)}
                          className="w-9 h-9 rounded-lg bg-orange-900/40 hover:bg-orange-800/60 border border-orange-700/40 flex items-center justify-center text-orange-400 transition-all active:scale-90"
                          title={t('game.corruptorPickBtn')}
                        >
                          🕷️
                        </button>
                      )}
                      {/* Vote button */}
                      <button
                        onClick={() => castVote(p.name)}
                        className="px-3 h-9 rounded-lg bg-neutral-700/60 hover:bg-neutral-600/60 border border-neutral-600/40 hover:border-neutral-500/60 text-neutral-300 hover:text-white text-xs font-bold transition-all active:scale-95"
                      >
                        {t('offline.voteArrow')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {step === 'voting' && (
        <button
          onClick={skipVote}
          disabled={needsCorruptorPick}
          className="w-full py-2.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700/40 text-neutral-500 hover:text-neutral-300 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-neutral-800/60 disabled:hover:text-neutral-500"
        >
          {t('offline.cancelVote')}
        </button>
      )}
    </div>
  )
}

// ─── Sub-component: Vote Result ───────────────────────────────────────────────

interface VoteResultProps {
  votes: VoteRecord[]
  eliminated: PlayerRole | null
  protectedPlayerName?: string | null
  silencedVoterNames: Set<string>
  onContinue: () => void
}

function VoteResult({ votes, eliminated, protectedPlayerName, silencedVoterNames, onContinue }: VoteResultProps) {
  const { t } = useTranslation()
  const ROLES = getRoleConfig(t)
  // Filter out silenced (corrupted) voters so the displayed tally matches the actual elimination logic
  const tally: Record<string, number> = {}
  for (const v of votes) {
    if (silencedVoterNames.has(v.voterName)) continue
    tally[v.targetName] = (tally[v.targetName] ?? 0) + 1
  }
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
  const totalCounted = Object.values(tally).reduce((a, b) => a + b, 0)

  const eliminatedRc = eliminated ? ROLES[eliminated.role] : null

  // Animate the tally bars from 0 → real width on mount. This gives the
  // vote reveal the same theatrical build-up as a results screen.
  const [barsRevealed, setBarsRevealed] = useState(false)
  useEffect(() => {
    // Sound + haptic stinger for the outcome — matches mobile parity.
    if (protectedPlayerName) {
      SoundManager.play('notification')
      HapticManager.medium()
    } else if (eliminated) {
      SoundManager.play('elimination')
      HapticManager.heavy()
    } else {
      SoundManager.play('click')
      HapticManager.light()
    }
    const id = setTimeout(() => setBarsRevealed(true), 350)
    return () => clearTimeout(id)
  }, [eliminated, protectedPlayerName])

  return (
    <div className="space-y-5 animate-slide-up">
      {protectedPlayerName ? (
        <div className="text-center space-y-2 animate-pop-in">
          <div className="text-5xl animate-tada">🛡️</div>
          <h2 className="text-xl font-extrabold text-yellow-400 animate-stamp-in">
            {t('offline.protectionTriggered', { name: protectedPlayerName })}
          </h2>
        </div>
      ) : eliminated && eliminatedRc ? (
        <div className="w-full max-w-sm mx-auto animate-pop-in">
          {/* Briefly flash the screen red to sell the elimination hit */}
          <div className="pointer-events-none fixed inset-0 bg-red-600/60 animate-screen-flash -z-0" aria-hidden />
          <div
            className={`relative rounded-3xl border-2 p-6 text-center space-y-4 shadow-2xl ${eliminatedRc.bgClass} ${eliminatedRc.borderClass}`}
          >
            <div className="text-xs font-bold uppercase tracking-widest text-red-400 animate-urgent-pulse inline-block px-3 py-1 rounded-full bg-red-950/60 border border-red-700/60">
              🗳️ {t('offline.eliminated')}
            </div>
            <div className="text-6xl animate-death-fall">{eliminatedRc.icon}</div>
            <div>
              <p className="text-3xl font-extrabold text-white mb-2 animate-stamp-in">{eliminated.name}</p>
              <p className={`text-[11px] font-bold uppercase tracking-widest ${eliminatedRc.badgeClass}`}>
                {t('offline.theyWere')}
              </p>
              <p className={`text-2xl font-extrabold ${eliminatedRc.textClass} animate-flip-in`}>
                {eliminatedRc.label}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center space-y-2 animate-pop-in">
          <div className="text-4xl animate-wobble">🤷</div>
          <h2 className="text-xl font-extrabold text-white">
            {t('offline.noOneEliminated')}
          </h2>
        </div>
      )}

      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">{t('offline.voteTally')}</p>
        {sorted.map(([name, count], idx) => {
          const targetWidth = (count / Math.max(totalCounted, 1)) * 100
          return (
            <div
              key={name}
              className="flex items-center gap-3 animate-slide-up"
              style={{ animationDelay: `${idx * 70}ms`, animationFillMode: 'backwards' }}
            >
              <span className="text-sm font-semibold text-white w-28 truncate">{name}</span>
              <div className="flex-1 bg-neutral-800 rounded-full h-2 overflow-hidden">
                <div
                  className={[
                    'h-2 rounded-full transition-all duration-700 ease-out',
                    eliminated?.name === name ? 'bg-red-500' : 'bg-neutral-600',
                  ].join(' ')}
                  style={{ width: `${barsRevealed ? targetWidth : 0}%` }}
                />
              </div>
              <span className="text-xs text-neutral-400 w-6 text-right tabular-nums">{count}</span>
            </div>
          )
        })}
      </div>

      <button
        onClick={onContinue}
        className="w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all active:scale-[0.97]"
      >
        {t('offline.continueGame')}
      </button>
    </div>
  )
}

// ─── Sub-component: Playing Phase ────────────────────────────────────────────

interface PlayingPhaseProps {
  players: PlayerRole[]
  gameMode: GameMode
  wordPair: { villagerWord: string; redHandedWord: string }
  onRevealRoles: (updatedPlayers: PlayerRole[], manual?: boolean) => void
}

type PlayingSubPhase = 'main' | 'voting' | 'voteResult' | 'kamikazeDrag' | 'judgeTieBreak'

interface JudgeTiePending {
  judge: PlayerRole
  candidates: string[]
  votes: VoteRecord[]
}

interface VoteExtras {
  judgeTie?: { judge: PlayerRole; candidates: string[] }
}

function PlayingPhase({ players: initialPlayers, gameMode, wordPair, onRevealRoles }: PlayingPhaseProps) {
  const { t } = useTranslation()
  const [players, setPlayers] = useState<PlayerRole[]>(initialPlayers)
  const [subPhase, setSubPhase] = useState<PlayingSubPhase>('main')
  const [lastVotes, setLastVotes] = useState<VoteRecord[]>([])
  const [lastEliminated, setLastEliminated] = useState<PlayerRole | null>(null)
  // Snapshot of who was silenced when the last vote was finalized — used so the
  // displayed tally on the result screen matches the elimination logic exactly.
  const [lastSilencedVoters, setLastSilencedVoters] = useState<Set<string>>(new Set())

  // Detective state: once per game per detective, revealed roles persist across rounds
  const [detectiveUsedSet, setDetectiveUsedSet] = useState<Set<string>>(new Set())
  const [revealedRoles, setRevealedRoles] = useState<Record<string, PlayerRoleType>>({})

  // Guardian state: resets each round
  const [protectedPlayers, setProtectedPlayers] = useState<Set<string>>(new Set())
  const [protectionTriggeredName, setProtectionTriggeredName] = useState<string | null>(null)

  // Mayor: once per player per game
  const [mayorDoubleVoteUsedSet, setMayorDoubleVoteUsedSet] = useState<Set<string>>(new Set())
  // Inverter: once per player per game; flag resets each round
  const [inverterUsedSet, setInverterUsedSet] = useState<Set<string>>(new Set())
  const [inverterActiveThisRound, setInverterActiveThisRound] = useState(false)
  // Corruptor: map corruptorName -> silencedTargetName (chosen during their first vote turn)
  const [corruptorTargets, setCorruptorTargets] = useState<Record<string, string>>({})
  // Revenant ghost votes: remaining rounds per dead revenant
  const [revenantGhostRounds, setRevenantGhostRounds] = useState<Record<string, number>>({})
  // Kamikaze pending drag-down: set when a kamikaze is voted out
  const [kamikazePending, setKamikazePending] = useState<PlayerRole | null>(null)
  // Judge tie-break: set when a vote ends in a tie AND an eligible judge is alive
  const [judgeTiePending, setJudgeTiePending] = useState<JudgeTiePending | null>(null)

  const alivePlayers = players.filter((p) => !p.isEliminated)

  // Ghost voters: dead revenants with remaining post-death rounds
  const ghostVoters: PlayerRole[] = Object.keys(revenantGhostRounds)
    .filter((name) => revenantGhostRounds[name] > 0)
    .map((name) => players.find((p) => p.name === name))
    .filter((p): p is PlayerRole => !!p)
  const allVoters: PlayerRole[] = [...alivePlayers, ...ghostVoters]
  const ghostVoterNames = new Set(ghostVoters.map((g) => g.name))

  const handleStartVote = () => {
    setProtectedPlayers(new Set())
    setInverterActiveThisRound(false)
    setSubPhase('voting')
  }

  const handleDetectiveReveal = (detectiveName: string, targetName: string, targetRole: PlayerRoleType) => {
    setDetectiveUsedSet((prev) => new Set(prev).add(detectiveName))
    setRevealedRoles((prev) => ({ ...prev, [targetName]: targetRole }))
  }

  const handleGuardianProtect = (_guardianName: string, targetName: string) => {
    setProtectedPlayers((prev) => new Set(prev).add(targetName))
  }

  const handleMayorDoubleVote = (mayorName: string) => {
    setMayorDoubleVoteUsedSet((prev) => new Set(prev).add(mayorName))
  }

  const handleInverterActivate = () => {
    setInverterActiveThisRound(true)
    // Find the current alive inverter and mark them as used
    const aliveInverter = alivePlayers.find((p) => p.role === 'inverter' && !inverterUsedSet.has(p.name))
    if (aliveInverter) {
      setInverterUsedSet((prev) => new Set(prev).add(aliveInverter.name))
    }
  }

  const handleCorruptorPick = (corruptorName: string, targetName: string) => {
    setCorruptorTargets((prev) => ({ ...prev, [corruptorName]: targetName }))
  }

  const endRoundWithReveal = (updatedPlayers: PlayerRole[]) => {
    // Win-condition check after applying any eliminations
    const alive = updatedPlayers.filter((p) => !p.isEliminated)
    const aliveEvil = alive.filter((p) => isEvilRole(p.role))
    const aliveGood = alive.filter((p) => !isEvilRole(p.role))
    if (aliveEvil.length === 0 || aliveEvil.length >= aliveGood.length) {
      onRevealRoles(updatedPlayers)
      return true
    }
    return false
  }

  const handleVotesDone = (votes: VoteRecord[], eliminated: PlayerRole | null, extras?: VoteExtras) => {
    setLastVotes(votes)

    // Capture the set of silenced voters at this exact moment so VoteResult
    // can render a tally matching the actual elimination logic.
    const silenced = new Set<string>()
    for (const c of alivePlayers.filter((p) => p.role === 'corruptor')) {
      const tgt = corruptorTargets[c.name]
      if (tgt) silenced.add(tgt)
    }
    setLastSilencedVoters(silenced)

    // Tie with eligible judge — go to judge sub-phase
    if (extras?.judgeTie) {
      setLastEliminated(null)
      setProtectionTriggeredName(null)
      setJudgeTiePending({ judge: extras.judgeTie.judge, candidates: extras.judgeTie.candidates, votes })
      setSubPhase('judgeTieBreak')
      return
    }

    // No one eliminated (tie with no judge)
    if (!eliminated) {
      setLastEliminated(null)
      setProtectionTriggeredName(null)
      setSubPhase('voteResult')
      return
    }

    // Protected by Guardian
    if (protectedPlayers.has(eliminated.name)) {
      setLastEliminated(null)
      setProtectionTriggeredName(eliminated.name)
      setSubPhase('voteResult')
      return
    }

    // Jester wins immediately
    if (eliminated.role === 'jester') {
      const updatedPlayers = players.map((p) =>
        p.name === eliminated.name ? { ...p, isEliminated: true, jesterWon: true } : p,
      )
      setPlayers(updatedPlayers)
      onRevealRoles(updatedPlayers)
      return
    }

    // Revenant: schedule ghost votes
    if (eliminated.role === 'revenant') {
      setRevenantGhostRounds((prev) => ({ ...prev, [eliminated.name]: REVENANT_POST_DEATH_ROUNDS }))
    }

    // Kamikaze: go to drag-down sub-phase before resolving the round
    if (eliminated.role === 'kamikaze') {
      setPlayers((prev) => prev.map((p) => (p.name === eliminated.name ? { ...p, isEliminated: true } : p)))
      setLastEliminated(eliminated)
      setProtectionTriggeredName(null)
      setKamikazePending(eliminated)
      setSubPhase('kamikazeDrag')
      return
    }

    // Normal elimination
    const updatedPlayers = players.map((p) =>
      p.name === eliminated.name ? { ...p, isEliminated: true } : p,
    )
    setPlayers(updatedPlayers)
    setLastEliminated(eliminated)
    setProtectionTriggeredName(null)
    setSubPhase('voteResult')
  }

  const handleJudgeDecide = (targetName: string) => {
    if (!judgeTiePending) return
    const target = players.find((p) => p.name === targetName)
    if (!target) return

    // Guardian protection can still save the judge's pick
    if (protectedPlayers.has(targetName)) {
      setLastEliminated(null)
      setProtectionTriggeredName(targetName)
      setJudgeTiePending(null)
      setSubPhase('voteResult')
      return
    }

    // Jester wins via judge pick too
    if (target.role === 'jester') {
      const updatedPlayers = players.map((p) =>
        p.name === targetName ? { ...p, isEliminated: true, jesterWon: true } : p,
      )
      setPlayers(updatedPlayers)
      setJudgeTiePending(null)
      onRevealRoles(updatedPlayers)
      return
    }

    if (target.role === 'revenant') {
      setRevenantGhostRounds((prev) => ({ ...prev, [targetName]: REVENANT_POST_DEATH_ROUNDS }))
    }

    if (target.role === 'kamikaze') {
      setPlayers((prev) => prev.map((p) => (p.name === targetName ? { ...p, isEliminated: true } : p)))
      setLastEliminated(target)
      setProtectionTriggeredName(null)
      setKamikazePending(target)
      setJudgeTiePending(null)
      setSubPhase('kamikazeDrag')
      return
    }

    const updatedPlayers = players.map((p) =>
      p.name === targetName ? { ...p, isEliminated: true } : p,
    )
    setPlayers(updatedPlayers)
    setLastEliminated(target)
    setProtectionTriggeredName(null)
    setJudgeTiePending(null)
    setSubPhase('voteResult')
  }

  const handleKamikazeDragDown = (victimName: string) => {
    // Drag-down bypasses Guardian protection per role description
    const updatedPlayers = players.map((p) =>
      p.name === victimName ? { ...p, isEliminated: true } : p,
    )
    setPlayers(updatedPlayers)
    setKamikazePending(null)

    // Jester win still applies if dragged
    const victim = players.find((p) => p.name === victimName)
    if (victim?.role === 'jester') {
      const withJester = updatedPlayers.map((p) =>
        p.name === victimName ? { ...p, jesterWon: true } : p,
      )
      setPlayers(withJester)
      onRevealRoles(withJester)
      return
    }

    // Revenant drag-down still gets ghost votes
    if (victim?.role === 'revenant') {
      setRevenantGhostRounds((prev) => ({ ...prev, [victimName]: REVENANT_POST_DEATH_ROUNDS }))
    }

    setSubPhase('voteResult')
  }

  const handleContinueAfterVote = () => {
    setProtectedPlayers(new Set())
    setProtectionTriggeredName(null)
    setInverterActiveThisRound(false)

    // Decrement ghost revenant rounds
    setRevenantGhostRounds((prev) => {
      const next: Record<string, number> = {}
      for (const [name, rounds] of Object.entries(prev)) {
        if (rounds - 1 > 0) next[name] = rounds - 1
      }
      return next
    })

    if (endRoundWithReveal(players)) return
    setSubPhase('main')
  }

  if (subPhase === 'voting') {
    return (
      <VotePhase
        allVoters={allVoters}
        alivePlayers={alivePlayers}
        detectiveUsedSet={detectiveUsedSet}
        revealedRoles={revealedRoles}
        protectedPlayers={protectedPlayers}
        mayorDoubleVoteUsedSet={mayorDoubleVoteUsedSet}
        inverterUsedSet={inverterUsedSet}
        inverterActiveThisRound={inverterActiveThisRound}
        corruptorTargets={corruptorTargets}
        ghostVoterNames={ghostVoterNames}
        revenantGhostRounds={revenantGhostRounds}
        onDetectiveReveal={handleDetectiveReveal}
        onGuardianProtect={handleGuardianProtect}
        onMayorDoubleVote={handleMayorDoubleVote}
        onInverterActivate={handleInverterActivate}
        onCorruptorPick={handleCorruptorPick}
        onVotesDone={handleVotesDone}
      />
    )
  }

  if (subPhase === 'judgeTieBreak' && judgeTiePending) {
    return (
      <JudgeTieBreakPhase
        judge={judgeTiePending.judge}
        candidates={judgeTiePending.candidates}
        onDecide={handleJudgeDecide}
      />
    )
  }

  if (subPhase === 'kamikazeDrag' && kamikazePending) {
    return (
      <KamikazeDragPhase
        kamikaze={kamikazePending}
        targets={players.filter((p) => !p.isEliminated && p.name !== kamikazePending.name)}
        onDragDown={handleKamikazeDragDown}
      />
    )
  }

  if (subPhase === 'voteResult') {
    return (
      <VoteResult
        votes={lastVotes}
        eliminated={lastEliminated}
        protectedPlayerName={protectionTriggeredName}
        silencedVoterNames={lastSilencedVoters}
        onContinue={handleContinueAfterVote}
      />
    )
  }

  const eliminatedPlayers = players.filter((p) => p.isEliminated)

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-600/30 bg-brand-600/10 text-brand-400 text-xs font-semibold mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          {t('offline.gameInProgress')}
          {gameMode === 'special' && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold uppercase">{t('offline.special')}</span>
          )}
        </div>
        <h2 className="text-2xl font-extrabold text-white">
          {alivePlayers.length === 1
            ? t('offline.playerAlive', { count: 1 })
            : t('offline.playersAlive', { count: alivePlayers.length })}
        </h2>
      </div>

      {/* Speaking timer */}
      <SpeakingTimer defaultSeconds={30} />

      {/* Players list */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">{t('common.players')}</p>
        {players.map((p) => (
          <div
            key={p.name}
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-xl border',
              p.isEliminated
                ? 'bg-neutral-900/20 border-neutral-800/30 opacity-50'
                : 'bg-neutral-800/40 border-neutral-700/40',
            ].join(' ')}
          >
            <span className={[
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
              p.isEliminated ? 'bg-neutral-800 text-neutral-600' : 'bg-brand-900/40 text-brand-400',
            ].join(' ')}>
              {p.name[0].toUpperCase()}
            </span>
            <span className={['font-semibold text-sm', p.isEliminated ? 'text-neutral-600 line-through' : 'text-white'].join(' ')}>
              {p.name}
            </span>
            {p.isEliminated && (
              <span className="ml-auto text-xs text-neutral-600 font-semibold">{t('offline.eliminated')}</span>
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        {alivePlayers.length >= 3 && (
          <button
            onClick={handleStartVote}
            className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-base transition-all active:scale-[0.98] shadow-xl shadow-amber-600/20"
          >
            {t('offline.startVote')}
          </button>
        )}
        <button
          onClick={() => onRevealRoles(players, true)}
          className="w-full py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/60 text-white font-bold text-base transition-all active:scale-[0.98]"
        >
          {t('offline.revealRoles')}
        </button>
      </div>

      {eliminatedPlayers.length > 0 && (
        <p className="text-center text-neutral-600 text-xs">
          {t('offline.playersEliminated', { count: eliminatedPlayers.length })}
        </p>
      )}
    </div>
  )
}

// ─── Sub-component: Results Phase ────────────────────────────────────────────

interface ResultsPhaseProps {
  players: PlayerRole[]
  gameMode: GameMode
  wordPair: { villagerWord: string; redHandedWord: string }
  manualReveal: boolean
  onPlayAgain: () => void
  onHome: () => void
}

function ResultsPhase({ players, gameMode, wordPair, manualReveal, onPlayAgain, onHome }: ResultsPhaseProps) {
  const { t } = useTranslation()
  const ROLES = getRoleConfig(t)
  // All red-handed-side roles (including special redHanded roles) count as "evil"
  // for the win check. The villagers win iff every evil player is eliminated.
  const evilTeam = players.filter((p) => isEvilRole(p.role))
  const eliminatedEvil = evilTeam.filter((p) => p.isEliminated)
  const redHandedWon = !manualReveal && eliminatedEvil.length < evilTeam.length

  // Final stinger — bigger reaction for a decisive outcome, softer for
  // a manual reveal (players chose to exit before finishing).
  useEffect(() => {
    if (manualReveal) {
      SoundManager.play('game_end')
      HapticManager.light()
      return
    }
    SoundManager.play('game_end')
    if (redHandedWon) HapticManager.error()
    else HapticManager.success()
  }, [manualReveal, redHandedWon])

  // Villager-win confetti: 40 particles that rain from the top.
  const confetti = React.useMemo(() => {
    if (manualReveal || redHandedWon) return []
    const COLORS = ['#22c55e', '#a78bfa', '#fbbf24', '#f472b6', '#38bdf8']
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2 + Math.random() * 1.5,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 6,
    }))
  }, [manualReveal, redHandedWon])

  return (
    <div className="relative space-y-6 animate-slide-up">
      {/* Confetti for villager wins — purely decorative, behind the content */}
      {confetti.length > 0 && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-0" aria-hidden>
          {confetti.map((p) => (
            <span
              key={p.id}
              className="absolute top-0 rounded-sm animate-confetti-rain"
              style={{
                left: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size * 1.6}px`,
                background: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          ))}
        </div>
      )}
      {/* RedHanded-win red screen flash */}
      {!manualReveal && redHandedWon && (
        <div className="pointer-events-none fixed inset-0 bg-red-600/50 animate-screen-flash -z-0" aria-hidden />
      )}
      {/* Header */}
      <div className="relative text-center space-y-3">
        <div className="text-6xl animate-tada">🎭</div>
        <h1 className="text-3xl font-extrabold text-white animate-stamp-in">{t('offline.gameOver')}</h1>
        <div className={[
          'inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold',
          manualReveal
            ? 'bg-neutral-800/60 border-neutral-600/50 text-neutral-300 animate-pop-in'
            : redHandedWon
              ? 'bg-red-950/60 border-red-700/50 text-red-400 animate-urgent-pulse'
              : 'bg-emerald-950/60 border-emerald-700/50 text-emerald-400 animate-glow-pulse',
        ].join(' ')}>
          {manualReveal
            ? `👁️ ${t('offline.rolesRevealed')}`
            : redHandedWon ? `🔴 ${t('offline.redHandedWin')}` : `🟢 ${t('offline.villagersWin')}`}
        </div>
      </div>

      {/* Words revealed */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">{t('offline.theWords')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/30">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">{t('offline.villagerWord')}</p>
            <p className="text-lg font-extrabold text-emerald-300">{wordPair.villagerWord}</p>
          </div>
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/30">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1">{t('offline.redHandedWord')}</p>
            <p className="text-lg font-extrabold text-red-300">{wordPair.redHandedWord}</p>
          </div>
        </div>
      </div>

      {/* Role legend for special mode */}
      {gameMode === 'special' && (
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">{t('offline.roleLegend')}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2"><span>🟢</span><span className="text-emerald-400">{t('offline.villager')}</span></div>
            <div className="flex items-center gap-2"><span>🔴</span><span className="text-red-400">{t('offline.redHanded')}</span></div>
            <div className="flex items-center gap-2"><span>🔍</span><span className="text-blue-400">{t('offline.detective')}</span></div>
            <div className="flex items-center gap-2"><span>🕵️</span><span className="text-amber-400">{t('offline.doubleAgent')}</span></div>
            <div className="flex items-center gap-2"><span>🛡️</span><span className="text-yellow-400">{t('offline.guardian')}</span></div>
          </div>
        </div>
      )}

      {/* All players with roles */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">{t('offline.allRoles')}</p>
        {players.map((p, idx) => {
          const rc = ROLES[p.role]
          const evil = isEvilRole(p.role)
          return (
            <div
              key={p.name}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border animate-slide-right',
                evil
                  ? 'bg-red-950/30 border-red-800/30'
                  : p.role === 'detective'
                    ? 'bg-blue-950/20 border-blue-800/20'
                    : p.role === 'guardian'
                    ? 'bg-yellow-950/20 border-yellow-800/20'
                    : 'bg-emerald-950/20 border-emerald-800/20',
              ].join(' ')}
              style={{ animationDelay: `${idx * 55}ms`, animationFillMode: 'backwards' }}
            >
              <span className="text-xl">{rc.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={['font-semibold text-sm', p.isEliminated ? 'line-through opacity-60' : ''].join(' ')}>
                  {p.name}
                </p>
                <p className={`text-xs ${rc.badgeClass}`}>
                  {rc.label} · {p.word}
                </p>
              </div>
              {p.isEliminated && (
                <span className="text-[10px] font-bold uppercase text-neutral-600 bg-neutral-800 px-2 py-0.5 rounded-full">
                  {t('offline.out')}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <button
          onClick={onPlayAgain}
          className="w-full py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-lg transition-all active:scale-[0.98] shadow-xl shadow-brand-600/20"
        >
          {t('offline.playAgain')}
        </button>
        <button
          onClick={onHome}
          className="w-full py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/60 text-neutral-300 hover:text-white font-bold text-base transition-all active:scale-[0.98]"
        >
          {t('offline.home')}
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OfflinePage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const [phase, setPhase] = useState<Phase>('setup')
  const [players, setPlayers] = useState<PlayerRole[]>([])
  const [gameMode, setGameMode] = useState<GameMode>('normal')
  const [wordPair, setWordPair] = useState<{ villagerWord: string; redHandedWord: string }>({
    villagerWord: '',
    redHandedWord: '',
  })
  // Persist settings across Play Again
  const [lastSettings, setLastSettings] = useState<GameSettings | null>(null)

  const handleStart = useCallback(
    (
      names: string[],
      redHandedCount: number,
      counts: SpecialRoleCounts,
      categories: WordCategory[],
      mode: GameMode,
    ) => {
      // Save settings for Play Again
      setLastSettings({
        names,
        redHandedCount,
        detectiveCount:   counts.detective,
        doubleAgentCount: counts.doubleAgent,
        guardianCount:    counts.guardian,
        mayorCount:       counts.mayor,
        judgeCount:       counts.judge,
        revenantCount:    counts.revenant,
        infiltratorCount: counts.infiltrator,
        jesterCount:      counts.jester,
        kamikazeCount:    counts.kamikaze,
        corruptorCount:   counts.corruptor,
        inverterCount:    counts.inverter,
        evilTwinsCount:   counts.evilTwins,
        categories,
        gameMode: mode,
      })
      setGameMode(mode)

      const rawPair = pickRandomWordPair(categories, shuffleArray, i18n.language)
      // Randomly swap which word goes to villagers vs redHanded
      const pair = Math.random() < 0.5
        ? { villagerWord: rawPair.redHandedWord, redHandedWord: rawPair.villagerWord }
        : rawPair
      const playerOrder = shuffleArray([...names])

      let roles: PlayerRole[]

      if (mode === 'special') {
        // Build a queue of roles in a fixed team order, then assign to players.
        // RedHanded side first (they get the redHanded word except infiltrator),
        // then villager side (villager word), then neutral.
        const queue: PlayerRoleType[] = []
        const specialEvilCount =
          counts.doubleAgent + counts.infiltrator + counts.kamikaze +
          counts.corruptor + counts.inverter + counts.evilTwins
        const normalRedHanded = Math.max(0, redHandedCount - specialEvilCount)
        for (let i = 0; i < normalRedHanded;     i++) queue.push('red_handed')
        for (let i = 0; i < counts.doubleAgent;  i++) queue.push('doubleAgent')
        for (let i = 0; i < counts.infiltrator;  i++) queue.push('infiltrator')
        for (let i = 0; i < counts.kamikaze;     i++) queue.push('kamikaze')
        for (let i = 0; i < counts.corruptor;    i++) queue.push('corruptor')
        for (let i = 0; i < counts.inverter;     i++) queue.push('inverter')
        if (counts.evilTwins > 0) {
          queue.push('twinRedHanded')
          queue.push('twinVillager')
        }
        for (let i = 0; i < counts.detective;    i++) queue.push('detective')
        for (let i = 0; i < counts.guardian;     i++) queue.push('guardian')
        for (let i = 0; i < counts.mayor;        i++) queue.push('mayor')
        for (let i = 0; i < counts.judge;        i++) queue.push('judge')
        for (let i = 0; i < counts.revenant;     i++) queue.push('revenant')
        for (let i = 0; i < counts.jester;       i++) queue.push('jester')
        // Fill the rest with plain villagers
        while (queue.length < playerOrder.length) queue.push('villager')
        // Truncate if somehow over-assigned (safety)
        queue.length = playerOrder.length

        roles = playerOrder.map((name, i) => {
          const role = queue[i]
          // Which side's word does this role get?
          // RedHanded word: redHanded, double_agent, kamikaze, corruptor, inverter, twin_red_handed
          // Villager word: everything else (including infiltrator — that's the twist)
          const getsRedHandedWord =
            role === 'red_handed' ||
            role === 'doubleAgent' ||
            role === 'kamikaze' ||
            role === 'corruptor' ||
            role === 'inverter' ||
            role === 'twinRedHanded'
          return {
            name,
            role,
            word: getsRedHandedWord ? pair.redHandedWord : pair.villagerWord,
            isEliminated: false,
          }
        })

        // Link Evil Twins so each knows their partner's name
        const twinI = roles.find((p) => p.role === 'twinRedHanded')
        const twinV = roles.find((p) => p.role === 'twinVillager')
        if (twinI && twinV) {
          twinI.twinPartner = twinV.name
          twinV.twinPartner = twinI.name
        }
      } else {
        // Normal mode
        roles = playerOrder.map((name, i) => ({
          name,
          role: (i < redHandedCount ? 'red_handed' : 'villager') as PlayerRoleType,
          word: i < redHandedCount ? pair.redHandedWord : pair.villagerWord,
          isEliminated: false,
        }))
      }

      const shuffledRoles = shuffleArray(roles)
      setWordPair(pair)
      setPlayers(shuffledRoles)
      setPhase('dealing')
    },
    [],
  )

  const handleDealingDone = useCallback(() => {
    setPhase('playing')
  }, [])

  const [manualReveal, setManualReveal] = useState(false)
  const handleRevealRoles = useCallback((updatedPlayers: PlayerRole[], manual = false) => {
    setManualReveal(manual)
    setPlayers(updatedPlayers)
    setPhase('results')
  }, [])

  const handlePlayAgain = useCallback(() => {
    setPhase('setup')
    setPlayers([])
    setWordPair({ villagerWord: '', redHandedWord: '' })
    // lastSettings is preserved so SetupPhase gets initial values
  }, [])

  const handleHome = useCallback(() => {
    navigate('/')
  }, [navigate])

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-neutral-800/60 bg-neutral-950/90 backdrop-blur">
        <button
          onClick={phase === 'setup' ? handleHome : handlePlayAgain}
          className="w-9 h-9 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700/40 flex items-center justify-center text-neutral-400 hover:text-white transition-all"
        >
          ←
        </button>
        <div className="text-center">
          <p className="text-white font-bold text-sm">{t('offline.title')}</p>
          <p className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">
            {phase === 'setup' && t('offline.setup')}
            {phase === 'dealing' && t('offline.dealingCards')}
            {phase === 'playing' && (gameMode === 'special' ? t('offline.specialMode') : t('offline.playing'))}
            {phase === 'results' && t('offline.results')}
          </p>
        </div>
        <div className="w-9" />
      </div>

      {/* Content */}
      <main className="px-4 py-6 pb-24 max-w-lg mx-auto">
        {phase === 'setup' && (
          <SetupPhase initialSettings={lastSettings} onStart={handleStart} />
        )}
        {phase === 'dealing' && (
          <DealingPhase players={players} gameMode={gameMode} wordPair={wordPair} onDone={handleDealingDone} />
        )}
        {phase === 'playing' && (
          <PlayingPhase
            players={players}
            gameMode={gameMode}
            wordPair={wordPair}
            onRevealRoles={handleRevealRoles}
          />
        )}
        {phase === 'results' && (
          <ResultsPhase
            players={players}
            gameMode={gameMode}
            wordPair={wordPair}
            manualReveal={manualReveal}
            onPlayAgain={handlePlayAgain}
            onHome={handleHome}
          />
        )}
      </main>
    </div>
  )
}
