import React, { useState, useEffect } from 'react'
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
import { getSocket, disconnectSocket } from '../../lib/socket'
import { RANK_CONFIG } from '@red-handed/shared'
import type { HonorType } from '@red-handed/shared'
import { useTranslation } from 'react-i18next'
import { useResponsive } from '../../lib/responsive'
import { HapticManager } from '../../lib/haptics'
import { SoundManager } from '../../lib/sounds'
import { CoinsRevealCard } from '../../components/CoinsRevealCard'

const HONOR_OPTIONS: { type: HonorType; label: string; icon: string }[] = [
  { type: 'teamplayer', label: 'Team Player', icon: '🤝' },
  { type: 'sharp_mind', label: 'Sharp Mind', icon: '🧠' },
  { type: 'good_sport', label: 'Good Sport', icon: '🎖️' },
]

const MOCK_PLAYERS = [
  { id: 'p1', userId: 'u1', username: 'Alice', role: 'villager' as const, isHost: false, isReady: true, status: 'alive' as const, avatarUrl: null, honorGiven: false },
  { id: 'p2', userId: 'u2', username: 'Bob', role: 'red_handed' as const, isHost: false, isReady: true, status: 'eliminated' as const, avatarUrl: null, honorGiven: false },
  { id: 'p3', userId: 'u3', username: 'Charlie', role: 'villager' as const, isHost: false, isReady: true, status: 'alive' as const, avatarUrl: null, honorGiven: false },
  { id: 'p4', userId: 'u4', username: 'Diana', role: 'villager' as const, isHost: false, isReady: true, status: 'alive' as const, avatarUrl: null, honorGiven: false },
]

