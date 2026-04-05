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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/game'
import { useAuthStore } from '../../store/auth'
import { getSocket } from '../../lib/socket'
import RoleRevealScreen from '../../components/RoleRevealScreen'
import EliminationOverlay from '../../components/EliminationOverlay'
import type { Clue } from '@imposter/shared'
import { useResponsive } from '../../lib/responsive'

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
      <Text
        className={[
          'text-xs font-mono font-semibold w-8 text-right',
          urgent ? 'text-red-400' : 'text-neutral-400',
        ].join(' ')}
      >
        {seconds}s
      </Text>
    </View>
  )
}

// ─── PhaseIndicator ──────────────────────────────────────────────────────────

function PhaseIndicator({ currentPhase }: { currentPhase: Phase }) {
  const phases: { id: Phase; icon: string; label: string }[] = [
    { id: 'speaking', icon: '✏️', label: 'Clues' },
    { id: 'voting', icon: '🗳', label: 'Vote' },
    { id: 'reveal', icon: '📋', label: 'Reveal' },
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
                  'h-0.5 w-3 rounded-full',
                  isDone ? 'bg-violet-500' : 'bg-neutral-800',
                ].join(' ')}
              />
            )}
            <View
              className={[
                'flex-row items-center gap-1 px-2 py-1 rounded-full',
                isActive
                  ? 'bg-violet-950/60 border border-violet-700/40'
                  : '',
              ].join(' ')}
            >
              <Text className="text-xs">{p.icon}</Text>
              <Text
                className={[
                  'text-[10px] font-semibold',
                  isActive ? 'text-violet-400' : isDone ? 'text-violet-600' : 'text-neutral-600',
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
    imposterWord: string
  } | null>(null)
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false)
  const [clueFlagCounts, setClueFlagCounts] = useState<Record<number, number>>({})

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatScrollRef = useRef<ScrollView>(null)
  const deadChatScrollRef = useRef<ScrollView>(null)
  const phaseRef = useRef<Phase>('speaking')
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([])
  const lastEmoteTime = useRef(0)

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

  const isImposter = myRole === 'imposter' || myRole === 'double_agent'
  const players = room?.players ?? []
  const alivePlayers = players.filter((p) => p.status === 'alive')

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

    // Speaking turn — also used as new-round signal
    socket.on('round:speaking-turn', ({ timeSeconds, speakingOrder: _order }: any) => {
      if (phaseRef.current !== 'speaking') {
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
      phaseRef.current = 'voting'
      setPhase('voting')
      setVoteCount(0)
      setTotalVoters(vPlayers?.length ?? 0)
      setAllVotedMsg(false)
      startTimerRef.current(timeSeconds ?? 30)
    })

    // Round ended
    socket.on('round:ended', ({ round, nextRound }: any) => {
      phaseRef.current = 'reveal'
      setPhase('reveal')
      setAllVotedMsg(false)
      if (round) addCompletedRound(round)
      if (nextRound) setRound(nextRound)
      if (round?.wordReveal) setWordReveal(round.wordReveal)
      if (round?.eliminatedPlayerId) {
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
      showElimination(username, role, 'said_word')
    })

    // Game finished
    socket.on('game:finished', (data) => {
      setResult(data)
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

    // Clue flag response
    socket.on('clue:flagged' as any, ({ clueIndex, flagCount }: any) => {
      setClueFlagCounts((prev) => ({ ...prev, [clueIndex]: flagCount }))
    })

    // Error
    socket.on('error', (err: any) => {
      console.error('[game] socket error:', err?.code, err?.message)
    })

    return () => {
      socket.off('game:started')
      socket.off('game:sync')
      socket.off('game:player-forfeited')
      socket.off('round:clue-submitted')
      socket.off('round:speaking-turn')
      socket.off('round:voting-started')
      socket.off('round:ended')
      socket.off('game:finished')
      socket.off('room:updated')
      socket.off('chat:message')
      socket.off('deadchat:message' as any)
      socket.off('emote:receive' as any)
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
    getSocket().emit('clue:submit', clueText.trim())
    setClueText('')
    setHasSubmittedClue(true)
  }

  const vote = (playerId: string) => {
    if (votedFor || phase !== 'voting') return
    setVotedFor(playerId)
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
    if (now - lastEmoteTime.current < 2000) return
    lastEmoteTime.current = now
    getSocket().emit('emote:send' as any, { emoji })
  }

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
                  revealedPlayer.role === 'imposter' || revealedPlayer.role === 'double_agent'
                    ? 'text-red-400'
                    : 'text-emerald-400',
                ].join(' ')}
              >
                {revealedPlayer.role === 'imposter'
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
                <Text className="text-lg font-extrabold text-white tracking-tight">Imposter</Text>
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
            <View className="rounded-2xl border border-red-800 bg-red-950/20 p-4 overflow-hidden">
              <View className="absolute top-0 left-0 right-0 h-0.5 bg-red-500" style={{ opacity: 0.6 }} />
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-lg">🎭</Text>
                <Text className="text-xs font-semibold uppercase tracking-widest text-orange-500">
                  Double Agent
                </Text>
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1 rounded-xl bg-emerald-950/40 border border-emerald-800/40 p-3">
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">
                    Villager Word
                  </Text>
                  <Text className="text-lg font-extrabold text-emerald-200">{myVillagerWord}</Text>
                </View>
                <View className="flex-1 rounded-xl bg-orange-950/40 border border-orange-800/40 p-3">
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-1">
                    Imposter Word
                  </Text>
                  <Text className="text-lg font-extrabold text-orange-200">{myWord}</Text>
                </View>
              </View>
              <Text className="text-xs text-neutral-600 mt-2">
                You know both words -- use this to your advantage
              </Text>
            </View>
          ) : (
            <View
              className={[
                'rounded-2xl border p-4 overflow-hidden',
                isImposter ? 'border-red-800 bg-red-950/20' : 'border-violet-800 bg-violet-950/20',
              ].join(' ')}
            >
              <View
                className={[
                  'absolute top-0 left-0 right-0 h-0.5',
                  isImposter ? 'bg-red-500' : 'bg-violet-500',
                ].join(' ')}
                style={{ opacity: 0.6 }}
              />
              <View className="flex-row items-center gap-4">
                <View
                  className={[
                    'w-12 h-12 rounded-xl items-center justify-center',
                    isImposter ? 'bg-red-950' : myRole === 'detective' ? 'bg-sky-950' : 'bg-violet-950',
                  ].join(' ')}
                >
                  <Text className="text-2xl">
                    {isImposter ? '🎭' : myRole === 'detective' ? '🔍' : '🏘️'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-0.5">
                    {isImposter
                      ? 'You are the Imposter'
                      : myRole === 'detective'
                      ? 'You are the Detective'
                      : 'You are a Villager'}
                  </Text>
                  <Text
                    className={[
                      'text-2xl font-extrabold tracking-tight',
                      isImposter ? 'text-red-400' : myRole === 'detective' ? 'text-sky-400' : 'text-violet-400',
                    ].join(' ')}
                  >
                    {myWord ?? '???'}
                  </Text>
                  <Text className="text-xs text-neutral-600 mt-0.5">
                    {isImposter
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

          {/* ─── Speaking phase: clue input ─────────────────────────────────── */}
          {phase === 'speaking' && !isEliminated && (
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

          {/* ─── Voting phase ──────────────────────────────────────────────── */}
          {phase === 'voting' && (
            <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  Vote out the Imposter
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
                  .map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => vote(p.userId)}
                      disabled={!!votedFor || isEliminated}
                      className={[
                        'flex-row items-center gap-3 px-3 py-3 rounded-xl border',
                        votedFor === p.userId
                          ? 'border-amber-600 bg-amber-950/30'
                          : votedFor
                          ? 'border-neutral-800 bg-neutral-900/40 opacity-50'
                          : 'border-neutral-800 bg-neutral-900/40',
                      ].join(' ')}
                      activeOpacity={0.7}
                    >
                      <View className="w-8 h-8 rounded-full bg-violet-700 items-center justify-center">
                        <Text className="text-white text-sm font-bold">
                          {p.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text className="flex-1 font-semibold text-white text-sm">{p.username}</Text>
                      {votedFor === p.userId ? (
                        <Text className="text-amber-400 text-xs font-bold">Your Vote</Text>
                      ) : !votedFor ? (
                        <Text className="text-neutral-600 text-xs">Tap to vote</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          )}

          {/* ─── Reveal phase ──────────────────────────────────────────────── */}
          {phase === 'reveal' && (
            <View className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 items-center">
              <Text className="text-5xl mb-3">
                {eliminated?.role === 'imposter' || eliminated?.role === 'double_agent'
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
                      eliminated.role === 'imposter' || eliminated.role === 'double_agent'
                        ? 'text-red-400'
                        : 'text-violet-400',
                    ].join(' ')}
                  >
                    They were a{' '}
                    {eliminated.role === 'imposter'
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
                  <View className="flex-1 rounded-xl bg-violet-950/40 border border-violet-800/40 p-3 items-center">
                    <Text className="text-xs text-neutral-500 mb-1">Villager Word</Text>
                    <Text className="text-white font-extrabold text-lg">{wordReveal.villagerWord}</Text>
                  </View>
                  <View className="flex-1 rounded-xl bg-amber-950/40 border border-amber-800/40 p-3 items-center">
                    <Text className="text-xs text-neutral-500 mb-1">Imposter Word</Text>
                    <Text className="text-amber-300 font-extrabold text-lg">
                      {wordReveal.imposterWord}
                    </Text>
                  </View>
                </View>
              )}
              <Text className="text-xs text-neutral-600 mt-4">Next round starting soon...</Text>
            </View>
          )}

          {/* ─── Clues log ─────────────────────────────────────────────────── */}
          <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
              Clues — Round {currentRound?.roundNumber ?? 1}
            </Text>
            {phase === 'speaking' && !hasSubmittedClue && !isEliminated ? (
              <Text className="text-neutral-600 text-sm italic">
                Submit your clue to see what others wrote
              </Text>
            ) : clues.length === 0 ? (
              <Text className="text-neutral-600 text-sm italic">No clues yet...</Text>
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
                      <View className="w-6 h-6 rounded-full bg-neutral-700 items-center justify-center mt-0.5">
                        <Text className="text-white text-xs font-bold">
                          {(player?.username ?? '?').charAt(0).toUpperCase()}
                        </Text>
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

          {/* ─── Players list ──────────────────────────────────────────────── */}
          <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">
              Players ({alivePlayers.length})
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {players.map((p) => (
                <View
                  key={p.id}
                  className={[
                    'flex-row items-center gap-1.5 px-2 py-1 rounded-lg',
                    p.status === 'alive'
                      ? 'bg-neutral-800'
                      : p.status === ('forfeited' as any)
                      ? 'bg-orange-950/30 border border-orange-900/20'
                      : 'bg-neutral-900 opacity-40',
                  ].join(' ')}
                >
                  <View
                    className={[
                      'w-1.5 h-1.5 rounded-full',
                      p.status === 'alive'
                        ? 'bg-emerald-400'
                        : p.status === ('forfeited' as any)
                        ? 'bg-orange-700'
                        : 'bg-neutral-700',
                    ].join(' ')}
                  />
                  <Text
                    className={[
                      'text-xs font-semibold',
                      p.status === 'alive' ? 'text-white' : 'text-neutral-600',
                    ].join(' ')}
                  >
                    {p.username}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ─── Emote Reactions Bar ───────────────────────────────────────── */}
          {!isEliminated && (
            <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3">
              <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-2">
                React
              </Text>
              <View className="flex-row gap-2">
                {EMOTES.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => sendEmote(emoji)}
                    className="w-11 h-11 rounded-xl bg-neutral-800/60 border border-neutral-700/50 items-center justify-center"
                    activeOpacity={0.7}
                  >
                    <Text className="text-2xl">{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

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
