import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'

export default function HistoryLayout() {
  const { t } = useTranslation()

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#09090b' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('nav.history') }} />
      <Stack.Screen
        name="[gameId]"
        options={{ title: t('history.gameDetailsTitle', 'Game Details') }}
      />
    </Stack>
  )
}
