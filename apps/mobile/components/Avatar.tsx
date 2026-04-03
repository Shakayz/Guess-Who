import React from 'react'
import { View, Text, Image } from 'react-native'

interface AvatarProps {
  url?: string | null
  username: string
  size?: number
  borderColor?: string
}

export function Avatar({ url, username, size = 40, borderColor }: AvatarProps) {
  const initial = (username ?? '?').charAt(0).toUpperCase()
  const fontSize = Math.round(size * 0.4)

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: borderColor ? 2 : 0,
          borderColor,
        }}
      />
    )
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: borderColor ? 2 : 0,
        borderColor,
      }}
      className="bg-violet-700 items-center justify-center"
    >
      <Text style={{ fontSize }} className="text-white font-bold">
        {initial}
      </Text>
    </View>
  )
}
