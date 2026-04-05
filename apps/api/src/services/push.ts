import pino from 'pino'

const logger = pino({ name: 'push' })

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface PushNotification {
  pushToken: string
  title: string
  body: string
  data?: Record<string, unknown>
}

/**
 * Send a single push notification via the Expo Push API.
 */
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken[')) {
    logger.warn({ pushToken }, 'invalid or missing Expo push token, skipping')
    return
  }

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: data ?? {},
      }),
    })

    const result = await res.json() as { data?: { status: string; message?: string; details?: unknown } }

    if (result.data?.status === 'error') {
      logger.error({ pushToken, error: result.data.message, details: result.data.details }, 'Expo push ticket error')
    } else {
      logger.debug({ pushToken, status: result.data?.status }, 'push notification sent')
    }
  } catch (err) {
    logger.error({ err, pushToken }, 'failed to send push notification')
  }
}

/**
 * Send multiple push notifications in a single batch request to the Expo Push API.
 * Expo supports up to 100 notifications per request.
 */
export async function sendPushNotifications(
  notifications: PushNotification[],
): Promise<void> {
  // Filter out invalid tokens
  const valid = notifications.filter((n) => n.pushToken && n.pushToken.startsWith('ExponentPushToken['))
  if (valid.length === 0) return

  // Chunk into batches of 100 (Expo limit)
  const BATCH_SIZE = 100
  const batches: PushNotification[][] = []
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    batches.push(valid.slice(i, i + BATCH_SIZE))
  }

  for (const batch of batches) {
    try {
      const messages = batch.map((n) => ({
        to: n.pushToken,
        sound: 'default' as const,
        title: n.title,
        body: n.body,
        data: n.data ?? {},
      }))

      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      })

      const result = await res.json() as { data?: Array<{ status: string; message?: string; details?: unknown }> }

      if (Array.isArray(result.data)) {
        for (let i = 0; i < result.data.length; i++) {
          const ticket = result.data[i]
          if (ticket.status === 'error') {
            logger.error(
              { pushToken: batch[i].pushToken, error: ticket.message, details: ticket.details },
              'Expo push ticket error in batch',
            )
          }
        }
      }

      logger.debug({ count: batch.length }, 'batch push notifications sent')
    } catch (err) {
      logger.error({ err, count: batch.length }, 'failed to send batch push notifications')
    }
  }
}
