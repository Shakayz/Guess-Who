import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { HapticManager } from '../lib/haptics'
import { SoundManager } from '../lib/sounds'
import {
  WORD_CATEGORIES,
  shuffleArray,
  pickRandomWordPair,
  OFFLINE_ROLE_REGISTRY,
  EVIL_OFFLINE_ROLES,
  isEvilOfflineRole,
  REVENANT_POST_DEATH_ROUNDS,
  VILLAGER_OFFLINE_ROLES,
  RED_HANDED_OFFLINE_ROLES,
  NEUTRAL_OFFLINE_ROLES,
  ZERO_SPECIAL_COUNTS,
  autoReduceOverflow,
  clampRedHandedCount,
  computeMaxRoleCounts,
  finalizeRound as finalizeVoteRound,
  getDefaultRedHandedCount,
  isNeutralUnlocked,
  maxRedHandedFor,
} from '@red-handed/shared'
import type {
  WordCategory,
  OfflineRole,
  OfflineRoleColor,
  SpecialRoleCounts,
  VoteRecord,
} from '@red-handed/shared'
import { useResponsive } from '../lib/responsive'
import { LanguagePicker } from '../components/LanguagePicker'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'dealing' | 'playing' | 'results'
type GameMode = 'normal' | 'special'
type SubPhase = 'main' | 'voting' | 'voteResult' | 'kamikazeDrag' | 'judgeTieBreak'
type VoteStep = 'pass' | 'voting'

interface OfflinePlayer {
  name: string
  role: OfflineRole
  word: string
  isEliminated: boolean
  /** Set when a Jester wins by being voted out (or dragged down). */
  jesterWon?: boolean
  /** For Evil Twins: the name of their twin partner. */
  twinPartner?: string
}

interface JudgeTiePending {
  judge: OfflinePlayer
  candidates: string[]
  votes: VoteRecord[]
}

// ─── Color tokens → NativeWind classes ──────────────────────────────────────
//
// The shared role registry stores a `colorToken` (one of 12 Tailwind palette
// names). This map turns that token into the small set of NativeWind classes
// the offline screen needs for cards, badges, and accents. Keeping the
// resolution table local lets the shared package stay UI-framework agnostic.

interface RoleColorClasses {
  bg: string
  border: string
  text: string
  textSoft: string
  badge: string
  accentBar: string
  buttonBg: string
}

const ROLE_COLOR_CLASSES: Record<OfflineRoleColor, RoleColorClasses> = {
  emerald: {
    bg: 'bg-emerald-950/70',
    border: 'border-emerald-700/60',
    text: 'text-emerald-300',
    textSoft: 'text-emerald-400',
    badge: 'text-emerald-500',
    accentBar: 'bg-emerald-500',
    buttonBg: 'bg-emerald-700',
  },
  red: {
    bg: 'bg-red-950/70',
    border: 'border-red-700/60',
    text: 'text-red-300',
    textSoft: 'text-red-400',
    badge: 'text-red-500',
    accentBar: 'bg-red-500',
    buttonBg: 'bg-red-700',
  },
  blue: {
    bg: 'bg-blue-950/70',
    border: 'border-blue-700/60',
    text: 'text-blue-300',
    textSoft: 'text-blue-400',
    badge: 'text-blue-500',
    accentBar: 'bg-blue-500',
    buttonBg: 'bg-blue-700',
  },
  amber: {
    bg: 'bg-amber-950/70',
    border: 'border-amber-700/60',
    text: 'text-amber-300',
    textSoft: 'text-amber-400',
    badge: 'text-amber-500',
    accentBar: 'bg-amber-500',
    buttonBg: 'bg-amber-700',
  },
  yellow: {
    bg: 'bg-yellow-950/70',
    border: 'border-yellow-700/60',
    text: 'text-yellow-300',
    textSoft: 'text-yellow-400',
    badge: 'text-yellow-500',
    accentBar: 'bg-yellow-500',
    buttonBg: 'bg-yellow-700',
  },
  indigo: {
    bg: 'bg-indigo-950/70',
    border: 'border-indigo-700/60',
    text: 'text-indigo-300',
    textSoft: 'text-indigo-400',
    badge: 'text-indigo-500',
    accentBar: 'bg-indigo-500',
    buttonBg: 'bg-indigo-700',
  },
  teal: {
    bg: 'bg-teal-950/70',
    border: 'border-teal-700/60',
    text: 'text-teal-300',
    textSoft: 'text-teal-400',
    badge: 'text-teal-500',
    accentBar: 'bg-teal-500',
    buttonBg: 'bg-teal-700',
  },
  fuchsia: {
    bg: 'bg-fuchsia-950/70',
    border: 'border-fuchsia-700/60',
    text: 'text-fuchsia-300',
    textSoft: 'text-fuchsia-400',
    badge: 'text-fuchsia-500',
    accentBar: 'bg-fuchsia-500',
    buttonBg: 'bg-fuchsia-700',
  },
  pink: {
    bg: 'bg-pink-950/70',
    border: 'border-pink-700/60',
    text: 'text-pink-300',
    textSoft: 'text-pink-400',
    badge: 'text-pink-500',
    accentBar: 'bg-pink-500',
    buttonBg: 'bg-pink-700',
  },
  orange: {
    bg: 'bg-orange-950/70',
    border: 'border-orange-700/60',
    text: 'text-orange-300',
    textSoft: 'text-orange-400',
    badge: 'text-orange-500',
    accentBar: 'bg-orange-500',
    buttonBg: 'bg-orange-700',
  },
  rose: {
    bg: 'bg-rose-950/70',
    border: 'border-rose-700/60',
    text: 'text-rose-300',
    textSoft: 'text-rose-400',
    badge: 'text-rose-500',
    accentBar: 'bg-rose-500',
    buttonBg: 'bg-rose-700',
  },
  purple: {
    bg: 'bg-purple-950/70',
    border: 'border-purple-700/60',
    text: 'text-purple-300',
    textSoft: 'text-purple-400',
    badge: 'text-purple-500',
    accentBar: 'bg-purple-500',
    buttonBg: 'bg-purple-700',
  },
}

function colorsFor(role: OfflineRole): RoleColorClasses {
  return ROLE_COLOR_CLASSES[OFFLINE_ROLE_REGISTRY[role].colorToken]
}

function roleLabel(t: (key: string, opts?: any) => string, role: OfflineRole): string {
  const def = OFFLINE_ROLE_REGISTRY[role]
  // Default values mirror the web fallbacks so missing keys still read.
  return t(def.i18nLabelKey, { defaultValue: role })
}

function roleInstruction(t: (key: string, opts?: any) => string, role: OfflineRole): string {
  const def = OFFLINE_ROLE_REGISTRY[role]
  return t(def.i18nInstructionKey, { defaultValue: '' })
}

/**
 * On the reveal card, clarify which base team a *special* role plays for —
 * e.g. a Mayor is still a Villager, a Corruptor is still an RedHanded. Returns
 * `null` for roles where this would be redundant (villager/redHanded) or
 * misleading (jester is solo, twins win as a pair).
 */
