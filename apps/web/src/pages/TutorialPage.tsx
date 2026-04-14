import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { TUTORIAL_COMPLETION_REWARD } from '@imposter/shared'
import { NavBar } from '../components/NavBar'
import { api } from '../lib/api'
import { createLogger } from '../lib/logger'
import { markTutorialCompletedLocally } from '../components/OnboardingTutorial'

const log = createLogger('tutorial')

type StepId =
  | 'intro'
  | 'role'
  | 'clues'
  | 'pick-clue'
  | 'suspicion'
  | 'vote'
  | 'reveal'
  | 'recap'
  | 'done'

const STEP_ORDER: StepId[] = [
  'intro', 'role', 'clues', 'pick-clue', 'suspicion', 'vote', 'reveal', 'recap', 'done',
]

interface TutorialStatus {
  completed: boolean
  reward: number
}

interface CompleteResponse {
  success: true
  alreadyCompleted: boolean
  reward: number
  starCoins: number
}

/**
 * Interactive first-game walkthrough. Plays a scripted single round against
 * three coached bots so a new player can touch every phase (role reveal →
 * clue → discussion → vote → reveal) without the pressure of a timer.
 *
 * On completion, calls POST /api/tutorial/complete which atomically flips
 * the `tutorialCompleted` flag and grants 50 star coins. The server is the
 * source of truth — this page never grants the reward client-side.
 */
