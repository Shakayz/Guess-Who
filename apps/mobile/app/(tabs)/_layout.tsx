import React from 'react'
import { Text } from 'react-native'
import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useResponsive } from '../../lib/responsive'

export default function TabsLayout() {
  const { t } = useTranslation()
  const { isTablet, tabBarHeight } = useResponsive()

  const iconSize = isTablet ? 26 : 20
  const labelSize = isTablet ? 12 : 10

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#09090b' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold', fontSize: isTablet ? 20 : 17 },
        tabBarStyle: {
          backgroundColor: '#09090b',
          borderTopColor: '#262626',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: isTablet ? 10 : 8,
          paddingTop: isTablet ? 6 : 4,
        },
        tabBarActiveTintColor: '#8b5cf6',
        tabBarInactiveTintColor: '#737373',
        tabBarLabelStyle: {
          fontSize: labelSize,
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
            <TabIcon icon="🎮" size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: t('nav.leaderboard'),
          headerTitle: t('nav.leaderboard'),
          tabBarIcon: ({ color }) => (
            <TabIcon icon="🏆" size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('nav.history'),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <TabIcon icon="📜" size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: t('nav.friends'),
          headerTitle: t('nav.friends'),
          tabBarIcon: ({ color }) => (
            <TabIcon icon="👥" size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <TabIcon icon="👤" size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: t('nav.shop', 'Shop'),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <TabIcon icon="🛒" size={iconSize} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}

function TabIcon({ icon, size }: { icon: string; size: number; color: string }) {
  return <Text style={{ fontSize: size }}>{icon}</Text>
}
