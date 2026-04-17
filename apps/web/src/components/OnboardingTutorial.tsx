import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

const TUTORIAL_STORAGE_KEY = 'red-handed-tutorial-completed'

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={skip}
    >
      <style>{`
        @keyframes tut-step-forward {
          0%   { opacity: 0; transform: translate3d(60px, 0, 0) scale(0.96); }
          60%  { opacity: 1; transform: translate3d(-6px, 0, 0) scale(1.01); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes tut-step-back {
          0%   { opacity: 0; transform: translate3d(-60px, 0, 0) scale(0.96); }
          60%  { opacity: 1; transform: translate3d(6px, 0, 0) scale(1.01); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes tut-card-pop {
          0%   { opacity: 0; transform: scale(0.85) translateY(30px); }
          60%  { opacity: 1; transform: scale(1.02) translateY(-4px); }
          100% { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes tut-icon-bounce {
          0%   { transform: scale(0) rotate(-180deg); opacity: 0; }
          55%  { transform: scale(1.18) rotate(8deg); opacity: 1; }
          80%  { transform: scale(0.94) rotate(-4deg); }
          100% { transform: scale(1) rotate(0);  opacity: 1; }
        }
        @keyframes tut-progress-shine {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>

      <div
        className="w-full max-w-md bg-gradient-to-br from-neutral-950 via-neutral-950 to-brand-950/30 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl shadow-brand-950/40 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'tut-card-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Progress bar with shine */}
        <div className="relative h-1.5 bg-neutral-900 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 via-brand-400 to-brand-500 transition-all duration-500 ease-out relative overflow-hidden"
            style={{
              width: `${((step + 1) / TOTAL_STEPS) * 100}%`,
              boxShadow: '0 0 12px rgba(139,92,246,0.6)',
            }}
          >
            {/* Animated shine */}
            <div
              className="absolute inset-y-0 w-1/3 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                animation: 'tut-progress-shine 2.2s linear infinite',
              }}
            />
          </div>
        </div>

        {/* Content area */}
        <div className="px-5 py-6 min-h-[380px] flex flex-col overflow-hidden">
          <div
            key={animKey}
            style={{
              animation: `${direction === 'forward' ? 'tut-step-forward' : 'tut-step-back'} 0.45s cubic-bezier(0.16,1,0.3,1) both`,
            }}
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
                  'h-2 rounded-full transition-all duration-300 ease-out',
                  i === step
                    ? 'bg-brand-500 w-7 shadow-[0_0_12px_rgba(139,92,246,0.7)]'
                    : i < step
                      ? 'bg-brand-700 w-2 hover:bg-brand-500'
                      : 'bg-neutral-700 w-2 hover:bg-neutral-500',
                ].join(' ')}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Back button */}
          {step > 0 && (
            <button
              onClick={back}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-sm font-semibold transition-all active:scale-95 hover:-translate-y-0.5"
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
              'px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95 hover:-translate-y-0.5 hover:scale-[1.03]',
              step === TOTAL_STEPS - 1
                ? 'bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 hover:from-brand-400 hover:to-brand-600 shadow-lg shadow-brand-900/50 animate-glow-pulse'
                : 'bg-gradient-to-br from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 shadow-md shadow-brand-950/50',
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
      <div
        className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-500/30 via-brand-700/20 to-brand-900/40 border border-brand-600/40 flex items-center justify-center text-6xl animate-float-soft"
        style={{
          animation: 'tut-icon-bounce 0.7s cubic-bezier(0.34,1.56,0.64,1) both, floatSoft 3.5s ease-in-out 0.8s infinite',
          boxShadow: '0 0 40px rgba(139,92,246,0.35), inset 0 2px 0 rgba(255,255,255,0.1)',
        }}
      >
        <span style={{ filter: 'drop-shadow(0 4px 16px rgba(139,92,246,0.6))' }}>🎭</span>
      </div>
      <div>
        <h2 className="text-2xl font-extrabold text-white mb-2">
          {t('tutorial.welcomeTitle', 'Welcome to Red Handed !')}
        </h2>
        <p className="text-neutral-400 text-sm leading-relaxed max-w-xs mx-auto">
          {t('tutorial.welcomeDesc', 'A social deduction game where words are your weapon. Blend in or find the imposter — the choice is yours.')}
        </p>
      </div>
      <div className="w-full mt-2 space-y-2">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-950/40 to-neutral-900/80 border border-emerald-900/40 text-left transition-transform hover:-translate-y-0.5 hover:scale-[1.015]"
          style={{ animation: 'slideUp 0.4s ease-out 0.2s both' }}
        >
          <span className="text-2xl animate-float-soft">🏘️</span>
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              {t('tutorial.welcomeVillagers', 'Villagers')}
            </p>
            <p className="text-xs text-neutral-500">
              {t('tutorial.welcomeVillagersDesc', 'Know the secret word and must find the imposter')}
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-red-950/40 to-neutral-900/80 border border-red-900/40 text-left transition-transform hover:-translate-y-0.5 hover:scale-[1.015]"
          style={{ animation: 'slideUp 0.4s ease-out 0.35s both' }}
        >
          <span className="text-2xl animate-float-soft" style={{ animationDelay: '1s' }}>🔪</span>
          <div>
            <p className="text-sm font-semibold text-red-400">
              {t('tutorial.welcomeRedHanded', 'Imposter')}
            </p>
            <p className="text-xs text-neutral-500">
              {t('tutorial.welcomeRedHandedDesc', 'Have a different word and must blend in undetected')}
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
            {t('tutorial.redHandedWord', 'Imposter Word')}
          </p>
          <p className="text-lg font-bold text-red-400">🍔 Burger</p>
        </div>
      </div>

      <div className="space-y-2 mt-2">
        <p className="text-sm text-neutral-300 leading-relaxed">
          {t('tutorial.rolesExplain1', 'Everyone receives the same category but redHanded get a different word. The words are similar, making it tricky!')}
        </p>
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-800/30">
          <span className="text-amber-400 mt-0.5 text-sm">💡</span>
          <p className="text-xs text-amber-300/80 leading-relaxed">
            {t('tutorial.rolesExplain2', 'Give clues about your word without saying it directly. If the redHanded figures out the villager word, they can blend in perfectly!')}
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
            className={`flex items-start gap-3 px-3 py-3 rounded-xl ${phase.bgColor} border ${phase.borderColor} transition-transform hover:-translate-y-0.5 hover:scale-[1.015]`}
            style={{ animation: `slideUp 0.45s cubic-bezier(0.16,1,0.3,1) ${0.15 + i * 0.12}s both` }}
          >
            <div
              className={`w-10 h-10 rounded-xl border ${phase.borderColor} flex items-center justify-center text-lg flex-shrink-0 animate-float-soft`}
              style={{ animationDelay: `${i * 0.6}s` }}
            >
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
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800/60 text-center transition-all hover:-translate-y-1 hover:scale-105 hover:border-brand-700/60 hover:bg-neutral-800/80 cursor-pointer"
            style={{ animation: `tut-card-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) ${0.1 + i * 0.08}s both` }}
          >
            <span className="text-3xl animate-float-soft" style={{ animationDelay: `${i * 0.4}s` }}>{mode.icon}</span>
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
      text: t('tutorial.tipRedHanded', "As redHanded, listen carefully to villager clues to figure out their word."),
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
            className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800/60 transition-transform hover:-translate-y-0.5 hover:scale-[1.015] hover:border-brand-700/40"
            style={{ animation: `slideUp 0.45s cubic-bezier(0.16,1,0.3,1) ${0.15 + i * 0.1}s both` }}
          >
            <span className="text-xl mt-0.5 animate-float-soft" style={{ animationDelay: `${i * 0.3}s` }}>{tip.icon}</span>
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
