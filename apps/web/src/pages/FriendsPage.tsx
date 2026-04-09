import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'
import { useSocialStore } from '../store/social'

interface FriendUser {
  id: string
  username: string
  avatarUrl: string | null
}

interface FriendEntry {
  friendshipId: string
  user: FriendUser
}

interface FriendRequest {
  friendshipId: string
  from: FriendUser
  createdAt: string
}

type SearchFriendship =
  | { id: string; status: 'accepted' }
  | { id: string; status: 'pending_outgoing' }
  | { id: string; status: 'pending_incoming' }

interface SearchUser {
  id: string
  username: string
  avatarUrl: string | null
  friendship: SearchFriendship | null
}

interface OutgoingRequest {
  friendshipId: string
  to: FriendUser
  createdAt: string
}

function InitialsAvatar({ username }: { username: string }) {
  const colors = [
    'bg-brand-600', 'bg-amber-600', 'bg-emerald-600', 'bg-red-600',
    'bg-purple-600', 'bg-sky-600', 'bg-pink-600', 'bg-orange-600',
  ]
  const idx = username.charCodeAt(0) % colors.length
  return (
    <div className={`w-9 h-9 ${colors[idx]} rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0`}>
      {username.slice(0, 2).toUpperCase()}
    </div>
  )
}

