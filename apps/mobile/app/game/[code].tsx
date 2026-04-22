import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  Modal,
  Animated,
  Easing,
  AccessibilityInfo,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/game'
import { useAuthStore } from '../../store/auth'
import { getSocket } from '../../lib/socket'
import RoleRevealScreen from '../../components/RoleRevealScreen'
import EliminationOverlay from '../../components/EliminationOverlay'
import { InGameChatButton } from '../../components/InGameChatButton'
import { Avatar } from '../../components/Avatar'
import type { Clue } from '@red-handed/shared'
import { useResponsive } from '../../lib/responsive'
import { createLogger } from '../../lib/logger'
import { HapticManager } from '../../lib/haptics'
import { SoundManager } from '../../lib/sounds'
import { UrgentPulse, Heartbeat } from '../../components/anim/AnimatedViews'
import { Wordmark } from '../../components/Wordmark'
import { VoiceChannel } from '../../lib/voice'
import { FloatingEmote } from '../../components/emotes/FloatingEmote'
import { useEmotesStore } from '../../store/emotes'
import { getEmoteById, DEFAULT_LOADOUT, WORD_CATEGORIES, isRedHandedSideRole, isVillagerSideRole, isJesterRole, type EmoteRarity, type WordCategory } from '@red-handed/shared'

const log = createLogger('game-screen')

type Phase = 'speaking' | 'voting' | 'reveal'

// Respect the system-level "Reduce Motion" accessibility setting so we can
// shorten or skip long-running animations for vestibular-sensitive players.
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(!!v)
    }).catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      if (mounted) setReduced(!!v)
    })
    return () => {
      mounted = false
      // RN returns EmitterSubscription in newer versions; handle both shapes.
      if (sub && typeof (sub as any).remove === 'function') (sub as any).remove()
    }
  }, [])
  return reduced
}

// Rarity-tinted border for the React bar buttons — mirrors the web game page.
const RARITY_BORDER: Record<EmoteRarity, string> = {
  free:      'border-neutral-700/50',
  common:    'border-sky-700/50',
  rare:      'border-indigo-600/50',
  epic:      'border-fuchsia-600/60',
  legendary: 'border-amber-500/70',
}

// Small pill that labels the word reveal with its category — gives players the
// theme (Food, Movies, …) so ambiguous words like "Crane" land correctly.
function CategoryBadge({ categoryKey }: { categoryKey: WordCategory | null | undefined }) {
  const { t } = useTranslation()
  if (!categoryKey) return null
  const cat = WORD_CATEGORIES.find((c) => c.key === categoryKey)
  if (!cat) return null
  return (
    <View className="self-start flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-violet-950/60 border border-violet-700/40">
      <Text className="text-[10px]">{cat.icon}</Text>
      <Text className="text-[10px] font-bold uppercase tracking-widest text-violet-300">
        {t(`home.cat.${cat.key}`, cat.label)}
      </Text>
    </View>
  )
}

// ─── CountdownBar ─────────────────────────────────────────────────────────────

function CountdownBar({
  seconds,
  total,
  isVoting,
}: {
  seconds: number
  total: number
  isVoting: boolean
}) {
  const pct = Math.max(0, (seconds / total) * 100)
  const urgent = seconds <= 10
  const critical = seconds <= 3

  const readoutText = (
    <Text
      className={[
        'text-xs font-mono font-semibold w-8 text-right',
        urgent ? 'text-red-400' : 'text-neutral-400',
      ].join(' ')}
      style={
        urgent
          ? {
              textShadowColor: 'rgba(239,68,68,0.65)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 10,
            }
          : undefined
      }
    >
      {seconds}s
    </Text>
  )

  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <View
          className={[
            'h-full rounded-full',
            isVoting ? 'bg-amber-500' : 'bg-violet-500',
            urgent ? 'opacity-70' : '',
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </View>
      {critical ? (
        <UrgentPulse>{readoutText}</UrgentPulse>
      ) : urgent ? (
        <Heartbeat>{readoutText}</Heartbeat>
      ) : (
        readoutText
      )}
    </View>
  )
}

// ─── PhaseIndicator ──────────────────────────────────────────────────────────

function PhaseIndicator({ currentPhase }: { currentPhase: Phase }) {
  const phases: { id: Phase; icon: string; label: string; activeColor: string; activeBg: string; activeBorder: string }[] = [
    { id: 'speaking', icon: '✏️', label: 'Clues', activeColor: 'text-violet-300', activeBg: 'bg-violet-900/70', activeBorder: 'border-violet-600/60' },
    { id: 'voting', icon: '🗳', label: 'Vote', activeColor: 'text-amber-300', activeBg: 'bg-amber-900/70', activeBorder: 'border-amber-600/60' },
    { id: 'reveal', icon: '📋', label: 'Reveal', activeColor: 'text-emerald-300', activeBg: 'bg-emerald-900/70', activeBorder: 'border-emerald-600/60' },
  ]
  const currentIdx = phases.findIndex((p) => p.id === currentPhase)

  return (
    <View className="flex-row items-center gap-1">
      {phases.map((p, i) => {
        const isActive = p.id === currentPhase
        const isDone = i < currentIdx
        return (
          <React.Fragment key={p.id}>
            {i > 0 && (
              <View
                className={[
                  'h-px w-3 rounded-full',
                  isDone ? 'bg-violet-600' : 'bg-neutral-700',
                ].join(' ')}
              />
            )}
            <View
              className={[
                'flex-row items-center gap-1 px-2.5 py-1 rounded-full border',
                isActive
                  ? `${p.activeBg} ${p.activeBorder}`
                  : 'bg-transparent border-transparent',
              ].join(' ')}
            >
              <Text style={{ fontSize: 10 }}>{p.icon}</Text>
              <Text
                className={[
                  'text-[10px] font-bold tracking-wide',
                  isActive ? p.activeColor : isDone ? 'text-neutral-600' : 'text-neutral-700',
                ].join(' ')}
              >
                {p.label}
              </Text>
            </View>
          </React.Fragment>
        )
      })}
    </View>
  )
}

// ─── PlayerClueHistoryModal ───────────────────────────────────────────────────

function PlayerClueHistoryModal({
  visible,
  player,
  completedRounds,
  currentClues,
  onClose,
}: {
  visible: boolean
  player: { userId: string; username: string; avatarUrl?: string | null } | null
  completedRounds: any[]
  currentClues: any[]
  onClose: () => void
}) {
  if (!player) return null

  // Collect clues from completed rounds + current round clues
  const allRoundClues: { roundNumber: number; clue: string }[] = []

  completedRounds.forEach((round) => {
    const roundClue = (round.clues ?? []).find((c: any) => c.playerId === player.userId)
    if (roundClue) {
      allRoundClues.push({ roundNumber: round.roundNumber, clue: roundClue.text })
    }
  })

  // Current round clues
  currentClues.forEach((c: any) => {
    if (c.playerId === player.userId) {
      const maxRound = allRoundClues.reduce((m, r) => Math.max(m, r.roundNumber), 0)
      allRoundClues.push({ roundNumber: maxRound + 1, clue: c.text })
    }
  })

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 bg-black/70"
        activeOpacity={1}
        onPress={onClose}
      >
        <View className="flex-1" />
        <View
          className="bg-neutral-900 rounded-t-3xl border-t border-neutral-700 overflow-hidden"
          onStartShouldSetResponder={() => true}
        >
          {/* Handle bar */}
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 rounded-full bg-neutral-700" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-3 border-b border-neutral-800">
            <View className="flex-row items-center gap-2">
              <Avatar url={player.avatarUrl} username={player.username} size={32} />
              <View>
                <Text className="text-white font-bold text-base">{player.username}</Text>
                <Text className="text-neutral-500 text-xs">Clue history</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center"
            >
              <Text className="text-neutral-400 text-sm">✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 360 }}
          >
            {allRoundClues.length === 0 ? (
              <Text className="text-neutral-400 text-sm italic text-center py-6">
                No clues submitted yet
              </Text>
            ) : (
              allRoundClues.map((item, i) => (
                <View
                  key={i}
                  className="flex-row items-start gap-3 px-3 py-3 rounded-xl bg-neutral-800/60 border border-neutral-700/50"
                >
                  <View className="px-1.5 py-0.5 rounded bg-violet-900/60 border border-violet-700/40 mt-0.5">
                    <Text className="text-[10px] font-bold text-violet-400">R{item.roundNumber}</Text>
                  </View>
                  <Text className="flex-1 text-white text-sm leading-snug">{item.clue}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

// ─── VoteOption ───────────────────────────────────────────────────────────────
// Mirrors the web's `animate-jelly` keyframes (see apps/web/tailwind.config.ts)
// 0%→25%→50%→75%→100%: scale(1,1) → (1.12,0.88) → (0.92,1.08) → (1.04,0.96) → (1,1)

const VoteOption = React.memo(function VoteOption({
  player,
  clue,
  isVotedTarget,
  hasVoted,
  disabled,
  onPress,
  canProtect,
  onProtect,
  reducedMotion,
}: {
  player: { id: string; userId: string; username: string; avatarUrl?: string | null }
  clue?: { text: string; flaggedForWord?: boolean }
  isVotedTarget: boolean
  hasVoted: boolean
  disabled: boolean
  onPress: () => void
  canProtect?: boolean
  onProtect?: () => void
  reducedMotion?: boolean
}) {
  const scaleX = useRef(new Animated.Value(1)).current
  const scaleY = useRef(new Animated.Value(1)).current
  const prevSelected = useRef(isVotedTarget)

  useEffect(() => {
    if (isVotedTarget && !prevSelected.current && !reducedMotion) {
      scaleX.setValue(1)
      scaleY.setValue(1)
      const segment = 150 // 0.6s / 4 keyframe segments
      const ease = Easing.out(Easing.quad)
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleX, { toValue: 1.12, duration: segment, easing: ease, useNativeDriver: true }),
          Animated.timing(scaleX, { toValue: 0.92, duration: segment, easing: ease, useNativeDriver: true }),
          Animated.timing(scaleX, { toValue: 1.04, duration: segment, easing: ease, useNativeDriver: true }),
          Animated.timing(scaleX, { toValue: 1, duration: segment, easing: ease, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scaleY, { toValue: 0.88, duration: segment, easing: ease, useNativeDriver: true }),
          Animated.timing(scaleY, { toValue: 1.08, duration: segment, easing: ease, useNativeDriver: true }),
          Animated.timing(scaleY, { toValue: 0.96, duration: segment, easing: ease, useNativeDriver: true }),
          Animated.timing(scaleY, { toValue: 1, duration: segment, easing: ease, useNativeDriver: true }),
        ]),
      ]).start()
    }
    prevSelected.current = isVotedTarget
  }, [isVotedTarget, scaleX, scaleY, reducedMotion])

  return (
    <Animated.View style={{ transform: [{ scaleX }, { scaleY }] }}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          isVotedTarget
            ? `Your vote is for ${player.username}`
            : hasVoted
            ? `Voting locked — you already voted`
            : `Vote for ${player.username}${clue?.flaggedForWord ? ' (flagged — said the word)' : ''}`
        }
        accessibilityState={{ selected: isVotedTarget, disabled }}
        className={[
          'flex-row items-center gap-3 px-3 py-3 rounded-xl border overflow-hidden',
          isVotedTarget
            ? 'border-amber-600/70 bg-amber-950/40'
            : hasVoted
            ? 'border-neutral-800 bg-neutral-900/30 opacity-40'
            : clue?.flaggedForWord
            ? 'border-amber-700/50 bg-amber-950/20'
            : 'border-neutral-700/60 bg-neutral-800/40',
        ].join(' ')}
        activeOpacity={0.7}
      >
        {isVotedTarget && (
          <View className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />
        )}
        <Avatar
          url={player.avatarUrl}
          username={player.username}
          size={36}
          borderColor={isVotedTarget ? '#d97706' : undefined}
        />
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5 flex-wrap">
            <Text className={['font-semibold text-sm', isVotedTarget ? 'text-amber-200' : 'text-white'].join(' ')}>
              {player.username}
            </Text>
            {clue?.flaggedForWord && (
              <Text className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                ⚠ Said the word
              </Text>
            )}
          </View>
          {clue ? (
            <Text className="text-xs text-neutral-300 leading-snug mt-0.5" numberOfLines={2}>{clue.text}</Text>
          ) : (
            <Text className="text-xs text-neutral-500 italic leading-snug mt-0.5">No clue yet</Text>
          )}
        </View>
        {isVotedTarget ? (
          <View className="flex-row items-center gap-1 px-2 py-1 rounded-lg bg-amber-900/60 border border-amber-700/40">
            <Text className="text-amber-300 text-[10px] font-bold">✓ Your Vote</Text>
          </View>
        ) : !hasVoted ? (
          <View className="px-2.5 py-1 rounded-lg bg-neutral-700/50 border border-neutral-600/40">
            <Text className="text-neutral-400 text-[10px] font-semibold">Vote</Text>
          </View>
        ) : null}
        {canProtect && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onProtect?.() }}
            hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={`Protect ${player.username} from elimination`}
            className="ml-1 w-11 h-11 items-center justify-center rounded-md border border-yellow-700/60 bg-yellow-950/40"
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 16 }}>🛡️</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  )
}, (prev, next) =>
  prev.isVotedTarget === next.isVotedTarget &&
  prev.hasVoted === next.hasVoted &&
  prev.disabled === next.disabled &&
  prev.canProtect === next.canProtect &&
  prev.reducedMotion === next.reducedMotion &&
  prev.player.userId === next.player.userId &&
  prev.player.username === next.player.username &&
  prev.player.avatarUrl === next.player.avatarUrl &&
  prev.clue?.text === next.clue?.text &&
  prev.clue?.flaggedForWord === next.clue?.flaggedForWord
)

// ─── GameScreen ───────────────────────────────────────────────────────────────

