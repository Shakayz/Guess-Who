import { Stack } from 'expo-router'

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#09090b' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Profile' }} />
      <Stack.Screen name="[userId]" options={{ title: 'Player' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  )
}
