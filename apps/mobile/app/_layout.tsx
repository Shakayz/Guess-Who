import React, { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import '../i18n'
import { useAuthStore } from '../store/auth'
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

  // Register for push notifications after login
  useEffect(() => {
    if (token) {
      registerForPushNotifications().catch(() => {})
    }
  }, [token])

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <AuthGuard>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#09090b' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
            contentStyle: { backgroundColor: '#09090b' },
          }}
        >
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="index" options={{ title: 'Imposter Game', headerShown: false }} />
          <Stack.Screen name="lobby/[code]" options={{ title: 'Lobby', headerBackTitle: 'Leave' }} />
          <Stack.Screen name="game/[code]" options={{ title: 'Game', headerShown: false }} />
          <Stack.Screen name="results/[code]" options={{ title: 'Results' }} />
        </Stack>
      </AuthGuard>
    </>
  )
}
