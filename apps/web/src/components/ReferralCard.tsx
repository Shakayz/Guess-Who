import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  REFERRAL_INVITER_REWARD,
  REFERRAL_INVITEE_REWARD,
  SOCIAL_SHARE_REWARD,
} from '@red-handed/shared'
import { api } from '../lib/api'

interface ReferralResponse {
  code: string
  invitedCount: number
  shareRewardClaimed: boolean
}

type SharePlatform = 'native' | 'twitter' | 'whatsapp' | 'facebook'

/**
 * "Invite a friend" card: shows the caller's personal referral code, a
 * one-click copy button, a live count of accepted invites, and a one-time
 * "Share & earn +N ⭐" row. The code is allocated lazily on the server the
 * first time this endpoint is hit, so nothing needs to happen at signup for
 * existing users who just want to start sharing.
 */
export function ReferralCard() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [justClaimed, setJustClaimed] = useState(false)

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
  const claimed = (data?.shareRewardClaimed ?? false) || justClaimed

  const claim = useMutation({
    mutationFn: (platform: SharePlatform) =>
      api.post<{ starsGranted: number; newBalance: number }>(
        '/users/me/claim-share-reward',
        { platform },
      ),
    onSuccess: () => {
      setJustClaimed(true)
      qc.invalidateQueries({ queryKey: ['me-referral'] })
      qc.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err: any) => {
      // Already claimed in a prior session → sync UI state, no banner.
      if (err?.status === 409) {
        setJustClaimed(true)
        qc.invalidateQueries({ queryKey: ['me-referral'] })
      }
    },
  })

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

  async function share(platform: SharePlatform) {
    if (!inviteUrl) return
    setShareError(null)
    const shareMessage = t('profile.shareMessage', {
      defaultValue:
        'Join me on Red Handed — the social deduction party game. Sign up with my code for a welcome bonus:',
    })
    try {
      if (
        platform === 'native' &&
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function'
      ) {
        await navigator.share({
          title: 'Red Handed',
          text: shareMessage,
          url: inviteUrl,
        })
      } else {
        const msg = encodeURIComponent(`${shareMessage} ${inviteUrl}`)
        const url = encodeURIComponent(inviteUrl)
        const intent =
          platform === 'twitter'
            ? `https://twitter.com/intent/tweet?text=${msg}`
            : platform === 'whatsapp'
            ? `https://wa.me/?text=${msg}`
            : platform === 'facebook'
            ? `https://www.facebook.com/sharer/sharer.php?u=${url}`
            : ''
        if (intent) window.open(intent, '_blank', 'noopener,noreferrer')
      }
      if (!claimed && !claim.isPending) claim.mutate(platform)
    } catch (err: any) {
      // AbortError = user dismissed the native share sheet — not an error.
      if (err?.name !== 'AbortError') {
        setShareError(
          t('profile.shareFailed', { defaultValue: 'Share failed — try again' }),
        )
      }
    }
  }

  const hasNativeShare =
    typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function'

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

      {/* Share on social media — one-time +N ⭐ reward */}
      {inviteUrl && (
        <div className="pt-3 border-t border-neutral-800 space-y-2">
          <p className="text-xs font-semibold text-amber-300">
            {claimed
              ? t('profile.shareRewardClaimed', {
                  reward: SOCIAL_SHARE_REWARD,
                  defaultValue: '+{{reward}} ⭐ earned — keep sharing to grow your invites!',
                })
              : t('profile.shareRewardCta', {
                  reward: SOCIAL_SHARE_REWARD,
                  defaultValue: 'Share on social media — earn +{{reward}} ⭐ (one-time)',
                })}
          </p>
          <div className="flex items-center gap-2">
            {hasNativeShare && (
              <button
                onClick={() => share('native')}
                disabled={claim.isPending}
                className="flex-1 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-900 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {t('profile.shareNative', { defaultValue: 'Share…' })}
              </button>
            )}
            <button
              onClick={() => share('twitter')}
              disabled={claim.isPending}
              className="px-3 py-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 text-sm font-bold text-neutral-100 transition-colors disabled:opacity-50"
              aria-label={t('profile.shareOnX', { defaultValue: 'Share on X' })}
              title="X (Twitter)"
            >
              𝕏
            </button>
            <button
              onClick={() => share('whatsapp')}
              disabled={claim.isPending}
              className="px-3 py-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 text-sm text-neutral-100 transition-colors disabled:opacity-50"
              aria-label={t('profile.shareOnWhatsApp', { defaultValue: 'Share on WhatsApp' })}
              title="WhatsApp"
            >
              💬
            </button>
            <button
              onClick={() => share('facebook')}
              disabled={claim.isPending}
              className="px-3 py-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 text-sm font-bold text-neutral-100 transition-colors disabled:opacity-50"
              aria-label={t('profile.shareOnFacebook', { defaultValue: 'Share on Facebook' })}
              title="Facebook"
            >
              f
            </button>
          </div>
          {shareError && <p className="text-[10px] text-red-400">{shareError}</p>}
        </div>
      )}
    </div>
  )
}
