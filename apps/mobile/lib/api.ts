import { Platform } from 'react-native'
import { useAuthStore } from '../store/auth'
import { createLogger } from './logger'

const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost'
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || `http://${DEFAULT_HOST}:3001/api`

const log = createLogger('api')

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET'
  log.debug(`${method} ${path}`)
  const token = useAuthStore.getState().token
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const message = (err as any).error ?? `HTTP ${res.status}`
    log.error(`${method} ${path} failed`, { status: res.status, message })
    throw new Error(message)
  }
  log.debug(`${method} ${path} success`, { status: res.status })
  return res.json() as Promise<T>
}

async function upload<T>(path: string, uri: string): Promise<T> {
  log.debug('POST (upload)', { path, uri })
  const token = useAuthStore.getState().token
  const formData = new FormData()
  const filename = uri.split('/').pop() ?? 'avatar.jpg'
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
  const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
  formData.append('avatar', { uri, name: filename, type: mimeType } as any)
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const message = (err as any).error ?? `HTTP ${res.status}`
    log.error('Upload failed', { path, status: res.status, message })
    throw new Error(message)
  }
  log.debug('Upload success', { path, status: res.status })
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, uri: string) => upload<T>(path, uri),
}
