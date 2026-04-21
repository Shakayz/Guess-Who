import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { useResponsive } from '../../lib/responsive'
import { WORD_CATEGORIES } from '@red-handed/shared'
import type { WordCategory } from '@red-handed/shared'
import { useGameStore } from '../../store/game'

type PublicLobby = {
  code: string
  host: { id: string; username: string }
  playerCount: number
  maxPlayers: number
  gameMode: 'normal' | 'special' | 'ranked'
  categories: WordCategory[]
  vocalMode: boolean
  language: string
  createdAt: string
}

const CATEGORY_ICON: Record<string, string> = Object.fromEntries(
  WORD_CATEGORIES.map((c) => [c.key, c.icon]),
)

export default function PublicLobbiesScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { isTablet, px, fontScale } = useResponsive()
  const activeRoom = useGameStore((s) => s.room)
  const isBlockedFromNewGame = !!(activeRoom && (
    activeRoom.status === 'in_progress' || activeRoom.status === 'voting'
  ))

  const [lobbies, setLobbies] = useState<PublicLobby[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLobbies = useCallback(async () => {
    setError(null)
    try {
      const data = await api.get<{ lobbies: PublicLobby[] }>('/rooms/public')
      setLobbies(data.lobbies)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load lobbies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLobbies()
    // Match web: 8 s polling keeps player counts fresh without spamming the API.
    const id = setInterval(fetchLobbies, 8000)
    return () => clearInterval(id)
  }, [fetchLobbies])

  const join = (code: string) => {
    if (isBlockedFromNewGame) return
    router.push(`/lobby/${code}`)
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-950">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: px, paddingTop: 16, gap: 16 }}>

          {/* Header */}
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text className="text-neutral-400" style={{ fontSize: 14 * fontScale }}>← {t('common.back', 'Back')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={fetchLobbies}
              className="h-9 px-3 rounded-xl bg-neutral-800 border border-neutral-700 items-center justify-center"
              activeOpacity={0.8}
            >
              <Text className="text-neutral-300 font-semibold" style={{ fontSize: 12 * fontScale }}>
                ↻ {t('publicLobbies.refresh')}
              </Text>
            </TouchableOpacity>
          </View>

          <View>
            <Text className="text-white font-extrabold" style={{ fontSize: 26 * fontScale }}>
              🔍 {t('publicLobbies.title')}
            </Text>
            <Text className="text-neutral-400 mt-1" style={{ fontSize: 13 * fontScale }}>
              {t('publicLobbies.subtitle')}
            </Text>
          </View>

          {error && (
            <View className="flex-row items-center gap-2 p-3 rounded-xl bg-red-950/50 border border-red-800/50">
              <Text className="text-red-400">⚠</Text>
              <Text className="text-red-400 flex-1" style={{ fontSize: 13 * fontScale }}>{error}</Text>
            </View>
          )}

          {loading && lobbies.length === 0 && (
            <View className="py-16 items-center gap-3">
              <ActivityIndicator color="#818cf8" />
              <Text className="text-neutral-500" style={{ fontSize: 13 * fontScale }}>
                {t('publicLobbies.loading')}
              </Text>
            </View>
          )}

          {!loading && lobbies.length === 0 && (
            <View className="py-16 items-center gap-3 px-6">
              <Text style={{ fontSize: 48 }}>🫥</Text>
              <Text className="text-white font-semibold" style={{ fontSize: 15 * fontScale }}>
                {t('publicLobbies.emptyTitle')}
              </Text>
              <Text className="text-neutral-500 text-center" style={{ fontSize: 12 * fontScale }}>
                {t('publicLobbies.emptyDesc')}
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/')}
                className="mt-2 h-10 px-4 rounded-xl bg-indigo-600 items-center justify-center"
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold" style={{ fontSize: 13 * fontScale }}>
                  {t('publicLobbies.createOne')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ gap: 10 }}>
            {lobbies.map((lobby) => {
              const isFull = lobby.playerCount >= lobby.maxPlayers
              const cats = lobby.categories.length === 0 ? null : lobby.categories.slice(0, 4)
              return (
                <TouchableOpacity
                  key={lobby.code}
                  onPress={() => join(lobby.code)}
                  disabled={isFull || isBlockedFromNewGame}
                  activeOpacity={0.8}
                  className={[
                    'rounded-2xl border p-4',
                    isFull
                      ? 'border-neutral-800/60 bg-neutral-900/40 opacity-60'
                      : 'border-neutral-800 bg-neutral-900',
                  ].join(' ')}
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <Text className="text-neutral-500 font-mono" style={{ fontSize: 11 * fontScale }}>
                          {lobby.code}
                        </Text>
                        <Text className="text-white font-bold" style={{ fontSize: 13 * fontScale }} numberOfLines={1}>
                          {t('publicLobbies.hostedBy', { name: lobby.host.username })}
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-1.5 mt-1.5 flex-wrap">
                        {lobby.gameMode === 'special' && (
                          <View className="px-1.5 py-0.5 rounded bg-purple-900/50 border border-purple-800/40">
                            <Text className="text-purple-300 font-bold uppercase" style={{ fontSize: 9 * fontScale }}>
                              {t('home.specialGameMode')}
                            </Text>
                          </View>
                        )}
                        <View className="px-1.5 py-0.5 rounded bg-neutral-800/80 border border-neutral-700/60 flex-row items-center gap-1">
                          <Text style={{ fontSize: 10 * fontScale }}>{lobby.vocalMode ? '🎙️' : '⌨️'}</Text>
                          <Text className="text-neutral-300 font-bold uppercase" style={{ fontSize: 9 * fontScale }}>
                            {lobby.vocalMode ? t('publicLobbies.audio') : t('publicLobbies.typing')}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center gap-1.5 mt-2 flex-wrap">
                        {cats === null && (
                          <Text className="text-neutral-500 italic" style={{ fontSize: 11 * fontScale }}>
                            {t('publicLobbies.allCategories')}
                          </Text>
                        )}
                        {cats !== null && cats.map((c) => (
                          <View key={c} className="px-2 py-0.5 rounded-full bg-neutral-800/70 border border-neutral-700/60 flex-row items-center gap-1">
                            <Text style={{ fontSize: 10 * fontScale }}>{CATEGORY_ICON[c] ?? '🏷️'}</Text>
                            <Text className="text-neutral-300" style={{ fontSize: 10 * fontScale }}>
                              {t(`home.cat.${c}`, c)}
                            </Text>
                          </View>
                        ))}
                        {lobby.categories.length > 4 && (
                          <Text className="text-neutral-500" style={{ fontSize: 10 * fontScale }}>
                            +{lobby.categories.length - 4}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View className="items-end">
                      <Text
                        className={['font-mono font-bold', isFull ? 'text-red-400' : 'text-indigo-300'].join(' ')}
                        style={{ fontSize: 16 * fontScale }}
                      >
                        {lobby.playerCount}/{lobby.maxPlayers}
                      </Text>
                      <Text
                        className={['font-semibold uppercase mt-0.5', isFull ? 'text-red-500' : 'text-indigo-400'].join(' ')}
                        style={{ fontSize: 10 * fontScale }}
                      >
                        {isFull ? t('publicLobbies.full') : `${t('publicLobbies.join')} →`}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>

          {isBlockedFromNewGame && (
            <Text className="text-amber-500 text-center" style={{ fontSize: 12 * fontScale }}>
              {t('publicLobbies.blockedByActiveGame')}
            </Text>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
