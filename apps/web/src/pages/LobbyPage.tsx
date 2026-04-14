import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Locale } from '@imposter/shared'
import { useAuthStore } from '../store/auth'
import { useGameStore } from '../store/game'
import { connectSocket, getSocket } from '../lib/socket'
import { api } from '../lib/api'
import { RoomCodeDisplay, PlayerCard } from '@imposter/ui'
import { NavBar } from '../components/NavBar'
import { WORD_CATEGORIES } from '@imposter/shared'
import type { Room, GameMode, WordCategory } from '@imposter/shared'
import { createLogger } from '../lib/logger'
import { SoundManager } from '../lib/sounds'

const log = createLogger('lobby')

interface Friend {
  friendshipId: string
  user: { id: string; username: string; avatarUrl: string | null }
}

interface Settings {
  maxPlayers: number
  imposterCount: number
  speakingTimeSeconds: number
  votingTimeSeconds: number
  gameMode: GameMode
  categories: WordCategory[]
  detectiveCount: number
  doubleAgentCount: number
  guardianCount: number
  mayorCount: number
  infiltratorCount: number
  jesterCount: number
  judgeCount: number
  revenantCount: number
  kamikazeCount: number
  corruptorCount: number
  inverterCount: number
  evilTwinsEnabled: number
  maxRounds: number
  language: Locale
  /** Vocal mode: per-player speak-out-loud turns (unranked only). */
  vocalMode: boolean
  /** Seconds per player when vocal mode is on. */
  vocalSpeakingTimeSeconds: number
}

