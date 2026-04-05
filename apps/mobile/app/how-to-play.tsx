import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useResponsive } from '../lib/responsive'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface Slide {
  icon: string
  title: string
  subtitle: string
  content: { icon?: string; text: string }[]
  accent: string
  accentText: string
}

const SLIDES: Slide[] = [
  {
    icon: '🎮',
    title: 'The Setup',
    subtitle: 'How the game begins',
    accent: '#7c3aed',
    accentText: '#a78bfa',
    content: [
      { icon: '👥', text: 'Join a room with 4–10 players' },
      { icon: '🔒', text: 'Each player gets a secret role and word' },
      { icon: '🎯', text: 'Only you know your role — keep it hidden!' },
      { icon: '🌐', text: 'Play online or offline with friends nearby' },
    ],
  },
  {
    icon: '🎭',
    title: 'The Roles',
    subtitle: 'Who are you playing as?',
    accent: '#4f46e5',
    accentText: '#818cf8',
    content: [
      { icon: '🏘️', text: 'Villager: You get the real word. Find the imposter!' },
      { icon: '🔪', text: 'Imposter: You get a similar word. Blend in and survive!' },
      { icon: '🔍', text: 'Detective (Special): Can reveal one player\'s role per game' },
      { icon: '🕵️', text: 'Double Agent (Special): Knows both words. Works with impostors' },
    ],
  },
  {
    icon: '💬',
    title: 'Speaking Phase',
    subtitle: 'Give your clue wisely',
    accent: '#7c3aed',
    accentText: '#c4b5fd',
    content: [
      { icon: '1️⃣', text: 'Each player says one clue about their word' },
      { icon: '🎯', text: 'Too obvious? The imposter learns the real word' },
      { icon: '😶', text: 'Too vague? You look like the imposter!' },
      { icon: '⚠️', text: 'Say your actual word = instant elimination!' },
    ],
  },
  {
    icon: '🗳️',
    title: 'Voting Phase',
    subtitle: 'Root out the imposter',
    accent: '#b45309',
    accentText: '#fbbf24',
    content: [
      { icon: '🤔', text: 'Discuss who gave suspicious clues' },
      { icon: '☝️', text: 'Everyone votes for who they think is the imposter' },
      { icon: '💀', text: 'Most votes = eliminated and role revealed' },
      { icon: '🤝', text: 'Tie vote = no elimination, next round begins' },
    ],
  },
  {
    icon: '🏆',
    title: 'Winning',
    subtitle: 'How to claim victory',
    accent: '#b45309',
    accentText: '#fde68a',
    content: [
      { icon: '✅', text: 'Villagers win when all impostors are eliminated' },
      { icon: '😈', text: 'Impostors win when they equal or outnumber villagers' },
      { icon: '⚖️', text: 'Ties lead to tiebreaker rounds — no round limit!' },
      { icon: '🎖️', text: 'Ranked games affect your LP and tier ranking' },
    ],
  },
  {
    icon: '💡',
    title: 'Pro Tips',
    subtitle: 'Play like a champion',
    accent: '#065f46',
    accentText: '#34d399',
    content: [
      { icon: '👂', text: 'Listen to every clue — patterns reveal roles' },
      { icon: '🎨', text: 'Be creative but not too clever with your clues' },
      { icon: '🧠', text: 'As imposter, use others\' clues to deduce the word' },
      { icon: '👁️', text: 'Watch body language in real-life games!' },
    ],
  },
]

