import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useSocialStore } from '../store/social'

/**
 * Floating chat button rendered inside the game screen.
 * Only appears when there is at least one unread DM — tapping opens the
 * most recent sender's chat via the global DM host. Positioned so it sits
 * above the gameplay content but below root-level modals.
 */
export function InGameChatButton({ right = 12, top = 96 }: { right?: number; top?: number }) {
  const unreadCounts = useSocialStore((s) => s.unreadCounts)
  const unreadDmSenders = useSocialStore((s) => s.unreadDmSenders)
  const setActiveDm = useSocialStore((s) => s.setActiveDm)
  const clearUnread = useSocialStore((s) => s.clearUnread)

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + b, 0),
    [unreadCounts],
  )

  const mostRecent = useMemo(() => {
    const senders = Object.values(unreadDmSenders)
    if (senders.length === 0) return null
    return senders.reduce((a, b) => (a.lastAt > b.lastAt ? a : b))
  }, [unreadDmSenders])

  if (totalUnread === 0 || !mostRecent) return null

  const multiple = Object.keys(unreadCounts).length > 1

  const handlePress = () => {
    setActiveDm({
      friendId: mostRecent.friendId,
      friendUsername: mostRecent.friendUsername,
    })
    clearUnread(mostRecent.friendId)
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top,
        right,
        zIndex: 45,
      }}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${totalUnread} unread message${totalUnread === 1 ? '' : 's'}${multiple ? '' : ` from ${mostRecent.friendUsername}`}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'rgba(139,92,246,0.55)',
          backgroundColor: 'rgba(22,12,48,0.95)',
          shadowColor: '#8b5cf6',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.45,
          shadowRadius: 12,
          elevation: 10,
          maxWidth: 220,
        }}
      >
        <View style={{ position: 'relative' }}>
          <Text style={{ fontSize: 18 }}>💬</Text>
          <View
            style={{
              position: 'absolute',
              top: -6,
              right: -8,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 4,
              borderRadius: 9,
              backgroundColor: '#ef4444',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: '#09090b',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 10 }}>
              {totalUnread > 9 ? '9+' : totalUnread}
            </Text>
          </View>
        </View>
        <Text
          numberOfLines={1}
          style={{ color: '#fff', fontWeight: '700', fontSize: 12, flexShrink: 1 }}
        >
          {multiple ? `${Object.keys(unreadCounts).length} chats` : mostRecent.friendUsername}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