export default function ResultsScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { result, room, myRole, reset } = useGameStore()
  const { t } = useTranslation()

  const [honorGiven, setHonorGiven] = useState<Record<string, HonorType>>({})
  const [honorTarget, setHonorTarget] = useState<string | null>(null)
  const { isTablet, px, fontScale } = useResponsive()
  const contentStyle = isTablet ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const } : {}

  const winner = result?.winner ?? 'villagers'
  const rewards = result?.rewards ?? { starCoinsEarned: 0, xpEarned: 120, lpChange: 18, achievements: [], levelUpCoinsEarned: 0 }
  const players = room?.players?.length ? room.players : MOCK_PLAYERS
  const isRedHanded = myRole === 'red_handed' || myRole === 'double_agent'
  const didWin = (winner === 'villagers' && !isRedHanded) || (winner === 'red_handed' && isRedHanded)

  useEffect(() => {
    SoundManager.play(didWin ? 'success' : 'error')
    if (didWin) {
      HapticManager.success()
    } else {
      HapticManager.error()
    }
  }, [])

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
        contentContainerStyle={{ padding: px, gap: isTablet ? 16 : 12, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={contentStyle}>

        {/* Outcome hero */}
        <View
          className={[
            'rounded-2xl border-2 relative overflow-hidden items-center',
            didWin ? 'border-emerald-600/70' : 'border-red-700/70',
          ].join(' ')}
          style={{ paddingVertical: isTablet ? 52 : 40 }}
        >
          {/* Background tint */}
          <View
            className={['absolute inset-0', didWin ? 'bg-emerald-950' : 'bg-red-950'].join(' ')}
            style={{ opacity: 0.35 }}
          />
          {/* Top accent bar */}
          <View
            className={[
              'absolute top-0 left-0 right-0 h-1',
              didWin ? 'bg-emerald-500' : 'bg-red-500',
            ].join(' ')}
          />
          {/* Bottom fade */}
          <View
            className="absolute bottom-0 left-0 right-0 h-16"
            style={{ backgroundColor: didWin ? 'rgba(5,46,22,0.3)' : 'rgba(69,10,10,0.3)' }}
          />

          <Text style={{ fontSize: isTablet ? 80 : 64, marginBottom: 14 }}>{didWin ? '🏆' : '💀'}</Text>

          {/* WIN / LOSS badge */}
          <View
            className={[
              'flex-row items-center gap-2 px-5 py-2 rounded-full border mb-3',
              didWin
                ? 'bg-emerald-900/60 border-emerald-600/60'
                : 'bg-red-900/60 border-red-600/60',
            ].join(' ')}
          >
            <Text
              className={[
                'font-extrabold tracking-widest uppercase',
                didWin ? 'text-emerald-300' : 'text-red-300',
              ].join(' ')}
              style={{ fontSize: isTablet ? 22 : 18, letterSpacing: 4 }}
            >
              {didWin ? 'Victory' : 'Defeat'}
            </Text>
          </View>

          <Text
            className={['font-semibold text-center px-6', didWin ? 'text-emerald-500' : 'text-red-500'].join(' ')}
            style={{ fontSize: 13 * fontScale }}
          >
            {winner === 'villagers'
              ? 'Villagers found the imposter'
              : 'Imposters escaped detection'}
          </Text>

          {/* Role indicator */}
          <View className="flex-row items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full bg-black/20 border border-white/10">
            <Text style={{ fontSize: 12 }}>
              {isRedHanded ? '🎭' : '🏘️'}
            </Text>
            <Text className="text-neutral-400 text-xs font-semibold">
              You played as {isRedHanded ? 'Imposter' : 'Villager'}
            </Text>
          </View>
        </View>

        {/* Rewards */}
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 overflow-hidden">
          <View className="absolute top-0 left-0 right-0 h-0.5 bg-amber-700/50" />
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
            Rewards Earned
          </Text>

          {/* Hero: modern "coins won" reveal card */}
          <CoinsRevealCard
            levelUpEarned={rewards.levelUpCoinsEarned ?? 0}
            dailyBonus={rewards.dailyBonusEarned ?? 0}
            streakBonus={rewards.streakBonusEarned ?? 0}
            gameCost={rewards.gameCostPaid ?? 0}
            newStreakCount={rewards.newStreakCount ?? 0}
          />

          {/* XP / LP secondary chips (coins live in the hero card above) */}
          <View className="flex-row gap-2 mt-3">
            <View className="flex-1 items-center gap-1.5 py-4 px-2 rounded-2xl bg-violet-950/30 border border-violet-800/40">
              <Text style={{ fontSize: 22 }}>⚡</Text>
              <Text className="text-lg font-extrabold text-violet-300">+{rewards.xpEarned}</Text>
              <Text className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">XP</Text>
            </View>
            <View
              className={[
                'flex-1 items-center gap-1.5 py-4 px-2 rounded-2xl border',
                rewards.lpChange >= 0
                  ? 'bg-emerald-950/40 border-emerald-700/50'
                  : 'bg-red-950/40 border-red-700/50',
              ].join(' ')}
            >
              <Text style={{ fontSize: 22 }}>📊</Text>
              <Text
                className={[
                  'text-lg font-extrabold',
                  rewards.lpChange >= 0 ? 'text-emerald-300' : 'text-red-300',
                ].join(' ')}
              >
                {rewards.lpChange >= 0 ? '+' : ''}{rewards.lpChange}
              </Text>
              <Text className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">LP</Text>
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
        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 overflow-hidden">
          <View className="absolute top-0 left-0 right-0 h-0.5 bg-violet-800/50" />
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
            Player Roles
          </Text>
          <View className="gap-2">
            {players.map((p) => {
              const role = (p as any).role as string | undefined
              const isRedHandedRole = role === 'red_handed' || role === 'double_agent'
              const survived = p.status === 'alive'
              const isMe = p.userId === user?.id
              return (
                <View
                  key={p.id}
                  className={[
                    'flex-row items-center gap-3 px-3 py-3 rounded-xl border overflow-hidden',
                    isMe && isRedHandedRole
                      ? 'border-red-700/50 bg-red-950/20'
                      : isMe
                      ? 'border-violet-700/50 bg-violet-950/20'
                      : isRedHandedRole
                      ? 'border-red-900/30 bg-red-950/10'
                      : 'border-neutral-800/60 bg-neutral-800/20',
                  ].join(' ')}
                >
                  {/* Left accent for redHanded */}
                  {isRedHandedRole && (
                    <View className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-600/60" />
                  )}
                  {/* Avatar */}
                  <View
                    className={[
                      'rounded-full items-center justify-center',
                      isRedHandedRole ? 'bg-red-800/60' : isMe ? 'bg-violet-700' : 'bg-neutral-700',
                    ].join(' ')}
                    style={{ width: 34, height: 34 }}
                  >
                    <Text className="text-white text-sm font-bold">
                      {p.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5 flex-wrap">
                      <Text className="font-semibold text-white text-sm">{p.username}</Text>
                      {isMe && (
                        <View className="px-1.5 py-0.5 rounded bg-violet-900/60 border border-violet-700/40">
                          <Text className="text-[9px] text-violet-400 font-bold">YOU</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center gap-1.5 mt-0.5">
                      {/* Role badge */}
                      <View
                        className={[
                          'flex-row items-center gap-1 px-2 py-0.5 rounded-full border',
                          isRedHandedRole
                            ? 'bg-red-950/60 border-red-800/60'
                            : role === 'detective'
                            ? 'bg-sky-950/60 border-sky-800/60'
                            : 'bg-violet-950/60 border-violet-800/60',
                        ].join(' ')}
                      >
                        <Text style={{ fontSize: 10 }}>
                          {role === 'red_handed' ? '🎭' : role === 'double_agent' ? '🕵️' : role === 'detective' ? '🔍' : '🏘️'}
                        </Text>
                        <Text
                          className={[
                            'text-[10px] font-bold',
                            isRedHandedRole ? 'text-red-400' : role === 'detective' ? 'text-sky-400' : 'text-violet-400',
                          ].join(' ')}
                        >
                          {role === 'red_handed' ? 'Imposter' : role === 'double_agent' ? 'Double Agent' : role === 'detective' ? 'Detective' : 'Villager'}
                        </Text>
                      </View>
                      {/* Survived status */}
                      <View
                        className={[
                          'flex-row items-center gap-0.5 px-1.5 py-0.5 rounded-full',
                          survived ? 'bg-emerald-950/50' : 'bg-neutral-900/50',
                        ].join(' ')}
                      >
                        <Text style={{ fontSize: 8 }}>{survived ? '✓' : '☠'}</Text>
                        <Text
                          className={['text-[9px] font-semibold', survived ? 'text-emerald-500' : 'text-neutral-600'].join(' ')}
                        >
                          {survived ? 'Survived' : 'Eliminated'}
                        </Text>
                      </View>
                    </View>
                  </View>
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
            className="flex-1 rounded-2xl items-center overflow-hidden bg-violet-600"
            activeOpacity={0.8}
            style={{ paddingVertical: isTablet ? 18 : 15 }}
          >
            {/* Shine overlay */}
            <View className="absolute top-0 left-0 right-0 h-1/2 rounded-t-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />
            <Text className="text-white font-extrabold tracking-wide" style={{ fontSize: 16 * fontScale }}>Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/')}
            className="px-6 rounded-2xl bg-neutral-800 border border-neutral-700 items-center justify-center"
            activeOpacity={0.8}
            style={{ paddingVertical: isTablet ? 18 : 15 }}
          >
            <Text className="text-neutral-300 font-semibold" style={{ fontSize: 14 * fontScale }}>Home</Text>
          </TouchableOpacity>
        </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