function ShareCard() {
  const { t } = useTranslation()
  const appUrl = window.location.origin
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  const handleShare = async () => {
    if (canShare) {
      try {
        await navigator.share({
          title: 'Imposter Game',
          text: 'Join me in Imposter Game — the real-time social deduction game! Deceive. Detect. Dominate.',
          url: appUrl,
        })
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    } else {
      navigator.clipboard.writeText(appUrl).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(appUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <section className="rounded-2xl border border-brand-800/30 bg-gradient-to-br from-brand-950/60 to-neutral-900/60 p-4 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-600/50 to-transparent" />
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-800/40 border border-brand-700/40 flex items-center justify-center text-xl flex-shrink-0">
          🎭
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">{t('friends.inviteTitle')}</p>
          <p className="text-neutral-400 text-xs mt-0.5 leading-relaxed">
            {t('friends.inviteDesc')}
          </p>
          {/* URL row */}
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-800/80 border border-neutral-700/50 min-w-0">
              <span className="text-neutral-600 text-xs">🔗</span>
              <span className="text-neutral-300 text-xs font-mono truncate">{appUrl}</span>
            </div>
            <button
              onClick={handleCopy}
              className={[
                'px-3 py-2 rounded-xl text-xs font-semibold transition-all flex-shrink-0 border',
                copied
                  ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-400'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700',
              ].join(' ')}
            >
              {copied ? t('friends.copied') : `📋 ${t('friends.copy')}`}
            </button>
          </div>
        </div>
      </div>
      {/* Share button */}
      <button
        onClick={handleShare}
        className="w-full mt-3 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20"
      >
        <span>📤</span>
        {canShare ? t('friends.shareWithFriends') : (copied ? t('friends.linkCopied') : t('friends.copyLink'))}
      </button>
    </section>
  )
}

export default function FriendsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setActiveDm = useSocialStore((s) => s.setActiveDm)
  const unreadCounts = useSocialStore((s) => s.unreadCounts)

  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [loadingFriends, setLoadingFriends] = useState(true)
  const [loadingRequests, setLoadingRequests] = useState(true)

  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({})
  type Feedback = { kind: 'sent' } | { kind: 'error'; messageKey: string }
  const [actionFeedback, setActionFeedback] = useState<Record<string, Feedback>>({})


  const fetchFriends = useCallback(() => {
    setLoadingFriends(true)
    api
      .get<{ friends: FriendEntry[] }>('/friends')
      .then((res) => setFriends(res.friends))
      .catch(() => {})
      .finally(() => setLoadingFriends(false))
  }, [])

  const fetchRequests = useCallback(() => {
    setLoadingRequests(true)
    api
      .get<{ requests: FriendRequest[] }>('/friends/requests')
      .then((res) => setRequests(res.requests))
      .catch(() => {})
      .finally(() => setLoadingRequests(false))
  }, [])

  const fetchOutgoing = useCallback(() => {
    api
      .get<{ requests: OutgoingRequest[] }>('/friends/requests/outgoing')
      .then((res) => setOutgoing(res.requests))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchFriends()
    fetchRequests()
    fetchOutgoing()
  }, [fetchFriends, fetchRequests, fetchOutgoing])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const timeout = setTimeout(() => {
      setSearchLoading(true)
      api
        .get<{ users: SearchUser[] }>(`/users/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((res) => setSearchResults(res.users))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false))
    }, 400)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const handleAccept = async (friendshipId: string) => {
    setPendingActions((p) => ({ ...p, [friendshipId]: true }))
    try {
      await api.put(`/friends/${friendshipId}/accept`, {})
      setRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId))
      // Reflect the new 'accepted' state in any visible search result
      setSearchResults((prev) =>
        prev.map((u) =>
          u.friendship?.id === friendshipId
            ? { ...u, friendship: { id: friendshipId, status: 'accepted' as const } }
            : u,
        ),
      )
      fetchFriends()
    } finally {
      setPendingActions((p) => ({ ...p, [friendshipId]: false }))
    }
  }

  const handleDecline = async (friendshipId: string) => {
    setPendingActions((p) => ({ ...p, [friendshipId]: true }))
    try {
      await api.delete(`/friends/${friendshipId}`)
      setRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId))
    } finally {
      setPendingActions((p) => ({ ...p, [friendshipId]: false }))
    }
  }

  const handleUnfriend = async (friendshipId: string) => {
    setPendingActions((p) => ({ ...p, [friendshipId]: true }))
    try {
      await api.delete(`/friends/${friendshipId}`)
      setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId))
    } finally {
      setPendingActions((p) => ({ ...p, [friendshipId]: false }))
    }
  }

  const mapBackendErrorToKey = (message: string | undefined): string => {
    switch (message) {
      case 'Request already sent':
        return 'friends.requestPending'
      case 'Already friends':
        return 'friends.alreadyFriend'
      case 'User not found':
        return 'friends.userNotFound'
      case 'Cannot add yourself':
        return 'friends.cannotAddSelf'
      default:
        return 'friends.requestFailed'
    }
  }

  const handleAddFriend = async (username: string) => {
    setPendingActions((p) => ({ ...p, [username]: true }))
    try {
      await api.post('/friends/request', { username })
      setActionFeedback((p) => ({ ...p, [username]: { kind: 'sent' } }))
      // Refresh outgoing list so the new pending request shows up immediately
      fetchOutgoing()
      setTimeout(() => setSearchResults((prev) => prev.filter((u) => u.username !== username)), 1200)
    } catch (err) {
      const message = (err as { message?: string })?.message
      setActionFeedback((p) => ({ ...p, [username]: { kind: 'error', messageKey: mapBackendErrorToKey(message) } }))
      setTimeout(() => setActionFeedback((p) => {
        const next = { ...p }
        delete next[username]
        return next
      }), 3000)
    } finally {
      setPendingActions((p) => ({ ...p, [username]: false }))
    }
  }

  const handleCancelOutgoing = async (friendshipId: string) => {
    setPendingActions((p) => ({ ...p, [friendshipId]: true }))
    try {
      await api.delete(`/friends/${friendshipId}`)
      setOutgoing((prev) => prev.filter((r) => r.friendshipId !== friendshipId))
    } finally {
      setPendingActions((p) => ({ ...p, [friendshipId]: false }))
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <div className="max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto space-y-5 animate-slide-up">

          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{t('friends.title')}</h1>

          {/* Share the app */}
          <ShareCard />

          {/* Outgoing Pending Requests */}
          {outgoing.length > 0 && (
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                {t('friends.sentRequests')}
                <span className="ml-2 bg-neutral-700 text-neutral-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {outgoing.length}
                </span>
              </p>
              <div className="space-y-2">
                {outgoing.map((req) => (
                  <div key={req.friendshipId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/40">
                    <InitialsAvatar username={req.to.username} />
                    <button
                      type="button"
                      onClick={() => navigate(`/player/${req.to.id}`)}
                      className="flex-1 text-white font-medium text-sm text-left hover:text-brand-400 transition-colors"
                    >
                      {req.to.username}
                    </button>
                    <span className="text-xs text-neutral-400 font-semibold mr-1">{t('friends.requestPending')}</span>
                    <button
                      onClick={() => handleCancelOutgoing(req.friendshipId)}
                      disabled={pendingActions[req.friendshipId]}
                      className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-red-950/60 hover:border-red-800/40 hover:text-red-400 border border-neutral-700 text-neutral-500 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pending Requests */}
          {(loadingRequests || requests.length > 0) && (
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                {t('friends.pendingRequests')}
                {requests.length > 0 && (
                  <span className="ml-2 bg-brand-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {requests.length}
                  </span>
                )}
              </p>
              {loadingRequests ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-12 bg-neutral-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {requests.map((req) => (
                    <div key={req.friendshipId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/40">
                      <InitialsAvatar username={req.from.username} />
                      <button
                        type="button"
                        onClick={() => navigate(`/player/${req.from.id}`)}
                        className="flex-1 text-white font-medium text-sm text-left hover:text-brand-400 transition-colors"
                      >
                        {req.from.username}
                      </button>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAccept(req.friendshipId)}
                          disabled={pendingActions[req.friendshipId]}
                          className="px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          {t('friends.accept')}
                        </button>
                        <button
                          onClick={() => handleDecline(req.friendshipId)}
                          disabled={pendingActions[req.friendshipId]}
                          className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          {t('friends.decline')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Friends List */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
              {t('friends.title')}
              {friends.length > 0 && (
                <span className="ml-2 text-neutral-600">({friends.length})</span>
              )}
            </p>
            {loadingFriends ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 bg-neutral-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : friends.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="text-4xl mb-2">👥</span>
                <p className="text-white font-semibold text-sm">{t('friends.noFriends')}</p>
                <p className="text-neutral-500 text-xs mt-1">{t('friends.noFriendsHint')}</p>
              </div>
            ) : (
              <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
                {friends.map((f) => {
                  const unread = unreadCounts[f.user.id] ?? 0
                  return (
                    <div key={f.friendshipId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 transition-colors">
                      <div className="relative">
                        <InitialsAvatar username={f.user.username} />
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => navigate(`/player/${f.user.id}`)}
                        className="flex-1 text-white font-medium text-sm text-left hover:text-brand-400 transition-colors"
                      >
                        {f.user.username}
                      </button>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setActiveDm({ friendId: f.user.id, friendUsername: f.user.username })}
                          className="px-3 py-1 rounded-lg bg-brand-600/20 hover:bg-brand-600/40 border border-brand-800/40 text-brand-400 text-xs font-semibold transition-colors"
                        >
                          {unread > 0 ? `💬 ${unread}` : `💬 ${t('friends.message')}`}
                        </button>
                        <button
                          onClick={() => handleUnfriend(f.friendshipId)}
                          disabled={pendingActions[f.friendshipId]}
                          className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-red-950/60 hover:border-red-800/40 hover:text-red-400 border border-neutral-700 text-neutral-500 text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          {t('friends.unfriend')}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Search */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">{t('friends.findPlayers')}</p>
            <input
              type="text"
              placeholder={t('friends.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-brand-600 transition-colors"
            />

            {searchLoading && (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-12 bg-neutral-800 rounded-xl animate-pulse" />
                ))}
              </div>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map((u) => {
                  const feedback = actionFeedback[u.username]
                  const f = u.friendship
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/40">
                      <InitialsAvatar username={u.username} />
                      <button
                        type="button"
                        onClick={() => navigate(`/player/${u.id}`)}
                        className="flex-1 text-white font-medium text-sm text-left hover:text-brand-400 transition-colors"
                      >
                        {u.username}
                      </button>
                      {/* Transient post-click feedback takes priority */}
                      {feedback?.kind === 'sent' ? (
                        <span className="text-xs text-emerald-400 font-semibold">{t('friends.requestSent')}</span>
                      ) : feedback?.kind === 'error' ? (
                        <span
                          className={
                            feedback.messageKey === 'friends.requestPending' || feedback.messageKey === 'friends.alreadyFriend'
                              ? 'text-xs text-neutral-400 font-semibold'
                              : 'text-xs text-red-400 font-semibold'
                          }
                        >
                          {t(feedback.messageKey)}
                        </span>
                      ) : f?.status === 'accepted' ? (
                        <span className="text-xs text-emerald-400 font-semibold">{t('friends.alreadyFriend')}</span>
                      ) : f?.status === 'pending_outgoing' ? (
                        <span className="text-xs text-neutral-400 font-semibold">{t('friends.requestPending')}</span>
                      ) : f?.status === 'pending_incoming' ? (
                        <button
                          onClick={() => handleAccept(f.id)}
                          disabled={pendingActions[f.id]}
                          className="px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          {t('friends.accept')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddFriend(u.username)}
                          disabled={pendingActions[u.username]}
                          className="px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          {pendingActions[u.username] ? '…' : t('friends.addFriend')}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
              <p className="text-neutral-500 text-sm text-center mt-4">{t('friends.noResults', { query: searchQuery })}</p>
            )}
          </section>

        </div>
      </main>
    </div>
  )
}
