import React from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useResponsive } from '../lib/responsive'
import { LanguagePicker } from '../components/LanguagePicker'
import {
  OFFLINE_ROLE_REGISTRY,
  VILLAGER_OFFLINE_ROLES,
  RED_HANDED_OFFLINE_ROLES,
  NEUTRAL_OFFLINE_ROLES,
  type OfflineRole,
  type OfflineRoleColor,
} from '@red-handed/shared'

const COLOR_TEXT: Record<OfflineRoleColor, string> = {
  emerald: 'text-emerald-300',
  red: 'text-red-300',
  blue: 'text-blue-300',
  amber: 'text-amber-300',
  yellow: 'text-yellow-300',
  indigo: 'text-indigo-300',
  teal: 'text-teal-300',
  fuchsia: 'text-fuchsia-300',
  pink: 'text-pink-300',
  orange: 'text-orange-300',
  rose: 'text-rose-300',
  purple: 'text-purple-300',
}

interface RoleRowProps {
  roleKey: OfflineRole
  fontScale: number
  isTablet: boolean
}

function RoleRow({ roleKey, fontScale, isTablet }: RoleRowProps) {
  const { t } = useTranslation()
  const def = OFFLINE_ROLE_REGISTRY[roleKey]
  const labelClass = COLOR_TEXT[def.colorToken]
  return (
    <View
      className="flex-row items-start gap-3 rounded-2xl border border-neutral-800/60 bg-neutral-900/60"
      style={{ padding: isTablet ? 14 : 12 }}
    >
      <Text style={{ fontSize: 22, marginTop: 1 }}>{def.iconEmoji}</Text>
      <View className="flex-1">
        <Text className={['font-bold', labelClass].join(' ')} style={{ fontSize: 13 * fontScale }}>
          {t(def.i18nLabelKey)}
        </Text>
        <Text className="text-neutral-400 mt-0.5" style={{ fontSize: 12 * fontScale, lineHeight: 16 * fontScale }}>
          {t(def.i18nDescKey)}
        </Text>
      </View>
    </View>
  )
}

function TeamSection({
  title,
  emoji,
  accent,
  roles,
  fontScale,
  isTablet,
}: {
  title: string
  emoji: string
  accent: string
  roles: readonly OfflineRole[]
  fontScale: number
  isTablet: boolean
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2 px-1">
        <Text style={{ fontSize: 16 }}>{emoji}</Text>
        <Text
          className={['font-extrabold uppercase tracking-widest', accent].join(' ')}
          style={{ fontSize: 12 * fontScale }}
        >
          {title}
        </Text>
      </View>
      <View className="gap-2">
        {roles.map((r) => (
          <RoleRow key={r} roleKey={r} fontScale={fontScale} isTablet={isTablet} />
        ))}
      </View>
    </View>
  )
}

const HOW_IT_WORKS_STEPS = [
  'offline.htpStep1',
  'offline.htpStep2',
  'offline.htpStep3',
  'offline.htpStep4',
] as const

