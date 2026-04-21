import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createLogger } from '../lib/logger'

const log = createLogger('auth')

interface AuthUser {
  id: string
  username: string
  email?: string
  level?: number
  premiumUntil?: string | null
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser | null) => void
  setUserMeta: (meta: Partial<Pick<AuthUser, 'level' | 'premiumUntil'>>) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        log.info('login', { userId: user?.id, username: user?.username })
        set({ token, user })
      },
      setUserMeta: (meta) => {
        set((s) => (s.user ? { user: { ...s.user, ...meta } } : {}))
      },
      clearAuth: () => {
        log.info('logout')
        set({ token: null, user: null })
      },
    }),
    {
      name: 'red-handed-auth',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
