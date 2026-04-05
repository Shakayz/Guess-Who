import React, { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Animated, FlatList } from 'react-native'
import { useRouter } from 'expo-router'
import { WORD_CATEGORIES, shuffleArray, OFFLINE_WORD_PAIRS, pickRandomWordPair } from '@imposter/shared'
import type { WordCategory } from '@imposter/shared'
import { useResponsive } from '../lib/responsive'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'dealing' | 'playing' | 'results'

interface OfflinePlayer {
  name: string
  role: 'villager' | 'imposter'
  word: string
  isEliminated: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDefaultImposterCount(playerCount: number): number {
  if (playerCount <= 4) return 1
  if (playerCount <= 7) return 2
  if (playerCount <= 11) return 3
  return 4
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SetupPhase({
  playerNames,
  setPlayerNames,
  imposterCount,
  setImposterCount,
  selectedCategories,
  setSelectedCategories,
  onStart,
  onBack,
  isTablet,
  px,
  fontScale,
}: {
  playerNames: string[]
  setPlayerNames: React.Dispatch<React.SetStateAction<string[]>>
  imposterCount: number
  setImposterCount: React.Dispatch<React.SetStateAction<number>>
  selectedCategories: WordCategory[]
  setSelectedCategories: React.Dispatch<React.SetStateAction<WordCategory[]>>
  onStart: () => void
  onBack: () => void
  isTablet: boolean
  px: number
  fontScale: number
}) {
  const filledNames = playerNames.filter((n) => n.trim().length > 0)
  const canStart = filledNames.length >= 3

  const addPlayer = () => {
    if (playerNames.length < 20) {
      setPlayerNames((prev) => [...prev, ''])
    }
  }

  const removePlayer = (index: number) => {
    setPlayerNames((prev) => prev.filter((_, i) => i !== index))
  }

  const updateName = (index: number, value: string) => {
    setPlayerNames((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const toggleCategory = (key: WordCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    )
  }

  const maxImposters = Math.max(1, Math.floor(filledNames.length / 2))

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ paddingHorizontal: px, gap: 24 }}>

        {/* Header */}
        <View className="items-center pt-2 pb-2">
          <Text style={{ fontSize: isTablet ? 36 : 30 }}>🎭</Text>
          <Text
            className="font-extrabold text-white tracking-tight mt-1"
            style={{ fontSize: (isTablet ? 28 : 22) * fontScale }}
          >
            Offline Mode
          </Text>
          <Text
            className="text-violet-400 font-semibold mt-0.5"
            style={{ fontSize: 14 * fontScale }}
          >
            Pass & Play
          </Text>
        </View>

        {/* Players */}
        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-3">
          <Text
            className="font-semibold uppercase tracking-widest text-neutral-500"
            style={{ fontSize: 12 * fontScale }}
          >
            Players ({playerNames.length})
          </Text>

          {playerNames.map((name, i) => (
            <View key={i} className="flex-row items-center gap-2">
              <View className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 items-center justify-center">
                <Text className="text-neutral-400 font-bold" style={{ fontSize: 12 * fontScale }}>
                  {i + 1}
                </Text>
              </View>
              <TextInput
                className="flex-1 bg-neutral-800 text-white rounded-xl border border-neutral-700"
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: isTablet ? 12 : 10,
                  fontSize: 15 * fontScale,
                }}
                placeholder={`Player ${i + 1}`}
                placeholderTextColor="#525252"
                value={name}
                onChangeText={(v) => updateName(i, v)}
                maxLength={24}
                autoCorrect={false}
                spellCheck={false}
              />
              {playerNames.length > 3 && (
                <TouchableOpacity
                  onPress={() => removePlayer(i)}
                  className="w-8 h-8 rounded-xl bg-neutral-800 border border-neutral-700 items-center justify-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-neutral-400 font-bold" style={{ fontSize: 14 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {playerNames.length < 20 && (
            <TouchableOpacity
              onPress={addPlayer}
              className="flex-row items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-neutral-700"
              activeOpacity={0.7}
            >
              <Text className="text-violet-400 font-semibold" style={{ fontSize: 14 * fontScale }}>
                + Add Player
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Imposter count */}
        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text
              className="font-semibold uppercase tracking-widest text-neutral-500"
              style={{ fontSize: 12 * fontScale }}
            >
              Imposters
            </Text>
            <Text className="text-neutral-600" style={{ fontSize: 11 * fontScale }}>
              (auto-suggested: {getDefaultImposterCount(filledNames.length)})
            </Text>
          </View>
          <View className="flex-row gap-2">
            {[1, 2, 3, 4].map((n) => {
              const disabled = n > maxImposters
              const active = imposterCount === n && !disabled
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() => !disabled && setImposterCount(n)}
                  disabled={disabled}
                  className={[
                    'flex-1 items-center justify-center rounded-xl border py-3',
                    active
                      ? 'bg-violet-900/50 border-violet-600/70'
                      : disabled
                        ? 'bg-neutral-900 border-neutral-800 opacity-40'
                        : 'bg-neutral-800 border-neutral-700',
                  ].join(' ')}
                  activeOpacity={0.75}
                >
                  <Text
                    className={active ? 'text-violet-300 font-bold' : 'text-neutral-400 font-semibold'}
                    style={{ fontSize: 18 * fontScale }}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <Text className="text-neutral-600" style={{ fontSize: 10 * fontScale }}>
            {filledNames.length < 3
              ? 'Add at least 3 players to choose imposters'
              : `${imposterCount} imposter${imposterCount > 1 ? 's' : ''} out of ${filledNames.length} players`}
          </Text>
        </View>

        {/* Categories */}
        <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text
              className="font-semibold uppercase tracking-widest text-neutral-500"
              style={{ fontSize: 12 * fontScale }}
            >
              Categories
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setSelectedCategories(WORD_CATEGORIES.map((c) => c.key as WordCategory))}
              >
                <Text className="text-violet-400" style={{ fontSize: 11 * fontScale }}>All</Text>
              </TouchableOpacity>
              <Text className="text-neutral-700">·</Text>
              <TouchableOpacity onPress={() => setSelectedCategories([])}>
                <Text className="text-neutral-500" style={{ fontSize: 11 * fontScale }}>Random</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-1.5">
            {WORD_CATEGORIES.map((cat) => {
              const selected = selectedCategories.includes(cat.key as WordCategory)
              const isAll = selectedCategories.length === 0
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
                  <Text
                    className={[
                      'font-semibold',
                      selected ? 'text-violet-200' : isAll ? 'text-neutral-400' : 'text-neutral-600',
                    ].join(' ')}
                    style={{ fontSize: 12 * fontScale }}
                  >
                    {cat.label}
                  </Text>
                  {selected && (
                    <Text className="text-violet-500 font-bold" style={{ fontSize: 9 }}>✓</Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>

          {selectedCategories.length === 0 ? (
            <Text className="text-neutral-600" style={{ fontSize: 10 * fontScale }}>
              No filter — a random category is picked each round
            </Text>
          ) : (
            <Text className="text-neutral-600" style={{ fontSize: 10 * fontScale }}>
              {selectedCategories.length} of {WORD_CATEGORIES.length} categories selected
            </Text>
          )}
        </View>

        {/* Start button */}
        <TouchableOpacity
          onPress={onStart}
          disabled={!canStart}
          className={[
            'rounded-2xl items-center overflow-hidden',
            canStart ? 'bg-violet-600' : 'bg-neutral-800 opacity-50',
          ].join(' ')}
          style={{ paddingVertical: isTablet ? 18 : 16 }}
          activeOpacity={0.8}
        >
          <View
            className="absolute top-0 left-0 right-0 h-1/2 rounded-t-2xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          />
          <Text
            className={canStart ? 'text-white font-extrabold tracking-wide' : 'text-neutral-500 font-extrabold'}
            style={{ fontSize: 17 * fontScale }}
          >
            {canStart ? 'Start Game' : `Need at least 3 players (${filledNames.length}/3)`}
          </Text>
        </TouchableOpacity>

        {/* Back button */}
        <TouchableOpacity
          onPress={onBack}
          className="rounded-2xl items-center border border-neutral-800 bg-neutral-900"
          style={{ paddingVertical: isTablet ? 14 : 12 }}
          activeOpacity={0.7}
        >
          <Text className="text-neutral-400 font-semibold" style={{ fontSize: 15 * fontScale }}>
            Back to Home
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// ─── Card Reveal Animation ───────────────────────────────────────────────────

function RoleCard({
  player,
  onGotIt,
  isTablet,
  fontScale,
}: {
  player: OfflinePlayer
  onGotIt: () => void
  isTablet: boolean
  fontScale: number
}) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    scaleAnim.setValue(0.6)
    opacityAnim.setValue(0)
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [player.name])

  const isImposter = player.role === 'imposter'

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        opacity: opacityAnim,
        width: '100%',
      }}
    >
      <View
        className={[
          'rounded-2xl border overflow-hidden',
          isImposter
            ? 'bg-red-950/60 border-red-800/60'
            : 'bg-emerald-950/60 border-emerald-800/60',
        ].join(' ')}
        style={{ padding: isTablet ? 40 : 28 }}
      >
        {/* Top accent bar */}
        <View
          className={[
            'absolute top-0 left-0 right-0 h-1',
            isImposter ? 'bg-red-500' : 'bg-emerald-500',
          ].join(' ')}
        />

        {/* Role icon */}
        <View className="items-center mb-4">
          <Text style={{ fontSize: isTablet ? 64 : 52 }}>
            {isImposter ? '🔴' : '🟢'}
          </Text>
        </View>

        {/* Role label */}
        <Text
          className={[
            'text-center font-extrabold tracking-widest uppercase mb-2',
            isImposter ? 'text-red-400' : 'text-emerald-400',
          ].join(' ')}
          style={{ fontSize: 13 * fontScale }}
        >
          {isImposter ? 'Imposter' : 'Villager'}
        </Text>

        {/* Word */}
        <Text
          className="text-white font-extrabold text-center tracking-tight"
          style={{ fontSize: (isTablet ? 38 : 30) * fontScale }}
        >
          {player.word}
        </Text>

        {/* Hint for imposter */}
        {isImposter && (
          <View className="mt-4 px-4 py-2 rounded-xl bg-red-900/40 border border-red-800/40">
            <Text
              className="text-red-300 text-center leading-relaxed"
              style={{ fontSize: 12 * fontScale }}
            >
              The villagers have a different but similar word. Blend in!
            </Text>
          </View>
        )}

        {/* Got it button */}
        <TouchableOpacity
          onPress={onGotIt}
          className={[
            'mt-6 rounded-xl items-center overflow-hidden',
            isImposter ? 'bg-red-700' : 'bg-emerald-700',
          ].join(' ')}
          style={{ paddingVertical: isTablet ? 16 : 13 }}
          activeOpacity={0.8}
        >
          <Text
            className="text-white font-extrabold tracking-wide"
            style={{ fontSize: 16 * fontScale }}
          >
            Got it!
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

// ─── Timer ───────────────────────────────────────────────────────────────────

function GameTimer({
  isTablet,
  fontScale,
}: {
  isTablet: boolean
  fontScale: number
}) {
  const [seconds, setSeconds] = useState(30)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tick = useCallback(() => {
    setSeconds((prev) => {
      if (prev <= 1) {
        setRunning(false)
        return 0
      }
      return prev - 1
    })
  }, [])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running, tick])

  const reset = () => {
    setRunning(false)
    setSeconds(30)
  }

  const progress = seconds / 30
  const isUrgent = seconds <= 10

  return (
    <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 items-center gap-3">
      <Text
        className="font-semibold uppercase tracking-widest text-neutral-500"
        style={{ fontSize: 12 * fontScale }}
      >
        Discussion Timer
      </Text>

      {/* Countdown */}
      <Text
        className={[
          'font-extrabold tabular-nums',
          isUrgent ? 'text-red-400' : seconds === 0 ? 'text-neutral-600' : 'text-white',
        ].join(' ')}
        style={{ fontSize: (isTablet ? 56 : 44) * fontScale }}
      >
        {seconds}s
      </Text>

      {/* Progress bar */}
      <View className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
        <View
          className={[
            'h-full rounded-full',
            isUrgent ? 'bg-red-500' : 'bg-violet-500',
          ].join(' ')}
          style={{ width: `${progress * 100}%` }}
        />
      </View>

      {/* Controls */}
      <View className="flex-row gap-2 w-full">
        <TouchableOpacity
          onPress={() => setRunning((r) => !r)}
          className={[
            'flex-1 items-center justify-center rounded-xl border py-3',
            running ? 'bg-amber-900/40 border-amber-700/40' : 'bg-violet-900/40 border-violet-700/40',
          ].join(' ')}
          activeOpacity={0.8}
        >
          <Text
            className={running ? 'text-amber-400 font-semibold' : 'text-violet-400 font-semibold'}
            style={{ fontSize: 14 * fontScale }}
          >
            {running ? 'Pause' : seconds === 0 ? 'Expired' : 'Start'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={reset}
          className="items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3"
          activeOpacity={0.7}
        >
          <Text className="text-neutral-400 font-semibold" style={{ fontSize: 14 * fontScale }}>
            Reset
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function OfflineScreen() {
  const router = useRouter()
  const { isTablet, px, fontScale } = useResponsive()

  // ── Phase ──
  const [phase, setPhase] = useState<Phase>('setup')

  // ── Setup state ──
  const [playerNames, setPlayerNames] = useState<string[]>(['', '', ''])
  const [imposterCount, setImposterCount] = useState(1)
  const [selectedCategories, setSelectedCategories] = useState<WordCategory[]>([])

  // ── Game state ──
  const [players, setPlayers] = useState<OfflinePlayer[]>([])
  const [currentDealIndex, setCurrentDealIndex] = useState(0)
  const [showingCard, setShowingCard] = useState(false)

  // ── Sync imposter count when player count changes ──
  const filledNames = playerNames.filter((n) => n.trim().length > 0)
  useEffect(() => {
    const max = Math.max(1, Math.floor(filledNames.length / 2))
    if (imposterCount > max) {
      setImposterCount(Math.min(max, getDefaultImposterCount(filledNames.length)))
    }
  }, [filledNames.length])

  // ── Auto-suggest imposter count on player count change ──
  useEffect(() => {
    if (filledNames.length >= 3) {
      setImposterCount(getDefaultImposterCount(filledNames.length))
    }
  }, [filledNames.length])

  const contentStyle = isTablet
    ? { maxWidth: 520, alignSelf: 'center' as const, width: '100%' as const }
    : {}

  // ── Start game ──
  const handleStart = useCallback(() => {
    const names = playerNames.filter((n) => n.trim().length > 0)
    if (names.length < 3) return

    const wordPair = pickRandomWordPair(selectedCategories, shuffleArray)
    const clampedImposters = Math.min(imposterCount, Math.floor(names.length / 2))

    const roles = shuffleArray(
      names.map((name, i) => ({
        name,
        role: (i < clampedImposters ? 'imposter' : 'villager') as 'imposter' | 'villager',
        word: i < clampedImposters ? wordPair.imposterWord : wordPair.villagerWord,
        isEliminated: false,
      })),
    )

    setPlayers(roles)
    setCurrentDealIndex(0)
    setShowingCard(false)
    setPhase('dealing')
  }, [playerNames, selectedCategories, imposterCount])

  // ── Dealing navigation ──
  const handleGotIt = useCallback(() => {
    const nextIndex = currentDealIndex + 1
    if (nextIndex >= players.length) {
      setShowingCard(false)
      setPhase('playing')
    } else {
      setCurrentDealIndex(nextIndex)
      setShowingCard(false)
    }
  }, [currentDealIndex, players.length])

  // ── Results ──
  const handlePlayAgain = useCallback(() => {
    setPhase('setup')
    setPlayers([])
    setCurrentDealIndex(0)
    setShowingCard(false)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Phase: Setup
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <View className="flex-1 bg-neutral-950" style={contentStyle}>
        <SetupPhase
          playerNames={playerNames}
          setPlayerNames={setPlayerNames}
          imposterCount={imposterCount}
          setImposterCount={setImposterCount}
          selectedCategories={selectedCategories}
          setSelectedCategories={setSelectedCategories}
          onStart={handleStart}
          onBack={() => router.back()}
          isTablet={isTablet}
          px={px}
          fontScale={fontScale}
        />
      </View>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase: Dealing
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'dealing') {
    const currentPlayer = players[currentDealIndex]

    return (
      <View className="flex-1 bg-neutral-950 items-stretch justify-center" style={contentStyle}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: px, gap: 20 }}>

            {/* Progress indicator */}
            <View className="flex-row items-center justify-center gap-1.5">
              {players.map((_, i) => (
                <View
                  key={i}
                  className={[
                    'rounded-full',
                    i < currentDealIndex
                      ? 'bg-violet-500'
                      : i === currentDealIndex
                        ? 'bg-violet-400'
                        : 'bg-neutral-800',
                  ].join(' ')}
                  style={{
                    width: i === currentDealIndex ? 24 : 8,
                    height: 8,
                  }}
                />
              ))}
            </View>

            {!showingCard ? (
              /* Pass device prompt */
              <View className="rounded-2xl border border-neutral-800 bg-neutral-900 items-center overflow-hidden"
                style={{ padding: isTablet ? 48 : 36 }}
              >
                <View className="absolute top-0 left-0 right-0 h-0.5 bg-violet-500/60" />

                <Text style={{ fontSize: isTablet ? 52 : 42 }}>🤲</Text>

                <Text
                  className="text-neutral-500 font-semibold text-center mt-4"
                  style={{ fontSize: 13 * fontScale }}
                >
                  Pass the device to
                </Text>

                <Text
                  className="text-white font-extrabold text-center mt-1 tracking-tight"
                  style={{ fontSize: (isTablet ? 30 : 24) * fontScale }}
                >
                  {currentPlayer.name}
                </Text>

                <Text
                  className="text-neutral-600 text-center mt-3 leading-relaxed"
                  style={{ fontSize: 12 * fontScale }}
                >
                  Make sure nobody else can see the screen.
                </Text>

                <TouchableOpacity
                  onPress={() => setShowingCard(true)}
                  className="mt-8 rounded-2xl bg-violet-600 items-center overflow-hidden w-full"
                  style={{ paddingVertical: isTablet ? 18 : 14 }}
                  activeOpacity={0.8}
                >
                  <View
                    className="absolute top-0 left-0 right-0 h-1/2 rounded-t-2xl"
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
                  />
                  <Text
                    className="text-white font-extrabold tracking-wide"
                    style={{ fontSize: 17 * fontScale }}
                  >
                    I'm Ready
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Role card reveal */
              <RoleCard
                player={currentPlayer}
                onGotIt={handleGotIt}
                isTablet={isTablet}
                fontScale={fontScale}
              />
            )}

            <Text
              className="text-neutral-700 text-center"
              style={{ fontSize: 11 * fontScale }}
            >
              Player {currentDealIndex + 1} of {players.length}
            </Text>
          </View>
        </ScrollView>
      </View>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase: Playing
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'playing') {
    return (
      <View className="flex-1 bg-neutral-950" style={contentStyle}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingVertical: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: px, gap: 16 }}>

            {/* Header */}
            <View className="items-center pb-2">
              <Text style={{ fontSize: isTablet ? 36 : 28 }}>🎮</Text>
              <Text
                className="font-extrabold text-white tracking-tight mt-1"
                style={{ fontSize: (isTablet ? 24 : 20) * fontScale }}
              >
                Game in Progress
              </Text>
              <Text
                className="text-neutral-500 mt-0.5"
                style={{ fontSize: 13 * fontScale }}
              >
                Discuss and find the imposter!
              </Text>
            </View>

            {/* Timer */}
            <GameTimer isTablet={isTablet} fontScale={fontScale} />

            {/* Player list */}
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-3">
              <Text
                className="font-semibold uppercase tracking-widest text-neutral-500"
                style={{ fontSize: 12 * fontScale }}
              >
                Players
              </Text>
              {players.map((player, i) => (
                <View
                  key={i}
                  className="flex-row items-center gap-3 py-2 px-3 rounded-xl bg-neutral-800 border border-neutral-700"
                >
                  <View className="w-8 h-8 rounded-full bg-neutral-700 border border-neutral-600 items-center justify-center">
                    <Text className="text-white font-bold" style={{ fontSize: 14 * fontScale }}>
                      {player.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    className="flex-1 text-white font-semibold"
                    style={{ fontSize: 15 * fontScale }}
                  >
                    {player.name}
                  </Text>
                  <View className="w-2 h-2 rounded-full bg-emerald-500" />
                </View>
              ))}
            </View>

            {/* Action buttons */}
            <TouchableOpacity
              onPress={() => setPhase('results')}
              className="rounded-2xl bg-violet-600 items-center overflow-hidden"
              style={{ paddingVertical: isTablet ? 18 : 15 }}
              activeOpacity={0.8}
            >
              <View
                className="absolute top-0 left-0 right-0 h-1/2 rounded-t-2xl"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
              />
              <Text
                className="text-white font-extrabold tracking-wide"
                style={{ fontSize: 17 * fontScale }}
              >
                Reveal Roles
              </Text>
            </TouchableOpacity>

            <View className="flex-row items-center gap-3">
              <View className="flex-1 h-px bg-neutral-800" />
              <Text className="text-neutral-600" style={{ fontSize: 11 * fontScale }}>or</Text>
              <View className="flex-1 h-px bg-neutral-800" />
            </View>

            <TouchableOpacity
              onPress={() => setPhase('results')}
              className="rounded-2xl border border-neutral-700 bg-neutral-900 items-center"
              style={{ paddingVertical: isTablet ? 15 : 13 }}
              activeOpacity={0.7}
            >
              <Text
                className="text-neutral-300 font-semibold"
                style={{ fontSize: 15 * fontScale }}
              >
                Start Vote & See Results
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase: Results
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-neutral-950" style={contentStyle}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingVertical: 24, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: px, gap: 20 }}>

          {/* Header */}
          <View className="items-center pb-2">
            <Text style={{ fontSize: isTablet ? 48 : 40 }}>🏆</Text>
            <Text
              className="font-extrabold text-white tracking-tight mt-2"
              style={{ fontSize: (isTablet ? 28 : 22) * fontScale }}
            >
              Round Complete!
            </Text>
            <Text
              className="text-neutral-400 mt-1 text-center"
              style={{ fontSize: 14 * fontScale }}
            >
              Here are everyone's roles
            </Text>
          </View>

          {/* Word reveal banner */}
          {players.length > 0 && (
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-2">
              <Text
                className="text-center font-semibold uppercase tracking-widest text-neutral-500"
                style={{ fontSize: 11 * fontScale }}
              >
                Words This Round
              </Text>
              <View className="flex-row gap-3 mt-1">
                <View className="flex-1 items-center py-3 rounded-xl bg-emerald-950/50 border border-emerald-800/50">
                  <Text className="text-emerald-500 font-bold" style={{ fontSize: 10 * fontScale }}>
                    VILLAGER
                  </Text>
                  <Text
                    className="text-emerald-200 font-extrabold mt-1 text-center"
                    style={{ fontSize: 16 * fontScale }}
                  >
                    {players.find((p) => p.role === 'villager')?.word ?? '—'}
                  </Text>
                </View>
                <View className="flex-1 items-center py-3 rounded-xl bg-red-950/50 border border-red-800/50">
                  <Text className="text-red-500 font-bold" style={{ fontSize: 10 * fontScale }}>
                    IMPOSTER
                  </Text>
                  <Text
                    className="text-red-200 font-extrabold mt-1 text-center"
                    style={{ fontSize: 16 * fontScale }}
                  >
                    {players.find((p) => p.role === 'imposter')?.word ?? '—'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Player roles */}
          <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-3">
            <Text
              className="font-semibold uppercase tracking-widest text-neutral-500"
              style={{ fontSize: 12 * fontScale }}
            >
              All Roles Revealed
            </Text>
            {players.map((player, i) => {
              const isImposter = player.role === 'imposter'
              return (
                <View
                  key={i}
                  className={[
                    'flex-row items-center gap-3 py-3 px-3 rounded-xl border overflow-hidden',
                    isImposter
                      ? 'bg-red-950/40 border-red-800/50'
                      : 'bg-emerald-950/40 border-emerald-800/50',
                  ].join(' ')}
                >
                  {/* Accent bar */}
                  <View
                    className={[
                      'absolute left-0 top-0 bottom-0 w-0.5',
                      isImposter ? 'bg-red-500' : 'bg-emerald-500',
                    ].join(' ')}
                  />

                  <Text style={{ fontSize: 20 }}>
                    {isImposter ? '🔴' : '🟢'}
                  </Text>

                  <View className="flex-1">
                    <Text
                      className="text-white font-bold"
                      style={{ fontSize: 15 * fontScale }}
                    >
                      {player.name}
                    </Text>
                    <Text
                      className={[
                        'font-semibold mt-0.5',
                        isImposter ? 'text-red-400' : 'text-emerald-400',
                      ].join(' ')}
                      style={{ fontSize: 12 * fontScale }}
                    >
                      {isImposter ? 'Imposter' : 'Villager'}
                    </Text>
                  </View>

                  <View
                    className={[
                      'px-3 py-1.5 rounded-lg',
                      isImposter ? 'bg-red-900/60' : 'bg-emerald-900/60',
                    ].join(' ')}
                  >
                    <Text
                      className={[
                        'font-semibold',
                        isImposter ? 'text-red-300' : 'text-emerald-300',
                      ].join(' ')}
                      style={{ fontSize: 12 * fontScale }}
                    >
                      {player.word}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>

          {/* Action buttons */}
          <TouchableOpacity
            onPress={handlePlayAgain}
            className="rounded-2xl bg-violet-600 items-center overflow-hidden"
            style={{ paddingVertical: isTablet ? 18 : 15 }}
            activeOpacity={0.8}
          >
            <View
              className="absolute top-0 left-0 right-0 h-1/2 rounded-t-2xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
            />
            <Text
              className="text-white font-extrabold tracking-wide"
              style={{ fontSize: 17 * fontScale }}
            >
              Play Again
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            className="rounded-2xl border border-neutral-700 bg-neutral-900 items-center"
            style={{ paddingVertical: isTablet ? 15 : 13 }}
            activeOpacity={0.7}
          >
            <Text
              className="text-neutral-300 font-semibold"
              style={{ fontSize: 15 * fontScale }}
            >
              Home
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}
