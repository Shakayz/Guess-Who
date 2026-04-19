import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/game'
import { useAuthStore } from '../../store/auth'
import { getSocket } from '../../lib/socket'
import RoleRevealScreen from '../../components/RoleRevealScreen'
import EliminationOverlay from '../../components/EliminationOverlay'
import { Avatar } from '../../components/Avatar'
import type { Clue } from '@red-handed/shared'
import { useResponsive } from '../../lib/responsive'
import { createLogger } from '../../lib/logger'
import { HapticManager } from '../../lib/haptics'
import { SoundManager } from '../../lib/sounds'
import { UrgentPulse, Heartbeat } from '../../components/anim/AnimatedViews'
import { Wordmark } from '../../components/Wordmark'

const log = createLogger('game-screen')

type Phase = 'speaking' | 'voting' | 'reveal'

const EMOTES = ['👍', '😮', '🤔', '😂', '😱']

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
              <Text className="text-neutral-600 text-sm italic text-center py-6">
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
    detectiveRevealUsed,
    revealedPlayer,
    twinPartner,
    messages,
    addMessage,
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
    { id: string; emoji: string; username: string }[]
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
  const [allVotedMsg, setAllVotedMsg] = useState(false)
  const [isTie, setIsTie] = useState(false)
  const [wordReveal, setWordReveal] = useState<{
    villagerWord: string
    redHandedWord: string
  } | null>(null)
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false)
  const [clueFlagCounts, setClueFlagCounts] = useState<Record<number, number>>({})
  const [clueHistoryPlayer, setClueHistoryPlayer] = useState<{ userId: string; username: string; avatarUrl?: string | null } | null>(null)

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
  const players = room?.players ?? []
  const alivePlayers = players.filter((p) => p.status === 'alive')

  // ─── Timer tick sounds ─────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft <= 0) return
    if (timeLeft <= 3) {
      SoundManager.play('countdown_final')
    } else if (timeLeft <= 10) {
      SoundManager.play('timer_tick')
    }
  }, [timeLeft])

  // ─── Role reveal on mount ──────────────────────────────────────────────────

  useEffect(() => {
    if (myRole && myWord) {
      setShowRoleReveal(true)
    }
  }, []) // only on mount

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

    // game:started — reset all state for new game
    socket.on('game:started', ({ yourWord, yourRole, yourVillagerWord }: any) => {
      log.info('game started', { role: yourRole })
      SoundManager.play('game_start')
      setRoleAndWord(yourRole, yourWord, yourVillagerWord)
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
      setAllVotedMsg(false)
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

    // Chat + emotes
    socket.on('chat:message', addMessage)
    socket.on(
      'emote:receive' as any,
      ({ username, emoji }: { username: string; emoji: string }) => {
        const id = `${Date.now()}_${Math.random()}`
        setFloatingEmotes((prev) => (prev.length >= 10 ? prev : [...prev, { id, emoji, username }]))
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
      socket.off('chat:message')
      socket.off('deadchat:message' as any)
      socket.off('emote:receive' as any)
      socket.off('emote:cooldown' as any)
      socket.off('twin:partner' as any)
      socket.off('detective:result')
      socket.off('round:word-said' as any)
      socket.off('vote:update' as any)
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

  useEffect(() => {
    if (isEliminated) {
      setTimeout(() => deadChatScrollRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [deadChatMessages, isEliminated])

  // ─── Actions ────────────────────────────────────────────────────────────────

  const submitClue = () => {
    if (!clueText.trim() || hasSubmittedClue || phase !== 'speaking' || isEliminated) return
    log.info('clue submitted')
    getSocket().emit('clue:submit', clueText.trim())
    setClueText('')
    setHasSubmittedClue(true)
  }

  const vote = (playerId: string) => {
    if (votedFor || phase !== 'voting') return
    log.info('vote cast', { targetId: playerId })
    SoundManager.play('vote')
    setVotedFor(playerId)
    HapticManager.medium()
    getSocket().emit('vote:cast', playerId)
  }

  const sendChat = () => {
    if (!chatInput.trim()) return
    getSocket().emit('chat:send', chatInput.trim())
    setChatInput('')
  }

  const sendDeadChat = () => {
    if (!deadChatInput.trim()) return
    getSocket().emit('deadchat:send' as any, { text: deadChatInput.trim() })
    setDeadChatInput('')
  }

  const sendEmote = (emoji: string) => {
    const now = Date.now()
    if (now < emoteCooldownUntil) return
    if (now - lastEmoteTime.current < 1000) return
    lastEmoteTime.current = now
    getSocket().emit('emote:send' as any, { emoji })
  }

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
      {/* Role reveal overlay */}
      <RoleRevealScreen
        visible={showRoleReveal}
        role={myRole ?? 'villager'}
        word={myWord ?? '???'}
        villagerWord={myVillagerWord ?? undefined}
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

      {/* Floating emote reactions */}
      {floatingEmotes.length > 0 && (
        <View className="absolute top-20 left-0 right-0 z-50 items-center" pointerEvents="none">
          {floatingEmotes.map((e) => (
            <View key={e.id} className="items-center mb-2">
              <Text className="text-3xl">{e.emoji}</Text>
              <View className="bg-black/50 px-2 py-0.5 rounded-full mt-1">
                <Text className="text-[10px] text-white/70 font-semibold">{e.username}</Text>
              </View>
            </View>
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
              <Text className="text-xs text-neutral-500">
                {alivePlayers.length} alive · Round {currentRound?.roundNumber ?? 1}
              </Text>
              {/* Forfeit button */}
              <TouchableOpacity onPress={handleForfeit} activeOpacity={0.7}>
                <Text className="text-xs text-neutral-600 font-semibold">🏳 Forfeit</Text>
              </TouchableOpacity>
            </View>
            {timeLeft > 0 && (
              <CountdownBar seconds={timeLeft} total={totalTime} isVoting={phase === 'voting'} />
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
          ) : (
            <View
              className={[
                'rounded-2xl border-2 p-5 overflow-hidden',
                isRedHanded
                  ? 'border-red-700/60 bg-red-950/25'
                  : myRole === 'detective'
                  ? 'border-sky-700/60 bg-sky-950/25'
                  : 'border-violet-700/60 bg-violet-950/25',
              ].join(' ')}
            >
              {/* Top accent */}
              <View
                className={[
                  'absolute top-0 left-0 right-0 h-0.5',
                  isRedHanded ? 'bg-red-500' : myRole === 'detective' ? 'bg-sky-500' : 'bg-violet-500',
                ].join(' ')}
              />
              <View className="flex-row items-center gap-4">
                <View
                  className={[
                    'w-14 h-14 rounded-2xl items-center justify-center border',
                    isRedHanded
                      ? 'bg-red-900/50 border-red-700/40'
                      : myRole === 'detective'
                      ? 'bg-sky-900/50 border-sky-700/40'
                      : 'bg-violet-900/50 border-violet-700/40',
                  ].join(' ')}
                >
                  <Text style={{ fontSize: 28 }}>
                    {isRedHanded ? '🎭' : myRole === 'detective' ? '🔍' : '🏘️'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
                    {isRedHanded
                      ? 'You are the Imposter'
                      : myRole === 'detective'
                      ? 'You are the Detective'
                      : 'You are a Villager'}
                  </Text>
                  <Text
                    className={[
                      'font-extrabold tracking-tight',
                      isRedHanded ? 'text-red-300' : myRole === 'detective' ? 'text-sky-300' : 'text-violet-300',
                    ].join(' ')}
                    style={{ fontSize: 28 }}
                  >
                    {myWord ?? '???'}
                  </Text>
                  <Text className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    {isRedHanded
                      ? "Blend in — don't reveal you have a different word"
                      : myRole === 'detective'
                      ? 'Investigate players to find the imposter'
                      : 'Give a clue without saying the word directly'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ─── Detective Ability Panel ───────────────────────────────────── */}
          {myRole === 'detective' && (
            <View
              className={[
                'rounded-2xl border p-3',
                detectiveRevealUsed
                  ? 'border-neutral-800 bg-neutral-900/40'
                  : 'border-blue-800/40 bg-blue-950/40',
              ].join(' ')}
            >
              <View className="flex-row items-center gap-2 mb-2">
                <Text className="text-sm">🔍</Text>
                <Text
                  className={[
                    'text-xs font-semibold',
                    detectiveRevealUsed ? 'text-neutral-600' : 'text-blue-400',
                  ].join(' ')}
                >
                  {detectiveRevealUsed ? 'Reveal ability used' : 'Tap a player to reveal their role'}
                </Text>
              </View>
              {!detectiveRevealUsed && (
                <View className="flex-row flex-wrap gap-1.5">
                  {alivePlayers
                    .filter((p) => p.userId !== user?.id)
                    .map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() =>
                          getSocket().emit('detective:reveal', { targetUserId: p.userId })
                        }
                        className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-950/60 border border-blue-800/40"
                        activeOpacity={0.7}
                      >
                        <Text className="text-xs font-semibold text-blue-300">{p.username}</Text>
                        <Text className="text-[10px] text-blue-500">🔍</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              )}
            </View>
          )}

          {/* ─── Twin partner banner ──────────────────────────────────────── */}
          {(myRole === 'twin_villager' || myRole === 'twin_red_handed') && twinPartner && (
            <View className="rounded-xl border border-purple-700/40 bg-purple-900/30 px-4 py-2.5 flex-row items-center gap-2">
              <Text style={{ fontSize: 14 }}>👯</Text>
              <Text className="text-purple-300 font-semibold text-xs">
                {t('game.twinPartnerBanner', { name: twinPartner.twinUsername, defaultValue: 'Your twin: {{name}}' })}
              </Text>
            </View>
          )}

          {/* ─── Speaking phase: clue input (typing mode) ────────────────────── */}
          {phase === 'speaking' && !isEliminated && !vocalMode && (
            <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                Your Clue
              </Text>
              {hasSubmittedClue ? (
                <View className="flex-row items-center gap-2 py-2">
                  <Text className="text-emerald-400 text-sm">✓ Clue submitted — waiting for others...</Text>
                </View>
              ) : (
                <View className="flex-row gap-2">
                  <TextInput
                    className="flex-1 bg-neutral-800 text-white px-4 py-3 rounded-xl border border-neutral-700 text-sm"
                    placeholder="One sentence clue..."
                    placeholderTextColor="#525252"
                    value={clueText}
                    onChangeText={setClueText}
                    maxLength={200}
                    returnKeyType="send"
                    onSubmitEditing={submitClue}
                  />
                  <TouchableOpacity
                    onPress={submitClue}
                    disabled={!clueText.trim()}
                    className={[
                      'px-4 py-3 rounded-xl items-center justify-center',
                      clueText.trim() ? 'bg-violet-600' : 'bg-neutral-800 opacity-40',
                    ].join(' ')}
                  >
                    <Text className="text-white font-semibold text-sm">Send</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ─── Speaking phase: vocal mode (turn-based, no text) ──────────── */}
          {phase === 'speaking' && !isEliminated && vocalMode && (() => {
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
                  <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
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
          {phase === 'voting' && (
            <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
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

              {/* All votes in message */}
              {allVotedMsg && (
                <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800/40 mb-3">
                  <Text className="text-sm">✅</Text>
                  <Text className="text-sm font-semibold text-emerald-400">All votes in!</Text>
                </View>
              )}

              {/* Your vote summary */}
              {votedFor &&
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

              <View className="gap-2">
                {alivePlayers
                  .filter((p) => p.userId !== user?.id)
                  .map((p) => {
                    const isVotedTarget = votedFor === p.userId
                    const hasVoted = !!votedFor
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => vote(p.userId)}
                        disabled={hasVoted || isEliminated}
                        className={[
                          'flex-row items-center gap-3 px-3 py-3 rounded-xl border overflow-hidden',
                          isVotedTarget
                            ? 'border-amber-600/70 bg-amber-950/40'
                            : hasVoted
                            ? 'border-neutral-800 bg-neutral-900/30 opacity-40'
                            : 'border-neutral-700/60 bg-neutral-800/40',
                        ].join(' ')}
                        activeOpacity={0.7}
                      >
                        {isVotedTarget && (
                          <View className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />
                        )}
                        <Avatar
                          url={p.avatarUrl}
                          username={p.username}
                          size={36}
                          borderColor={isVotedTarget ? '#d97706' : undefined}
                        />
                        <Text className={['flex-1 font-semibold text-sm', isVotedTarget ? 'text-amber-200' : 'text-white'].join(' ')}>
                          {p.username}
                        </Text>
                        {isVotedTarget ? (
                          <View className="flex-row items-center gap-1 px-2 py-1 rounded-lg bg-amber-900/60 border border-amber-700/40">
                            <Text className="text-amber-300 text-[10px] font-bold">✓ Your Vote</Text>
                          </View>
                        ) : !hasVoted ? (
                          <View className="px-2.5 py-1 rounded-lg bg-neutral-700/50 border border-neutral-600/40">
                            <Text className="text-neutral-400 text-[10px] font-semibold">Vote</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    )
                  })}
              </View>
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
                <View className="flex-row gap-3 mt-4 w-full">
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
              )}
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600 mt-4">Next round starting soon...</Text>
              </View>
              <View className="bg-neutral-950 h-1" />
            </View>
          )}

          {/* ─── Clues log ─────────────────────────────────────────────────── */}
          {/* In vocal mode clues aren't typed, so the log is only relevant for
              post-round review — hide it during the speaking phase. */}
          {!(vocalMode && phase === 'speaking') && (
          <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
              Clues — Round {currentRound?.roundNumber ?? 1}
            </Text>
            {phase === 'speaking' && !hasSubmittedClue && !isEliminated && !vocalMode ? (
              <Text className="text-neutral-600 text-sm italic">
                Submit your clue to see what others wrote
              </Text>
            ) : clues.length === 0 ? (
              <Text className="text-neutral-600 text-sm italic">
                {vocalMode ? 'No typed clues — this round was spoken aloud' : 'No clues yet...'}
              </Text>
            ) : (
              <View className="gap-3">
                {clues.map((clue, i) => {
                  const player = players.find((p) => p.userId === clue.playerId)
                  const isMe = clue.playerId === user?.id
                  const flagCount = clueFlagCounts[i] ?? 0
                  return (
                    <View
                      key={i}
                      className={[
                        'flex-row items-start gap-2.5 px-3 py-2.5 rounded-xl border',
                        (clue as any).flaggedForWord
                          ? 'bg-amber-950/20 border-amber-700/40'
                          : isMe
                          ? 'bg-violet-950/30 border-violet-800/30'
                          : 'bg-neutral-800/30 border-neutral-800/50',
                      ].join(' ')}
                    >
                      <View className="mt-0.5">
                        <Avatar url={player?.avatarUrl} username={player?.username ?? '?'} size={24} />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1.5 flex-wrap">
                          <Text className="text-xs font-semibold text-neutral-400">
                            {player?.username ?? 'Unknown'}
                          </Text>
                          <Text className="text-neutral-700 text-[10px]">#{i + 1}</Text>
                          {isMe && (
                            <Text className="text-[10px] text-violet-400 font-bold">YOU</Text>
                          )}
                          {(clue as any).flaggedForWord && (
                            <Text className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                              ⚠ Said the word
                            </Text>
                          )}
                        </View>
                        <Text className="text-sm text-white leading-snug mt-0.5">{clue.text}</Text>
                      </View>
                      {/* Flag button */}
                      {!isMe && (
                        <TouchableOpacity
                          onPress={() => flagClue(i)}
                          className="px-2 py-1 rounded-lg bg-neutral-800/60"
                          activeOpacity={0.7}
                        >
                          <Text className="text-[10px] text-neutral-500">
                            🚩{flagCount > 0 ? ` ${flagCount}` : ''}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
          )}

          {/* ─── Players list ──────────────────────────────────────────────── */}
          <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
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
                const isMe = p.userId === user?.id
                const canViewHistory = !isMe && (hasSubmittedClue || phase !== 'speaking')
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => canViewHistory ? setClueHistoryPlayer({ userId: p.userId, username: p.username, avatarUrl: p.avatarUrl }) : undefined}
                    activeOpacity={canViewHistory ? 0.7 : 1}
                    className={[
                      'flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-xl border',
                      isAlive && isMe
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
                        isAlive ? (isMe ? 'bg-violet-400' : 'bg-emerald-400') : isForfeited ? 'bg-orange-600' : 'bg-neutral-700',
                      ].join(' ')}
                    />
                    <View style={{ opacity: isAlive ? 1 : 0.4 }}>
                      <Avatar url={p.avatarUrl} username={p.username} size={18} />
                    </View>
                    <Text
                      className={[
                        'text-xs font-semibold',
                        isAlive ? (isMe ? 'text-violet-200' : 'text-white') : 'text-neutral-600',
                      ].join(' ')}
                    >
                      {p.username}
                    </Text>
                    {!isAlive && !isForfeited && (
                      <Text className="text-[9px] text-neutral-700">☠</Text>
                    )}
                    {canViewHistory && isAlive && (
                      <Text className="text-[9px] text-neutral-600">📜</Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text className="text-[10px] text-neutral-700 mt-2">Tap a player to see their clue history</Text>
          </View>

          {/* ─── Emote Reactions Bar ───────────────────────────────────────── */}
          {!isEliminated && (() => {
            const cooldownRemaining = Math.max(0, emoteCooldownUntil - (emoteNow || Date.now()))
            const locked = cooldownRemaining > 0
            return (
              <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-600">
                    React
                  </Text>
                  {locked && (
                    <Text className="text-[10px] text-amber-500">
                      Slow down · {Math.ceil(cooldownRemaining / 1000)}s
                    </Text>
                  )}
                </View>
                <View className="flex-row gap-2">
                  {EMOTES.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => sendEmote(emoji)}
                      disabled={locked}
                      className={`w-11 h-11 rounded-xl bg-neutral-800/60 border border-neutral-700/50 items-center justify-center ${locked ? 'opacity-40' : ''}`}
                      activeOpacity={0.7}
                    >
                      <Text className="text-2xl">{emoji}</Text>
                    </TouchableOpacity>
                  ))}
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
                    <Text className="text-xs font-semibold uppercase tracking-widest text-red-500">
                      Ghost Chat
                    </Text>
                    <Text className="text-xs text-neutral-600">Ghosts only</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleLeaveEliminated}
                  className="py-2 rounded-xl bg-red-900/60 border border-red-800/40 items-center"
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
              >
                {deadChatMessages.length === 0 ? (
                  <Text className="text-neutral-700 text-xs italic">
                    Chat with other eliminated players...
                  </Text>
                ) : (
                  deadChatMessages.map((msg) => (
                    <Text key={msg.id} className="text-sm">
                      <Text
                        className={[
                          'font-semibold',
                          msg.userId === user?.id ? 'text-red-400' : 'text-neutral-400',
                        ].join(' ')}
                      >
                        {msg.username}:{' '}
                      </Text>
                      <Text className="text-neutral-500">{msg.text}</Text>
                    </Text>
                  ))
                )}
              </ScrollView>
              <View className="flex-row gap-2 p-3 border-t border-red-900/30">
                <TextInput
                  className="flex-1 bg-neutral-900 border border-red-900/40 text-neutral-300 px-3 py-2.5 rounded-xl text-sm"
                  placeholder="Message ghosts..."
                  placeholderTextColor="#525252"
                  value={deadChatInput}
                  onChangeText={setDeadChatInput}
                  returnKeyType="send"
                  onSubmitEditing={sendDeadChat}
                />
                <TouchableOpacity
                  onPress={sendDeadChat}
                  disabled={!deadChatInput.trim()}
                  className={[
                    'px-3 py-2.5 rounded-xl items-center justify-center',
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
                className="flex-row items-center justify-between px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700"
                activeOpacity={0.8}
              >
                <Text className="text-neutral-300 font-medium text-sm">
                  💬 Chat{messages.length > 0 ? ` (${messages.length})` : ''}
                </Text>
                <Text className="text-neutral-500 text-xs">{showChat ? '▴' : '▾'}</Text>
              </TouchableOpacity>

              {showChat && (
                <View className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                  <ScrollView
                    ref={chatScrollRef}
                    className="max-h-48"
                    contentContainerStyle={{ padding: 12, gap: 8 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {messages.length === 0 ? (
                      <Text className="text-neutral-700 text-xs italic">No messages yet</Text>
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
                      placeholderTextColor="#525252"
                      value={chatInput}
                      onChangeText={setChatInput}
                      returnKeyType="send"
                      onSubmitEditing={sendChat}
                    />
                    <TouchableOpacity
                      onPress={sendChat}
                      disabled={!chatInput.trim()}
                      className={[
                        'px-3 py-2.5 rounded-xl items-center justify-center',
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
