import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'

interface WordPair { wordA: string; wordB: string; difficulty: 'easy' | 'medium' | 'hard'; category: string }
interface WordPack {
  id: string; name: string; description?: string; locale: string
  isPublic: boolean; isApproved: boolean; authorId: string | null
  downloads: number; _count?: { pairs: number }; pairs?: WordPair[]
}

const DIFFICULTY_COLORS = { easy: 'text-emerald-400', medium: 'text-amber-400', hard: 'text-red-400' }

export default function WordPacksPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'browse' | 'mine' | 'create'>('browse')
  const [form, setForm] = useState({ name: '', description: '', locale: 'en', isPublic: false })
  const [pairs, setPairs] = useState<WordPair[]>([{ wordA: '', wordB: '', difficulty: 'medium', category: 'general' }])

  const { data: publicPacks, isLoading: publicLoading } = useQuery<WordPack[]>({
    queryKey: ['word-packs'],
    queryFn: () => api.get('/word-packs'),
    enabled: tab === 'browse',
  })

  const { data: myPacks, isLoading: myLoading } = useQuery<WordPack[]>({
    queryKey: ['word-packs-my'],
    queryFn: () => api.get('/word-packs/my'),
    enabled: tab === 'mine',
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/word-packs', { ...form, pairs: pairs.filter((p) => p.wordA && p.wordB) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['word-packs-my'] })
      setTab('mine')
      setForm({ name: '', description: '', locale: 'en', isPublic: false })
      setPairs([{ wordA: '', wordB: '', difficulty: 'medium', category: 'general' }])
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/word-packs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['word-packs-my'] }),
  })

  const addPair = () => setPairs((prev) => [...prev, { wordA: '', wordB: '', difficulty: 'medium', category: 'general' }])
  const removePair = (i: number) => setPairs((prev) => prev.filter((_, idx) => idx !== i))
  const updatePair = (i: number, field: keyof WordPair, value: string) =>
    setPairs((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))

  const validPairs = pairs.filter((p) => p.wordA.trim() && p.wordB.trim())

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-4 pb-12">
        <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">

          <div className="card">
            <h1 className="text-2xl font-extrabold text-white mb-1">📦 Word Packs</h1>
            <p className="text-neutral-500 text-sm">Browse community packs or create your own</p>
            <div className="flex gap-2 mt-4">
              {(['browse', 'mine', 'create'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={[
                    'px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors capitalize',
                    tab === t ? 'bg-brand-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white',
                  ].join(' ')}
                >
                  {t === 'browse' ? '🌐 Browse' : t === 'mine' ? '📁 My Packs' : '➕ Create'}
                </button>
              ))}
            </div>
          </div>

          {/* Browse tab */}
          {tab === 'browse' && (
            <div className="space-y-2">
              {publicLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="card animate-pulse">
                    <div className="h-5 w-40 bg-neutral-800 rounded mb-2" />
                    <div className="h-4 w-64 bg-neutral-800 rounded" />
                  </div>
                ))
              ) : publicPacks?.length === 0 ? (
                <div className="card text-center py-8">
                  <p className="text-neutral-500 text-sm">No community packs yet. Be the first to create one!</p>
                </div>
              ) : publicPacks?.map((pack) => (
                <div key={pack.id} className="card">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{pack.name}</p>
                      {pack.description && <p className="text-xs text-neutral-500 mt-0.5">{pack.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-neutral-500">{pack._count?.pairs ?? 0} pairs</span>
                        <span className="text-xs text-neutral-600">•</span>
                        <span className="text-xs text-neutral-500">{pack.locale.toUpperCase()}</span>
                        <span className="text-xs text-neutral-600">•</span>
                        <span className="text-xs text-neutral-500">{pack.downloads} downloads</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* My packs tab */}
          {tab === 'mine' && (
            <div className="space-y-2">
              {myLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="card animate-pulse"><div className="h-5 w-40 bg-neutral-800 rounded" /></div>
                ))
              ) : myPacks?.length === 0 ? (
                <div className="card text-center py-8">
                  <p className="text-neutral-500 text-sm">You haven't created any packs yet.</p>
                  <button onClick={() => setTab('create')} className="mt-3 text-brand-400 text-sm font-semibold hover:text-brand-300">
                    Create your first pack →
                  </button>
                </div>
              ) : myPacks?.map((pack) => (
                <div key={pack.id} className="card">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{pack.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-neutral-500">{pack._count?.pairs ?? pack.pairs?.length ?? 0} pairs</span>
                        {pack.isApproved ? (
                          <span className="text-xs text-emerald-400">✓ Approved</span>
                        ) : pack.isPublic ? (
                          <span className="text-xs text-amber-400">⏳ Pending review</span>
                        ) : (
                          <span className="text-xs text-neutral-500">Private</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(pack.id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-red-500 hover:text-red-400 font-semibold transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create tab */}
          {tab === 'create' && (
            <div className="card space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Create Word Pack</p>

              <div className="space-y-3">
                <input
                  placeholder="Pack name *"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-brand-600"
                />
                <input
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-brand-600"
                />
                <div className="flex items-center gap-4">
                  <select
                    value={form.locale}
                    onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
                    className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm focus:outline-none"
                  >
                    {['en', 'fr', 'ar', 'es', 'de'].map((l) => (
                      <option key={l} value={l}>{l.toUpperCase()}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isPublic}
                      onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
                      className="rounded"
                    />
                    Submit for public review
                  </label>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-neutral-500 mb-2">Word Pairs ({validPairs.length} valid)</p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {pairs.map((pair, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        placeholder="Word A"
                        value={pair.wordA}
                        onChange={(e) => updatePair(i, 'wordA', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-xs focus:outline-none focus:border-brand-600"
                      />
                      <span className="text-neutral-600 text-xs">↔</span>
                      <input
                        placeholder="Word B"
                        value={pair.wordB}
                        onChange={(e) => updatePair(i, 'wordB', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-xs focus:outline-none focus:border-brand-600"
                      />
                      <select
                        value={pair.difficulty}
                        onChange={(e) => updatePair(i, 'difficulty', e.target.value)}
                        className={['px-2 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-xs focus:outline-none', DIFFICULTY_COLORS[pair.difficulty]].join(' ')}
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                      {pairs.length > 1 && (
                        <button onClick={() => removePair(i)} className="text-neutral-600 hover:text-red-400 text-xs transition-colors">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addPair} className="mt-2 text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors">
                  + Add pair
                </button>
              </div>

              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.name.trim() || validPairs.length === 0 || createMutation.isPending}
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? 'Creating…' : 'Create Pack'}
              </button>
              {createMutation.isError && (
                <p className="text-xs text-red-400">{(createMutation.error as Error).message}</p>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
