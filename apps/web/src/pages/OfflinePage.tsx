import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { WORD_CATEGORIES, shuffleArray, OFFLINE_WORD_PAIRS, pickRandomWordPair } from '@imposter/shared'
import type { WordCategory } from '@imposter/shared'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'dealing' | 'playing' | 'results'
type GameMode = 'normal' | 'special'

// All role types available in offline pass-and-play. Mechanics with special
// runtime requirements (kamikaze drag-down, corruptor silent drop, inverter
// vote flip, revenant post-death votes, evil twins paired win) are documented
// on the role card and resolved manually by the players.
type PlayerRoleType =
  | 'villager'
  | 'imposter'
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
  | 'twinImposter'

interface PlayerRole {
  name: string
  role: PlayerRoleType
  word: string
  isEliminated: boolean
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
  evilTwins: number // 0 or 1: enables the paired twin_villager + twin_imposter duo
}

interface GameSettings {
  names: string[]
  imposterCount: number
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
    imposter:     { label: t('offline.imposter'),                         icon: '🔴', color: 'red',     bgClass: 'bg-red-950/70',     borderClass: 'border-red-700/60',     textClass: 'text-red-400',     badgeClass: 'text-red-500' },
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
    twinImposter: { label: t('offline.twinImposter', 'Imposter Twin'),    icon: '👯', color: 'purple',  bgClass: 'bg-purple-950/70',  borderClass: 'border-purple-700/60',  textClass: 'text-purple-300', badgeClass: 'text-purple-500' },
  }
}

// Imposter-side roles play for the imposter team (know the imposter word).
const EVIL_ROLES: PlayerRoleType[] = [
  'imposter', 'doubleAgent', 'infiltrator', 'kamikaze', 'corruptor', 'inverter', 'twinImposter',
]

function isEvilRole(role: PlayerRoleType) {
  return EVIL_ROLES.includes(role)
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
    imposterCount: number,
    counts: SpecialRoleCounts,
    categories: WordCategory[],
    gameMode: GameMode,
  ) => void
}