export default function GameScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const { t } = useTranslation()
  const router = useRouter()
  const {
    room,
    currentRound,
    myRole,
    myWord,
    myVillagerWord,
    myCategory,
    detectiveRevealUsed,
    revealedPlayer,
    twinPartner,
    twinMessages,
    twinUnread,
    corruptorTargetUserId,
    kamikazePrompt,
    mayorDoubleVoteUsed,
    mayorDoubleActive,
    inverterUsed,
    inverterActive,
    guardianProtectUsed,
    guardianProtectedPlayer,
    messages,
    addMessage,
    addTwinMessage,
    clearTwinUnread,
    setCorruptorTarget,
    setKamikazePrompt,
    setMayorDoubleActive,
    setInverterActive,
    setGuardianProtectUsed,
    setGuardianProtectedPlayer,
    setResult,
    setRound,
    addCompletedRound,
    setDetectiveRevealUsed,
    setRevealedPlayer,
    setRoom,
    setRoleAndWord,
    result,
    reset,
    completedRounds,
  } = useGameStore()
  const user = useAuthStore((s) => s.user)
  const { isTablet, px, fontScale } = useResponsive()
  const contentStyle = isTablet ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const } : {}
  const reducedMotion = useReducedMotion()

  // ─── State ──────────────────────────────────────────────────────────────────

  const [clueText, setClueText] = useState('')
  const [clues, setClues] = useState<Clue[]>([])
  const [chatInput, setChatInput] = useState('')
  const [deadChatInput, setDeadChatInput] = useState('')
  const [deadChatMessages, setDeadChatMessages] = useState<
    { id: string; userId: string; username: string; text: string }[]
  >([])
  const [isEliminated, setIsEliminated] = useState(false)
  const [floatingEmotes, setFloatingEmotes] = useState<
    { id: string; emoteId?: string; emoji: string; username: string }[]
  >([])
  const [phase, setPhase] = useState<Phase>('speaking')
  const [votedFor, setVotedFor] = useState<string | null>(null)
  const [eliminated, setEliminated] = useState<{
    username: string
    role: string
    reason?: 'voted' | 'said_word'
  } | null>(null)
  const [hasSubmittedClue, setHasSubmittedClue] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalTime, setTotalTime] = useState(30)
  const [showChat, setShowChat] = useState(false)
  const [showRoleReveal, setShowRoleReveal] = useState(false)
  const [showElimOverlay, setShowElimOverlay] = useState(false)
  const [elimOverlayData, setElimOverlayData] = useState<{
    username: string
    role: string
    reason?: 'voted' | 'said_word'
    isSelf: boolean
  } | null>(null)
  const [voteCount, setVoteCount] = useState(0)
  const [totalVoters, setTotalVoters] = useState(0)
  // Track *which* users have cast a vote so the vote panel can show a voter
  // avatar row ("who's already voted"). Aggregate counts come from vote:update;
  // identities come from per-cast round:vote-cast. Cleared on phase transitions.
  const [votedUserIds, setVotedUserIds] = useState<string[]>([])
  const [allVotedMsg, setAllVotedMsg] = useState(false)
  const [isTie, setIsTie] = useState(false)
  const [wordReveal, setWordReveal] = useState<{
    villagerWord: string
    redHandedWord: string
  } | null>(null)
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false)
  const [clueFlagCounts, setClueFlagCounts] = useState<Record<number, number>>({})
  const [clueHistoryPlayer, setClueHistoryPlayer] = useState<{ userId: string; username: string; avatarUrl?: string | null } | null>(null)
  // Role-power pickers (any-time usage — banner opens modal, modal emits, closes).
  const [showCorruptorPicker, setShowCorruptorPicker] = useState(false)
  const [showDetectivePicker, setShowDetectivePicker] = useState(false)
  const [showGuardianPicker, setShowGuardianPicker] = useState(false)
  // Loading indicator while the server acks a power activation (prevents double-taps).
  const [pendingPower, setPendingPower] = useState<string | null>(null)
  // Vocal-mode fallback — if the mic is unavailable, let the player type a clue
  // so they aren't frozen out of the round.
  const [vocalTextFallback, setVocalTextFallback] = useState(false)
  // Evil Twins private DM — mirrors web. Ref keeps the live value in the
  // socket handler, which closes over mount-time state otherwise.
  const [twinChatOpen, setTwinChatOpen] = useState(false)
  const [twinChatInput, setTwinChatInput] = useState('')
  const twinChatScrollRef = useRef<ScrollView>(null)
  const twinChatOpenRef = useRef(twinChatOpen)
  useEffect(() => { twinChatOpenRef.current = twinChatOpen }, [twinChatOpen])
  const isTwin = myRole === 'twin_villager' || myRole === 'twin_red_handed'

  // ─── Vocal mode ─────────────────────────────────────────────────────────────
  // When the room is in vocal mode, players speak out loud on their turn
  // instead of typing. The current speaker sees a countdown and a "Done"
  // button. Driven by the server's `round:vocal-turn` events.
  const vocalMode = !!(room?.settings as any)?.vocalMode
  const [vocalSpeakerId, setVocalSpeakerId] = useState<string | null>(null)
  const [vocalPerTurnSeconds, setVocalPerTurnSeconds] = useState(10)
  const [vocalTurnTimeLeft, setVocalTurnTimeLeft] = useState(0)
  const [vocalTurnIndex, setVocalTurnIndex] = useState(0)
  const [vocalTotalSpeakers, setVocalTotalSpeakers] = useState(0)
  const vocalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const voiceChannelRef = useRef<VoiceChannel | null>(null)
  const [voiceMicError, setVoiceMicError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatScrollRef = useRef<ScrollView>(null)
  const deadChatScrollRef = useRef<ScrollView>(null)
  const phaseRef = useRef<Phase>('speaking')
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([])
  const lastEmoteTime = useRef(0)
  const [emoteCooldownUntil, setEmoteCooldownUntil] = useState(0)
  const [emoteNow, setEmoteNow] = useState(0)

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTotalTime(seconds)
    setTimeLeft(seconds)
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const startTimerRef = useRef(startTimer)
  useEffect(() => {
    startTimerRef.current = startTimer
  }, [startTimer])

  const isRedHanded = myRole === 'red_handed' || myRole === 'double_agent'
  // Blind role mode hides the player's role at game start. The server omits
  // `yourRole` in the game:started payload; the UI shows a "role hidden"
  // placeholder until elimination or game end.
  const blindMode = !!(room?.settings as any)?.blindMode && ((room?.settings as any)?.gameMode ?? 'normal') === 'normal'
  const players = room?.players ?? []
  const alivePlayers = players.filter((p) => p.status === 'alive')

  // ─── Role + camp config for the in-game word card ─────────────────────────
  // Icon, colors, and hints per role. Mirrors the web ROLE_CONFIG but with
  // NativeWind class sets tailored to the mobile card layout (tile + headline).
  const ROLE_CONFIG: Record<string, { emoji: string; border: string; bg: string; accent: string; tile: string; text: string; headlineKey: string; headlineFallback: string; hintKey: string; hintFallback: string }> = {
    villager:        { emoji: '🏘️', border: 'border-violet-700/60',    bg: 'bg-violet-950/25',   accent: 'bg-violet-500',   tile: 'bg-violet-900/50 border-violet-700/40',   text: 'text-violet-300',   headlineKey: 'game.headlineVillager',     headlineFallback: 'You are a Villager',       hintKey: 'game.hintVillager',     hintFallback: 'Give a clue without saying the word directly' },
    red_handed:      { emoji: '🔪', border: 'border-red-700/60',       bg: 'bg-red-950/25',      accent: 'bg-red-500',      tile: 'bg-red-900/50 border-red-700/40',         text: 'text-red-300',      headlineKey: 'game.headlineRedHanded',    headlineFallback: 'You are the Imposter',     hintKey: 'game.hintRedHanded',    hintFallback: "Blend in — don't reveal you have a different word" },
    detective:       { emoji: '🔍', border: 'border-sky-700/60',       bg: 'bg-sky-950/25',      accent: 'bg-sky-500',       tile: 'bg-sky-900/50 border-sky-700/40',         text: 'text-sky-300',      headlineKey: 'game.headlineDetective',    headlineFallback: 'You are the Detective',    hintKey: 'game.hintDetective',    hintFallback: 'Investigate players to find the imposter' },
    double_agent:    { emoji: '🎭', border: 'border-orange-700/60',    bg: 'bg-orange-950/25',   accent: 'bg-orange-500',   tile: 'bg-orange-900/50 border-orange-700/40',   text: 'text-orange-300',   headlineKey: 'game.headlineDoubleAgent',  headlineFallback: 'You are a Double Agent',   hintKey: 'game.hintDoubleAgent',  hintFallback: 'You know both words — use it wisely' },
    guardian:        { emoji: '🛡️', border: 'border-yellow-700/60',    bg: 'bg-yellow-950/25',   accent: 'bg-yellow-500',   tile: 'bg-yellow-900/50 border-yellow-700/40',   text: 'text-yellow-300',   headlineKey: 'game.headlineGuardian',     headlineFallback: 'You are the Guardian',     hintKey: 'game.hintGuardian',     hintFallback: 'Protect a player each round' },
    mayor:           { emoji: '⚖️', border: 'border-indigo-700/60',    bg: 'bg-indigo-950/25',   accent: 'bg-indigo-500',   tile: 'bg-indigo-900/50 border-indigo-700/40',   text: 'text-indigo-300',   headlineKey: 'game.headlineMayor',        headlineFallback: 'You are the Mayor',        hintKey: 'game.hintMayor',        hintFallback: 'Your vote counts twice' },
    infiltrator:     { emoji: '🥷', border: 'border-fuchsia-700/60',   bg: 'bg-fuchsia-950/25',  accent: 'bg-fuchsia-500',  tile: 'bg-fuchsia-900/50 border-fuchsia-700/40', text: 'text-fuchsia-300',  headlineKey: 'game.headlineInfiltrator',  headlineFallback: 'You are the Infiltrator',  hintKey: 'game.hintInfiltrator',  hintFallback: 'Blend in and work against the villagers' },
    jester:          { emoji: '🃏', border: 'border-pink-700/60',      bg: 'bg-pink-950/25',     accent: 'bg-pink-500',     tile: 'bg-pink-900/50 border-pink-700/40',       text: 'text-pink-300',     headlineKey: 'game.headlineJester',       headlineFallback: 'You are the Jester',       hintKey: 'game.hintJester',       hintFallback: 'Get voted out to win — but not first!' },
    judge:           { emoji: '👨‍⚖️', border: 'border-emerald-700/60',  bg: 'bg-emerald-950/25',  accent: 'bg-emerald-500',  tile: 'bg-emerald-900/50 border-emerald-700/40', text: 'text-emerald-300',  headlineKey: 'game.headlineJudge',        headlineFallback: 'You are the Judge',        hintKey: 'game.hintJudge',        hintFallback: 'Cast the tie-breaking vote' },
    revenant:        { emoji: '👻', border: 'border-teal-700/60',      bg: 'bg-teal-950/25',     accent: 'bg-teal-500',     tile: 'bg-teal-900/50 border-teal-700/40',       text: 'text-teal-300',     headlineKey: 'game.headlineRevenant',     headlineFallback: 'You are the Revenant',     hintKey: 'game.hintRevenant',     hintFallback: 'Come back to haunt the living' },
    kamikaze:        { emoji: '💥', border: 'border-red-700/60',       bg: 'bg-red-950/25',      accent: 'bg-red-500',       tile: 'bg-red-900/50 border-red-700/40',         text: 'text-red-300',       headlineKey: 'game.headlineKamikaze',     headlineFallback: 'You are the Kamikaze',     hintKey: 'game.hintKamikaze',     hintFallback: 'Take someone down with you' },
    corruptor:       { emoji: '🕷️', border: 'border-orange-700/60',    bg: 'bg-orange-950/25',   accent: 'bg-orange-500',   tile: 'bg-orange-900/50 border-orange-700/40',   text: 'text-orange-300',   headlineKey: 'game.headlineCorruptor',    headlineFallback: 'You are the Corruptor',    hintKey: 'game.hintCorruptor',    hintFallback: 'Corrupt another player each round' },
    inverter:        { emoji: '🔄', border: 'border-rose-700/60',      bg: 'bg-rose-950/25',     accent: 'bg-rose-500',     tile: 'bg-rose-900/50 border-rose-700/40',       text: 'text-rose-300',     headlineKey: 'game.headlineInverter',     headlineFallback: 'You are the Inverter',     hintKey: 'game.hintInverter',     hintFallback: 'Flip the vote result' },
    twin_villager:   { emoji: '👯', border: 'border-purple-700/60',    bg: 'bg-purple-950/25',   accent: 'bg-purple-500',   tile: 'bg-purple-900/50 border-purple-700/40',   text: 'text-purple-300',   headlineKey: 'game.headlineTwinVillager', headlineFallback: 'You are an Evil Twin',     hintKey: 'game.hintTwinVillager', hintFallback: "You share a secret bond — don't get caught" },
    twin_red_handed: { emoji: '👯', border: 'border-purple-700/60',    bg: 'bg-purple-950/25',   accent: 'bg-purple-500',   tile: 'bg-purple-900/50 border-purple-700/40',   text: 'text-purple-400',   headlineKey: 'game.headlineTwinRedHanded',headlineFallback: 'You are an Evil Twin',     hintKey: 'game.hintTwinRedHanded',hintFallback: "You share a secret bond — don't get caught" },
  }
  // When the role is hidden (blind mode, pre-elimination), we deliberately
  // don't fall back to a default role — callers must branch on `myRole` and
  // render a "role hidden" variant instead.
  const roleInfo = myRole ? (ROLE_CONFIG[myRole] ?? ROLE_CONFIG.villager) : null

  const gameMode = (room?.settings as any)?.gameMode ?? 'normal'
  const showCamp = gameMode !== 'normal'
  const camp: 'villager' | 'red_handed' | 'jester' | null =
    myRole && isRedHandedSideRole(myRole as any) ? 'red_handed'
    : myRole && isVillagerSideRole(myRole as any) ? 'villager'
    : myRole && isJesterRole(myRole as any) ? 'jester'
    : null
  const CAMP_META: Record<'villager' | 'red_handed' | 'jester', { label: string; text: string; border: string; dot: string }> = {
    villager:   { label: t('game.campVillager', 'Villagers'),  text: 'text-emerald-400', border: 'border-emerald-700/50', dot: 'bg-emerald-500' },
    red_handed: { label: t('game.campRedHanded', 'Imposters'), text: 'text-red-400',     border: 'border-red-700/50',     dot: 'bg-red-500' },
    jester:     { label: t('game.campJester', 'Solo'),         text: 'text-pink-400',    border: 'border-pink-700/50',    dot: 'bg-pink-500' },
  }

  // ─── Timer tick sounds ─────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft <= 0) return
    if (timeLeft <= 3) {
      SoundManager.play('countdown_final')
    } else if (timeLeft <= 10) {
      SoundManager.play('timer_tick')
    }
  }, [timeLeft])

  // ─── Phase-transition haptic ─────────────────────────────────────────────
  // A soft tap on entering voting and a heavier one on reveal gives the
  // player a tactile cue that the game state shifted, even if their eyes
  // were off the screen.
  const prevPhaseRef = useRef<Phase>(phase)
  useEffect(() => {
    if (prevPhaseRef.current !== phase) {
      if (phase === 'voting') HapticManager.light()
      else if (phase === 'reveal') HapticManager.medium()
      prevPhaseRef.current = phase
    }
    // Leaving speaking drops any text-fallback affordance from the last round.
    if (phase !== 'speaking') setVocalTextFallback(false)
  }, [phase])

  // Clear any pending power-ability spinner once the server acks — the store
  // setters above already fire on ack, so we just watch the flags that flip.
  useEffect(() => {
    if (pendingPower === 'detective' && detectiveRevealUsed) setPendingPower(null)
    if (pendingPower === 'guardian' && guardianProtectUsed) setPendingPower(null)
    if (pendingPower === 'corruptor' && corruptorTargetUserId) setPendingPower(null)
    if (pendingPower === 'mayor' && (mayorDoubleActive || mayorDoubleVoteUsed)) setPendingPower(null)
    if (pendingPower === 'inverter' && (inverterActive || inverterUsed)) setPendingPower(null)
    if (pendingPower === 'kamikaze' && !kamikazePrompt) setPendingPower(null)
  }, [pendingPower, detectiveRevealUsed, guardianProtectUsed, corruptorTargetUserId, mayorDoubleActive, mayorDoubleVoteUsed, inverterActive, inverterUsed, kamikazePrompt])

  // ─── Role reveal on mount ──────────────────────────────────────────────────
  // Only show on a FRESH game entry. If the player is mid-game (clues already
  // submitted or past round 1), this is a remount/resume — skip the reveal.

  useEffect(() => {
    // Blind mode skips the role reveal (role is still hidden to this player)
    // but we still want to show the word on first mount so the player knows
    // what they're defending — use the screen's blind variant in that case.
    if (!myWord) return
    if (!myRole && !blindMode) return
    const s = useGameStore.getState()
    const isMidGame =
      (s.completedRounds?.length ?? 0) > 0 ||
      (s.currentRound?.clues?.length ?? 0) > 0 ||
      ((s.currentRound?.roundNumber ?? 1) > 1)
    if (isMidGame) return
    setShowRoleReveal(true)
  }, []) // only on mount

  // ─── Voice channel (vocal mode) ────────────────────────────────────────────
  // When the room is in vocal mode, every player joins a WebRTC mesh for
  // the whole game — mic is captured once on game start and the audio
  // tracks stay live throughout. The server-side `round:vocal-turn` event
  // still dictates *whose* turn it is; this effect just ensures the audio
  // pipe is open so every speaker can actually be heard.
  useEffect(() => {
    if (!vocalMode || !user?.id) return
    const socket = getSocket()
    if (!socket) return

    const vc = new VoiceChannel({ socket, selfUserId: user.id })
    voiceChannelRef.current = vc
    vc.onMicError = (err) => {
      log.warn('mic error', { message: err.message })
      setVoiceMicError(err.message)
    }
    vc.start().catch((err) => {
      log.warn('voice start failed', { message: (err as Error).message })
    })

    return () => {
      try { vc.destroy() } catch {}
      if (voiceChannelRef.current === vc) voiceChannelRef.current = null
    }
  }, [vocalMode, user?.id])

  // ─── Show elimination overlay ──────────────────────────────────────────────

  const showElimination = useCallback(
    (username: string, role: string, reason?: 'voted' | 'said_word') => {
      const isSelf = username === user?.username || false
      setElimOverlayData({ username, role, reason, isSelf })
      setShowElimOverlay(true)
    },
    [user?.username]
  )

  // ─── Socket event listeners ────────────────────────────────────────────────

  useEffect(() => {
    const socket = getSocket()

    // Clear stale result from previous game
    if (result) {
      reset()
    }

    // game:started — reset all state for new game.
    // Server also re-emits this on reconnect so the client can restore its role/word;
    // in that case we skip the reveal + state reset (game:sync fires right after
    // to restore phase/clues/timer).
    socket.on('game:started', ({ yourWord, yourRole, yourVillagerWord, yourCategory, isReconnect }: any) => {
      log.info('game started', { role: yourRole, isReconnect: !!isReconnect })
      if (isReconnect) {
        setRoleAndWord(yourRole, yourWord, yourVillagerWord, yourCategory)
        return
      }
      SoundManager.play('game_start')
      setRoleAndWord(yourRole, yourWord, yourVillagerWord, yourCategory)
      setClues([])
      setHasSubmittedClue(false)
      setVotedFor(null)
      setEliminated(null)
      setWordReveal(null)
      setIsTie(false)
      setVoteCount(0)
      setTotalVoters(0)
      setAllVotedMsg(false)
      setIsEliminated(false)
      setDeadChatMessages([])
      setClueFlagCounts({})
      phaseRef.current = 'speaking'
      setPhase('speaking')
      setShowRoleReveal(true)
    })

    // game:sync — reconnect state restoration
    socket.on(
      'game:sync',
      ({
        phase: syncPhase,
        clues: syncClues,
        votes: syncVotes,
        timeRemainingSeconds,
        currentRound: syncRound,
        speakingOrder: order,
        currentSpeakerId: _speakerId,
      }: any) => {
        setClues(syncClues ?? [])
        if (syncRound) setRound(syncRound)

        if (syncPhase === 'speaking') {
          phaseRef.current = 'speaking'
          setPhase('speaking')
          startTimerRef.current(timeRemainingSeconds ?? 30)
          const myClue = (syncClues ?? []).find((c: any) => c.playerId === user?.id)
          if (myClue) setHasSubmittedClue(true)
        } else if (syncPhase === 'voting') {
          phaseRef.current = 'voting'
          setPhase('voting')
          setVoteCount((syncVotes ?? []).length)
          setTotalVoters(order?.length ?? 0)
          startTimerRef.current(timeRemainingSeconds ?? 30)
          const myVote = (syncVotes ?? []).find((v: any) => v.voterId === user?.id)
          if (myVote) setVotedFor(myVote.targetId)
        }
      }
    )

    // game:player-forfeited
    socket.on('game:player-forfeited', ({ userId: forfeitedId }: any) => {
      const s = useGameStore.getState()
      if (!s.room) return
      s.setRoom({
        ...s.room,
        players: s.room.players.map((p) =>
          p.userId === forfeitedId ? { ...p, status: 'forfeited' as const } : p
        ),
      })
    })

    // Clue events
    socket.on('round:clue-submitted', (clue) => setClues((c) => [...c, clue as Clue]))

    // Vocal mode: per-player turn announcement. Drives the countdown displayed
    // on the "Speak now!" card.
    socket.on('round:vocal-turn' as any, ({ speakerId, speakerIndex, totalSpeakers, perTurnSeconds }: any) => {
      setVocalSpeakerId(speakerId)
      setVocalTurnIndex(speakerIndex)
      setVocalTotalSpeakers(totalSpeakers)
      setVocalPerTurnSeconds(perTurnSeconds)
      setVocalTurnTimeLeft(perTurnSeconds)
      if (vocalTimerRef.current) clearInterval(vocalTimerRef.current)
      vocalTimerRef.current = setInterval(() => {
        setVocalTurnTimeLeft((t) => {
          if (t <= 1) {
            if (vocalTimerRef.current) clearInterval(vocalTimerRef.current)
            return 0
          }
          return t - 1
        })
      }, 1000)
    })

    // Speaking turn — also used as new-round signal
    socket.on('round:speaking-turn', ({ timeSeconds, speakingOrder: _order }: any) => {
      if (phaseRef.current !== 'speaking') {
        SoundManager.play('round_start')
        setClues([])
        setHasSubmittedClue(false)
        setVotedFor(null)
        setEliminated(null)
        setWordReveal(null)
        setIsTie(false)
        setVoteCount(0)
        setAllVotedMsg(false)
        setClueFlagCounts({})
      }
      phaseRef.current = 'speaking'
      setPhase('speaking')
      startTimerRef.current(timeSeconds)
    })

    // Voting started
    socket.on('round:voting-started', ({ timeSeconds, players: vPlayers }: any) => {
      log.info('phase: voting', { timeSeconds, playerCount: vPlayers?.length })
      phaseRef.current = 'voting'
      setPhase('voting')
      // Vocal turns end with the clue phase — stop the per-turn countdown.
      setVocalSpeakerId(null)
      if (vocalTimerRef.current) { clearInterval(vocalTimerRef.current); vocalTimerRef.current = null }
      setVoteCount(0)
      setTotalVoters(vPlayers?.length ?? 0)
      setVotedUserIds([])
      setAllVotedMsg(false)
      // The server's authoritative alive-player list arrives here. Mirror it
      // into room.players so ghosts eliminated in earlier rounds don't keep
      // showing up as vote targets (alivePlayers is derived from room.players).
      if (Array.isArray(vPlayers)) {
        const currentRoom = useGameStore.getState().room
        if (currentRoom) {
          const aliveIds = new Set(vPlayers.map((p: any) => p.userId))
          useGameStore.getState().setRoom({
            ...currentRoom,
            players: currentRoom.players.map((p: any) =>
              aliveIds.has(p.userId)
                ? (p.status === 'alive' ? p : { ...p, status: 'alive' })
                : (p.status === 'alive' ? { ...p, status: 'eliminated' } : p),
            ),
          } as any)
        }
      }
      startTimerRef.current(timeSeconds ?? 30)
    })

    // Round ended
    socket.on('round:ended', ({ round, nextRound }: any) => {
      log.info('phase: reveal', { roundNumber: round?.roundNumber, eliminatedId: round?.eliminatedPlayerId })
      SoundManager.play('reveal')
      phaseRef.current = 'reveal'
      setPhase('reveal')
      setAllVotedMsg(false)
      if (round) addCompletedRound(round)
      if (nextRound) setRound(nextRound)
      if (round?.wordReveal) setWordReveal(round.wordReveal)
      if (round?.eliminatedPlayerId) {
        SoundManager.play('elimination')
        // Mirror the elimination into room.players now, so the reveal phase
        // (which runs before the next round:voting-started) doesn't still
        // treat the ghost as alive — keeps them out of alivePlayers.
        const eliminatedId = round.eliminatedPlayerId
        const currentRoom = useGameStore.getState().room
        if (currentRoom) {
          useGameStore.getState().setRoom({
            ...currentRoom,
            players: currentRoom.players.map((p: any) =>
              p.userId === eliminatedId && p.status === 'alive'
                ? { ...p, status: 'eliminated' }
                : p,
            ),
          } as any)
        }
        const elim = players.find((p: any) => p.userId === round.eliminatedPlayerId)
        const elimRole = round.eliminatedRole ?? (elim as any)?.role ?? 'villager'
        const elimName = elim?.username ?? round.eliminatedPlayerId
        setEliminated({ username: elimName, role: elimRole })
        const isMe = round.eliminatedPlayerId === user?.id
        if (isMe) {
          setIsEliminated(true)
          socket.emit('deadchat:join' as any)
        }
        // Show elimination overlay
        HapticManager.heavy()
        showElimination(elimName, elimRole, 'voted')
      } else {
        if (round?.votes?.length > 0) setIsTie(true)
      }
    })

    // Vote progress
    socket.on('vote:update' as any, ({ voteCount: vc, totalVoters: tv }: any) => {
      setVoteCount(vc)
      setTotalVoters(tv)
    })
    // Who cast — identities for voter avatar row. Dedupe in case of re-emits.
    socket.on('round:vote-cast' as any, ({ voterId }: { voterId: string; hasVoted: boolean }) => {
      if (!voterId) return
      setVotedUserIds((prev) => (prev.includes(voterId) ? prev : [...prev, voterId]))
    })
    socket.on('vote:all-cast' as any, () => {
      setAllVotedMsg(true)
    })

    // Dead chat
    socket.on(
      'deadchat:message' as any,
      (msg: { id: string; userId: string; username: string; text: string }) => {
        setDeadChatMessages((prev) => {
          const next = [...prev, msg]
          return next.length > 200 ? next.slice(-200) : next
        })
      }
    )

    // Twin partner revealed
    socket.on('twin:partner' as any, ({ twinUserId, twinUsername, twinRole }: any) => {
      log.info('twin partner revealed', { twinUserId, twinUsername, twinRole })
      useGameStore.getState().setTwinPartner({ twinUserId, twinUsername, twinRole })
    })

    // Evil Twins private DM — server routes only to both twins, never broadcast.
    socket.on('twin:message' as any, (msg: any) => {
      const incoming = msg?.userId !== user?.id
      useGameStore.getState().addTwinMessage(msg, { incrementUnread: incoming && !twinChatOpenRef.current })
      if (incoming) SoundManager.play('chat_message')
    })

    // Corruptor target locked in — close the picker modal on ack.
    socket.on('corruptor:target-ack' as any, ({ targetUserId }: any) => {
      log.info('corruptor target locked', { targetUserId })
      useGameStore.getState().setCorruptorTarget(targetUserId)
      setShowCorruptorPicker(false)
    })

    // Kamikaze post-death decision prompt (picker for self, waiting for bystanders).
    socket.on('kamikaze:select-prompt' as any, ({ candidateUserIds, kamikazeUserId, kamikazeUsername, timeSeconds }: any) => {
      log.info('kamikaze prompt received', { candidateUserIds, kamikazeUserId })
      useGameStore.getState().setKamikazePrompt({
        candidateUserIds: candidateUserIds ?? [],
        kamikazeUserId: kamikazeUserId ?? '',
        kamikazeUsername: kamikazeUsername ?? '',
        timeSeconds: timeSeconds ?? 15,
      })
    })
    socket.on('kamikaze:target-chosen' as any, () => {
      log.info('kamikaze target chosen')
      useGameStore.getState().setKamikazePrompt(null)
    })

    // Mayor / Inverter activation acks
    socket.on('mayor:double-ack' as any, () => {
      log.info('mayor double vote activated')
      useGameStore.getState().setMayorDoubleActive()
    })
    socket.on('inverter:activate-ack' as any, () => {
      log.info('inverter activated')
      useGameStore.getState().setInverterActive()
    })

    // Guardian protection acks
    socket.on('guardian:protect-ack' as any, ({ targetUserId, targetUsername }: any) => {
      log.info('guardian protection applied', { targetUserId })
      useGameStore.getState().setGuardianProtectUsed({ userId: targetUserId, username: targetUsername })
    })
    socket.on('guardian:protection-triggered' as any, ({ protectedUserId, protectedUsername }: any) => {
      useGameStore.getState().setGuardianProtectedPlayer({ userId: protectedUserId, username: protectedUsername })
      const tid = setTimeout(() => useGameStore.getState().setGuardianProtectedPlayer(null), 5000)
      timeoutRefs.current.push(tid)
    })

    // Detective reveal result
    socket.on('detective:result', ({ targetUserId, targetUsername, role }: any) => {
      setDetectiveRevealUsed()
      setRevealedPlayer({ userId: targetUserId, username: targetUsername, role })
      const tid = setTimeout(() => setRevealedPlayer(null), 5000)
      timeoutRefs.current.push(tid)
    })

    // Round word said — instant elimination for saying the word
    socket.on('round:word-said' as any, ({ playerId, username, role }: any) => {
      const s = useGameStore.getState()
      if (s.room) {
        s.setRoom({
          ...s.room,
          players: s.room.players.map((p) =>
            p.userId === playerId ? { ...p, status: 'eliminated' as const } : p
          ),
        })
      }
      const isMe = playerId === user?.id
      if (isMe) {
        setIsEliminated(true)
        socket.emit('deadchat:join' as any)
      }
      // Show elimination overlay with said_word reason
      HapticManager.heavy()
      showElimination(username, role, 'said_word')
    })

    // Game finished
    socket.on('game:finished', (data) => {
      log.info('game finished', { winner: (data as any)?.winner })
      SoundManager.play('game_end')
      if ((data as any)?.yourRole) {
        useGameStore.setState({ myRole: (data as any).yourRole })
      }
      setResult(data)
      HapticManager.success()
      router.replace(`/results/${code}`)
    })

    // Room updated
    socket.on('room:updated', (roomData: any) => {
      setRoom(roomData)
      if (roomData.status === 'finished' && useGameStore.getState().result) {
        router.replace(`/results/${code}`)
      }
    })
    socket.on('player:connection-changed' as any, ({ userId: uid, disconnected }: { userId: string; disconnected: boolean }) => {
      const current = useGameStore.getState().room
      if (!current) return
      setRoom({
        ...current,
        players: current.players.map((p: any) => p.userId === uid ? { ...p, disconnected } : p),
      } as any)
    })

    // Chat + emotes
    socket.on('chat:message', addMessage)
    socket.on(
      'emote:receive' as any,
      ({ username, emoji, emoteId }: { username: string; emoji: string; emoteId?: string }) => {
        const id = `${Date.now()}_${Math.random()}`
        setFloatingEmotes((prev) => (prev.length >= 10 ? prev : [...prev, { id, emoteId, emoji, username }]))
        const tid = setTimeout(
          () => setFloatingEmotes((prev) => prev.filter((e) => e.id !== id)),
          2800
        )
        timeoutRefs.current.push(tid)
      }
    )
    socket.on('emote:cooldown' as any, ({ until }: { until: number }) => {
      setEmoteCooldownUntil((prev) => (until > prev ? until : prev))
    })

    // Clue flag response
    socket.on('clue:flagged' as any, ({ clueIndex, flagCount }: any) => {
      setClueFlagCounts((prev) => ({ ...prev, [clueIndex]: flagCount }))
    })

    // Error
    socket.on('error', (err: any) => {
      log.error('socket error', { code: err?.code, message: err?.message })
    })

    return () => {
      socket.off('game:started')
      socket.off('game:sync')
      socket.off('game:player-forfeited')
      socket.off('round:clue-submitted')
      socket.off('round:speaking-turn')
      socket.off('round:vocal-turn' as any)
      if (vocalTimerRef.current) { clearInterval(vocalTimerRef.current); vocalTimerRef.current = null }
      socket.off('round:voting-started')
      socket.off('round:ended')
      socket.off('game:finished')
      socket.off('room:updated')
      socket.off('player:connection-changed' as any)
      socket.off('chat:message')
      socket.off('deadchat:message' as any)
      socket.off('emote:receive' as any)
      socket.off('emote:cooldown' as any)
      socket.off('twin:partner' as any)
      socket.off('twin:message' as any)
      socket.off('corruptor:target-ack' as any)
      socket.off('kamikaze:select-prompt' as any)
      socket.off('kamikaze:target-chosen' as any)
      socket.off('mayor:double-ack' as any)
      socket.off('inverter:activate-ack' as any)
      socket.off('guardian:protect-ack' as any)
      socket.off('guardian:protection-triggered' as any)
      socket.off('detective:result')
      socket.off('round:word-said' as any)
      socket.off('vote:update' as any)
      socket.off('round:vote-cast' as any)
      socket.off('vote:all-cast' as any)
      socket.off('clue:flagged' as any)
      socket.off('error')
      if (timerRef.current) clearInterval(timerRef.current)
      timeoutRefs.current.forEach(clearTimeout)
      timeoutRefs.current = []
    }
  }, [code])

  // Scroll chat on new messages
  useEffect(() => {
    if (showChat) {
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages, showChat])

  // Dead chat autoscroll — also called via onContentSizeChange below so that
  // messages arriving while the keyboard is opening still land at the bottom.
  useEffect(() => {
    if (isEliminated) {
      setTimeout(() => deadChatScrollRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [deadChatMessages, isEliminated])

  // Count of flagged clues in the current round — surfaced to voters so the
  // instant-elimination risk is visible before they commit a vote.
  const flaggedCluesCount = useMemo(
    () => clues.reduce((n, c: any) => (c.flaggedForWord ? n + 1 : n), 0),
    [clues]
  )

  // ─── Actions ────────────────────────────────────────────────────────────────

  const submitClue = () => {
    if (!clueText.trim() || hasSubmittedClue || phase !== 'speaking' || isEliminated) return
    log.info('clue submitted')
    getSocket().emit('clue:submit', clueText.trim())
    setClueText('')
    setHasSubmittedClue(true)
    Keyboard.dismiss()
    HapticManager.light()
  }

  const vote = (playerId: string) => {
    if (votedFor || phase !== 'voting') return
    // Eliminated ghosts cannot vote (server enforces too). Mirrors web.
    if (isEliminated) return
    log.info('vote cast', { targetId: playerId })
    SoundManager.play('vote')
    setVotedFor(playerId)
    HapticManager.medium()
    getSocket().emit('vote:cast', playerId)
  }

  const skipVote = () => {
    if (votedFor || phase !== 'voting') return
    if (isEliminated) return
    log.info('vote skipped')
    SoundManager.play('vote')
    setVotedFor('__skip__')
    HapticManager.medium()
    getSocket().emit('vote:cast', null)
  }

  const sendChat = () => {
    if (!chatInput.trim()) return
    getSocket().emit('chat:send', chatInput.trim())
    setChatInput('')
    Keyboard.dismiss()
  }

  const sendDeadChat = () => {
    if (!deadChatInput.trim()) return
    getSocket().emit('deadchat:send' as any, { text: deadChatInput.trim() })
    setDeadChatInput('')
    Keyboard.dismiss()
  }

  const submitVocalFallbackClue = () => {
    if (!clueText.trim() || hasSubmittedClue || phase !== 'speaking' || isEliminated) return
    log.info('clue submitted (vocal fallback)')
    getSocket().emit('clue:submit', clueText.trim())
    setClueText('')
    setHasSubmittedClue(true)
    setVocalTextFallback(false)
    Keyboard.dismiss()
    HapticManager.light()
  }

  const sendEmote = (emoteId: string) => {
    const now = Date.now()
    if (now < emoteCooldownUntil) return
    if (now - lastEmoteTime.current < 1000) return
    lastEmoteTime.current = now
    getSocket().emit('emote:send' as any, { emoteId })
  }

  // Loadout — falls back to free basics while the store is still fetching so
  // the React bar never shows up empty mid-match.
  const emotesMe = useEmotesStore((s) => s.me)
  const fetchEmotesMe = useEmotesStore((s) => s.fetchMe)
  useEffect(() => { fetchEmotesMe() }, [fetchEmotesMe])
  const activeLoadout = emotesMe?.loadout && emotesMe.loadout.length > 0
    ? emotesMe.loadout
    : [...DEFAULT_LOADOUT]

  // Tick once per second while a server lockout is active so buttons
  // re-enable when the cooldown expires.
  useEffect(() => {
    if (emoteCooldownUntil <= Date.now()) return
    const id = setInterval(() => setEmoteNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [emoteCooldownUntil])

  const flagClue = (clueIndex: number) => {
    getSocket().emit('clue:flag' as any, { clueIndex })
  }

  const handleForfeit = () => {
    Alert.alert(
      'Forfeit Game',
      'Are you sure? You will lose this game and any ranked points.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forfeit',
          style: 'destructive',
          onPress: () => {
            getSocket().emit('game:forfeit')
            reset()
            router.replace('/')
          },
        },
      ]
    )
  }

  const handleLeaveEliminated = () => {
    getSocket().emit('game:leave-eliminated')
    reset()
    router.replace('/')
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['top', 'bottom']}>
      {/* Persistent DM badge — lets the player pop open a chat mid-game so
          messages aren't missed once the transient toast fades. */}
      <InGameChatButton />
      {/* Role reveal overlay */}
      <RoleRevealScreen
        visible={showRoleReveal}
        role={myRole ?? null}
        word={myWord ?? '???'}
        villagerWord={myVillagerWord ?? undefined}
        category={myCategory}
        gameMode={gameMode as 'normal' | 'special' | 'ranked'}
        blindMode={blindMode}
        onDismiss={() => setShowRoleReveal(false)}
      />

      {/* Elimination overlay */}
      {elimOverlayData && (
        <EliminationOverlay
          visible={showElimOverlay}
          username={elimOverlayData.username}
          role={elimOverlayData.role}
          reason={elimOverlayData.reason}
          isSelf={elimOverlayData.isSelf}
          onDismiss={() => {
            setShowElimOverlay(false)
            setElimOverlayData(null)
          }}
        />
      )}

      {/* Player clue history modal */}
      <PlayerClueHistoryModal
        visible={clueHistoryPlayer !== null}
        player={clueHistoryPlayer}
        completedRounds={completedRounds}
        currentClues={clues}
        onClose={() => setClueHistoryPlayer(null)}
      />

      {/* ── Detective reveal picker modal ─────────────────────────────────
          Opened from the Detective banner — one-shot reveal server-guarded. */}
      <Modal
        visible={showDetectivePicker && myRole === 'detective' && !detectiveRevealUsed}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetectivePicker(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/80 p-4">
          <View className="w-full max-w-md rounded-2xl bg-neutral-900 border border-blue-800/60 p-5">
            <View className="items-center mb-4">
              <Text style={{ fontSize: 40, marginBottom: 6 }}>🔍</Text>
              <Text className="text-blue-400 font-black text-lg">
                {t('game.detectiveRevealTitle', 'Reveal an Identity')}
              </Text>
              <Text className="text-neutral-500 text-xs text-center mt-1.5">
                {t('game.detectiveRevealDesc', 'Pick a player — their role will be shown only to you. One-shot.')}
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <View className="gap-2">
                {players
                  .filter((p) => p.userId !== user?.id && p.status === 'alive')
                  .map((p) => (
                    <TouchableOpacity
                      key={p.userId}
                      disabled={pendingPower === 'detective'}
                      accessibilityRole="button"
                      accessibilityLabel={`Reveal ${p.username}'s identity`}
                      onPress={() => {
                        log.info('detective revealing', { targetUserId: p.userId })
                        setPendingPower('detective')
                        getSocket().emit('detective:reveal', { targetUserId: p.userId })
                        setShowDetectivePicker(false)
                      }}
                      className={`flex-row items-center gap-2 px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 ${pendingPower === 'detective' ? 'opacity-50' : ''}`}
                      activeOpacity={0.7}
                    >
                      <Avatar url={p.avatarUrl} username={p.username} size={24} />
                      <Text className="text-white font-semibold text-sm flex-1">{p.username}</Text>
                      {pendingPower === 'detective' && (
                        <ActivityIndicator size="small" color="#60a5fa" />
                      )}
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowDetectivePicker(false)}
              disabled={pendingPower === 'detective'}
              accessibilityRole="button"
              accessibilityLabel="Close detective reveal picker"
              className={`mt-3 px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700 items-center ${pendingPower === 'detective' ? 'opacity-50' : ''}`}
              activeOpacity={0.7}
            >
              <Text className="text-neutral-400 text-xs font-semibold">
                {t('game.detectiveLater', 'Not yet — decide later')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Guardian protect picker modal ─────────────────────────────────
          Same pattern as Detective. Pick a player to shield from the next vote. */}
      <Modal
        visible={showGuardianPicker && myRole === 'guardian' && !guardianProtectUsed}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGuardianPicker(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/80 p-4">
          <View className="w-full max-w-md rounded-2xl bg-neutral-900 border border-yellow-800/60 p-5">
            <View className="items-center mb-4">
              <Text style={{ fontSize: 40, marginBottom: 6 }}>🛡️</Text>
              <Text className="text-yellow-400 font-black text-lg">
                {t('game.guardianProtectBtn')}
              </Text>
              <Text className="text-neutral-500 text-xs text-center mt-1.5">
                {t('game.guardianAvailable')}
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <View className="gap-2">
                {players
                  .filter((p) => p.userId !== user?.id && p.status === 'alive')
                  .map((p) => (
                    <TouchableOpacity
                      key={p.userId}
                      disabled={pendingPower === 'guardian'}
                      accessibilityRole="button"
                      accessibilityLabel={`Protect ${p.username} from elimination`}
                      onPress={() => {
                        log.info('guardian protecting', { targetUserId: p.userId })
                        setPendingPower('guardian')
                        getSocket().emit('guardian:protect' as any, { targetUserId: p.userId })
                        setShowGuardianPicker(false)
                      }}
                      className={`flex-row items-center gap-2 px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 ${pendingPower === 'guardian' ? 'opacity-50' : ''}`}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 14 }}>🛡️</Text>
                      <Avatar url={p.avatarUrl} username={p.username} size={24} />
                      <Text className="text-white font-semibold text-sm flex-1">{p.username}</Text>
                      {pendingPower === 'guardian' && (
                        <ActivityIndicator size="small" color="#fbbf24" />
                      )}
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowGuardianPicker(false)}
              disabled={pendingPower === 'guardian'}
              accessibilityRole="button"
              accessibilityLabel="Close guardian protect picker"
              className={`mt-3 px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700 items-center ${pendingPower === 'guardian' ? 'opacity-50' : ''}`}
              activeOpacity={0.7}
            >
              <Text className="text-neutral-400 text-xs font-semibold">
                {t('game.detectiveLater', 'Not yet — decide later')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Corruptor target picker modal ─────────────────────────────────
          Same pattern as Detective. Pick any time during the game. */}
      <Modal
        visible={showCorruptorPicker && myRole === 'corruptor' && !corruptorTargetUserId}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCorruptorPicker(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/80 p-4">
          <View className="w-full max-w-md rounded-2xl bg-neutral-900 border border-orange-800/60 p-5">
            <View className="items-center mb-4">
              <Text style={{ fontSize: 40, marginBottom: 6 }}>🕷️</Text>
              <Text className="text-orange-400 font-black text-lg">
                {t('game.corruptorPickTitle', 'Pick Your Target')}
              </Text>
              <Text className="text-neutral-500 text-xs text-center mt-1.5">
                {t('game.corruptorPickDesc', 'Their votes will be silently dropped until you die. One-shot — choose wisely.')}
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <View className="gap-2">
                {players
                  .filter((p) => p.userId !== user?.id && p.status === 'alive')
                  .map((p) => (
                    <TouchableOpacity
                      key={p.userId}
                      disabled={pendingPower === 'corruptor'}
                      accessibilityRole="button"
                      accessibilityLabel={`Silence ${p.username}'s votes`}
                      onPress={() => {
                        log.info('corruptor picking target', { targetUserId: p.userId })
                        setPendingPower('corruptor')
                        getSocket().emit('corruptor:pick-target' as any, { targetUserId: p.userId })
                      }}
                      className={`flex-row items-center gap-2 px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 ${pendingPower === 'corruptor' ? 'opacity-50' : ''}`}
                      activeOpacity={0.7}
                    >
                      <Avatar url={p.avatarUrl} username={p.username} size={24} />
                      <Text className="text-white font-semibold text-sm flex-1">{p.username}</Text>
                      {pendingPower === 'corruptor' && (
                        <ActivityIndicator size="small" color="#fb923c" />
                      )}
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowCorruptorPicker(false)}
              disabled={pendingPower === 'corruptor'}
              accessibilityRole="button"
              accessibilityLabel="Close corruptor target picker"
              className={`mt-3 px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700 items-center ${pendingPower === 'corruptor' ? 'opacity-50' : ''}`}
              activeOpacity={0.7}
            >
              <Text className="text-neutral-400 text-xs font-semibold">
                {t('game.corruptorLater', 'Not yet — decide later')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Kamikaze post-death modal ──
          Two branches so bystanders never learn the candidate list:
            • kamikaze sees the picker + "Spare everyone"
            • everyone else sees a waiting banner, no names leaked. */}
      <Modal
        visible={!!kamikazePrompt && kamikazePrompt?.kamikazeUserId === user?.id}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View className="flex-1 items-center justify-center bg-black/85 p-4">
          <View className="w-full max-w-md rounded-2xl bg-neutral-900 border border-red-800/60 p-5">
            <View className="items-center mb-4">
              <Text style={{ fontSize: 40, marginBottom: 6 }}>💥</Text>
              <Text className="text-red-400 font-black text-lg">
                {t('game.kamikazePickTitle', 'Take Someone With You')}
              </Text>
              <Text className="text-neutral-500 text-xs text-center mt-1.5">
                {t('game.kamikazePickDesc', 'Pick a player to eliminate alongside you — or spare them all.')}
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <View className="gap-2">
                {kamikazePrompt && players
                  .filter((p) => kamikazePrompt.candidateUserIds.includes(p.userId))
                  .map((p) => (
                    <TouchableOpacity
                      key={p.userId}
                      disabled={pendingPower === 'kamikaze'}
                      accessibilityRole="button"
                      accessibilityLabel={`Take ${p.username} out with you`}
                      onPress={() => {
                        log.info('kamikaze picking target', { targetUserId: p.userId })
                        setPendingPower('kamikaze')
                        getSocket().emit('kamikaze:pick-target' as any, { targetUserId: p.userId })
                      }}
                      className={`flex-row items-center gap-2 px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 ${pendingPower === 'kamikaze' ? 'opacity-50' : ''}`}
                      activeOpacity={0.7}
                    >
                      <Avatar url={p.avatarUrl} username={p.username} size={24} />
                      <Text className="text-white font-semibold text-sm flex-1">{p.username}</Text>
                      {pendingPower === 'kamikaze' && (
                        <ActivityIndicator size="small" color="#f87171" />
                      )}
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              onPress={() => {
                log.info('kamikaze sparing everyone')
                setPendingPower('kamikaze')
                getSocket().emit('kamikaze:skip' as any)
              }}
              disabled={pendingPower === 'kamikaze'}
              accessibilityRole="button"
              accessibilityLabel="Spare everyone — don't take a target"
              className={`mt-3 px-4 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 items-center ${pendingPower === 'kamikaze' ? 'opacity-50' : ''}`}
              activeOpacity={0.7}
            >
              <Text className="text-neutral-300 text-sm font-semibold">
                {t('game.kamikazeSkipBtn', 'Spare everyone')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bystander waiting banner — no candidate names, just a passive heads-up. */}
      <Modal
        visible={!!kamikazePrompt && kamikazePrompt?.kamikazeUserId !== user?.id}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View className="flex-1 items-center justify-center bg-black/70 p-4" pointerEvents="box-none">
          <View className="w-full max-w-md rounded-2xl bg-neutral-900 border border-red-900/60 p-5 items-center">
            <Text style={{ fontSize: 40, marginBottom: 6 }}>💥</Text>
            <Text className="text-red-400 font-black text-base text-center">
              {t('game.kamikazeWaitingTitle', 'The Kamikaze was eliminated')}
            </Text>
            <Text className="text-neutral-400 text-xs text-center mt-2">
              {kamikazePrompt
                ? t('game.kamikazeWaitingDesc', { name: kamikazePrompt.kamikazeUsername, defaultValue: '{{name}} is deciding whether to take someone with them…' })
                : ''}
            </Text>
          </View>
        </View>
      </Modal>

      {/* ── Evil Twins private DM modal ─────────────────────────────────
          Server-side: messages routed only to the two twins' user rooms,
          never broadcast — no eavesdropping surface. */}
      <Modal
        visible={isTwin && twinChatOpen && !!twinPartner}
        transparent
        animationType="slide"
        onRequestClose={() => setTwinChatOpen(false)}
      >
        <KeyboardAvoidingView
          className="flex-1 bg-black/40"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setTwinChatOpen(false)}
          />
          <View
            className="bg-neutral-950 border-t border-purple-700/60 rounded-t-2xl overflow-hidden"
            style={{ maxHeight: '80%' }}
            onStartShouldSetResponder={() => true}
          >
            {/* Header */}
            <View className="flex-row items-center gap-2 px-4 py-3 bg-purple-950/80 border-b border-purple-800/50">
              <Text style={{ fontSize: 20 }}>👯</Text>
              <View className="flex-1">
                <Text className="text-purple-300 text-[10px] font-bold uppercase tracking-wider">
                  {t('game.twinChatTitle', 'Twin Link')}
                </Text>
                <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                  {twinPartner?.twinUsername}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setTwinChatOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close twin chat"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                className="w-11 h-11 rounded-full bg-neutral-900 items-center justify-center"
                activeOpacity={0.7}
              >
                <Text className="text-neutral-400 text-base">✕</Text>
              </TouchableOpacity>
            </View>
            {/* Messages */}
            <ScrollView
              ref={twinChatScrollRef}
              className="bg-neutral-950"
              contentContainerStyle={{ padding: 12, gap: 8 }}
              showsVerticalScrollIndicator={false}
              style={{ minHeight: 220, maxHeight: 380 }}
              onContentSizeChange={() => twinChatScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {twinMessages.length === 0 ? (
                <Text className="text-neutral-400 text-xs italic text-center py-8">
                  {t('game.twinChatEmpty', 'No messages yet. Coordinate with your twin — stay in sync.')}
                </Text>
              ) : (
                twinMessages.map((m) => {
                  const mine = m.userId === user?.id
                  return (
                    <View
                      key={m.id}
                      className={['flex-row', mine ? 'justify-end' : 'justify-start'].join(' ')}
                    >
                      <View
                        className={[
                          'px-3 py-2 rounded-2xl',
                          mine
                            ? 'bg-purple-700/80 rounded-br-sm'
                            : 'bg-neutral-800 border border-purple-900/40 rounded-bl-sm',
                        ].join(' ')}
                        style={{ maxWidth: '75%' }}
                      >
                        <Text
                          className={['text-sm', mine ? 'text-white' : 'text-purple-100'].join(' ')}
                        >
                          {m.text}
                        </Text>
                      </View>
                    </View>
                  )
                })
              )}
            </ScrollView>
            {/* Input */}
            <View className="flex-row items-center gap-2 px-3 py-3 bg-neutral-900 border-t border-purple-900/40">
              <TextInput
                className="flex-1 px-3 py-2 rounded-xl bg-neutral-800 border border-purple-900/40 text-white text-sm"
                placeholder={t('game.twinChatPlaceholder', 'Whisper to your twin…')}
                placeholderTextColor="#525252"
                value={twinChatInput}
                onChangeText={setTwinChatInput}
                maxLength={200}
                returnKeyType="send"
                accessibilityLabel="Twin chat message input"
                onSubmitEditing={() => {
                  const text = twinChatInput.trim()
                  if (!text) return
                  getSocket().emit('twin:send' as any, { text })
                  setTwinChatInput('')
                }}
              />
              <TouchableOpacity
                onPress={() => {
                  const text = twinChatInput.trim()
                  if (!text) return
                  getSocket().emit('twin:send' as any, { text })
                  setTwinChatInput('')
                }}
                disabled={!twinChatInput.trim()}
                accessibilityRole="button"
                accessibilityLabel="Send twin chat message"
                className={[
                  'px-4 py-2 rounded-xl items-center justify-center',
                  twinChatInput.trim() ? 'bg-purple-600' : 'bg-neutral-800 opacity-40',
                ].join(' ')}
                activeOpacity={0.8}
              >
                <Text className="text-white text-sm font-bold">
                  {t('game.twinChatSend', 'Send')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Floating emote reactions — rarity-aware renderer with halo +
          particle bursts. See components/emotes/FloatingEmote.tsx. */}
      {floatingEmotes.length > 0 && (
        <View className="absolute top-20 left-0 right-0 z-50 items-center" pointerEvents="none">
          {floatingEmotes.map((e) => (
            <FloatingEmote key={e.id} emoteId={e.emoteId} emoji={e.emoji} username={e.username} />
          ))}
        </View>
      )}

      {/* Detective reveal toast */}
      {revealedPlayer && (
        <View
          className="absolute top-16 left-4 right-4 z-40 items-center"
          pointerEvents="none"
        >
          <View
            className="px-4 py-3 rounded-xl border border-blue-600 items-center"
            style={{ backgroundColor: 'rgba(8,8,20,0.95)' }}
          >
            <Text className="text-sm">
              <Text className="text-blue-400 font-bold">🔍 {revealedPlayer.username}: </Text>
              <Text
                className={[
                  'font-bold',
                  revealedPlayer.role === 'red_handed' || revealedPlayer.role === 'double_agent'
                    ? 'text-red-400'
                    : 'text-emerald-400',
                ].join(' ')}
              >
                {revealedPlayer.role === 'red_handed'
                  ? 'Imposter'
                  : revealedPlayer.role === 'double_agent'
                  ? 'Double Agent'
                  : revealedPlayer.role === 'detective'
                  ? 'Detective'
                  : 'Villager'}
              </Text>
            </Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: px, gap: isTablet ? 16 : 12, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={contentStyle}>
          {/* ─── Top bar ───────────────────────────────────────────────────── */}
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Wordmark size={90} />
                {code && (
                  <View className="border border-neutral-800 rounded px-2 py-0.5">
                    <Text className="text-xs font-mono text-neutral-500">{code}</Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center gap-2">
                <PhaseIndicator currentPhase={phase} />
              </View>
            </View>
            <View className="flex-row items-center justify-between">
              <Text
                className="text-xs text-neutral-400"
                accessibilityLabel={`${alivePlayers.length} players alive, round ${currentRound?.roundNumber ?? 1}`}
              >
                {alivePlayers.length} alive · Round {currentRound?.roundNumber ?? 1}
              </Text>
              {/* Forfeit button */}
              <TouchableOpacity
                onPress={handleForfeit}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Forfeit the game"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text className="text-xs text-neutral-400 font-semibold">🏳 Forfeit</Text>
              </TouchableOpacity>
            </View>
            {timeLeft > 0 && (
              <View>
                <CountdownBar seconds={timeLeft} total={totalTime} isVoting={phase === 'voting'} />
                {/* Phase-ending warning — fires at the last 10s and surfaces
                    exactly what phase is about to end. Red when critical. */}
                {timeLeft <= 10 && (phase === 'voting' || phase === 'speaking') && (
                  <Text
                    className={[
                      'text-[11px] font-bold mt-1 text-center',
                      timeLeft <= 3 ? 'text-red-400' : 'text-amber-400',
                    ].join(' ')}
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={`${phase === 'voting' ? 'Voting' : 'Clue submission'} ends in ${timeLeft} seconds`}
                  >
                    ⏱ {phase === 'voting'
                      ? `Voting ends in ${timeLeft}s`
                      : `Clue deadline in ${timeLeft}s`}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* ─── Role + Word card ──────────────────────────────────────────── */}
          {myVillagerWord ? (
            /* Double Agent: show both words */
            <View className="rounded-2xl border-2 border-orange-700/60 bg-orange-950/20 p-4 overflow-hidden">
              <View className="absolute top-0 left-0 right-0 h-0.5 bg-orange-500" />
              {/* Glow effect */}
              <View className="absolute inset-0 rounded-2xl" style={{ shadowColor: '#f97316', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 0 }} />
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-8 h-8 rounded-lg bg-orange-900/60 border border-orange-700/40 items-center justify-center">
                  <Text className="text-base">🎭</Text>
                </View>
                <Text className="text-xs font-bold uppercase tracking-widest text-orange-400">
                  Double Agent
                </Text>
              </View>
              <View className="mb-2">
                <CategoryBadge categoryKey={myCategory} />
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1 rounded-xl bg-emerald-950/50 border border-emerald-700/50 p-3">
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1.5">
                    Villager Word
                  </Text>
                  <Text className="text-xl font-extrabold text-emerald-200">{myVillagerWord}</Text>
                </View>
                <View className="flex-1 rounded-xl bg-orange-950/50 border border-orange-700/50 p-3">
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-1.5">
                    Imposter Word
                  </Text>
                  <Text className="text-xl font-extrabold text-orange-200">{myWord}</Text>
                </View>
              </View>
              <Text className="text-xs text-neutral-500 mt-2.5">
                You know both words — use this to your advantage
              </Text>
            </View>
          ) : roleInfo ? (
            <View
              className={['rounded-2xl border-2 p-5 overflow-hidden', roleInfo.border, roleInfo.bg].join(' ')}
            >
              {/* Top accent */}
              <View className={['absolute top-0 left-0 right-0 h-0.5', roleInfo.accent].join(' ')} />
              <View className="flex-row items-center gap-4">
                <View
                  className={['w-14 h-14 rounded-2xl items-center justify-center border', roleInfo.tile].join(' ')}
                >
                  <Text style={{ fontSize: 28 }}>{roleInfo.emoji}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
                    {t(roleInfo.headlineKey, roleInfo.headlineFallback)}
                  </Text>
                  <View className="flex-row items-center flex-wrap gap-1.5 mb-1">
                    {myCategory ? <CategoryBadge categoryKey={myCategory} /> : null}
                    {showCamp && camp && (
                      <View
                        className={['flex-row items-center gap-1 px-2 py-0.5 rounded-full border bg-neutral-900/60', CAMP_META[camp].border].join(' ')}
                      >
                        <View className={['w-1.5 h-1.5 rounded-full', CAMP_META[camp].dot].join(' ')} />
                        <Text className={['text-[10px] font-bold uppercase tracking-widest', CAMP_META[camp].text].join(' ')}>
                          {CAMP_META[camp].label}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    className={['font-extrabold tracking-tight', roleInfo.text].join(' ')}
                    style={{ fontSize: 28 }}
                  >
                    {myWord ?? '???'}
                  </Text>
                  <Text className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    {t(roleInfo.hintKey, roleInfo.hintFallback)}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            /* Blind role mode: render a neutral "role hidden" word card.
               Deliberately uses grey neutral styling so nothing about the
               card can leak the player's team. */
            <View className="rounded-2xl border-2 border-neutral-700 bg-neutral-900/40 p-5 overflow-hidden">
              <View className="absolute top-0 left-0 right-0 h-0.5 bg-neutral-500" />
              <View className="flex-row items-center gap-4">
                <View className="w-14 h-14 rounded-2xl items-center justify-center border border-neutral-700 bg-neutral-800/60">
                  <Text style={{ fontSize: 28 }}>🙈</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
                    {t('game.roleHiddenLabel', 'ROLE HIDDEN')}
                  </Text>
                  <View className="flex-row items-center flex-wrap gap-1.5 mb-1">
                    {myCategory ? <CategoryBadge categoryKey={myCategory} /> : null}
                  </View>
                  <Text
                    className="font-extrabold tracking-tight text-neutral-100"
                    style={{ fontSize: 28 }}
                  >
                    {myWord ?? '???'}
                  </Text>
                  <Text className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    {t('game.blindModeHint', 'Your role is a secret — even to you. It will be revealed when you are eliminated or when the game ends.')}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ─── Detective Ability Banner ──────────────────────────────────
              One-shot reveal is available any time during clues or voting —
              tapping the button opens the picker modal. Mirrors web pattern. */}
          {myRole === 'detective' && (
            <View
              className={[
                'rounded-2xl border p-3 gap-2',
                detectiveRevealUsed
                  ? 'border-neutral-800 bg-neutral-900/40'
                  : 'border-blue-800/40 bg-blue-950/40',
              ].join(' ')}
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-sm">🔍</Text>
                <Text
                  className={[
                    'text-xs font-semibold',
                    detectiveRevealUsed ? 'text-neutral-600' : 'text-blue-400',
                  ].join(' ')}
                >
                  {detectiveRevealUsed
                    ? t('game.detectiveUsed', 'Reveal ability used')
                    : t('game.detectiveAvailable', 'Reveal ready — pick anyone, any time')}
                </Text>
              </View>
              {!detectiveRevealUsed && !isEliminated && (phase === 'speaking' || phase === 'voting') && (
                <TouchableOpacity
                  onPress={() => setShowDetectivePicker(true)}
                  className="px-3 py-2 rounded-lg bg-blue-600 items-center"
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-xs font-bold">
                    {t('game.detectiveRevealOpenBtn', 'Reveal an identity')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ─── Corruptor Ability Banner ──────────────────────────────────
              Any-time pick — corruptor can wait until they know who to
              silence. Picker opens on demand from the button. */}
          {myRole === 'corruptor' && (
            <View
              className={[
                'rounded-2xl border p-3 gap-2',
                corruptorTargetUserId
                  ? 'border-orange-800/40 bg-orange-900/30'
                  : 'border-orange-700/60 bg-orange-950/50',
              ].join(' ')}
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-sm">🕷️</Text>
                <Text className="text-orange-300 text-xs font-semibold flex-1">
                  {corruptorTargetUserId
                    ? t('game.corruptorTargetLocked', 'Your target is silenced')
                    : t('game.corruptorAvailableAnyTime', 'Corruption ready — silence anyone, any time')}
                </Text>
              </View>
              {!corruptorTargetUserId && !isEliminated && (
                <TouchableOpacity
                  onPress={() => setShowCorruptorPicker(true)}
                  className="px-3 py-2 rounded-lg bg-orange-600 items-center"
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-xs font-bold">
                    {t('game.corruptorPickBtn', 'Pick a target')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ─── Mayor / Inverter status banners ─────────────────────────
              The *activation buttons* live next to the vote so they surface
              exactly when actionable. These persistent status pills remind
              the player what charge they have left. */}
          {myRole === 'mayor' && (
            <View
              className={[
                'rounded-2xl border px-3 py-2 flex-row items-center gap-2',
                mayorDoubleActive
                  ? 'bg-indigo-900/50 border-indigo-600/60'
                  : mayorDoubleVoteUsed
                  ? 'bg-neutral-900/40 border-neutral-800'
                  : 'bg-indigo-950/40 border-indigo-800/40',
              ].join(' ')}
            >
              <Text>⚖️</Text>
              <Text
                className={[
                  'text-xs font-semibold flex-1',
                  mayorDoubleActive
                    ? 'text-indigo-300'
                    : mayorDoubleVoteUsed
                    ? 'text-neutral-600'
                    : 'text-indigo-400',
                ].join(' ')}
              >
                {mayorDoubleActive
                  ? t('game.mayorDoubleVoteActive', 'Double vote active this round')
                  : mayorDoubleVoteUsed
                  ? t('game.mayorDoubleVoteUsed', 'Double vote used')
                  : t('game.mayorAvailable', 'Double vote ready')}
              </Text>
            </View>
          )}
          {myRole === 'inverter' && (
            <View
              className={[
                'rounded-2xl border px-3 py-2 flex-row items-center gap-2',
                inverterActive
                  ? 'bg-rose-900/50 border-rose-600/60'
                  : inverterUsed
                  ? 'bg-neutral-900/40 border-neutral-800'
                  : 'bg-rose-950/40 border-rose-800/40',
              ].join(' ')}
            >
              <Text>🔄</Text>
              <Text
                className={[
                  'text-xs font-semibold flex-1',
                  inverterActive
                    ? 'text-rose-300'
                    : inverterUsed
                    ? 'text-neutral-600'
                    : 'text-rose-400',
                ].join(' ')}
              >
                {inverterActive
                  ? t('game.inverterActive', 'Vote inversion active this round')
                  : inverterUsed
                  ? t('game.inverterUsed', 'Vote inversion used')
                  : t('game.inverterAvailable', 'Vote inversion ready')}
              </Text>
            </View>
          )}

          {/* ─── Twin partner banner → DM ───────────────────────────────
              Clickable button with unread badge; opens the twin chat modal. */}
          {isTwin && twinPartner && (
            <TouchableOpacity
              onPress={() => {
                setTwinChatOpen(true)
                clearTwinUnread()
              }}
              accessibilityRole="button"
              accessibilityLabel={`Open twin chat with ${twinPartner.twinUsername}${twinUnread > 0 ? `, ${twinUnread} unread` : ''}`}
              className="rounded-xl border border-purple-800/40 bg-purple-950/40 px-3 py-3 flex-row items-center gap-2"
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14 }}>👯</Text>
              <Text className="text-purple-300 font-semibold text-xs flex-1" numberOfLines={1}>
                {t('game.twinPartnerBanner', { name: twinPartner.twinUsername, defaultValue: 'Your twin: {{name}}' })}
              </Text>
              {twinUnread > 0 ? (
                <View className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 items-center justify-center">
                  <Text className="text-white text-[10px] font-black">
                    {twinUnread > 9 ? '9+' : twinUnread}
                  </Text>
                </View>
              ) : (
                <Text className="text-purple-200/80 text-[10px] font-bold uppercase tracking-wider">
                  {t('game.twinChatOpen', 'DM')}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* ─── Guardian persistent banner ──────────────────────────────
              Reminds the Guardian that their protection is still available,
              even outside the vote phase. One tap opens the picker modal so
              they never forget to use it and get caught by the timer. */}
          {myRole === 'guardian' && !guardianProtectUsed && !isEliminated && (
            <TouchableOpacity
              onPress={() => setShowGuardianPicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Protect a player — Guardian ability ready"
              className="flex-row items-center gap-2 px-3 py-3 rounded-xl border-2 border-yellow-600/60 bg-yellow-950/40"
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>🛡️</Text>
              <View className="flex-1">
                <Text className="text-yellow-300 font-bold text-xs uppercase tracking-wider">
                  Protection ready
                </Text>
                <Text className="text-yellow-200/80 text-[11px] mt-0.5" numberOfLines={1}>
                  Tap to shield a player before the vote
                </Text>
              </View>
              <View className="px-2 py-1 rounded-md bg-yellow-600">
                <Text className="text-white text-[10px] font-black uppercase tracking-wider">
                  Protect
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ─── Speaking phase: clue input (typing mode) ────────────────────── */}
          {phase === 'speaking' && !isEliminated && (!vocalMode || vocalTextFallback) && (
            <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  Your Clue
                </Text>
                {!hasSubmittedClue && (
                  <Text
                    className={[
                      'text-[10px] font-mono font-semibold',
                      clueText.length >= 180 ? 'text-red-400'
                      : clueText.length >= 150 ? 'text-amber-400'
                      : 'text-neutral-500',
                    ].join(' ')}
                    accessibilityLabel={`${clueText.length} of 200 characters`}
                  >
                    {clueText.length}/200
                  </Text>
                )}
              </View>
              {hasSubmittedClue ? (
                <View className="flex-row items-center gap-2 py-2">
                  <Text
                    className="text-emerald-400 text-sm"
                    accessibilityLiveRegion="polite"
                  >
                    ✓ Clue submitted — waiting for others...
                  </Text>
                </View>
              ) : (
                <View className="flex-row gap-2">
                  <TextInput
                    className="flex-1 bg-neutral-800 text-white px-4 py-3 rounded-xl border border-neutral-700 text-sm"
                    placeholder="One sentence clue..."
                    placeholderTextColor="#6b7280"
                    value={clueText}
                    onChangeText={setClueText}
                    maxLength={200}
                    returnKeyType="send"
                    onSubmitEditing={vocalTextFallback ? submitVocalFallbackClue : submitClue}
                    accessibilityLabel="Clue text input, up to 200 characters"
                  />
                  <TouchableOpacity
                    onPress={vocalTextFallback ? submitVocalFallbackClue : submitClue}
                    disabled={!clueText.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Send clue"
                    accessibilityState={{ disabled: !clueText.trim() }}
                    className={[
                      'px-4 py-3 rounded-xl items-center justify-center min-w-[64px]',
                      clueText.trim() ? 'bg-violet-600' : 'bg-neutral-800 opacity-40',
                    ].join(' ')}
                  >
                    <Text className="text-white font-semibold text-sm">Send</Text>
                  </TouchableOpacity>
                </View>
              )}
              {vocalTextFallback && !hasSubmittedClue && (
                <Text className="text-[10px] text-neutral-500 mt-2 italic">
                  Typing fallback — mic unavailable
                </Text>
              )}
            </View>
          )}

          {/* ─── Live clue feed ──────────────────────────────────────────────
              Mobile lacks the per-player sidebar that web shows clues in, so
              surface the submitted clues of the current round inline. Visible
              during speaking (so players can read as they come in) and voting
              (so they can re-read before picking), and for eliminated players
              who are spectating. Empty state keeps the panel visible so players
              know where clues will appear — avoids a blank-screen feel early
              in the round. */}
          {(phase === 'speaking' || phase === 'voting') && (
            <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  {t('game.cluesThisRound', 'Clues this round')}
                </Text>
                <View className="px-2 py-0.5 rounded-full bg-violet-950/50 border border-violet-800/40">
                  <Text className="text-[10px] font-bold text-violet-400">
                    {clues.length}/{alivePlayers.length}
                  </Text>
                </View>
              </View>
              {clues.length === 0 && (
                <View className="py-4 items-center">
                  <Text className="text-neutral-300 text-xs italic">
                    Waiting for clues…
                  </Text>
                  <Text className="text-neutral-400 text-[10px] mt-1">
                    Clues will appear here as players submit them
                  </Text>
                </View>
              )}
              {/* Flagged-clue voter warning — visible in the vote phase so
                  players notice the instant-elimination risk even if the
                  flagged author's tile scrolls off-screen. */}
              {phase === 'voting' && flaggedCluesCount > 0 && (
                <View
                  className="mb-3 px-3 py-2 rounded-lg bg-amber-950/60 border border-amber-700/50"
                  accessibilityLiveRegion="polite"
                >
                  <Text className="text-amber-300 text-[11px] font-bold">
                    ⚠ {flaggedCluesCount === 1 ? '1 clue flagged' : `${flaggedCluesCount} clues flagged`} — said their own word
                  </Text>
                  <Text className="text-amber-400/80 text-[10px] mt-0.5">
                    Flagged players are instantly eliminated if they're the imposter
                  </Text>
                </View>
              )}
              <View style={{ gap: 6 }}>
                {clues.map((c) => {
                  const author = players.find((p) => p.userId === c.playerId)
                  const isMe = c.playerId === user?.id
                  const flagged = (c as any).flaggedForWord
                  return (
                    <View
                      key={c.playerId}
                      className={[
                        'flex-row items-start gap-2.5 px-3 py-2 rounded-xl border',
                        flagged
                          ? 'bg-amber-950/30 border-amber-800/40'
                          : isMe
                          ? 'bg-violet-950/20 border-violet-800/30'
                          : 'bg-neutral-800/40 border-neutral-700/40',
                      ].join(' ')}
                    >
                      <Avatar
                        url={author?.avatarUrl}
                        username={author?.username ?? '?'}
                        size={24}
                      />
                      <View className="flex-1 min-w-0">
                        <View className="flex-row items-center gap-1.5 flex-wrap">
                          <Text className="text-white text-xs font-bold">
                            {author?.username ?? 'Unknown'}
                          </Text>
                          {isMe && (
                            <View className="px-1 py-0.5 rounded bg-violet-900/60 border border-violet-700/40">
                              <Text className="text-[9px] text-violet-400 font-bold">YOU</Text>
                            </View>
                          )}
                          {flagged && (
                            <Text className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                              ⚠ {t('game.saidTheWordBadge', 'Said the word')}
                            </Text>
                          )}
                        </View>
                        <Text className="text-neutral-200 text-sm leading-snug mt-0.5">
                          {c.text}
                        </Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          )}

          {/* ─── Speaking phase: vocal mode (turn-based, no text) ──────────── */}
          {phase === 'speaking' && !isEliminated && vocalMode && !vocalTextFallback && (() => {
            const speaker = vocalSpeakerId ? players.find((p) => p.userId === vocalSpeakerId) : null
            const isMyTurn = !!(vocalSpeakerId && user?.id === vocalSpeakerId)
            const pct =
              vocalPerTurnSeconds > 0
                ? Math.max(0, Math.min(1, vocalTurnTimeLeft / vocalPerTurnSeconds))
                : 0
            return (
              <View
                className={[
                  'rounded-2xl border p-4',
                  isMyTurn ? 'bg-violet-950/40 border-violet-700' : 'bg-neutral-900 border-neutral-800',
                ].join(' ')}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-300">
                    Vocal turn {Math.min(vocalTurnIndex + 1, vocalTotalSpeakers || 1)} / {vocalTotalSpeakers || 1}
                  </Text>
                  <Text
                    className={[
                      'text-xs font-bold',
                      vocalTurnTimeLeft <= 3
                        ? 'text-red-400'
                        : isMyTurn
                          ? 'text-violet-300'
                          : 'text-neutral-400',
                    ].join(' ')}
                  >
                    {vocalTurnTimeLeft}s
                  </Text>
                </View>
                {/* Countdown bar */}
                <View className="h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-4">
                  <View
                    className={[
                      'h-full rounded-full',
                      vocalTurnTimeLeft <= 3
                        ? 'bg-red-500'
                        : isMyTurn
                          ? 'bg-violet-500'
                          : 'bg-emerald-500',
                    ].join(' ')}
                    style={{ width: `${pct * 100}%` }}
                  />
                </View>
                {voiceMicError && (
                  <View className="rounded-xl border border-amber-800 bg-amber-950/40 px-3 py-2 mb-3">
                    <Text className="text-amber-300 text-xs font-semibold">
                      Microphone unavailable — other players won't hear you.
                    </Text>
                    <Text className="text-amber-400/80 text-[11px] mt-1">
                      Enable mic in system settings, or type your clue as a fallback.
                    </Text>
                    <TouchableOpacity
                      onPress={() => setVocalTextFallback(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Switch to typing a clue instead of speaking"
                      className="mt-2 self-start px-3 py-1.5 rounded-lg bg-amber-600 border border-amber-400/60"
                      activeOpacity={0.8}
                    >
                      <Text className="text-white text-[11px] font-bold uppercase tracking-wider">
                        ⌨ Switch to typing
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                {speaker ? (
                  <View className="flex-row items-center gap-3 mb-3">
                    <Avatar url={speaker.avatarUrl} username={speaker.username ?? '?'} size={40} />
                    <View className="flex-1">
                      <Text className="text-white font-bold text-base">
                        {isMyTurn
                          ? "It's your turn — speak now!"
                          : `${speaker.username ?? 'Someone'} is speaking...`}
                      </Text>
                      <Text className="text-neutral-500 text-xs mt-0.5">
                        {isMyTurn
                          ? 'Give your clue out loud — tap Done when finished'
                          : 'Listen carefully — your turn is coming'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text className="text-neutral-500 text-sm italic py-2">
                    Waiting for the next speaker...
                  </Text>
                )}
                {isMyTurn && (
                  <TouchableOpacity
                    onPress={() => getSocket().emit('vocal:skip-turn' as any)}
                    className="bg-violet-600 rounded-xl py-3 items-center"
                    activeOpacity={0.8}
                  >
                    <Text className="text-white font-bold text-sm">I'm done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })()}

          {/* ─── Voting phase ──────────────────────────────────────────────── */}
          {/* Hidden for eliminated ghosts so they can't tap vote targets. */}
          {phase === 'voting' && !isEliminated && (
            <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-300">
                  Vote out the RedHanded
                </Text>
                {totalVoters > 0 && (
                  <Text
                    className={[
                      'text-xs font-bold',
                      voteCount === totalVoters ? 'text-emerald-400' : 'text-neutral-400',
                    ].join(' ')}
                  >
                    {voteCount}/{totalVoters}
                  </Text>
                )}
              </View>

              {/* Vote progress bar */}
              {totalVoters > 0 && (
                <View className="h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-3">
                  <View
                    className={[
                      'h-full rounded-full',
                      voteCount === totalVoters ? 'bg-emerald-500' : 'bg-amber-500',
                    ].join(' ')}
                    style={{ width: `${(voteCount / totalVoters) * 100}%` }}
                  />
                </View>
              )}

              {/* Voter avatar row — tiny avatars for everyone who's already
                  cast a vote (target or skip). Gives a visible "who's left to
                  decide" cue without revealing targets. */}
              {votedUserIds.length > 0 && (
                <View
                  className="flex-row items-center flex-wrap gap-1 mb-3"
                  accessibilityLabel={`${votedUserIds.length} of ${totalVoters} players have voted`}
                >
                  <Text className="text-[10px] text-neutral-400 mr-1 font-semibold uppercase tracking-wider">
                    Voted:
                  </Text>
                  {votedUserIds.map((uid) => {
                    const vp = players.find((pp) => pp.userId === uid)
                    if (!vp) return null
                    return (
                      <View key={uid} className="flex-row items-center gap-1 px-1.5 py-0.5 rounded-full bg-neutral-800/70 border border-neutral-700/50">
                        <Avatar url={vp.avatarUrl} username={vp.username} size={14} />
                        <Text className="text-[10px] text-neutral-200 font-medium">{vp.username}</Text>
                      </View>
                    )
                  })}
                </View>
              )}

              {/* All votes in message */}
              {allVotedMsg && (
                <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800/40 mb-3">
                  <Text className="text-sm">✅</Text>
                  <Text className="text-sm font-semibold text-emerald-400">All votes in!</Text>
                </View>
              )}

              {/* ── Vote-phase power strip ──
                  Mayor / Inverter activation buttons surface here so they
                  can't be missed — mirrors web pattern. */}
              {!isEliminated && (
                <View className="mb-3" style={{ gap: 8 }}>
                  {myRole === 'mayor' && !mayorDoubleVoteUsed && !mayorDoubleActive && (
                    <TouchableOpacity
                      onPress={() => {
                        log.info('mayor activating double vote (vote panel)')
                        getSocket().emit('mayor:activate-double' as any)
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('game.mayorDoubleVoteBtn', 'Double my vote') + ' — Mayor power'}
                      className="flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 border-2 border-indigo-400/60 min-h-[44px]"
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 18 }}>⚖️</Text>
                      <Text className="text-white font-black text-sm uppercase tracking-wide">
                        {t('game.mayorDoubleVoteBtn', 'Double my vote')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {myRole === 'mayor' && mayorDoubleActive && (
                    <View className="flex-row items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-900/50 border border-indigo-500/60">
                      <Text>⚖️</Text>
                      <Text className="text-indigo-200 text-xs font-bold">
                        {t('game.mayorDoubleVoteActive', 'Double vote active this round')}
                      </Text>
                    </View>
                  )}
                  {myRole === 'inverter' && !inverterUsed && !inverterActive && (
                    <TouchableOpacity
                      onPress={() => {
                        log.info('inverter activating (vote panel)')
                        getSocket().emit('inverter:activate' as any)
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('game.inverterActivateBtn', 'Invert the vote') + ' — Inverter power'}
                      className="flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-600 border-2 border-rose-400/60 min-h-[44px]"
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 18 }}>🔄</Text>
                      <Text className="text-white font-black text-sm uppercase tracking-wide">
                        {t('game.inverterActivateBtn', 'Invert the vote')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {myRole === 'inverter' && inverterActive && (
                    <View className="flex-row items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-900/50 border border-rose-500/60">
                      <Text>🔄</Text>
                      <Text className="text-rose-200 text-xs font-bold">
                        {t('game.inverterActive', 'Vote inversion active this round')}
                      </Text>
                    </View>
                  )}
                  {myRole === 'guardian' && !guardianProtectUsed && (
                    <TouchableOpacity
                      onPress={() => setShowGuardianPicker(true)}
                      accessibilityRole="button"
                      accessibilityLabel={t('game.guardianProtectBtn') + ' — Guardian power'}
                      className="flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl bg-yellow-600 border-2 border-yellow-400/60 min-h-[44px]"
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 18 }}>🛡️</Text>
                      <Text className="text-white font-black text-sm uppercase tracking-wide">
                        {t('game.guardianProtectBtn')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {myRole === 'guardian' && guardianProtectUsed && (
                    <View className="flex-row items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-900/50 border border-yellow-500/60">
                      <Text>🛡️</Text>
                      <Text className="text-yellow-200 text-xs font-bold">
                        {t('game.guardianUsed')}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Your vote summary */}
              {votedFor === '__skip__' ? (
                <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900/60 border border-neutral-700/40 mb-3">
                  <Text className="text-neutral-400 text-xs">🚫</Text>
                  <Text className="text-xs text-neutral-300 font-semibold">
                    {t('game.youSkippedVote')}
                  </Text>
                </View>
              ) : votedFor &&
                (() => {
                  const votedPlayer = alivePlayers.find((p) => p.userId === votedFor)
                  return votedPlayer ? (
                    <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-amber-950/30 border border-amber-800/30 mb-3">
                      <Text className="text-amber-400 text-xs">🗳</Text>
                      <Text className="text-xs text-amber-300 font-semibold">
                        You voted for{' '}
                        <Text className="text-amber-200">{votedPlayer.username}</Text>
                      </Text>
                    </View>
                  ) : null
                })()}

              {(() => {
                const voteTargets = alivePlayers.filter((p) => p.userId !== user?.id)
                const voteCols = voteTargets.length <= 3 ? 1 : voteTargets.length > 10 ? 3 : 2
                const itemWidth = voteCols === 1 ? '100%' : voteCols === 2 ? '49%' : '32%'
                return (
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {voteTargets.map((p) => {
                      const isVotedTarget = votedFor === p.userId
                      const hasVoted = !!votedFor
                      const playerClue = clues.find((c) => c.playerId === p.userId)
                      const canProtect = myRole === 'guardian' && !guardianProtectUsed && p.status === 'alive'
                      return (
                        <View key={p.id} style={{ width: itemWidth }}>
                          <VoteOption
                            player={p}
                            clue={playerClue ? { text: playerClue.text, flaggedForWord: (playerClue as any).flaggedForWord } : undefined}
                            isVotedTarget={isVotedTarget}
                            hasVoted={hasVoted}
                            disabled={hasVoted || isEliminated}
                            onPress={() => vote(p.userId)}
                            canProtect={canProtect}
                            onProtect={() => {
                              log.info('guardian protecting', { targetUserId: p.userId })
                              getSocket().emit('guardian:protect' as any, { targetUserId: p.userId })
                            }}
                          />
                        </View>
                      )
                    })}
                  </View>
                )
              })()}
              <TouchableOpacity
                onPress={skipVote}
                disabled={!!votedFor || isEliminated}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('game.skipVote') + ' — abstain from this round'}
                accessibilityState={{ disabled: !!votedFor || isEliminated, selected: votedFor === '__skip__' }}
                className={[
                  'mt-2 flex-row items-center gap-3 px-3 py-2.5 rounded-xl border min-h-[44px]',
                  votedFor === '__skip__'
                    ? 'border-neutral-500/70 bg-neutral-800/60'
                    : votedFor
                    ? 'border-neutral-800 bg-neutral-900/40 opacity-50'
                    : 'border-neutral-800 bg-neutral-900/40',
                ].join(' ')}
              >
                <View className="w-8 h-8 rounded-full bg-neutral-800 items-center justify-center">
                  <Text className="text-neutral-300 text-sm">🚫</Text>
                </View>
                <Text className="flex-1 font-bold text-neutral-200 text-sm">
                  {t('game.skipVote')}
                </Text>
                {votedFor === '__skip__' && (
                  <Text className="text-neutral-300 text-xs font-bold">
                    {t('game.yourVoteLabel')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ─── Reveal phase ──────────────────────────────────────────────── */}
          {phase === 'reveal' && (
            <View className="rounded-2xl overflow-hidden border border-neutral-700">
              {/* Colored header strip */}
              <View
                className={[
                  'px-5 py-4 items-center',
                  eliminated?.role === 'red_handed' || eliminated?.role === 'double_agent'
                    ? 'bg-emerald-950/60'
                    : eliminated
                    ? 'bg-violet-950/60'
                    : 'bg-neutral-900',
                ].join(' ')}
              >
                <View
                  className={[
                    'absolute top-0 left-0 right-0 h-0.5',
                    eliminated?.role === 'red_handed' || eliminated?.role === 'double_agent'
                      ? 'bg-emerald-500'
                      : eliminated
                      ? 'bg-violet-500'
                      : 'bg-amber-500',
                  ].join(' ')}
                />
                <Text style={{ fontSize: 48, marginBottom: 8 }}>
                  {eliminated?.role === 'red_handed' || eliminated?.role === 'double_agent'
                    ? '🎉'
                    : eliminated
                    ? '😬'
                    : isTie
                    ? '🤝'
                    : '😬'}
                </Text>
              {eliminated ? (
                <>
                  <Text className="text-white font-bold text-lg mb-1 text-center">
                    {eliminated.username} was eliminated
                  </Text>
                  <Text
                    className={[
                      'text-sm font-semibold',
                      eliminated.role === 'red_handed' || eliminated.role === 'double_agent'
                        ? 'text-red-400'
                        : 'text-violet-400',
                    ].join(' ')}
                  >
                    They were a{' '}
                    {eliminated.role === 'red_handed'
                      ? 'Imposter'
                      : eliminated.role === 'double_agent'
                      ? 'Double Agent'
                      : eliminated.role === 'detective'
                      ? 'Detective'
                      : 'Villager'}
                  </Text>
                </>
              ) : isTie ? (
                <>
                  <Text className="text-white font-bold text-lg mb-1">It's a tie!</Text>
                  <Text className="text-neutral-400 text-sm">No one was eliminated this round</Text>
                </>
              ) : (
                <Text className="text-neutral-400 text-sm">No one was eliminated this round</Text>
              )}
              {/* Word reveal */}
              {wordReveal && (
                <View className="mt-4 w-full items-center gap-2">
                  <CategoryBadge categoryKey={((wordReveal as any).category as WordCategory | undefined) ?? myCategory} />
                  <View className="flex-row gap-3 w-full">
                    <View className="flex-1 rounded-xl bg-violet-950/50 border border-violet-700/50 p-3 items-center">
                      <Text className="text-[10px] font-bold uppercase tracking-widest text-violet-500 mb-1">Villager Word</Text>
                      <Text className="text-white font-extrabold text-xl">{wordReveal.villagerWord}</Text>
                    </View>
                    <View className="flex-1 rounded-xl bg-amber-950/50 border border-amber-700/50 p-3 items-center">
                      <Text className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">Imposter Word</Text>
                      <Text className="text-amber-300 font-extrabold text-xl">
                        {wordReveal.redHandedWord}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-300 mt-4" accessibilityLiveRegion="polite">Next round starting soon...</Text>
              </View>
              <View className="bg-neutral-950 h-1" />
            </View>
          )}

          {/* ─── Players list ──────────────────────────────────────────────── */}
          <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Players
              </Text>
              <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/50 border border-emerald-800/30">
                <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <Text className="text-[10px] font-bold text-emerald-400">{alivePlayers.length} alive</Text>
              </View>
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              {players.map((p) => {
                const isAlive = p.status === 'alive'
                const isForfeited = p.status === ('forfeited' as any)
                const isDisconnected = (p as any).disconnected === true
                const isMe = p.userId === user?.id
                const canViewHistory = !isMe && (hasSubmittedClue || phase !== 'speaking')
                const isSpeakingNow = isAlive && vocalMode && phase === 'speaking' && vocalSpeakerId === p.userId
                const statusLabel = isDisconnected ? 'disconnected' : isSpeakingNow ? 'speaking now' : isAlive ? (isMe ? 'you, alive' : 'alive') : isForfeited ? 'forfeited' : 'eliminated'
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => canViewHistory ? setClueHistoryPlayer({ userId: p.userId, username: p.username, avatarUrl: p.avatarUrl }) : undefined}
                    activeOpacity={canViewHistory ? 0.7 : 1}
                    accessibilityRole={canViewHistory ? 'button' : undefined}
                    accessibilityLabel={`${p.username}, ${statusLabel}${canViewHistory ? ' — tap to view clue history' : ''}`}
                    className={[
                      'flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-xl border',
                      isDisconnected
                        ? 'bg-neutral-900/60 border-dashed border-amber-900/40 opacity-70'
                        : isSpeakingNow
                        ? 'bg-brand-900/60 border-brand-500/70'
                        : isAlive && isMe
                        ? 'bg-violet-950/40 border-violet-700/50'
                        : isAlive
                        ? 'bg-neutral-800/70 border-neutral-700/50'
                        : isForfeited
                        ? 'bg-orange-950/30 border-orange-900/30'
                        : 'bg-neutral-900/40 border-neutral-800/30 opacity-40',
                    ].join(' ')}
                  >
                    <View
                      className={[
                        'w-1.5 h-1.5 rounded-full',
                        isDisconnected ? 'bg-amber-500' : isSpeakingNow ? 'bg-brand-400' : isAlive ? (isMe ? 'bg-violet-400' : 'bg-emerald-400') : isForfeited ? 'bg-orange-600' : 'bg-neutral-700',
                      ].join(' ')}
                    />
                    <View style={{ opacity: isDisconnected ? 0.5 : isAlive ? 1 : 0.4 }}>
                      <Avatar url={p.avatarUrl} username={p.username} size={18} />
                    </View>
                    <Text
                      className={[
                        'text-xs font-semibold',
                        isDisconnected ? 'text-neutral-400 italic' : isSpeakingNow ? 'text-brand-100' : isAlive ? (isMe ? 'text-violet-200' : 'text-white') : 'text-neutral-500',
                      ].join(' ')}
                    >
                      {p.username}
                    </Text>
                    {isDisconnected && (
                      <Text className="text-[9px] font-bold text-amber-400">📵 offline</Text>
                    )}
                    {!isDisconnected && isSpeakingNow && (
                      <Text className="text-[10px]">🎤</Text>
                    )}
                    {!isDisconnected && !isAlive && !isForfeited && (
                      <Text className="text-[9px] text-neutral-500">☠</Text>
                    )}
                    {!isDisconnected && canViewHistory && isAlive && (
                      <Text className="text-[9px] text-neutral-400">📜</Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text className="text-[10px] text-neutral-400 mt-2">Tap a player to see their clue history</Text>
          </View>

          {/* ─── Emote Reactions Bar ───────────────────────────────────────── */}
          {!isEliminated && (() => {
            const cooldownRemaining = Math.max(0, emoteCooldownUntil - (emoteNow || Date.now()))
            const locked = cooldownRemaining > 0
            return (
              <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                    React
                  </Text>
                  {locked && (
                    <Text className="text-[10px] text-amber-400" accessibilityLiveRegion="polite">
                      Slow down · {Math.ceil(cooldownRemaining / 1000)}s
                    </Text>
                  )}
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {activeLoadout.map((id) => {
                    const em = getEmoteById(id)
                    if (!em) return null
                    return (
                      <TouchableOpacity
                        key={id}
                        onPress={() => sendEmote(id)}
                        disabled={locked}
                        accessibilityRole="button"
                        accessibilityLabel={`Send ${em.emoji} emote`}
                        accessibilityState={{ disabled: locked }}
                        className={`w-11 h-11 rounded-xl bg-neutral-800/60 border items-center justify-center ${RARITY_BORDER[em.rarity]} ${locked ? 'opacity-40' : ''}`}
                        activeOpacity={0.7}
                      >
                        <Text className="text-2xl">{em.emoji}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )
          })()}

          {/* ─── Dead Chat (when eliminated) ───────────────────────────────── */}
          {isEliminated && (
            <View className="bg-neutral-900 border-2 border-red-900/50 rounded-2xl overflow-hidden">
              <View className="px-3 py-3 bg-red-950/30">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs font-semibold uppercase tracking-widest text-red-400">
                      Ghost Chat
                    </Text>
                    <Text className="text-xs text-neutral-400">Ghosts only</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleLeaveEliminated}
                  accessibilityRole="button"
                  accessibilityLabel="Leave game and return to lobby"
                  className="py-2 rounded-xl bg-red-900/60 border border-red-800/40 items-center min-h-[44px] justify-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-red-300 text-sm font-bold">← Leave Game</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                ref={deadChatScrollRef}
                className="max-h-40"
                contentContainerStyle={{ padding: 12, gap: 6 }}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => deadChatScrollRef.current?.scrollToEnd({ animated: true })}
              >
                {deadChatMessages.length === 0 ? (
                  <Text className="text-neutral-500 text-xs italic">
                    Chat with other eliminated players...
                  </Text>
                ) : (
                  deadChatMessages.map((msg) => (
                    <Text key={msg.id} className="text-sm">
                      <Text
                        className={[
                          'font-semibold',
                          msg.userId === user?.id ? 'text-red-400' : 'text-neutral-300',
                        ].join(' ')}
                      >
                        {msg.username}:{' '}
                      </Text>
                      <Text className="text-neutral-300">{msg.text}</Text>
                    </Text>
                  ))
                )}
              </ScrollView>
              <View className="flex-row gap-2 p-3 border-t border-red-900/30">
                <TextInput
                  className="flex-1 bg-neutral-900 border border-red-900/40 text-neutral-200 px-3 py-2.5 rounded-xl text-sm"
                  placeholder="Message ghosts..."
                  placeholderTextColor="#737373"
                  value={deadChatInput}
                  onChangeText={setDeadChatInput}
                  returnKeyType="send"
                  onSubmitEditing={sendDeadChat}
                  accessibilityLabel="Type a message to other eliminated players"
                />
                <TouchableOpacity
                  onPress={sendDeadChat}
                  disabled={!deadChatInput.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Send ghost chat message"
                  accessibilityState={{ disabled: !deadChatInput.trim() }}
                  className={[
                    'px-3 py-2.5 rounded-xl items-center justify-center min-w-[44px] min-h-[44px]',
                    deadChatInput.trim() ? 'bg-red-950/60' : 'bg-neutral-800 opacity-40',
                  ].join(' ')}
                >
                  <Text className="text-red-400 text-sm font-semibold">→</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ─── Chat toggle + panel (for alive players) ───────────────────── */}
          {!isEliminated && (
            <>
              <TouchableOpacity
                onPress={() => setShowChat((s) => !s)}
                accessibilityRole="button"
                accessibilityLabel={showChat ? 'Hide chat' : `Show chat${messages.length > 0 ? `, ${messages.length} messages` : ''}`}
                accessibilityState={{ expanded: showChat }}
                className="flex-row items-center justify-between px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700"
                activeOpacity={0.8}
              >
                <Text className="text-neutral-200 font-medium text-sm">
                  💬 Chat{messages.length > 0 ? ` (${messages.length})` : ''}
                </Text>
                <Text className="text-neutral-400 text-xs">{showChat ? '▴' : '▾'}</Text>
              </TouchableOpacity>

              {showChat && (
                <View className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                  <ScrollView
                    ref={chatScrollRef}
                    className="max-h-48"
                    contentContainerStyle={{ padding: 12, gap: 8 }}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
                  >
                    {messages.length === 0 ? (
                      <Text className="text-neutral-500 text-xs italic">No messages yet</Text>
                    ) : (
                      messages.map((msg) => (
                        <Text key={msg.id} className="text-sm">
                          <Text
                            className={[
                              'font-semibold',
                              msg.senderId === user?.id ? 'text-violet-400' : 'text-neutral-300',
                            ].join(' ')}
                          >
                            {msg.senderName}:{' '}
                          </Text>
                          <Text className="text-neutral-400">{msg.text}</Text>
                        </Text>
                      ))
                    )}
                  </ScrollView>
                  <View className="flex-row gap-2 p-3 border-t border-neutral-800">
                    <TextInput
                      className="flex-1 bg-neutral-800 text-white px-3 py-2.5 rounded-xl border border-neutral-700 text-sm"
                      placeholder="Message..."
                      placeholderTextColor="#737373"
                      value={chatInput}
                      onChangeText={setChatInput}
                      returnKeyType="send"
                      onSubmitEditing={sendChat}
                      accessibilityLabel="Type a chat message"
                    />
                    <TouchableOpacity
                      onPress={sendChat}
                      disabled={!chatInput.trim()}
                      accessibilityRole="button"
                      accessibilityLabel="Send chat message"
                      accessibilityState={{ disabled: !chatInput.trim() }}
                      className={[
                        'px-3 py-2.5 rounded-xl items-center justify-center min-w-[44px] min-h-[44px]',
                        chatInput.trim() ? 'bg-neutral-700' : 'bg-neutral-800 opacity-40',
                      ].join(' ')}
                    >
                      <Text className="text-white text-sm font-semibold">→</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
