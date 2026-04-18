import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Share, ActivityIndicator } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import {
  REFERRAL_INVITER_REWARD,
  REFERRAL_INVITEE_REWARD,
} from '@red-handed/shared'
import { api } from '../lib/api'
import { Avatar } from './Avatar'

interface ReferralResponse {
  code: string
  invitedCount: number
  invitedBy: { id: string; username: string; avatarUrl: string | null } | null
}

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

  const handleShare = async () => {
    if (!code) return
    try {
      await Share.share({
        message: t('profile.referralShareMessage', {
          url: inviteUrl,
          invitee: REFERRAL_INVITEE_REWARD,
          defaultValue: 'Join me on Red Handed! Use my link and get +{{invitee}} ⭐: {{url}}',
        }),
      })
    } catch {
      // user dismissed — ignore
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
          <TouchableOpacity
            onPress={handleShare}
            className="px-3 py-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 items-center"
          >
            <Text className="text-neutral-400 text-xs">
              {t('profile.shareInvite', { defaultValue: '📤 Share invite link' })}
            </Text>
          </TouchableOpacity>
        )}

        {loading && (
          <ActivityIndicator size="small" color="#7c3aed" />
        )}
      </View>
    </View>
  )
}
