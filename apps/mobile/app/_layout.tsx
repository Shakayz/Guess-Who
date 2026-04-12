import '../global.css'
import React, { useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, useWindowDimensions, LogBox } from 'react-native'

// Suppress noisy socket reconnection logs in dev LogBox
LogBox.ignoreLogs([
  'Connection error',
  'websocket error',
  'Reconnect attempt',
  'Reconnect failed',
])
import { Stack, Redirect, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Linking from 'expo-linking'
import '../i18n'
import { useAuthStore } from '../store/auth'
import { useSocialStore } from '../store/social'
import { connectSocket, getSocket } from '../lib/socket'
import { registerForPushNotifications } from '../lib/notifications'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { AchievementToastBanner } from '../components/achievements/AchievementToast'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const segments = useSegments()

  useEffect(() => {
    if (token) {
      registerForPushNotifications().catch(() => {})
    }
  }, [token])

  const inPublicRoute = segments[0] === 'auth' || segments[0] === 'offline' || segments[0] === 'how-to-play'

  // Use declarative <Redirect> instead of router.replace() in useEffect.
  // router.replace() in useEffect fires before expo-router marks the navigator as ready,
  // causing "Attempted to navigate before mounting the Root Layout" error.
  if (!token && !inPublicRoute) {
    return <Redirect href="/auth" />
  }

  if (token && segments[0] === 'auth') {
    return <Redirect href="/" />
  }

  return <>{children}</>
}

function GlobalSocketListeners() {
  const token = useAuthStore((s) => s.token)
  const { setPendingInvite, setPendingFriendRequest, incrementUnread, pushAchievementToast } = useSocialStore()

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

    socket.on('achievement:unlocked' as any, (data: any) => {
      pushAchievementToast({
        key: data.key,
        name: data.name,
        icon: data.icon,
        difficulty: data.difficulty,
        starsReward: data.starsReward ?? 0,
      })
    })

    return () => {
      socket.off('room:invited' as any)
      socket.off('friend:request' as any)
      socket.off('dm:receive' as any)
      socket.off('achievement:unlocked' as any)
    }
  }, [token])

  return null
}

function DeepLinkHandler() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)

  const handleDeepLink = useCallback((event: { url: string }) => {
    const { url } = event
    if (!url) return

    const parsed = Linking.parse(url)
    const { hostname, path, queryParams } = parsed

    // Handle imposter://lobby/{code}
    if (hostname === 'lobby' && path) {
      const code = path.replace(/^\//, '')
      if (code && token) {
        router.push(`/lobby/${code}`)
      }
      return
    }

    // Handle imposter://game/{code}
    if (hostname === 'game' && path) {
      const code = path.replace(/^\//, '')
      if (code && token) {
        router.push(`/game/${code}`)
      }
      return
    }

    // Handle imposter://reset-password?token=xxx
    if (hostname === 'reset-password') {
      const resetToken = queryParams?.token as string | undefined
      if (resetToken) {
        router.push(`/reset-password?token=${resetToken}`)
      }
      return
    }
  }, [router, token])

  useEffect(() => {
    // Handle URL that opened the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url })
    })

    // Handle URLs while the app is already open (warm start)
    const subscription = Linking.addEventListener('url', handleDeepLink)
    return () => subscription.remove()
  }, [handleDeepLink])

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
    <ErrorBoundary>
      <StatusBar style="light" />
      <AuthGuard>
        <DeepLinkHandler />
        <GlobalSocketListeners />
        <ConnectionStatus />
        <InviteBanner />
        <FriendRequestBanner />
        <AchievementToastBanner />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#09090b' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
            contentStyle: { backgroundColor: '#09090b' },
          }}
        >
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="offline" options={{ title: 'Offline Mode', headerBackTitle: 'Back' }} />
          <Stack.Screen name="how-to-play" options={{ title: 'How to Play', headerBackTitle: 'Back' }} />
          <Stack.Screen name="lobby/[code]" options={{ title: 'Lobby', headerBackTitle: 'Leave' }} />
          <Stack.Screen name="game/[code]" options={{ title: 'Game', headerShown: false }} />
          <Stack.Screen name="results/[code]" options={{ title: 'Results' }} />
        </Stack>
      </AuthGuard>
    </ErrorBoundary>
  )
}
