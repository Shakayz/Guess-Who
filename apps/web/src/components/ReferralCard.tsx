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

type SharePlatform =
  | 'native'
  | 'twitter'
  | 'whatsapp'
  | 'facebook'
  | 'discord'
  | 'instagram'

// Brand-accurate SVG logos. Stroke-free, fill=currentColor so Tailwind text-*
// classes drive the color.
const BrandIcon = {
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.07 1.645.07 4.849 0 3.205-.012 3.584-.07 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849C2.381 3.924 3.896 2.38 7.15 2.233 8.416 2.175 8.796 2.163 12 2.163zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
}

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
  const [clipboardHint, setClipboardHint] = useState<SharePlatform | null>(null)

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
      } else if (platform === 'discord' || platform === 'instagram') {
        // Neither service exposes a reliable web share intent, so copy the
        // message to clipboard and let the user paste it into the app.
        try {
          await navigator.clipboard.writeText(`${shareMessage} ${inviteUrl}`)
          setClipboardHint(platform)
          setTimeout(() => setClipboardHint(null), 2000)
        } catch {
          setShareError(
            t('profile.shareFailed', { defaultValue: 'Share failed — try again' }),
          )
          return
        }
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
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-neutral-900/80 hover:bg-black border border-neutral-700 text-neutral-100 hover:text-white transition-colors disabled:opacity-50"
              aria-label={t('profile.shareOnX', { defaultValue: 'Share on X' })}
              title="X (Twitter)"
            >
              {BrandIcon.twitter}
            </button>
            <button
              onClick={() => share('whatsapp')}
              disabled={claim.isPending}
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-neutral-900/80 hover:bg-[#25D366]/20 border border-neutral-700 text-[#25D366] transition-colors disabled:opacity-50"
              aria-label={t('profile.shareOnWhatsApp', { defaultValue: 'Share on WhatsApp' })}
              title="WhatsApp"
            >
              {BrandIcon.whatsapp}
            </button>
            <button
              onClick={() => share('facebook')}
              disabled={claim.isPending}
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-neutral-900/80 hover:bg-[#1877F2]/20 border border-neutral-700 text-[#1877F2] transition-colors disabled:opacity-50"
              aria-label={t('profile.shareOnFacebook', { defaultValue: 'Share on Facebook' })}
              title="Facebook"
            >
              {BrandIcon.facebook}
            </button>
            <button
              onClick={() => share('discord')}
              disabled={claim.isPending}
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-neutral-900/80 hover:bg-[#5865F2]/20 border border-neutral-700 text-[#5865F2] transition-colors disabled:opacity-50"
              aria-label={t('profile.shareOnDiscord', { defaultValue: 'Share on Discord' })}
              title={
                clipboardHint === 'discord'
                  ? t('profile.shareCopiedPaste', {
                      defaultValue: 'Copied — paste in Discord',
                    })
                  : 'Discord'
              }
            >
              {BrandIcon.discord}
            </button>
            <button
              onClick={() => share('instagram')}
              disabled={claim.isPending}
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-neutral-900/80 hover:bg-[#E1306C]/20 border border-neutral-700 text-[#E1306C] transition-colors disabled:opacity-50"
              aria-label={t('profile.shareOnInstagram', { defaultValue: 'Share on Instagram' })}
              title={
                clipboardHint === 'instagram'
                  ? t('profile.shareCopiedPaste', {
                      defaultValue: 'Copied — paste in Instagram',
                    })
                  : 'Instagram'
              }
            >
              {BrandIcon.instagram}
            </button>
          </div>
          {clipboardHint && (
            <p className="text-[10px] text-emerald-400">
              {clipboardHint === 'discord'
                ? t('profile.shareCopiedPasteDiscord', {
                    defaultValue: 'Link copied — paste it into Discord to share.',
                  })
                : t('profile.shareCopiedPasteInstagram', {
                    defaultValue: 'Link copied — paste it into an Instagram DM or story.',
                  })}
            </p>
          )}
          {shareError && <p className="text-[10px] text-red-400">{shareError}</p>}
        </div>
      )}
    </div>
  )
}
