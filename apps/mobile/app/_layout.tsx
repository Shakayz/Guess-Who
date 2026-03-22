import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import '../i18n'

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#09090b' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#09090b' },
        }}
      />
    </>
  )
}
