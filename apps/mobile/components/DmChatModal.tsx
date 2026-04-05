import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import { useAuthStore } from '../store/auth'
import { useSocialStore } from '../store/social'

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

export default function DmChatModal({
  visible,
  friendId,
  friendUsername,
  onClose,
}: DmChatModalProps) {
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const flatListRef = useRef<FlatList<DmMessage>>(null)
  const user = useAuthStore((s) => s.user)
  const clearUnread = useSocialStore((s) => s.clearUnread)
  const { width: screenWidth } = useWindowDimensions()
  const isTablet = screenWidth >= 768
  const contentStyle = isTablet ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const } : {}

  // Load message history on open
  useEffect(() => {
    if (!visible || !friendId) return

    setLoading(true)
    api
      .get<DmMessage[]>(`/messages/${friendId}`)
      .then((data) => {
        setMessages(data)
      })
      .catch((err) => {
        console.error('[DmChat] Failed to load messages:', err.message)
      })
      .finally(() => {
        setLoading(false)
      })

    // Clear unread count for this friend
    clearUnread(friendId)
  }, [visible, friendId])

  // Listen for incoming DMs
  useEffect(() => {
    if (!visible) return

    const socket = getSocket()

    const handleReceive = (msg: DmMessage) => {
      // Only show messages from this conversation
      if (msg.senderId === friendId || msg.senderId === user?.id) {
        setMessages((prev) => [...prev, msg])
      }
    }

    socket.on('dm:receive' as any, handleReceive)

    return () => {
      socket.off('dm:receive' as any, handleReceive)
    }
  }, [visible, friendId, user?.id])

  const sendMessage = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || !user) return

    const socket = getSocket()
    socket.emit('dm:send' as any, { toUserId: friendId, text: trimmed })

    // Optimistically add to local list
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
    onClose()
  }, [onClose])

  const formatTime = (iso: string): string => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const renderMessage = ({ item }: { item: DmMessage }) => {
    const isOwn = item.senderId === user?.id
    return (
      <View
        className={['flex-row gap-2.5 px-4 py-1.5', isOwn ? 'flex-row-reverse' : ''].join(' ')}
      >
        {/* Avatar initial */}
        <View
          className={[
            'w-8 h-8 rounded-full items-center justify-center mt-0.5 shrink-0',
            isOwn ? 'bg-violet-700' : 'bg-neutral-700',
          ].join(' ')}
        >
          <Text className="text-white text-xs font-bold">
            {(isOwn ? user?.username : friendUsername).charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Bubble */}
        <View
          className={[
            'rounded-2xl px-3.5 py-2.5 max-w-[75%]',
            isOwn
              ? 'bg-violet-600 rounded-tr-sm'
              : 'bg-neutral-800 border border-neutral-700 rounded-tl-sm',
          ].join(' ')}
        >
          <Text className={['text-sm leading-snug', isOwn ? 'text-white' : 'text-neutral-200'].join(' ')}>
            {item.text}
          </Text>
          <Text
            className={[
              'text-[10px] mt-1',
              isOwn ? 'text-violet-300/60 text-right' : 'text-neutral-500',
            ].join(' ')}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView className="flex-1 bg-neutral-950" edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between py-3 border-b border-neutral-800" style={{ paddingHorizontal: isTablet ? 32 : 16, ...contentStyle }}>
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-full bg-violet-700 items-center justify-center">
                <Text className="text-white text-sm font-bold">
                  {friendUsername.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text className="text-white font-bold text-base">{friendUsername}</Text>
                <Text className="text-neutral-500 text-xs">Direct Message</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              className="w-9 h-9 rounded-full bg-neutral-800 items-center justify-center"
              activeOpacity={0.7}
            >
              <Text className="text-neutral-400 text-lg font-bold">X</Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-neutral-500 text-sm">Loading messages...</Text>
            </View>
          ) : messages.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-3xl mb-3">💬</Text>
              <Text className="text-neutral-500 text-sm text-center">
                No messages yet. Say hi to {friendUsername}!
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              inverted={false}
              contentContainerStyle={{ paddingVertical: 12, gap: 2 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                flatListRef.current?.scrollToEnd({ animated: true })
              }}
            />
          )}

          {/* Input bar */}
          <View className="flex-row items-end gap-2 py-3 border-t border-neutral-800 bg-neutral-950" style={{ paddingHorizontal: isTablet ? 32 : 16, ...contentStyle }}>
            <TextInput
              className="flex-1 bg-neutral-800 text-white px-4 py-3 rounded-2xl border border-neutral-700 text-sm max-h-24"
              placeholder="Type a message..."
              placeholderTextColor="#525252"
              value={input}
              onChangeText={setInput}
              multiline
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!input.trim()}
              className={[
                'w-11 h-11 rounded-full items-center justify-center',
                input.trim() ? 'bg-violet-600' : 'bg-neutral-800 opacity-40',
              ].join(' ')}
              activeOpacity={0.7}
            >
              <Text className="text-white font-bold text-base">
                {'\u2191'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}
