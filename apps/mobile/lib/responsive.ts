import { useWindowDimensions } from 'react-native'

export type DeviceSize = 'phone' | 'tablet'

interface ResponsiveValues {
  /** 'phone' for width < 768, 'tablet' otherwise */
  device: DeviceSize
  isTablet: boolean
  /** Screen width in points */
  width: number
  /** Screen height in points */
  height: number
  /** Horizontal padding: 16 on phone, 32 on tablet */
  px: number
  /** Content max width on tablet to avoid overly wide layouts (600 on tablet, full on phone) */
  contentMax: number
  /** Number of columns for grid layouts: 2 on phone, 3-4 on tablet */
  gridCols: number
  /** Grid item width percentage string (e.g. '47%' or '31%') */
  gridItemWidth: string
  /** Font scale factor: 1 on phone, 1.15 on tablet */
  fontScale: number
  /** Tab bar height */
  tabBarHeight: number
  /** Whether the device is in landscape orientation */
  isLandscape: boolean
}

export function useResponsive(): ResponsiveValues {
  const { width, height } = useWindowDimensions()
  const isTablet = width >= 768
  const isLandscape = width > height

  return {
    device: isTablet ? 'tablet' : 'phone',
    isTablet,
    width,
    height,
    px: isTablet ? 32 : 16,
    contentMax: isTablet ? 600 : width,
    gridCols: isTablet ? (isLandscape ? 4 : 3) : 2,
    gridItemWidth: isTablet ? (isLandscape ? '23%' : '31%') : '47%',
    fontScale: isTablet ? 1.15 : 1,
    tabBarHeight: isTablet ? 72 : 60,
    isLandscape,
  }
}

/**
 * Wrapper component that constrains content width on tablets.
 * Use this around ScrollView content to keep things centered and readable.
 */
export function responsiveContentStyle(isTablet: boolean, width: number) {
  if (!isTablet) return {}
  return {
    maxWidth: 700,
    alignSelf: 'center' as const,
    width: '100%' as const,
  }
}
