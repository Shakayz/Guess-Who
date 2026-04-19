import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { useSocialStore } from '../store/social'

/**
 * Stack of dismissible "gift received" toasts. Coins/premium are already
 * credited server-side by the webhook / /api/gifts/send — this toast just
 * acknowledges the delivery and offers a shortcut to the Shop so the recipient
 * can see their new balance.
 */
export function GiftToastBanner() {
  const toasts = useSocialStore((s) => s.giftToasts)
  const { width } = useWindowDimensions()
  const isTablet = width >= 768
  if (toasts.length === 0) return null

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 140,
        right: 12,
        left: 12,
        zIndex: 55,
        gap: 10,
        ...(isTablet ? { maxWidth: 500, alignSelf: 'center' as const } : {}),
      }}
    >
      {toasts.map((t) => (
        <GiftToastItem key={t.id} id={t.id} senderUsername={t.senderUsername} coinAmount={t.coinAmount} premiumPlanId={t.premiumPlanId} message={t.message} />
      ))}
    </View>
  )
}

function GiftToastItem({
  id,
  senderUsername,
  coinAmount,
  premiumPlanId,
  message,
}: {
  id: string
  senderUsername: string
  coinAmount: number
  premiumPlanId: string | null
  message: string | null
}) {
  const router = useRouter()
  const dismiss = useSocialStore((s) => s.dismissGiftToast)

  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), 6000)
    return () => clearTimeout(timer)
  }, [id, dismiss])

  const describe = premiumPlanId
    ? premiumPlanId === 'yearly'
      ? 'Premium · 1 year'
      : 'Premium · 1 month'
    : `${coinAmount.toLocaleString()} ⭐`

  return (
    <View className="flex-row items-start gap-3 px-4 py-3 rounded-2xl border border-amber-600/60 bg-violet-950/95">
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          dismiss(id)
          router.push('/(tabs)/shop')
        }}
        className="flex-row items-start gap-3 flex-1"
      >
        <Text style={{ fontSize: 24 }}>🎁</Text>
        <View className="flex-1 min-w-0">
          <Text className="text-amber-300 font-bold uppercase tracking-widest" style={{ fontSize: 9 }}>
            Gift received
          </Text>
          <Text className="text-white font-semibold text-sm" numberOfLines={1}>
            <Text className="text-amber-400">{senderUsername}</Text>
            <Text className="text-neutral-200"> sent you </Text>
            <Text className="font-bold">{describe}</Text>
          </Text>
          {message && (
            <Text className="text-neutral-300 text-xs italic" numberOfLines={1}>
              "{message}"
            </Text>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => dismiss(id)} hitSlop={8}>
        <Text className="text-neutral-400 text-lg leading-none">×</Text>
      </TouchableOpacity>
    </View>
  )
}
