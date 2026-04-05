import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createLogger } from '../lib/logger'

const log = createLogger('auth')

interface AuthState {
  token: string | null
  user: { id: string; username: string; email?: string } | null
  setAuth: (token: string, user: AuthState['user']) => void
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
      clearAuth: () => {
        log.info('logout')
        set({ token: null, user: null })
      },
    }),
    {
      name: 'imposter-auth',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