function getBaseTeamForReveal(role: OfflineRole): 'villager' | 'red_handed' | null {
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

// ─── RoleStepper ─────────────────────────────────────────────────────────────

const STEPPER_ACCENT = {
  emerald: { chip: 'bg-emerald-950/40 border-emerald-700/40', text: 'text-emerald-300' },
  red:     { chip: 'bg-red-950/40 border-red-700/40',         text: 'text-red-300' },
  sky:     { chip: 'bg-sky-950/40 border-sky-700/40',         text: 'text-sky-300' },
  purple:  { chip: 'bg-purple-950/40 border-purple-700/40',   text: 'text-purple-300' },
} as const
type StepperAccent = keyof typeof STEPPER_ACCENT

function RoleStepper({
  icon,
  label,
  description,
  value,
  min = 0,
  max,
  onChange,
  accent,
  lockedReason,
  fontScale,
}: {
  icon: string
  label: string
  description: string
  value: number
  min?: number
  max: number
  onChange: (v: number) => void
  accent: StepperAccent
  lockedReason?: string | null
  fontScale: number
}) {
  const isLocked = !!lockedReason
  const canDec = !isLocked && value > min
  const canInc = !isLocked && value < max
  const a = STEPPER_ACCENT[accent]
  return (
    <View
      className={[
        'flex-row items-center justify-between gap-3 px-3 py-2 rounded-xl border',
        isLocked
          ? 'bg-neutral-900/40 border-neutral-800/60 opacity-50'
          : 'bg-neutral-900/50 border-neutral-800/60',
      ].join(' ')}
    >
      <View className="flex-row items-center gap-2 flex-1 min-w-0">
        <View
          className={['w-7 h-7 rounded-lg border items-center justify-center', a.chip].join(' ')}
        >
          <Text style={{ fontSize: 14 }}>{icon}</Text>
        </View>
        <View className="flex-1 min-w-0">
          <Text
            className="font-semibold text-white"
            style={{ fontSize: 13 * fontScale }}
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text
            className="text-neutral-500"
            style={{ fontSize: 10 * fontScale }}
            numberOfLines={2}
          >
            {isLocked ? lockedReason : description}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2 shrink-0">
        <TouchableOpacity
          onPress={() => {
            if (canDec) onChange(Math.max(min, value - 1))
          }}
          disabled={!canDec}
          className="w-7 h-7 rounded-lg bg-neutral-800 items-center justify-center"
          style={{ opacity: canDec ? 1 : 0.3 }}
        >
          <Text className="text-white font-bold">−</Text>
        </TouchableOpacity>
        <Text
          className={['font-mono font-bold w-7 text-center', isLocked ? 'text-neutral-600' : a.text].join(' ')}
          style={{ fontSize: 14 * fontScale }}
        >
          {value}
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (canInc) onChange(Math.min(max, value + 1))
          }}
          disabled={!canInc}
          className="w-7 h-7 rounded-lg bg-neutral-800 items-center justify-center"
          style={{ opacity: canInc ? 1 : 0.3 }}
        >
          <Text className="text-white font-bold">+</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── SetupPhase ──────────────────────────────────────────────────────────────

interface PersistedSettings {
  names: string[]
  redHandedCount: number
  counts: SpecialRoleCounts
  categories: WordCategory[]
  gameMode: GameMode
}

function SetupPhase({
  initial,
  onStart,
  onBack,
  isTablet,
  px,
  fontScale,
}: {
  initial: PersistedSettings | null
  onStart: (settings: PersistedSettings) => void
  onBack: () => void
  isTablet: boolean
  px: number
  fontScale: number
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const [names, setNames] = useState<string[]>(initial?.names ?? ['', '', ''])
  const [redHandedCount, setRedHandedCount] = useState(initial?.redHandedCount ?? 1)
  const [counts, setCounts] = useState<SpecialRoleCounts>(initial?.counts ?? { ...ZERO_SPECIAL_COUNTS })
  const [categories, setCategories] = useState<WordCategory[]>(initial?.categories ?? [])
  const [gameMode, setGameMode] = useState<GameMode>(initial?.gameMode ?? 'normal')

  const filledNames = names.filter((n) => n.trim().length > 0)
  const filledCount = filledNames.length
  const minPlayers = gameMode === 'special' ? 5 : 3
  const canStart = filledCount >= minPlayers

  // Auto-grow to 5 slots when switching to special mode
  useEffect(() => {
    if (gameMode === 'special' && names.length < 5) {
      setNames((prev) => [...prev, ...Array(5 - prev.length).fill('')])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode])

  // Clamp redHanded count to 1/3 of players
  useEffect(() => {
    setRedHandedCount((c) => clampRedHandedCount(filledCount, c))
  }, [filledCount])

  // Auto-reduce evil-side specials when over the cap
  useEffect(() => {
    const { counts: next, changed } = autoReduceOverflow(filledCount, redHandedCount, counts)
    if (changed) setCounts(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledCount, redHandedCount, counts.doubleAgent, counts.infiltrator, counts.kamikaze, counts.corruptor, counts.inverter, counts.evilTwins])

  const max = useMemo(
    () => computeMaxRoleCounts(filledCount, redHandedCount, counts),
    [filledCount, redHandedCount, counts],
  )
  const neutralUnlocked = isNeutralUnlocked(filledCount)

  const updateName = (i: number, value: string) =>
    setNames((prev) => prev.map((n, idx) => (idx === i ? value : n)))
  const addPlayer = () => {
    if (names.length < 20) setNames((prev) => [...prev, ''])
  }
  const removePlayer = (i: number) => {
    if (names.length <= 3) return
    setNames((prev) => prev.filter((_, idx) => idx !== i))
  }
  const toggleCategory = (key: WordCategory) =>
    setCategories((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]))
  const setCount = (k: keyof SpecialRoleCounts, v: number) =>
    setCounts((prev) => ({ ...prev, [k]: v }))

  const handleStart = () => {
    const validNames = names.map((n) => n.trim()).filter((n) => n.length > 0)
    if (validNames.length < minPlayers) return
    const finalCounts: SpecialRoleCounts = gameMode === 'special'
      ? counts
      : { ...ZERO_SPECIAL_COUNTS }
    onStart({
      names: validNames,
      redHandedCount: clampRedHandedCount(validNames.length, redHandedCount),
      counts: finalCounts,
      categories,
      gameMode,
    })
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ paddingHorizontal: px, gap: 20 }}>
        {/* Header */}
        <View className="items-center pt-2 pb-1">
          <View className="self-end">
            <LanguagePicker />
          </View>
          <Text style={{ fontSize: isTablet ? 36 : 30 }}>🎭</Text>
          <Text
            className="font-extrabold text-white tracking-tight mt-1"
            style={{ fontSize: (isTablet ? 26 : 22) * fontScale }}
          >
            {t('offline.title', { defaultValue: 'Offline Mode' })}
          </Text>
          <Text
            className="text-violet-400 font-semibold mt-0.5"
            style={{ fontSize: 13 * fontScale }}
          >
            {t('offline.passAndPlay', { defaultValue: 'Pass & Play' })}
          </Text>
        </View>

        {/* Game mode selector */}
        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-3">
          <Text
            className="font-semibold uppercase tracking-widest text-neutral-500"
            style={{ fontSize: 11 * fontScale }}
          >
            {t('offline.gameMode', { defaultValue: 'Game Mode' })}
          </Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setGameMode('normal')}
              className={[
                'flex-1 items-center rounded-xl border-2 py-3 gap-1',
                gameMode === 'normal'
                  ? 'bg-violet-950/60 border-violet-600/60'
                  : 'bg-neutral-800/40 border-neutral-700/40',
              ].join(' ')}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 22 }}>🎲</Text>
              <Text
                className={gameMode === 'normal' ? 'text-violet-300 font-bold' : 'text-neutral-400 font-bold'}
                style={{ fontSize: 13 * fontScale }}
              >
                {t('offline.normal', { defaultValue: 'Normal' })}
              </Text>
              <Text
                className="text-neutral-500 text-center"
                style={{ fontSize: 10 * fontScale }}
                numberOfLines={2}
              >
                {t('offline.normalDesc', { defaultValue: 'Villagers vs redHanded only' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setGameMode('special')}
              className={[
                'flex-1 items-center rounded-xl border-2 py-3 gap-1',
                gameMode === 'special'
                  ? 'bg-amber-950/60 border-amber-600/60'
                  : 'bg-neutral-800/40 border-neutral-700/40',
              ].join(' ')}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 22 }}>⚡</Text>
              <Text
                className={gameMode === 'special' ? 'text-amber-300 font-bold' : 'text-neutral-400 font-bold'}
                style={{ fontSize: 13 * fontScale }}
              >
                {t('offline.special', { defaultValue: 'Special' })}
              </Text>
              <Text
                className="text-neutral-500 text-center"
                style={{ fontSize: 10 * fontScale }}
                numberOfLines={2}
              >
                {t('offline.specialDesc', { defaultValue: 'Add detective, mayor, jester & more' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Players */}
        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-3">
          <Text
            className="font-semibold uppercase tracking-widest text-neutral-500"
            style={{ fontSize: 11 * fontScale }}
          >
            {t('offline.players', { defaultValue: 'Players' })} ({names.length}/20)
          </Text>
          {names.map((name, i) => (
            <View key={i} className="flex-row items-center gap-2">
              <View className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 items-center justify-center">
                <Text className="text-neutral-400 font-bold" style={{ fontSize: 11 * fontScale }}>
                  {i + 1}
                </Text>
              </View>
              <TextInput
                className="flex-1 bg-neutral-800 text-white rounded-xl border border-neutral-700"
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: isTablet ? 12 : 10,
                  fontSize: 14 * fontScale,
                }}
                placeholder={t('offline.playerPlaceholder', { n: i + 1, defaultValue: `Player ${i + 1}` })}
                placeholderTextColor="#525252"
                value={name}
                onChangeText={(v) => updateName(i, v)}
                maxLength={24}
                autoCorrect={false}
                spellCheck={false}
              />
              {names.length > 3 && (
                <TouchableOpacity
                  onPress={() => removePlayer(i)}
                  className="w-8 h-8 rounded-xl bg-neutral-800 border border-neutral-700 items-center justify-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-neutral-400 font-bold">✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {names.length < 20 && (
            <TouchableOpacity
              onPress={addPlayer}
              className="flex-row items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-neutral-700"
              activeOpacity={0.7}
            >
              <Text className="text-violet-400 font-semibold" style={{ fontSize: 13 * fontScale }}>
                + {t('offline.addPlayer', { defaultValue: 'Add Player' })}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* RedHanded count */}
        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text
              className="font-semibold uppercase tracking-widest text-neutral-500"
              style={{ fontSize: 11 * fontScale }}
            >
              {t('offline.redHandedCount', { defaultValue: 'Imposter' })}
            </Text>
            <Text className="text-neutral-600" style={{ fontSize: 10 * fontScale }}>
              {t('offline.suggested', { defaultValue: 'auto' })}: {getDefaultRedHandedCount(filledCount)}
            </Text>
          </View>
          <View className="flex-row gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => {
              const cap = maxRedHandedFor(filledCount)
              const allowed = n <= cap
              const active = redHandedCount === n && allowed
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() => allowed && setRedHandedCount(n)}
                  disabled={!allowed}
                  className={[
                    'flex-1 items-center justify-center rounded-xl border py-3',
                    !allowed
                      ? 'bg-neutral-900/40 border-neutral-800/40 opacity-40'
                      : active
                        ? 'bg-red-950/60 border-red-700/60'
                        : 'bg-neutral-800/60 border-neutral-700/40',
                  ].join(' ')}
                  activeOpacity={0.75}
                >
                  <Text
                    className={active ? 'text-red-400 font-bold' : 'text-neutral-400 font-bold'}
                    style={{ fontSize: 16 * fontScale }}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <Text className="text-neutral-600" style={{ fontSize: 10 * fontScale }}>
            {filledCount >= 6
              ? t('offline.recommendHigh', { defaultValue: 'More redHanded = harder for villagers' })
              : t('offline.recommendLow', { defaultValue: '1 redHanded is recommended for small groups' })}
          </Text>
        </View>

        {/* Special role counts (special mode only) */}
        {gameMode === 'special' && (
          <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-4">
            {/* Villager side */}
            <View className="gap-2">
              <Text className="text-emerald-400 font-semibold uppercase tracking-widest" style={{ fontSize: 10 * fontScale }}>
                🟢 {t('offline.teamVillagers', { defaultValue: 'Villagers' })}
              </Text>
              {VILLAGER_OFFLINE_ROLES.map((r) => {
                const def = OFFLINE_ROLE_REGISTRY[r]
                const k = r as keyof SpecialRoleCounts
                return (
                  <RoleStepper
                    key={r}
                    icon={def.iconEmoji}
                    label={t(def.i18nLabelKey, { defaultValue: r })}
                    description={t(def.i18nDescKey, { defaultValue: '' })}
                    value={counts[k]}
                    max={max[k as keyof typeof max]}
                    onChange={(v) => setCount(k, v)}
                    accent="emerald"
                    fontScale={fontScale}
                  />
                )
              })}
            </View>

            {/* RedHanded side */}
            <View className="gap-2">
              <Text className="text-red-400 font-semibold uppercase tracking-widest" style={{ fontSize: 10 * fontScale }}>
                🔴 {t('offline.teamRedHanded', { defaultValue: 'Imposter' })}
              </Text>
              {RED_HANDED_OFFLINE_ROLES.map((r) => {
                const def = OFFLINE_ROLE_REGISTRY[r]
                const k = r as keyof SpecialRoleCounts
                return (
                  <RoleStepper
                    key={r}
                    icon={def.iconEmoji}
                    label={t(def.i18nLabelKey, { defaultValue: r })}
                    description={t(def.i18nDescKey, { defaultValue: '' })}
                    value={counts[k]}
                    max={max[k as keyof typeof max]}
                    onChange={(v) => setCount(k, v)}
                    accent="red"
                    fontScale={fontScale}
                  />
                )
              })}
            </View>

            {/* Pair */}
            <View className="gap-2">
              <Text className="text-purple-400 font-semibold uppercase tracking-widest" style={{ fontSize: 10 * fontScale }}>
                👯 {t('offline.teamPair', { defaultValue: 'Pair' })}
              </Text>
              <RoleStepper
                icon="👯"
                label={t('offline.evilTwins', { defaultValue: 'Evil Twins' })}
                description={t('offline.htpEvilTwinsDesc', {
                  defaultValue:
                    'A linked pair (one villager, one redHanded) who win together if both survive.',
                })}
                value={counts.evilTwins}
                max={max.evilTwins}
                onChange={(v) => setCount('evilTwins', v)}
                accent="purple"
                fontScale={fontScale}
              />
            </View>

            {/* Neutral */}
            <View className="gap-2">
              <Text className="text-sky-400 font-semibold uppercase tracking-widest" style={{ fontSize: 10 * fontScale }}>
                ⚪ {t('offline.teamNeutral', { defaultValue: 'Neutral' })}
              </Text>
              <RoleStepper
                icon="🃏"
                label={t('offline.jester', { defaultValue: 'Jester' })}
                description={t('offline.htpJesterDesc', {
                  defaultValue: 'Solo role. Wins alone if voted out by the group.',
                })}
                value={counts.jester}
                max={max.jester}
                onChange={(v) => setCount('jester', v)}
                accent="sky"
                lockedReason={
                  neutralUnlocked
                    ? null
                    : t('offline.neutralUnlockHint', { defaultValue: 'Unlocks at 10+ players.' })
                }
                fontScale={fontScale}
              />
            </View>
          </View>
        )}

        {/* Categories */}
        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text
              className="font-semibold uppercase tracking-widest text-neutral-500"
              style={{ fontSize: 11 * fontScale }}
            >
              {t('offline.wordCategories', { defaultValue: 'Categories' })}
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setCategories(WORD_CATEGORIES.map((c) => c.key as WordCategory))}
              >
                <Text className="text-violet-400" style={{ fontSize: 11 * fontScale }}>
                  {t('offline.all', { defaultValue: 'All' })}
                </Text>
              </TouchableOpacity>
              <Text className="text-neutral-700">·</Text>
              <TouchableOpacity onPress={() => setCategories([])}>
                <Text className="text-neutral-500" style={{ fontSize: 11 * fontScale }}>
                  {t('offline.random', { defaultValue: 'Random' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            {WORD_CATEGORIES.map((cat) => {
              const selected = categories.includes(cat.key as WordCategory)
              const isAll = categories.length === 0
              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => toggleCategory(cat.key as WordCategory)}
                  className={[
                    'flex-row items-center gap-1.5 rounded-xl border',
                    selected
                      ? 'bg-violet-900/50 border-violet-600/70'
                      : isAll
                        ? 'bg-neutral-800/50 border-neutral-700/40'
                        : 'bg-neutral-900/40 border-neutral-800/40',
                  ].join(' ')}
                  style={{ paddingHorizontal: isTablet ? 12 : 10, paddingVertical: isTablet ? 8 : 7 }}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 13 * fontScale }}>{cat.icon}</Text>
                  <Text
                    className={[
                      'font-semibold',
                      selected ? 'text-violet-200' : isAll ? 'text-neutral-400' : 'text-neutral-600',
                    ].join(' ')}
                    style={{ fontSize: 12 * fontScale }}
                  >
                    {t(`home.cat.${cat.key}`, { defaultValue: cat.label })}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Start button */}
        <TouchableOpacity
          onPress={handleStart}
          disabled={!canStart}
          className={[
            'rounded-2xl items-center overflow-hidden',
            canStart ? 'bg-violet-600' : 'bg-neutral-800 opacity-50',
          ].join(' ')}
          style={{ paddingVertical: isTablet ? 18 : 16 }}
          activeOpacity={0.8}
        >
          <Text
            className={canStart ? 'text-white font-extrabold tracking-wide' : 'text-neutral-500 font-extrabold'}
            style={{ fontSize: 16 * fontScale }}
          >
            {canStart
              ? t('offline.startGame', { defaultValue: 'Start Game' })
              : t('offline.needPlayers', {
                  count: minPlayers,
                  filled: filledCount,
                  defaultValue: `Need at least ${minPlayers} players (${filledCount}/${minPlayers})`,
                })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onBack}
          className="rounded-2xl items-center border border-neutral-800 bg-neutral-900"
          style={{ paddingVertical: isTablet ? 14 : 12 }}
          activeOpacity={0.7}
        >
          <Text className="text-neutral-400 font-semibold" style={{ fontSize: 14 * fontScale }}>
            {t('common.back', { defaultValue: 'Back to Home' })}
          </Text>
        </TouchableOpacity>

        {/* How to Play link */}
        <TouchableOpacity
          onPress={() => router.push('/how-to-play')}
          className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-neutral-800/60 border border-neutral-700/50"
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 14 }}>📖</Text>
          <Text className="text-neutral-400 font-medium" style={{ fontSize: 13 * fontScale }}>
            {t('howToPlay.title', { defaultValue: 'How to Play' })}
          </Text>
        </TouchableOpacity>

        {/* Role guide (special mode) */}
        {gameMode === 'special' && (
          <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-4">
            <Text className="font-semibold uppercase tracking-widest text-neutral-500" style={{ fontSize: 11 * fontScale }}>
              {t('offline.roleGuide', { defaultValue: 'Role Guide' })}
            </Text>

            {/* Villager roles */}
            <View className="gap-2">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                🟢 {t('offline.teamVillagers', { defaultValue: 'Villagers' })}
              </Text>
              {VILLAGER_OFFLINE_ROLES.map((r) => {
                const def = OFFLINE_ROLE_REGISTRY[r]
                return (
                  <View key={r} className="flex-row items-start gap-2.5 px-3 py-2.5 rounded-xl border border-emerald-800/40 bg-neutral-900/40">
                    <Text style={{ fontSize: 16, marginTop: 1 }}>{def.iconEmoji}</Text>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-emerald-300">{t(def.i18nLabelKey)}</Text>
                      <Text className="text-[11px] text-neutral-500 mt-0.5 leading-[15px]">{t(def.i18nDescKey)}</Text>
                    </View>
                  </View>
                )
              })}
            </View>

            {/* RedHanded roles */}
            <View className="gap-2">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
                🔴 {t('offline.teamRedHanded', { defaultValue: 'Imposter' })}
              </Text>
              {RED_HANDED_OFFLINE_ROLES.map((r) => {
                const def = OFFLINE_ROLE_REGISTRY[r]
                return (
                  <View key={r} className="flex-row items-start gap-2.5 px-3 py-2.5 rounded-xl border border-red-800/40 bg-neutral-900/40">
                    <Text style={{ fontSize: 16, marginTop: 1 }}>{def.iconEmoji}</Text>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-red-300">{t(def.i18nLabelKey)}</Text>
                      <Text className="text-[11px] text-neutral-500 mt-0.5 leading-[15px]">{t(def.i18nDescKey)}</Text>
                    </View>
                  </View>
                )
              })}
            </View>

            {/* Pair */}
            <View className="gap-2">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                ⚖️ {t('offline.teamPair', { defaultValue: 'Pair' })}
              </Text>
              <View className="flex-row items-start gap-2.5 px-3 py-2.5 rounded-xl border border-amber-800/40 bg-neutral-900/40">
                <Text style={{ fontSize: 16, marginTop: 1 }}>👯</Text>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-amber-300">{t('offline.evilTwins', { defaultValue: 'Evil Twins' })}</Text>
                  <Text className="text-[11px] text-neutral-500 mt-0.5 leading-[15px]">{t('offline.htpEvilTwinsDesc', { defaultValue: 'A linked pair (one villager, one imposter) who win together if both survive.' })}</Text>
                </View>
              </View>
            </View>

            {/* Neutral */}
            <View className="gap-2">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">
                ⚪ {t('offline.teamNeutral', { defaultValue: 'Neutral' })}
              </Text>
              {NEUTRAL_OFFLINE_ROLES.map((r) => {
                const def = OFFLINE_ROLE_REGISTRY[r]
                return (
                  <View key={r} className="flex-row items-start gap-2.5 px-3 py-2.5 rounded-xl border border-sky-800/40 bg-neutral-900/40">
                    <Text style={{ fontSize: 16, marginTop: 1 }}>{def.iconEmoji}</Text>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-sky-300">{t(def.i18nLabelKey)}</Text>
                      <Text className="text-[11px] text-neutral-500 mt-0.5 leading-[15px]">{t(def.i18nDescKey)}</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

// ─── DealingPhase: pass-and-play role reveal ────────────────────────────────

function RoleRevealCard({
  player,
  wordPair,
  isLast,
  onGotIt,
  isTablet,
  fontScale,
}: {
  player: OfflinePlayer
  wordPair: { villagerWord: string; redHandedWord: string }
  isLast: boolean
  onGotIt: () => void
  isTablet: boolean
  fontScale: number
}) {
  const { t } = useTranslation()
  const def = OFFLINE_ROLE_REGISTRY[player.role]
  const c = colorsFor(player.role)
  const scaleAnim = useRef(new Animated.Value(0.7)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const rotateAnim = useRef(new Animated.Value(0)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    scaleAnim.setValue(0.7)
    opacityAnim.setValue(0)
    rotateAnim.setValue(0)
    glowAnim.setValue(0)
    // Reveal stinger — this is the card-flip moment. Play a reveal
    // sound + success haptic in tight sync with the visuals so it
    // actually lands like a AAA reveal, not a silent fade.
    SoundManager.play('reveal')
    HapticManager.success()
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 90,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
    ]).start()
    // Sustained glow pulse — a gentle breath on the accent bar so
    // the card feels alive while players read their role.
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start()
  }, [player.name])

  const isDoubleAgent = player.role === 'doubleAgent'

  const rotateY = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['80deg', '0deg'],
  })
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  })
  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.04],
  })

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }, { perspective: 900 }, { rotateY }],
        opacity: opacityAnim,
        width: '100%',
      }}
    >
      <View
        className={['rounded-3xl border-2 overflow-hidden', c.bg, c.border].join(' ')}
        style={{ padding: isTablet ? 36 : 26 }}
      >
        <Animated.View
          className={['absolute top-0 left-0 right-0 h-1', c.accentBar].join(' ')}
          style={{ opacity: glowOpacity, transform: [{ scaleX: glowScale }] }}
        />
        <View className="items-center mb-3">
          <Text style={{ fontSize: isTablet ? 64 : 52 }}>{def.iconEmoji}</Text>
        </View>
        <Text
          className={['text-center font-extrabold uppercase tracking-widest mb-1', c.badge].join(' ')}
          style={{ fontSize: 11 * fontScale }}
        >
          {t('offline.yourRole', { defaultValue: 'Your Role' })}
        </Text>
        <Text
          className={['text-center font-extrabold', c.text].join(' ')}
          style={{ fontSize: (isTablet ? 28 : 22) * fontScale }}
        >
          {t(def.i18nLabelKey, { defaultValue: player.role })}
        </Text>
        {(() => {
          const baseTeam = getBaseTeamForReveal(player.role)
          if (!baseTeam) return <View style={{ marginBottom: 16 }} />
          const teamClass = baseTeam === 'villager' ? 'text-emerald-400' : 'text-red-400'
          const teamIcon = baseTeam === 'villager' ? '🟢' : '🔴'
          const teamKey = baseTeam === 'villager' ? 'offline.villager' : 'offline.redHanded'
          const teamFallback = baseTeam === 'villager' ? 'Villager' : 'Imposter'
          return (
            <Text
              className={['text-center font-semibold mt-1 mb-4', teamClass].join(' ')}
              style={{ fontSize: 13 * fontScale }}
            >
              {teamIcon} {t(teamKey, { defaultValue: teamFallback })}
            </Text>
          )
        })()}

        {isDoubleAgent ? (
          <View className="gap-2">
            <View className="px-4 py-3 rounded-2xl border bg-emerald-900/30 border-emerald-800/40">
              <Text
                className="text-emerald-500 font-semibold uppercase tracking-widest"
                style={{ fontSize: 10 * fontScale }}
              >
                {t('offline.villagerWord', { defaultValue: 'Villager Word' })}
              </Text>
              <Text
                className="text-emerald-300 font-extrabold mt-1"
                style={{ fontSize: (isTablet ? 26 : 20) * fontScale }}
              >
                {wordPair.villagerWord}
              </Text>
            </View>
            <View className="px-4 py-3 rounded-2xl border bg-red-900/30 border-red-800/40">
              <Text
                className="text-red-500 font-semibold uppercase tracking-widest"
                style={{ fontSize: 10 * fontScale }}
              >
                {t('offline.redHandedWord', { defaultValue: 'Imposter Word' })}
              </Text>
              <Text
                className="text-red-300 font-extrabold mt-1"
                style={{ fontSize: (isTablet ? 26 : 20) * fontScale }}
              >
                {wordPair.redHandedWord}
              </Text>
            </View>
          </View>
        ) : (
          <View className={['px-4 py-4 rounded-2xl border items-center', c.bg, c.border].join(' ')}>
            <Text
              className={['font-semibold uppercase tracking-widest', c.badge].join(' ')}
              style={{ fontSize: 10 * fontScale }}
            >
              {t('offline.yourWord', { defaultValue: 'Your Word' })}
            </Text>
            <Text
              className={['font-extrabold mt-1 text-center', c.text].join(' ')}
              style={{ fontSize: (isTablet ? 30 : 24) * fontScale }}
            >
              {player.word}
            </Text>
          </View>
        )}

        <View className="mt-4 px-4 py-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800/60">
          <Text className="text-neutral-400 text-center" style={{ fontSize: 11 * fontScale, lineHeight: 16 * fontScale }}>
            {roleInstruction(t, player.role)}
          </Text>
        </View>

        {(player.role === 'twinRedHanded' || player.role === 'twinVillager') && player.twinPartner && (
          <View className="mt-3 px-4 py-3 rounded-xl bg-purple-900/30 border border-purple-700/40 flex-row items-center gap-2">
            <Text style={{ fontSize: 16 }}>👯</Text>
            <Text className="text-purple-300 font-semibold flex-1" style={{ fontSize: 13 * fontScale }}>
              {t('game.twinPartnerBanner', { name: player.twinPartner, defaultValue: 'Your twin: {{name}}' })}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={onGotIt}
          className={['mt-5 rounded-xl items-center', c.buttonBg].join(' ')}
          style={{ paddingVertical: isTablet ? 16 : 13 }}
          activeOpacity={0.85}
        >
          <Text className="text-white font-extrabold tracking-wide" style={{ fontSize: 15 * fontScale }}>
            {isLast
              ? t('offline.gotItStart', { defaultValue: "Got it — Start" })
              : t('offline.gotItPass', { defaultValue: 'Got it — Pass' })}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

function DealingPhase({
  players,
  wordPair,
  onDone,
  isTablet,
  px,
  fontScale,
}: {
  players: OfflinePlayer[]
  wordPair: { villagerWord: string; redHandedWord: string }
  onDone: () => void
  isTablet: boolean
  px: number
  fontScale: number
}) {
  const { t } = useTranslation()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showingCard, setShowingCard] = useState(false)
  const current = players[currentIndex]

  const handleReady = () => {
    HapticManager.medium()
    setShowingCard(true)
  }
  const handleGotIt = () => {
    HapticManager.light()
    SoundManager.play('click')
    setShowingCard(false)
    const next = currentIndex + 1
    if (next >= players.length) {
      // End of dealing — give a little fanfare before the main game
      SoundManager.play('game_start')
      HapticManager.success()
      onDone()
    } else {
      setCurrentIndex(next)
    }
  }

  if (!current) return null

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: px, gap: 18 }}>
        <View className="flex-row items-center justify-center gap-1.5">
          {players.map((_, i) => (
            <View
              key={i}
              className={[
                'rounded-full',
                i < currentIndex ? 'bg-violet-500' : i === currentIndex ? 'bg-violet-400' : 'bg-neutral-800',
              ].join(' ')}
              style={{ width: i === currentIndex ? 22 : 8, height: 8 }}
            />
          ))}
        </View>

        {!showingCard ? (
          <View
            className="rounded-2xl border border-neutral-800 bg-neutral-900 items-center"
            style={{ padding: isTablet ? 44 : 32 }}
          >
            <Text style={{ fontSize: isTablet ? 52 : 42 }}>📱</Text>
            <Text
              className="text-neutral-500 font-semibold text-center mt-3"
              style={{ fontSize: 13 * fontScale }}
            >
              {t('offline.passDevice', { defaultValue: 'Pass the device to' })}
            </Text>
            <Text
              className="text-violet-300 font-extrabold text-center mt-1"
              style={{ fontSize: (isTablet ? 28 : 22) * fontScale }}
            >
              {current.name}
            </Text>
            <Text
              className="text-neutral-600 text-center mt-3"
              style={{ fontSize: 11 * fontScale }}
            >
              {t('offline.playerOf', {
                current: currentIndex + 1,
                total: players.length,
                defaultValue: `Player ${currentIndex + 1} of ${players.length}`,
              })}
            </Text>
            <TouchableOpacity
              onPress={handleReady}
              className="mt-6 rounded-2xl bg-violet-600 items-center w-full"
              style={{ paddingVertical: isTablet ? 16 : 13 }}
              activeOpacity={0.85}
            >
              <Text className="text-white font-extrabold" style={{ fontSize: 15 * fontScale }}>
                {t('offline.imReady', { defaultValue: "I'm Ready" })}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <RoleRevealCard
            player={current}
            wordPair={wordPair}
            isLast={currentIndex === players.length - 1}
            onGotIt={handleGotIt}
            isTablet={isTablet}
            fontScale={fontScale}
          />
        )}
      </View>
    </ScrollView>
  )
}

