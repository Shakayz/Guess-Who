/**
 * Expo Notifications setup for mobile push notifications.
 * Call `registerForPushNotifications()` after the user logs in.
 */
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { useAuthStore } from '../store/auth'
import { createLogger } from './logger'

const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost'
const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${DEFAULT_HOST}:3001/api`

const log = createLogger('notifications')

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
    log.warn('Push notifications only work on physical devices')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  log.debug('Current notification permission status', { status: existingStatus })
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    log.info('Requesting notification permissions')
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    log.warn('Push notification permission denied', { status: finalStatus })
    return null
  }

  // Android channel
  if (Platform.OS === 'android') {
    log.debug('Setting up Android notification channel')
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    })
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data
  log.info('Expo push token obtained', { token })

  // Register token with backend
  const authToken = useAuthStore.getState().token
  if (authToken) {
    log.debug('Registering push token with backend')
    await fetch(`${API_URL}/users/me/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token }),
    }).catch((err) => log.error('Failed to register push token with backend', { message: err?.message }))
    log.info('Push token registered with backend')
  } else {
    log.warn('No auth token available — skipping backend push token registration')
  }

  return token
}

export async function unregisterPushNotifications(): Promise<void> {
  const authToken = useAuthStore.getState().token
  if (!authToken) {
    log.warn('No auth token available — skipping push token unregistration')
    return
  }
  log.info('Unregistering push token from backend')
  await fetch(`${API_URL}/users/me/push-token`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  }).catch((err) => log.error('Failed to unregister push token', { message: err?.message }))
}