function SetupPhase({ initialSettings, onStart }: SetupPhaseProps) {
  const { t, i18n } = useTranslation()
  const [names, setNames] = useState<string[]>(initialSettings?.names ?? ['', '', ''])
  const [imposterCount, setImposterCount] = useState(initialSettings?.imposterCount ?? 1)
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

  // Cap imposter count to floor(N/3) so imposters never exceed 1/3 of players.
  // Examples: 3p→1, 4p→1, 5p→1, 6p→2, 9p→3, 12p→4. Always at least 1.
  const maxImposters = Math.max(1, Math.floor(filledCount / 3))

  // Auto-adjust imposter count to stay within the 1/3 rule whenever the
  // player count changes (even when replaying with previous settings).
  useEffect(() => {
    if (imposterCount > maxImposters) {
      setImposterCount(maxImposters)
    }
  }, [filledCount, maxImposters])

  // In special mode the full imposter side (imposter + all imposter-aligned
  // special roles) must respect the ≤ 1/3 rule. Decrease the side roles
  // whenever the cap is breached.
  useEffect(() => {
    const evilCap = Math.max(1, Math.floor(filledCount / 3))
    const evilExtras =
      doubleAgentCount + infiltratorCount + kamikazeCount +
      corruptorCount + inverterCount + evilTwinsCount
    const excess = Math.max(0, imposterCount + evilExtras - evilCap)
    if (excess > 0) {
      // Reduce in reverse priority order: evilTwins → inverter → corruptor →
      // kamikaze → infiltrator → doubleAgent (preserve the baseline imposters).
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
    filledCount, imposterCount, doubleAgentCount, infiltratorCount,
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
    onStart(validNames, imposterCount, specialCounts, categories, gameMode)
  }

  // Evil-team cap: imposter + all imposter-aligned special roles ≤ floor(N/3).
  // Evil Twins takes 1 slot on each side (twin_imposter + twin_villager).
  const evilTeamCap = Math.max(1, Math.floor(filledCount / 3))
  const evilExtras =
    doubleAgentCount + infiltratorCount + kamikazeCount +
    corruptorCount + inverterCount + evilTwinsCount
  const currentEvil = imposterCount + evilExtras
  const evilHeadroom = Math.max(0, evilTeamCap - currentEvil)

  const maxDoubleAgents = Math.min(2, doubleAgentCount + evilHeadroom)
  const maxInfiltrators = Math.min(2, infiltratorCount + evilHeadroom)
  const maxKamikaze     = Math.min(2, kamikazeCount    + evilHeadroom)
  const maxCorruptor    = Math.min(1, corruptorCount   + evilHeadroom)
  const maxInverter     = Math.min(1, inverterCount    + evilHeadroom)

  // Villager-side special slots. Must leave at least 1 pure villager AND the
  // twin_villager slot that the Evil Twins pair reserves.
  const currentGoodSpecial =
    detectiveCount + guardianCount + mayorCount + judgeCount + revenantCount
  const slotsUsed = currentEvil + currentGoodSpecial + evilTwinsCount // +twinVillager
  const goodHeadroom = Math.max(0, filledCount - slotsUsed - 1)

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
      <div className="text-center">
        <div className="text-5xl mb-3">🎭</div>
        <h1 className="text-3xl font-extrabold text-white mb-1">{t('offline.title')}</h1>
        <p className="text-brand-400 font-semibold text-lg">{t('offline.passAndPlay')}</p>
        <p className="text-neutral-500 text-sm mt-2">{t('offline.noInternet')}</p>
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

      {/* Imposter count */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
          {t('offline.imposterCount')}
        </p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => {
            const allowed = n <= maxImposters
            return (
              <button
                key={n}
                onClick={() => { if (allowed) setImposterCount(n) }}
                disabled={!allowed}
                className={[
                  'flex-1 py-3 rounded-xl border font-bold text-lg transition-all',
                  !allowed
                    ? 'bg-neutral-900/40 border-neutral-800/40 text-neutral-700 cursor-not-allowed opacity-40'
                    : imposterCount === n
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

          {/* Imposter side */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
              🔴 {t('offline.teamImposters', 'Imposters')}
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
              description={t('offline.htpInfiltratorDesc', 'Knows the villager word but plays for the imposters. Appears as villager to the detective.')}
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
              description={t('offline.htpEvilTwinsDesc', 'A linked pair (one villager, one imposter) who win together if both survive. Counts as 2 players.')}
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
              <span className="text-red-400 font-semibold">{t('offline.imposter')}</span>
              <span className="text-neutral-500">— {t('offline.htpImposterDesc')}</span>
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

          {/* 🔴 Imposters */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
              🔴 {t('offline.teamImposters', 'Imposters')}
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

        <div className="border-t border-neutral-800/60" />

        {/* How it works */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-neutral-300">{t('offline.htpHowItWorks')}</p>
          <ol className="space-y-1 ml-1 list-decimal list-inside text-xs text-neutral-500 leading-relaxed">
            <li>{t('offline.htpStep1')}</li>
            <li>{t('offline.htpStep2')}</li>
            <li>{t('offline.htpStep3')}</li>
            <li>{t('offline.htpStep4')}</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-component: Dealing Phase ────────────────────────────────────────────

interface DealingPhaseProps {
  players: PlayerRole[]
  gameMode: GameMode
  wordPair: { villagerWord: string; imposterWord: string }
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
    setTimeout(() => setRevealed(true), 50)
  }

  const handleGotIt = () => {
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
      case 'imposter':     return t('offline.roleInstructionImposter')
      case 'villager':     return t('offline.roleInstructionVillager')
      case 'detective':    return t('offline.roleInstructionDetective')
      case 'doubleAgent':  return t('offline.roleInstructionDoubleAgent')
      case 'guardian':     return t('offline.roleInstructionGuardian')
      case 'mayor':        return t('offline.roleInstructionMayor',        'You are the Mayor. Your vote counts double during the voting phase — announce it clearly when voting.')
      case 'judge':        return t('offline.roleInstructionJudge',        'You are the Judge. If a vote ends in a tie, you pick who gets eliminated — but you cannot save yourself.')
      case 'revenant':     return t('offline.roleInstructionRevenant',     'You are the Revenant. If you get voted out, you still cast votes for the next 2 rounds (announce a player when eliminated).')
      case 'infiltrator':  return t('offline.roleInstructionInfiltrator',  'You are the Infiltrator. You know the VILLAGER word but you play for the imposters. Blend in and help them win — you look like a villager to the Detective.')
      case 'jester':       return t('offline.roleInstructionJester',       'You are the Jester. You win alone if the group votes you out. Act suspicious without being too obvious.')
      case 'kamikaze':     return t('offline.roleInstructionKamikaze',     'You are a Kamikaze imposter. If you get voted out, pick one player to take down with you — they are eliminated too.')
      case 'corruptor':    return t('offline.roleInstructionCorruptor',    'You are the Corruptor. At game start, secretly pick one target — their votes don\'t count until you are eliminated.')
      case 'inverter':     return t('offline.roleInstructionInverter',     'You are the Inverter. Once per game, before a vote is tallied, call "Invert!" — the player with the FEWEST votes is eliminated instead.')
      case 'twinVillager': return t('offline.roleInstructionTwinVillager', 'You are the Villager Twin. You and the Imposter Twin win together if both survive — find your twin without getting caught.')
      case 'twinImposter': return t('offline.roleInstructionTwinImposter', 'You are the Imposter Twin. You and the Villager Twin win together if both survive — protect your twin.')
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
          <div className="text-6xl">🤲</div>
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
            'w-full max-w-sm mx-auto transition-all duration-500',
            revealed ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
          ].join(' ')}
        >
          <div className={`rounded-3xl border-2 p-8 text-center space-y-6 shadow-2xl ${cardBg} ${cardBorder} ${cardShadow}`}>
            <div className="text-6xl">{rc.icon}</div>

            <div>
              <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${rc.badgeClass}`}>
                {t('offline.yourRole')}
              </p>
              <p className={`text-2xl font-extrabold ${rc.textClass}`}>
                {rc.label}
              </p>
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
                    {t('offline.imposterWord')}
                  </p>
                  <p className="text-2xl font-black tracking-tight text-red-300 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
                    {wordPair.imposterWord}
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
            return 0
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

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">{t('offline.speakingTimer')}</p>

      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 shrink-0">
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
  alivePlayers: PlayerRole[]
  detectiveUsedSet: Set<string>
  revealedRoles: Record<string, PlayerRoleType>
  protectedPlayers: Set<string>
  onDetectiveReveal: (detectiveName: string, targetName: string, targetRole: PlayerRoleType) => void
  onGuardianProtect: (guardianName: string, targetName: string) => void
  onVotesDone: (votes: VoteRecord[], eliminated: PlayerRole | null) => void
  onCancel: () => void
}

type VoteStep = 'pass' | 'voting'

function VotePhase({ alivePlayers, detectiveUsedSet, revealedRoles, protectedPlayers, onDetectiveReveal, onGuardianProtect, onVotesDone, onCancel }: VotePhaseProps) {
  const { t } = useTranslation()
  const ROLES = getRoleConfig(t)
  const [voterIndex, setVoterIndex] = useState(0)
  const [step, setStep] = useState<VoteStep>('pass')
  const [votes, setVotes] = useState<VoteRecord[]>([])
  // Track which guardians have protected this round (within VotePhase)
  const [guardianProtectedThisRound, setGuardianProtectedThisRound] = useState<Set<string>>(new Set())

  const voter = alivePlayers[voterIndex]

  const isDetective = voter?.role === 'detective'
  const isGuardian = voter?.role === 'guardian'
  const canInvestigate = isDetective && !detectiveUsedSet.has(voter.name)
  const canProtect = isGuardian && !guardianProtectedThisRound.has(voter.name)

  const castVote = (targetName: string) => {
    const newVotes = [...votes, { voterName: voter.name, targetName }]
    const nextIndex = voterIndex + 1

    if (nextIndex >= alivePlayers.length) {
      const tally: Record<string, number> = {}
      for (const v of newVotes) {
        tally[v.targetName] = (tally[v.targetName] ?? 0) + 1
      }
      const maxVotes = Math.max(...Object.values(tally))
      const topCandidates = Object.entries(tally).filter(([, c]) => c === maxVotes).map(([n]) => n)
      if (topCandidates.length > 1) {
        onVotesDone(newVotes, null)
      } else {
        const eliminated = alivePlayers.find((p) => p.name === topCandidates[0]) ?? null
        onVotesDone(newVotes, eliminated)
      }
    } else {
      setVotes(newVotes)
      setVoterIndex(nextIndex)
      setStep('pass')
    }
  }

  const handleDetectiveInvestigate = (target: PlayerRole) => {
    onDetectiveReveal(voter.name, target.name, target.role)
  }

  const handleGuardianProtect = (targetName: string) => {
    onGuardianProtect(voter.name, targetName)
    setGuardianProtectedThisRound((prev) => new Set(prev).add(voter.name))
  }

  const otherPlayers = alivePlayers.filter((p) => p.name !== voter.name)

  const voterRoleInfo = voter ? ROLES[voter.role] : null

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="text-center">
        <p className="text-neutral-400 text-sm mb-1">
          {t('offline.voteOf', { current: voterIndex + 1, total: alivePlayers.length })}
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
      </div>

      {step === 'pass' ? (
        <div className="text-center space-y-5 py-6">
          <div className="text-5xl">🤲</div>
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
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
              {t('offline.whoIsImposter', { name: voter.name })}
            </p>
            <div className="space-y-2">
              {otherPlayers.map((p) => {
                const revealed = revealedRoles[p.name]
                const revealedRc = revealed ? ROLES[revealed] : null
                return (
                  <div
                    key={p.name}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-800/60 border border-neutral-700/40"
                  >
                    <span className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-base shrink-0">
                      {p.name[0].toUpperCase()}
                    </span>
                    <span className="text-white text-sm font-semibold flex-1 min-w-0 truncate">
                      {p.name}
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

      <button
        onClick={onCancel}
        className="w-full py-2.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700/40 text-neutral-500 hover:text-neutral-300 text-sm font-semibold transition-all"
      >
        {t('offline.cancelVote')}
      </button>
    </div>
  )
}

// ─── Sub-component: Vote Result ───────────────────────────────────────────────

interface VoteResultProps {
  votes: VoteRecord[]
  eliminated: PlayerRole | null
  protectedPlayerName?: string | null
  onContinue: () => void
}

function VoteResult({ votes, eliminated, protectedPlayerName, onContinue }: VoteResultProps) {
  const { t } = useTranslation()
  const ROLES = getRoleConfig(t)
  const tally: Record<string, number> = {}
  for (const v of votes) {
    tally[v.targetName] = (tally[v.targetName] ?? 0) + 1
  }
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])

  const eliminatedRc = eliminated ? ROLES[eliminated.role] : null

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="text-center space-y-2">
        {protectedPlayerName ? (
          <>
            <div className="text-4xl">🛡️</div>
            <h2 className="text-xl font-extrabold text-yellow-400">
              {t('offline.protectionTriggered', { name: protectedPlayerName })}
            </h2>
          </>
        ) : (
          <>
            <div className="text-4xl">{eliminated ? '🗳️' : '🤷'}</div>
            <h2 className="text-xl font-extrabold text-white">
              {eliminated ? t('offline.wasEliminated', { name: eliminated.name }) : t('offline.noOneEliminated')}
            </h2>
            {eliminated && eliminatedRc && (
              <p className={`text-sm font-semibold ${eliminatedRc.textClass}`}>
                {t('offline.theyWere')} {eliminatedRc.icon} {eliminatedRc.label}
              </p>
            )}
          </>
        )}
      </div>

      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">{t('offline.voteTally')}</p>
        {sorted.map(([name, count]) => (
          <div key={name} className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white w-28 truncate">{name}</span>
            <div className="flex-1 bg-neutral-800 rounded-full h-2">
              <div
                className={[
                  'h-2 rounded-full transition-all',
                  eliminated?.name === name ? 'bg-red-500' : 'bg-neutral-600',
                ].join(' ')}
                style={{ width: `${(count / votes.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-neutral-400 w-6 text-right">{count}</span>
          </div>
        ))}
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
  wordPair: { villagerWord: string; imposterWord: string }
  onRevealRoles: (updatedPlayers: PlayerRole[]) => void
}

type PlayingSubPhase = 'main' | 'voting' | 'voteResult'

function PlayingPhase({ players: initialPlayers, gameMode, wordPair, onRevealRoles }: PlayingPhaseProps) {
  const { t } = useTranslation()
  const [players, setPlayers] = useState<PlayerRole[]>(initialPlayers)
  const [subPhase, setSubPhase] = useState<PlayingSubPhase>('main')
  const [lastVotes, setLastVotes] = useState<VoteRecord[]>([])
  const [lastEliminated, setLastEliminated] = useState<PlayerRole | null>(null)

  // Detective state: once per game per detective, revealed roles persist across rounds
  const [detectiveUsedSet, setDetectiveUsedSet] = useState<Set<string>>(new Set())
  const [revealedRoles, setRevealedRoles] = useState<Record<string, PlayerRoleType>>({})

  // Guardian state: resets each round
  const [protectedPlayers, setProtectedPlayers] = useState<Set<string>>(new Set())
  const [protectionTriggeredName, setProtectionTriggeredName] = useState<string | null>(null)

  const alivePlayers = players.filter((p) => !p.isEliminated)

  const handleStartVote = () => {
    setProtectedPlayers(new Set())
    setSubPhase('voting')
  }

  const handleDetectiveReveal = (detectiveName: string, targetName: string, targetRole: PlayerRoleType) => {
    setDetectiveUsedSet((prev) => new Set(prev).add(detectiveName))
    setRevealedRoles((prev) => ({ ...prev, [targetName]: targetRole }))
  }

  const handleGuardianProtect = (_guardianName: string, targetName: string) => {
    setProtectedPlayers((prev) => new Set(prev).add(targetName))
  }

  const handleVotesDone = (votes: VoteRecord[], eliminated: PlayerRole | null) => {
    setLastVotes(votes)
    if (eliminated && protectedPlayers.has(eliminated.name)) {
      setLastEliminated(null)
      setProtectionTriggeredName(eliminated.name)
    } else {
      setLastEliminated(eliminated)
      setProtectionTriggeredName(null)
      if (eliminated) {
        setPlayers((prev) =>
          prev.map((p) => (p.name === eliminated.name ? { ...p, isEliminated: true } : p)),
        )
      }
    }
    setSubPhase('voteResult')
  }

  const handleContinueAfterVote = () => {
    setProtectedPlayers(new Set())
    setProtectionTriggeredName(null)

    // Check win conditions
    const updatedPlayers = players // players state already updated in handleVotesDone
    const alive = updatedPlayers.filter((p) => !p.isEliminated)
    const aliveEvil = alive.filter((p) => isEvilRole(p.role))
    const aliveGood = alive.filter((p) => !isEvilRole(p.role))

    if (aliveEvil.length === 0) {
      // All imposters/double agents eliminated — villagers win
      onRevealRoles(updatedPlayers)
      return
    }
    if (aliveEvil.length >= aliveGood.length) {
      // Evil team equals or outnumbers village — imposters win
      onRevealRoles(updatedPlayers)
      return
    }

    setSubPhase('main')
  }

  if (subPhase === 'voting') {
    return (
      <VotePhase
        alivePlayers={alivePlayers}
        detectiveUsedSet={detectiveUsedSet}
        revealedRoles={revealedRoles}
        protectedPlayers={protectedPlayers}
        onDetectiveReveal={handleDetectiveReveal}
        onGuardianProtect={handleGuardianProtect}
        onVotesDone={handleVotesDone}
        onCancel={() => setSubPhase('main')}
      />
    )
  }

  if (subPhase === 'voteResult') {
    return (
      <VoteResult
        votes={lastVotes}
        eliminated={lastEliminated}
        protectedPlayerName={protectionTriggeredName}
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
          onClick={() => onRevealRoles(players)}
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
  wordPair: { villagerWord: string; imposterWord: string }
  onPlayAgain: () => void
  onHome: () => void
}

function ResultsPhase({ players, gameMode, wordPair, onPlayAgain, onHome }: ResultsPhaseProps) {
  const { t } = useTranslation()
  const ROLES = getRoleConfig(t)
  // All imposter-side roles (including special imposter roles) count as "evil"
  // for the win check. The villagers win iff every evil player is eliminated.
  const evilTeam = players.filter((p) => isEvilRole(p.role))
  const eliminatedEvil = evilTeam.filter((p) => p.isEliminated)
  const impostersWon = eliminatedEvil.length < evilTeam.length

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="text-6xl">🎭</div>
        <h1 className="text-3xl font-extrabold text-white">{t('offline.gameOver')}</h1>
        <div className={[
          'inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold',
          impostersWon
            ? 'bg-red-950/60 border-red-700/50 text-red-400'
            : 'bg-emerald-950/60 border-emerald-700/50 text-emerald-400',
        ].join(' ')}>
          {impostersWon ? `🔴 ${t('offline.impostersWin')}` : `🟢 ${t('offline.villagersWin')}`}
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1">{t('offline.imposterWord')}</p>
            <p className="text-lg font-extrabold text-red-300">{wordPair.imposterWord}</p>
          </div>
        </div>
      </div>

      {/* Role legend for special mode */}
      {gameMode === 'special' && (
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">{t('offline.roleLegend')}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2"><span>🟢</span><span className="text-emerald-400">{t('offline.villager')}</span></div>
            <div className="flex items-center gap-2"><span>🔴</span><span className="text-red-400">{t('offline.imposter')}</span></div>
            <div className="flex items-center gap-2"><span>🔍</span><span className="text-blue-400">{t('offline.detective')}</span></div>
            <div className="flex items-center gap-2"><span>🕵️</span><span className="text-amber-400">{t('offline.doubleAgent')}</span></div>
            <div className="flex items-center gap-2"><span>🛡️</span><span className="text-yellow-400">{t('offline.guardian')}</span></div>
          </div>
        </div>
      )}

      {/* All players with roles */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">{t('offline.allRoles')}</p>
        {players.map((p) => {
          const rc = ROLES[p.role]
          const evil = isEvilRole(p.role)
          return (
            <div
              key={p.name}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border',
                evil
                  ? 'bg-red-950/30 border-red-800/30'
                  : p.role === 'detective'
                    ? 'bg-blue-950/20 border-blue-800/20'
                    : p.role === 'guardian'
                    ? 'bg-yellow-950/20 border-yellow-800/20'
                    : 'bg-emerald-950/20 border-emerald-800/20',
              ].join(' ')}
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
  const [wordPair, setWordPair] = useState<{ villagerWord: string; imposterWord: string }>({
    villagerWord: '',
    imposterWord: '',
  })
  // Persist settings across Play Again
  const [lastSettings, setLastSettings] = useState<GameSettings | null>(null)

  const handleStart = useCallback(
    (
      names: string[],
      imposterCount: number,
      counts: SpecialRoleCounts,
      categories: WordCategory[],
      mode: GameMode,
    ) => {
      // Save settings for Play Again
      setLastSettings({
        names,
        imposterCount,
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
      // Randomly swap which word goes to villagers vs imposters
      const pair = Math.random() < 0.5
        ? { villagerWord: rawPair.imposterWord, imposterWord: rawPair.villagerWord }
        : rawPair
      const playerOrder = shuffleArray([...names])

      let roles: PlayerRole[]

      if (mode === 'special') {
        // Build a queue of roles in a fixed team order, then assign to players.
        // Imposter side first (they get the imposter word except infiltrator),
        // then villager side (villager word), then neutral.
        const queue: PlayerRoleType[] = []
        for (let i = 0; i < imposterCount;       i++) queue.push('imposter')
        for (let i = 0; i < counts.doubleAgent;  i++) queue.push('doubleAgent')
        for (let i = 0; i < counts.infiltrator;  i++) queue.push('infiltrator')
        for (let i = 0; i < counts.kamikaze;     i++) queue.push('kamikaze')
        for (let i = 0; i < counts.corruptor;    i++) queue.push('corruptor')
        for (let i = 0; i < counts.inverter;     i++) queue.push('inverter')
        if (counts.evilTwins > 0) {
          queue.push('twinImposter')
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
          // Imposter word: imposter, double_agent, kamikaze, corruptor, inverter, twin_imposter
          // Villager word: everything else (including infiltrator — that's the twist)
          const getsImposterWord =
            role === 'imposter' ||
            role === 'doubleAgent' ||
            role === 'kamikaze' ||
            role === 'corruptor' ||
            role === 'inverter' ||
            role === 'twinImposter'
          return {
            name,
            role,
            word: getsImposterWord ? pair.imposterWord : pair.villagerWord,
            isEliminated: false,
          }
        })
      } else {
        // Normal mode
        roles = playerOrder.map((name, i) => ({
          name,
          role: (i < imposterCount ? 'imposter' : 'villager') as PlayerRoleType,
          word: i < imposterCount ? pair.imposterWord : pair.villagerWord,
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

  const handleRevealRoles = useCallback((updatedPlayers: PlayerRole[]) => {
    setPlayers(updatedPlayers)
    setPhase('results')
  }, [])

  const handlePlayAgain = useCallback(() => {
    setPhase('setup')
    setPlayers([])
    setWordPair({ villagerWord: '', imposterWord: '' })
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
            onPlayAgain={handlePlayAgain}
            onHome={handleHome}
          />
        )}
      </main>
    </div>
  )
}
