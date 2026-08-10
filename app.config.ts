import type { ExpoConfig } from 'expo/config';

import { es } from './src/i18n/strings.ts';
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
    // The durable punch queue (KMO-23). Every default here is fine as-is — no
    // encryption, no FTS, no custom build flags — a queue of a handful of
    // punches has no need for any of them.
    'expo-sqlite',
    // The device id that names this installation's Sanctum token lives in the
    // Android keystore / iOS keychain, not in app storage, so a backup restored
    // onto a second handset cannot resurrect it and silently steal the token.
    'expo-secure-store',
    [
      // Biometric app unlock (KMO-10). Adds USE_BIOMETRIC and USE_FINGERPRINT on
      // Android; on iOS it writes NSFaceIDUsageDescription, whose default is an
      // English sentence Apple shows to the employee — so the Spanish one comes
      // from the catalogue rather than being retyped here.
      'expo-local-authentication',
      {
        faceIDPermission: es.security.faceIdUsage,
      },
    ],
    [
      // Geolocation for the punch (KMO-16). Every flag here is off, and that is
      // the feature: the app reads the phone's position while an employee is
      // looking at the Marcaje tab and at no other time, so `ACCESS_BACKGROUND_
      // LOCATION`, the foreground service and the iOS background mode would each
      // be a permission the app asks for and never uses. Leaving them false is
      // what makes "never tracks in the background" (#10) checkable in the
      // generated manifest rather than a claim in a comment.
      //
      // iOS shows `locationWhenInUsePermission` in its own dialog, so it comes
      // from the catalogue for the same reason `faceIDPermission` does — Res. 38
      // Art. 5 has no exception for a sentence the OS happens to draw. The two
      // "always" keys are omitted outright: a usage description for a permission
      // the app never requests is a review question with no answer behind it.
      'expo-location',
      {
        locationWhenInUsePermission: es.permissions.location.whenInUseUsage,
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
        isAndroidMotionActivityEnabled: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
