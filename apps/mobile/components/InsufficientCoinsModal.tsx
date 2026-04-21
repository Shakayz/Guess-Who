import React, { useEffect, useState } from 'react'
import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { createLogger } from '../lib/logger'

const log = createLogger('insufficient-coins')

interface InsufficientCoinsModalProps {
  visible: boolean
  /** How many ⭐ the action needed (usually 10, the DAILY_COST). */
  required: number
  /**
   * If the viewer is NOT the broke player, we pass the broke player's
   * username so the copy reads "X is short on coins" instead of "You don't…".
   * Undefined = it's the viewer who is broke.
   */
  blockedUsername?: string
  /**
   * Optional override for the "Get coins" CTA. Used when the caller is
   * already inside the Shop screen (emote purchase on the emotes tab) —
   * instead of routing, switch tabs in-place. When omitted the modal
   * falls back to router.push('/shop?tab=coins').
   */
  onGetCoins?: () => void
  onClose: () => void
}

/**
 * Mobile mirror of the web <InsufficientCoinsModal>. Shown whenever the
 * server returns INSUFFICIENT_STARS (HTTP 402 on POST /rooms,
 * matchmaking:error, game:start:failed). Replaces the old tiny red toast
 * with a clear actionable modal that routes to /shop.
 *
 * Note: the mobile app doesn't use react-query, so we fetch the viewer's
 * balance with a lightweight useEffect the first time the modal opens.
 */
export default function InsufficientCoinsModal({
  visible,
  required,
  blockedUsername,
  onGetCoins,
  onClose,
}: InsufficientCoinsModalProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [balance, setBalance] = useState<number | null>(null)

  const isViewerBroke = !blockedUsername

  useEffect(() => {
    if (!visible || !isViewerBroke) return
    // Fire-and-forget — the shown-balance is a nice-to-have, not required.
    // If the fetch fails we still show a useful modal with a "Get coins" CTA.
    let cancelled = false
    api
      .get<{ starCoins?: number }>('/auth/me')
      .then((me) => {
        if (!cancelled) setBalance(me.starCoins ?? 0)
      })
      .catch((err) => {
        log.warn('balance fetch failed', { error: err?.message })
        if (!cancelled) setBalance(0)
      })
    return () => {
      cancelled = true
    }
  }, [visible, isViewerBroke])

  const shownBalance = balance ?? 0
  const shortBy = Math.max(0, required - shownBalance)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center px-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      >
        <Pressable
          onPress={() => {}}
          className="w-full max-w-sm rounded-2xl bg-neutral-950 border border-neutral-800 overflow-hidden"
        >
          {/* Header */}
          <View
            className="px-5 pt-6 pb-4 border-b border-neutral-800 items-center"
            style={{ backgroundColor: 'rgba(120, 53, 15, 0.15)' }}
          >
            <View className="w-14 h-14 rounded-2xl bg-amber-950/60 border border-amber-700/40 items-center justify-center mb-2">
              <Text style={{ fontSize: 28 }}>⭐</Text>
            </View>
            <Text className="text-white font-extrabold text-center" style={{ fontSize: 17 }}>
              {isViewerBroke
                ? t('insufficientCoins.title', { defaultValue: "You don't have enough coins" })
                : t('insufficientCoins.playerTitle', {
                    username: blockedUsername,
                    defaultValue: `${blockedUsername} is short on coins`,
                  })}
            </Text>
          </View>

          <View className="px-5 py-4" style={{ gap: 14 }}>
            {isViewerBroke ? (
              <>
                <Text className="text-neutral-400 text-center" style={{ fontSize: 13, lineHeight: 19 }}>
                  {t('insufficientCoins.body', {
                    required,
                    defaultValue: `You need ${required} ⭐ to start a game. Grab more coins from the shop, or earn them by playing.`,
                  })}
                </Text>
                <View className="flex-row" style={{ gap: 8 }}>
                  <StatTile
                    label={t('insufficientCoins.balance', { defaultValue: 'You have' })}
                    value={`${shownBalance} ⭐`}
                  />
                  <StatTile
                    label={t('insufficientCoins.cost', { defaultValue: 'Cost' })}
                    value={`${required} ⭐`}
                  />
                  <StatTile
                    label={t('insufficientCoins.short', { defaultValue: 'Short by' })}
                    value={`${shortBy} ⭐`}
                    danger
                  />
                </View>
              </>
            ) : (
              <Text className="text-neutral-400 text-center" style={{ fontSize: 13, lineHeight: 19 }}>
                {t('insufficientCoins.playerBody', {
                  username: blockedUsername,
                  required,
                  defaultValue: `${blockedUsername} needs ${required} ⭐ to start a game but is short. Ask them to top up and try again.`,
                })}
              </Text>
            )}

            <View className="flex-row" style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={onClose}
                className="flex-1 rounded-xl bg-neutral-800 items-center py-3"
                activeOpacity={0.8}
              >
                <Text className="text-neutral-300 font-semibold" style={{ fontSize: 13 }}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </TouchableOpacity>
              {isViewerBroke && (
                <TouchableOpacity
                  onPress={() => {
                    onClose()
                    if (onGetCoins) onGetCoins()
                    else router.push('/shop?tab=coins')
                  }}
                  className="flex-1 rounded-xl bg-amber-600 items-center py-3"
                  activeOpacity={0.85}
                >
                  <Text className="text-white font-bold" style={{ fontSize: 13 }}>
                    {t('insufficientCoins.getCoinsCta', { defaultValue: 'Get coins' })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function StatTile({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View
      className={[
        'flex-1 rounded-xl border py-2.5 items-center',
        danger ? 'bg-red-950/30 border-red-900/50' : 'bg-neutral-900 border-neutral-800',
      ].join(' ')}
    >
      <Text
        className={[
          'uppercase font-semibold',
          danger ? 'text-red-500' : 'text-neutral-500',
        ].join(' ')}
        style={{ fontSize: 9, letterSpacing: 0.8 }}
      >
        {label}
      </Text>
      <Text
        className={['font-bold mt-0.5', danger ? 'text-red-300' : 'text-white'].join(' ')}
        style={{ fontSize: 14 }}
      >
        {value}
      </Text>
    </View>
  )
}
