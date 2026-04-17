import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  REFERRAL_INVITER_REWARD,
  REFERRAL_INVITEE_REWARD,
} from '@red-handed/shared'
import { api } from '../lib/api'

interface ReferralResponse {
  code: string
  invitedCount: number
}

/**
 * "Invite a friend" card: shows the caller's personal referral code, a
 * one-click copy button, and a live count of accepted invites. The code is
 * allocated lazily on the server the first time this endpoint is hit, so
 * nothing needs to happen at signup for existing users who just want to
 * start sharing.
 */
export function ReferralCard() {
  const { t } = useTranslation()
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  const { data, isLoading } = useQuery<ReferralResponse>({
    queryKey: ['me-referral'],
    queryFn: () => api.get('/users/me/referral'),
    staleTime: 60_000,
  })

  const code = data?.code ?? ''
  const inviteUrl =
    typeof window !== 'undefined' && code
      ? `${window.location.origin}/?invite=${code}`
      : ''

  async function copy(value: string, which: 'code' | 'link') {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // Clipboard may be unavailable (insecure context, permissions, etc).
      // Silently fail — users can still long-press to copy the visible text.
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          {t('profile.referralTitle', { defaultValue: 'Invite a friend' })}
        </p>
        <span className="text-[10px] font-mono text-neutral-500">
          {t('profile.referralInvitedCount', {
            count: data?.invitedCount ?? 0,
            defaultValue: '{{count}} joined',
          })}
        </span>
      </div>

      <p className="text-xs text-neutral-400 leading-relaxed">
        {t('profile.referralBody', {
          inviter: REFERRAL_INVITER_REWARD,
          invitee: REFERRAL_INVITEE_REWARD,
          defaultValue:
            'Share your code. When a friend signs up with it, you earn +{{inviter}} ⭐ and they get +{{invitee}} ⭐.',
        })}
      </p>

      {/* Code */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-neutral-900/80 border border-neutral-700 font-mono tracking-[0.35em] text-amber-300 text-center text-lg">
          {isLoading ? '········' : code || '—'}
        </div>
        <button
          onClick={() => copy(code, 'code')}
          disabled={!code}
          className="px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors disabled:opacity-40"
        >
          {copied === 'code'
            ? t('profile.copied', { defaultValue: 'Copied ✓' })
            : t('profile.copyCode', { defaultValue: 'Copy' })}
        </button>
      </div>

      {/* Shareable link */}
      {inviteUrl && (
        <button
          onClick={() => copy(inviteUrl, 'link')}
          className="w-full text-left text-xs text-neutral-500 hover:text-neutral-300 transition-colors truncate px-3 py-2 rounded-xl bg-neutral-900/40 border border-neutral-800"
          title={inviteUrl}
        >
          {copied === 'link'
            ? t('profile.copied', { defaultValue: 'Copied ✓' })
            : inviteUrl}
        </button>
      )}
    </div>
  )
}
