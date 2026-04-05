import { useState, useEffect } from 'react'
import { View, Text } from 'react-native'
import { getSocket } from '../lib/socket'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function ConnectionStatus() {
  const [connected, setConnected] = useState(true)
  const [showBanner, setShowBanner] = useState(false)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    const socket = getSocket()
    const onConnect = () => { setConnected(true); setTimeout(() => setShowBanner(false), 2000) }
    const onDisconnect = () => { setConnected(false); setShowBanner(true) }
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    if (!socket.connected) { setConnected(false); setShowBanner(true) }
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect) }
  }, [])

  if (!showBanner) return null

  return (
    <View style={{
      position: 'absolute', top: insets.top, left: 0, right: 0, zIndex: 999,
      backgroundColor: connected ? '#059669' : '#dc2626',
      paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
        {connected ? '✓ Reconnected' : 'Connection lost. Reconnecting...'}
      </Text>
    </View>
  )
}
