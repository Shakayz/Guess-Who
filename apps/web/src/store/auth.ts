import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createLogger } from '../lib/logger'

const log = createLogger('auth')

interface AuthState {
  token: string | null
  user: { id: string; username: string; email?: string } | null
  setAuth: (token: string, user: AuthState['user']) => void
  updateUser: (patch: Partial<NonNullable<AuthState['user']>>) => void
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
      updateUser: (patch) =>
        set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),
      clearAuth: () => {
        log.info('logout')
        set({ token: null, user: null })
      },
    }),
    { name: 'red-handed-auth' },
  ),
)
