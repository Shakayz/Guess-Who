import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useGameStore } from '../../store/game'
import { useAuthStore } from '../../store/auth'
import { getSocket } from '../../lib/socket'
import { RANK_CONFIG } from '@imposter/shared'
import type { HonorType } from '@imposter/shared'

const HONOR_OPTIONS: { type: HonorType; label: string; icon: string }[] = [
  { type: 'teamplayer', label: 'Team Player', icon: '🤝' },
  { type: 'sharp_mind', label: 'Sharp Mind', icon: '🧠' },
  { type: 'good_sport', label: 'Good Sport', icon: '🎖️' },
]

const MOCK_PLAYERS = [
  { id: 'p1', userId: 'u1', username: 'Alice', role: 'villager' as const, isHost: false, isReady: true, status: 'alive' as const, avatarUrl: null, honorGiven: false },
  { id: 'p2', userId: 'u2', username: 'Bob', role: 'imposter' as const, isHost: false, isReady: true, status: 'eliminated' as const, avatarUrl: null, honorGiven: false },
  { id: 'p3', userId: 'u3', username: 'Charlie', role: 'villager' as const, isHost: false, isReady: true, status: 'alive' as const, avatarUrl: null, honorGiven: false },
  { id: 'p4', userId: 'u4', username: 'Diana', role: 'villager' as const, isHost: false, isReady: true, status: 'alive' as const, avatarUrl: null, honorGiven: false },
]

