import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'

let hapticsEnabled = true

export const HapticManager = {
  init: async () => {
    const stored = await AsyncStorage.getItem('haptics_enabled')
    hapticsEnabled = stored !== 'false'
  },
  isEnabled: () => hapticsEnabled,
  setEnabled: async (enabled: boolean) => {
    hapticsEnabled = enabled
    await AsyncStorage.setItem('haptics_enabled', String(enabled))
  },
  light: () => { if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) },
  medium: () => { if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) },
  heavy: () => { if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy) },
  success: () => { if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) },
  warning: () => { if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning) },
  error: () => { if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error) },
  selection: () => { if (hapticsEnabled) Haptics.selectionAsync() },
}