export default function HowToPlayScreen() {
  const router = useRouter()
  const scrollRef = useRef<ScrollView>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const { isTablet, fontScale } = useResponsive()

  const slideWidth = isTablet ? Math.min(SCREEN_WIDTH, 600) : SCREEN_WIDTH

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x
    const index = Math.round(offsetX / slideWidth)
    setCurrentIndex(Math.max(0, Math.min(index, SLIDES.length - 1)))
  }

  const goToNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (currentIndex + 1) * slideWidth, animated: true })
      setCurrentIndex(currentIndex + 1)
    } else {
      router.back()
    }
  }

  const goToPrev = () => {
    if (currentIndex > 0) {
      scrollRef.current?.scrollTo({ x: (currentIndex - 1) * slideWidth, animated: true })
      setCurrentIndex(currentIndex - 1)
    }
  }

  const isLast = currentIndex === SLIDES.length - 1
  const slide = SLIDES[currentIndex]

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEnabled
        style={{ flex: 1 }}
        contentContainerStyle={{ width: slideWidth * SLIDES.length }}
      >
        {SLIDES.map((s, i) => (
          <View
            key={i}
            style={{ width: slideWidth }}
            className="flex-1 px-6 pt-6 pb-4"
          >
            {/* Accent top border */}
            <View style={{ height: 3, backgroundColor: s.accent, borderRadius: 2, marginBottom: 24 }} />

            {/* Icon + Title */}
            <View className="items-center mb-8">
              <View
                className="rounded-3xl items-center justify-center mb-4"
                style={{
                  width: isTablet ? 96 : 80,
                  height: isTablet ? 96 : 80,
                  backgroundColor: `${s.accent}22`,
                  borderWidth: 1,
                  borderColor: `${s.accent}55`,
                }}
              >
                <Text style={{ fontSize: isTablet ? 44 : 36 }}>{s.icon}</Text>
              </View>
              <Text
                className="font-extrabold text-white text-center mb-1"
                style={{ fontSize: (isTablet ? 30 : 26) * fontScale }}
              >
                {s.title}
              </Text>
              <Text
                className="text-center font-medium"
                style={{ fontSize: 14 * fontScale, color: s.accentText }}
              >
                {s.subtitle}
              </Text>
            </View>

            {/* Content items */}
            <View className="space-y-3">
              {s.content.map((item, j) => (
                <View
                  key={j}
                  className="flex-row items-start gap-3 rounded-2xl border border-neutral-800/60 bg-neutral-900/60"
                  style={{ padding: isTablet ? 16 : 14 }}
                >
                  {item.icon && (
                    <Text style={{ fontSize: 20 * fontScale, marginTop: 1 }}>{item.icon}</Text>
                  )}
                  <Text
                    className="text-neutral-300 flex-1 leading-relaxed"
                    style={{ fontSize: 14 * fontScale }}
                  >
                    {item.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom controls */}
      <View className="px-6 pb-6 pt-4">
        {/* Pagination dots */}
        <View className="flex-row justify-center gap-1.5 mb-5">
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                scrollRef.current?.scrollTo({ x: i * slideWidth, animated: true })
                setCurrentIndex(i)
              }}
              style={{
                width: i === currentIndex ? 20 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === currentIndex ? slide.accent : '#404040',
                transition: 'width 0.2s',
              }}
            />
          ))}
        </View>

        {/* Navigation buttons */}
        <View className="flex-row gap-3">
          {currentIndex > 0 ? (
            <TouchableOpacity
              onPress={goToPrev}
              className="flex-1 py-4 rounded-2xl border border-neutral-700 bg-neutral-800 items-center"
              activeOpacity={0.8}
            >
              <Text className="text-neutral-300 font-bold" style={{ fontSize: 16 * fontScale }}>
                ← Back
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.back()}
              className="flex-1 py-4 rounded-2xl border border-neutral-700 bg-neutral-800 items-center"
              activeOpacity={0.8}
            >
              <Text className="text-neutral-400 font-bold" style={{ fontSize: 16 * fontScale }}>
                Skip
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={goToNext}
            className="flex-1 py-4 rounded-2xl items-center"
            style={{ backgroundColor: slide.accent }}
            activeOpacity={0.8}
          >
            <Text className="text-white font-extrabold" style={{ fontSize: 16 * fontScale }}>
              {isLast ? 'Done ✓' : 'Next →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}
