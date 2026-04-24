import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Share, ActivityIndicator, Linking } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import {
  REFERRAL_INVITER_REWARD,
  REFERRAL_INVITEE_REWARD,
  SOCIAL_SHARE_REWARD,
} from '@red-handed/shared'
import { api } from '../lib/api'
import { Avatar } from './Avatar'

interface ReferralResponse {
  code: string
  invitedCount: number
  invitedBy: { id: string; username: string; avatarUrl: string | null } | null
  shareRewardClaimed?: boolean
}

type SharePlatform = 'native' | 'twitter' | 'whatsapp' | 'facebook' | 'discord' | 'instagram'

const INVITE_ORIGIN = 'https://redhanded-game.com'

/**
 * "Invite a friend" card for the mobile profile. Mirrors the web
 * ReferralCard component — shows the caller's personal referral code with
 * a copy/share button, an accepted-invite count, and (when applicable) an
 * "Invited by @xxx" line if this user signed up through someone else's
 * code. The code is allocated lazily server-side on first fetch.
 */
export function ReferralCard() {
  const { t } = useTranslation()
  const [data, setData] = useState<ReferralResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [justClaimed, setJustClaimed] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [clipboardHint, setClipboardHint] = useState<SharePlatform | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<ReferralResponse>('/users/me/referral')
      .then((r) => {
        if (!cancelled) setData(r)
      })
      .catch(() => {/* non-critical — card just stays in loading state */})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const code = data?.code ?? ''
  const inviteUrl = code ? `${INVITE_ORIGIN}/?invite=${code}` : ''
  const claimed = (data?.shareRewardClaimed ?? false) || justClaimed

  const claimReward = async (platform: SharePlatform) => {
    if (claimed || claiming) return
    setClaiming(true)
    try {
      await api.post('/users/me/claim-share-reward', { platform })
      setJustClaimed(true)
    } catch (err: any) {
      // 409 = already claimed in a prior session — sync UI silently.
      if (err?.status === 409 || /already/i.test(err?.message ?? '')) {
        setJustClaimed(true)
      }
    } finally {
      setClaiming(false)
    }
  }

  const shareMessage = t('profile.shareMessage', {
    defaultValue:
      'Join me on Red Handed — the social deduction party game. Sign up with my code for a welcome bonus:',
  })

  const doNativeShare = async () => {
    try {
      const res = await Share.share({ message: `${shareMessage} ${inviteUrl}` })
      // Only count as claimable if the user actually completed the share.
      if (res.action === Share.sharedAction) claimReward('native')
    } catch {
      /* user dismissed */
    }
  }

  const openIntent = async (platform: SharePlatform, url: string) => {
    try {
      const ok = await Linking.canOpenURL(url)
      if (!ok) throw new Error('No handler')
      await Linking.openURL(url)
      claimReward(platform)
    } catch {
      setShareError(t('profile.shareFailed', { defaultValue: 'Share failed — try again' }))
    }
  }

  const shareOn = async (platform: SharePlatform) => {
    if (!inviteUrl) return
    setShareError(null)
    const msg = encodeURIComponent(`${shareMessage} ${inviteUrl}`)
    const u = encodeURIComponent(inviteUrl)
    if (platform === 'native') return doNativeShare()
    if (platform === 'twitter') return openIntent(platform, `https://twitter.com/intent/tweet?text=${msg}`)
    if (platform === 'whatsapp') return openIntent(platform, `https://wa.me/?text=${msg}`)
    if (platform === 'facebook') return openIntent(platform, `https://www.facebook.com/sharer/sharer.php?u=${u}`)
    if (platform === 'discord' || platform === 'instagram') {
      // Neither app accepts a prefilled share intent — copy the message to
      // the clipboard so the user can paste it, then open the app (or the
      // web site as a fallback when the app isn't installed).
      await Clipboard.setStringAsync(`${shareMessage} ${inviteUrl}`)
      setClipboardHint(platform)
      setTimeout(() => setClipboardHint(null), 2500)

      const deepLink = platform === 'discord' ? 'discord://' : 'instagram://app'
      const webFallback =
        platform === 'discord'
          ? 'https://discord.com/channels/@me'
          : 'https://www.instagram.com/'
      try {
        const canOpen = await Linking.canOpenURL(deepLink)
        await Linking.openURL(canOpen ? deepLink : webFallback)
      } catch {
        try {
          await Linking.openURL(webFallback)
        } catch {
          setShareError(t('profile.shareFailed', { defaultValue: 'Share failed — try again' }))
        }
      }
      claimReward(platform)
    }
  }

  const handleCopy = async () => {
    if (!code) return
    await Clipboard.setStringAsync(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <View className="mx-4 mb-4">
      <View className="flex-row items-center justify-between mb-3 px-1">
        <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          {t('profile.referralTitle', { defaultValue: 'Invite a friend' })}
        </Text>
        <Text className="text-[10px] text-neutral-500">
          {t('profile.referralInvitedCount', {
            count: data?.invitedCount ?? 0,
            defaultValue: '{{count}} joined',
          })}
        </Text>
      </View>

      <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 gap-3">
        <Text className="text-xs text-neutral-400 leading-5">
          {t('profile.referralBody', {
            inviter: REFERRAL_INVITER_REWARD,
            invitee: REFERRAL_INVITEE_REWARD,
            defaultValue:
              'Share your code. When a friend signs up with it, you earn +{{inviter}} ⭐ (after their first ranked game) and they get +{{invitee}} ⭐.',
          })}
        </Text>

        {data?.invitedBy && (
          <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-neutral-950/60 border border-neutral-800">
            <Avatar url={data.invitedBy.avatarUrl} username={data.invitedBy.username} size={24} />
            <Text className="text-xs text-neutral-400 flex-1" numberOfLines={1}>
              {t('profile.invitedBy', {
                username: data.invitedBy.username,
                defaultValue: 'Invited by @{{username}}',
              })}
            </Text>
          </View>
        )}

        <View className="flex-row items-center gap-2">
          <View className="flex-1 px-3 py-2.5 rounded-xl bg-neutral-950/80 border border-neutral-700 items-center">
            <Text className="font-mono text-amber-300 text-base" style={{ letterSpacing: 6 }}>
              {loading ? '········' : code || '—'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleCopy}
            disabled={!code}
            className="px-3 py-2.5 rounded-xl bg-violet-700"
            style={{ opacity: code ? 1 : 0.4 }}
          >
            <Text className="text-white text-xs font-semibold">
              {copied
                ? t('profile.copied', { defaultValue: 'Copied ✓' })
                : t('profile.copyCode', { defaultValue: 'Copy' })}
            </Text>
          </TouchableOpacity>
        </View>

        {!!code && (
          <View className="pt-3 border-t border-neutral-800 gap-2">
            <Text className="text-xs font-bold text-amber-300">
              {claimed
                ? t('profile.shareRewardClaimed', {
                    reward: SOCIAL_SHARE_REWARD,
                    defaultValue: '+{{reward}} ⭐ earned — keep sharing to grow your invites!',
                  })
                : t('profile.shareRewardCta', {
                    reward: SOCIAL_SHARE_REWARD,
                    defaultValue: 'Share on social media — earn +{{reward}} ⭐ (one-time)',
                  })}
            </Text>

            <TouchableOpacity
              onPress={() => shareOn('native')}
              disabled={claiming}
              className="px-3 py-2.5 rounded-xl bg-amber-500 items-center flex-row justify-center gap-2"
              style={{ opacity: claiming ? 0.6 : 1 }}
            >
              <Text style={{ fontSize: 14 }}>📤</Text>
              <Text className="text-neutral-900 text-xs font-bold">
                {t('profile.shareNative', { defaultValue: 'Share…' })}
              </Text>
            </TouchableOpacity>

            <View className="flex-row gap-2">
              <SocialBtn brand="twitter" bg="#000000" onPress={() => shareOn('twitter')} disabled={claiming} />
              <SocialBtn brand="whatsapp" bg="#25D366" onPress={() => shareOn('whatsapp')} disabled={claiming} />
              <SocialBtn brand="facebook" bg="#1877F2" onPress={() => shareOn('facebook')} disabled={claiming} />
              <SocialBtn brand="discord" bg="#5865F2" onPress={() => shareOn('discord')} disabled={claiming} />
              <SocialBtn brand="instagram" bg="#E1306C" onPress={() => shareOn('instagram')} disabled={claiming} />
            </View>

            {clipboardHint === 'discord' && (
              <Text className="text-emerald-400 text-[10px]">
                {t('profile.shareCopiedPasteDiscord', {
                  defaultValue: 'Link copied — paste it into Discord to share.',
                })}
              </Text>
            )}
            {clipboardHint === 'instagram' && (
              <Text className="text-emerald-400 text-[10px]">
                {t('profile.shareCopiedPasteInstagram', {
                  defaultValue: 'Link copied — paste it into an Instagram DM or story.',
                })}
              </Text>
            )}
            {shareError && <Text className="text-red-400 text-[10px]">{shareError}</Text>}
          </View>
        )}

        {loading && (
          <ActivityIndicator size="small" color="#7c3aed" />
        )}
      </View>
    </View>
  )
}

// Brand-accurate SVG paths (Simple Icons) — ported verbatim from the web
// ReferralCard so the two apps share the same marks. viewBox="0 0 24 24".
const BRAND_PATHS: Record<Exclude<SharePlatform, 'native'>, string> = {
  twitter:
    'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  whatsapp:
    'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
  facebook:
    'M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  discord:
    'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z',
  instagram:
    'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.07 1.645.07 4.849 0 3.205-.012 3.584-.07 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849C2.381 3.924 3.896 2.38 7.15 2.233 8.416 2.175 8.796 2.163 12 2.163zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
}

function SocialBtn({
  brand,
  bg,
  onPress,
  disabled,
}: {
  brand: Exclude<SharePlatform, 'native'>
  bg: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className="flex-1 h-10 rounded-xl items-center justify-center"
      style={{ backgroundColor: bg, opacity: disabled ? 0.6 : 1 }}
      accessibilityLabel={brand}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path d={BRAND_PATHS[brand]} fill="#ffffff" />
      </Svg>
    </TouchableOpacity>
  )
}
