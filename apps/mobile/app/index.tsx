import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'
import { WORD_CATEGORIES } from '@imposter/shared'
import type { WordCategory } from '@imposter/shared'

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
  const { user, clearAuth } = useAuthStore()

  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null)
  const [categories, setCategories] = useState<WordCategory[]>([])
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasCategories = selectedMode === 'normal' || selectedMode === 'lobby'

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
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = () => {
    const code = roomCode.trim().toUpperCase()
    if (!code || code.length < 4) return
    router.push(`/lobby/${code}`)
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-lg">🎭</Text>
            <Text className="text-white font-bold text-lg tracking-tight">Imposter</Text>
          </View>
          {user && (
            <View className="flex-row items-center gap-3">
              <Text className="text-neutral-400 text-sm">@{user.username}</Text>
              <TouchableOpacity onPress={clearAuth}>
                <Text className="text-neutral-600 text-sm">Sign out</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Hero */}
        <View className="items-center px-6 pt-10 pb-6">
          <View className="flex-row items-center gap-2 px-3 py-1.5 rounded-full border border-violet-700/40 bg-violet-900/20 mb-5">
            <View className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            <Text className="text-violet-400 text-xs font-semibold">Social Deduction · Real-time · Multiplayer</Text>
          </View>
          <Text className="text-4xl font-extrabold text-white text-center leading-tight tracking-tight mb-2">
            Play the{'\n'}
            <Text className="text-violet-500">Imposter</Text> Game
          </Text>
          <Text className="text-neutral-400 text-base mt-2 text-center">Deceive. Detect. Dominate.</Text>
        </View>

        <View className="px-4 gap-4">

          {/* Mode selector */}
          <View>
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3 px-1">
              Choose a mode
            </Text>
            <View className="flex-row gap-2">
              {MODES.map((mode) => {
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
                return (
                  <TouchableOpacity
                    key={mode.id}
                    onPress={() => {
                      setSelectedMode(active ? null : mode.id)
                      setCategories([])
                      setError(null)
                    }}
                    style={{ flex: 1 }}
                    className={[
                      'items-center gap-1 p-3 rounded-2xl border',
                      active
                        ? activeStyle
                        : 'border-neutral-800 bg-neutral-900',
                    ].join(' ')}
                    activeOpacity={0.8}
                  >
                    <Text className="text-2xl">{mode.icon}</Text>
                    <Text className={['text-xs font-bold', active ? activeText : 'text-neutral-400'].join(' ')}>
                      {mode.label}
                    </Text>
                    <Text className={['text-[10px] text-center leading-tight', active ? 'text-neutral-400' : 'text-neutral-600'].join(' ')}>
                      {mode.desc}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Category picker */}
          {hasCategories && (
            <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  Categories
                </Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => setCategories(WORD_CATEGORIES.map((c) => c.key as WordCategory))}>
                    <Text className="text-[11px] text-violet-400">All</Text>
                  </TouchableOpacity>
                  <Text className="text-neutral-700">·</Text>
                  <TouchableOpacity onPress={() => setCategories([])}>
                    <Text className="text-[11px] text-neutral-500">Random</Text>
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
                        'flex-row items-center gap-1 px-2.5 py-1.5 rounded-lg border',
                        selected
                          ? 'bg-violet-950/60 border-violet-700/50'
                          : isAll
                            ? 'bg-neutral-800/60 border-neutral-700/40'
                            : 'bg-neutral-900/60 border-neutral-800/60',
                      ].join(' ')}
                      activeOpacity={0.75}
                    >
                      <Text className="text-xs">{cat.icon}</Text>
                      <Text className={[
                        'text-xs font-medium',
                        selected ? 'text-violet-300' : isAll ? 'text-neutral-400' : 'text-neutral-600',
                      ].join(' ')}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {categories.length === 0 ? (
                <Text className="text-[10px] text-neutral-600">
                  No filter — a random category is picked each round
                </Text>
              ) : (
                <Text className="text-[10px] text-neutral-600">
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
                <Text className="text-amber-400 text-sm font-semibold">Ranked mode</Text>
                <Text className="text-amber-600 text-xs mt-0.5">
                  All 12 categories are used. Wins and losses affect your LP and rank.
                </Text>
              </View>
            </View>
          )}

          {/* Create button */}
          {selectedMode && (
            <TouchableOpacity
              onPress={handleCreate}
              disabled={loading}
              className={[
                'py-4 rounded-2xl items-center',
                loading ? 'opacity-50' : '',
                selectedMode === 'ranked'
                  ? 'bg-amber-600'
                  : 'bg-violet-600',
              ].join(' ')}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-lg">
                  {selectedMode === 'normal' && '🎮 Start Normal Game'}
                  {selectedMode === 'ranked' && '🏆 Start Ranked Game'}
                  {selectedMode === 'lobby' && '🚪 Create Lobby'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Error */}
          {error && (
            <View className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800">
              <Text className="text-red-400 text-sm">⚠ {error}</Text>
            </View>
          )}

          {/* Divider */}
          <View className="flex-row items-center gap-3">
            <View className="flex-1 h-px bg-neutral-800" />
            <Text className="text-neutral-500 text-xs font-medium uppercase tracking-wider">or join</Text>
            <View className="flex-1 h-px bg-neutral-800" />
          </View>

          {/* Join */}
          <View className="flex-row gap-2">
            <TextInput
              className="flex-1 bg-neutral-800 text-white px-4 py-3 rounded-xl font-mono uppercase tracking-widest border border-neutral-700 text-center text-lg"
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
                'px-5 py-3 rounded-xl items-center justify-center border border-neutral-700',
                roomCode.trim().length < 4 ? 'bg-neutral-800 opacity-40' : 'bg-neutral-700',
              ].join(' ')}
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold">{t('room.joinRoom')}</Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* How to Play */}
        <View className="mt-14 px-4">
          <Text className="text-center text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-6">
            How to play
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {HOW_TO_PLAY.map((step) => (
              <View
                key={step.title}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 items-center"
                style={{ width: '47%' }}
              >
                <Text className="text-3xl mb-2">{step.icon}</Text>
                <Text className="text-sm font-semibold text-white mb-1 text-center">{step.title}</Text>
                <Text className="text-xs text-neutral-500 text-center leading-relaxed">{step.desc}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}