function NumStepper({
  label, value, min, max, step = 1,
  format, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number
  format?: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-neutral-300 flex-1">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold transition-colors"
        >−</button>
        <span className="text-sm font-mono font-semibold text-white w-14 text-center">
          {format ? format(value) : value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold transition-colors"
        >+</button>
      </div>
    </div>
  )
}

/**
 * A NumStepper variant for special roles:
 *  - accent color per team (villager/imposter/neutral)
 *  - native-title tooltip (hover) showing what the role does
 *  - soft-disables the + button once the role can't grow any further
 *  - gates the whole row behind a "lockedReason" (e.g. neutral under 10 players)
 */
function RoleStepper({
  icon, label, description, value, min = 0, max, onChange, accent, lockedReason,
}: {
  icon: string
  label: string
  description: string
  value: number
  min?: number
  max: number
  onChange: (v: number) => void
  accent: 'emerald' | 'red' | 'sky'
  lockedReason?: string | null
}) {
  const isLocked = !!lockedReason
  const canDec = !isLocked && value > min
  const canInc = !isLocked && value < max
  // Tailwind-safe static class names keyed by accent
  const ACCENT = {
    emerald: {
      chip: 'text-emerald-300 bg-emerald-950/40 border-emerald-700/40',
      value: 'text-emerald-300',
    },
    red: {
      chip: 'text-red-300 bg-red-950/40 border-red-700/40',
      value: 'text-red-300',
    },
    sky: {
      chip: 'text-sky-300 bg-sky-950/40 border-sky-700/40',
      value: 'text-sky-300',
    },
  } as const
  const a = ACCENT[accent]
  return (
    <div
      title={isLocked ? lockedReason! : description}
      className={[
        'flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-colors',
        isLocked
          ? 'bg-neutral-900/40 border-neutral-800/60 opacity-50'
          : 'bg-neutral-900/50 border-neutral-800/60 hover:border-neutral-700',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={[
          'inline-flex items-center justify-center w-7 h-7 rounded-lg border text-sm',
          a.chip,
        ].join(' ')}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{label}</p>
          <p className="text-[10px] text-neutral-500 truncate" title={description}>
            {isLocked ? lockedReason : description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => { if (canDec) onChange(Math.max(min, value - 1)) }}
          disabled={!canDec}
          className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >−</button>
        <span className={`text-sm font-mono font-bold w-7 text-center ${isLocked ? 'text-neutral-600' : a.value}`}>
          {value}
        </span>
        <button
          type="button"
          onClick={() => { if (canInc) onChange(Math.min(max, value + 1)) }}
          disabled={!canInc}
          className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >+</button>
      </div>
    </div>
  )
}

function SettingsPanel({
  settings, onChange,
}: { settings: Settings; onChange: (s: Settings) => void }) {
  const { t, i18n } = useTranslation()

  const toggleCategory = (key: WordCategory) => {
    const cats = settings.categories.includes(key)
      ? settings.categories.filter((c) => c !== key)
      : [...settings.categories, key]
    onChange({ ...settings, categories: cats })
  }

  const handleModeChange = (mode: GameMode) => {
    onChange({
      ...settings,
      gameMode: mode,
      detectiveCount:   mode === 'normal' ? 0 : settings.detectiveCount,
      doubleAgentCount: mode === 'normal' ? 0 : settings.doubleAgentCount,
      guardianCount:    mode === 'normal' ? 0 : settings.guardianCount,
      mayorCount:       mode === 'normal' ? 0 : settings.mayorCount,
      infiltratorCount: mode === 'normal' ? 0 : settings.infiltratorCount,
      jesterCount:      mode === 'normal' ? 0 : settings.jesterCount,
      judgeCount:       mode === 'normal' ? 0 : settings.judgeCount,
      revenantCount:    mode === 'normal' ? 0 : settings.revenantCount,
      kamikazeCount:    mode === 'normal' ? 0 : settings.kamikazeCount,
      corruptorCount:   mode === 'normal' ? 0 : settings.corruptorCount,
      inverterCount:    mode === 'normal' ? 0 : settings.inverterCount,
      evilTwinsEnabled: mode === 'normal' ? 0 : settings.evilTwinsEnabled,
      // Ranked never supports vocal mode — force-disable when switching in.
      vocalMode:        mode === 'ranked' ? false : settings.vocalMode,
    })
  }

  return (
    <div className="card space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{t('lobby.roomSettings')}</p>

      {/* Game mode */}
      <div>
        <p className="text-xs text-neutral-500 mb-2">{t('lobby.gameMode')}</p>
        <div className="flex gap-2">
          <button
            onClick={() => handleModeChange('normal')}
            className={[
              'flex-1 py-2 rounded-xl text-sm font-semibold transition-all border',
              settings.gameMode === 'normal'
                ? 'bg-brand-950/60 border-brand-700/50 text-brand-400'
                : 'bg-neutral-800/60 border-neutral-700/50 text-neutral-400 hover:text-white',
            ].join(' ')}
          >
            🎭 {t('lobby.normal')}
          </button>
          <button
            onClick={() => handleModeChange('special')}
            className={[
              'flex-1 py-2 rounded-xl text-sm font-semibold transition-all border',
              settings.gameMode === 'special'
                ? 'bg-purple-950/60 border-purple-700/50 text-purple-400'
                : 'bg-neutral-800/60 border-neutral-700/50 text-neutral-400 hover:text-white',
            ].join(' ')}
          >
            ✨ {t('lobby.special')}
          </button>
        </div>
        <p className="text-xs text-neutral-600 mt-1.5">
          {settings.gameMode === 'special' ? t('lobby.specialDesc') : t('lobby.normalDesc')}
        </p>
      </div>

      {/* Special roles */}
      {settings.gameMode === 'special' && (() => {
        // ── Capacity math ────────────────────────────────────────────────
        // Special evil roles must fit within imposterCount budget.
        // Evil Twins counts as 2 slots (1 villager + 1 imposter).
        const twinSlot = settings.evilTwinsEnabled ?? 0 // 0 or 1 (a twin PAIR)

        const evilExtras =
          settings.doubleAgentCount +
          (settings.infiltratorCount ?? 0) +
          (settings.kamikazeCount ?? 0) +
          (settings.corruptorCount ?? 0) +
          (settings.inverterCount ?? 0) +
          twinSlot // twin_imposter

        // Villager-side special slots (detective/guardian/mayor/judge/revenant).
        const currentGoodSpecial =
          settings.detectiveCount +
          settings.guardianCount +
          (settings.mayorCount ?? 0) +
          (settings.judgeCount ?? 0) +
          (settings.revenantCount ?? 0)
        const villagerSlotsUsed = settings.imposterCount + currentGoodSpecial + twinSlot // +twinSlot = twin_villager

        // Per-role maxima: how high each role can go WITHOUT breaking the rules
        // (and assuming other counts stay fixed).
        const evilHeadroom = Math.max(0, settings.imposterCount - evilExtras)
        const goodHeadroom = Math.max(0, settings.maxPlayers - villagerSlotsUsed)

        const maxDetective  = Math.min(3, settings.detectiveCount  + goodHeadroom)
        const maxGuardian   = Math.min(2, settings.guardianCount   + goodHeadroom)
        const maxMayor      = Math.min(1, (settings.mayorCount ?? 0)    + goodHeadroom)
        const maxJudge      = Math.min(1, (settings.judgeCount ?? 0)    + goodHeadroom)
        const maxRevenant   = Math.min(1, (settings.revenantCount ?? 0) + goodHeadroom)

        const maxDoubleAgent = Math.min(2, settings.doubleAgentCount    + evilHeadroom)
        const maxInfiltrator = Math.min(2, (settings.infiltratorCount ?? 0) + evilHeadroom)
        const maxKamikaze    = Math.min(2, (settings.kamikazeCount ?? 0)    + evilHeadroom)
        const maxCorruptor   = Math.min(1, (settings.corruptorCount ?? 0)   + evilHeadroom)
        const maxInverter    = Math.min(1, (settings.inverterCount ?? 0)    + evilHeadroom)

        // Neutral roles (jester) only available with ≥ 10 players.
        const neutralUnlocked = settings.maxPlayers >= 10
        const neutralLockReason = neutralUnlocked
          ? null
          : t('lobby.neutralUnlockHint', { defaultValue: 'Unlocked at 10+ players.' })
        const maxJester = neutralUnlocked ? Math.min(1, (settings.jesterCount ?? 0) + goodHeadroom) : 0

        // Evil Twins (pair) takes 2 slots on opposite sides.
        const maxEvilTwins = Math.min(
          1,
          twinSlot + Math.min(evilHeadroom, goodHeadroom),
        )

        return (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500">{t('lobby.specialRoles')}</p>

            {/* ── Villager side ─────────────────────────────────────────── */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                🟢 {t('lobby.teamVillagers', { defaultValue: 'Villagers' })}
              </p>
              <RoleStepper
                icon="🔍"
                label={t('lobby.detectiveCount', { defaultValue: 'Detective' })}
                description={t('lobby.detectiveDesc', { defaultValue: 'Each round, secretly reveals whether a chosen player is an imposter.' })}
                value={settings.detectiveCount}
                max={maxDetective}
                onChange={(v) => onChange({ ...settings, detectiveCount: v })}
                accent="emerald"
              />
              <RoleStepper
                icon="🛡️"
                label={t('lobby.guardianCount', { defaultValue: 'Guardian' })}
                description={t('lobby.guardianDesc', { defaultValue: 'Protects a chosen player from elimination for one round.' })}
                value={settings.guardianCount}
                max={maxGuardian}
                onChange={(v) => onChange({ ...settings, guardianCount: v })}
                accent="emerald"
              />
              <RoleStepper
                icon="👑"
                label={t('lobby.mayorCount', { defaultValue: 'Mayor' })}
                description={t('lobby.mayorDesc', { defaultValue: 'Their vote counts double during the voting phase.' })}
                value={settings.mayorCount ?? 0}
                max={maxMayor}
                onChange={(v) => onChange({ ...settings, mayorCount: v })}
                accent="emerald"
              />
              <RoleStepper
                icon="⚖️"
                label={t('lobby.judgeCount', { defaultValue: 'Judge' })}
                description={t('lobby.judgeDesc', { defaultValue: 'Can veto one elimination per game.' })}
                value={settings.judgeCount ?? 0}
                max={maxJudge}
                onChange={(v) => onChange({ ...settings, judgeCount: v })}
                accent="emerald"
              />
              <RoleStepper
                icon="👻"
                label={t('lobby.revenantCount', { defaultValue: 'Revenant' })}
                description={t('lobby.revenantDesc', { defaultValue: 'If eliminated, returns once during the next round.' })}
                value={settings.revenantCount ?? 0}
                max={maxRevenant}
                onChange={(v) => onChange({ ...settings, revenantCount: v })}
                accent="emerald"
              />
            </div>

            {/* ── Imposter side ─────────────────────────────────────────── */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
                🔴 {t('lobby.teamImposters', { defaultValue: 'Imposters' })}
              </p>
              <RoleStepper
                icon="🕵️"
                label={t('lobby.doubleAgentCount', { defaultValue: 'Double Agent' })}
                description={t('lobby.doubleAgentDesc', { defaultValue: 'Pretends to be a villager but wins with the imposters. Knows both words.' })}
                value={settings.doubleAgentCount}
                max={maxDoubleAgent}
                onChange={(v) => onChange({ ...settings, doubleAgentCount: v })}
                accent="red"
              />
              <RoleStepper
                icon="🥷"
                label={t('lobby.infiltratorCount', { defaultValue: 'Infiltrator' })}
                description={t('lobby.infiltratorDesc', { defaultValue: 'An extra imposter who starts knowing the villager word.' })}
                value={settings.infiltratorCount ?? 0}
                max={maxInfiltrator}
                onChange={(v) => onChange({ ...settings, infiltratorCount: v })}
                accent="red"
              />
              <RoleStepper
                icon="💣"
                label={t('lobby.kamikazeCount', { defaultValue: 'Kamikaze' })}
                description={t('lobby.kamikazeDesc', { defaultValue: 'When voted out, takes the player who cast the most votes with them.' })}
                value={settings.kamikazeCount ?? 0}
                max={maxKamikaze}
                onChange={(v) => onChange({ ...settings, kamikazeCount: v })}
                accent="red"
              />
              <RoleStepper
                icon="🧪"
                label={t('lobby.corruptorCount', { defaultValue: 'Corruptor' })}
                description={t('lobby.corruptorDesc', { defaultValue: 'Can flip one villager\u2019s vote once per game.' })}
                value={settings.corruptorCount ?? 0}
                max={maxCorruptor}
                onChange={(v) => onChange({ ...settings, corruptorCount: v })}
                accent="red"
              />
              <RoleStepper
                icon="🔀"
                label={t('lobby.inverterCount', { defaultValue: 'Inverter' })}
                description={t('lobby.inverterDesc', { defaultValue: 'Swaps the result of one vote (majority \u2194 minority).' })}
                value={settings.inverterCount ?? 0}
                max={maxInverter}
                onChange={(v) => onChange({ ...settings, inverterCount: v })}
                accent="red"
              />
            </div>

            {/* ── Pair / special duo ────────────────────────────────────── */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                ⚖️ {t('lobby.teamPair', { defaultValue: 'Pair' })}
              </p>
              <RoleStepper
                icon="👯"
                label={t('lobby.evilTwinsCount', { defaultValue: 'Evil Twins' })}
                description={t('lobby.evilTwinsDesc', { defaultValue: 'A pair: one secret villager twin + one secret imposter twin (counts as 2 players).' })}
                value={settings.evilTwinsEnabled ?? 0}
                max={maxEvilTwins}
                onChange={(v) => onChange({ ...settings, evilTwinsEnabled: v })}
                accent="sky"
              />
            </div>

            {/* ── Neutral (unlocked at 10+ players) ─────────────────────── */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">
                ⚪ {t('lobby.teamNeutral', { defaultValue: 'Neutral' })}
              </p>
              <RoleStepper
                icon="🃏"
                label={t('lobby.jesterCount', { defaultValue: 'Jester' })}
                description={t('lobby.jesterDesc', { defaultValue: 'Wins alone if voted out. Does not help villagers or imposters.' })}
                value={settings.jesterCount ?? 0}
                max={maxJester}
                onChange={(v) => onChange({ ...settings, jesterCount: v })}
                accent="sky"
                lockedReason={neutralLockReason}
              />
            </div>
          </div>
        )
      })()}


      {/* Category picker */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-neutral-500">{t('lobby.categories')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => onChange({ ...settings, categories: WORD_CATEGORIES.map((c) => c.key as WordCategory) })}
              className="text-[10px] text-brand-400 hover:text-brand-300"
            >{t('lobby.catAll')}</button>
            <span className="text-neutral-700">·</span>
            <button
              onClick={() => onChange({ ...settings, categories: [] })}
              className="text-[10px] text-neutral-500 hover:text-neutral-400"
            >{t('lobby.catNone')}</button>
          </div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 md:gap-2">
          {WORD_CATEGORIES.map((cat) => {
            const selected = settings.categories.includes(cat.key as WordCategory)
            return (
              <button
                key={cat.key}
                onClick={() => toggleCategory(cat.key as WordCategory)}
                className={[
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  selected
                    ? 'bg-brand-950/60 border-brand-700/50 text-brand-300'
                    : settings.categories.length === 0
                      ? 'bg-neutral-800/40 border-neutral-700/30 text-neutral-400'
                      : 'bg-neutral-900/40 border-neutral-800/40 text-neutral-600',
                ].join(' ')}
              >
                <span>{cat.icon}</span>
                <span className="truncate">{t(`home.cat.${cat.key}`, cat.label)}</span>
              </button>
            )
          })}
        </div>
        {settings.categories.length === 0 && (
          <p className="text-[10px] text-neutral-600 mt-1">{t('lobby.catNoFilter')}</p>
        )}
      </div>

      {/* Numeric settings */}
      <div className="space-y-3 pt-1 border-t border-neutral-800">
        {settings.gameMode === 'ranked' ? (
          // Ranked games are locked at 10 players and 3 imposters. Show a
          // read-only summary instead of the configurable steppers.
          <div className="rounded-xl border border-brand-700/40 bg-brand-950/30 p-3 text-xs text-brand-300 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">{t('lobby.maxPlayers')}</span>
              <span className="font-mono font-semibold">10</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">{t('lobby.imposters')}</span>
              <span className="font-mono font-semibold">3</span>
            </div>
            <p className="text-[10px] text-neutral-500 pt-1">
              {t('lobby.rankedLocked', {
                defaultValue: 'Ranked games always have 7 villagers and 3 imposters.',
              })}
            </p>
          </div>
        ) : (
          <>
            <NumStepper
              label={t('lobby.maxPlayers')}
              value={settings.maxPlayers}
              min={3}
              max={20}
              onChange={(v) => {
                // Cap imposters to floor(N/3) when player count drops
                const evilCap = Math.max(1, Math.floor(v / 3))
                const cappedImposters = Math.min(settings.imposterCount, evilCap)
                // Auto-reduce special evil roles if they exceed new imposterCount
                const specials = settings.doubleAgentCount +
                  (settings.infiltratorCount ?? 0) + (settings.kamikazeCount ?? 0) +
                  (settings.corruptorCount ?? 0) + (settings.inverterCount ?? 0) +
                  (settings.evilTwinsEnabled ?? 0)
                let remaining = Math.max(0, specials - cappedImposters)
                const reduced = { ...settings }
                const keys: (keyof typeof reduced)[] = [
                  'evilTwinsEnabled', 'inverterCount', 'corruptorCount',
                  'kamikazeCount', 'infiltratorCount', 'doubleAgentCount',
                ]
                for (const k of keys) {
                  if (remaining <= 0) break
                  const cur = (reduced[k] as number) ?? 0
                  const r = Math.min(cur, remaining)
                  ;(reduced as any)[k] = cur - r
                  remaining -= r
                }
                onChange({
                  ...reduced,
                  maxPlayers: v,
                  imposterCount: cappedImposters,
                })
              }}
            />
            <NumStepper
              label={t('lobby.imposters')}
              value={settings.imposterCount}
              min={1}
              max={Math.min(6, Math.max(1, Math.floor(settings.maxPlayers / 3)))}
              onChange={(v) => {
                // Auto-reduce special evil roles if they exceed new imposterCount
                const specials = settings.doubleAgentCount +
                  (settings.infiltratorCount ?? 0) + (settings.kamikazeCount ?? 0) +
                  (settings.corruptorCount ?? 0) + (settings.inverterCount ?? 0) +
                  (settings.evilTwinsEnabled ?? 0)
                let remaining = Math.max(0, specials - v)
                const reduced = { ...settings }
                const keys: (keyof typeof reduced)[] = [
                  'evilTwinsEnabled', 'inverterCount', 'corruptorCount',
                  'kamikazeCount', 'infiltratorCount', 'doubleAgentCount',
                ]
                for (const k of keys) {
                  if (remaining <= 0) break
                  const cur = (reduced[k] as number) ?? 0
                  const r = Math.min(cur, remaining)
                  ;(reduced as any)[k] = cur - r
                  remaining -= r
                }
                onChange({
                  ...reduced,
                  imposterCount: v,
                })
              }}
            />
          </>
        )}
        <NumStepper
          label={t('lobby.rounds')}
          value={settings.maxRounds}
          min={0} max={20}
          format={(v) => v === 0 ? '∞' : `${v}`}
          onChange={(v) => onChange({ ...settings, maxRounds: v })}
        />
        <NumStepper label={t('lobby.speakingTime')} value={settings.speakingTimeSeconds}  min={10} max={120} step={5} format={(v) => `${v}s`} onChange={(v) => onChange({ ...settings, speakingTimeSeconds: v })} />
        <NumStepper label={t('lobby.votingTime')}   value={settings.votingTimeSeconds}    min={15} max={120} step={5} format={(v) => `${v}s`} onChange={(v) => onChange({ ...settings, votingTimeSeconds: v })} />

        {/* ── Vocal mode (unranked only) ──────────────────────────────────── */}
        {settings.gameMode !== 'ranked' && (
          <div className="pt-2 border-t border-neutral-800/60 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white flex items-center gap-2">
                  <span>🎙️</span>
                  <span>{t('lobby.vocalMode', 'Vocal mode')}</span>
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {t('lobby.vocalModeDesc', 'Each player speaks out loud on their turn — no typing.')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.vocalMode}
                aria-label={t('lobby.vocalMode', 'Vocal mode')}
                onClick={() => onChange({ ...settings, vocalMode: !settings.vocalMode })}
                className={[
                  'relative w-11 h-6 rounded-full transition-colors shrink-0',
                  settings.vocalMode ? 'bg-brand-600' : 'bg-neutral-800',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                    settings.vocalMode ? 'translate-x-5' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </div>

            {settings.vocalMode && (
              <NumStepper
                label={t('lobby.vocalTurnTime', 'Vocal turn time')}
                value={settings.vocalSpeakingTimeSeconds}
                min={5}
                max={60}
                step={5}
                format={(v) => `${v}s`}
                onChange={(v) => onChange({ ...settings, vocalSpeakingTimeSeconds: v })}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const { room, setRoom, setRoleAndWord, setRound } = useGameStore()

  // Block joining a DIFFERENT lobby while in an active game
  const activeRoom = useGameStore((s) => s.room)
  const isInActiveGame = activeRoom && (activeRoom.status === 'in_progress' || activeRoom.status === 'voting')
  const isDifferentGame = isInActiveGame && activeRoom.code !== code
  useEffect(() => {
    if (isDifferentGame) {
      navigate('/', { replace: true })
    }
  }, [isDifferentGame, navigate])
  const [isReady, setIsReady] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [joinToast, setJoinToast] = useState<string | null>(null)
  const [socketError, setSocketError] = useState<string | null>(null)
  const prevPlayerCountRef = useRef(0)
  const langSyncedRef = useRef(false)
  const [showInvite, setShowInvite] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendSearch, setFriendSearch] = useState('')
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [settings, setSettings] = useState<Settings>({
    maxPlayers: 10,
    imposterCount: 2,
    speakingTimeSeconds: 30,
    votingTimeSeconds: 30,
    gameMode: 'normal',
    categories: [],
    detectiveCount: 0,
    doubleAgentCount: 0,
    guardianCount: 0,
    mayorCount: 0,
    infiltratorCount: 0,
    jesterCount: 0,
    judgeCount: 0,
    revenantCount: 0,
    kamikazeCount: 0,
    corruptorCount: 0,
    inverterCount: 0,
    evilTwinsEnabled: 0,
    maxRounds: 0,
    language: (i18n.language.split('-')[0] as Locale) || 'en',
    vocalMode: false,
    vocalSpeakingTimeSeconds: 10,
  })
  const [copied, setCopied] = useState(false)

  const handleSettingsChange = (s: Settings) => {
    // TEMP DEBUG: trace every settings change so we can see mayor/judge/revenant flow
    // eslint-disable-next-line no-console
    console.log('[lobby] settings change →', {
      mayor: s.mayorCount, judge: s.judgeCount, revenant: s.revenantCount,
      detective: s.detectiveCount, guardian: s.guardianCount,
      imposter: s.imposterCount, doubleAgent: s.doubleAgentCount,
      maxPlayers: s.maxPlayers, gameMode: s.gameMode,
    })
    setSettings(s)
    getSocket().emit('room:settings' as any, {
      gameMode: s.gameMode,
      categories: s.categories,
      detectiveCount: s.detectiveCount,
      doubleAgentCount: s.doubleAgentCount,
      guardianCount: s.guardianCount,
      mayorCount: s.mayorCount,
      infiltratorCount: s.infiltratorCount,
      jesterCount: s.jesterCount,
      judgeCount: s.judgeCount,
      revenantCount: s.revenantCount,
      kamikazeCount: s.kamikazeCount,
      corruptorCount: s.corruptorCount,
      inverterCount: s.inverterCount,
      evilTwinsEnabled: s.evilTwinsEnabled,
      maxRounds: s.maxRounds,
      maxPlayers: s.maxPlayers,
      imposterCount: s.imposterCount,
      speakingTimeSeconds: s.speakingTimeSeconds,
      votingTimeSeconds: s.votingTimeSeconds,
      language: s.language,
      vocalMode: s.vocalMode,
      vocalSpeakingTimeSeconds: s.vocalSpeakingTimeSeconds,
    })
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 1500)
  }

  useEffect(() => {
    if (!code) return
    log.info('joining room', { code })
    connectSocket()
    const socket = getSocket()
    socket.emit('room:join', { roomCode: code })

    // Re-join on reconnect so the player stays in the socket.io room even after a brief disconnect
    const handleConnect = () => {
      log.info('reconnected, re-joining room', { code })
      socket.emit('room:join', { roomCode: code })
    }
    socket.on('connect', handleConnect)

    // ── Heartbeat: re-emit room:join every 8s as a safety net ────────────────
    // Under certain network conditions (mobile sleep, flaky WebSocket, proxies
    // that drop idle connections), the socket can silently drift out of the
    // socket.io room channel without triggering a `disconnect` event. When
    // that happens, the client keeps its `room:updated` listener registered
    // but the server no longer broadcasts to it. Re-emitting `room:join` is
    // idempotent on the server (it just updates the socket.id and re-broadcasts
    // the current room state), so this heartbeat guarantees the lobby stays
    // in sync even if the socket got wedged. Cheap — one tiny packet every 8s.
    const heartbeat = setInterval(() => {
      const s = getSocket()
      if (!s.connected) {
        log.info('heartbeat: socket disconnected, reconnecting', { code })
        connectSocket()
        return
      }
      s.emit('room:join', { roomCode: code })
    }, 8000)

    const modeParam = searchParams.get('mode')
    if (modeParam === 'normal' || modeParam === 'special') {
      setTimeout(() => {
        getSocket().emit('room:settings' as any, { gameMode: modeParam })
      }, 500)
    }

    socket.on('room:updated', (r) => {
      // TEMP DEBUG: trace every room:updated payload from the server
      // eslint-disable-next-line no-console
      console.log('[lobby] room:updated ←', {
        mayor: (r.settings as any)?.mayorCount,
        judge: (r.settings as any)?.judgeCount,
        revenant: (r.settings as any)?.revenantCount,
        detective: (r.settings as any)?.detectiveCount,
        imposter: r.settings?.imposterCount,
        gameMode: (r.settings as any)?.gameMode,
      })
      // If the game already started (e.g. we missed game:started), navigate immediately
      if ((r as any).status === 'in_progress' || (r as any).status === 'voting') {
        log.info('room already in progress, navigating to game', { code })
        navigate(`/game/${code}`)
        return
      }
      log.debug('room updated', { players: r.players?.length, status: (r as any).status })
      setRoom(r as Room)
      if (r.players && r.players.length > prevPlayerCountRef.current) {
        const newPlayer = r.players[r.players.length - 1]
        if (newPlayer && newPlayer.userId !== user?.id) {
          SoundManager.play('notification')
          setJoinToast(t('lobby.joinedRoom', { name: newPlayer.username }))
          setTimeout(() => setJoinToast(null), 2500)
        }
      }
      prevPlayerCountRef.current = r.players?.length ?? 0
      if (r.players && user) {
        const me = r.players.find((p: any) => p.userId === user.id)
        if (me) setIsReady(!!me.isReady)
      }
      if (r.settings) {
        const serverCats: WordCategory[] = (r.settings as any).categories ?? []
        const roomLang = (r.settings.language as Locale) ?? 'en'
        setSettings((prev) => ({
          ...prev,
          maxPlayers: r.settings.maxPlayers,
          imposterCount: r.settings.imposterCount,
          speakingTimeSeconds: r.settings.speakingTimeSeconds,
          votingTimeSeconds: r.settings.votingTimeSeconds,
          gameMode: (r.settings as any).gameMode ?? 'normal',
          categories: serverCats,
          detectiveCount: (r.settings as any).detectiveCount ?? ((r.settings as any).enableDetective ? 1 : 0),
          doubleAgentCount: (r.settings as any).doubleAgentCount ?? ((r.settings as any).enableDoubleAgent ? 1 : 0),
          guardianCount: (r.settings as any).guardianCount ?? 0,
          mayorCount: (r.settings as any).mayorCount ?? 0,
          infiltratorCount: (r.settings as any).infiltratorCount ?? 0,
          jesterCount: (r.settings as any).jesterCount ?? 0,
          judgeCount: (r.settings as any).judgeCount ?? 0,
          revenantCount: (r.settings as any).revenantCount ?? 0,
          kamikazeCount: (r.settings as any).kamikazeCount ?? 0,
          corruptorCount: (r.settings as any).corruptorCount ?? 0,
          inverterCount: (r.settings as any).inverterCount ?? 0,
          evilTwinsEnabled: (r.settings as any).evilTwinsEnabled ?? 0,
          maxRounds: r.maxRounds ?? 0,
          language: roomLang,
          vocalMode: (r.settings as any).vocalMode ?? false,
          vocalSpeakingTimeSeconds: (r.settings as any).vocalSpeakingTimeSeconds ?? 10,
        }))
        // Switch UI language to match the room's language (only on first join)
        if (!langSyncedRef.current && i18n.language.split('-')[0] !== roomLang) {
          i18n.changeLanguage(roomLang)
          document.documentElement.dir = roomLang === 'ar' ? 'rtl' : 'ltr'
        }
        langSyncedRef.current = true
      }
    })
    socket.on('game:started', ({ round, yourWord, yourRole, yourVillagerWord }) => {
      log.info('game started', { role: yourRole, roundId: (round as any)?.id })
      SoundManager.play('game_start')
      setRoleAndWord(yourRole, yourWord, yourVillagerWord)
      setRound(round as any)
      navigate(`/game/${code}`)
    })
    socket.on('error', (err) => {
      const msg = (err as any).code === 'LANGUAGE_MISMATCH'
        ? t('room.languageMismatch')
        : err.message
      log.warn('socket error', { code: (err as any).code, message: err.message })
      setSocketError(msg)
      setTimeout(() => setSocketError(null), 4000)
    })
    // Game start was refused because at least one player can't afford the
    // entry cost. Stays non-blocking: everyone stays in the lobby. We read the
    // latest players list from the store rather than capturing it in the
    // closure — the effect deps are [code], so any captured array is stale.
    socket.on('game:start:failed' as any, (data: { reason?: string; userId?: string; required?: number }) => {
      if (data?.reason !== 'INSUFFICIENT_STARS') return
      const currentRoom = useGameStore.getState().room
      const player = currentRoom?.players?.find((p: any) => p.userId === data.userId)
      const username = (player as any)?.username ?? 'A player'
      const msg = t('results.insufficientStarsPlayer', { username, required: data.required ?? 10 })
      log.warn('game:start:failed', { userId: data.userId })
      setSocketError(msg)
      setTimeout(() => setSocketError(null), 5000)
    })

    return () => {
      clearInterval(heartbeat)
      socket.off('connect', handleConnect)
      socket.off('room:updated')
      socket.off('game:started')
      socket.off('error')
      socket.off('game:start:failed' as any)
    }
  }, [code])

  const toggleReady = () => {
    SoundManager.play('click')
    getSocket().emit('player:ready', !isReady)
    setIsReady((r) => !r)
  }

  const startGame = () => getSocket().emit('game:start')

  const toggleInvite = async () => {
    const next = !showInvite
    setShowInvite(next)
    if (next && friends.length === 0) {
      try {
        const data = await api.get<{ friends: Friend[] }>('/friends')
        setFriends(data.friends)
      } catch {}
    }
  }

  const copyRoomCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement('textarea')
      el.value = code
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareRoom = async () => {
    if (!code) return
    const url = `${window.location.origin}/lobby/${code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my Imposter game!', text: `Join room ${code}`, url })
      } catch {}
    } else {
      copyRoomCode()
    }
  }

  const sendInvite = (friendId: string) => {
    if (!code) return
    getSocket().emit('room:invite' as any, { toUserId: friendId, roomCode: code })
    setInvitedIds((prev) => new Set([...prev, friendId]))
  }

  const isMatchmade = (room?.settings as any)?.isMatchmade ?? false
  const isHost = !isMatchmade && room?.hostId === user?.id
  const players = room?.players ?? []
  const allReady = players.length >= 2 && players.every((p) => p.isReady || p.userId === room?.hostId)
  const minPlayers = 3
  const activeCats = settings.categories.length > 0
    ? settings.categories.length
    : WORD_CATEGORIES.length

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      {joinToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-sm text-white font-semibold shadow-xl animate-slide-up flex items-center gap-2">
          <span className="text-emerald-400">+</span>
          {joinToast}
        </div>
      )}

      {socketError && (
        <div role="alert" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-red-950/90 border border-red-700/60 text-sm text-red-300 font-semibold shadow-xl animate-slide-up flex items-center gap-2">
          <span>⚠</span>
          {socketError}
        </div>
      )}

      <main id="main-content" role="main" className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 animate-slide-up">

          <div className="text-center mb-2">
            <p className="text-xs md:text-sm font-semibold uppercase tracking-widest text-neutral-500 mb-1">{t('room.roomCode')}</p>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white">{t('lobby.waiting')}</h1>
            <p className="text-neutral-500 text-sm md:text-base mt-1">{t('lobby.shareHint')}</p>
          </div>

          <div className="flex flex-col items-center gap-3">
            {code && (
              <div className="ring-1 ring-brand-600/30 rounded-2xl shadow-lg shadow-brand-950/30">
                <RoomCodeDisplay code={code} />
              </div>
            )}
            <button
              onClick={shareRoom}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white border border-neutral-700/60 hover:border-neutral-600 transition-all shadow-sm"
            >
              {t('lobby.share')}
            </button>
          </div>

          {/* Player list */}
          <div className="card space-y-2 border-neutral-800/60 bg-neutral-900/60" aria-live="polite">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{t('lobby.players')}</p>
              <span role="status" className="text-xs text-neutral-500 tabular-nums bg-neutral-800 px-2 py-0.5 rounded-full">
                {players.length} / {settings.maxPlayers}
              </span>
            </div>
            {players.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-neutral-800 border-2 border-dashed border-neutral-700 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
                <p className="text-neutral-500 text-sm">{t('lobby.waitingToJoin')}</p>
                <p className="text-neutral-600 text-xs mt-1">{t('lobby.needAtLeast', { count: minPlayers })}</p>
              </div>
            ) : (
              players.map((p) => (
                <div key={p.id} className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-neutral-950/40">
                  <PlayerCard player={p} isCurrentUser={p.userId === user?.id} />
                </div>
              ))
            )}
          </div>

          {players.length > 0 && players.length < minPlayers && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-800/30 text-amber-400 text-xs">
              <span>⚠</span>
              <span>{t('lobby.needMore', { min: minPlayers, more: minPlayers - players.length })}</span>
            </div>
          )}

          {/* Settings toggle (host) */}
          {isHost && (
            <button
              onClick={() => setShowSettings((s) => !s)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 transition-colors text-sm"
            >
              <span className="text-neutral-300 font-medium">⚙ {t('lobby.roomSettings')}</span>
              <div className="flex items-center gap-2 text-neutral-500 text-xs">
                {settingsSaved && (
                  <span className="text-emerald-400 font-semibold animate-fade-in">{t('lobby.saved')}</span>
                )}
                <span className={settings.gameMode === 'special' ? 'text-purple-400' : 'text-brand-400'}>
                  {settings.gameMode === 'special' ? `✨ ${t('lobby.special')}` : `🎮 ${t('lobby.normal')}`}
                </span>
                <span>·</span>
                <span>{activeCats} {t('lobby.catsShort')}</span>
                <span>{showSettings ? '▴' : '▾'}</span>
              </div>
            </button>
          )}

          {isHost && showSettings && (
            <SettingsPanel settings={settings} onChange={handleSettingsChange} />
          )}

          {/* Invite friends */}
          <button
            onClick={toggleInvite}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 transition-colors text-sm"
          >
            <span className="text-neutral-300 font-medium">{t('lobby.inviteFriends')}</span>
            <span className="text-neutral-500 text-xs">{showInvite ? '▴' : '▾'}</span>
          </button>

          {showInvite && (
            <div className="card space-y-3 animate-slide-up">
              <input
                className="input-field w-full text-sm"
                placeholder={t('lobby.searchFriends')}
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
              />
              {friends.length === 0 ? (
                <p className="text-neutral-500 text-xs text-center py-2">{t('lobby.noFriends')}</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {friends
                    .filter((f) =>
                      !friendSearch.trim() ||
                      f.user.username.toLowerCase().includes(friendSearch.toLowerCase())
                    )
                    .map((f) => (
                      <div key={f.friendshipId} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-neutral-800/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-300 flex-shrink-0">
                            {f.user.username[0]?.toUpperCase()}
                          </div>
                          <span className="text-sm text-white font-medium truncate">{f.user.username}</span>
                        </div>
                        <button
                          onClick={() => sendInvite(f.user.id)}
                          disabled={invitedIds.has(f.user.id)}
                          className={[
                            'flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                            invitedIds.has(f.user.id)
                              ? 'bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 cursor-default'
                              : 'bg-brand-600 hover:bg-brand-500 text-white',
                          ].join(' ')}
                        >
                          {invitedIds.has(f.user.id) ? t('lobby.invited') : t('lobby.invite')}
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Settings summary (non-host) */}
          {!isHost && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-500">
              <span>{settings.gameMode === 'special' ? '✨' : '🎮'}</span>
              <span>{settings.gameMode === 'special' ? t('lobby.special') : t('lobby.normal')}</span>
              <span>·</span>
              <span>{settings.maxPlayers} {t('lobby.max')}</span>
              <span>·</span>
              <span>{settings.imposterCount} {t('lobby.imposters').toLowerCase()}</span>
              <span>·</span>
              <span>{settings.maxRounds === 0 ? t('lobby.roundsInfinity') : t('lobby.roundsCount', { count: settings.maxRounds })}</span>
              {settings.gameMode === 'special' && settings.detectiveCount > 0 && (
                <><span>·</span><span>{settings.detectiveCount} {t('lobby.detectiveCount').toLowerCase()}</span></>
              )}
              {settings.gameMode === 'special' && settings.doubleAgentCount > 0 && (
                <><span>·</span><span>{settings.doubleAgentCount} {t('lobby.doubleAgentCount').toLowerCase()}</span></>
              )}
              {settings.gameMode === 'special' && settings.guardianCount > 0 && (
                <><span>·</span><span>{settings.guardianCount} {t('lobby.guardianCount').toLowerCase()}</span></>
              )}
              {settings.gameMode === 'special' && settings.mayorCount > 0 && (
                <><span>·</span><span>{settings.mayorCount} {t('lobby.mayorCount').toLowerCase()}</span></>
              )}
              {settings.gameMode === 'special' && settings.infiltratorCount > 0 && (
                <><span>·</span><span>{settings.infiltratorCount} {t('lobby.infiltratorCount').toLowerCase()}</span></>
              )}
              {settings.gameMode === 'special' && settings.jesterCount > 0 && (
                <><span>·</span><span>{settings.jesterCount} {t('lobby.jesterCount').toLowerCase()}</span></>
              )}
              {settings.gameMode === 'special' && settings.judgeCount > 0 && (
                <><span>·</span><span>{settings.judgeCount} {t('lobby.judgeCount').toLowerCase()}</span></>
              )}
              {settings.gameMode === 'special' && settings.revenantCount > 0 && (
                <><span>·</span><span>{settings.revenantCount} {t('lobby.revenantCount').toLowerCase()}</span></>
              )}
              {settings.gameMode === 'special' && settings.kamikazeCount > 0 && (
                <><span>·</span><span>{settings.kamikazeCount} {t('lobby.kamikazeCount').toLowerCase()}</span></>
              )}
              {settings.gameMode === 'special' && settings.corruptorCount > 0 && (
                <><span>·</span><span>{settings.corruptorCount} {t('lobby.corruptorCount').toLowerCase()}</span></>
              )}
              {settings.gameMode === 'special' && settings.inverterCount > 0 && (
                <><span>·</span><span>{settings.inverterCount} {t('lobby.inverterCount').toLowerCase()}</span></>
              )}
              {settings.gameMode === 'special' && settings.evilTwinsEnabled > 0 && (
                <><span>·</span><span>{t('lobby.evilTwins')}</span></>
              )}
              {settings.categories.length > 0 && (
                <><span>·</span><span>{settings.categories.length} {t('lobby.categories').toLowerCase()}</span></>
              )}
            </div>
          )}

          {/* Ready progress */}
          {players.length >= 2 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">{t('lobby.readyStatus')}</span>
                <span className={[
                  'font-semibold tabular-nums',
                  allReady ? 'text-emerald-400' : 'text-neutral-400',
                ].join(' ')}>
                  {t('lobby.readyCount', {
                    ready: players.filter((p) => p.isReady || p.isHost).length,
                    total: players.length,
                  })}
                </span>
              </div>
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={[
                    'h-full rounded-full transition-all duration-500',
                    allReady ? 'bg-emerald-500' : 'bg-brand-500',
                  ].join(' ')}
                  style={{ width: `${(players.filter((p) => p.isReady || p.isHost).length / Math.max(players.length, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => { log.info('leaving room', { code }); getSocket().emit('room:leave'); navigate('/') }}
              className="px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-sm transition-colors"
            >
              {t('lobby.leave')}
            </button>
            {isMatchmade ? (
              <div className="flex-1 py-3 rounded-xl bg-brand-950/60 border border-brand-700/40 text-brand-400 font-semibold text-center flex items-center justify-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                {t('lobby.autoStarting', 'Game starting automatically...')}
              </div>
            ) : !isHost ? (
              <button
                onClick={toggleReady}
                aria-label={isReady ? "Ready, click to unready" : "Click to mark as ready"}
                className={[
                  'flex-1 py-3 rounded-xl font-semibold transition-all',
                  isReady
                    ? 'bg-emerald-700/60 hover:bg-red-900/60 text-emerald-300 hover:text-red-300 border border-emerald-700/50'
                    : allReady
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 animate-pulse-slow'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20',
                ].join(' ')}
              >
                {isReady ? `✓ ${t('lobby.ready')}` : t('lobby.notReady')}
              </button>
            ) : (
              <button
                onClick={startGame}
                aria-label="Start game"
                disabled={players.length < minPlayers || !allReady}
                className={[
                  'flex-1 py-3 rounded-xl text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg',
                  allReady && players.length >= minPlayers
                    ? 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 shadow-brand-600/30 animate-pulse-slow'
                    : 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/20',
                ].join(' ')}
              >
                {t('lobby.startGame')}
              </button>
            )}
          </div>

          {isHost && !allReady && players.length >= minPlayers && (
            <p className="text-xs text-neutral-500 text-center">{t('lobby.waitingAllReady')}</p>
          )}
        </div>
      </main>
    </div>
  )
}
