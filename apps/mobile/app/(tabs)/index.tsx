import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/auth'
import { api } from '../../lib/api'
import { connectSocket, getSocket } from '../../lib/socket'
import { WORD_CATEGORIES, MATCHMAKING_CONFIG } from '@imposter/shared'
import type { WordCategory, MatchmakingStatus } from '@imposter/shared'
import { useResponsive, responsiveContentStyle } from '../../lib/responsive'
import { OnboardingTutorial, hasTutorialCompleted } from '../../components/OnboardingTutorial'
import InsufficientCoinsModal from '../../components/InsufficientCoinsModal'

type GameMode = 'normal' | 'ranked' | 'lobby'

const HOW_TO_PLAY = [
  { icon: '🎭', title: 'Get your role', desc: 'Villager or Imposter — each gets a different word.' },
  { icon: '💬', title: 'Give clues', desc: "One sentence per round. Don't say the word!" },
  { icon: '🗳️', title: 'Vote', desc: 'Discuss and vote out who you think is the imposter.' },
  { icon: '🏆', title: 'Win', desc: 'Villagers win if all imposters are eliminated.' },
]

const MODES: { id: GameMode; icon: string; label: string; desc: string }[] = [
  { id: 'normal', icon: '🎮', label: 'Normal', desc: 'Play for fun — no LP at stake' },
  { id: 'ranked', icon: '🏆', label: 'Ranked', desc: 'All categories · affects LP' },
  { id: 'lobby',  icon: '🚪', label: 'Create Lobby', desc: 'Invite friends with a code' },
]

