import { io, Socket } from 'socket.io-client'
import { Platform } from 'react-native'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { useAuthStore } from '../store/auth'
import { createLogger } from './logger'

const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost'
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || `http://${DEFAULT_HOST}:3001`

const log = createLogger('socket')

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: AppSocket | null = null

export function connectSocket(): AppSocket {
  if (socket?.connected) return socket

  const token = useAuthStore.getState().token
  if (!token) {
    log.warn('No auth token — skipping socket connection')
    return null as unknown as AppSocket
  }
  log.info('Connecting to socket server', { url: SOCKET_URL })

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  }) as AppSocket

  socket.on('connect', () => {
    log.info('Connected', { id: socket?.id })
  })

  socket.on('disconnect', (reason) => {
    log.warn('Disconnected', { reason })
  })

  socket.on('connect_error', (err) => {
    log.error('Connection error', { message: err.message })
  })

  socket.io.on('reconnect_attempt', (attempt) => {
    log.info('Reconnect attempt', { attempt })
  })

  socket.io.on('reconnect', (attempt) => {
    log.info('Reconnected', { attempt })
  })

  socket.io.on('reconnect_failed', () => {
    log.error('Reconnect failed — all attempts exhausted')
  })

  return socket
}

export function getSocket(): AppSocket {
  if (!socket) return connectSocket()
  return socket
}

export function disconnectSocket() {
  if (socket) {
    log.info('Disconnecting socket')
    socket.disconnect()
    socket = null
  }
}
