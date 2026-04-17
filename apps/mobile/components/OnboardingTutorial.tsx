import React, { useCallback, useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTranslation } from 'react-i18next'

const TUTORIAL_STORAGE_KEY = 'red-handed-tutorial-completed'

/** Async version — resolves to true if the user has already completed the tutorial. */
export async function hasTutorialCompleted(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY)
    return val === '1'
  } catch {
    return false
  }
}

async function markTutorialCompleted() {
  try {
    await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, '1')
  } catch {}
}

/** Exposed so the interactive /tutorial walkthrough can also flip the flag
 *  when the server confirms completion. */
export async function markTutorialCompletedLocally() {
  await markTutorialCompleted()
}

interface Props {
  visible: boolean
  onClose: () => void
}

const TOTAL_STEPS = 5

export function OnboardingTutorial({ visible, onClose }: Props) {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const { width } = useWindowDimensions()
  const isTablet = width >= 768

  // Re-trigger animation on step change
  const fade = React.useRef(new Animated.Value(0)).current
  const slide = React.useRef(new Animated.Value(0)).current

  useEffect(() => {
    fade.setValue(0)
    slide.setValue(20)
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }, [step, visible])

  const next = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1)
    } else {
      markTutorialCompleted()
      setStep(0)
      onClose()
    }
  }, [step, onClose])

  const back = useCallback(() => {
    if (step > 0) setStep((s) => s - 1)
  }, [step])

  const skip = useCallback(() => {
    markTutorialCompleted()
    setStep(0)
    onClose()
  }, [onClose])

  if (!visible) return null

  const progressPct = ((step + 1) / TOTAL_STEPS) * 100

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={skip}>
      <View className="flex-1 bg-black/80 items-center justify-center px-4">
        <View
          className="bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden w-full"
          style={{ maxWidth: isTablet ? 520 : 440, shadowColor: '#8b5cf6', shadowOpacity: 0.3, shadowRadius: 24 }}
        >
          {/* Progress bar */}
          <View className="h-1.5 bg-neutral-900">
            <View
              className="h-full bg-violet-500"
              style={{ width: `${progressPct}%` }}
            />
          </View>

          {/* Content */}
          <ScrollView
            className="px-5 py-6"
            style={{ maxHeight: 480 }}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
              {step === 0 && <StepWelcome t={t} />}
              {step === 1 && <StepRoles t={t} />}
              {step === 2 && <StepPhases t={t} />}
              {step === 3 && <StepModes t={t} />}
              {step === 4 && <StepTips t={t} />}
            </Animated.View>
          </ScrollView>

          {/* Footer */}
          <View className="px-5 pb-5 pt-1 flex-row items-center gap-2">
            {/* Step dots */}
            <View className="flex-row items-center gap-1.5 flex-1">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setStep(i)}
                  className={[
                    'h-2 rounded-full',
                    i === step
                      ? 'bg-violet-500 w-6'
                      : i < step
                        ? 'bg-violet-700 w-2'
                        : 'bg-neutral-700 w-2',
                  ].join(' ')}
                  activeOpacity={0.7}
                />
              ))}
            </View>

            {step > 0 && (
              <TouchableOpacity
                onPress={back}
                className="px-4 py-2.5 rounded-xl bg-neutral-800"
                activeOpacity={0.7}
              >
                <Text className="text-neutral-400 text-sm font-semibold">
                  {t('common.back')}
                </Text>
              </TouchableOpacity>
            )}

            {step < TOTAL_STEPS - 1 && (
              <TouchableOpacity onPress={skip} className="px-3 py-2.5" activeOpacity={0.7}>
                <Text className="text-neutral-600 text-sm font-medium">
                  {t('tutorial.skip', 'Skip')}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={next}
              className={[
                'px-6 py-2.5 rounded-xl',
                step === TOTAL_STEPS - 1 ? 'bg-violet-500' : 'bg-violet-600',
              ].join(' ')}
              activeOpacity={0.8}
            >
              <Text className="text-white font-bold text-sm">
                {step === TOTAL_STEPS - 1
                  ? t('tutorial.letsPlay', "Let's Play!")
                  : t('common.next')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

/* ─── Step Components ─────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFn = any

function StepWelcome({ t }: { t: TFn }) {
  return (
    <View className="items-center gap-4">
      <View
        className="w-24 h-24 rounded-3xl bg-violet-900/40 border border-violet-700/40 items-center justify-center"
      >
        <Text style={{ fontSize: 56 }}>🎭</Text>
      </View>
      <View>
        <Text className="text-2xl font-extrabold text-white text-center mb-2">
          {t('tutorial.welcomeTitle', 'Welcome to Red Handed !')}
        </Text>
        <Text className="text-neutral-400 text-sm text-center leading-5">
          {t(
            'tutorial.welcomeDesc',
            'A social deduction game where words are your weapon. Blend in or find the imposter — the choice is yours.',
          )}
        </Text>
      </View>
      <View className="w-full mt-2 gap-2">
        <View className="flex-row items-center gap-3 px-4 py-3 rounded-xl bg-emerald-950/40 border border-emerald-900/40">
          <Text style={{ fontSize: 22 }}>🏘️</Text>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-emerald-400">
              {t('tutorial.welcomeVillagers', 'Villagers')}
            </Text>
            <Text className="text-xs text-neutral-500">
              {t('tutorial.welcomeVillagersDesc', 'Know the secret word and must find the imposter')}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-3 px-4 py-3 rounded-xl bg-red-950/40 border border-red-900/40">
          <Text style={{ fontSize: 22 }}>🔪</Text>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-red-400">
              {t('tutorial.welcomeRedHanded', 'Imposter')}
            </Text>
            <Text className="text-xs text-neutral-500">
              {t('tutorial.welcomeRedHandedDesc', 'Have a different word and must blend in undetected')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function StepRoles({ t }: { t: TFn }) {
  return (
    <View className="gap-4">
      <View className="items-center mb-2">
        <Text className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">
          {t('tutorial.step', 'Step')} 1/4
        </Text>
        <Text className="text-xl font-extrabold text-white">
          {t('tutorial.rolesTitle', 'Secret Words & Roles')}
        </Text>
      </View>

      <View className="flex-row items-center justify-center gap-3">
        <View className="flex-1 items-center px-3 py-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
          <Text className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">
            {t('tutorial.villagerWord', 'Villager Word')}
          </Text>
          <Text className="text-base font-bold text-emerald-400">🍕 Pizza</Text>
        </View>
        <Text className="text-neutral-600 font-bold text-xs">vs</Text>
        <View className="flex-1 items-center px-3 py-3 rounded-xl bg-red-950/40 border border-red-800/40">
          <Text className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1">
            {t('tutorial.redHandedWord', 'Imposter Word')}
          </Text>
          <Text className="text-base font-bold text-red-400">🍔 Burger</Text>
        </View>
      </View>

      <Text className="text-sm text-neutral-300 leading-5">
        {t(
          'tutorial.rolesExplain1',
          'Everyone receives the same category but redHanded get a different word. The words are similar, making it tricky!',
        )}
      </Text>

      <View className="flex-row items-start gap-2 px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-800/30">
        <Text className="text-amber-400 text-sm">💡</Text>
        <Text className="text-xs text-amber-300/80 leading-4 flex-1">
          {t(
            'tutorial.rolesExplain2',
            'Give clues about your word without saying it directly. If the redHanded figures out the villager word, they can blend in perfectly!',
          )}
        </Text>
      </View>
    </View>
  )
}

function StepPhases({ t }: { t: TFn }) {
  const phases = [
    {
      icon: '💬',
      title: t('tutorial.phaseSpeakingTitle', 'Speaking'),
      desc: t(
        'tutorial.phaseSpeakingDesc',
        'Each player gives a one-sentence clue about their word. Be clever — too vague is suspicious, too specific is risky.',
      ),
      bg: 'bg-violet-950/40',
      border: 'border-violet-700/40',
      text: 'text-violet-400',
    },
    {
      icon: '🗳️',
      title: t('tutorial.phaseVotingTitle', 'Voting'),
      desc: t(
        'tutorial.phaseVotingDesc',
        'Vote for who you think is the imposter. The player with the most votes is eliminated.',
      ),
      bg: 'bg-amber-950/40',
      border: 'border-amber-700/40',
      text: 'text-amber-400',
    },
    {
      icon: '📋',
      title: t('tutorial.phaseRevealTitle', 'Reveal'),
      desc: t(
        'tutorial.phaseRevealDesc',
        "The eliminated player's role and word are revealed. The game continues until a team wins.",
      ),
      bg: 'bg-purple-950/40',
      border: 'border-purple-700/40',
      text: 'text-purple-400',
    },
  ]

  return (
    <View className="gap-4">
      <View className="items-center mb-2">
        <Text className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">
          {t('tutorial.step', 'Step')} 2/4
        </Text>
        <Text className="text-xl font-extrabold text-white">
          {t('tutorial.phasesTitle', 'Three Phases Per Round')}
        </Text>
      </View>

      <View className="gap-2.5">
        {phases.map((phase, i) => (
          <View
            key={i}
            className={`flex-row items-start gap-3 px-3 py-3 rounded-xl ${phase.bg} border ${phase.border}`}
          >
            <View className={`w-10 h-10 rounded-xl border ${phase.border} items-center justify-center`}>
              <Text style={{ fontSize: 18 }}>{phase.icon}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <View className="w-4 h-4 rounded-full bg-neutral-800 border border-neutral-700 items-center justify-center">
                  <Text className="text-[9px] font-bold text-neutral-400">{i + 1}</Text>
                </View>
                <Text className={`text-sm font-bold ${phase.text}`}>{phase.title}</Text>
              </View>
              <Text className="text-xs text-neutral-500 leading-4 mt-0.5">{phase.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function StepModes({ t }: { t: TFn }) {
  const modes = [
    {
      icon: '🎲',
      name: t('tutorial.modeNormal', 'Normal'),
      desc: t('tutorial.modeNormalDesc', 'Quick matchmaking with random players. Great for getting started.'),
      color: 'text-violet-400',
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
      color: 'text-purple-400',
    },
    {
      icon: '📱',
      name: t('tutorial.modeOffline', 'Offline'),
      desc: t('tutorial.modeOfflineDesc', 'Pass-and-play on one device. Perfect for parties.'),
      color: 'text-teal-400',
    },
  ]

  return (
    <View className="gap-4">
      <View className="items-center mb-2">
        <Text className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">
          {t('tutorial.step', 'Step')} 3/4
        </Text>
        <Text className="text-xl font-extrabold text-white">
          {t('tutorial.modesTitle', 'Choose How You Play')}
        </Text>
      </View>

      <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
        {modes.map((mode, i) => (
          <View key={i} style={{ width: '50%', padding: 4 }}>
            <View className="items-center gap-1.5 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800/60">
              <Text style={{ fontSize: 28 }}>{mode.icon}</Text>
              <Text className={`text-sm font-bold ${mode.color}`}>{mode.name}</Text>
              <Text className="text-[10px] text-neutral-500 text-center leading-3">{mode.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="flex-row items-start gap-2 px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-800/30">
        <Text className="text-purple-400 text-sm">✨</Text>
        <Text className="text-xs text-purple-300/80 leading-4 flex-1">
          {t(
            'tutorial.modesSpecialHint',
            'Try Special mode for extra roles like Detective, Guardian, and Jester — each with unique powers!',
          )}
        </Text>
      </View>
    </View>
  )
}

function StepTips({ t }: { t: TFn }) {
  const tips = [
    {
      icon: '🎯',
      text: t(
        'tutorial.tipClues',
        'Vague clues are safe but suspicious. Specific clues are convincing but risky. Find the balance.',
      ),
    },
    {
      icon: '👀',
      text: t('tutorial.tipWatch', "Watch who hesitates or gives clues that don't quite fit the category."),
    },
    {
      icon: '🤫',
      text: t('tutorial.tipRedHanded', 'As an imposter, listen carefully to villager clues to figure out their word.'),
    },
    {
      icon: '🗳️',
      text: t('tutorial.tipVoting', "Don't always follow the crowd when voting. Trust your own observations."),
    },
  ]

  return (
    <View className="gap-4">
      <View className="items-center mb-2">
        <Text className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">
          {t('tutorial.step', 'Step')} 4/4
        </Text>
        <Text className="text-xl font-extrabold text-white">
          {t('tutorial.tipsTitle', 'Pro Tips')}
        </Text>
        <Text className="text-neutral-500 text-xs mt-1">
          {t('tutorial.tipsSubtitle', 'Keep these in mind during your first game')}
        </Text>
      </View>

      <View className="gap-2">
        {tips.map((tip, i) => (
          <View
            key={i}
            className="flex-row items-start gap-3 px-3 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800/60"
          >
            <Text style={{ fontSize: 18 }}>{tip.icon}</Text>
            <Text className="text-xs text-neutral-300 leading-4 flex-1">{tip.text}</Text>
          </View>
        ))}
      </View>

      <View className="items-center mt-2">
        <View className="flex-row items-center gap-2 px-4 py-2 rounded-full bg-emerald-950/40 border border-emerald-800/40">
          <Text className="text-emerald-400 text-sm">✓</Text>
          <Text className="text-emerald-400 text-xs font-semibold">
            {t('tutorial.readyMessage', "You're all set! Time to find the imposter.")}
          </Text>
        </View>
      </View>
    </View>
  )
}
