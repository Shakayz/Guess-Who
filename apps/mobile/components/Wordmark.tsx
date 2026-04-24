import React from 'react'
import { Image, View, StyleProp, ViewStyle } from 'react-native'

const WORDMARK_SRC = require('../assets/wordmark.png')
const resolved = Image.resolveAssetSource(WORDMARK_SRC)
const IMG_W = resolved?.width ?? 1024
const IMG_H = resolved?.height ?? 1536

// Match apps/web/src/pages/AuthPage.tsx: container aspect 863/348, object-cover
// with objectPosition: 'center 51.8%' — crops to the wordmark text area only.
const CROP_W = 863
const CROP_H = 348
const CROP_ASPECT = CROP_W / CROP_H
const Y_FOCUS = 0.518

interface WordmarkProps {
  /** Kept for API compatibility with the old text wordmark — ignored. */
  layout?: 'inline' | 'stacked'
  /** Rendered width in px. Height auto-scales to preserve the cropped aspect ratio (~2.48). */
  size?: number
  style?: StyleProp<ViewStyle>
  className?: string
}

export function Wordmark({ size = 224, style }: WordmarkProps) {
  const width = size
  const height = width / CROP_ASPECT

  // object-cover: scale the underlying image so the cropped window is fully
  // covered. The image is wider than the crop → scale by width, then offset y
  // so the focus point (51.8% down) lands at the vertical center of the crop.
  const scale = width / IMG_W
  const scaledH = IMG_H * scale
  const offsetY = -(scaledH * Y_FOCUS - height / 2)

  return (
    <View
      style={[{ width, height, overflow: 'hidden' }, style]}
      accessible
      accessibilityLabel="Red Handed !"
    >
      <Image
        source={WORDMARK_SRC}
        style={{ width, height: scaledH, marginTop: offsetY }}
        resizeMode="cover"
      />
    </View>
  )
}
