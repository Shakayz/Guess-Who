import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import * as Sharing from 'expo-sharing'
import { useAuthStore } from '../../store/auth'
import { useGameStore } from '../../store/game'
import { connectSocket, getSocket } from '../../lib/socket'
import { api } from '../../lib/api'
import {
  WORD_CATEGORIES,
  ZERO_SPECIAL_COUNTS,
  autoReduceOverflow,
  clampImposterCount,
  computeMaxRoleCounts,
  isNeutralUnlocked,
  maxImpostersFor,
} from '@imposter/shared'
import type { Room, GameMode, WordCategory, SpecialRoleCounts } from '@imposter/shared'
import { useResponsive } from '../../lib/responsive'
import { createLogger } from '../../lib/logger'
import { SoundManager } from '../../lib/sounds'
import { HapticManager } from '../../lib/haptics'

const log = createLogger('lobby-screen')

// ─── NumStepper ──────────────────────────────────────────────────────────────

function NumStepper({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-1">
      <Text className="text-sm text-neutral-300 flex-1">{label}</Text>
      <View className="flex-row items-center gap-2">
        <TouchableOpacity
          onPress={() => onChange(Math.max(min, value - step))}
          className="w-8 h-8 rounded-lg bg-neutral-800 items-center justify-center"
        >
          <Text className="text-white font-bold text-lg">−</Text>
        </TouchableOpacity>
        <Text className="text-sm font-mono font-semibold text-white w-14 text-center">
          {format ? format(value) : value}
        </Text>
        <TouchableOpacity
          onPress={() => onChange(Math.min(max, value + step))}
          className="w-8 h-8 rounded-lg bg-neutral-800 items-center justify-center"
        >
          <Text className="text-white font-bold text-lg">+</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── RoleStepper ─────────────────────────────────────────────────────────────
// Single special-role row used by villager / imposter / pair / neutral
// sections. Mirrors the web `RoleStepper` shape with NativeWind classes.

const ROLE_STEPPER_ACCENT = {
  emerald: {
    chip: 'bg-emerald-950/40 border-emerald-700/40',
    chipText: 'text-emerald-300',
    value: 'text-emerald-300',
  },
  red: {
    chip: 'bg-red-950/40 border-red-700/40',
    chipText: 'text-red-300',
    value: 'text-red-300',
  },
  sky: {
    chip: 'bg-sky-950/40 border-sky-700/40',
    chipText: 'text-sky-300',
    value: 'text-sky-300',
  },
} as const

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
}: {
  icon: string
  label: string
  description: string
  value: number
  min?: number
  max: number
  onChange: (v: number) => void
  accent: keyof typeof ROLE_STEPPER_ACCENT
  lockedReason?: string | null
}) {
  const isLocked = !!lockedReason
  const canDec = !isLocked && value > min
  const canInc = !isLocked && value < max
  const a = ROLE_STEPPER_ACCENT[accent]
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
          <Text className={['text-sm', a.chipText].join(' ')}>{icon}</Text>
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-semibold text-white" numberOfLines={1}>
            {label}
          </Text>
          <Text className="text-[10px] text-neutral-500" numberOfLines={1}>
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
          className={[
            'text-sm font-mono font-bold w-7 text-center',
            isLocked ? 'text-neutral-600' : a.value,
          ].join(' ')}
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

// ─── RoleGuideRow ────────────────────────────────────────────────────────────
// Compact role description row for the "Role Guide" section at the bottom of
// the lobby. Shows icon, name, and a one-liner of what the role does.

const ROLE_GUIDE_ACCENT = {
  emerald: { border: 'border-emerald-800/40', name: 'text-emerald-300' },
  red:     { border: 'border-red-800/40',     name: 'text-red-300' },
  amber:   { border: 'border-amber-800/40',   name: 'text-amber-300' },
  sky:     { border: 'border-sky-800/40',      name: 'text-sky-300' },
} as const

function RoleGuideRow({
  icon,
  name,
  desc,
  accent,
}: {
  icon: string
  name: string
  desc: string
  accent: keyof typeof ROLE_GUIDE_ACCENT
}) {
  const a = ROLE_GUIDE_ACCENT[accent]
  return (
    <View className={['flex-row items-start gap-2.5 px-3 py-2.5 rounded-xl border bg-neutral-900/40', a.border].join(' ')}>
      <Text style={{ fontSize: 16, marginTop: 1 }}>{icon}</Text>
      <View className="flex-1">
        <Text className={['text-xs font-bold', a.name].join(' ')}>{name}</Text>
        <Text className="text-[11px] text-neutral-500 mt-0.5 leading-[15px]">{desc}</Text>
      </View>
    </View>
  )
}

// ─── SettingsPanel ────────────────────────────────────────────────────────────

interface Settings {
  maxPlayers: number
  imposterCount: number
  speakingTimeSeconds: number
  votingTimeSeconds: number
  maxRounds: number
  gameMode: GameMode | 'special'
  categories: WordCategory[]
  // Per-role counts (mirror web). `evilTwinsEnabled` is the wire field name
  // for the twin pair toggle (0 or 1).
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
  evilTwinsEnabled: number
}

/** Pull a `SpecialRoleCounts` shape out of the lobby `Settings` for the
 *  shared math helpers. The shared `evilTwins` field maps to `evilTwinsEnabled`. */
function settingsToCounts(s: Settings): SpecialRoleCounts {
  return {
    detective:   s.detectiveCount,
    guardian:    s.guardianCount,
    mayor:       s.mayorCount,
    judge:       s.judgeCount,
    revenant:    s.revenantCount,
    doubleAgent: s.doubleAgentCount,
    infiltrator: s.infiltratorCount,
    kamikaze:    s.kamikazeCount,
    corruptor:   s.corruptorCount,
    inverter:    s.inverterCount,
    evilTwins:   s.evilTwinsEnabled,
    jester:      s.jesterCount,
  }
}

function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings
  onChange: (s: Settings) => void
}) {
  const toggleCategory = (key: WordCategory) => {
    const cats = settings.categories.includes(key)
      ? settings.categories.filter((c) => c !== key)
      : [...settings.categories, key]
    onChange({ ...settings, categories: cats })
  }

  return (
    <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 gap-4">
      <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Room Settings
      </Text>

      {/* Game Mode */}
      <View>
        <Text className="text-xs text-neutral-500 mb-2">Game Mode</Text>
        <View className="flex-row gap-2">
          {(['normal', 'special', 'ranked'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => {
                // Reset all role counts when leaving special mode.
                const reset = mode === 'special' ? {} : { ...ZERO_SPECIAL_COUNTS }
                onChange({
                  ...settings,
                  gameMode: mode,
                  categories: mode === 'ranked' ? [] : settings.categories,
                  detectiveCount:   mode === 'special' ? settings.detectiveCount   : 0,
                  doubleAgentCount: mode === 'special' ? settings.doubleAgentCount : 0,
                  guardianCount:    mode === 'special' ? settings.guardianCount    : 0,
                  mayorCount:       mode === 'special' ? settings.mayorCount       : 0,
                  judgeCount:       mode === 'special' ? settings.judgeCount       : 0,
                  revenantCount:    mode === 'special' ? settings.revenantCount    : 0,
                  infiltratorCount: mode === 'special' ? settings.infiltratorCount : 0,
                  jesterCount:      mode === 'special' ? settings.jesterCount      : 0,
                  kamikazeCount:    mode === 'special' ? settings.kamikazeCount    : 0,
                  corruptorCount:   mode === 'special' ? settings.corruptorCount   : 0,
                  inverterCount:    mode === 'special' ? settings.inverterCount    : 0,
                  evilTwinsEnabled: mode === 'special' ? settings.evilTwinsEnabled : 0,
                })
                void reset
              }}
              className={[
                'flex-1 py-2.5 rounded-xl items-center border',
                settings.gameMode === mode
                  ? mode === 'ranked'
                    ? 'bg-amber-950 border-amber-700'
                    : mode === 'special'
                    ? 'bg-cyan-950 border-cyan-700'
                    : 'bg-violet-950 border-violet-700'
                  : 'bg-neutral-800 border-neutral-700',
              ].join(' ')}
            >
              <Text
                className={[
                  'text-xs font-semibold',
                  settings.gameMode === mode
                    ? mode === 'ranked'
                      ? 'text-amber-400'
                      : mode === 'special'
                      ? 'text-cyan-400'
                      : 'text-violet-400'
                    : 'text-neutral-400',
                ].join(' ')}
              >
                {mode === 'ranked' ? '🏆 Ranked' : mode === 'special' ? '🔮 Special' : '🎮 Normal'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text className="text-xs text-neutral-600 mt-1.5">
          {settings.gameMode === 'ranked'
            ? 'All categories — affects LP'
            : settings.gameMode === 'special'
            ? 'Special roles enabled — custom rules'
            : 'Custom categories — no LP impact'}
        </Text>
      </View>

      {/* Special Roles (special mode only) */}
      {settings.gameMode === 'special' && (() => {
        const counts = settingsToCounts(settings)
        const max = computeMaxRoleCounts(settings.maxPlayers, settings.imposterCount, counts)
        const neutralUnlocked = isNeutralUnlocked(settings.maxPlayers)
        const neutralLockReason = neutralUnlocked ? null : 'Unlocked at 10+ players.'
        return (
          <View className="gap-4 pt-2 border-t border-neutral-800">
            <Text className="text-xs text-neutral-500">Special Roles</Text>

            {/* Villager side */}
            <View className="gap-2">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                🟢 Villagers
              </Text>
              <RoleStepper
                icon="🔍"
                label="Detective"
                description="Each round, secretly checks if a chosen player is an imposter."
                value={settings.detectiveCount}
                max={max.detective}
                onChange={(v) => onChange({ ...settings, detectiveCount: v })}
                accent="emerald"
              />
              <RoleStepper
                icon="🛡️"
                label="Guardian"
                description="Protects a chosen player from elimination for one round."
                value={settings.guardianCount}
                max={max.guardian}
                onChange={(v) => onChange({ ...settings, guardianCount: v })}
                accent="emerald"
              />
              <RoleStepper
                icon="👑"
                label="Mayor"
                description="Their vote counts double during the voting phase."
                value={settings.mayorCount}
                max={max.mayor}
                onChange={(v) => onChange({ ...settings, mayorCount: v })}
                accent="emerald"
              />
              <RoleStepper
                icon="⚖️"
                label="Judge"
                description="Can veto one elimination per game."
                value={settings.judgeCount}
                max={max.judge}
                onChange={(v) => onChange({ ...settings, judgeCount: v })}
                accent="emerald"
              />
              <RoleStepper
                icon="👻"
                label="Revenant"
                description="If eliminated, returns once during the next round."
                value={settings.revenantCount}
                max={max.revenant}
                onChange={(v) => onChange({ ...settings, revenantCount: v })}
                accent="emerald"
              />
            </View>

            {/* Imposter side */}
            <View className="gap-2">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
                🔴 Imposters
              </Text>
              <RoleStepper
                icon="🕵️"
                label="Double Agent"
                description="Pretends to be a villager but wins with the imposters."
                value={settings.doubleAgentCount}
                max={max.doubleAgent}
                onChange={(v) => onChange({ ...settings, doubleAgentCount: v })}
                accent="red"
              />
              <RoleStepper
                icon="🥷"
                label="Infiltrator"
                description="An extra imposter who starts knowing the villager word."
                value={settings.infiltratorCount}
                max={max.infiltrator}
                onChange={(v) => onChange({ ...settings, infiltratorCount: v })}
                accent="red"
              />
              <RoleStepper
                icon="💣"
                label="Kamikaze"
                description="When voted out, takes the player who cast the most votes with them."
                value={settings.kamikazeCount}
                max={max.kamikaze}
                onChange={(v) => onChange({ ...settings, kamikazeCount: v })}
                accent="red"
              />
              <RoleStepper
                icon="🧪"
                label="Corruptor"
                description="Silences one villager's vote each round."
                value={settings.corruptorCount}
                max={max.corruptor}
                onChange={(v) => onChange({ ...settings, corruptorCount: v })}
                accent="red"
              />
              <RoleStepper
                icon="🔀"
                label="Inverter"
                description="Once per game, swaps the result of a vote (majority ↔ minority)."
                value={settings.inverterCount}
                max={max.inverter}
                onChange={(v) => onChange({ ...settings, inverterCount: v })}
                accent="red"
              />
            </View>

            {/* Pair */}
            <View className="gap-2">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                ⚖️ Pair
              </Text>
              <RoleStepper
                icon="👯"
                label="Evil Twins"
                description="One secret villager twin + one secret imposter twin (counts as 2 players)."
                value={settings.evilTwinsEnabled}
                max={max.evilTwins}
                onChange={(v) => onChange({ ...settings, evilTwinsEnabled: v })}
                accent="sky"
              />
            </View>

            {/* Neutral */}
            <View className="gap-2">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">
                ⚪ Neutral
              </Text>
              <RoleStepper
                icon="🃏"
                label="Jester"
                description="Wins alone if voted out. Plays for nobody."
                value={settings.jesterCount}
                max={max.jester}
                onChange={(v) => onChange({ ...settings, jesterCount: v })}
                accent="sky"
                lockedReason={neutralLockReason}
              />
            </View>
          </View>
        )
      })()}

      {/* Categories (normal / special only) */}
      {settings.gameMode !== 'ranked' && (
        <View>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs text-neutral-500">Categories</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() =>
                  onChange({
                    ...settings,
                    categories: WORD_CATEGORIES.map((c) => c.key as WordCategory),
                  })
                }
              >
                <Text className="text-xs text-violet-400">All</Text>
              </TouchableOpacity>
              <Text className="text-neutral-700">·</Text>
              <TouchableOpacity onPress={() => onChange({ ...settings, categories: [] })}>
                <Text className="text-xs text-neutral-500">None</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            {WORD_CATEGORIES.map((cat) => {
              const selected = settings.categories.includes(cat.key as WordCategory)
              const allSelected = settings.categories.length === 0
              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => toggleCategory(cat.key as WordCategory)}
                  className={[
                    'flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg border',
                    selected
                      ? 'bg-violet-950 border-violet-700'
                      : allSelected
                      ? 'bg-neutral-800 border-neutral-700'
                      : 'bg-neutral-900 border-neutral-800',
                  ].join(' ')}
                >
                  <Text className="text-sm">{cat.icon}</Text>
                  <Text
                    className={[
                      'text-xs font-medium',
                      selected ? 'text-violet-300' : allSelected ? 'text-neutral-400' : 'text-neutral-600',
                    ].join(' ')}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          {settings.categories.length === 0 && (
            <Text className="text-xs text-neutral-600 mt-1">No filter — all categories included</Text>
          )}
        </View>
      )}

      {/* Numeric settings */}
      <View className="gap-3 pt-2 border-t border-neutral-800">
        <NumStepper
          label="Max Players"
          value={settings.maxPlayers}
          min={3}
          max={20}
          onChange={(v) => {
            // Auto-clamp imposters and reduce evil-side overflow when player count drops.
            const nextImposters = clampImposterCount(v, settings.imposterCount)
            const reduced = autoReduceOverflow(v, nextImposters, settingsToCounts(settings))
            onChange({
              ...settings,
              maxPlayers: v,
              imposterCount: nextImposters,
              detectiveCount:   reduced.counts.detective,
              guardianCount:    reduced.counts.guardian,
              mayorCount:       reduced.counts.mayor,
              judgeCount:       reduced.counts.judge,
              revenantCount:    reduced.counts.revenant,
              doubleAgentCount: reduced.counts.doubleAgent,
              infiltratorCount: reduced.counts.infiltrator,
              kamikazeCount:    reduced.counts.kamikaze,
              corruptorCount:   reduced.counts.corruptor,
              inverterCount:    reduced.counts.inverter,
              evilTwinsEnabled: reduced.counts.evilTwins,
              jesterCount:      isNeutralUnlocked(v) ? settings.jesterCount : 0,
            })
          }}
        />
        <NumStepper
          label="Imposters"
          value={settings.imposterCount}
          min={1}
          max={maxImpostersFor(settings.maxPlayers)}
          onChange={(v) => {
            const clamped = clampImposterCount(settings.maxPlayers, v)
            const reduced = autoReduceOverflow(settings.maxPlayers, clamped, settingsToCounts(settings))
            onChange({
              ...settings,
              imposterCount: clamped,
              doubleAgentCount: reduced.counts.doubleAgent,
              infiltratorCount: reduced.counts.infiltrator,
              kamikazeCount:    reduced.counts.kamikaze,
              corruptorCount:   reduced.counts.corruptor,
              inverterCount:    reduced.counts.inverter,
              evilTwinsEnabled: reduced.counts.evilTwins,
            })
          }}
        />
        <NumStepper
          label="Max Rounds"
          value={settings.maxRounds}
          min={0}
          max={20}
          format={(v) => (v === 0 ? '∞' : `${v}`)}
          onChange={(v) => onChange({ ...settings, maxRounds: v })}
        />
        <NumStepper
          label="Speaking Time"
          value={settings.speakingTimeSeconds}
          min={10}
          max={120}
          step={5}
          format={(v) => `${v}s`}
          onChange={(v) => onChange({ ...settings, speakingTimeSeconds: v })}
        />
        <NumStepper
          label="Voting Time"
          value={settings.votingTimeSeconds}
          min={15}
          max={120}
          step={5}
          format={(v) => `${v}s`}
          onChange={(v) => onChange({ ...settings, votingTimeSeconds: v })}
        />
      </View>
    </View>
  )
}

// ─── Friend invite types ─────────────────────────────────────────────────────

interface Friend {
  id: string
  username: string
  status?: string
}

// ─── LobbyScreen ─────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  maxPlayers: 10,
  imposterCount: 2,
  speakingTimeSeconds: 30,
  votingTimeSeconds: 30,
  maxRounds: 0,
  gameMode: 'normal',
  categories: [],
  detectiveCount:   0,
  doubleAgentCount: 0,
  guardianCount:    0,
  mayorCount:       0,
  judgeCount:       0,
  revenantCount:    0,
  infiltratorCount: 0,
  jesterCount:      0,
  kamikazeCount:    0,
  corruptorCount:   0,
  inverterCount:    0,
  evilTwinsEnabled: 0,
}

export default function LobbyScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { room, setRoom, setRoleAndWord, setRound } = useGameStore()
  const { isTablet, px, fontScale } = useResponsive()

  const [isReady, setIsReady] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [codeCopied, setCodeCopied] = useState(false)
  const [socketError, setSocketError] = useState<string | null>(null)

  // Friends invite state
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [showFriends, setShowFriends] = useState(false)

  // ─── Settings change ────────────────────────────────────────────────────

  const handleSettingsChange = (s: Settings) => {
    setSettings(s)
    HapticManager.selection()
    getSocket().emit('room:settings' as any, {
      gameMode: s.gameMode,
      categories: s.categories,
      maxPlayers: s.maxPlayers,
      imposterCount: s.imposterCount,
      speakingTimeSeconds: s.speakingTimeSeconds,
      votingTimeSeconds: s.votingTimeSeconds,
      maxRounds: s.maxRounds,
      detectiveCount:   s.detectiveCount,
      doubleAgentCount: s.doubleAgentCount,
      guardianCount:    s.guardianCount,
      mayorCount:       s.mayorCount,
      judgeCount:       s.judgeCount,
      revenantCount:    s.revenantCount,
      infiltratorCount: s.infiltratorCount,
      jesterCount:      s.jesterCount,
      kamikazeCount:    s.kamikazeCount,
      corruptorCount:   s.corruptorCount,
      inverterCount:    s.inverterCount,
      evilTwinsEnabled: s.evilTwinsEnabled,
    })
  }

  // ─── Copy room code ─────────────────────────────────────────────────────

  const copyRoomCode = useCallback(async () => {
    if (!code) return
    await Clipboard.setStringAsync(code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }, [code])

  // ─── Share room code ────────────────────────────────────────────────────

  const shareRoomCode = useCallback(async () => {
    if (!code) return
    const isAvailable = await Sharing.isAvailableAsync()
    if (isAvailable) {
      // Sharing.shareAsync requires a file URI; for plain text we use Alert fallback
      // or we can use the Share API from react-native instead
      Alert.alert('Share Room Code', `Join my game! Room code: ${code}`, [
        { text: 'Copy & Share', onPress: copyRoomCode },
        { text: 'Cancel', style: 'cancel' },
      ])
    } else {
      await copyRoomCode()
    }
  }, [code, copyRoomCode])

  // ─── Fetch friends ──────────────────────────────────────────────────────

  const fetchFriends = useCallback(async () => {
    setFriendsLoading(true)
    try {
      const data = await api.get<{ friends: Friend[] }>('/friends')
      setFriends(data.friends ?? [])
    } catch (err: any) {
      log.warn('failed to fetch friends', { error: err?.message })
      setFriends([])
    } finally {
      setFriendsLoading(false)
    }
  }, [])

  const inviteFriend = useCallback(
    (friendId: string) => {
      if (!code) return
      getSocket().emit('room:invite' as any, { toUserId: friendId, roomCode: code })
      setInvitedIds((prev) => new Set(prev).add(friendId))
    },
    [code],
  )

  // ─── Socket setup ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!code) return
    log.info('joining room', { code })
    connectSocket()
    const socket = getSocket()
    socket.emit('room:join', { roomCode: code })

    socket.on('room:updated', (r) => {
      log.debug('room updated', { players: r.players?.length, status: (r as any).status })
      setRoom(r as Room)
      if (r.settings) {
        const rs: any = r.settings
        setSettings((prev) => ({
          ...prev,
          maxPlayers: r.settings.maxPlayers,
          imposterCount: r.settings.imposterCount,
          speakingTimeSeconds: r.settings.speakingTimeSeconds,
          votingTimeSeconds: r.settings.votingTimeSeconds,
          maxRounds: rs.maxRounds ?? 0,
          gameMode: rs.gameMode ?? 'normal',
          categories: rs.categories ?? [],
          detectiveCount:   rs.detectiveCount   ?? (rs.hasDetective ? 1 : 0),
          doubleAgentCount: rs.doubleAgentCount ?? (rs.hasDoubleAgent ? 1 : 0),
          guardianCount:    rs.guardianCount    ?? 0,
          mayorCount:       rs.mayorCount       ?? 0,
          judgeCount:       rs.judgeCount       ?? 0,
          revenantCount:    rs.revenantCount    ?? 0,
          infiltratorCount: rs.infiltratorCount ?? 0,
          jesterCount:      rs.jesterCount      ?? 0,
          kamikazeCount:    rs.kamikazeCount    ?? 0,
          corruptorCount:   rs.corruptorCount   ?? 0,
          inverterCount:    rs.inverterCount    ?? 0,
          evilTwinsEnabled: rs.evilTwinsEnabled ?? 0,
        }))
      }
    })

    // Game start was refused because at least one player can't afford the
    // entry cost. Stays non-blocking — everyone stays in the lobby and the
    // host sees a toast naming the broke player.
    socket.on('game:start:failed' as any, (data: { reason?: string; userId?: string; required?: number }) => {
      if (data?.reason !== 'INSUFFICIENT_STARS') return
      const currentRoom = useGameStore.getState().room
      const player = currentRoom?.players?.find((p: any) => p.userId === data.userId)
      const username = (player as any)?.username ?? 'A player'
      log.warn('game:start:failed', { userId: data.userId })
      setSocketError(`${username} doesn't have enough stars (needs ${data.required ?? 10}⭐)`)
      setTimeout(() => setSocketError(null), 5000)
    })

    socket.on('game:started', ({ round, yourWord, yourRole }) => {
      log.info('game started', { role: yourRole, roundId: (round as any)?.id })
      SoundManager.play('game_start')
      setRoleAndWord(yourRole, yourWord)
      setRound(round as any)
      router.replace(`/game/${code}`)
    })

    // Matchmaking events
    socket.on('matchmaking:found' as any, (data: any) => {
      log.info('matchmaking found', { roomCode: data?.roomCode })
    })
    socket.on('matchmaking:cancelled' as any, () => {
      log.info('matchmaking cancelled')
    })

    socket.on('error', (err) => log.error('socket error', { message: (err as any)?.message }))

    return () => {
      socket.off('room:updated')
      socket.off('game:started')
      socket.off('matchmaking:found' as any)
      socket.off('matchmaking:cancelled' as any)
      socket.off('error')
      socket.off('game:start:failed' as any)
    }
  }, [code])

  // ─── Actions ───────────────────────────────────────────────────────────

  const toggleReady = () => {
    SoundManager.play('click')
    HapticManager.light()
    getSocket().emit('player:ready', !isReady)
    setIsReady((r) => !r)
  }

  const startGame = () => getSocket().emit('game:start')

  const handleLeave = () => {
    getSocket().emit('room:leave')
    router.replace('/')
  }

  // ─── Derived state ─────────────────────────────────────────────────────

  const isHost = room?.hostId === user?.id
  const players = room?.players ?? []
  const allReady = players.length >= 2 && players.every((p) => p.isReady || p.isHost)
  const minPlayers = settings.gameMode === 'special' ? 5 : 3
  const activeCats =
    settings.categories.length > 0 ? settings.categories.length : WORD_CATEGORIES.length
  const totalSpecialRoles =
    settings.detectiveCount +
    settings.doubleAgentCount +
    settings.guardianCount +
    settings.mayorCount +
    settings.judgeCount +
    settings.revenantCount +
    settings.infiltratorCount +
    settings.jesterCount +
    settings.kamikazeCount +
    settings.corruptorCount +
    settings.inverterCount +
    settings.evilTwinsEnabled

  const contentStyle = isTablet ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const } : {}

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: px, gap: isTablet ? 16 : 12 }}>

        <View style={contentStyle}>
        {/* Header */}
        <View className="items-center mb-2">
          <View className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 mb-2">
            <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <Text className="text-emerald-400 font-semibold" style={{ fontSize: 11 * fontScale }}>Waiting for players</Text>
          </View>
          <Text className="font-extrabold text-white" style={{ fontSize: (isTablet ? 28 : 24) }}>Lobby</Text>
          <Text className="text-neutral-500 mt-1" style={{ fontSize: 14 * fontScale }}>Share the code below to invite friends</Text>
        </View>

        {/* Socket error toast (e.g. INSUFFICIENT_STARS on game start) */}
        {socketError && (
          <View className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800 mb-2">
            <Text className="text-red-300 text-xs flex-1">⚠ {socketError}</Text>
          </View>
        )}

        {/* Room code + share */}
        <TouchableOpacity
          onPress={copyRoomCode}
          className="bg-neutral-900 border-2 border-violet-800/50 rounded-2xl items-center overflow-hidden"
          style={{ paddingVertical: isTablet ? 28 : 22, paddingHorizontal: isTablet ? 24 : 20 }}
          activeOpacity={0.8}
        >
          {/* Top accent */}
          <View className="absolute top-0 left-0 right-0 h-1 bg-violet-600/70" />
          {/* Subtle bg glow */}
          <View className="absolute inset-0 bg-violet-950/20" />
          <Text className="font-bold uppercase tracking-[0.2em] text-violet-500 mb-3" style={{ fontSize: 11 * fontScale }}>Room Code</Text>
          <Text className="font-black font-mono text-white" style={{ fontSize: (isTablet ? 56 : 46), letterSpacing: 10 }}>{code}</Text>
          <View
            className={[
              'flex-row items-center gap-1.5 mt-3 px-3 py-1 rounded-full border',
              codeCopied ? 'bg-emerald-950/50 border-emerald-700/50' : 'bg-neutral-800/60 border-neutral-700/50',
            ].join(' ')}
          >
            <Text className={['text-xs font-semibold', codeCopied ? 'text-emerald-400' : 'text-neutral-500'].join(' ')}>
              {codeCopied ? '✓ Copied to clipboard!' : '📋 Tap to copy'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Share button */}
        <TouchableOpacity
          onPress={shareRoomCode}
          className="flex-row items-center justify-center gap-2 py-3.5 rounded-xl bg-violet-950 border border-violet-800/60"
          activeOpacity={0.8}
        >
          <Text className="text-violet-300 font-semibold" style={{ fontSize: 14 * fontScale }}>📤 Share Room Code</Text>
        </TouchableOpacity>

        {/* Player list */}
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Players</Text>
            <Text className="text-xs text-neutral-500 tabular-nums">
              {players.length} / {settings.maxPlayers}
            </Text>
          </View>

          {players.length === 0 ? (
            <View className="items-center py-10">
              <View className="flex-row gap-2 mb-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <View
                    key={i}
                    className="rounded-full bg-neutral-800/60 border-2 border-dashed border-neutral-700/60"
                    style={{ width: 36, height: 36 }}
                  />
                ))}
              </View>
              <Text className="text-neutral-400 font-semibold" style={{ fontSize: 14 * fontScale }}>Waiting for players...</Text>
              <Text className="text-neutral-600 text-xs mt-1">Need at least {minPlayers} to start</Text>
            </View>
          ) : (
            <View className="gap-2">
              {players.map((p) => {
                const isReady = p.isReady || p.isHost
                const isMe = p.userId === user?.id
                return (
                  <View
                    key={p.id}
                    className={[
                      'flex-row items-center gap-3 px-3 py-3 rounded-xl border overflow-hidden',
                      isMe
                        ? 'border-violet-700/50 bg-violet-950/25'
                        : 'border-neutral-800/60 bg-neutral-800/15',
                    ].join(' ')}
                  >
                    {/* Left ready indicator stripe */}
                    <View
                      className="absolute left-0 top-0 bottom-0 w-0.5"
                      style={{ backgroundColor: isReady ? '#10b981' : 'transparent' }}
                    />
                    {/* Avatar */}
                    <View
                      className={[
                        'rounded-full items-center justify-center border',
                        p.isHost
                          ? 'bg-amber-800/60 border-amber-700/50'
                          : isMe
                          ? 'bg-violet-700/70 border-violet-600/50'
                          : 'bg-neutral-700 border-neutral-600/50',
                      ].join(' ')}
                      style={{ width: 36, height: 36 }}
                    >
                      <Text className="text-white font-bold" style={{ fontSize: 14 }}>
                        {p.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        <Text className="text-white font-semibold" style={{ fontSize: 14 * fontScale }}>{p.username}</Text>
                        {p.isHost && (
                          <View className="px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-700/40">
                            <Text className="text-[9px] text-amber-400 font-bold uppercase">Host</Text>
                          </View>
                        )}
                        {isMe && !p.isHost && (
                          <View className="px-1.5 py-0.5 rounded bg-violet-900/60 border border-violet-700/40">
                            <Text className="text-[9px] text-violet-400 font-bold uppercase">You</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {/* Ready pill */}
                    <View
                      className={[
                        'flex-row items-center gap-1 px-2.5 py-1 rounded-full border',
                        isReady
                          ? 'bg-emerald-950/60 border-emerald-700/50'
                          : 'bg-neutral-800/60 border-neutral-700/40',
                      ].join(' ')}
                    >
                      {isReady && <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      <Text
                        className={[
                          'text-[10px] font-bold',
                          isReady ? 'text-emerald-400' : 'text-neutral-600',
                        ].join(' ')}
                      >
                        {isReady ? 'Ready' : 'Waiting'}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* Not enough players warning */}
        {players.length > 0 && players.length < minPlayers && (
          <View className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-950 border border-amber-800">
            <Text className="text-amber-400 text-xs">
              ⚠ Need at least {minPlayers} players ({minPlayers - players.length} more needed)
            </Text>
          </View>
        )}

        {/* Invite Friends section */}
        <TouchableOpacity
          onPress={() => {
            setShowFriends((s) => !s)
            if (!showFriends && friends.length === 0) fetchFriends()
          }}
          className="flex-row items-center justify-between px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700"
          activeOpacity={0.8}
        >
          <Text className="text-neutral-300 font-medium text-sm">👥 Invite Friends</Text>
          <Text className="text-neutral-500 text-xs">{showFriends ? '▴' : '▾'}</Text>
        </TouchableOpacity>

        {showFriends && (
          <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            {friendsLoading ? (
              <View className="items-center py-4">
                <ActivityIndicator color="#a78bfa" size="small" />
                <Text className="text-neutral-500 text-xs mt-2">Loading friends...</Text>
              </View>
            ) : friends.length === 0 ? (
              <View className="items-center py-4">
                <Text className="text-neutral-500 text-sm">No friends found</Text>
                <Text className="text-neutral-600 text-xs mt-1">Add friends from the Friends tab</Text>
              </View>
            ) : (
              <View className="gap-2">
                {friends.map((friend) => {
                  const invited = invitedIds.has(friend.id)
                  return (
                    <View
                      key={friend.id}
                      className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl border border-neutral-800 bg-neutral-800/30"
                    >
                      <View className="w-8 h-8 rounded-full bg-cyan-700 items-center justify-center">
                        <Text className="text-white text-sm font-bold">
                          {friend.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-white font-semibold text-sm">{friend.username}</Text>
                        {friend.status && (
                          <Text className="text-neutral-500 text-xs">{friend.status}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => inviteFriend(friend.id)}
                        disabled={invited}
                        className={[
                          'px-3 py-1.5 rounded-lg',
                          invited ? 'bg-emerald-900' : 'bg-violet-700',
                        ].join(' ')}
                        activeOpacity={0.8}
                      >
                        <Text
                          className={[
                            'text-xs font-semibold',
                            invited ? 'text-emerald-400' : 'text-white',
                          ].join(' ')}
                        >
                          {invited ? '✓ Invited' : 'Invite'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}

        {/* Settings toggle (host only) */}
        {isHost && (
          <TouchableOpacity
            onPress={() => setShowSettings((s) => !s)}
            className="flex-row items-center justify-between px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700"
            activeOpacity={0.8}
          >
            <Text className="text-neutral-300 font-medium text-sm">⚙ Room Settings</Text>
            <View className="flex-row items-center gap-2">
              <Text
                className={[
                  'text-xs font-semibold',
                  settings.gameMode === 'ranked'
                    ? 'text-amber-400'
                    : settings.gameMode === 'special'
                    ? 'text-cyan-400'
                    : 'text-violet-400',
                ].join(' ')}
              >
                {settings.gameMode === 'ranked'
                  ? '🏆 Ranked'
                  : settings.gameMode === 'special'
                  ? '🔮 Special'
                  : '🎮 Normal'}
              </Text>
              <Text className="text-neutral-700">·</Text>
              <Text className="text-neutral-500 text-xs">{activeCats} cats</Text>
              {settings.maxRounds > 0 && (
                <>
                  <Text className="text-neutral-700">·</Text>
                  <Text className="text-neutral-500 text-xs">{settings.maxRounds} rnd</Text>
                </>
              )}
              <Text className="text-neutral-500 text-xs">{showSettings ? '▴' : '▾'}</Text>
            </View>
          </TouchableOpacity>
        )}

        {isHost && showSettings && (
          <SettingsPanel settings={settings} onChange={handleSettingsChange} />
        )}

        {/* Settings summary (non-host) */}
        {!isHost && (
          <View className="flex-row flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800">
            <Text className="text-xs text-neutral-500">
              {settings.gameMode === 'ranked' ? '🏆' : settings.gameMode === 'special' ? '🔮' : '🎮'}
            </Text>
            <Text className="text-xs text-neutral-500 capitalize">{settings.gameMode}</Text>
            <Text className="text-neutral-700">·</Text>
            <Text className="text-xs text-neutral-500">{settings.maxPlayers} max</Text>
            <Text className="text-neutral-700">·</Text>
            <Text className="text-xs text-neutral-500">{settings.imposterCount} imposters</Text>
            {settings.maxRounds > 0 && (
              <>
                <Text className="text-neutral-700">·</Text>
                <Text className="text-xs text-neutral-500">{settings.maxRounds} rounds</Text>
              </>
            )}
            {settings.gameMode !== 'ranked' && settings.categories.length > 0 && (
              <>
                <Text className="text-neutral-700">·</Text>
                <Text className="text-xs text-neutral-500">{settings.categories.length} categories</Text>
              </>
            )}
            {settings.gameMode === 'special' && totalSpecialRoles > 0 && (
              <>
                <Text className="text-neutral-700">·</Text>
                <Text className="text-xs text-cyan-500">{totalSpecialRoles} special role{totalSpecialRoles === 1 ? '' : 's'}</Text>
              </>
            )}
          </View>
        )}

        {/* Action buttons */}
        <View className="flex-row gap-3 mt-2">
          <TouchableOpacity
            onPress={handleLeave}
            className="px-4 rounded-xl bg-neutral-800 border border-neutral-700 items-center justify-center"
            activeOpacity={0.8}
            style={{ paddingVertical: isTablet ? 16 : 13 }}
          >
            <Text className="text-neutral-400 font-semibold" style={{ fontSize: 14 * fontScale }}>← Leave</Text>
          </TouchableOpacity>

          {!isHost ? (
            <TouchableOpacity
              onPress={toggleReady}
              className={[
                'flex-1 rounded-2xl items-center overflow-hidden',
                isReady ? 'bg-emerald-600' : 'bg-neutral-800 border border-neutral-700',
              ].join(' ')}
              activeOpacity={0.8}
              style={{ paddingVertical: isTablet ? 16 : 13 }}
            >
              {isReady && (
                <View className="absolute top-0 left-0 right-0 h-1/2 rounded-t-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
              )}
              <Text
                className={[
                  'font-bold tracking-wide',
                  isReady ? 'text-white' : 'text-neutral-300',
                ].join(' ')}
                style={{ fontSize: 15 * fontScale }}
              >
                {isReady ? '✓ Ready' : 'Set Ready'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={startGame}
              disabled={!allReady}
              className={[
                'flex-1 rounded-2xl items-center overflow-hidden',
                allReady ? 'bg-violet-600' : 'bg-violet-950 border border-violet-900/40',
              ].join(' ')}
              activeOpacity={0.8}
              style={{ paddingVertical: isTablet ? 16 : 13, opacity: allReady ? 1 : 0.5 }}
            >
              {allReady && (
                <View className="absolute top-0 left-0 right-0 h-1/2 rounded-t-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
              )}
              <Text className="text-white font-extrabold tracking-wide" style={{ fontSize: 15 * fontScale }}>
                {allReady ? '▶ Start Game' : 'Start Game'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isHost && !allReady && players.length >= minPlayers && (
          <View className="flex-row items-center justify-center gap-1.5">
            <View className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <Text className="text-amber-600 text-center" style={{ fontSize: 12 * fontScale }}>
              Waiting for all players to be ready
            </Text>
          </View>
        )}

        {/* How to Play link */}
        <TouchableOpacity
          onPress={() => router.push('/how-to-play')}
          className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-neutral-800/60 border border-neutral-700/50 mt-2"
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 14 }}>📖</Text>
          <Text className="text-neutral-400 font-medium" style={{ fontSize: 13 * fontScale }}>How to Play</Text>
        </TouchableOpacity>

        {/* Special roles guide (visible when special mode is selected) */}
        {settings.gameMode === 'special' && (
          <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 gap-4 mt-1">
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Role Guide
            </Text>

            {/* Villager roles */}
            <View className="gap-2">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                🟢 Villager Side
              </Text>
              <RoleGuideRow icon="🔍" name="Detective" accent="emerald"
                desc="Once per game, secretly reveal another player's role. Use it wisely to confirm suspicions." />
              <RoleGuideRow icon="🛡️" name="Guardian" accent="emerald"
                desc="Once per game, protect a player from being voted out. The vote still happens, but the target survives." />
              <RoleGuideRow icon="👑" name="Mayor" accent="emerald"
                desc="Once per game, activate double vote — your vote counts as two during that round's vote." />
              <RoleGuideRow icon="⚖️" name="Judge" accent="emerald"
                desc="When a vote is tied, the Judge breaks the tie and decides who is eliminated." />
              <RoleGuideRow icon="👻" name="Revenant" accent="emerald"
                desc="After being eliminated, continues to secretly cast votes for 2 more rounds as a ghost." />
            </View>

            {/* Imposter roles */}
            <View className="gap-2">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
                🔴 Imposter Side
              </Text>
              <RoleGuideRow icon="🕵️" name="Double Agent" accent="red"
                desc="Knows the imposters' word and plays for their team, but appears as a villager." />
              <RoleGuideRow icon="🥷" name="Infiltrator" accent="red"
                desc="An imposter who knows the villager word. Appears as villager to the Detective." />
              <RoleGuideRow icon="💣" name="Kamikaze" accent="red"
                desc="When voted out, picks one player to drag down with them — both are eliminated." />
              <RoleGuideRow icon="🧪" name="Corruptor" accent="red"
                desc="At game start, picks a target whose votes are silently dropped for the rest of the game." />
              <RoleGuideRow icon="🔀" name="Inverter" accent="red"
                desc="Once per game, flips the vote — the player with the fewest votes is eliminated instead." />
            </View>

            {/* Pair */}
            <View className="gap-2">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                ⚖️ Pair
              </Text>
              <RoleGuideRow icon="👯" name="Evil Twins" accent="amber"
                desc="A linked pair — one villager, one imposter. They know each other. Both win if both survive to the end." />
            </View>

            {/* Neutral */}
            <View className="gap-2">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">
                ⚪ Neutral
              </Text>
              <RoleGuideRow icon="🃏" name="Jester" accent="sky"
                desc="Wins alone if voted out by the group. Has no team — plays for themselves. Requires 10+ players." />
            </View>
          </View>
        )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
