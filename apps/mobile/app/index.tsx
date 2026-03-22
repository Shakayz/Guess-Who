import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'

export default function HomeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')

  return (
    <View className="flex-1 bg-neutral-950 items-center justify-center p-6">
      <View className="items-center mb-12">
        <Text className="text-6xl mb-4">🎭</Text>
        <Text className="text-3xl font-bold text-white">Imposter Game</Text>
        <Text className="text-neutral-400 mt-2">Social deduction, redefined</Text>
      </View>

      <View className="w-full max-w-sm gap-4">
        <TouchableOpacity
          className="bg-violet-600 py-4 rounded-2xl items-center"
          onPress={() => router.push('/create-room')}
        >
          <Text className="text-white font-bold text-lg">{t('room.createRoom')}</Text>
        </TouchableOpacity>

        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 bg-neutral-800 text-white px-4 py-3 rounded-xl font-mono uppercase tracking-widest border border-neutral-700"
            placeholder={t('room.enterCode')}
            placeholderTextColor="#737373"
            value={roomCode}
            onChangeText={(v) => setRoomCode(v.toUpperCase())}
            maxLength={8}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            className="bg-neutral-700 px-5 py-3 rounded-xl"
            onPress={() => roomCode.trim() && router.push(`/lobby/${roomCode.trim()}`)}
          >
            <Text className="text-white font-semibold">{t('room.joinRoom')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}
