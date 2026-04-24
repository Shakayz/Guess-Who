import React, { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, useWindowDimensions, Animated, Easing } from 'react-native'
import { useSocialStore } from '../store/social'
import { SlideUp } from './anim/AnimatedViews'

export function DmToastBanner() {
  const toasts = useSocialStore((s) => s.dmToasts)
  const { width } = useWindowDimensions()
  const isTablet = width >= 768
  if (toasts.length === 0) return null

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 64,
        right: 12,
        left: 12,
        zIndex: 55,
        gap: 10,
        ...(isTablet ? { maxWidth: 520, alignSelf: 'center' as const } : {}),
      }}
    >
      {toasts.map((t) => (
        <DmToastItem
          key={t.id}
          id={t.id}
          senderId={t.senderId}
          senderUsername={t.senderUsername}
          text={t.text}
        />
      ))}
    </View>
  )
}

function DmToastItem({
  id,
  senderId,
  senderUsername,
  text,
}: {
  id: string
  senderId: string
  senderUsername: string
  text: string
}) {
  const dismiss = useSocialStore((s) => s.dismissDmToast)
  const setActiveDm = useSocialStore((s) => s.setActiveDm)
  const clearUnread = useSocialStore((s) => s.clearUnread)
  const progress = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), 6000)
    Animated.timing(progress, {
      toValue: 0,
      duration: 6000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start()
    return () => clearTimeout(timer)
  }, [id, dismiss, progress])

  const initial = (senderUsername?.charAt(0) ?? '?').toUpperCase()

  const handleOpen = () => {
    dismiss(id)
    clearUnread(senderId)
    setActiveDm({ friendId: senderId, friendUsername: senderUsername })
  }

  const widthInterp = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  return (
    <SlideUp
      distance={-16}
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(139,92,246,0.55)',
        backgroundColor: 'rgba(17,10,34,0.98)',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
        elevation: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleOpen}
          accessibilityRole="button"
          accessibilityLabel={`Open chat with ${senderUsername}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#6d28d9',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#8b5cf6',
              shadowOpacity: 0.5,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{initial}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={{
                  color: '#c4b5fd',
                  fontWeight: '700',
                  fontSize: 9,
                  letterSpacing: 1.5,
                }}
              >
                NEW MESSAGE
              </Text>
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#8b5cf6',
                }}
              />
              <Text style={{ color: '#a78bfa', fontSize: 10, fontWeight: '600' }}>
                Tap to reply
              </Text>
            </View>
            <Text
              style={{ color: '#fff', fontWeight: '700', fontSize: 14, marginTop: 1 }}
              numberOfLines={1}
            >
              {senderUsername}
            </Text>
            <Text style={{ color: '#d4d4d8', fontSize: 12, marginTop: 1 }} numberOfLines={2}>
              {text}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => dismiss(id)} hitSlop={10} accessibilityLabel="Dismiss">
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: 'rgba(82,82,91,0.4)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#a1a1aa', fontSize: 16, lineHeight: 18 }}>×</Text>
          </View>
        </TouchableOpacity>
      </View>
      <View style={{ height: 2, backgroundColor: 'rgba(139,92,246,0.15)' }}>
        <Animated.View style={{ height: 2, width: widthInterp, backgroundColor: '#8b5cf6' }} />
      </View>
    </SlideUp>
  )
}
