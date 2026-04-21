import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMessage } from '@red-handed/shared'
import { getSocket } from '../lib/socket'
import { useAuthStore } from '../store/auth'

const MAX_LEN = 200

export function LobbyChat() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sock = getSocket()
    const handler = (msg: ChatMessage) => {
      setMessages((prev) => {
        const next = [...prev, msg]
        return next.length > 100 ? next.slice(-100) : next
      })
    }
    sock.on('chat:message', handler)
    return () => {
      sock.off('chat:message', handler)
    }
  }, [])

  useEffect(() => {
    if (!collapsed) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, collapsed])

  const send = () => {
    const text = input.trim()
    if (!text) return
    getSocket().emit('chat:send', text.slice(0, MAX_LEN))
    setInput('')
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="card space-y-2 border-neutral-800/60 bg-neutral-900/60">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={!collapsed}
      >
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          💬 {t('lobby.chatTitle', 'Lobby Chat')}
        </p>
        <span className="text-neutral-500 text-xs">{collapsed ? '▾' : '▴'}</span>
      </button>

      {!collapsed && (
        <>
          <div
            className="h-48 overflow-y-auto rounded-xl bg-neutral-950/40 border border-neutral-800/60 p-2 space-y-1.5"
            aria-live="polite"
            aria-label={t('lobby.chatTitle', 'Lobby Chat')}
          >
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <p className="text-neutral-600 text-xs">
                  {t('lobby.chatEmpty', 'Say hi while you wait…')}
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.senderId === user?.id
                return (
                  <div key={m.id} className="flex items-start gap-2 text-sm">
                    <span
                      className={[
                        'font-semibold flex-shrink-0',
                        isMe ? 'text-brand-400' : 'text-neutral-300',
                      ].join(' ')}
                    >
                      {m.senderName}
                    </span>
                    <span className="text-neutral-200 break-words min-w-0 flex-1">
                      {m.text}
                    </span>
                    <span className="text-[10px] text-neutral-600 flex-shrink-0 tabular-nums">
                      {formatTime(m.timestamp)}
                    </span>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={onKey}
              maxLength={MAX_LEN}
              placeholder={t('lobby.chatPlaceholder', 'Message the lobby…')}
              className="flex-1 px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-brand-600 transition-colors"
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              aria-label={t('lobby.chatSend', 'Send message')}
              className="w-9 h-9 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↑
            </button>
          </div>
        </>
      )}
    </div>
  )
}
