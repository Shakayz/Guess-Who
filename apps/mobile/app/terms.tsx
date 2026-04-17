import React from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useResponsive } from '../lib/responsive'

// Native Terms of Service mirror of the web TermsPage. Keeps copy + order
// identical so legal content stays in sync across platforms.

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

function P({ children, fontScale }: { children: React.ReactNode; fontScale: number }) {
  return (
    <Text className="text-neutral-400" style={{ fontSize: 13 * fontScale, lineHeight: 20 * fontScale }}>
      {children}
    </Text>
  )
}

function Bullet({ children, fontScale }: { children: React.ReactNode; fontScale: number }) {
  return (
    <View className="flex-row gap-2 pl-2">
      <Text className="text-neutral-500" style={{ fontSize: 13 * fontScale }}>•</Text>
      <Text className="flex-1 text-neutral-400" style={{ fontSize: 13 * fontScale, lineHeight: 20 * fontScale }}>
        {children}
      </Text>
    </View>
  )
}

export default function TermsScreen() {
  const router = useRouter()
  const { px, fontScale } = useResponsive()

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-neutral-950">
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-900">
        <TouchableOpacity onPress={() => router.back()} className="pr-3">
          <Text className="text-neutral-400" style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold flex-1" style={{ fontSize: 16 * fontScale }}>
          Terms of Service
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: px, paddingVertical: 20, paddingBottom: 48, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className="text-white font-extrabold" style={{ fontSize: 22 * fontScale }}>
            Terms of Service
          </Text>
          <Text className="text-neutral-500 mt-1" style={{ fontSize: 11 * fontScale }}>
            Last updated: April 5, 2026
          </Text>
        </View>

        <Section title="1. Acceptance of Terms" fontScale={fontScale}>
          <P fontScale={fontScale}>
            By accessing or using Red Handed ! (the "Game"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Game.
          </P>
        </Section>

        <Section title="2. Account Rules" fontScale={fontScale}>
          <P fontScale={fontScale}>
            Each person may maintain only one account. Creating multiple accounts to gain an unfair advantage is prohibited and may result in permanent bans.
          </P>
          <P fontScale={fontScale}>
            You must be at least <Text className="text-white font-semibold">13 years old</Text> to create an account. By registering, you confirm that you meet this requirement.
          </P>
          <P fontScale={fontScale}>
            You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account.
          </P>
        </Section>

        <Section title="3. Acceptable Use" fontScale={fontScale}>
          <P fontScale={fontScale}>You agree not to engage in any of the following:</P>
          <Bullet fontScale={fontScale}>Cheating, exploiting bugs, or using unauthorized software to gain advantages</Bullet>
          <Bullet fontScale={fontScale}>Harassing, threatening, or abusing other players</Bullet>
          <Bullet fontScale={fontScale}>Using hate speech, slurs, or discriminatory language in chat</Bullet>
          <Bullet fontScale={fontScale}>Impersonating other players or staff members</Bullet>
          <Bullet fontScale={fontScale}>Attempting to disrupt or interfere with game servers</Bullet>
          <Bullet fontScale={fontScale}>Sharing inappropriate, illegal, or offensive content</Bullet>
        </Section>

        <Section title="4. User Content" fontScale={fontScale}>
          <P fontScale={fontScale}>
            You may submit content including word packs and chat messages. By submitting content, you grant us a non-exclusive, royalty-free license to use, display, and moderate that content within the Game.
          </P>
          <P fontScale={fontScale}>
            You retain ownership of your content, but you are solely responsible for ensuring it complies with these terms and applicable laws.
          </P>
        </Section>

        <Section title="5. Virtual Currency" fontScale={fontScale}>
          <P fontScale={fontScale}>
            Star Coins are virtual in-game currency with no real-world monetary value. Star Coins are <Text className="text-white font-semibold">non-refundable</Text> and cannot be exchanged for real money or transferred between accounts.
          </P>
          <P fontScale={fontScale}>
            We reserve the right to modify the availability, pricing, or functionality of virtual currency and in-game items at any time.
          </P>
        </Section>

        <Section title="6. Termination" fontScale={fontScale}>
          <P fontScale={fontScale}>
            We reserve the right to suspend or permanently ban accounts that violate these Terms of Service, at our sole discretion, with or without prior notice. Serious violations such as hate speech or cheating may result in immediate permanent bans.
          </P>
        </Section>

        <Section title="7. Disclaimer of Warranties" fontScale={fontScale}>
          <P fontScale={fontScale}>
            The Game is provided <Text className="text-white font-semibold">"as is"</Text> without warranties of any kind. We do not guarantee uninterrupted service, and we are not liable for any data loss, downtime, or issues arising from use of the Game.
          </P>
        </Section>

        <Section title="8. Changes to Terms" fontScale={fontScale}>
          <P fontScale={fontScale}>
            We may update these Terms of Service from time to time. Continued use of the Game after changes are posted constitutes acceptance of the updated terms.
          </P>
        </Section>

        <Section title="9. Contact" fontScale={fontScale}>
          <P fontScale={fontScale}>
            If you have questions about these terms, please contact us at support@redhanded.game.
          </P>
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}
