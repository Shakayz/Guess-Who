import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useResponsive } from '../lib/responsive'
import { HapticManager } from '../lib/haptics'

// Condensed interactive tutorial for mobile. The web TutorialPage is
// 700+ lines of walkthrough; this version captures the same four core
// concepts (roles, clues, voting, win conditions) in a step-by-step
// flow so new players on mobile get the same onboarding experience.

interface Step {
  emoji: string
  title: string
  body: string
  tip?: string
}

const STEPS: Step[] = [
  {
    emoji: '🎭',
    title: 'Roles & Words',
    body: 'Each game, most players are Villagers and a few are Imposters. Villagers get Word A; Imposters get Word B. The words are similar but not the same.',
    tip: 'You only see your own word. Study it — everyone is describing something close to it.',
  },
  {
    emoji: '💬',
    title: 'Give a One-Sentence Clue',
    body: 'When your turn comes, say one short clue about your word without saying the word itself. Be specific enough to convince villagers, vague enough to not expose yourself.',
    tip: 'As an Imposter, listen first — copy the style of the villager clues you hear.',
  },
  {
    emoji: '🗳️',
    title: 'Vote Them Out',
    body: 'After everyone speaks, each player votes for who they think is an Imposter. The player with the most votes is eliminated and their role is revealed.',
    tip: 'A tie means nobody is eliminated — except when the Judge role is in play.',
  },
  {
    emoji: '🏆',
    title: 'Win Conditions',
    body: 'Villagers win by eliminating every Imposter. Imposters win when their count equals or exceeds the remaining Villagers.',
    tip: 'Special roles (Detective, Guardian, Mayor, Jester…) change the math — watch your lobby badges.',
  },
  {
    emoji: '🎉',
    title: "You're Ready!",
    body: "That's the core loop — create a room, invite friends or match with strangers, and trust your gut. Good luck out there.",
  },
]

export default function TutorialScreen() {
  const router = useRouter()
  const { px, fontScale, isTablet } = useResponsive()
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const next = () => {
    HapticManager.light()
    if (isLast) {
      router.push('/offline')
    } else {
      setStep((s) => s + 1)
    }
  }

  const prev = () => {
    if (step === 0) return
    HapticManager.light()
    setStep((s) => s - 1)
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-neutral-950">
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-900">
        <TouchableOpacity onPress={() => router.back()} className="pr-3">
          <Text className="text-neutral-400" style={{ fontSize: 20 }}>×</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold flex-1" style={{ fontSize: 16 * fontScale }}>
          Tutorial
        </Text>
        <TouchableOpacity onPress={() => router.push('/how-to-play')}>
          <Text className="text-neutral-500" style={{ fontSize: 12 * fontScale }}>
            Full guide ›
          </Text>
        </TouchableOpacity>
      </View>

      {/* Progress dots */}
      <View className="flex-row items-center justify-center gap-1.5 py-3">
        {STEPS.map((_, i) => (
          <View
            key={i}
            className={[
              'rounded-full',
              i < step ? 'bg-violet-500' : i === step ? 'bg-violet-400' : 'bg-neutral-800',
            ].join(' ')}
            style={{ width: i === step ? 22 : 8, height: 8 }}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 48, flexGrow: 1, justifyContent: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-3xl border border-neutral-800 bg-neutral-900 items-center gap-4" style={{ padding: isTablet ? 36 : 26 }}>
          <Text style={{ fontSize: isTablet ? 72 : 60 }}>{current.emoji}</Text>
          <Text className="text-white font-extrabold text-center" style={{ fontSize: (isTablet ? 26 : 22) * fontScale }}>
            {current.title}
          </Text>
          <Text
            className="text-neutral-300 text-center"
            style={{ fontSize: 14 * fontScale, lineHeight: 22 * fontScale }}
          >
            {current.body}
          </Text>
          {current.tip && (
            <View className="rounded-xl border border-violet-800/40 bg-violet-950/40 px-4 py-3 w-full">
              <Text className="text-violet-300 font-semibold" style={{ fontSize: 11 * fontScale }}>
                💡 Tip
              </Text>
              <Text className="text-violet-200 mt-1" style={{ fontSize: 12 * fontScale, lineHeight: 18 * fontScale }}>
                {current.tip}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View className="flex-row gap-2 px-4 pb-6 pt-2 border-t border-neutral-900 bg-neutral-950">
        <TouchableOpacity
          onPress={prev}
          disabled={step === 0}
          className={[
            'flex-1 items-center justify-center rounded-2xl py-3',
            step === 0 ? 'bg-neutral-900 border border-neutral-800' : 'bg-neutral-800 border border-neutral-700',
          ].join(' ')}
          activeOpacity={0.85}
        >
          <Text
            className={step === 0 ? 'text-neutral-600 font-semibold' : 'text-neutral-200 font-semibold'}
            style={{ fontSize: 14 * fontScale }}
          >
            Back
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={next}
          className="flex-1 items-center justify-center rounded-2xl bg-violet-600 py-3"
          activeOpacity={0.85}
        >
          <Text className="text-white font-extrabold" style={{ fontSize: 14 * fontScale }}>
            {isLast ? 'Play Now' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