export default function HowToPlayScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { isTablet, px, fontScale } = useResponsive()
  const contentStyle = isTablet
    ? { maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const }
    : {}

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={contentStyle}>
          {/* Hero header */}
          <View className="items-center pt-6 pb-6" style={{ paddingHorizontal: px }}>
            <View className="self-end mb-2">
              <LanguagePicker />
            </View>
            <Text
              className="font-extrabold text-white text-center leading-tight tracking-tight"
              style={{ fontSize: isTablet ? 36 : 30 }}
            >
              {t('howToPlay.title', { defaultValue: 'How to Play' })}
            </Text>
            <Text
              className="text-neutral-400 mt-2 text-center"
              style={{ fontSize: 13 * fontScale }}
            >
              {t('howToPlay.subtitle', {
                defaultValue: 'Master the art of deception and deduction.',
              })}
            </Text>
          </View>

          {/* How it works */}
          <View
            className="rounded-2xl border border-neutral-800 bg-neutral-900/60 gap-2"
            style={{ marginHorizontal: px, padding: isTablet ? 18 : 14 }}
          >
            <Text className="text-neutral-200 font-bold" style={{ fontSize: 13 * fontScale }}>
              {t('offline.htpHowItWorks', { defaultValue: 'How it works' })}
            </Text>
            <View className="gap-1.5">
              {HOW_IT_WORKS_STEPS.map((stepKey, idx) => (
                <View key={stepKey} className="flex-row gap-2">
                  <Text className="text-violet-400 font-bold" style={{ fontSize: 12 * fontScale }}>
                    {idx + 1}.
                  </Text>
                  <Text
                    className="text-neutral-400 flex-1"
                    style={{ fontSize: 12 * fontScale, lineHeight: 16 * fontScale }}
                  >
                    {t(stepKey, { defaultValue: '' })}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Normal mode card */}
          <View
            className="rounded-2xl border border-neutral-800 bg-neutral-900/60 gap-3 mt-4"
            style={{ marginHorizontal: px, padding: isTablet ? 18 : 14 }}
          >
            <View className="flex-row items-center gap-2">
              <Text style={{ fontSize: 18 }}>🎲</Text>
              <Text className="text-violet-400 font-bold" style={{ fontSize: 14 * fontScale }}>
                {t('offline.normal', { defaultValue: 'Normal' })}
              </Text>
              <View className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700/40">
                <Text className="text-neutral-500 font-semibold" style={{ fontSize: 9 * fontScale }}>
                  {t('offline.htpMinPlayers', { count: 3, defaultValue: '3+ players' })}
                </Text>
              </View>
            </View>
            <Text className="text-neutral-400" style={{ fontSize: 12 * fontScale, lineHeight: 16 * fontScale }}>
              {t('offline.htpNormalDesc', {
                defaultValue:
                  'Each player gets a secret word. Imposters get a similar but different word and must blend in.',
              })}
            </Text>
            <View className="gap-2">
              <RoleRow roleKey="villager" fontScale={fontScale} isTablet={isTablet} />
              <RoleRow roleKey="red_handed" fontScale={fontScale} isTablet={isTablet} />
            </View>
          </View>

          {/* Special mode card */}
          <View
            className="rounded-2xl border border-neutral-800 bg-neutral-900/60 gap-4 mt-4"
            style={{ marginHorizontal: px, padding: isTablet ? 18 : 14 }}
          >
            <View className="flex-row items-center gap-2">
              <Text style={{ fontSize: 18 }}>⚡</Text>
              <Text className="text-amber-400 font-bold" style={{ fontSize: 14 * fontScale }}>
                {t('offline.special', { defaultValue: 'Special' })}
              </Text>
              <View className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700/40">
                <Text className="text-neutral-500 font-semibold" style={{ fontSize: 9 * fontScale }}>
                  {t('offline.htpMinPlayers', { count: 5, defaultValue: '5+ players' })}
                </Text>
              </View>
            </View>
            <Text className="text-neutral-400" style={{ fontSize: 12 * fontScale, lineHeight: 16 * fontScale }}>
              {t('offline.htpSpecialDesc', {
                defaultValue:
                  'Add roles like Detective, Guardian, or Corruptor for deeper deduction and chaos.',
              })}
            </Text>

            <TeamSection
              title={t('offline.teamVillagers', { defaultValue: 'Villagers' })}
              emoji="🟢"
              accent="text-emerald-400"
              roles={VILLAGER_OFFLINE_ROLES}
              fontScale={fontScale}
              isTablet={isTablet}
            />

            <TeamSection
              title={t('offline.teamRedHanded', { defaultValue: 'Imposter' })}
              emoji="🔴"
              accent="text-red-400"
              roles={RED_HANDED_OFFLINE_ROLES}
              fontScale={fontScale}
              isTablet={isTablet}
            />

            {/* Pair (Evil Twins) */}
            <View className="gap-2">
              <View className="flex-row items-center gap-2 px-1">
                <Text style={{ fontSize: 16 }}>👯</Text>
                <Text className="text-purple-400 font-extrabold uppercase tracking-widest" style={{ fontSize: 12 * fontScale }}>
                  {t('offline.teamPair', { defaultValue: 'Pair' })}
                </Text>
              </View>
              <View
                className="flex-row items-start gap-3 rounded-2xl border border-neutral-800/60 bg-neutral-900/60"
                style={{ padding: isTablet ? 14 : 12 }}
              >
                <Text style={{ fontSize: 22, marginTop: 1 }}>👯</Text>
                <View className="flex-1">
                  <Text className="text-purple-300 font-bold" style={{ fontSize: 13 * fontScale }}>
                    {t('offline.evilTwins', { defaultValue: 'Evil Twins' })}
                  </Text>
                  <Text className="text-neutral-400 mt-0.5" style={{ fontSize: 12 * fontScale, lineHeight: 16 * fontScale }}>
                    {t('offline.htpEvilTwinsDesc', {
                      defaultValue:
                        'A linked pair (one villager, one redHanded) who win together if both survive — but lose individually if separated.',
                    })}
                  </Text>
                </View>
              </View>
            </View>

            <TeamSection
              title={t('offline.teamNeutral', { defaultValue: 'Neutral' })}
              emoji="⚪"
              accent="text-sky-400"
              roles={NEUTRAL_OFFLINE_ROLES}
              fontScale={fontScale}
              isTablet={isTablet}
            />
          </View>

          {/* CTAs */}
          <View
            className="flex-row gap-3 mt-6"
            style={{ marginHorizontal: px }}
          >
            <TouchableOpacity
              onPress={() => router.replace('/')}
              className="flex-1 rounded-2xl items-center bg-violet-600"
              style={{ paddingVertical: isTablet ? 16 : 14 }}
              activeOpacity={0.85}
            >
              <Text className="text-white font-extrabold" style={{ fontSize: 15 * fontScale }}>
                {t('howToPlay.playNow', { defaultValue: 'Play Now' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.back()}
              className="px-6 rounded-2xl bg-neutral-800 border border-neutral-700 items-center justify-center"
              style={{ paddingVertical: isTablet ? 16 : 14 }}
              activeOpacity={0.85}
            >
              <Text className="text-neutral-300 font-semibold" style={{ fontSize: 14 * fontScale }}>
                {t('common.close', { defaultValue: 'Close' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
