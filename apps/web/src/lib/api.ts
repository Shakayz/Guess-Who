import { useAuthStore } from '../store/auth'
import { createLogger } from './logger'

const log = createLogger('api')
const BASE_URL = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET'
  log.debug(`${method} ${path}`)
  const token = useAuthStore.getState().token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  // Allow overriding headers (e.g. removing Content-Type for file uploads)
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers as Record<string, string>)) {
      if (v === '') {
        delete headers[k]
      } else {
        headers[k] = v
      }
    }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const error = Object.assign(new Error(err.error ?? `HTTP ${res.status}`), { status: res.status, data: err })
    log.error(`${method} ${path} failed`, { status: res.status, error: error.message })
    throw error
  }
  // Handle 204 No Content
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get:    <T>(path: string)                       => request<T>(path),
  post:   <T>(path: string, body: unknown)        => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)        => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)        => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: <T>(path: string)                       => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, file: File)           => {
    const form = new FormData()
    form.append('avatar', file)
    return request<T>(path, {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': '' }, // empty string removes the header so browser sets multipart boundary
    })
  },
}
