import type { TFunction } from 'i18next'

// Relative time formatter used by profile headers and DM chat panel.
export function formatLastSeen(iso: string, t: TFunction): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return t('profile.lastSeenJustNow')
  if (mins < 60) return t('profile.lastSeenMinutes', { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('profile.lastSeenHours', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('profile.lastSeenDays', { count: days })
  return t('profile.lastSeenLongAgo')
}
