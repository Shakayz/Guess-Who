import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useMatchmakingStore } from '../store/matchmaking'
import { getSocket } from '../lib/socket'
import { createLogger } from '../lib/logger'
import { useResponsive } from '../lib/responsive'

const log = createLogger('matchmaking-banner')

/**
 * Floating banner shown on every screen (except Home, which already renders
 * the full matchmaking card) while the user is in the matchmaking queue.
 * Tapping the banner routes back to Home; the X cancels the queue in place.
 */
export function MatchmakingBanner() {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const { width } = useWindowDimensions()
  const { tabBarHeight, isTablet } = useResponsive()

  const isSearching = useMatchmakingStore((s) => s.isSearching)
  const topMode = useMatchmakingStore((s) => s.topMode)
  const gameMode = useMatchmakingStore((s) => s.gameMode)
  const status = useMatchmakingStore((s) => s.status)
  const stopSearch = useMatchmakingStore((s) => s.stopSearch)

  // Home tab already has the full queue card — avoid double indicator there.
  if (!isSearching) return null
  if (pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index') return null

  const { queueSize, needed, elapsed, maxWait, idealPlayers } = status
  const progressPct = Math.min(100, (queueSize / idealPlayers) * 100)
  const timePct = Math.min(100, (elapsed / maxWait) * 100)
  const statusText =
    elapsed < 15
      ? t('home.matchmakingFullLobby')
      : elapsed < 35
        ? t('home.matchmakingExpanding')
        : t('home.matchmakingStartingSoon')

  const isRanked = gameMode === 'ranked' || topMode === 'ranked'
  const accent = isRanked ? '#f59e0b' : '#8b5cf6'

  const handleCancel = () => {
    log.info('leaving matchmaking from banner')
    try {
      ;(getSocket() as any)?.emit('matchmaking:leave', { gameMode: topMode })
    } catch {
      // Socket might be briefly disconnected — server drops us from the
      // queue on disconnect anyway. Local state clears below.
    }
    stopSearch()
  }

  const bannerWidth = Math.min(width - 24, 440)

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: tabBarHeight + 12,
        alignItems: 'center',
        zIndex: 40,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push('/')}
        accessibilityRole="button"
        accessibilityLabel={statusText}
        style={{
          width: bannerWidth,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(139,92,246,0.4)',
          backgroundColor: 'rgba(10,10,12,0.96)',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <ActivityIndicator color={accent} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ color: '#fff', fontWeight: '700', fontSize: isTablet ? 15 : 13 }}
            >
              {statusText}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: '#737373', fontSize: isTablet ? 12 : 11, marginTop: 2 }}
            >
              {t('home.inQueue', { count: queueSize, needed })} · {elapsed}s / {maxWait}s
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: '#262626',
            }}
          >
            <Text style={{ color: '#a3a3a3', fontWeight: '600', fontSize: 11 }}>
              {t('common.cancel')}
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 4,
            paddingBottom: 6,
            paddingHorizontal: 14,
          }}
        >
          {Array.from({ length: idealPlayers }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  i < queueSize
                    ? accent
                    : i < needed
                      ? '#404040'
                      : 'rgba(38,38,38,0.6)',
                borderWidth: i >= queueSize && i < needed ? 1 : 0,
                borderColor: '#525252',
              }}
            />
          ))}
        </View>

        <View style={{ height: 3, backgroundColor: '#262626' }}>
          <View style={{ height: 3, width: `${progressPct}%`, backgroundColor: accent }} />
        </View>
        <View style={{ height: 2, backgroundColor: '#09090b' }}>
          <View style={{ height: 2, width: `${timePct}%`, backgroundColor: '#525252' }} />
        </View>
      </TouchableOpacity>
    </View>
  )
}
