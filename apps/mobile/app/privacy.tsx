import React from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useResponsive } from '../lib/responsive'

// Native mirror of the web PrivacyPage. Keeps the same copy + structure so
// the policy remains consistent across platforms; previously mobile just
// opened the web page in an external browser, which broke the native feel.

function Section({
  title,
  children,
  fontScale,
}: {
  title: string
  children: React.ReactNode
  fontScale: number
}) {
  return (
    <View className="gap-2">
      <Text className="text-white font-bold" style={{ fontSize: 15 * fontScale }}>
        {title}
      </Text>
      <View className="gap-2">{children}</View>
    </View>
  )
}

function P({
  children,
  fontScale,
}: {
  children: React.ReactNode
  fontScale: number
}) {
  return (
    <Text className="text-neutral-400" style={{ fontSize: 13 * fontScale, lineHeight: 20 * fontScale }}>
      {children}
    </Text>
  )
}

function Bullet({
  children,
  fontScale,
}: {
  children: React.ReactNode
  fontScale: number
}) {
  return (
    <View className="flex-row gap-2 pl-2">
      <Text className="text-neutral-500" style={{ fontSize: 13 * fontScale }}>
        •
      </Text>
      <Text
        className="flex-1 text-neutral-400"
        style={{ fontSize: 13 * fontScale, lineHeight: 20 * fontScale }}
      >
        {children}
      </Text>
    </View>
  )
}

export default function PrivacyScreen() {
  const router = useRouter()
  const { px, fontScale } = useResponsive()

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-neutral-950">
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-900">
        <TouchableOpacity onPress={() => router.back()} className="pr-3">
          <Text className="text-neutral-400" style={{ fontSize: 20 }}>
            ←
          </Text>
        </TouchableOpacity>
        <Text className="text-white font-bold flex-1" style={{ fontSize: 16 * fontScale }}>
          Privacy Policy
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: px, paddingVertical: 20, paddingBottom: 48, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className="text-white font-extrabold" style={{ fontSize: 22 * fontScale }}>
            Privacy Policy
          </Text>
          <Text className="text-neutral-500 mt-1" style={{ fontSize: 11 * fontScale }}>
            Last updated: April 5, 2026
          </Text>
        </View>

        <Section title="1. Data We Collect" fontScale={fontScale}>
          <P fontScale={fontScale}>When you use Red Handed !, we collect the following information:</P>
          <Bullet fontScale={fontScale}>
            <Text className="text-white font-semibold">Account information:</Text> username, email address, and hashed password
          </Bullet>
          <Bullet fontScale={fontScale}>
            <Text className="text-white font-semibold">Profile data:</Text> avatar image, rank tier, rank points, star coins, and honor points
          </Bullet>
          <Bullet fontScale={fontScale}>
            <Text className="text-white font-semibold">Game statistics:</Text> game results, win/loss record, roles played, and survival outcomes
          </Bullet>
          <Bullet fontScale={fontScale}>
            <Text className="text-white font-semibold">Chat messages:</Text> in-game and direct messages exchanged between players
          </Bullet>
          <Bullet fontScale={fontScale}>
            <Text className="text-white font-semibold">Device information:</Text> push notification tokens for delivering game notifications
          </Bullet>
        </Section>

        <Section title="2. How We Use Your Data" fontScale={fontScale}>
          <P fontScale={fontScale}>We use the data we collect to:</P>
          <Bullet fontScale={fontScale}>Provide and operate the core game functionality and matchmaking</Bullet>
          <Bullet fontScale={fontScale}>Display leaderboards and player profiles</Bullet>
          <Bullet fontScale={fontScale}>Deliver in-game and push notifications</Bullet>
          <Bullet fontScale={fontScale}>Enforce our Terms of Service and maintain platform safety</Bullet>
          <Bullet fontScale={fontScale}>Improve game balance and player experience</Bullet>
        </Section>

        <Section title="3. Data Sharing" fontScale={fontScale}>
          <P fontScale={fontScale}>
            We <Text className="text-white font-semibold">do not sell, rent, or share</Text> your personal information with third parties for their marketing purposes. Your data is used solely to operate and improve the Game.
          </P>
          <P fontScale={fontScale}>
            Public profile information (username, avatar, rank, and game stats) is visible to other players as part of the game experience.
          </P>
        </Section>

        <Section title="4. Data Retention" fontScale={fontScale}>
          <P fontScale={fontScale}>
            We retain your account data for as long as your account is active. If you delete your account, your personal data is permanently removed from our systems within 30 days. Aggregated, anonymized statistics may be retained indefinitely.
          </P>
        </Section>

        <Section title="5. Account Deletion" fontScale={fontScale}>
          <P fontScale={fontScale}>
            You can delete your account at any time from Settings → Account → Delete Account. This action is irreversible and will permanently remove all your data including game history, rank, and virtual currency.
          </P>
        </Section>

        <Section title="6. Children's Privacy" fontScale={fontScale}>
          <P fontScale={fontScale}>
            The Game is not directed at children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected such data, we will promptly delete it.
          </P>
        </Section>

        <Section title="7. Local Storage" fontScale={fontScale}>
          <P fontScale={fontScale}>We use device local storage to store:</P>
          <Bullet fontScale={fontScale}>Authentication tokens (to keep you signed in)</Bullet>
          <Bullet fontScale={fontScale}>User preferences such as sound settings, haptic settings, and language selection</Bullet>
          <P fontScale={fontScale}>
            This data is stored locally on your device and is not transmitted to third parties.
          </P>
        </Section>

        <Section title="8. Security" fontScale={fontScale}>
          <P fontScale={fontScale}>
            We take reasonable technical and organizational measures to protect your data, including encrypted password storage (bcrypt) and HTTPS for all data transmission. No security system is perfect, and we cannot guarantee absolute security.
          </P>
        </Section>

        <Section title="9. Changes to This Policy" fontScale={fontScale}>
          <P fontScale={fontScale}>
            We may update this Privacy Policy periodically. We will notify users of significant changes by posting a notice in the app. Continued use of the Game after changes constitutes your acceptance of the updated policy.
          </P>
        </Section>

        <Section title="10. Contact" fontScale={fontScale}>
          <P fontScale={fontScale}>
            For privacy-related questions or data requests, please contact us at privacy@redhanded.game.
          </P>
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}