// ─── Speaking Timer ──────────────────────────────────────────────────────────

function SpeakingTimer({ isTablet, fontScale }: { isTablet: boolean; fontScale: number }) {
  const { t } = useTranslation()
  const [seconds, setSeconds] = useState(30)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Heartbeat-style pulse when the timer is in the final countdown.
  const urgentPulse = useRef(new Animated.Value(1)).current
  const shakeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            setRunning(false)
            // Time-up: warning sound + warning haptic + a brief shake.
            SoundManager.play('timer_warning')
            HapticManager.warning()
            Animated.sequence([
              Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
              Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
              Animated.timing(shakeAnim, { toValue: 0.6, duration: 60, useNativeDriver: true }),
              Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
            ]).start()
            return 0
          }
          // Last-5-second countdown ticks — subtle tick + tactile tap
          // so players feel the pressure even when looking at the room.
          if (s <= 6) {
            SoundManager.play('timer_tick')
            HapticManager.selection()
          }
          return s - 1
        })
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running, shakeAnim])

  // Drive the urgent heartbeat only while in the red zone.
  useEffect(() => {
    const isUrgentNow = running && seconds <= 5 && seconds > 0
    if (!isUrgentNow) {
      urgentPulse.stopAnimation()
      urgentPulse.setValue(1)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(urgentPulse, { toValue: 1.12, duration: 260, useNativeDriver: true }),
        Animated.timing(urgentPulse, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [running, seconds, urgentPulse])

  const reset = () => {
    HapticManager.light()
    setRunning(false)
    setSeconds(30)
  }

  const isUrgent = seconds <= 10 && seconds > 0
  const progress = seconds / 30
  const shakeTranslateX = shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] })

  return (
    <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 items-center gap-3">
      <Text
        className="font-semibold uppercase tracking-widest text-neutral-500"
        style={{ fontSize: 11 * fontScale }}
      >
        {t('offline.speakingTimer', { defaultValue: 'Speaking Timer' })}
      </Text>
      <Animated.Text
        className={[
          'font-extrabold tabular-nums',
          isUrgent ? 'text-red-400' : seconds === 0 ? 'text-neutral-600' : 'text-white',
        ].join(' ')}
        style={{
          fontSize: (isTablet ? 52 : 42) * fontScale,
          transform: [{ scale: urgentPulse }, { translateX: shakeTranslateX }],
        }}
      >
        {seconds}s
      </Animated.Text>
      <View className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
        <View
          className={['h-full rounded-full', isUrgent ? 'bg-red-500' : 'bg-violet-500'].join(' ')}
          style={{ width: `${progress * 100}%` }}
        />
      </View>
      <View className="flex-row gap-2 w-full">
        <TouchableOpacity
          onPress={() => {
            HapticManager.light()
            if (!running && seconds > 0) SoundManager.play('round_start')
            setRunning((r) => !r)
          }}
          className={[
            'flex-1 items-center justify-center rounded-xl border py-3',
            running ? 'bg-amber-900/40 border-amber-700/40' : 'bg-violet-900/40 border-violet-700/40',
          ].join(' ')}
          activeOpacity={0.8}
        >
          <Text
            className={running ? 'text-amber-300 font-semibold' : 'text-violet-300 font-semibold'}
            style={{ fontSize: 13 * fontScale }}
          >
            {running
              ? t('common.pause', { defaultValue: 'Pause' })
              : seconds === 0
                ? t('offline.expired', { defaultValue: 'Expired' })
                : t('common.start', { defaultValue: 'Start' })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={reset}
          className="items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3"
          activeOpacity={0.7}
        >
          <Text className="text-neutral-300 font-semibold" style={{ fontSize: 13 * fontScale }}>
            {t('common.reset', { defaultValue: 'Reset' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── VotePhase: per-voter pass-and-play with role powers ────────────────────

interface VotePhaseProps {
  allVoters: OfflinePlayer[]
  alivePlayers: OfflinePlayer[]
  detectiveUsedSet: Set<string>
  revealedRoles: Record<string, OfflineRole>
  protectedPlayers: Set<string>
  mayorDoubleVoteUsedSet: Set<string>
  inverterUsedSet: Set<string>
  inverterActiveThisRound: boolean
  corruptorTargets: Record<string, string>
  ghostVoterNames: Set<string>
  revenantGhostRounds: Record<string, number>
  onDetectiveReveal: (det: string, target: string, role: OfflineRole) => void
  onGuardianProtect: (g: string, target: string) => void
  onMayorDoubleVote: (mayor: string) => void
  onInverterActivate: () => void
  onCorruptorPick: (corruptor: string, target: string) => void
  onVotesDone: (votes: VoteRecord[], eliminated: OfflinePlayer | null, judgeTie?: { judge: OfflinePlayer; candidates: string[] }) => void
  isTablet: boolean
  px: number
  fontScale: number
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
  isTablet,
  px,
  fontScale,
}: VotePhaseProps) {
  const { t } = useTranslation()
  const [voterIndex, setVoterIndex] = useState(0)
  const [step, setStep] = useState<VoteStep>('pass')
  const [votes, setVotes] = useState<VoteRecord[]>([])
  const [guardianProtectedThisRound, setGuardianProtectedThisRound] = useState<Set<string>>(new Set())
  const [mayorDoublingThisVote, setMayorDoublingThisVote] = useState(false)

  const voter = allVoters[voterIndex]
  const isGhostVoter = voter ? ghostVoterNames.has(voter.name) : false

  useEffect(() => {
    setMayorDoublingThisVote(false)
  }, [voterIndex])

  if (!voter) return null

  const isDetective = voter.role === 'detective'
  const isGuardian = voter.role === 'guardian'
  const isMayor = voter.role === 'mayor'
  const isInverter = voter.role === 'inverter'
  const isCorruptor = voter.role === 'corruptor'
  const canInvestigate = isDetective && !detectiveUsedSet.has(voter.name)
  const canProtect = isGuardian && !guardianProtectedThisRound.has(voter.name) && !isGhostVoter
  const canDoubleVote = isMayor && !mayorDoubleVoteUsedSet.has(voter.name) && !isGhostVoter
  const canActivateInverter =
    isInverter && !inverterUsedSet.has(voter.name) && !inverterActiveThisRound && !isGhostVoter
  const needsCorruptorPick = isCorruptor && !corruptorTargets[voter.name] && !isGhostVoter
  const corruptedTargetName = isCorruptor && !needsCorruptorPick ? corruptorTargets[voter.name] : null

  const finalize = (newVotes: VoteRecord[]) => {
    const outcome = finalizeVoteRound(newVotes, alivePlayers, corruptorTargets, {
      inverterActive: inverterActiveThisRound,
    })
    if (outcome.resolution.isTie) {
      if (outcome.judgeForTie) {
        onVotesDone(newVotes, null, {
          judge: outcome.judgeForTie as OfflinePlayer,
          candidates: outcome.resolution.topCandidates,
        })
      } else {
        onVotesDone(newVotes, null)
      }
      return
    }
    if (!outcome.resolution.eliminatedName) {
      onVotesDone(newVotes, null)
      return
    }
    const eliminated = alivePlayers.find((p) => p.name === outcome.resolution.eliminatedName) ?? null
    onVotesDone(newVotes, eliminated)
  }

  const castVote = (targetName: string) => {
    const extra: VoteRecord[] = mayorDoublingThisVote
      ? [{ voterName: voter.name, targetName }]
      : []
    const newVotes: VoteRecord[] = [...votes, { voterName: voter.name, targetName }, ...extra]
    if (mayorDoublingThisVote) onMayorDoubleVote(voter.name)
    const next = voterIndex + 1
    if (next >= allVoters.length) {
      finalize(newVotes)
    } else {
      setVotes(newVotes)
      setVoterIndex(next)
      setStep('pass')
    }
  }

  const skipVote = () => {
    if (needsCorruptorPick) return
    const next = voterIndex + 1
    if (next >= allVoters.length) {
      finalize(votes)
    } else {
      setVoterIndex(next)
      setStep('pass')
    }
  }

  const handleDetectiveInvestigate = (target: OfflinePlayer) => {
    // Infiltrator appears as Villager
    const revealedAs: OfflineRole = target.role === 'infiltrator' ? 'villager' : target.role
    onDetectiveReveal(voter.name, target.name, revealedAs)
  }

  const handleGuardian = (targetName: string) => {
    onGuardianProtect(voter.name, targetName)
    setGuardianProtectedThisRound((prev) => new Set(prev).add(voter.name))
  }

  const otherPlayers = alivePlayers.filter(
    (p) => p.name !== voter.name && !ghostVoterNames.has(p.name),
  )
  const voterColors = colorsFor(voter.role)
  const voterDef = OFFLINE_ROLE_REGISTRY[voter.role]

  return (
    <ScrollView
      contentContainerStyle={{ paddingVertical: 24, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: px, gap: 16 }}>
        <View className="items-center">
          <Text className="text-neutral-500" style={{ fontSize: 12 * fontScale }}>
            {t('offline.voteOf', {
              current: voterIndex + 1,
              total: allVoters.length,
              defaultValue: `Vote ${voterIndex + 1} of ${allVoters.length}`,
            })}
          </Text>
          <Text className="text-white font-extrabold mt-0.5" style={{ fontSize: 18 * fontScale }}>
            {t('offline.votingPhase', { defaultValue: 'Voting Phase' })}
          </Text>
          {step === 'voting' && (
            <View
              className={['mt-2 flex-row items-center gap-1.5 px-3 py-1 rounded-full border', voterColors.bg, voterColors.border].join(' ')}
            >
              <Text style={{ fontSize: 12 }}>{voterDef.iconEmoji}</Text>
              <Text className="text-neutral-300 font-semibold" style={{ fontSize: 11 * fontScale }}>
                {voter.name}
              </Text>
              <Text className="text-neutral-600">·</Text>
              <Text className={voterColors.text} style={{ fontSize: 11 * fontScale }}>
                {roleLabel(t, voter.role)}
              </Text>
            </View>
          )}
          {step === 'voting' && isGhostVoter && (
            <Text className="mt-1.5 text-teal-300 font-semibold" style={{ fontSize: 11 * fontScale }}>
              👻 {t('game.revenantGhostVoter', {
                count: revenantGhostRounds[voter.name] ?? 0,
                defaultValue: `Ghost vote (${revenantGhostRounds[voter.name] ?? 0} left)`,
              })}
            </Text>
          )}
          {step === 'voting' && (voter.role === 'twinRedHanded' || voter.role === 'twinVillager') && voter.twinPartner && (
            <View className="mt-2 flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-900/30 border border-purple-700/40">
              <Text style={{ fontSize: 12 }}>👯</Text>
              <Text className="text-purple-300 font-semibold" style={{ fontSize: 11 * fontScale }}>
                {t('game.twinPartnerBanner', { name: voter.twinPartner, defaultValue: 'Your twin: {{name}}' })}
              </Text>
            </View>
          )}
        </View>

        {step === 'pass' ? (
          <View className="rounded-2xl border border-neutral-800 bg-neutral-900 items-center" style={{ padding: isTablet ? 36 : 28 }}>
            <Text style={{ fontSize: isTablet ? 52 : 42 }}>{isGhostVoter ? '👻' : '📱'}</Text>
            <Text className="text-neutral-500 font-semibold text-center mt-3" style={{ fontSize: 13 * fontScale }}>
              {t('offline.passDevice', { defaultValue: 'Pass the device to' })}
            </Text>
            <Text className="text-violet-300 font-extrabold text-center mt-1" style={{ fontSize: (isTablet ? 28 : 22) * fontScale }}>
              {voter.name}
            </Text>
            <TouchableOpacity
              onPress={() => setStep('voting')}
              className="mt-6 rounded-2xl bg-violet-600 items-center w-full"
              style={{ paddingVertical: isTablet ? 16 : 13 }}
              activeOpacity={0.85}
            >
              <Text className="text-white font-extrabold" style={{ fontSize: 15 * fontScale }}>
                {t('offline.imReadyToVote', { defaultValue: "I'm Ready to Vote" })}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="gap-3">
            {/* Mayor double-vote toggle */}
            {canDoubleVote && (
              <TouchableOpacity
                onPress={() => setMayorDoublingThisVote((v) => !v)}
                className={[
                  'rounded-xl border py-2.5 items-center',
                  mayorDoublingThisVote
                    ? 'bg-indigo-600/30 border-indigo-500/60'
                    : 'bg-indigo-900/30 border-indigo-800/50',
                ].join(' ')}
                activeOpacity={0.85}
              >
                <Text
                  className={mayorDoublingThisVote ? 'text-indigo-200 font-bold' : 'text-indigo-300 font-bold'}
                  style={{ fontSize: 13 * fontScale }}
                >
                  👑 {mayorDoublingThisVote
                    ? t('game.mayorDoubleVoteActive', { defaultValue: 'Double vote active — vote counts twice' })
                    : t('game.mayorDoubleVoteBtn', { defaultValue: 'Use Mayor double vote' })}
                </Text>
              </TouchableOpacity>
            )}
            {isMayor && mayorDoubleVoteUsedSet.has(voter.name) && !canDoubleVote && (
              <Text className="text-center text-indigo-500/80" style={{ fontSize: 11 * fontScale }}>
                👑 {t('game.mayorDoubleVoteUsed', { defaultValue: 'Double vote already used' })}
              </Text>
            )}

            {/* Inverter button */}
            {canActivateInverter && (
              <TouchableOpacity
                onPress={onInverterActivate}
                className="rounded-xl border border-rose-800/50 bg-rose-900/30 py-2.5 items-center"
                activeOpacity={0.85}
              >
                <Text className="text-rose-300 font-bold" style={{ fontSize: 13 * fontScale }}>
                  🔄 {t('game.inverterActivateBtn', { defaultValue: 'Invert! (least votes loses)' })}
                </Text>
              </TouchableOpacity>
            )}
            {isInverter && inverterActiveThisRound && (
              <Text className="text-center text-rose-300 font-semibold" style={{ fontSize: 11 * fontScale }}>
                🔄 {t('game.inverterActive', { defaultValue: 'Inverter active this round' })}
              </Text>
            )}
            {isInverter && inverterUsedSet.has(voter.name) && !inverterActiveThisRound && (
              <Text className="text-center text-rose-500/80" style={{ fontSize: 11 * fontScale }}>
                🔄 {t('game.inverterUsed', { defaultValue: 'Inverter already used' })}
              </Text>
            )}

            {/* Corruptor pick prompt */}
            {needsCorruptorPick && (
              <View className="rounded-xl border border-orange-800/50 bg-orange-950/40 px-4 py-3">
                <Text
                  className="text-orange-400 font-bold uppercase tracking-widest text-center"
                  style={{ fontSize: 11 * fontScale }}
                >
                  🕷️ {t('game.corruptorPickTitle', { defaultValue: 'Pick your target' })}
                </Text>
                <Text
                  className="text-orange-300/80 text-center mt-0.5"
                  style={{ fontSize: 10 * fontScale }}
                >
                  {t('game.corruptorPickDesc', {
                    defaultValue: "Their votes won't count until you are eliminated.",
                  })}
                </Text>
              </View>
            )}

            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-2">
              <Text
                className="font-semibold uppercase tracking-widest text-neutral-500 mb-1"
                style={{ fontSize: 11 * fontScale }}
              >
                {t('offline.whoIsRedHanded', {
                  name: voter.name,
                  defaultValue: `Who do you think is the imposter, ${voter.name}?`,
                })}
              </Text>
              {otherPlayers.map((p) => {
                const revealed = revealedRoles[p.name]
                const revealedDef = revealed ? OFFLINE_ROLE_REGISTRY[revealed] : null
                const revealedColors = revealed ? colorsFor(revealed) : null
                const isCorruptedTarget = corruptedTargetName === p.name
                return (
                  <View
                    key={p.name}
                    className={[
                      'flex-row items-center gap-3 px-3 py-2.5 rounded-xl border',
                      isCorruptedTarget
                        ? 'bg-orange-950/30 border-orange-500/70'
                        : 'bg-neutral-800/60 border-neutral-700/40',
                    ].join(' ')}
                  >
                    <View className="w-8 h-8 rounded-full bg-neutral-700 items-center justify-center">
                      <Text className="text-white font-bold" style={{ fontSize: 13 * fontScale }}>
                        {p.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-white font-semibold" style={{ fontSize: 13 * fontScale }} numberOfLines={1}>
                        {p.name}
                      </Text>
                      {isDetective && revealedDef && revealedColors && (
                        <Text
                          className={revealedColors.text}
                          style={{ fontSize: 10 * fontScale }}
                        >
                          {revealedDef.iconEmoji} {roleLabel(t, revealed!)}
                        </Text>
                      )}
                      {isCorruptedTarget && (
                        <Text className="text-orange-400" style={{ fontSize: 10 * fontScale }}>
                          🕷️ {t('game.corrupted', { defaultValue: 'Corrupted' })}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center gap-1.5 shrink-0">
                      {canInvestigate && !revealed && (
                        <TouchableOpacity
                          onPress={() => handleDetectiveInvestigate(p)}
                          className="w-9 h-9 rounded-lg bg-blue-900/40 border border-blue-700/40 items-center justify-center"
                          activeOpacity={0.7}
                        >
                          <Text>🔍</Text>
                        </TouchableOpacity>
                      )}
                      {canProtect && !protectedPlayers.has(p.name) && (
                        <TouchableOpacity
                          onPress={() => handleGuardian(p.name)}
                          className="w-9 h-9 rounded-lg bg-yellow-900/40 border border-yellow-700/40 items-center justify-center"
                          activeOpacity={0.7}
                        >
                          <Text>🛡️</Text>
                        </TouchableOpacity>
                      )}
                      {isGuardian && protectedPlayers.has(p.name) && (
                        <View className="w-9 h-9 rounded-lg bg-yellow-900/20 border border-yellow-800/30 items-center justify-center">
                          <Text style={{ opacity: 0.5 }}>🛡️</Text>
                        </View>
                      )}
                      {needsCorruptorPick && (
                        <TouchableOpacity
                          onPress={() => onCorruptorPick(voter.name, p.name)}
                          className="w-9 h-9 rounded-lg bg-orange-900/40 border border-orange-700/40 items-center justify-center"
                          activeOpacity={0.7}
                        >
                          <Text>🕷️</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => castVote(p.name)}
                        className="px-3 h-9 rounded-lg bg-neutral-700/60 border border-neutral-600/40 items-center justify-center"
                        activeOpacity={0.7}
                      >
                        <Text className="text-neutral-300 font-bold" style={{ fontSize: 12 * fontScale }}>
                          {t('offline.voteArrow', { defaultValue: 'Vote' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {step === 'voting' && (
          <TouchableOpacity
            onPress={skipVote}
            disabled={needsCorruptorPick}
            className="rounded-xl border border-neutral-700/40 bg-neutral-800/60 py-2.5 items-center"
            style={{ opacity: needsCorruptorPick ? 0.4 : 1 }}
            activeOpacity={0.7}
          >
            <Text className="text-neutral-400 font-semibold" style={{ fontSize: 12 * fontScale }}>
              {t('offline.cancelVote', { defaultValue: 'Skip vote' })}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  )
}

// ─── VoteResult ──────────────────────────────────────────────────────────────

function VoteResult({
  votes,
  eliminated,
  protectedPlayerName,
  silencedVoterNames,
  onContinue,
  isTablet,
  px,
  fontScale,
}: {
  votes: VoteRecord[]
  eliminated: OfflinePlayer | null
  protectedPlayerName: string | null
  silencedVoterNames: Set<string>
  onContinue: () => void
  isTablet: boolean
  px: number
  fontScale: number
}) {
  const { t } = useTranslation()
  const tally: Record<string, number> = {}
  for (const v of votes) {
    if (silencedVoterNames.has(v.voterName)) continue
    tally[v.targetName] = (tally[v.targetName] ?? 0) + 1
  }
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
  const totalCounted = Object.values(tally).reduce((a, b) => a + b, 0)
  const eliminatedDef = eliminated ? OFFLINE_ROLE_REGISTRY[eliminated.role] : null
  const eliminatedColors = eliminated ? colorsFor(eliminated.role) : null

  // Card drops/shakes in + bars fill from 0. Feels like a cinematic reveal
  // instead of a silent render.
  const cardDrop = useRef(new Animated.Value(0)).current
  const flashAnim = useRef(new Animated.Value(0)).current
  const barFill = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (protectedPlayerName) {
      SoundManager.play('notification')
      HapticManager.medium()
    } else if (eliminated) {
      SoundManager.play('elimination')
      HapticManager.heavy()
      // Brief red screen flash — the "hit" moment.
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 360, useNativeDriver: true }),
      ]).start()
    } else {
      SoundManager.play('click')
      HapticManager.light()
    }
    cardDrop.setValue(0)
    Animated.spring(cardDrop, {
      toValue: 1,
      tension: 80,
      friction: 9,
      useNativeDriver: true,
    }).start()
    barFill.setValue(0)
    Animated.timing(barFill, {
      toValue: 1,
      duration: 900,
      delay: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width animation can't use native driver
    }).start()
  }, [eliminated, protectedPlayerName, cardDrop, flashAnim, barFill])

  const cardTranslateY = cardDrop.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 0],
  })
  const cardOpacity = cardDrop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

  return (
    <ScrollView
      contentContainerStyle={{ paddingVertical: 24, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Elimination hit flash */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#ef4444',
          opacity: flashAnim,
        }}
      />
      <View style={{ paddingHorizontal: px, gap: 16 }}>
        {protectedPlayerName ? (
          <Animated.View
            className="items-center gap-2"
            style={{ opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] }}
          >
            <Text style={{ fontSize: isTablet ? 56 : 44 }}>🛡️</Text>
            <Text className="text-yellow-400 font-extrabold text-center" style={{ fontSize: 18 * fontScale }}>
              {t('offline.protectionTriggered', {
                name: protectedPlayerName,
                defaultValue: `${protectedPlayerName} was protected!`,
              })}
            </Text>
          </Animated.View>
        ) : eliminated && eliminatedDef && eliminatedColors ? (
          <Animated.View
            className={['rounded-3xl border-2 items-center', eliminatedColors.bg, eliminatedColors.border].join(' ')}
            style={{
              padding: isTablet ? 28 : 22,
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            }}
          >
            <Text className="text-red-400 font-bold uppercase tracking-widest" style={{ fontSize: 11 * fontScale }}>
              🗳️ {t('offline.eliminated', { defaultValue: 'Eliminated' })}
            </Text>
            <Text style={{ fontSize: isTablet ? 56 : 44, marginTop: 4 }}>{eliminatedDef.iconEmoji}</Text>
            <Text className="text-white font-extrabold mt-2" style={{ fontSize: (isTablet ? 26 : 22) * fontScale }}>
              {eliminated.name}
            </Text>
            <Text
              className={['font-bold uppercase tracking-widest mt-1', eliminatedColors.badge].join(' ')}
              style={{ fontSize: 10 * fontScale }}
            >
              {t('offline.theyWere', { defaultValue: 'They were' })}
            </Text>
            <Text
              className={['font-extrabold', eliminatedColors.text].join(' ')}
              style={{ fontSize: (isTablet ? 22 : 18) * fontScale }}
            >
              {roleLabel(t, eliminated.role)}
            </Text>
          </Animated.View>
        ) : (
          <Animated.View
            className="items-center gap-2"
            style={{ opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] }}
          >
            <Text style={{ fontSize: isTablet ? 56 : 44 }}>🤷</Text>
            <Text className="text-white font-extrabold" style={{ fontSize: 18 * fontScale }}>
              {t('offline.noOneEliminated', { defaultValue: 'No one was eliminated' })}
            </Text>
          </Animated.View>
        )}

        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-2">
          <Text
            className="font-semibold uppercase tracking-widest text-neutral-500 mb-1"
            style={{ fontSize: 11 * fontScale }}
          >
            {t('offline.voteTally', { defaultValue: 'Vote Tally' })}
          </Text>
          {sorted.map(([name, count]) => {
            const pct = (count / Math.max(totalCounted, 1)) * 100
            const animatedWidth = barFill.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', `${pct}%`] as unknown as string[],
            })
            return (
              <View key={name} className="flex-row items-center gap-3">
                <Text className="text-white font-semibold w-24" numberOfLines={1} style={{ fontSize: 12 * fontScale }}>
                  {name}
                </Text>
                <View className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <Animated.View
                    className={['h-2', eliminated?.name === name ? 'bg-red-500' : 'bg-neutral-600'].join(' ')}
                    style={{ width: animatedWidth }}
                  />
                </View>
                <Text className="text-neutral-400 w-6 text-right tabular-nums" style={{ fontSize: 11 * fontScale }}>
                  {count}
                </Text>
              </View>
            )
          })}
          {sorted.length === 0 && (
            <Text className="text-neutral-600 text-center py-2" style={{ fontSize: 11 * fontScale }}>
              {t('offline.noVotesCast', { defaultValue: 'No votes were cast.' })}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => {
            HapticManager.light()
            SoundManager.play('click')
            onContinue()
          }}
          className="rounded-2xl bg-violet-600 items-center"
          style={{ paddingVertical: isTablet ? 16 : 14 }}
          activeOpacity={0.85}
        >
          <Text className="text-white font-extrabold" style={{ fontSize: 15 * fontScale }}>
            {t('offline.continueGame', { defaultValue: 'Continue' })}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// ─── Pick-target sub-phases (Judge tie-break, Kamikaze drag) ────────────────

function PickTargetPhase({
  title,
  iconEmoji,
  passToName,
  passColor,
  description,
  candidates,
  onPick,
  isTablet,
  px,
  fontScale,
}: {
  title: string
  iconEmoji: string
  passToName: string
  passColor: string
  description: string
  candidates: string[]
  onPick: (name: string) => void
  isTablet: boolean
  px: number
  fontScale: number
}) {
  const { t } = useTranslation()
  const [ready, setReady] = useState(false)
  return (
    <ScrollView
      contentContainerStyle={{ paddingVertical: 24, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: px, gap: 18 }}>
        <Text className="text-white font-extrabold text-center" style={{ fontSize: 18 * fontScale }}>
          {iconEmoji} {title}
        </Text>
        {!ready ? (
          <View className="rounded-2xl border border-neutral-800 bg-neutral-900 items-center" style={{ padding: isTablet ? 36 : 28 }}>
            <Text style={{ fontSize: isTablet ? 52 : 42 }}>📱</Text>
            <Text className="text-neutral-500 font-semibold text-center mt-3" style={{ fontSize: 13 * fontScale }}>
              {t('offline.passDevice', { defaultValue: 'Pass the device to' })}
            </Text>
            <Text className={['font-extrabold text-center mt-1', passColor].join(' ')} style={{ fontSize: (isTablet ? 28 : 22) * fontScale }}>
              {passToName}
            </Text>
            <Text className="text-neutral-500 text-center mt-3" style={{ fontSize: 11 * fontScale }}>
              {description}
            </Text>
            <TouchableOpacity
              onPress={() => setReady(true)}
              className="mt-6 rounded-2xl bg-violet-600 items-center w-full"
              style={{ paddingVertical: isTablet ? 16 : 13 }}
              activeOpacity={0.85}
            >
              <Text className="text-white font-extrabold" style={{ fontSize: 15 * fontScale }}>
                {t('offline.imReadyToVote', { defaultValue: "I'm Ready" })}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3 gap-2">
            <Text className="text-neutral-500 text-center" style={{ fontSize: 11 * fontScale }}>
              {description}
            </Text>
            {candidates.map((name) => (
              <TouchableOpacity
                key={name}
                onPress={() => onPick(name)}
                className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-neutral-800/60 border border-neutral-700/40"
                activeOpacity={0.8}
              >
                <View className="w-8 h-8 rounded-full bg-neutral-700 items-center justify-center">
                  <Text className="text-white font-bold" style={{ fontSize: 13 * fontScale }}>
                    {name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text className="flex-1 text-white font-semibold" style={{ fontSize: 13 * fontScale }} numberOfLines={1}>
                  {name}
                </Text>
                <Text className="text-neutral-400">→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}

// ─── PlayingPhase orchestrator ──────────────────────────────────────────────

function PlayingPhase({
  initialPlayers,
  gameMode,
  wordPair,
  onRevealRoles,
  isTablet,
  px,
  fontScale,
}: {
  initialPlayers: OfflinePlayer[]
  gameMode: GameMode
  wordPair: { villagerWord: string; redHandedWord: string }
  onRevealRoles: (updatedPlayers: OfflinePlayer[], manual?: boolean) => void
  isTablet: boolean
  px: number
  fontScale: number
}) {
  const { t } = useTranslation()
  const [players, setPlayers] = useState<OfflinePlayer[]>(initialPlayers)
  const [subPhase, setSubPhase] = useState<SubPhase>('main')
  const [lastVotes, setLastVotes] = useState<VoteRecord[]>([])
  const [lastEliminated, setLastEliminated] = useState<OfflinePlayer | null>(null)
  const [lastSilencedVoters, setLastSilencedVoters] = useState<Set<string>>(new Set())

  const [detectiveUsedSet, setDetectiveUsedSet] = useState<Set<string>>(new Set())
  const [revealedRoles, setRevealedRoles] = useState<Record<string, OfflineRole>>({})
  const [protectedPlayers, setProtectedPlayers] = useState<Set<string>>(new Set())
  const [protectionTriggeredName, setProtectionTriggeredName] = useState<string | null>(null)
  const [mayorDoubleVoteUsedSet, setMayorDoubleVoteUsedSet] = useState<Set<string>>(new Set())
  const [inverterUsedSet, setInverterUsedSet] = useState<Set<string>>(new Set())
  const [inverterActiveThisRound, setInverterActiveThisRound] = useState(false)
  const [corruptorTargets, setCorruptorTargets] = useState<Record<string, string>>({})
  const [revenantGhostRounds, setRevenantGhostRounds] = useState<Record<string, number>>({})
  const [kamikazePending, setKamikazePending] = useState<OfflinePlayer | null>(null)
  const [judgeTiePending, setJudgeTiePending] = useState<JudgeTiePending | null>(null)

  const alivePlayers = players.filter((p) => !p.isEliminated)
  const ghostVoters: OfflinePlayer[] = Object.keys(revenantGhostRounds)
    .filter((name) => (revenantGhostRounds[name] ?? 0) > 0)
    .map((name) => players.find((p) => p.name === name))
    .filter((p): p is OfflinePlayer => !!p)
  const allVoters: OfflinePlayer[] = [...alivePlayers, ...ghostVoters]
  const ghostVoterNames = new Set(ghostVoters.map((g) => g.name))

  const endRoundIfWinDecided = (updated: OfflinePlayer[]): boolean => {
    const alive = updated.filter((p) => !p.isEliminated)
    const aliveEvil = alive.filter((p) => isEvilOfflineRole(p.role))
    const aliveGood = alive.filter((p) => !isEvilOfflineRole(p.role))
    if (aliveEvil.length === 0 || aliveEvil.length >= aliveGood.length) {
      onRevealRoles(updated)
      return true
    }
    return false
  }

  const handleStartVote = () => {
    setProtectedPlayers(new Set())
    setInverterActiveThisRound(false)
    setSubPhase('voting')
  }

  const handleVotesDone = (
    votes: VoteRecord[],
    eliminated: OfflinePlayer | null,
    judgeTie?: { judge: OfflinePlayer; candidates: string[] },
  ) => {
    setLastVotes(votes)

    const silenced = new Set<string>()
    for (const c of alivePlayers.filter((p) => p.role === 'corruptor')) {
      const tgt = corruptorTargets[c.name]
      if (tgt) silenced.add(tgt)
    }
    setLastSilencedVoters(silenced)

    if (judgeTie) {
      setLastEliminated(null)
      setProtectionTriggeredName(null)
      setJudgeTiePending({ judge: judgeTie.judge, candidates: judgeTie.candidates, votes })
      setSubPhase('judgeTieBreak')
      return
    }

    if (!eliminated) {
      setLastEliminated(null)
      setProtectionTriggeredName(null)
      setSubPhase('voteResult')
      return
    }

    if (protectedPlayers.has(eliminated.name)) {
      setLastEliminated(null)
      setProtectionTriggeredName(eliminated.name)
      setSubPhase('voteResult')
      return
    }

    if (eliminated.role === 'jester') {
      const updated = players.map((p) =>
        p.name === eliminated.name ? { ...p, isEliminated: true, jesterWon: true } : p,
      )
      setPlayers(updated)
      onRevealRoles(updated)
      return
    }

    if (eliminated.role === 'revenant') {
      setRevenantGhostRounds((prev) => ({ ...prev, [eliminated.name]: REVENANT_POST_DEATH_ROUNDS }))
    }

    if (eliminated.role === 'kamikaze') {
      setPlayers((prev) => prev.map((p) => (p.name === eliminated.name ? { ...p, isEliminated: true } : p)))
      setLastEliminated(eliminated)
      setProtectionTriggeredName(null)
      setKamikazePending(eliminated)
      setSubPhase('kamikazeDrag')
      return
    }

    const updated = players.map((p) =>
      p.name === eliminated.name ? { ...p, isEliminated: true } : p,
    )
    setPlayers(updated)
    setLastEliminated(eliminated)
    setProtectionTriggeredName(null)
    setSubPhase('voteResult')
  }

  const handleJudgeDecide = (targetName: string) => {
    if (!judgeTiePending) return
    const target = players.find((p) => p.name === targetName)
    if (!target) return

    if (protectedPlayers.has(targetName)) {
      setLastEliminated(null)
      setProtectionTriggeredName(targetName)
      setJudgeTiePending(null)
      setSubPhase('voteResult')
      return
    }

    if (target.role === 'jester') {
      const updated = players.map((p) =>
        p.name === targetName ? { ...p, isEliminated: true, jesterWon: true } : p,
      )
      setPlayers(updated)
      setJudgeTiePending(null)
      onRevealRoles(updated)
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

    const updated = players.map((p) =>
      p.name === targetName ? { ...p, isEliminated: true } : p,
    )
    setPlayers(updated)
    setLastEliminated(target)
    setProtectionTriggeredName(null)
    setJudgeTiePending(null)
    setSubPhase('voteResult')
  }

  const handleKamikazeDrag = (victimName: string) => {
    const updated = players.map((p) =>
      p.name === victimName ? { ...p, isEliminated: true } : p,
    )
    setPlayers(updated)
    setKamikazePending(null)

    const victim = players.find((p) => p.name === victimName)
    if (victim?.role === 'jester') {
      const withJester = updated.map((p) => (p.name === victimName ? { ...p, jesterWon: true } : p))
      setPlayers(withJester)
      onRevealRoles(withJester)
      return
    }
    if (victim?.role === 'revenant') {
      setRevenantGhostRounds((prev) => ({ ...prev, [victimName]: REVENANT_POST_DEATH_ROUNDS }))
    }
    setSubPhase('voteResult')
  }

  const handleContinueAfterVote = () => {
    setProtectedPlayers(new Set())
    setProtectionTriggeredName(null)
    setInverterActiveThisRound(false)
    setRevenantGhostRounds((prev) => {
      const next: Record<string, number> = {}
      for (const [name, rounds] of Object.entries(prev)) {
        if (rounds - 1 > 0) next[name] = rounds - 1
      }
      return next
    })
    if (endRoundIfWinDecided(players)) return
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
        onDetectiveReveal={(det, target, role) => {
          setDetectiveUsedSet((prev) => new Set(prev).add(det))
          setRevealedRoles((prev) => ({ ...prev, [target]: role }))
        }}
        onGuardianProtect={(_g, target) => {
          setProtectedPlayers((prev) => new Set(prev).add(target))
        }}
        onMayorDoubleVote={(mayor) => {
          setMayorDoubleVoteUsedSet((prev) => new Set(prev).add(mayor))
        }}
        onInverterActivate={() => {
          setInverterActiveThisRound(true)
          const aliveInverter = alivePlayers.find(
            (p) => p.role === 'inverter' && !inverterUsedSet.has(p.name),
          )
          if (aliveInverter) {
            setInverterUsedSet((prev) => new Set(prev).add(aliveInverter.name))
          }
        }}
        onCorruptorPick={(c, t) => {
          setCorruptorTargets((prev) => ({ ...prev, [c]: t }))
        }}
        onVotesDone={handleVotesDone}
        isTablet={isTablet}
        px={px}
        fontScale={fontScale}
      />
    )
  }

  if (subPhase === 'judgeTieBreak' && judgeTiePending) {
    return (
      <PickTargetPhase
        title={t('game.judgePickTitle', { defaultValue: 'Judge picks the loser' })}
        iconEmoji="⚖️"
        passToName={judgeTiePending.judge.name}
        passColor="text-emerald-300"
        description={t('game.judgePickDesc', {
          defaultValue: "Pick who to eliminate from the tied players. You can't save yourself.",
        })}
        candidates={judgeTiePending.candidates}
        onPick={handleJudgeDecide}
        isTablet={isTablet}
        px={px}
        fontScale={fontScale}
      />
    )
  }

  if (subPhase === 'kamikazeDrag' && kamikazePending) {
    const targets = players
      .filter((p) => !p.isEliminated && p.name !== kamikazePending.name)
      .map((p) => p.name)
    return (
      <PickTargetPhase
        title={t('game.kamikazePickTitle', { defaultValue: 'Take someone with you' })}
        iconEmoji="💥"
        passToName={kamikazePending.name}
        passColor="text-red-300"
        description={t('game.kamikazePickDesc', {
          defaultValue: 'Pick one player to drag down with you — they are eliminated too.',
        })}
        candidates={targets}
        onPick={handleKamikazeDrag}
        isTablet={isTablet}
        px={px}
        fontScale={fontScale}
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
        isTablet={isTablet}
        px={px}
        fontScale={fontScale}
      />
    )
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingVertical: 24, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: px, gap: 16 }}>
        <View className="items-center pb-1">
          <View className="flex-row items-center gap-2 px-3 py-1 rounded-full border border-violet-600/30 bg-violet-600/10">
            <View className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            <Text className="text-violet-400 font-semibold" style={{ fontSize: 11 * fontScale }}>
              {t('offline.gameInProgress', { defaultValue: 'Game in progress' })}
            </Text>
            {gameMode === 'special' && (
              <Text className="text-amber-400 font-bold uppercase" style={{ fontSize: 9 * fontScale }}>
                · {t('offline.special', { defaultValue: 'Special' })}
              </Text>
            )}
          </View>
          <Text className="text-white font-extrabold mt-2" style={{ fontSize: (isTablet ? 22 : 18) * fontScale }}>
            {t('offline.playersAlive', {
              count: alivePlayers.length,
              defaultValue: `${alivePlayers.length} players alive`,
            })}
          </Text>
        </View>

        <SpeakingTimer isTablet={isTablet} fontScale={fontScale} />

        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-2">
          <Text
            className="font-semibold uppercase tracking-widest text-neutral-500 mb-1"
            style={{ fontSize: 11 * fontScale }}
          >
            {t('common.players', { defaultValue: 'Players' })}
          </Text>
          {players.map((p) => (
            <View
              key={p.name}
              className={[
                'flex-row items-center gap-3 px-3 py-2.5 rounded-xl border',
                p.isEliminated
                  ? 'bg-neutral-900/20 border-neutral-800/30 opacity-50'
                  : 'bg-neutral-800/40 border-neutral-700/40',
              ].join(' ')}
            >
              <View
                className={[
                  'w-8 h-8 rounded-full items-center justify-center',
                  p.isEliminated ? 'bg-neutral-800' : 'bg-violet-900/40',
                ].join(' ')}
              >
                <Text
                  className={p.isEliminated ? 'text-neutral-600 font-bold' : 'text-violet-300 font-bold'}
                  style={{ fontSize: 13 * fontScale }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text
                className={[
                  'flex-1 font-semibold',
                  p.isEliminated ? 'text-neutral-600 line-through' : 'text-white',
                ].join(' ')}
                style={{ fontSize: 13 * fontScale }}
              >
                {p.name}
              </Text>
              {p.isEliminated && (
                <Text className="text-neutral-600 font-semibold" style={{ fontSize: 10 * fontScale }}>
                  {t('offline.eliminated', { defaultValue: 'Eliminated' })}
                </Text>
              )}
            </View>
          ))}
        </View>

        {alivePlayers.length >= 3 && (
          <TouchableOpacity
            onPress={handleStartVote}
            className="rounded-2xl bg-amber-600 items-center"
            style={{ paddingVertical: isTablet ? 16 : 14 }}
            activeOpacity={0.85}
          >
            <Text className="text-white font-extrabold" style={{ fontSize: 15 * fontScale }}>
              {t('offline.startVote', { defaultValue: 'Start Vote' })}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => onRevealRoles(players, true)}
          className="rounded-2xl bg-neutral-800 border border-neutral-700/60 items-center"
          style={{ paddingVertical: isTablet ? 14 : 12 }}
          activeOpacity={0.7}
        >
          <Text className="text-neutral-300 font-semibold" style={{ fontSize: 14 * fontScale }}>
            {t('offline.revealRoles', { defaultValue: 'Reveal Roles' })}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// ─── ResultsPhase ───────────────────────────────────────────────────────────

function ResultsPhase({
  players,
  gameMode,
  wordPair,
  manualReveal,
  onPlayAgain,
  onHome,
  isTablet,
  px,
  fontScale,
}: {
  players: OfflinePlayer[]
  gameMode: GameMode
  wordPair: { villagerWord: string; redHandedWord: string }
  manualReveal: boolean
  onPlayAgain: () => void
  onHome: () => void
  isTablet: boolean
  px: number
  fontScale: number
}) {
  const { t } = useTranslation()

  // Win check: jester win, then evil-team check.
  const jesterWin = !manualReveal && players.find((p) => p.jesterWon)
  const evilTeam = players.filter((p) => isEvilOfflineRole(p.role))
  const eliminatedEvil = evilTeam.filter((p) => p.isEliminated)
  const redHandedWon = !manualReveal && !jesterWin && eliminatedEvil.length < evilTeam.length

  // Twin win — both twins must be alive.
  const twinV = players.find((p) => p.role === 'twinVillager')
  const twinI = players.find((p) => p.role === 'twinRedHanded')
  const twinsWin = !manualReveal && twinV && twinI && !twinV.isEliminated && !twinI.isEliminated && !jesterWin

  // Celebration stingers + confetti for villager-side wins.
  const headerBounce = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (manualReveal) {
      SoundManager.play('game_end')
      HapticManager.light()
    } else {
      SoundManager.play('game_end')
      if (redHandedWon) HapticManager.error()
      else HapticManager.success()
    }
    Animated.spring(headerBounce, {
      toValue: 1,
      tension: 80,
      friction: 6,
      useNativeDriver: true,
    }).start()
  }, [manualReveal, redHandedWon, headerBounce])

  const shouldConfetti = !manualReveal && !redHandedWon
  const headerScale = headerBounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  })
  const headerOpacity = headerBounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

  return (
    <ScrollView
      contentContainerStyle={{ paddingVertical: 24, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {shouldConfetti && <ConfettiRain />}
      <View style={{ paddingHorizontal: px, gap: 18 }}>
        <Animated.View
          className="items-center gap-2"
          style={{ opacity: headerOpacity, transform: [{ scale: headerScale }] }}
        >
          <Text style={{ fontSize: isTablet ? 60 : 48 }}>🎭</Text>
          <Text className="text-white font-extrabold" style={{ fontSize: (isTablet ? 30 : 24) * fontScale }}>
            {t('offline.gameOver', { defaultValue: 'Game Over' })}
          </Text>
          <View
            className={[
              'flex-row items-center gap-2 px-4 py-2 rounded-full border',
              manualReveal
                ? 'bg-neutral-800/60 border-neutral-600/50'
                : jesterWin
                  ? 'bg-pink-950/60 border-pink-700/50'
                  : redHandedWon
                    ? 'bg-red-950/60 border-red-700/50'
                    : 'bg-emerald-950/60 border-emerald-700/50',
            ].join(' ')}
          >
            <Text
              className={[
                'font-bold',
                manualReveal
                  ? 'text-neutral-300'
                  : jesterWin ? 'text-pink-400' : redHandedWon ? 'text-red-400' : 'text-emerald-400',
              ].join(' ')}
              style={{ fontSize: 13 * fontScale }}
            >
              {manualReveal
                ? `👁️ ${t('offline.rolesRevealed', { defaultValue: 'Roles Revealed' })}`
                : jesterWin
                  ? `🃏 ${t('offline.jesterWins', { defaultValue: 'Jester wins!' })}`
                  : redHandedWon
                    ? `🔴 ${t('offline.redHandedWin', { defaultValue: 'Imposters win!' })}`
                    : `🟢 ${t('offline.villagersWin', { defaultValue: 'Villagers win!' })}`}
            </Text>
          </View>
          {twinsWin && (
            <Text className="text-purple-300 font-semibold mt-1" style={{ fontSize: 12 * fontScale }}>
              👯 {t('offline.evilTwinsSurvived', { defaultValue: 'Both twins survived — they win together!' })}
            </Text>
          )}
        </Animated.View>

        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-3">
          <Text className="text-neutral-500 font-semibold uppercase tracking-widest" style={{ fontSize: 10 * fontScale }}>
            {t('offline.theWords', { defaultValue: 'The Words' })}
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/30">
              <Text className="text-emerald-600 font-bold uppercase tracking-widest" style={{ fontSize: 9 * fontScale }}>
                {t('offline.villagerWord', { defaultValue: 'Villager Word' })}
              </Text>
              <Text className="text-emerald-300 font-extrabold mt-1" style={{ fontSize: 16 * fontScale }}>
                {wordPair.villagerWord}
              </Text>
            </View>
            <View className="flex-1 p-3 rounded-xl bg-red-950/40 border border-red-800/30">
              <Text className="text-red-600 font-bold uppercase tracking-widest" style={{ fontSize: 9 * fontScale }}>
                {t('offline.redHandedWord', { defaultValue: 'Imposter Word' })}
              </Text>
              <Text className="text-red-300 font-extrabold mt-1" style={{ fontSize: 16 * fontScale }}>
                {wordPair.redHandedWord}
              </Text>
            </View>
          </View>
        </View>

        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-2">
          <Text className="text-neutral-500 font-semibold uppercase tracking-widest mb-1" style={{ fontSize: 10 * fontScale }}>
            {t('offline.allRoles', { defaultValue: 'All Roles' })}
          </Text>
          {players.map((p, idx) => (
            <StaggeredRoleRow
              key={p.name}
              player={p}
              index={idx}
              fontScale={fontScale}
              t={t}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={() => {
            HapticManager.medium()
            SoundManager.play('game_start')
            onPlayAgain()
          }}
          className="rounded-2xl bg-violet-600 items-center"
          style={{ paddingVertical: isTablet ? 18 : 15 }}
          activeOpacity={0.85}
        >
          <Text className="text-white font-extrabold" style={{ fontSize: 16 * fontScale }}>
            {t('offline.playAgain', { defaultValue: 'Play Again' })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            HapticManager.light()
            onHome()
          }}
          className="rounded-2xl bg-neutral-800 border border-neutral-700/60 items-center"
          style={{ paddingVertical: isTablet ? 14 : 12 }}
          activeOpacity={0.7}
        >
          <Text className="text-neutral-300 font-semibold" style={{ fontSize: 14 * fontScale }}>
            {t('offline.home', { defaultValue: 'Home' })}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// Staggered row used on the results list so each role card slides into place
// instead of all appearing at once. A simple translateY + fade is enough to
// give the screen a pro, "something happened" feel.
function StaggeredRoleRow({
  player,
  index,
  fontScale,
  t,
}: {
  player: OfflinePlayer
  index: number
  fontScale: number
  t: (key: string, opts?: any) => string
}) {
  const def = OFFLINE_ROLE_REGISTRY[player.role]
  const c = colorsFor(player.role)
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      delay: 60 + index * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [anim, index])
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] })
  return (
    <Animated.View
      className={['flex-row items-center gap-3 px-3 py-2.5 rounded-xl border', c.bg, c.border].join(' ')}
      style={{ opacity: anim, transform: [{ translateX }] }}
    >
      <Text style={{ fontSize: 18 }}>{def.iconEmoji}</Text>
      <View className="flex-1 min-w-0">
        <Text
          className={[
            'font-bold',
            player.isEliminated ? 'text-neutral-500 line-through' : 'text-white',
          ].join(' ')}
          style={{ fontSize: 13 * fontScale }}
          numberOfLines={1}
        >
          {player.name}
        </Text>
        <Text className={c.badge} style={{ fontSize: 10 * fontScale }} numberOfLines={1}>
          {roleLabel(t, player.role)} · {player.word}
        </Text>
      </View>
      {player.isEliminated && (
        <View className="px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700/40">
          <Text className="text-neutral-500 font-bold uppercase" style={{ fontSize: 9 * fontScale }}>
            {t('offline.out', { defaultValue: 'Out' })}
          </Text>
        </View>
      )}
    </Animated.View>
  )
}

// Falling confetti for villager-win celebrations. Pure Animated.View so it
// runs on the native driver and stays at 60fps even on mid-tier devices.
function ConfettiRain() {
  const windowSize = Dimensions.get('window')
  const pieces = useMemo(() => {
    const COLORS = ['#22c55e', '#a78bfa', '#fbbf24', '#f472b6', '#38bdf8', '#ef4444']
    return Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      left: Math.random() * windowSize.width,
      delay: Math.random() * 800,
      duration: 1800 + Math.random() * 1400,
      rotateDir: Math.random() > 0.5 ? 1 : -1,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 5,
    }))
  }, [windowSize.width])

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {pieces.map((p) => (
        <ConfettiPiece key={p.id} piece={p} height={windowSize.height} />
      ))}
    </View>
  )
}

function ConfettiPiece({
  piece,
  height,
}: {
  piece: {
    left: number
    delay: number
    duration: number
    rotateDir: number
    color: string
    size: number
  }
  height: number
}) {
  const fall = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const run = () => {
      fall.setValue(0)
      Animated.timing(fall, {
        toValue: 1,
        duration: piece.duration,
        delay: piece.delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => run())
    }
    run()
  }, [fall, piece.delay, piece.duration])
  const translateY = fall.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, height + 40],
  })
  const rotate = fall.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${720 * piece.rotateDir}deg`],
  })
  const opacity = fall.interpolate({
    inputRange: [0, 0.1, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  })
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: piece.left,
        width: piece.size,
        height: piece.size * 1.6,
        backgroundColor: piece.color,
        borderRadius: 2,
        opacity,
        transform: [{ translateY }, { rotate }],
      }}
    />
  )
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function OfflineScreen() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { isTablet, px, fontScale } = useResponsive()

  const [phase, setPhase] = useState<Phase>('setup')
  const [gameMode, setGameMode] = useState<GameMode>('normal')
  const [players, setPlayers] = useState<OfflinePlayer[]>([])
  const [wordPair, setWordPair] = useState<{ villagerWord: string; redHandedWord: string }>({
    villagerWord: '',
    redHandedWord: '',
  })
  const [lastSettings, setLastSettings] = useState<PersistedSettings | null>(null)

  const contentStyle = isTablet
    ? { maxWidth: 560, alignSelf: 'center' as const, width: '100%' as const }
    : {}

  const handleStart = useCallback(
    (settings: PersistedSettings) => {
      setLastSettings(settings)
      setGameMode(settings.gameMode)

      const rawPair = pickRandomWordPair(settings.categories, shuffleArray, i18n.language)
      const pair = Math.random() < 0.5
        ? { villagerWord: rawPair.redHandedWord, redHandedWord: rawPair.villagerWord }
        : rawPair

      const playerOrder = shuffleArray([...settings.names])
      let roles: OfflinePlayer[]

      if (settings.gameMode === 'special') {
        // Build a queue: redHanded side, villager side, neutral, then plain villagers fill the rest.
        const queue: OfflineRole[] = []
        const specialEvilCount =
          settings.counts.doubleAgent + settings.counts.infiltrator +
          settings.counts.kamikaze + settings.counts.corruptor +
          settings.counts.inverter + settings.counts.evilTwins
        const normalRedHanded = Math.max(0, settings.redHandedCount - specialEvilCount)
        for (let i = 0; i < normalRedHanded; i++) queue.push('red_handed')
        for (let i = 0; i < settings.counts.doubleAgent; i++) queue.push('doubleAgent')
        for (let i = 0; i < settings.counts.infiltrator; i++) queue.push('infiltrator')
        for (let i = 0; i < settings.counts.kamikaze; i++) queue.push('kamikaze')
        for (let i = 0; i < settings.counts.corruptor; i++) queue.push('corruptor')
        for (let i = 0; i < settings.counts.inverter; i++) queue.push('inverter')
        if (settings.counts.evilTwins > 0) {
          queue.push('twinRedHanded')
          queue.push('twinVillager')
        }
        for (let i = 0; i < settings.counts.detective; i++) queue.push('detective')
        for (let i = 0; i < settings.counts.guardian; i++) queue.push('guardian')
        for (let i = 0; i < settings.counts.mayor; i++) queue.push('mayor')
        for (let i = 0; i < settings.counts.judge; i++) queue.push('judge')
        for (let i = 0; i < settings.counts.revenant; i++) queue.push('revenant')
        for (let i = 0; i < settings.counts.jester; i++) queue.push('jester')
        while (queue.length < playerOrder.length) queue.push('villager')
        queue.length = playerOrder.length

        roles = playerOrder.map((name, i) => {
          const role = queue[i]
          // RedHanded-side words: redHanded, doubleAgent, kamikaze, corruptor, inverter, twinRedHanded
          // Villager-side words: everything else (including infiltrator — that's the twist)
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
        roles = playerOrder.map((name, i) => ({
          name,
          role: (i < settings.redHandedCount ? 'red_handed' : 'villager') as OfflineRole,
          word: i < settings.redHandedCount ? pair.redHandedWord : pair.villagerWord,
          isEliminated: false,
        }))
      }

      setWordPair(pair)
      setPlayers(shuffleArray(roles))
      setPhase('dealing')
    },
    [i18n.language],
  )

  const [manualReveal, setManualReveal] = useState(false)
  const handleDealingDone = useCallback(() => setPhase('playing'), [])
  const handleRevealRoles = useCallback((updated: OfflinePlayer[], manual = false) => {
    setManualReveal(manual)
    setPlayers(updated)
    setPhase('results')
  }, [])
  const handlePlayAgain = useCallback(() => {
    setPhase('setup')
    setPlayers([])
    setWordPair({ villagerWord: '', redHandedWord: '' })
  }, [])
  const handleHome = useCallback(() => router.back(), [router])

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <View className="flex-1" style={contentStyle}>
        {phase === 'setup' && (
          <SetupPhase
            initial={lastSettings}
            onStart={handleStart}
            onBack={() => router.back()}
            isTablet={isTablet}
            px={px}
            fontScale={fontScale}
          />
        )}
        {phase === 'dealing' && (
          <DealingPhase
            players={players}
            wordPair={wordPair}
            onDone={handleDealingDone}
            isTablet={isTablet}
            px={px}
            fontScale={fontScale}
          />
        )}
        {phase === 'playing' && (
          <PlayingPhase
            initialPlayers={players}
            gameMode={gameMode}
            wordPair={wordPair}
            onRevealRoles={handleRevealRoles}
            isTablet={isTablet}
            px={px}
            fontScale={fontScale}
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
            isTablet={isTablet}
            px={px}
            fontScale={fontScale}
          />
        )}
      </View>
    </SafeAreaView>
  )
}
