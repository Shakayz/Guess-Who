import React, { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import { useAuthStore } from '../store/auth'
import { useSocialStore } from '../store/social'

interface DmChatPanelProps {
  friend: { id: string; username: string }
  onClose: () => void
}

interface DmMessage {
  id: string
  senderId: string
  receiverId: string
  text: string
  read: boolean
  createdAt: string
}

interface DmReceiveEvent {
  id: string
  senderId: string
  senderUsername: string
  text: string
  createdAt: string
}

export function DmChatPanel({ friend, onClose }: DmChatPanelProps) {
  const user = useAuthStore((s) => s.user)
  const clearUnread = useSocialStore((s) => s.clearUnread)
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    clearUnread(friend.id)
    api
      .get<{ messages: DmMessage[] }>(`/messages/${friend.id}`)
      .then((res) => setMessages(res.messages))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [friend.id, clearUnread])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock = getSocket() as any

    const handler = (data: DmReceiveEvent) => {
      if (data.senderId !== friend.id) return
      setMessages((prev) => [
        ...prev,
        {
          id: data.id,
          senderId: data.senderId,
          receiverId: user?.id ?? '',
          text: data.text,
          read: true,
          createdAt: data.createdAt,
        },
      ])
    }

    sock.on('dm:receive', handler)
    return () => {
      sock.off('dm:receive', handler)
    }
  }, [friend.id, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock = getSocket() as any
    sock.emit('dm:send', { toUserId: friend.id, text })
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        senderId: user?.id ?? '',
        receiverId: friend.id,
        text,
        read: true,
        createdAt: new Date().toISOString(),
      },
    ])
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend()
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed bottom-4 right-4 w-80 h-96 flex flex-col rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
            {friend.username.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-white font-semibold text-sm">{friend.username}</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="text-3xl mb-1">💬</span>
            <p className="text-neutral-500 text-xs">Say hello to {friend.username}!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id
            return (
              <div
                key={msg.id}
                className={['flex', isMe ? 'justify-end' : 'justify-start'].join(' ')}
              >
                <div className={['max-w-[75%]', isMe ? 'items-end' : 'items-start'].join(' ')}>
                  <div className={[
                    'px-3 py-1.5 rounded-2xl text-sm',
                    isMe
                      ? 'bg-brand-600 text-white rounded-tr-sm'
                      : 'bg-neutral-800 text-neutral-200 rounded-tl-sm',
                  ].join(' ')}>
                    {msg.text}
                  </div>
                  <p className={['text-[10px] text-neutral-600 mt-0.5', isMe ? 'text-right' : ''].join(' ')}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-neutral-800">
        <input
          type="text"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-1.5 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-brand-600 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-8 h-8 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