export default function TutorialPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [stepIdx, setStepIdx] = useState(0)
  const [status, setStatus] = useState<TutorialStatus | null>(null)
  const [statusLoaded, setStatusLoaded] = useState(false)

  // Choices recorded during the walkthrough (used to gate advancement)
  const [roleRevealed, setRoleRevealed] = useState(false)
  const [clueChoice, setClueChoice] = useState<'good' | 'risky' | 'vague' | null>(null)
  const [suspect, setSuspect] = useState<'maya' | 'leo' | 'nora' | null>(null)
  const [voteLocked, setVoteLocked] = useState<'maya' | 'leo' | 'nora' | null>(null)
  const [votesRevealed, setVotesRevealed] = useState(false)

  // Reward state
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [claimResult, setClaimResult] = useState<CompleteResponse | null>(null)

  const currentStep = STEP_ORDER[stepIdx]

  // Fetch whether the player has already claimed the reward (shown in the
  // reward banner at the top, so returning players know they won't get paid
  // again but can still play through as a refresher).
  useEffect(() => {
    api.get<TutorialStatus>('/tutorial/status')
      .then((s) => setStatus(s))
      .catch(() => setStatus({ completed: false, reward: TUTORIAL_COMPLETION_REWARD }))
      .finally(() => setStatusLoaded(true))
  }, [])

  const totalSteps = STEP_ORDER.length
  const progressPct = Math.round(((stepIdx + 1) / totalSteps) * 100)

  const goNext = useCallback(() => {
    setStepIdx((i) => Math.min(i + 1, totalSteps - 1))
  }, [totalSteps])

  const goBack = useCallback(() => {
    setStepIdx((i) => Math.max(i - 1, 0))
  }, [])

  const grantReward = useCallback(async () => {
    setClaiming(true)
    setClaimError(null)
    try {
      const res = await api.post<CompleteResponse>('/tutorial/complete', {})
      setClaimResult(res)
      markTutorialCompletedLocally()
      // The user's star balance changed — invalidate the /auth/me query so the
      // header chip updates immediately.
      queryClient.invalidateQueries({ queryKey: ['me'] })
      log.info('tutorial completed', { reward: res.reward, balance: res.starCoins })
    } catch (err: any) {
      // Before surfacing an error, re-check the server state: the POST may
      // have fired with a briefly-stale auth token on a fresh sign-in, but
      // the reward could have already been granted on a prior attempt (or
      // a concurrent tab). If the server now reports completed=true, treat
      // this as success and synthesize an `alreadyCompleted` result so the
      // player sees the "reward already claimed" message instead of a
      // scary red retry banner for stars they already own.
      try {
        const s = await api.get<TutorialStatus>('/tutorial/status')
        if (s.completed) {
          setClaimResult({
            success: true,
            alreadyCompleted: true,
            reward: 0,
            starCoins: 0,
          })
          markTutorialCompletedLocally()
          queryClient.invalidateQueries({ queryKey: ['me'] })
          log.info('tutorial already completed server-side; suppressing error', { error: err?.message })
          return
        }
      } catch {
        // fall through to the generic error UI below
      }
      log.error('tutorial completion failed', { error: err?.message })
      setClaimError(err?.message ?? 'Something went wrong')
    } finally {
      setClaiming(false)
    }
  }, [queryClient])

  // Auto-grant the reward the first time the user lands on the 'done' step.
  // NOTE: we must bail out on `claimError` too — otherwise a failed request
  // sets claiming=false + claimError=<msg>, which re-fires this effect and
  // immediately retries, trapping the user on the spinner forever with no
  // visible error UI. The manual "Retry" button clears claimError itself.
  //
  // Also: if the server already reports completed=true (returning player
  // replaying the walkthrough, or a prior successful POST we missed the
  // response of), skip the POST entirely and show the "already claimed"
  // state directly. Prevents the confusing "couldn't credit your reward"
  // banner for users who already own their stars.
  useEffect(() => {
    if (currentStep !== 'done') return
    if (claimResult || claiming || claimError) return
    if (statusLoaded && status?.completed) {
      setClaimResult({
        success: true,
        alreadyCompleted: true,
        reward: 0,
        starCoins: 0,
      })
      markTutorialCompletedLocally()
      return
    }
    if (!statusLoaded) return // wait until we know whether the reward was already claimed
    grantReward()
  }, [currentStep, claimResult, claiming, claimError, grantReward, statusLoaded, status])

  const exitWithConfirm = useCallback(() => {
    if (currentStep === 'done') {
      navigate('/')
      return
    }
    if (window.confirm(t('tutorial.exitConfirm'))) {
      navigate('/')
    }
  }, [currentStep, navigate, t])

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 px-4 pt-20 pb-24 sm:pb-16">
        <div className="max-w-2xl mx-auto animate-slide-up space-y-5">

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-600/30 bg-brand-600/10 text-brand-400 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              {t('tutorial.walkthroughTitle')}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {t('tutorial.walkthroughTitle')}
            </h1>
            <p className="text-neutral-400 text-sm">{t('tutorial.walkthroughSubtitle')}</p>
          </div>

          {/* Reward banner */}
          {statusLoaded && (
            <div
              className={[
                'rounded-2xl border p-3 text-center text-sm',
                status?.completed
                  ? 'border-neutral-800 bg-neutral-900/60 text-neutral-400'
                  : 'border-amber-700/40 bg-amber-950/30 text-amber-300',
              ].join(' ')}
            >
              {status?.completed
                ? t('tutorial.rewardAlreadyClaimed')
                : t('tutorial.rewardBanner', { amount: TUTORIAL_COMPLETION_REWARD })}
            </div>
          )}

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              <span>{t('tutorial.progress', { current: stepIdx + 1, total: totalSteps })}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Step content */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 min-h-[360px]">
            {currentStep === 'intro' && <IntroStep onNext={goNext} />}
            {currentStep === 'role' && (
              <RoleStep
                revealed={roleRevealed}
                onReveal={() => setRoleRevealed(true)}
                onNext={goNext}
              />
            )}
            {currentStep === 'clues' && <CluesStep onNext={goNext} />}
            {currentStep === 'pick-clue' && (
              <PickClueStep
                choice={clueChoice}
                onPick={setClueChoice}
                onNext={goNext}
              />
            )}
            {currentStep === 'suspicion' && (
              <SuspicionStep
                suspect={suspect}
                onPick={setSuspect}
                onNext={goNext}
              />
            )}
            {currentStep === 'vote' && (
              <VoteStep
                locked={voteLocked}
                onVote={setVoteLocked}
                revealed={votesRevealed}
                onReveal={() => setVotesRevealed(true)}
                onNext={goNext}
              />
            )}
            {currentStep === 'reveal' && <RevealStep onNext={goNext} />}
            {currentStep === 'recap' && <RecapStep onNext={goNext} />}
            {currentStep === 'done' && (
              <DoneStep
                claiming={claiming}
                claimError={claimError}
                claimResult={claimResult}
                onRetry={grantReward}
              />
            )}
          </div>

          {/* Footer nav */}
          <div className="flex items-center gap-3">
            {stepIdx > 0 && currentStep !== 'done' && (
              <button
                onClick={goBack}
                className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white text-sm font-semibold border border-neutral-800 transition-colors"
              >
                ←
              </button>
            )}
            <button
              onClick={exitWithConfirm}
              className="ml-auto text-xs font-semibold uppercase tracking-widest text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              {currentStep === 'done' ? t('tutorial.backToHome') : t('tutorial.skip')}
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}

