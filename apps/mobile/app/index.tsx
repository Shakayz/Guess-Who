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

const HOW_TO_PLAY = [
  { icon: '🎭', title: 'Get your role', desc: 'Villager or Imposter — each gets a different word.' },
  { icon: '💬', title: 'Give clues', desc: "One sentence per round. Don't say the word!" },
  { icon: '🗳️', title: 'Vote', desc: 'Discuss and vote out who you think is the imposter.' },
  { icon: '🏆', title: 'Win', desc: 'Villagers win if all imposters are eliminated.' },
]

export default function HomeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()

  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState<'create' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setLoading('create')
    setError(null)
    try {
      const room = await api.post<{ code: string }>('/rooms', {})
      router.push(`/lobby/${room.code}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(null)
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
        <View className="items-center px-6 pt-12 pb-8">
          {/* Badge */}
          <View className="flex-row items-center gap-2 px-3 py-1.5 rounded-full border border-violet-700/40 bg-violet-900/20 mb-6">
            <View className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            <Text className="text-violet-400 text-xs font-semibold">Social Deduction · Real-time · Multiplayer</Text>
          </View>

          {/* Title */}
          <Text className="text-5xl font-extrabold text-white text-center leading-tight tracking-tight mb-2">
            Play the{'\n'}
            <Text className="text-violet-500">Imposter</Text> Game
          </Text>
          <Text className="text-neutral-400 text-lg mt-2 text-center">Deceive. Detect. Dominate.</Text>
        </View>

        {/* Actions */}
        <View className="px-6 gap-4">

          {/* Create Room */}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading === 'create'}
            className={[
              'py-4 rounded-2xl items-center',
              loading === 'create' ? 'bg-violet-800 opacity-70' : 'bg-violet-600',
            ].join(' ')}
            activeOpacity={0.8}
          >
            {loading === 'create' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-lg">+ {t('room.createRoom')}</Text>
            )}
          </TouchableOpacity>

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

          {/* Error */}
          {error && (
            <View className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-red-950 border border-red-800">
              <Text className="text-red-400 text-sm">⚠ {error}</Text>
            </View>
          )}
        </View>

        {/* How to Play */}
        <View className="mt-16 px-6">
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