export default function HomeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { isTablet, px, gridItemWidth, fontScale } = useResponsive()

  // ── Staggered entrance for mode cards ───────────────────────────
  const modeAnims = useMemo(() => MODES.map(() => new Animated.Value(0)), [])
  useEffect(() => {
    Animated.stagger(
      90,
      modeAnims.map(a =>
        Animated.spring(a, {
          toValue: 1,
          friction: 6,
          tension: 110,
          useNativeDriver: true,
        }),
      ),
    ).start()
  }, [])

  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null)
  const [categories, setCategories] = useState<WordCategory[]>([])
  const [roomCode, setRoomCode] = useState('')
  const [showTutorial, setShowTutorial] = useState(false)

  // Show onboarding tutorial on first launch
  useEffect(() => {
    hasTutorialCompleted().then((done) => {
      if (!done) setShowTutorial(true)
    })
  }, [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Dedicated state for the "not enough coins" modal — null = hidden.
  // We show the modal (with a "Get coins" CTA to /shop) instead of the
  // small inline red alert whenever the server signals INSUFFICIENT_STARS.
  const [insufficientCoinsRequired, setInsufficientCoinsRequired] = useState<number | null>(null)
  // Star-coin balance shown in the header chip. Refreshed on focus. If the
  // fetch fails we just show 0 — not critical enough to retry or surface.
  const [starCoins, setStarCoins] = useState<number | null>(null)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    api
      .get<{ starCoins?: number }>('/auth/me')
      .then((me) => {
        if (!cancelled) setStarCoins(me.starCoins ?? 0)
      })
      .catch(() => {
        if (!cancelled) setStarCoins(0)
      })
    return () => { cancelled = true }
  }, [user])
  const [inQueue, setInQueue] = useState(false)
  const [matchStatus, setMatchStatus] = useState<MatchmakingStatus>({
    queueSize: 1, needed: MATCHMAKING_CONFIG.IDEAL_PLAYERS, elapsed: 0,
    maxWait: MATCHMAKING_CONFIG.MAX_WAIT_SECONDS, idealPlayers: MATCHMAKING_CONFIG.IDEAL_PLAYERS,
  })

  const hasCategories = selectedMode === 'normal' || selectedMode === 'lobby'

  // Matchmaking listeners
  useEffect(() => {
    if (!inQueue) return
    connectSocket()
    const socket = getSocket()

    const onStatus = (data: MatchmakingStatus) => setMatchStatus(data)
    const onFound = (data: any) => {
      setInQueue(false)
      setLoading(false)
      router.push(`/lobby/${data.roomCode}`)
    }
    const onError = (data: any) => {
      setInQueue(false)
      setLoading(false)
      if (data?.reason === 'INSUFFICIENT_STARS') {
        setInsufficientCoinsRequired(data.required ?? 10)
      } else {
        setError(data?.message ?? 'Matchmaking error')
      }
    }

    socket.on('matchmaking:status' as any, onStatus)
    socket.on('matchmaking:found' as any, onFound)
    socket.on('matchmaking:error' as any, onError)

    return () => {
      socket.off('matchmaking:status' as any, onStatus)
      socket.off('matchmaking:found' as any, onFound)
      socket.off('matchmaking:error' as any, onError)
    }
  }, [inQueue])

  const handleMatchmaking = useCallback(() => {
    if (!selectedMode || selectedMode === 'lobby') return
    connectSocket()
    const socket = getSocket()
    setInQueue(true)
    setLoading(true)
    setError(null)
    socket.emit('matchmaking:join' as any, {
      gameMode: selectedMode === 'ranked' ? 'ranked' : 'normal',
      categories: selectedMode === 'ranked' ? [] : categories,
    })
  }, [selectedMode, categories])

  const cancelMatchmaking = useCallback(() => {
    const socket = getSocket()
    socket.emit('matchmaking:leave' as any, {})
    setInQueue(false)
    setLoading(false)
  }, [])

  const toggleCategory = (key: WordCategory) => {
    setCategories((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    )
  }

  const handleCreate = async () => {
    if (!selectedMode) return
    setLoading(true)
    setError(null)
    try {
      const room = await api.post<{ code: string }>('/rooms', {
        settings: {
          gameMode: selectedMode === 'ranked' ? 'ranked' : 'normal',
          categories: selectedMode === 'ranked' ? [] : categories,
          isPrivate: selectedMode === 'lobby',
        },
      })
      router.push(`/lobby/${room.code}`)
    } catch (err: any) {
      const code = err?.data?.error ?? err?.error
      const required = err?.data?.required ?? 10
      if (code === 'INSUFFICIENT_STARS') {
        setInsufficientCoinsRequired(required)
      } else {
        setError(err.message ?? 'Failed to create room')
      }
    } finally {
      setLoading(false)
    }
  }

  const showCostHint = selectedMode === 'ranked' || selectedMode === 'lobby'

  const handleJoin = () => {
    const code = roomCode.trim().toUpperCase()
    if (!code || code.length < 4) return
    router.push(`/lobby/${code}`)
  }

  const contentStyle = isTablet ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const } : {}

  return (
    <SafeAreaView className="flex-1 bg-neutral-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={contentStyle}>
          {/* Header */}
          <View className="flex-row items-center justify-between pt-4 pb-2" style={{ paddingHorizontal: px + 8 }}>
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-xl bg-violet-700/80 items-center justify-center">
                <Text style={{ fontSize: 16 * fontScale }}>🎭</Text>
              </View>
              <Text className="text-white font-extrabold tracking-tight" style={{ fontSize: 18 * fontScale }}>Imposter</Text>
            </View>
            {user && (
              <View className="flex-row items-center gap-2">
                {/* Coin-balance chip → opens /shop. Tappable so players can
                    top up at any time, not just when game-start rejects them. */}
                <TouchableOpacity
                  onPress={() => router.push('/shop?tab=coins')}
                  className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30"
                  activeOpacity={0.8}
                  accessibilityLabel="Shop"
                >
                  <Text style={{ fontSize: 12 }}>⭐</Text>
                  <Text className="text-amber-400 font-semibold" style={{ fontSize: 13 * fontScale }}>
                    {(starCoins ?? 0).toLocaleString()}
                  </Text>
                </TouchableOpacity>
                <View className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800">
                  <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <Text className="text-neutral-400" style={{ fontSize: 13 * fontScale }}>@{user.username}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Hero */}
          <View className="items-center pt-10 pb-6" style={{ paddingHorizontal: px + 8 }}>
            <View className="flex-row items-center gap-2 px-3 py-1.5 rounded-full border border-violet-700/40 bg-violet-900/20 mb-5">
              <View className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <Text className="text-violet-400 font-semibold" style={{ fontSize: 12 * fontScale }}>Social Deduction · Real-time · Multiplayer</Text>
            </View>
            <Text className="font-extrabold text-white text-center leading-tight tracking-tight mb-2" style={{ fontSize: (isTablet ? 44 : 36) }}>
              Play the{'\n'}
              <Text className="text-violet-500">Imposter</Text> Game
            </Text>
            <Text className="text-neutral-400 mt-2 text-center" style={{ fontSize: 16 * fontScale }}>Deceive. Detect. Dominate.</Text>
          </View>

          <View style={{ paddingHorizontal: px, gap: 16 }}>

            {/* Mode selector */}
            <View>
              <Text className="font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1" style={{ fontSize: 12 * fontScale }}>
                Choose a mode
              </Text>
              <View className="flex-row gap-2">
                {MODES.map((mode, modeIdx) => {
                  const active = selectedMode === mode.id
                  const activeStyle =
                    mode.id === 'normal'
                      ? 'border-violet-700/50 bg-violet-950/50'
                      : mode.id === 'ranked'
                        ? 'border-amber-700/50 bg-amber-950/50'
                        : 'border-violet-700/50 bg-violet-950/50'
                  const activeText =
                    mode.id === 'normal'
                      ? 'text-violet-400'
                      : mode.id === 'ranked'
                        ? 'text-amber-400'
                        : 'text-violet-400'
                  const entrance = modeAnims[modeIdx] ?? new Animated.Value(1)
                  return (
                    <Animated.View
                      key={mode.id}
                      style={{
                        flex: 1,
                        opacity: entrance,
                        transform: [
                          { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                          { scale:      entrance.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                        ],
                      }}
                    >
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedMode(active ? null : mode.id)
                        setCategories([])
                        setError(null)
                      }}
                      className={[
                        'items-center gap-1.5 rounded-2xl border overflow-hidden',
                        active
                          ? activeStyle
                          : 'border-neutral-800 bg-neutral-900',
                      ].join(' ')}
                      style={{ padding: isTablet ? 16 : 12 }}
                      activeOpacity={0.8}
                    >
                      {/* Active top accent bar */}
                      <View
                        className={[
                          'absolute top-0 left-0 right-0',
                          active ? 'h-0.5' : 'h-0',
                          mode.id === 'ranked' ? 'bg-amber-500' : 'bg-violet-500',
                        ].join(' ')}
                      />
                      {/* Active bottom fade */}
                      {active && (
                        <View
                          className="absolute bottom-0 left-0 right-0 h-8"
                          style={{
                            backgroundColor: mode.id === 'ranked' ? 'rgba(120,50,0,0.12)' : 'rgba(88,28,235,0.08)',
                          }}
                        />
                      )}
                      <View
                        className={[
                          'rounded-xl items-center justify-center mb-0.5',
                          active
                            ? mode.id === 'ranked' ? 'bg-amber-900/50 border border-amber-800/40' : 'bg-violet-900/50 border border-violet-800/40'
                            : 'bg-neutral-800',
                        ].join(' ')}
                        style={{ width: isTablet ? 52 : 44, height: isTablet ? 52 : 44 }}
                      >
                        <Text style={{ fontSize: isTablet ? 28 : 22 }}>{mode.icon}</Text>
                      </View>
                      <Text className={['font-extrabold', active ? activeText : 'text-neutral-400'].join(' ')} style={{ fontSize: 12 * fontScale }}>
                        {mode.label}
                      </Text>
                      <Text className={['text-center leading-tight', active ? 'text-neutral-400' : 'text-neutral-700'].join(' ')} style={{ fontSize: 10 * fontScale }}>
                        {mode.desc}
                      </Text>
                    </TouchableOpacity>
                    </Animated.View>
                  )
                })}
              </View>
            </View>

            {/* Category picker */}
            {hasCategories && (
              <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold uppercase tracking-widest text-neutral-500" style={{ fontSize: 12 * fontScale }}>
                    Categories
                  </Text>
                  <View className="flex-row gap-3">
                    <TouchableOpacity onPress={() => setCategories(WORD_CATEGORIES.map((c) => c.key as WordCategory))}>
                      <Text className="text-violet-400" style={{ fontSize: 11 * fontScale }}>All</Text>
                    </TouchableOpacity>
                    <Text className="text-neutral-700">·</Text>
                    <TouchableOpacity onPress={() => setCategories([])}>
                      <Text className="text-neutral-500" style={{ fontSize: 11 * fontScale }}>Random</Text>
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
                          'flex-row items-center gap-1.5 rounded-xl border overflow-hidden',
                          selected
                            ? 'bg-violet-900/50 border-violet-600/70'
                            : isAll
                              ? 'bg-neutral-800/50 border-neutral-700/40'
                              : 'bg-neutral-900/40 border-neutral-800/40',
                        ].join(' ')}
                        style={{ paddingHorizontal: isTablet ? 12 : 10, paddingVertical: isTablet ? 8 : 7 }}
                        activeOpacity={0.75}
                      >
                        {selected && (
                          <View className="absolute top-0 left-0 right-0 h-0.5 bg-violet-500/60" />
                        )}
                        <Text style={{ fontSize: 13 * fontScale }}>{cat.icon}</Text>
                        <Text className={[
                          'font-semibold',
                          selected ? 'text-violet-200' : isAll ? 'text-neutral-400' : 'text-neutral-600',
                        ].join(' ')} style={{ fontSize: 12 * fontScale }}>
                          {cat.label}
                        </Text>
                        {selected && (
                          <Text className="text-violet-500 text-[9px] font-bold">✓</Text>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {categories.length === 0 ? (
                  <Text className="text-neutral-600" style={{ fontSize: 10 * fontScale }}>
                    No filter — a random category is picked each round
                  </Text>
                ) : (
                  <Text className="text-neutral-600" style={{ fontSize: 10 * fontScale }}>
                    {categories.length} of {WORD_CATEGORIES.length} categories selected
                  </Text>
                )}
              </View>
            )}

            {/* Ranked info */}
            {selectedMode === 'ranked' && (
              <View className="flex-row items-start gap-3 px-4 py-3 rounded-xl bg-amber-950/30 border border-amber-800/30">
                <Text className="text-amber-400 mt-0.5">🏆</Text>
                <View className="flex-1">
                  <Text className="text-amber-400 font-semibold" style={{ fontSize: 14 * fontScale }}>Ranked mode</Text>
                  <Text className="text-amber-600 mt-0.5" style={{ fontSize: 12 * fontScale }}>
                    All 10 categories are used. Wins and losses affect your LP and rank.
                  </Text>
                </View>
              </View>
            )}

            {/* Create / Find button */}
            {selectedMode && !inQueue && (
              <View className="gap-2">
                <TouchableOpacity
                  onPress={selectedMode === 'lobby' ? handleCreate : handleMatchmaking}
                  disabled={loading}
                  className={[
                    'rounded-2xl items-center overflow-hidden',
                    loading ? 'opacity-60' : '',
                    selectedMode === 'ranked'
                      ? 'bg-amber-600'
                      : 'bg-violet-600',
                  ].join(' ')}
                  style={{ paddingVertical: isTablet ? 18 : 16 }}
                  activeOpacity={0.8}
                >
                  {/* Subtle shine overlay */}
                  <View
                    className="absolute top-0 left-0 right-0 h-1/2 rounded-t-2xl"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                  />
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-extrabold tracking-wide" style={{ fontSize: 17 * fontScale }}>
                      {selectedMode === 'normal' && t('home.findGame')}
                      {selectedMode === 'ranked' && t('home.findRanked')}
                      {selectedMode === 'lobby' && t('home.createLobby')}
                    </Text>
                  )}
                </TouchableOpacity>
                {showCostHint && (
                  <Text className="text-center text-amber-500/80" style={{ fontSize: 11 * fontScale }}>
                    {t('home.costPerPlay', { cost: 10, defaultValue: 'Costs 10⭐ per play' })}
                  </Text>
                )}
              </View>
            )}

            {/* Matchmaking queue */}
            {inQueue && (() => {
              const { queueSize, needed, elapsed, maxWait, idealPlayers } = matchStatus
              const statusText = elapsed < 15
                ? t('home.matchmakingFullLobby')
                : elapsed < 35
                  ? t('home.matchmakingExpanding')
                  : t('home.matchmakingStartingSoon')

              return (
                <View className="bg-violet-950 border border-violet-800 rounded-2xl p-5 items-center gap-3">
                  <ActivityIndicator color="#8b5cf6" size="large" />
                  <Text className="text-violet-300 font-semibold" style={{ fontSize: 14 * fontScale }}>
                    {statusText}
                  </Text>
                  <Text className="text-violet-500" style={{ fontSize: 12 * fontScale }}>
                    {t('home.inQueue', { count: queueSize, needed })}
                  </Text>

                  {/* Player slot dots */}
                  <View className="flex-row items-center justify-center gap-1">
                    {Array.from({ length: idealPlayers }).map((_, i) => (
                      <View
                        key={i}
                        className={[
                          'rounded-full',
                          i < queueSize
                            ? 'bg-violet-500'
                            : i < needed
                              ? 'bg-neutral-700 border border-neutral-600'
                              : 'bg-neutral-800',
                        ].join(' ')}
                        style={{ width: isTablet ? 12 : 10, height: isTablet ? 12 : 10 }}
                      />
                    ))}
                  </View>

                  {/* Timer */}
                  <Text className="text-neutral-600" style={{ fontSize: 10 * fontScale }}>{elapsed}s / {maxWait}s</Text>

                  <TouchableOpacity
                    onPress={cancelMatchmaking}
                    className="px-5 py-2 rounded-xl bg-neutral-800 border border-neutral-700 mt-1"
                  >
                    <Text className="text-neutral-300 font-semibold" style={{ fontSize: 14 * fontScale }}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              )
            })()}

            {/* Error */}
            {error && (
              <View className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800">
                <Text className="text-red-400" style={{ fontSize: 14 * fontScale }}>⚠ {error}</Text>
              </View>
            )}

            {/* Insufficient-coins modal — shows on 402 / INSUFFICIENT_STARS */}
            <InsufficientCoinsModal
              visible={insufficientCoinsRequired !== null}
              required={insufficientCoinsRequired ?? 10}
              onClose={() => setInsufficientCoinsRequired(null)}
            />


            {/* Offline / Pass & Play */}
            <TouchableOpacity
              onPress={() => router.push('/offline')}
              className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden flex-row items-center gap-4"
              style={{ padding: isTablet ? 18 : 14 }}
              activeOpacity={0.8}
            >
              {/* Left accent bar */}
              <View className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-700/60" />
              <View
                className="rounded-xl bg-neutral-800 border border-neutral-700 items-center justify-center"
                style={{ width: isTablet ? 52 : 44, height: isTablet ? 52 : 44 }}
              >
                <Text style={{ fontSize: isTablet ? 26 : 22 }}>🎭</Text>
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold" style={{ fontSize: 15 * fontScale }}>
                  Offline Mode
                </Text>
                <Text className="text-neutral-500 mt-0.5" style={{ fontSize: 12 * fontScale }}>
                  Pass & Play — no internet needed
                </Text>
              </View>
              <Text className="text-neutral-600" style={{ fontSize: 18 }}>›</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center gap-3">
              <View className="flex-1 h-px bg-neutral-800" />
              <Text className="text-neutral-500 font-medium uppercase tracking-wider" style={{ fontSize: 12 * fontScale }}>or join</Text>
              <View className="flex-1 h-px bg-neutral-800" />
            </View>

            {/* Join */}
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 bg-neutral-800 text-white rounded-xl font-mono uppercase tracking-widest border border-neutral-700 text-center"
                style={{ paddingHorizontal: 16, paddingVertical: isTablet ? 14 : 12, fontSize: 18 * fontScale }}
                placeholder="XXXXXX"
                placeholderTextColor="#525252"
                value={roomCode}
                onChangeText={(v) => setRoomCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={8}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
              />
              <TouchableOpacity
                onPress={handleJoin}
                disabled={roomCode.trim().length < 4}
                className={[
                  'rounded-xl items-center justify-center border border-neutral-700',
                  roomCode.trim().length < 4 ? 'bg-neutral-800 opacity-40' : 'bg-neutral-700',
                ].join(' ')}
                style={{ paddingHorizontal: isTablet ? 24 : 20, paddingVertical: isTablet ? 14 : 12 }}
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold" style={{ fontSize: 14 * fontScale }}>{t('room.joinRoom')}</Text>
              </TouchableOpacity>
            </View>

          </View>

          {/* How to Play */}
          <View style={{ marginTop: 56, paddingHorizontal: px }}>
            <Text className="text-center font-semibold uppercase tracking-widest text-neutral-500 mb-6" style={{ fontSize: 12 * fontScale }}>
              How to play
            </Text>
            <View className="flex-row flex-wrap gap-3" style={{ justifyContent: isTablet ? 'center' : 'flex-start' }}>
              {HOW_TO_PLAY.map((step) => (
                <View
                  key={step.title}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl items-center overflow-hidden"
                  style={{ width: gridItemWidth, padding: isTablet ? 20 : 16 }}
                >
                  {/* Top accent bar */}
                  <View className="absolute top-0 left-0 right-0 h-0.5 bg-violet-800/60" />
                  <View
                    className="rounded-2xl bg-neutral-800 items-center justify-center mb-3"
                    style={{ width: isTablet ? 56 : 48, height: isTablet ? 56 : 48 }}
                  >
                    <Text style={{ fontSize: isTablet ? 28 : 24 }}>{step.icon}</Text>
                  </View>
                  <Text className="font-bold text-white mb-1 text-center" style={{ fontSize: 14 * fontScale }}>{step.title}</Text>
                  <Text className="text-neutral-500 text-center leading-relaxed" style={{ fontSize: 11 * fontScale }}>{step.desc}</Text>
                </View>
              ))}
            </View>

            {/* Full tutorial link */}
            <TouchableOpacity
              onPress={() => router.push('/how-to-play')}
              className="mt-4 flex-row items-center justify-center gap-2 py-3 rounded-2xl border border-neutral-800 bg-neutral-900/50"
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 16 }}>📖</Text>
              <Text className="text-neutral-400 font-semibold" style={{ fontSize: 13 * fontScale }}>
                Full Tutorial
              </Text>
              <Text className="text-neutral-600" style={{ fontSize: 14 }}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <OnboardingTutorial
        visible={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
    </SafeAreaView>
  )
}
