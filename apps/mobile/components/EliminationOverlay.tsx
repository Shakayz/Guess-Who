import React, { useEffect } from 'react'
import { Modal, View, Text } from 'react-native'

interface EliminationOverlayProps {
  visible: boolean
  username: string
  role: string
  reason?: 'voted' | 'said_word'
  isSelf: boolean
  onDismiss: () => void
}

const ROLE_LABELS: Record<string, string> = {
  imposter: 'Imposter',
  double_agent: 'Double Agent',
  villager: 'Villager',
  detective: 'Detective',
}

function getEmoji(role: string, isSelf: boolean): string {
  if (isSelf) return '\uD83D\uDC80' // skull
  if (role === 'imposter' || role === 'double_agent') return '\uD83C\uDF89' // party
  return '\uD83D\uDE2C' // grimacing
}

function isEvilRole(role: string): boolean {
  return role === 'imposter' || role === 'double_agent'
}

export default function EliminationOverlay({
  visible,
  username,
  role,
  reason,
  isSelf,
  onDismiss,
}: EliminationOverlayProps) {
  useEffect(() => {
    if (!visible) return

    const timeout = setTimeout(() => {
      onDismiss()
    }, 3500)

    return () => clearTimeout(timeout)
  }, [visible])

  const evil = isEvilRole(role)
  const emoji = getEmoji(role, isSelf)
  const roleLabel = ROLE_LABELS[role] ?? role

  // Background tint classes
  const bgTint = evil ? 'bg-red-950/90' : 'bg-violet-950/90'
  const roleLabelColor = evil ? 'text-red-400' : 'text-violet-400'

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className={['flex-1 items-center justify-center px-8', bgTint].join(' ')}>
        <View className="items-center">
          <Text className="text-6xl mb-6">{emoji}</Text>

          {isSelf ? (
            <Text className="text-3xl font-extrabold text-white text-center tracking-tight mb-2">
              You were eliminated!
            </Text>
          ) : (
            <Text className="text-2xl font-extrabold text-white text-center tracking-tight mb-2">
              {username} was eliminated
            </Text>
          )}

          {reason === 'said_word' ? (
            <View className="bg-red-500/20 border border-red-700 rounded-xl px-4 py-2 mt-2 mb-3">
              <Text className="text-red-300 font-bold text-sm text-center">
                {isSelf ? 'You' : username} said the word!
              </Text>
            </View>
          ) : null}

          <View className="flex-row items-center gap-2 mt-2">
            <Text className="text-neutral-400 text-sm">
              {isSelf ? 'You were' : 'They were'} a
            </Text>
            <View
              className={[
                'px-3 py-1 rounded-full border',
                evil ? 'border-red-800 bg-red-950/50' : 'border-violet-800 bg-violet-950/50',
              ].join(' ')}
            >
              <Text className={['text-sm font-bold', roleLabelColor].join(' ')}>{roleLabel}</Text>
            </View>
          </View>

          <Text className="text-neutral-600 text-xs mt-8">
            {isSelf ? 'You are now spectating' : 'Continuing...'}
          </Text>
        </View>
      </View>
    </Modal>
  )
}
