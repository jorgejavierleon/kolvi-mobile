import type { ExpoConfig } from 'expo/config';

import { colors } from './src/theme/colors.ts';

/**
 * TypeScript rather than `app.json` so the native chrome the employee sees before a
 * single line of JavaScript runs — the splash background and the adaptive icon — is
 * the same `colors.primary` the app itself uses, instead of a hex re-typed here and
 * left to drift.
 */
const config: ExpoConfig = {
  name: 'Kolvi',
  slug: 'kolvi-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'kolvi',
  userInterfaceStyle: 'light',
  platforms: ['android', 'ios', 'web'],
  android: {
    package: 'cl.kolvi.empleados',
    adaptiveIcon: {
      backgroundColor: colors.primary,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'cl.kolvi.empleados',
  },
  web: {
    output: 'static',
    bundler: 'metro',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      // Debug builds only. The dev client's floating tools button parks itself in
      // the top-right corner — exactly where the design puts the avatar that opens
      // the profile — and swallows every tap on it, so no flow can reach the
      // profile while it is on. It is turned off rather than worked around: the
      // dev menu is still one shake or `adb shell input keyevent 82` away.
      'expo-dev-client',
      {
        toolsButton: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: colors.primary,
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 28,
        },
      },
    ],
    'expo-font',
    // The device id that names this installation's Sanctum token lives in the
    // Android keystore / iOS keychain, not in app storage, so a backup restored
    // onto a second handset cannot resurrect it and silently steal the token.
    'expo-secure-store',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
