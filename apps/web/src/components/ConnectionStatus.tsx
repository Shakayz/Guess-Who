import { useState, useEffect } from 'react'
import { getSocket } from '../lib/socket'

export function ConnectionStatus() {
  const [connected, setConnected] = useState(true)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const socket = getSocket()

    const onConnect = () => { setConnected(true); setTimeout(() => setShowBanner(false), 2000) }
    const onDisconnect = () => { setConnected(false); setShowBanner(true) }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    // Check initial state
    if (!socket.connected) { setConnected(false); setShowBanner(true) }

    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect) }
  }, [])

  if (!showBanner) return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-2 px-4 text-sm font-medium transition-colors ${
      connected ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white animate-pulse'
    }`}>
      {connected ? (
        <span>✓ Reconnected</span>
      ) : (
        <span>Connection lost. Reconnecting...</span>
      )}
    </div>
  )
}
