import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatLastSeen } from '../lib/lastSeen'
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

// Deterministic gradient for the avatar chip so each friend keeps a
// consistent, unique color pairing across sessions.
const AVATAR_GRADIENTS = [
  'from-brand-500 to-fuchsia-500',
  'from-indigo-500 to-brand-500',
  'from-emerald-500 to-teal-500',
  'from-rose-500 to-orange-500',
  'from-sky-500 to-indigo-500',
  'from-amber-500 to-rose-500',
  'from-violet-500 to-pink-500',
  'from-cyan-500 to-blue-500',
]
function avatarGradient(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}

export function DmChatPanel({ friend, onClose }: DmChatPanelProps) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const clearUnread = useSocialStore((s) => s.clearUnread)
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [justSent, setJustSent] = useState(false)
  const [presence, setPresence] = useState<{ isOnline: boolean; lastSeenAt: string | null } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    clearUnread(friend.id)
    api
      .get<{ messages: DmMessage[] }>(`/messages/${friend.id}`)
      .then((res) => setMessages(res.messages))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [friend.id, clearUnread])

  useEffect(() => {
    let cancelled = false
    api
      .get<{ isOnline?: boolean; lastSeenAt: string | null }>(`/users/${friend.id}/profile`)
      .then((res) => {
        if (cancelled) return
        setPresence({
          isOnline: !!res.isOnline,
          lastSeenAt: res.lastSeenAt ?? null,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [friend.id])

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

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
    setJustSent(true)
    window.setTimeout(() => setJustSent(false), 400)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  const avatar = avatarGradient(friend.id)
  const canSend = input.trim().length > 0

  return (
    <div
      role="dialog"
      aria-label={`Chat with ${friend.username}`}
      className="fixed inset-x-3 bottom-20 sm:inset-x-auto sm:right-4 sm:bottom-4 w-auto sm:w-[22rem] max-w-[calc(100vw-1.5rem)] h-[70vh] sm:h-[28rem] max-h-[calc(100vh-6rem)] z-[60] animate-slide-up"
    >
      {/* Soft outer glow — keeps the panel readable when it floats over a
          busy game board. */}
      <div
        aria-hidden
        className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-brand-500/30 via-brand-700/20 to-transparent blur-xl opacity-80 pointer-events-none"
      />
      <div className="relative flex flex-col h-full rounded-2xl border border-brand-700/40 bg-neutral-950/90 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-neutral-800/80 bg-gradient-to-r from-neutral-900/95 via-neutral-900/70 to-neutral-900/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div
                className={[
                  'w-9 h-9 rounded-full bg-gradient-to-br',
                  avatar,
                  'flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-brand-900/40 ring-1 ring-white/10',
                ].join(' ')}
              >
                {friend.username.slice(0, 2).toUpperCase()}
              </div>
              {presence && (
                <span
                  className={[
                    'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-neutral-950',
                    presence.isOnline ? 'bg-emerald-500' : 'bg-neutral-500',
                  ].join(' ')}
                />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-white font-semibold text-sm truncate leading-tight">
                {friend.username}
              </span>
              {presence?.isOnline ? (
                <span className="text-emerald-400 text-[10px] font-medium leading-none mt-0.5 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  {t('profile.onlineNow')}
                </span>
              ) : presence?.lastSeenAt ? (
                <span className="text-neutral-500 text-[10px] font-medium leading-none mt-0.5 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-neutral-500" />
                  {t('profile.lastSeen', { when: formatLastSeen(presence.lastSeenAt, t) })}
                </span>
              ) : null}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-800/80 text-neutral-500 hover:text-white transition-all text-sm active:scale-90"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 scroll-smooth">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-5 h-5 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <span className="text-4xl mb-2 animate-float-soft">💬</span>
              <p className="text-neutral-300 text-sm font-medium">
                {t('dm.sayHello', { name: friend.username })}
              </p>
              <p className="text-neutral-600 text-[11px] mt-1">
                Messages stay private between the two of you.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {messages.map((msg, i) => {
                const isMe = msg.senderId === user?.id
                const prev = messages[i - 1]
                const next = messages[i + 1]
                const minuteMs = 60_000
                const startsGroup =
                  !prev ||
                  prev.senderId !== msg.senderId ||
                  new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * minuteMs
                const endsGroup =
                  !next ||
                  next.senderId !== msg.senderId ||
                  new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime() > 5 * minuteMs

                return (
                  <div
                    key={msg.id}
                    className={[
                      'flex animate-scale-in',
                      isMe ? 'justify-end' : 'justify-start',
                      startsGroup ? 'mt-2' : '',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'flex flex-col max-w-[78%]',
                        isMe ? 'items-end' : 'items-start',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'px-3.5 py-2 text-sm leading-snug break-words shadow-md',
                          isMe
                            ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white'
                            : 'bg-neutral-800/90 text-neutral-100 border border-neutral-700/60',
                          'rounded-2xl',
                          isMe
                            ? endsGroup
                              ? 'rounded-br-sm'
                              : 'rounded-br-md'
                            : endsGroup
                              ? 'rounded-bl-sm'
                              : 'rounded-bl-md',
                        ].join(' ')}
                      >
                        {msg.text}
                      </div>
                      {endsGroup && (
                        <p
                          className={[
                            'text-[10px] text-neutral-600 mt-0.5 px-1',
                            isMe ? 'text-right' : '',
                          ].join(' ')}
                        >
                          {formatTime(msg.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-neutral-800/80 bg-neutral-950/70">
          <input
            ref={inputRef}
            type="text"
            placeholder={t('dm.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ block: 'end' }), 300)}
            autoComplete="off"
            maxLength={500}
            className="flex-1 min-w-0 px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-700/80 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-600/30 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={[
              'w-9 h-9 rounded-xl flex items-center justify-center text-white text-base font-semibold transition-all shrink-0',
              canSend
                ? 'bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-900/40 hover:from-brand-400 hover:to-brand-600 active:scale-95'
                : 'bg-neutral-800 text-neutral-600 cursor-not-allowed',
              justSent ? 'animate-jelly' : '',
            ].join(' ')}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}
