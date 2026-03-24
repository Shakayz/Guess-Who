/**
 * Expo Notifications setup for mobile push notifications.
 * Call `registerForPushNotifications()` after the user logs in.
 */
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { useAuthStore } from '../store/auth'

const API_URL = 'http://localhost:3001/api'

// Configure how notifications appear while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Push notifications only work on physical devices')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Push notification permission denied')
    return null
  }

  // Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    })
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data
  console.log('[Push] Expo push token:', token)

  // Register token with backend
  const authToken = useAuthStore.getState().token
  if (authToken) {
    await fetch(`${API_URL}/users/me/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token }),
    }).catch((err) => console.error('[Push] Failed to register token:', err))
  }

  return token
}

export async function unregisterPushNotifications(): Promise<void> {
  const authToken = useAuthStore.getState().token
  if (!authToken) return
  await fetch(`${API_URL}/users/me/push-token`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  }).catch(() => {})
}
