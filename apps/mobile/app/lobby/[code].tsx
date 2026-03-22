import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuthStore } from '../../store/auth'
import { useGameStore } from '../../store/game'
import { connectSocket, getSocket } from '../../lib/socket'
import { WORD_CATEGORIES } from '@imposter/shared'
import type { Room, GameMode, WordCategory } from '@imposter/shared'

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

// ─── SettingsPanel ────────────────────────────────────────────────────────────

interface Settings {
  maxPlayers: number
  imposterCount: number
  speakingTimeSeconds: number
  votingTimeSeconds: number
  gameMode: GameMode
  categories: WordCategory[]
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
          {(['normal', 'ranked'] as GameMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() =>
                onChange({
                  ...settings,
                  gameMode: mode,
                  categories: mode === 'ranked' ? [] : settings.categories,
                })
              }
              className={[
                'flex-1 py-2.5 rounded-xl items-center border',
                settings.gameMode === mode
                  ? mode === 'ranked'
                    ? 'bg-amber-950 border-amber-700'
                    : 'bg-violet-950 border-violet-700'
                  : 'bg-neutral-800 border-neutral-700',
              ].join(' ')}
            >
              <Text
                className={[
                  'text-sm font-semibold',
                  settings.gameMode === mode
                    ? mode === 'ranked'
                      ? 'text-amber-400'
                      : 'text-violet-400'
                    : 'text-neutral-400',
                ].join(' ')}
              >
                {mode === 'ranked' ? '🏆 Ranked' : '🎮 Normal'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text className="text-xs text-neutral-600 mt-1.5">
          {settings.gameMode === 'ranked'
            ? 'All categories — affects LP'
            : 'Custom categories — no LP impact'}
        </Text>
      </View>

      {/* Categories (normal only) */}
      {settings.gameMode === 'normal' && (
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
          min={4}
          max={20}
          onChange={(v) => onChange({ ...settings, maxPlayers: v })}
        />
        <NumStepper
          label="Imposters"
          value={settings.imposterCount}
          min={1}
          max={4}
          onChange={(v) => onChange({ ...settings, imposterCount: v })}
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

// ─── LobbyScreen ─────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  maxPlayers: 10,
  imposterCount: 2,
  speakingTimeSeconds: 30,
  votingTimeSeconds: 30,
  gameMode: 'normal',
  categories: [],
}

export default function LobbyScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { room, setRoom, setRoleAndWord, setRound } = useGameStore()

  const [isReady, setIsReady] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  const handleSettingsChange = (s: Settings) => {
    setSettings(s)
    getSocket().emit('room:settings' as any, {
      gameMode: s.gameMode,
      categories: s.categories,
    })
  }

  useEffect(() => {
    if (!code) return
    connectSocket()
    const socket = getSocket()
    socket.emit('room:join', { roomCode: code })

    socket.on('room:updated', (r) => {
      setRoom(r as Room)
      if (r.settings) {
        setSettings((prev) => ({
          ...prev,
          maxPlayers: r.settings.maxPlayers,
          imposterCount: r.settings.imposterCount,
          speakingTimeSeconds: r.settings.speakingTimeSeconds,
          votingTimeSeconds: r.settings.votingTimeSeconds,
          gameMode: (r.settings as any).gameMode ?? 'normal',
          categories: (r.settings as any).categories ?? [],
        }))
      }
    })

    socket.on('game:started', ({ round, yourWord, yourRole }) => {
      setRoleAndWord(yourRole, yourWord)
      setRound(round as any)
      router.replace(`/game/${code}`)
    })

    socket.on('error', (err) => console.error('[socket error]', err))

    return () => {
      socket.off('room:updated')
      socket.off('game:started')
      socket.off('error')
    }
  }, [code])

  const toggleReady = () => {
    getSocket().emit('player:ready', !isReady)
    setIsReady((r) => !r)
  }

  const startGame = () => getSocket().emit('game:start')

  const handleLeave = () => {
    getSocket().emit('room:leave')
    router.replace('/')
  }

  const isHost = room?.hostId === user?.id
  const players = room?.players ?? []
  const allReady = players.length >= 2 && players.every((p) => p.isReady || p.isHost)
  const minPlayers = 4
  const activeCats =
    settings.categories.length > 0 ? settings.categories.length : WORD_CATEGORIES.length

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>

        {/* Header */}
        <View className="items-center mb-2">
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Room</Text>
          <Text className="text-2xl font-extrabold text-white">Waiting for players</Text>
          <Text className="text-neutral-500 text-sm mt-1">Share the code below to invite friends</Text>
        </View>

        {/* Room code */}
        <TouchableOpacity
          onPress={() => Alert.alert('Room Code', code ?? '', [{ text: 'OK' }])}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 items-center"
        >
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">Room Code</Text>
          <Text className="text-4xl font-black font-mono text-white tracking-[0.2em]">{code}</Text>
          <Text className="text-xs text-neutral-600 mt-2">Tap to copy</Text>
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
            <View className="items-center py-8">
              <View className="flex-row gap-2 mb-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <View
                    key={i}
                    className="w-8 h-8 rounded-full bg-neutral-800 border-2 border-dashed border-neutral-700"
                  />
                ))}
              </View>
              <Text className="text-neutral-500 text-sm">Waiting for players to join...</Text>
              <Text className="text-neutral-600 text-xs mt-1">Need at least {minPlayers} to start</Text>
            </View>
          ) : (
            <View className="gap-2">
              {players.map((p) => (
                <View
                  key={p.id}
                  className={[
                    'flex-row items-center gap-3 px-3 py-2.5 rounded-xl border',
                    p.userId === user?.id
                      ? 'border-violet-800 bg-violet-950/30'
                      : 'border-neutral-800 bg-neutral-800/30',
                  ].join(' ')}
                >
                  {/* Avatar placeholder */}
                  <View className="w-8 h-8 rounded-full bg-violet-700 items-center justify-center">
                    <Text className="text-white text-sm font-bold">
                      {p.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-white font-semibold text-sm">{p.username}</Text>
                      {p.isHost && (
                        <Text className="text-xs text-amber-400 font-bold">HOST</Text>
                      )}
                      {p.userId === user?.id && !p.isHost && (
                        <Text className="text-xs text-violet-400 font-bold">YOU</Text>
                      )}
                    </View>
                  </View>
                  <View
                    className={[
                      'px-2 py-0.5 rounded-full',
                      p.isReady || p.isHost ? 'bg-emerald-900' : 'bg-neutral-800',
                    ].join(' ')}
                  >
                    <Text
                      className={[
                        'text-xs font-semibold',
                        p.isReady || p.isHost ? 'text-emerald-400' : 'text-neutral-500',
                      ].join(' ')}
                    >
                      {p.isReady || p.isHost ? 'Ready' : 'Not Ready'}
                    </Text>
                  </View>
                </View>
              ))}
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
                  settings.gameMode === 'ranked' ? 'text-amber-400' : 'text-violet-400',
                ].join(' ')}
              >
                {settings.gameMode === 'ranked' ? '🏆 Ranked' : '🎮 Normal'}
              </Text>
              <Text className="text-neutral-700">·</Text>
              <Text className="text-neutral-500 text-xs">{activeCats} cats</Text>
              <Text className="text-neutral-500 text-xs">{showSettings ? '▴' : '▾'}</Text>
            </View>
          </TouchableOpacity>
        )}

        {isHost && showSettings && (
          <SettingsPanel settings={settings} onChange={handleSettingsChange} />
        )}

        {/* Settings summary (non-host) */}
        {!isHost && (
          <View className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800">
            <Text className="text-xs text-neutral-500">
              {settings.gameMode === 'ranked' ? '🏆' : '🎮'}
            </Text>
            <Text className="text-xs text-neutral-500 capitalize">{settings.gameMode}</Text>
            <Text className="text-neutral-700">·</Text>
            <Text className="text-xs text-neutral-500">{settings.maxPlayers} max</Text>
            <Text className="text-neutral-700">·</Text>
            <Text className="text-xs text-neutral-500">{settings.imposterCount} imposters</Text>
            {settings.gameMode === 'normal' && settings.categories.length > 0 && (
              <>
                <Text className="text-neutral-700">·</Text>
                <Text className="text-xs text-neutral-500">{settings.categories.length} categories</Text>
              </>
            )}
          </View>
        )}

        {/* Action buttons */}
        <View className="flex-row gap-3 mt-2">
          <TouchableOpacity
            onPress={handleLeave}
            className="px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 items-center justify-center"
            activeOpacity={0.8}
          >
            <Text className="text-neutral-300 font-semibold text-sm">← Leave</Text>
          </TouchableOpacity>

          {!isHost ? (
            <TouchableOpacity
              onPress={toggleReady}
              className={[
                'flex-1 py-3 rounded-xl items-center',
                isReady ? 'bg-emerald-600' : 'bg-neutral-800 border border-neutral-700',
              ].join(' ')}
              activeOpacity={0.8}
            >
              <Text
                className={[
                  'font-semibold text-sm',
                  isReady ? 'text-white' : 'text-neutral-300',
                ].join(' ')}
              >
                {isReady ? '✓ Ready' : 'Not Ready'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={startGame}
              disabled={!allReady}
              className={[
                'flex-1 py-3 rounded-xl items-center',
                allReady ? 'bg-violet-600' : 'bg-violet-900 opacity-40',
              ].join(' ')}
              activeOpacity={0.8}
            >
              <Text className="text-white font-bold text-sm">Start Game</Text>
            </TouchableOpacity>
          )}
        </View>

        {isHost && !allReady && players.length >= minPlayers && (
          <Text className="text-xs text-neutral-500 text-center">
            Waiting for all players to be ready
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
