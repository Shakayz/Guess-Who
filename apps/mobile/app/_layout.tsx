import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import '../i18n'
import { useAuthStore } from '../store/auth'
import { useSocialStore } from '../store/social'
import { connectSocket, getSocket } from '../lib/socket'
import { registerForPushNotifications } from '../lib/notifications'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    const inAuthGroup = segments[0] === 'auth'
    if (!token && !inAuthGroup) {
      router.replace('/auth')
    } else if (token && inAuthGroup) {
      router.replace('/')
    }
  }, [token, segments])

  useEffect(() => {
    if (token) {
      registerForPushNotifications().catch(() => {})
    }
  }, [token])

  return <>{children}</>
}

function GlobalSocketListeners() {
  const token = useAuthStore((s) => s.token)
  const { setPendingInvite, setPendingFriendRequest, incrementUnread } = useSocialStore()

  useEffect(() => {
    if (!token) return

    connectSocket()
    const socket = getSocket()

    socket.on('room:invited' as any, (data: any) => {
      setPendingInvite({ fromUsername: data.fromUsername, roomCode: data.roomCode })
    })

    socket.on('friend:request' as any, (data: any) => {
      setPendingFriendRequest({
        friendshipId: data.friendshipId,
        fromId: data.from?.id ?? data.fromId,
        fromUsername: data.from?.username ?? data.fromUsername,
      })
    })

    socket.on('dm:receive' as any, (data: any) => {
      incrementUnread(data.senderId)
    })

    return () => {
      socket.off('room:invited' as any)
      socket.off('friend:request' as any)
      socket.off('dm:receive' as any)
    }
  }, [token])

  return null
}

function InviteBanner() {
  const router = useRouter()
  const { pendingInvite, setPendingInvite } = useSocialStore()
  const { width } = useWindowDimensions()
  const isTablet = width >= 768
  const bannerStyle = isTablet ? { maxWidth: 500, alignSelf: 'center' as const } : {}

  if (!pendingInvite) return null

  return (
    <View className="absolute top-14 left-4 right-4 z-50 bg-violet-900 border border-violet-700 rounded-2xl p-4 flex-row items-center gap-3" style={bannerStyle}>
      <Text className="text-2xl">🎮</Text>
      <View className="flex-1">
        <Text className="text-white font-semibold text-sm">Game Invite</Text>
        <Text className="text-violet-300 text-xs">
          {pendingInvite.fromUsername} invited you to play
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => {
          const code = pendingInvite.roomCode
          setPendingInvite(null)
          router.push(`/lobby/${code}`)
        }}
        className="bg-violet-600 px-3 py-1.5 rounded-lg"
      >
        <Text className="text-white font-semibold text-xs">Join</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setPendingInvite(null)}>
        <Text className="text-violet-400 text-sm">✕</Text>
      </TouchableOpacity>
    </View>
  )
}

function FriendRequestBanner() {
  const { pendingFriendRequest, setPendingFriendRequest } = useSocialStore()
  const { width } = useWindowDimensions()
  const isTablet = width >= 768
  const bannerStyle = isTablet ? { maxWidth: 500, alignSelf: 'center' as const } : {}

  if (!pendingFriendRequest) return null

  return (
    <View className="absolute top-14 left-4 right-4 z-50 bg-emerald-900 border border-emerald-700 rounded-2xl p-4 flex-row items-center gap-3" style={bannerStyle}>
      <Text className="text-2xl">👋</Text>
      <View className="flex-1">
        <Text className="text-white font-semibold text-sm">Friend Request</Text>
        <Text className="text-emerald-300 text-xs">
          {pendingFriendRequest.fromUsername} wants to be your friend
        </Text>
      </View>
      <TouchableOpacity onPress={() => setPendingFriendRequest(null)}>
        <Text className="text-emerald-400 text-sm">✕</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <AuthGuard>
        <GlobalSocketListeners />
        <InviteBanner />
        <FriendRequestBanner />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#09090b' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
            contentStyle: { backgroundColor: '#09090b' },
          }}
        >
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="lobby/[code]" options={{ title: 'Lobby', headerBackTitle: 'Leave' }} />
          <Stack.Screen name="game/[code]" options={{ title: 'Game', headerShown: false }} />
          <Stack.Screen name="results/[code]" options={{ title: 'Results' }} />
        </Stack>
      </AuthGuard>
    </>
  )
}
