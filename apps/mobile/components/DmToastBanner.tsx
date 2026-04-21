import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native'
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
        top: 140,
        right: 12,
        left: 12,
        zIndex: 55,
        gap: 10,
        ...(isTablet ? { maxWidth: 500, alignSelf: 'center' as const } : {}),
      }}
    >
      {toasts.map((t) => (
        <DmToastItem key={t.id} id={t.id} senderId={t.senderId} senderUsername={t.senderUsername} text={t.text} />
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

  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), 6000)
    return () => clearTimeout(timer)
  }, [id, dismiss])

  return (
    <SlideUp distance={-16} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(109,40,217,0.6)', backgroundColor: 'rgba(46,16,101,0.95)' }}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          dismiss(id)
          clearUnread(senderId)
          setActiveDm({ friendId: senderId, friendUsername: senderUsername })
        }}
        className="flex-row items-start gap-3 flex-1"
      >
        <Text style={{ fontSize: 24 }}>💬</Text>
        <View className="flex-1 min-w-0">
          <Text className="text-violet-300 font-bold uppercase tracking-widest" style={{ fontSize: 9 }}>
            New message
          </Text>
          <Text className="text-white font-semibold text-sm" numberOfLines={1}>
            {senderUsername}
          </Text>
          <Text className="text-neutral-300 text-xs" numberOfLines={1}>
            {text}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => dismiss(id)} hitSlop={8}>
        <Text className="text-neutral-400 text-lg leading-none">×</Text>
      </TouchableOpacity>
    </SlideUp>
  )
}
