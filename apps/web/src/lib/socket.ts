import { io, type Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { useAuthStore } from '../store/auth'
import { createLogger } from './logger'

const log = createLogger('socket')

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    const token = useAuthStore.getState().token
    socket = io('/', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
    socket.on('connect', () => log.info('connected', { id: socket?.id }))
    socket.on('disconnect', (reason) => log.info('disconnected', { reason }))
    socket.on('connect_error', (err) => log.error('connection error', { message: err.message }))
  }
  return socket
}

export function connectSocket() {
  const s = getSocket()
  // Always update auth in case token changed
  const token = useAuthStore.getState().token
  s.auth = { token }
  if (!s.connected) {
    log.info('connecting')
    s.connect()
  }
}

export function updateSocketAuth() {
  if (!socket) return
  const token = useAuthStore.getState().token
  socket.auth = { token }
  log.info('auth updated')
  // If disconnected, reconnect with new auth
  if (!socket.connected) {
    log.info('reconnecting with new auth')
    socket.connect()
  }
}

export function disconnectSocket() {
  if (socket) {
    log.info('disconnecting')
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}
