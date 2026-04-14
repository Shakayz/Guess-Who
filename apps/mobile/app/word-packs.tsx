import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useResponsive } from '../lib/responsive'
import { HapticManager } from '../lib/haptics'
import { api } from '../lib/api'

// Mobile mirror of the web WordPacksPage — browse + my-packs. Creating
// and editing packs is a web-only flow today; the list views use the
// same /word-packs and /word-packs/my endpoints for perfect parity.

interface WordPack {
  id: string
  name: string
  description?: string
  locale: string
  isPublic: boolean
  isApproved: boolean
  authorId: string | null
  downloads: number
  _count?: { pairs: number }
}

type Tab = 'browse' | 'mine'

export default function WordPacksScreen() {
  const router = useRouter()
  const { px, fontScale } = useResponsive()
  const [tab, setTab] = useState<Tab>('browse')
  const [packs, setPacks] = useState<WordPack[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(next: Tab) {
    setLoading(true)
    setError(null)
    try {
      const path = next === 'browse' ? '/word-packs' : '/word-packs/my'
      const data = await api.get<WordPack[]>(path)
      setPacks(data)
    } catch (err) {
      setPacks([])
      setError(err instanceof Error ? err.message : 'Failed to load word packs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(tab)
  }, [tab])

  const switchTab = (next: Tab) => {
    HapticManager.selection()
    setTab(next)
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-neutral-950">
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-900">
        <TouchableOpacity onPress={() => router.back()} className="pr-3">
          <Text className="text-neutral-400" style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold flex-1" style={{ fontSize: 16 * fontScale }}>
          Word Packs
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: px, paddingVertical: 20, paddingBottom: 48, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className="text-white font-extrabold" style={{ fontSize: 22 * fontScale }}>
            📦 Word Packs
          </Text>
          <Text className="text-neutral-500 mt-1" style={{ fontSize: 12 * fontScale }}>
            Browse community packs or review your own
          </Text>
        </View>

        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => switchTab('browse')}
            className={[
              'px-4 py-1.5 rounded-lg',
              tab === 'browse' ? 'bg-violet-600' : 'bg-neutral-900 border border-neutral-800',
            ].join(' ')}
            activeOpacity={0.8}
          >
            <Text
              className={tab === 'browse' ? 'text-white font-semibold' : 'text-neutral-400 font-semibold'}
              style={{ fontSize: 12 * fontScale }}
            >
              🌐 Browse
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => switchTab('mine')}
            className={[
              'px-4 py-1.5 rounded-lg',
              tab === 'mine' ? 'bg-violet-600' : 'bg-neutral-900 border border-neutral-800',
            ].join(' ')}
            activeOpacity={0.8}
          >
            <Text
              className={tab === 'mine' ? 'text-white font-semibold' : 'text-neutral-400 font-semibold'}
              style={{ fontSize: 12 * fontScale }}
            >
              📁 My Packs
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator color="#a78bfa" />
          </View>
        ) : error ? (
          <View className="rounded-2xl border border-red-800/40 bg-red-950/30 p-4">
            <Text className="text-red-400 font-semibold" style={{ fontSize: 12 * fontScale }}>
              {error}
            </Text>
          </View>
        ) : !packs || packs.length === 0 ? (
          <View className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 items-center gap-2">
            <Text style={{ fontSize: 28 }}>📭</Text>
            <Text className="text-white font-semibold text-center" style={{ fontSize: 14 * fontScale }}>
              No word packs to show
            </Text>
            <Text className="text-neutral-500 text-center" style={{ fontSize: 12 * fontScale, lineHeight: 18 * fontScale }}>
              {tab === 'browse'
                ? 'No community packs are available right now.'
                : "You haven't created any word packs yet. Head to the web to build one."}
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {packs.map((pack) => (
              <View key={pack.id} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white font-bold flex-1" style={{ fontSize: 14 * fontScale }} numberOfLines={1}>
                    {pack.name}
                  </Text>
                  <View className="px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700">
                    <Text className="text-neutral-400 font-bold uppercase" style={{ fontSize: 9 }}>
                      {pack.locale}
                    </Text>
                  </View>
                </View>
                {pack.description ? (
                  <Text className="text-neutral-500" style={{ fontSize: 12 * fontScale, lineHeight: 18 * fontScale }}>
                    {pack.description}
                  </Text>
                ) : null}
                <View className="flex-row gap-3 mt-1">
                  <Text className="text-neutral-400" style={{ fontSize: 11 * fontScale }}>
                    📚 {pack._count?.pairs ?? 0} pairs
                  </Text>
                  <Text className="text-neutral-400" style={{ fontSize: 11 * fontScale }}>
                    ⬇️ {pack.downloads}
                  </Text>
                  {pack.isApproved ? (
                    <Text className="text-emerald-400 font-semibold" style={{ fontSize: 11 * fontScale }}>
                      ✓ Approved
                    </Text>
                  ) : (
                    <Text className="text-amber-400 font-semibold" style={{ fontSize: 11 * fontScale }}>
                      Pending
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
