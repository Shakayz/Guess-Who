import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
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
import { WORD_CATEGORIES } from '@imposter/shared'
import type { Room, GameMode, WordCategory } from '@imposter/shared'
import { useResponsive } from '../../lib/responsive'

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
  maxRounds: number
  gameMode: GameMode | 'special'
  categories: WordCategory[]
  hasDetective: boolean
  hasDoubleAgent: boolean
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
              onPress={() =>
                onChange({
                  ...settings,
                  gameMode: mode,
                  categories: mode === 'ranked' ? [] : settings.categories,
                  // Reset special roles when leaving special mode
                  hasDetective: mode === 'special' ? settings.hasDetective : false,
                  hasDoubleAgent: mode === 'special' ? settings.hasDoubleAgent : false,
                })
              }
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
      {settings.gameMode === 'special' && (
        <View className="gap-3 pt-2 border-t border-neutral-800">
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Special Roles
          </Text>

          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-sm text-neutral-300">🔍 Detective</Text>
              <Text className="text-xs text-neutral-600">Can reveal one player's role per game</Text>
            </View>
            <Switch
              value={settings.hasDetective}
              onValueChange={(v) => onChange({ ...settings, hasDetective: v })}
              trackColor={{ false: '#404040', true: '#0e7490' }}
              thumbColor={settings.hasDetective ? '#22d3ee' : '#a3a3a3'}
            />
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-sm text-neutral-300">🕵️ Double Agent</Text>
              <Text className="text-xs text-neutral-600">Knows the imposters but plays as villager</Text>
            </View>
            <Switch
              value={settings.hasDoubleAgent}
              onValueChange={(v) => onChange({ ...settings, hasDoubleAgent: v })}
              trackColor={{ false: '#404040', true: '#0e7490' }}
              thumbColor={settings.hasDoubleAgent ? '#22d3ee' : '#a3a3a3'}
            />
          </View>
        </View>
      )}

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
  hasDetective: false,
  hasDoubleAgent: false,
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

  // Friends invite state
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [showFriends, setShowFriends] = useState(false)

  // ─── Settings change ────────────────────────────────────────────────────

  const handleSettingsChange = (s: Settings) => {
    setSettings(s)
    getSocket().emit('room:settings' as any, {
      gameMode: s.gameMode,
      categories: s.categories,
      maxPlayers: s.maxPlayers,
      imposterCount: s.imposterCount,
      speakingTimeSeconds: s.speakingTimeSeconds,
      votingTimeSeconds: s.votingTimeSeconds,
      maxRounds: s.maxRounds,
      hasDetective: s.hasDetective,
      hasDoubleAgent: s.hasDoubleAgent,
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
    } catch (err) {
      console.error('[lobby] failed to fetch friends:', err)
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
          maxRounds: (r.settings as any).maxRounds ?? 0,
          gameMode: (r.settings as any).gameMode ?? 'normal',
          categories: (r.settings as any).categories ?? [],
          hasDetective: (r.settings as any).hasDetective ?? false,
          hasDoubleAgent: (r.settings as any).hasDoubleAgent ?? false,
        }))
      }
    })

    socket.on('game:started', ({ round, yourWord, yourRole }) => {
      setRoleAndWord(yourRole, yourWord)
      setRound(round as any)
      router.replace(`/game/${code}`)
    })

    // Matchmaking events
    socket.on('matchmaking:found' as any, (data: any) => {
      console.log('[lobby] matchmaking found:', data)
    })
    socket.on('matchmaking:cancelled' as any, () => {
      console.log('[lobby] matchmaking cancelled')
    })

    socket.on('error', (err) => console.error('[socket error]', err))

    return () => {
      socket.off('room:updated')
      socket.off('game:started')
      socket.off('matchmaking:found' as any)
      socket.off('matchmaking:cancelled' as any)
      socket.off('error')
    }
  }, [code])

  // ─── Actions ───────────────────────────────────────────────────────────

  const toggleReady = () => {
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
  const minPlayers = 4
  const activeCats =
    settings.categories.length > 0 ? settings.categories.length : WORD_CATEGORIES.length

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
            {settings.gameMode === 'special' && settings.hasDetective && (
              <>
                <Text className="text-neutral-700">·</Text>
                <Text className="text-xs text-cyan-500">🔍 Detective</Text>
              </>
            )}
            {settings.gameMode === 'special' && settings.hasDoubleAgent && (
              <>
                <Text className="text-neutral-700">·</Text>
                <Text className="text-xs text-cyan-500">🕵️ Double Agent</Text>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
