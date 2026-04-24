import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import { useAuthStore } from '../store/auth'
import { useSocialStore } from '../store/social'
import { createLogger } from '../lib/logger'

const log = createLogger('dm-chat')

interface DmMessage {
  id: string
  senderId: string
  senderUsername: string
  text: string
  createdAt: string
}

interface DmChatModalProps {
  visible: boolean
  friendId: string
  friendUsername: string
  onClose: () => void
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatLastSeen(iso: string | null, online: boolean): string {
  if (online) return 'Online'
  if (!iso) return 'Offline'
  try {
    const d = new Date(iso)
    const diffMs = Date.now() - d.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Last seen just now'
    if (mins < 60) return `Last seen ${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `Last seen ${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `Last seen ${days}d ago`
  } catch {
    return 'Offline'
  }
}

export default function DmChatModal({
  visible,
  friendId,
  friendUsername,
  onClose,
}: DmChatModalProps) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [presence, setPresence] = useState<{ online: boolean; lastSeenAt: string | null }>({
    online: false,
    lastSeenAt: null,
  })
  const flatListRef = useRef<FlatList<DmMessage>>(null)
  const user = useAuthStore((s) => s.user)
  const clearUnread = useSocialStore((s) => s.clearUnread)
  const { width: screenWidth } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const isTablet = screenWidth >= 768
  const sidePad = isTablet ? 32 : 16
  // SafeAreaView inside a Modal with statusBarTranslucent can lose top insets
  // on Android, pushing the header (and the close button) behind the status
  // bar. Compute the top padding manually as a robust fallback.
  const topPad = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  )
  const bottomPad = Math.max(insets.bottom, 8)
  const contentStyle = isTablet
    ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const }
    : {}

  const initial = useMemo(
    () => (friendUsername?.charAt(0) ?? '?').toUpperCase(),
    [friendUsername],
  )

  // Load history + presence on open
  useEffect(() => {
    if (!visible || !friendId) return

    setLoading(true)
    api
      .get<DmMessage[]>(`/messages/${friendId}`)
      .then((data) => {
        setMessages(Array.isArray(data) ? data : [])
      })
      .catch((err: any) => {
        log.error('failed to load messages', { error: err?.message })
      })
      .finally(() => {
        setLoading(false)
      })

    api
      .get<{ isOnline?: boolean; lastSeenAt: string | null }>(`/users/${friendId}/profile`)
      .then((res) =>
        setPresence({ online: !!res.isOnline, lastSeenAt: res.lastSeenAt ?? null }),
      )
      .catch(() => {})

    clearUnread(friendId)
  }, [visible, friendId, clearUnread])

  // Listen for incoming DMs — only append messages from the friend to avoid
  // duplicating our own optimistic message (the server echoes every send back
  // to the sender as well).
  useEffect(() => {
    if (!visible) return

    const socket = getSocket()
    const handleReceive = (msg: DmMessage) => {
      if (msg.senderId !== friendId) return
      setMessages((prev) => [...prev, msg])
    }

    socket.on('dm:receive' as any, handleReceive)
    return () => {
      socket.off('dm:receive' as any, handleReceive)
    }
  }, [visible, friendId])

  // Auto-scroll to bottom whenever messages change or loading finishes
  useEffect(() => {
    if (loading) return
    const id = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true })
    }, 50)
    return () => clearTimeout(id)
  }, [messages, loading])

  const sendMessage = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || !user) return

    const socket = getSocket()
    socket.emit('dm:send' as any, { toUserId: friendId, text: trimmed })

    const optimistic: DmMessage = {
      id: `local-${Date.now()}`,
      senderId: user.id,
      senderUsername: user.username,
      text: trimmed,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setInput('')
  }, [input, friendId, user])

  const handleClose = useCallback(() => {
    setMessages([])
    setInput('')
    setPresence({ online: false, lastSeenAt: null })
    onClose()
  }, [onClose])

  const renderMessage = ({ item, index }: { item: DmMessage; index: number }) => {
    const isOwn = item.senderId === user?.id
    const prev = messages[index - 1]
    const groupedWithPrev = prev && prev.senderId === item.senderId
    return (
      <View
        className={[
          'flex-row gap-2 px-4',
          groupedWithPrev ? 'mt-0.5' : 'mt-3',
          isOwn ? 'flex-row-reverse' : '',
        ].join(' ')}
      >
        <View className="w-8 shrink-0">
          {!groupedWithPrev && (
            <View
              className={[
                'w-8 h-8 rounded-full items-center justify-center',
                isOwn ? 'bg-violet-700' : 'bg-neutral-700',
              ].join(' ')}
            >
              <Text className="text-white text-xs font-bold">
                {(isOwn ? user?.username : friendUsername)?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
        </View>

        <View
          className={[
            'rounded-2xl px-3.5 py-2 max-w-[78%]',
            isOwn
              ? 'bg-violet-600'
              : 'bg-neutral-800 border border-neutral-700/60',
            !groupedWithPrev && isOwn ? 'rounded-tr-sm' : '',
            !groupedWithPrev && !isOwn ? 'rounded-tl-sm' : '',
          ].join(' ')}
        >
          <Text
            className={['text-sm leading-snug', isOwn ? 'text-white' : 'text-neutral-100'].join(' ')}
            selectable
          >
            {item.text}
          </Text>
          <Text
            className={[
              'text-[10px] mt-0.5',
              isOwn ? 'text-violet-200/70 text-right' : 'text-neutral-500',
            ].join(' ')}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    )
  }

  const presenceLabel = formatLastSeen(presence.lastSeenAt, presence.online)
  const canSend = input.trim().length > 0

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-neutral-950" style={{ paddingTop: topPad }}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View
            className="flex-row items-center gap-3 py-3 border-b border-neutral-800 bg-neutral-950"
            style={{ paddingHorizontal: sidePad, ...contentStyle }}
          >
            <TouchableOpacity
              onPress={handleClose}
              className="w-10 h-10 rounded-full items-center justify-center bg-neutral-900 border border-neutral-800"
              activeOpacity={0.6}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.close', 'Close')}
            >
              <Text className="text-neutral-200 text-lg font-bold leading-5">✕</Text>
            </TouchableOpacity>

            <View className="relative">
              <View className="w-10 h-10 rounded-full bg-violet-700 items-center justify-center">
                <Text className="text-white text-base font-bold">{initial}</Text>
              </View>
              {presence.online && (
                <View className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-neutral-950" />
              )}
            </View>

            <View className="flex-1 min-w-0">
              <Text className="text-white font-bold text-base" numberOfLines={1}>
                {friendUsername}
              </Text>
              <Text
                className={[
                  'text-xs',
                  presence.online ? 'text-emerald-400' : 'text-neutral-500',
                ].join(' ')}
              >
                {presenceLabel}
              </Text>
            </View>
          </View>

          {/* Messages */}
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="small" color="#8b5cf6" />
              <Text className="text-neutral-500 text-xs mt-2">
                {t('common.loading')}
              </Text>
            </View>
          ) : messages.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <View className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 items-center justify-center mb-4">
                <Text className="text-3xl">💬</Text>
              </View>
              <Text className="text-neutral-300 text-base font-semibold text-center mb-1">
                {friendUsername}
              </Text>
              <Text className="text-neutral-500 text-sm text-center">
                Say hi — this is the start of your conversation.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={{ paddingTop: 8, paddingBottom: 12, ...contentStyle }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: true })
              }
            />
          )}

          {/* Input bar */}
          <View
            className="flex-row items-end gap-2 pt-2 border-t border-neutral-800 bg-neutral-950"
            style={{ paddingHorizontal: sidePad, paddingBottom: bottomPad, ...contentStyle }}
          >
            <View className="flex-1 bg-neutral-900 rounded-3xl border border-neutral-800 px-4 py-2">
              <TextInput
                className="text-white text-sm max-h-28"
                placeholder="Message"
                placeholderTextColor="#525252"
                value={input}
                onChangeText={setInput}
                multiline
                textAlignVertical="center"
              />
            </View>
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!canSend}
              className={[
                'w-11 h-11 rounded-full items-center justify-center',
                canSend ? 'bg-violet-600' : 'bg-neutral-800',
              ].join(' ')}
              activeOpacity={0.7}
            >
              <Text className={['text-xl font-bold', canSend ? 'text-white' : 'text-neutral-600'].join(' ')}>
                ➤
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}