export default function ResultsScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { result, room, myRole, reset } = useGameStore()

  const [honorGiven, setHonorGiven] = useState<Record<string, HonorType>>({})
  const [honorTarget, setHonorTarget] = useState<string | null>(null)

  const winner = result?.winner ?? 'villagers'
  const rewards = result?.rewards ?? { starCoinsEarned: 25, xpEarned: 120, lpChange: 18, achievements: [] }
  const players = room?.players?.length ? room.players : MOCK_PLAYERS
  const isImposter = myRole === 'imposter' || myRole === 'double_agent'
  const didWin = (winner === 'villagers' && !isImposter) || (winner === 'imposters' && isImposter)

  const handleHonor = (targetUserId: string, honorType: HonorType) => {
    setHonorGiven((prev) => ({ ...prev, [targetUserId]: honorType }))
    setHonorTarget(null)
    getSocket().emit('honor:give', { targetPlayerId: targetUserId, honorType })
  }

  const handlePlayAgain = () => {
    reset()
    router.replace('/')
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >

        {/* Outcome hero */}
        <View
          className={[
            'rounded-2xl border relative overflow-hidden py-10 items-center',
            didWin ? 'border-emerald-700' : 'border-red-800',
          ].join(' ')}
        >
          {/* Background gradient overlay */}
          <View
            className={[
              'absolute inset-0 opacity-10',
              didWin ? 'bg-emerald-500' : 'bg-red-600',
            ].join(' ')}
          />
          {/* Top accent */}
          <View
            className={[
              'absolute top-0 left-0 right-0 h-0.5',
              didWin ? 'bg-emerald-500' : 'bg-red-500',
            ].join(' ')}
            style={{ opacity: 0.7 }}
          />
          <Text className="text-6xl mb-3">{didWin ? '🏆' : '💀'}</Text>
          <Text
            className={[
              'text-3xl font-extrabold tracking-tight mb-1',
              didWin ? 'text-emerald-400' : 'text-red-400',
            ].join(' ')}
          >
            {didWin ? 'Victory!' : 'Defeat'}
          </Text>
          <Text className="text-neutral-400 text-sm text-center px-4">
            {winner === 'villagers'
              ? 'Villagers found the imposters'
              : 'Imposters escaped detection'}
          </Text>
        </View>

        {/* Rewards */}
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
            Rewards Earned
          </Text>
          <View className="flex-row gap-3">
            {/* Star Coins */}
            <View className="flex-1 items-center gap-1 p-3 rounded-xl bg-neutral-800 border border-neutral-700">
              <Text className="text-xl">⭐</Text>
              <Text className="text-lg font-bold text-white">+{rewards.starCoinsEarned}</Text>
              <Text className="text-xs text-neutral-500">Star Coins</Text>
            </View>
            {/* XP */}
            <View className="flex-1 items-center gap-1 p-3 rounded-xl bg-neutral-800 border border-neutral-700">
              <Text className="text-xl">⚡</Text>
              <Text className="text-lg font-bold text-white">+{rewards.xpEarned}</Text>
              <Text className="text-xs text-neutral-500">XP</Text>
            </View>
            {/* LP */}
            <View
              className={[
                'flex-1 items-center gap-1 p-3 rounded-xl border',
                rewards.lpChange >= 0
                  ? 'bg-emerald-950 border-emerald-800'
                  : 'bg-red-950 border-red-800',
              ].join(' ')}
            >
              <Text className="text-xl">📊</Text>
              <Text
                className={[
                  'text-lg font-bold',
                  rewards.lpChange >= 0 ? 'text-emerald-400' : 'text-red-400',
                ].join(' ')}
              >
                {rewards.lpChange >= 0 ? '+' : ''}{rewards.lpChange}
              </Text>
              <Text className="text-xs text-neutral-500">LP</Text>
            </View>
          </View>

          {/* Achievements */}
          {rewards.achievements.length > 0 && (
            <View className="mt-3 pt-3 border-t border-neutral-800">
              <Text className="text-xs text-neutral-500 mb-2">Achievements Unlocked</Text>
              <View className="flex-row flex-wrap gap-2">
                {rewards.achievements.map((a) => (
                  <View
                    key={a.id}
                    className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-950 border border-violet-800"
                  >
                    <Text className="text-xs font-semibold text-violet-400">🏅 {a.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Player role reveal */}
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
            Player Roles
          </Text>
          <View className="gap-2">
            {players.map((p) => {
              const role = (p as any).role as string | undefined
              const survived = p.status === 'alive'
              const isMe = p.userId === user?.id
              return (
                <View
                  key={p.id}
                  className={[
                    'flex-row items-center gap-3 px-3 py-2.5 rounded-xl border',
                    isMe
                      ? 'border-violet-800 bg-violet-950/30'
                      : 'border-neutral-800 bg-neutral-900/40',
                  ].join(' ')}
                >
                  {/* Avatar */}
                  <View className="w-8 h-8 rounded-full bg-violet-700 items-center justify-center">
                    <Text className="text-white text-sm font-bold">
                      {p.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="font-semibold text-white text-sm">{p.username}</Text>
                      {isMe && (
                        <Text className="text-xs text-violet-400 font-bold">YOU</Text>
                      )}
                    </View>
                  </View>
                  {/* Role badge */}
                  <View
                    className={[
                      'px-2 py-0.5 rounded-full border',
                      role === 'imposter' || role === 'double_agent'
                        ? 'bg-red-950 border-red-800'
                        : 'bg-violet-950 border-violet-800',
                    ].join(' ')}
                  >
                    <Text
                      className={[
                        'text-xs font-semibold',
                        role === 'imposter' || role === 'double_agent'
                          ? 'text-red-400'
                          : 'text-violet-400',
                      ].join(' ')}
                    >
                      {role === 'imposter'
                        ? '🎭 Imposter'
                        : role === 'double_agent'
                        ? '🕵️ Double Agent'
                        : '🏘️ Villager'}
                    </Text>
                  </View>
                  {/* Survived badge */}
                  <Text
                    className={[
                      'text-xs ml-1',
                      survived ? 'text-emerald-500' : 'text-neutral-600',
                    ].join(' ')}
                  >
                    {survived ? 'Survived' : 'Eliminated'}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Give honor */}
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
            Give Honor
          </Text>
          <View className="gap-3">
            {players
              .filter((p) => p.userId !== user?.id)
              .map((p) => (
                <View key={p.id} className="flex-row items-center gap-3">
                  <View className="w-7 h-7 rounded-full bg-neutral-700 items-center justify-center">
                    <Text className="text-white text-xs font-bold">
                      {p.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text className="flex-1 text-sm text-white font-medium">{p.username}</Text>

                  {honorGiven[p.userId] ? (
                    <Text className="text-xs text-emerald-400 font-semibold">
                      {HONOR_OPTIONS.find((h) => h.type === honorGiven[p.userId])?.icon}{' '}
                      {HONOR_OPTIONS.find((h) => h.type === honorGiven[p.userId])?.label}
                    </Text>
                  ) : honorTarget === p.userId ? (
                    <View className="flex-row gap-1.5">
                      {HONOR_OPTIONS.map((h) => (
                        <TouchableOpacity
                          key={h.type}
                          onPress={() => handleHonor(p.userId, h.type)}
                          className="w-9 h-9 rounded-lg bg-neutral-800 items-center justify-center"
                        >
                          <Text className="text-lg">{h.icon}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        onPress={() => setHonorTarget(null)}
                        className="w-9 h-9 rounded-lg bg-neutral-800 items-center justify-center"
                      >
                        <Text className="text-neutral-500 text-sm">✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setHonorTarget(p.userId)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800"
                    >
                      <Text className="text-xs text-neutral-400 font-medium">+ Honor</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
          </View>
        </View>

        {/* Action buttons */}
        <View className="flex-row gap-3 pt-2">
          <TouchableOpacity
            onPress={handlePlayAgain}
            className="flex-1 py-3.5 rounded-xl bg-violet-600 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold text-base">Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/')}
            className="px-5 py-3.5 rounded-xl bg-neutral-800 border border-neutral-700 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-neutral-300 font-semibold text-sm">Home</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}
