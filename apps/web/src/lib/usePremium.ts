import { useQuery } from '@tanstack/react-query'
import { api } from './api'

type Me = {
  isPremium?: boolean
  premiumUntil?: string | null
}

// Reads the caller's premium entitlement from the cached /auth/me response
// that NavBar and other screens already populate. Returns a plain boolean
// plus the raw expiry timestamp for screens that want to render "renews on…"
// copy. Callers that only need the flag can destructure `isPremium`.
export function usePremium(): { isPremium: boolean; premiumUntil: Date | null } {
  const { data } = useQuery<Me>({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/auth/me'),
    retry: false,
  })
  return {
    isPremium: !!data?.isPremium,
    premiumUntil: data?.premiumUntil ? new Date(data.premiumUntil) : null,
  }
}
