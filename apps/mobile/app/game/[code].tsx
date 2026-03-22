import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/game'
import { useAuthStore } from '../../store/auth'
import { getSocket } from '../../lib/socket'
import type { Clue } from '@imposter/shared'

type Phase = 'speaking' | 'voting' | 'reveal'

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

// ─── GameScreen ───────────────────────────────────────────────────────────────

export default function GameScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const { t } = useTranslation()
  const router = useRouter()
  const { room, currentRound, myRole, myWord, messages, addMessage, setResult } = useGameStore()
  const user = useAuthStore((s) => s.user)

  const [clueText, setClueText] = useState('')
  const [clues, setClues] = useState<Clue[]>([])
  const [chatInput, setChatInput] = useState('')
  const [phase, setPhase] = useState<Phase>('speaking')
  const [votedFor, setVotedFor] = useState<string | null>(null)
  const [eliminated, setEliminated] = useState<{ username: string; role: string } | null>(null)
  const [hasSubmittedClue, setHasSubmittedClue] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalTime, setTotalTime] = useState(30)
  const [showChat, setShowChat] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatScrollRef = useRef<ScrollView>(null)

  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTotalTime(seconds)
    setTimeLeft(seconds)
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return t - 1
      })
    }, 1000)
  }, [])

  const isImposter = myRole === 'imposter' || myRole === 'double_agent'
  const players = room?.players ?? []
  const alivePlayers = players.filter((p) => p.status === 'alive')

  useEffect(() => {
    const socket = getSocket()

    socket.on('round:clue-submitted', (clue) => setClues((c) => [...c, clue as Clue]))
    socket.on('round:speaking-turn', ({ timeSeconds }) => startTimer(timeSeconds))
    socket.on('round:voting-started', ({ timeSeconds }) => {
      setPhase('voting')
      startTimer(timeSeconds ?? 30)
    })
    socket.on('round:ended', ({ round }) => {
      setPhase('reveal')
      if ((round as any)?.eliminatedPlayer) {
        setEliminated({
          username: (round as any).eliminatedPlayer.username,
          role: (round as any).eliminatedPlayer.role,
        })
      }
    })
    socket.on('game:finished', (data) => {
      setResult(data)
      router.replace(`/results/${code}`)
    })
    socket.on('chat:message', addMessage)

    return () => {
      socket.off('round:clue-submitted')
      socket.off('round:speaking-turn')
      socket.off('round:voting-started')
      socket.off('round:ended')
      socket.off('game:finished')
      socket.off('chat:message')
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startTimer])

  useEffect(() => {
    if (showChat) {
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages, showChat])

  const submitClue = () => {
    if (!clueText.trim() || hasSubmittedClue) return
    getSocket().emit('clue:submit', clueText.trim())
    setClueText('')
    setHasSubmittedClue(true)
  }

  const vote = (playerId: string) => {
    if (votedFor) return
    setVotedFor(playerId)
    getSocket().emit('vote:cast', playerId)
  }

  const sendChat = () => {
    if (!chatInput.trim()) return
    getSocket().emit('chat:send', chatInput.trim())
    setChatInput('')
  }

  const phaseLabel =
    phase === 'speaking' ? '💬 Speaking' : phase === 'voting' ? '🗳 Voting' : '📋 Reveal'
  const phaseBg =
    phase === 'speaking'
      ? 'bg-violet-950 border-violet-800'
      : phase === 'voting'
      ? 'bg-amber-950 border-amber-800'
      : 'bg-neutral-800 border-neutral-700'
  const phaseText =
    phase === 'speaking' ? 'text-violet-400' : phase === 'voting' ? 'text-amber-400' : 'text-neutral-400'

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['top', 'bottom']}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Top bar */}
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
                <View className={['px-2.5 py-1 rounded-full border', phaseBg].join(' ')}>
                  <Text className={['text-xs font-semibold', phaseText].join(' ')}>{phaseLabel}</Text>
                </View>
                <Text className="text-xs text-neutral-500">{alivePlayers.length} alive</Text>
              </View>
            </View>
            {timeLeft > 0 && (
              <CountdownBar seconds={timeLeft} total={totalTime} isVoting={phase === 'voting'} />
            )}
          </View>

          {/* Role + Word card */}
          <View
            className={[
              'rounded-2xl border p-4 overflow-hidden',
              isImposter ? 'border-red-800 bg-red-950/20' : 'border-violet-800 bg-violet-950/20',
            ].join(' ')}
          >
            {/* Top accent line */}
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
                  isImposter ? 'bg-red-950' : 'bg-violet-950',
                ].join(' ')}
              >
                <Text className="text-2xl">{isImposter ? '🎭' : '🏘️'}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-0.5">
                  {isImposter ? 'You are the Imposter' : 'You are a Villager'}
                </Text>
                <Text
                  className={[
                    'text-2xl font-extrabold tracking-tight',
                    isImposter ? 'text-red-400' : 'text-violet-400',
                  ].join(' ')}
                >
                  {myWord ?? '???'}
                </Text>
                <Text className="text-xs text-neutral-600 mt-0.5">
                  {isImposter
                    ? "Blend in — don't reveal you have a different word"
                    : 'Give a clue without saying the word directly'}
                </Text>
              </View>
            </View>
          </View>

          {/* Speaking phase: clue input */}
          {phase === 'speaking' && (
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

          {/* Voting phase */}
          {phase === 'voting' && (
            <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  Vote out the Imposter
                </Text>
                {votedFor && (
                  <Text className="text-xs text-emerald-400 font-semibold">✓ Vote cast</Text>
                )}
              </View>
              <View className="gap-2">
                {alivePlayers
                  .filter((p) => p.userId !== user?.id)
                  .map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => vote(p.userId)}
                      disabled={!!votedFor}
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
                        <Text className="text-amber-400 text-xs font-bold">Voted</Text>
                      ) : !votedFor ? (
                        <Text className="text-neutral-600 text-xs">Tap to vote</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          )}

          {/* Reveal phase */}
          {phase === 'reveal' && (
            <View className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 items-center">
              <Text className="text-5xl mb-3">
                {eliminated?.role === 'imposter' || eliminated?.role === 'double_agent'
                  ? '🎉'
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
                      : 'Villager'}
                  </Text>
                </>
              ) : (
                <Text className="text-neutral-400 text-sm">No one was eliminated this round</Text>
              )}
              <Text className="text-xs text-neutral-600 mt-4">Next round starting soon...</Text>
            </View>
          )}

          {/* Clues log */}
          <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
              Clues — Round {currentRound?.roundNumber ?? 1}
            </Text>
            {clues.length === 0 ? (
              <Text className="text-neutral-600 text-sm italic">No clues yet...</Text>
            ) : (
              <View className="gap-3">
                {clues.map((clue, i) => {
                  const player = players.find((p) => p.id === clue.playerId)
                  return (
                    <View key={i} className="flex-row items-start gap-2.5">
                      <View className="w-6 h-6 rounded-full bg-neutral-700 items-center justify-center mt-0.5">
                        <Text className="text-white text-xs font-bold">
                          {(player?.username ?? '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-neutral-400">
                          {player?.username ?? 'Unknown'}
                        </Text>
                        <Text className="text-sm text-white leading-snug">{clue.text}</Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </View>

          {/* Players list */}
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
                    p.status === 'alive' ? 'bg-neutral-800' : 'bg-neutral-900 opacity-40',
                  ].join(' ')}
                >
                  <View
                    className={[
                      'w-1.5 h-1.5 rounded-full',
                      p.status === 'alive' ? 'bg-emerald-400' : 'bg-neutral-700',
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

          {/* Chat toggle + panel */}
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

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
