import type { ExpoConfig } from 'expo/config'

const ADMOB_ANDROID_APP_ID =
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ?? 'ca-app-pub-3940256099942544~3347511713'
const ADMOB_IOS_APP_ID =
  process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ?? 'ca-app-pub-3940256099942544~1458002511'

const config: ExpoConfig = {
  name: 'Red Handed !',
  slug: 'red-handed',
  version: '1.0.0',
  // Tied to `version` so each store binary gets its own update channel —
  // EAS Updates will only ship JS bundles to clients running the matching
  // app version, preventing OTA pushes from breaking older installs.
  runtimeVersion: { policy: 'appVersion' },
  orientation: 'default',
  icon: './assets/masks.png',
  scheme: 'redhanded',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/wordmark.png',
    resizeMode: 'contain',
    backgroundColor: '#09090b',
  },
  ios: {
    usesAppleSignIn: true,
    supportsTablet: true,
    bundleIdentifier: 'com.redhanded.game',
    requireFullScreen: false,
    associatedDomains: [
      'applinks:redhanded-game.com',
      'applinks:staging.redhanded-game.com',
    ],
    infoPlist: {
      NSCameraUsageDescription: 'Take a photo for your profile picture',
      NSPhotoLibraryUsageDescription: 'Choose a profile picture from your gallery',
      NSPhotoLibraryAddOnlyUsageDescription: 'Save images to your gallery',
      NSMicrophoneUsageDescription:
        'Red Handed ! uses the microphone so other players can hear you during vocal mode rounds.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/masks.png',
      backgroundColor: '#09090b',
    },
    package: 'com.redhanded.game',
    intentFilters: [
      {
        action: 'VIEW',
        data: [{ scheme: 'redhanded' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'VIBRATE',
      'RECEIVE_BOOT_COMPLETED',
      'RECORD_AUDIO',
      'MODIFY_AUDIO_SETTINGS',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#7c3aed',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow Red Handed ! to access your photos for profile pictures',
        cameraPermission: 'Allow Red Handed ! to use the camera for profile pictures',
      },
    ],
    'expo-apple-authentication',
    'expo-font',
    'expo-web-browser',
    [
      'react-native-iap',
      { paymentProvider: 'both' },
    ],
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: ADMOB_ANDROID_APP_ID,
        iosAppId: ADMOB_IOS_APP_ID,
        userTrackingUsageDescription:
          'This identifier will be used to deliver personalized ads to you.',
      },
    ],
    [
      '@config-plugins/react-native-webrtc',
      {
        microphonePermission:
          'Red Handed ! uses the microphone so other players can hear you during vocal mode rounds.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '',
    },
  },
}

export default config