/* ── Step Components ─────────────────────────────────────────────────────── */

function PrimaryButton({
  children,
  onClick,
  disabled,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all active:scale-[0.98] shadow-lg shadow-brand-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

function IntroStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-600/20 border border-brand-700/40 flex items-center justify-center text-3xl mb-3">
          🎭
        </div>
        <h2 className="text-xl font-extrabold text-white">{t('tutorial.introTitle')}</h2>
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed">{t('tutorial.introBody')}</p>
      <ul className="space-y-2">
        {[1, 2, 3].map((n) => (
          <li key={n} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/60">
            <span className="w-6 h-6 shrink-0 rounded-full bg-brand-600/20 border border-brand-700/40 text-brand-400 text-xs font-bold flex items-center justify-center">
              {n}
            </span>
            <span className="text-sm text-neutral-300 leading-relaxed">
              {t(`tutorial.introPoint${n}`)}
            </span>
          </li>
        ))}
      </ul>
      <PrimaryButton onClick={onNext}>{t('tutorial.letsBegin')}</PrimaryButton>
    </div>
  )
}

function RoleStep({
  revealed,
  onReveal,
  onNext,
}: { revealed: boolean; onReveal: () => void; onNext: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-extrabold text-white">{t('tutorial.roleRevealTitle')}</h2>
        <p className="text-neutral-500 text-xs mt-1">{t('tutorial.roleRevealSubtitle')}</p>
      </div>

      <button
        type="button"
        onClick={onReveal}
        disabled={revealed}
        className={[
          'w-full rounded-2xl border p-6 text-center transition-all',
          revealed
            ? 'border-emerald-700/50 bg-emerald-950/40 cursor-default'
            : 'border-brand-700/40 bg-brand-950/40 hover:bg-brand-950/60 active:scale-[0.99]',
        ].join(' ')}
      >
        {revealed ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
              {t('tutorial.roleLabel')}
            </p>
            <p className="text-2xl font-extrabold text-emerald-400">🏘️ {t('offline.villager', 'Villager')}</p>
            <div className="mt-4 inline-block px-4 py-2 rounded-xl bg-neutral-950/60 border border-neutral-800/60">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-0.5">
                {t('tutorial.wordLabel')}
              </p>
              <p className="text-xl font-extrabold text-white">🍕 Pizza</p>
            </div>
            <p className="text-xs text-neutral-400 pt-2 max-w-sm mx-auto leading-relaxed">
              {t('tutorial.villagerHint')}
            </p>
          </div>
        ) : (
          <div className="space-y-2 py-6">
            <div className="text-5xl">🎴</div>
            <p className="text-sm font-semibold text-brand-400">{t('tutorial.roleCardHidden')}</p>
          </div>
        )}
      </button>

      <PrimaryButton onClick={onNext} disabled={!revealed}>
        {t('tutorial.gotIt')}
      </PrimaryButton>
    </div>
  )
}

function CluesStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation()
  const clues = [
    { name: 'Maya', avatar: '👩', key: 'mayaClue', tone: 'border-neutral-800 bg-neutral-950/50' },
    { name: 'Leo',  avatar: '🧑', key: 'leoClue',  tone: 'border-neutral-800 bg-neutral-950/50' },
    { name: 'Nora', avatar: '👧', key: 'noraClue', tone: 'border-neutral-800 bg-neutral-950/50' },
  ]
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-extrabold text-white">{t('tutorial.cluesTitle')}</h2>
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed">{t('tutorial.cluesBody')}</p>
      <div className="space-y-2">
        {clues.map((c) => (
          <div key={c.name} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${c.tone}`}>
            <span className="text-xl">{c.avatar}</span>
            <p className="text-sm text-neutral-300 leading-relaxed">{t(`tutorial.${c.key}`)}</p>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-800/30">
        <span className="text-amber-400 mt-0.5 text-sm">💡</span>
        <p className="text-xs text-amber-300/80 leading-relaxed">{t('tutorial.cluesInsight')}</p>
      </div>
      <PrimaryButton onClick={onNext}>{t('tutorial.continueWalkthrough')}</PrimaryButton>
    </div>
  )
}

function PickClueStep({
  choice,
  onPick,
  onNext,
}: {
  choice: 'good' | 'risky' | 'vague' | null
  onPick: (c: 'good' | 'risky' | 'vague') => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  const options: { id: 'good' | 'risky' | 'vague'; labelKey: string; feedbackKey: string; accent: string }[] = [
    { id: 'good',  labelKey: 'clueOptionGood',  feedbackKey: 'clueFeedbackGood',  accent: 'border-emerald-700/40 bg-emerald-950/40 text-emerald-300' },
    { id: 'risky', labelKey: 'clueOptionRisky', feedbackKey: 'clueFeedbackRisky', accent: 'border-amber-700/40 bg-amber-950/40 text-amber-300' },
    { id: 'vague', labelKey: 'clueOptionVague', feedbackKey: 'clueFeedbackVague', accent: 'border-neutral-700 bg-neutral-950/60 text-neutral-400' },
  ]
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-extrabold text-white">{t('tutorial.yourTurnToClue')}</h2>
      </div>
      <div className="space-y-2">
        {options.map((o) => {
          const picked = choice === o.id
          return (
            <button
              key={o.id}
              onClick={() => onPick(o.id)}
              className={[
                'w-full text-left px-4 py-3 rounded-xl border transition-all text-sm',
                picked
                  ? o.accent + ' ring-2 ring-offset-0'
                  : 'border-neutral-800 bg-neutral-950/40 text-neutral-300 hover:border-neutral-700',
              ].join(' ')}
            >
              <p className="font-semibold">"{t(`tutorial.${o.labelKey}`)}"</p>
              {picked && (
                <p className="text-xs mt-2 leading-relaxed opacity-90">
                  {t(`tutorial.${o.feedbackKey}`)}
                </p>
              )}
            </button>
          )
        })}
      </div>
      <PrimaryButton onClick={onNext} disabled={!choice}>
        {t('tutorial.continueWalkthrough')}
      </PrimaryButton>
    </div>
  )
}

function SuspicionStep({
  suspect,
  onPick,
  onNext,
}: {
  suspect: 'maya' | 'leo' | 'nora' | null
  onPick: (s: 'maya' | 'leo' | 'nora') => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  const npcs: { id: 'maya' | 'leo' | 'nora'; labelKey: string; readKey: string; avatar: string }[] = [
    { id: 'maya', labelKey: 'npcMaya', readKey: 'mayaSuspicion', avatar: '👩' },
    { id: 'leo',  labelKey: 'npcLeo',  readKey: 'leoSuspicion',  avatar: '🧑' },
    { id: 'nora', labelKey: 'npcNora', readKey: 'noraSuspicion', avatar: '👧' },
  ]
  const feedbackKey = suspect ? `suspicionFeedback${suspect.charAt(0).toUpperCase()}${suspect.slice(1)}` : null
  const suspectIsRight = suspect === 'maya'
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-extrabold text-white">{t('tutorial.suspicionTitle')}</h2>
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed">{t('tutorial.suspicionBody')}</p>

      <div className="space-y-2">
        {npcs.map((n) => (
          <div key={n.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-neutral-800 bg-neutral-950/40">
            <span className="text-xl">{n.avatar}</span>
            <p className="text-xs text-neutral-400 leading-relaxed">{t(`tutorial.${n.readKey}`)}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
          {t('tutorial.suspicionPrompt')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {npcs.map((n) => {
            const picked = suspect === n.id
            return (
              <button
                key={n.id}
                onClick={() => onPick(n.id)}
                className={[
                  'py-3 rounded-xl border text-center transition-all',
                  picked
                    ? 'border-brand-600/60 bg-brand-950/60 ring-2 ring-brand-600/30'
                    : 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-700',
                ].join(' ')}
              >
                <div className="text-2xl">{n.avatar}</div>
                <p className="text-xs font-semibold text-white mt-0.5">{t(`tutorial.${n.labelKey}`)}</p>
              </button>
            )
          })}
        </div>
      </div>

      {suspect && feedbackKey && (
        <div
          className={[
            'px-3 py-2 rounded-lg border text-xs leading-relaxed',
            suspectIsRight
              ? 'border-emerald-700/40 bg-emerald-950/40 text-emerald-300'
              : 'border-amber-700/40 bg-amber-950/30 text-amber-300',
          ].join(' ')}
        >
          {t(`tutorial.${feedbackKey}`)}
        </div>
      )}

      <PrimaryButton onClick={onNext} disabled={!suspect}>
        {t('tutorial.continueWalkthrough')}
      </PrimaryButton>
    </div>
  )
}

function VoteStep({
  locked,
  onVote,
  revealed,
  onReveal,
  onNext,
}: {
  locked: 'maya' | 'leo' | 'nora' | null
  onVote: (v: 'maya' | 'leo' | 'nora') => void
  revealed: boolean
  onReveal: () => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  // Fake vote tally for the reveal. Players vote Maya 3, Leo 0, Nora 1.
  const tally = useMemo(() => {
    return { maya: 3, leo: 0, nora: 1 }
  }, [])
  const npcs: { id: 'maya' | 'leo' | 'nora'; labelKey: string; avatar: string }[] = [
    { id: 'maya', labelKey: 'npcMaya', avatar: '👩' },
    { id: 'leo',  labelKey: 'npcLeo',  avatar: '🧑' },
    { id: 'nora', labelKey: 'npcNora', avatar: '👧' },
  ]
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-extrabold text-white">{t('tutorial.voteTitle')}</h2>
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed">{t('tutorial.voteBody')}</p>

      <div className="grid grid-cols-3 gap-2">
        {npcs.map((n) => {
          const picked = locked === n.id
          return (
            <button
              key={n.id}
              onClick={() => !locked && onVote(n.id)}
              disabled={!!locked && !picked}
              className={[
                'py-3 rounded-xl border text-center transition-all relative',
                picked
                  ? 'border-violet-600/60 bg-violet-950/60 ring-2 ring-violet-600/40'
                  : locked
                    ? 'border-neutral-800 bg-neutral-950/40 opacity-50 cursor-not-allowed'
                    : 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-700',
              ].join(' ')}
            >
              <div className="text-2xl">{n.avatar}</div>
              <p className="text-xs font-semibold text-white mt-0.5">{t(`tutorial.${n.labelKey}`)}</p>
              {revealed && (
                <span className="absolute top-1 right-1 text-[10px] font-bold text-white bg-neutral-900 border border-neutral-700 rounded-full w-5 h-5 flex items-center justify-center">
                  {tally[n.id]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {locked && !revealed && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-950/40 border border-violet-800/40 text-xs text-violet-300">
          <span>🔒</span>
          {t('tutorial.voteLocked')}
        </div>
      )}

      {revealed && (
        <div className="px-3 py-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-sm text-amber-300">
          <p className="font-semibold">{t('tutorial.voteReveal')}</p>
          <p className="text-xs mt-0.5">{t('tutorial.voteRevealBody')}</p>
        </div>
      )}

      {!revealed ? (
        <PrimaryButton onClick={onReveal} disabled={!locked}>
          {t('tutorial.voteContinue')}
        </PrimaryButton>
      ) : (
        <PrimaryButton onClick={onNext}>{t('tutorial.continueWalkthrough')}</PrimaryButton>
      )}
    </div>
  )
}

function RevealStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-extrabold text-white">{t('tutorial.revealTitle')}</h2>
      </div>

      <div className="rounded-2xl border border-red-700/40 bg-red-950/40 p-5 text-center space-y-3">
        <div className="text-5xl">👩</div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">
            {t('offline.imposter', 'Imposter')}
          </p>
          <p className="text-lg font-extrabold text-red-400">{t('tutorial.revealImposterCard')}</p>
          <p className="text-sm text-neutral-300 mt-2">{t('tutorial.revealImposterWord')}</p>
        </div>
      </div>

      <p className="text-sm text-neutral-300 leading-relaxed">{t('tutorial.revealBody')}</p>

      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-950/40 border border-emerald-800/40">
          <span className="text-emerald-400 text-sm">🎉</span>
          <span className="text-emerald-400 text-sm font-semibold">{t('tutorial.revealOutcome')}</span>
        </div>
      </div>

      <PrimaryButton onClick={onNext}>{t('tutorial.revealContinue')}</PrimaryButton>
    </div>
  )
}

function RecapStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation()
  const tips = [
    { icon: '🎯', key: 'recapTip1' },
    { icon: '👀', key: 'recapTip2' },
    { icon: '🗳️', key: 'recapTip3' },
  ]
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-extrabold text-white">{t('tutorial.recapTitle')}</h2>
      </div>
      <div className="space-y-2">
        {tips.map((tip) => (
          <div
            key={tip.key}
            className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-neutral-950/50 border border-neutral-800/60"
          >
            <span className="text-base mt-0.5">{tip.icon}</span>
            <p className="text-xs text-neutral-300 leading-relaxed">{t(`tutorial.${tip.key}`)}</p>
          </div>
        ))}
      </div>
      <PrimaryButton onClick={onNext}>{t('tutorial.continueWalkthrough')}</PrimaryButton>
    </div>
  )
}

function DoneStep({
  claiming,
  claimError,
  claimResult,
  onRetry,
}: {
  claiming: boolean
  claimError: string | null
  claimResult: CompleteResponse | null
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const didGrant = !!claimResult && !claimResult.alreadyCompleted && claimResult.reward > 0
  const alreadyHad = !!claimResult && claimResult.alreadyCompleted

  return (
    <div className="space-y-5 text-center">
      <div className="w-20 h-20 mx-auto rounded-2xl bg-emerald-600/20 border border-emerald-700/40 flex items-center justify-center text-5xl">
        🏆
      </div>
      <h2 className="text-2xl font-extrabold text-white">{t('tutorial.completionTitle')}</h2>
      <p className="text-sm text-neutral-400">{t('tutorial.completionSubtitle')}</p>

      {claiming && (
        <div className="flex items-center justify-center gap-2 text-sm text-neutral-400">
          <svg className="animate-spin h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {t('tutorial.completionGrantingReward')}
        </div>
      )}

      {didGrant && (
        <div className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-950/40 border border-amber-700/40 text-amber-300 font-bold text-lg">
          <span className="text-2xl">⭐</span>
          {t('tutorial.completionReward', { amount: claimResult!.reward })}
        </div>
      )}

      {alreadyHad && (
        <p className="text-sm text-neutral-400 max-w-sm mx-auto leading-relaxed">
          {t('tutorial.completionAlready', { amount: TUTORIAL_COMPLETION_REWARD })}
        </p>
      )}

      {claimError && !claiming && (
        <div className="space-y-2">
          <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-400 text-sm">
            <span>⚠</span> {t('tutorial.completionRewardError')}
          </div>
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-semibold transition-colors"
          >
            {t('tutorial.completionRewardRetry')}
          </button>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Link
          to="/"
          className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-colors shadow-lg shadow-brand-950/40"
        >
          {t('tutorial.playNow')}
        </Link>
      </div>
    </div>
  )
}
