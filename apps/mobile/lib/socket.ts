import { io, Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@imposter/shared'
import { useAuthStore } from '../store/auth'

const SOCKET_URL = 'http://localhost:3001'

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: AppSocket | null = null

export function connectSocket(): AppSocket {
  if (socket?.connected) return socket

  const token = useAuthStore.getState().token

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  }) as AppSocket

  socket.on('connect', () => {
    console.log('[socket] connected:', socket?.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason)
  })

  socket.on('connect_error', (err) => {
    console.error('[socket] connection error:', err.message)
  })

  return socket
}

export function getSocket(): AppSocket {
  if (!socket) return connectSocket()
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
