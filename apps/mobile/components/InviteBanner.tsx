import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native'
import { useRouter, useSegments } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSocialStore } from '../store/social'
import { SlideUp, GlowPulse } from './anim/AnimatedViews'

export function InviteBanner() {
  const router = useRouter()
  const { t } = useTranslation()
  const segments = useSegments()
  const pendingInvite = useSocialStore((s) => s.pendingInvite)
  const setPendingInvite = useSocialStore((s) => s.setPendingInvite)
  const { width } = useWindowDimensions()
  const isTablet = width >= 768

  // Hide while the user is already in a match flow — accepting another invite
  // from inside a game would yank them out of it. The invite stays pending in
  // the store and the banner reappears when they return to the tabs.
  const inMatchFlow =
    segments[0] === 'game' || segments[0] === 'lobby' || segments[0] === 'results'

  if (!pendingInvite || inMatchFlow) return null

  const initial = (pendingInvite.fromUsername?.charAt(0) ?? '?').toUpperCase()
  const bannerStyle = isTablet
    ? { maxWidth: 520, alignSelf: 'center' as const }
    : {}

  const handleJoin = () => {
    const code = pendingInvite.roomCode
    setPendingInvite(null)
    router.push(`/lobby/${code}`)
  }

  const handleDecline = () => {
    setPendingInvite(null)
  }

  return (
    <SlideUp
      distance={-24}
      style={{
        position: 'absolute',
        top: 56,
        left: 12,
        right: 12,
        zIndex: 50,
        ...bannerStyle,
      }}
    >
      <GlowPulse color="#8b5cf6">
        <View
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: 'rgba(139,92,246,0.6)',
            backgroundColor: 'rgba(22,12,48,0.98)',
            overflow: 'hidden',
            shadowColor: '#8b5cf6',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.45,
            shadowRadius: 20,
            elevation: 16,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 12,
              gap: 12,
            }}
          >
            <View style={{ position: 'relative' }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#7c3aed',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: 'rgba(196,181,253,0.5)',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>
                  {initial}
                </Text>
              </View>
              <View
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#09090b',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 12 }}>🎮</Text>
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  color: '#c4b5fd',
                  fontWeight: '700',
                  fontSize: 9,
                  letterSpacing: 1.5,
                }}
              >
                GAME INVITE
              </Text>
              <Text
                style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 1 }}
                numberOfLines={1}
              >
                {pendingInvite.fromUsername}
              </Text>
              <Text style={{ color: '#a78bfa', fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                {t('invite.wantsToPlay', 'wants to play with you')}
              </Text>
            </View>

            <View style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <TouchableOpacity
                onPress={handleJoin}
                activeOpacity={0.85}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: '#8b5cf6',
                  shadowColor: '#8b5cf6',
                  shadowOpacity: 0.6,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 0 },
                }}
                accessibilityRole="button"
                accessibilityLabel={t('invite.join', 'Join game')}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
                  {t('invite.join', 'Join')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDecline}
                activeOpacity={0.85}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: 'rgba(38,10,60,0.6)',
                  borderWidth: 1,
                  borderColor: 'rgba(139,92,246,0.35)',
                }}
                accessibilityRole="button"
                accessibilityLabel={t('invite.decline', 'Decline invite')}
              >
                <Text style={{ color: '#c4b5fd', fontWeight: '600', fontSize: 11, textAlign: 'center' }}>
                  {t('invite.decline', 'Decline')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </GlowPulse>
    </SlideUp>
  )
}
