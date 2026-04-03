import React from 'react'
import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'

export default function TabsLayout() {
  const { t } = useTranslation()

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#09090b' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        tabBarStyle: {
          backgroundColor: '#09090b',
          borderTopColor: '#262626',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: '#8b5cf6',
        tabBarInactiveTintColor: '#737373',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.play'),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <TabIcon icon="🎮" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: t('nav.leaderboard'),
          headerTitle: t('nav.leaderboard'),
          tabBarIcon: ({ color }) => (
            <TabIcon icon="🏆" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('nav.history'),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <TabIcon icon="📜" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: t('nav.friends'),
          headerTitle: t('nav.friends'),
          tabBarIcon: ({ color }) => (
            <TabIcon icon="👥" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <TabIcon icon="👤" color={color} />
          ),
        }}
      />
    </Tabs>
  )
}

import { Text } from 'react-native'
function TabIcon({ icon }: { icon: string; color: string }) {
  return <Text style={{ fontSize: 20 }}>{icon}</Text>
}
