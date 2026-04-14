import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

const TUTORIAL_STORAGE_KEY = 'imposter-tutorial-completed'

/** Returns true if the user has already completed (or dismissed) the tutorial. */
export function hasTutorialCompleted(): boolean {
  return localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1'
}

function markTutorialCompleted() {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, '1')
}

/** Exposed so the interactive /tutorial walkthrough can also flip the flag
 *  when the server confirms completion — this keeps the onboarding modal
 *  from popping up again after the long walkthrough. */
export function markTutorialCompletedLocally() {
  markTutorialCompleted()
}

interface Props {
  onClose: () => void
}

export function OnboardingTutorial({ onClose }: Props) {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  // Re-trigger animation on step change
  const [animKey, setAnimKey] = useState(0)

  const TOTAL_STEPS = 5

  const next = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setDirection('forward')
      setAnimKey((k) => k + 1)
      setStep((s) => s + 1)
    } else {
      markTutorialCompleted()
      onClose()
    }
  }, [step, onClose])

  const back = useCallback(() => {
    if (step > 0) {
      setDirection('back')
      setAnimKey((k) => k + 1)
      setStep((s) => s - 1)
    }
  }, [step])

  const skip = useCallback(() => {
    markTutorialCompleted()
    onClose()
  }, [onClose])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') back()
      else if (e.key === 'Escape') skip()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, back, skip])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={skip}
    >
      <div
        className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl shadow-brand-950/30 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-1 bg-neutral-800">
          <div
            className="h-full bg-brand-500 transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Content area */}
        <div className="px-5 py-6 min-h-[380px] flex flex-col">
          <div
            key={animKey}
            className={direction === 'forward' ? 'animate-slide-up' : 'animate-slide-up'}
          >
            {step === 0 && <StepWelcome />}
            {step === 1 && <StepRoles />}
            {step === 2 && <StepPhases />}
            {step === 3 && <StepModes />}
            {step === 4 && <StepTips />}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center gap-3">
          {/* Step dots */}
          <div className="flex items-center gap-1.5 flex-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setDirection(i > step ? 'forward' : 'back')
                  setAnimKey((k) => k + 1)
                  setStep(i)
                }}
                className={[
                  'w-2 h-2 rounded-full transition-all duration-300',
                  i === step
                    ? 'bg-brand-500 w-6'
                    : i < step
                      ? 'bg-brand-700'
                      : 'bg-neutral-700',
                ].join(' ')}
              />
            ))}
          </div>

          {/* Back button */}
          {step > 0 && (
            <button
              onClick={back}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-sm font-semibold transition-colors"
            >
              {t('common.back')}
            </button>
          )}

          {/* Skip (only on non-final steps) */}
          {step < TOTAL_STEPS - 1 && (
            <button
              onClick={skip}
              className="px-3 py-2.5 text-neutral-600 hover:text-neutral-400 text-sm font-medium transition-colors"
            >
              {t('tutorial.skip', 'Skip')}
            </button>
          )}

          {/* Next / Start Playing */}
          <button
            onClick={next}
            className={[
              'px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.97]',
              step === TOTAL_STEPS - 1
                ? 'bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-950/40'
                : 'bg-brand-600 hover:bg-brand-500',
            ].join(' ')}
          >
            {step === TOTAL_STEPS - 1
              ? t('tutorial.letsPlay', "Let's Play!")
              : t('common.next')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Step Components ─────────────────────────────────────────────── */

function StepWelcome() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center text-center gap-4">
      <div className="w-20 h-20 rounded-2xl bg-brand-600/20 border border-brand-700/40 flex items-center justify-center text-5xl">
        🎭
      </div>
      <div>
        <h2 className="text-2xl font-extrabold text-white mb-2">
          {t('tutorial.welcomeTitle', 'Welcome to Imposter!')}
        </h2>
        <p className="text-neutral-400 text-sm leading-relaxed max-w-xs mx-auto">
          {t('tutorial.welcomeDesc', 'A social deduction game where words are your weapon. Blend in or find the imposter — the choice is yours.')}
        </p>
      </div>
      <div className="w-full mt-2 space-y-2">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900/80 border border-neutral-800/60 text-left">
          <span className="text-lg">🏘️</span>
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              {t('tutorial.welcomeVillagers', 'Villagers')}
            </p>
            <p className="text-xs text-neutral-500">
              {t('tutorial.welcomeVillagersDesc', 'Know the secret word and must find the imposter')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900/80 border border-neutral-800/60 text-left">
          <span className="text-lg">🔪</span>
          <div>
            <p className="text-sm font-semibold text-red-400">
              {t('tutorial.welcomeImposters', 'Imposters')}
            </p>
            <p className="text-xs text-neutral-500">
              {t('tutorial.welcomeImpostersDesc', 'Have a different word and must blend in undetected')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StepRoles() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-400 mb-1">
          {t('tutorial.step', 'Step')} 1/4
        </p>
        <h2 className="text-xl font-extrabold text-white">
          {t('tutorial.rolesTitle', 'Secret Words & Roles')}
        </h2>
      </div>

      {/* Example word pair */}
      <div className="flex items-center justify-center gap-3">
        <div className="flex-1 text-center px-3 py-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">
            {t('tutorial.villagerWord', 'Villager Word')}
          </p>
          <p className="text-lg font-bold text-emerald-400">🍕 Pizza</p>
        </div>
        <span className="text-neutral-600 font-bold text-xs">vs</span>
        <div className="flex-1 text-center px-3 py-3 rounded-xl bg-red-950/40 border border-red-800/40">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1">
            {t('tutorial.imposterWord', 'Imposter Word')}
          </p>
          <p className="text-lg font-bold text-red-400">🍔 Burger</p>
        </div>
      </div>

      <div className="space-y-2 mt-2">
        <p className="text-sm text-neutral-300 leading-relaxed">
          {t('tutorial.rolesExplain1', 'Everyone receives the same category but imposters get a different word. The words are similar, making it tricky!')}
        </p>
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-800/30">
          <span className="text-amber-400 mt-0.5 text-sm">💡</span>
          <p className="text-xs text-amber-300/80 leading-relaxed">
            {t('tutorial.rolesExplain2', 'Give clues about your word without saying it directly. If the imposter figures out the villager word, they can blend in perfectly!')}
          </p>
        </div>
      </div>
    </div>
  )
}

function StepPhases() {
  const { t } = useTranslation()

  const phases = [
    {
      icon: '💬',
      title: t('tutorial.phaseSpeakingTitle', 'Speaking'),
      desc: t('tutorial.phaseSpeakingDesc', 'Each player gives a one-sentence clue about their word. Be clever — too vague is suspicious, too specific is risky.'),
      color: 'brand',
      borderColor: 'border-brand-700/40',
      bgColor: 'bg-brand-950/40',
      textColor: 'text-brand-400',
    },
    {
      icon: '🗳️',
      title: t('tutorial.phaseVotingTitle', 'Voting'),
      desc: t('tutorial.phaseVotingDesc', 'Vote for who you think is the imposter. The player with the most votes is eliminated.'),
      color: 'amber',
      borderColor: 'border-amber-700/40',
      bgColor: 'bg-amber-950/40',
      textColor: 'text-amber-400',
    },
    {
      icon: '📋',
      title: t('tutorial.phaseRevealTitle', 'Reveal'),
      desc: t('tutorial.phaseRevealDesc', "The eliminated player's role and word are revealed. The game continues until a team wins."),
      color: 'violet',
      borderColor: 'border-violet-700/40',
      bgColor: 'bg-violet-950/40',
      textColor: 'text-violet-400',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-400 mb-1">
          {t('tutorial.step', 'Step')} 2/4
        </p>
        <h2 className="text-xl font-extrabold text-white">
          {t('tutorial.phasesTitle', 'Three Phases Per Round')}
        </h2>
      </div>

      <div className="space-y-2.5">
        {phases.map((phase, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 px-3 py-3 rounded-xl ${phase.bgColor} border ${phase.borderColor}`}
          >
            <div className={`w-8 h-8 rounded-lg border ${phase.borderColor} flex items-center justify-center text-base flex-shrink-0`}>
              {phase.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[9px] font-bold text-neutral-400">
                  {i + 1}
                </span>
                <p className={`text-sm font-bold ${phase.textColor}`}>{phase.title}</p>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed mt-0.5">{phase.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepModes() {
  const { t } = useTranslation()

  const modes = [
    {
      icon: '🎲',
      name: t('tutorial.modeNormal', 'Normal'),
      desc: t('tutorial.modeNormalDesc', 'Quick matchmaking with random players. Great for getting started.'),
      color: 'text-brand-400',
    },
    {
      icon: '🏆',
      name: t('tutorial.modeRanked', 'Ranked'),
      desc: t('tutorial.modeRankedDesc', 'Competitive mode. Win to climb the leaderboard and earn rank.'),
      color: 'text-amber-400',
    },
    {
      icon: '🚪',
      name: t('tutorial.modeLobby', 'Lobby'),
      desc: t('tutorial.modeLobbyDesc', 'Create a private room and invite friends with a room code.'),
      color: 'text-violet-400',
    },
    {
      icon: '📱',
      name: t('tutorial.modeOffline', 'Offline'),
      desc: t('tutorial.modeOfflineDesc', 'Pass-and-play on one device. Perfect for parties.'),
      color: 'text-teal-400',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-400 mb-1">
          {t('tutorial.step', 'Step')} 3/4
        </p>
        <h2 className="text-xl font-extrabold text-white">
          {t('tutorial.modesTitle', 'Choose How You Play')}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {modes.map((mode, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800/60 text-center"
          >
            <span className="text-2xl">{mode.icon}</span>
            <p className={`text-sm font-bold ${mode.color}`}>{mode.name}</p>
            <p className="text-[10px] text-neutral-500 leading-tight">{mode.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-800/30">
        <span className="text-purple-400 mt-0.5 text-sm">✨</span>
        <p className="text-xs text-purple-300/80 leading-relaxed">
          {t('tutorial.modesSpecialHint', 'Try Special mode for extra roles like Detective, Guardian, and Jester — each with unique powers!')}
        </p>
      </div>
    </div>
  )
}

function StepTips() {
  const { t } = useTranslation()

  const tips = [
    {
      icon: '🎯',
      text: t('tutorial.tipClues', "Vague clues are safe but suspicious. Specific clues are convincing but risky. Find the balance."),
    },
    {
      icon: '👀',
      text: t('tutorial.tipWatch', "Watch who hesitates or gives clues that don't quite fit the category."),
    },
    {
      icon: '🤫',
      text: t('tutorial.tipImposter', "As imposter, listen carefully to villager clues to figure out their word."),
    },
    {
      icon: '🗳️',
      text: t('tutorial.tipVoting', "Don't always follow the crowd when voting. Trust your own observations."),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-400 mb-1">
          {t('tutorial.step', 'Step')} 4/4
        </p>
        <h2 className="text-xl font-extrabold text-white">
          {t('tutorial.tipsTitle', 'Pro Tips')}
        </h2>
        <p className="text-neutral-500 text-xs mt-1">
          {t('tutorial.tipsSubtitle', 'Keep these in mind during your first game')}
        </p>
      </div>

      <div className="space-y-2">
        {tips.map((tip, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800/60"
          >
            <span className="text-base mt-0.5">{tip.icon}</span>
            <p className="text-xs text-neutral-300 leading-relaxed">{tip.text}</p>
          </div>
        ))}
      </div>

      <div className="text-center mt-4 space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-950/40 border border-emerald-800/40">
          <span className="text-emerald-400 text-sm">✓</span>
          <span className="text-emerald-400 text-xs font-semibold">
            {t('tutorial.readyMessage', "You're all set! Time to find the imposter.")}
          </span>
        </div>
      </div>
    </div>
  )
}
