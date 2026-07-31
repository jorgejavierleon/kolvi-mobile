---
id: KMO-1
title: Scaffold the Expo TypeScript project
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-07-31 01:43'
labels:
  - mobile
  - foundation
milestone: m-0
dependencies: []
documentation:
  - docs/design-decisions.md
priority: high
type: chore
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stand up the repository as a working Expo app so every later task has somewhere to land. Android is the primary target (Android 9+); iOS builds from the same codebase one release later.

The repo currently holds only docs and this Backlog.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A new Expo app with TypeScript in strict mode runs on an Android emulator and shows a placeholder screen
- [x] #2 Directory structure separates app screens, shared UI primitives, domain features, API layer and i18n; the convention is written down in the README
- [x] #3 ESLint and Prettier are configured and pass on a clean checkout
- [x] #4 A test runner is configured and one example test passes
- [x] #5 app.json declares the Android package id, minimum SDK for Android 9, app name and the portrait-only orientation
- [x] #6 README documents how to install, run on device or emulator, and run the checks
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pin JDK 17 (temurin) via a project-scoped mise.toml; system JDK 26 is rejected by AGP.
2. Install Android cmdline-tools + platform-tools + emulator + platforms/android-36 + system-images/android-36/google_apis/x86_64 under ~/Android. Use google_apis (not playstore) so adb root and pm grant/revoke work for permission-state testing.
3. Create a headless AVD (kolvi-pixel) sized to a mid-range Android 9+ target; KVM is available so it runs accelerated.
4. Add expo-dev-client and build the dev client with expo run:android; Expo Go is not viable (push removed on Android in SDK 53+, expo-build-properties minSdkVersion 28 ignored).
5. Wrap the loop in bin/ helper scripts: emulator start/stop, screenshot, ui dump, and the device-state toggles (geo fix, airplane mode, permission grant/revoke).
6. Document the workflow in the README, including the scrcpy-over-SSH tunnel for viewing the emulator from the work laptop.
7. Verify AC #1 with a screenshot of the placeholder screen rendered on the emulator.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scaffolded on Expo SDK 57 (expo 57.0.9, expo-router 57.0.9, React 19.2.3, React Native 0.86.2, TypeScript 6.0.3). The SDK 57 template roots Expo Router at src/app, so the whole codebase lives under src/ with routes as one directory among peers.

Structure: src/app (routes), src/theme, src/ui, src/features/{marcaje,jornada,permisos,documentos}, src/api, src/i18n, assets/. Alias @/* -> src/*, @/assets/* -> assets/. Empty dirs carry a .gitkeep so the convention exists in git.

Verified against the generated native project (expo prebuild --platform android, then deleted since android/ is gitignored):
- android/app/build.gradle -> applicationId 'cl.kolvi.empleados'
- android/gradle.properties -> android.minSdkVersion=28 (Android 9)
- AndroidManifest.xml -> android:screenOrientation="portrait"
- strings.xml -> app_name = Kolvi

Checks, all green from a wiped node_modules + npm ci, and again with .expo/ and expo-env.d.ts deleted so nothing depends on generated types:
- npm run typecheck (tsc --noEmit; strict plus noUncheckedIndexedAccess, noImplicitOverride, noFallthroughCasesInSwitch, noUnusedLocals, noUnusedParameters)
- npm run lint (eslint-config-expo flat + eslint-config-prettier)
- npm run format:check (Prettier; docs/, CLAUDE.md and backlog/ are ignored as prose/CLI-managed)
- npm test (jest-expo; 1 suite, 1 test)
- npx expo export --platform android -> Android bundle built, 1231 modules
npm run check chains all four for CI to reuse in KMO-7.

Three things worth carrying forward:
1. expo-router builds routes from the filesystem and does NOT skip test files, so *.test.tsx can never live under src/app. Tests colocate with implementations in ui/ and features/. Documented as rule 3 in the README.
2. @testing-library/react-native v14 made render() async - tests must await it, or screen queries throw 'render function has not been called'. It also auto-extends expect, so no jest setup file is needed.
3. react-dom must stay pinned at 19.2.3. Dropping it (no web target) let expo-router's transitive web deps (vaul, radix) pull react-dom 19.2.8, which peer-requires react ^19.2.8 and breaks npm ci outright. npm install papered over it; only npm ci surfaced it.

Deviation from D2: docs/design-decisions.md sets iOS 15+, but expo-build-properties on SDK 57 rejects any ios.deploymentTarget below 16.4. The iOS override was removed and Expo's default applies. Android is unaffected. Needs a decision before the iOS release.

Web added to app.json platforms at Jorge's request. Adding the string alone would have produced a broken target, so it came with react-native-web ~0.21.0, the web config block (static output, metro bundler, favicon) and an npm run web script. Verified with npx expo export --platform web: 774 modules, static rendering, 3 routes (/, /_sitemap, /+not-found). Android re-verified afterwards at 1231 modules, and npm run check still passes from a regenerated lockfile with npm ci.

Web is a development convenience for layout iteration, not a shipping surface — employees get the native app and the web console is a separate product. Native-module features (geolocation, SecureStore, biometrics) do not work there, so a passing web render is never evidence a feature works. Documented in the README Run section.

AC #1 remains UNVERIFIED and unchecked. The placeholder screen was confirmed rendering in the browser via npm run web, which proves the component tree, the router entry and the bundle — but not that the app runs on Android, which is what the criterion actually asks for.

Android-side evidence that does exist: npx expo export --platform android bundles 1231 modules clean, and expo prebuild generates a correct native project (applicationId, minSdk 28, portrait, app name). Neither is a substitute for a device or emulator run.

Blocked on the runtime, not the code. Expo Go on the test device is 54.0.8 while the project is SDK 57; the Play Store is not serving a newer build. Expo Go 57.0.2 exists (androidClientUrl in the Expo versions API) and the APK was downloaded and integrity-checked to /home/jj/Downloads/Expo-Go-57.0.2.apk (208277642 bytes, sha256 7eaf937383be1677cfae2fb2711e2066f5c3be2c369a24af3b76699a3589effc), but the on-device install has not completed.

Also settled along the way: ufw default-deny was blocking port 8081, so Expo Go could not reach Metro and reported java.io.IOException: Failed to download remote update. The host has four interfaces (wlan0 192.168.1.97, docker0, a bridge, tailscale0), so REACT_NATIVE_PACKAGER_HOSTNAME may need pinning to the wlan0 address for the QR to advertise a reachable URL. Both are environment issues, not project issues, but the next person to clone this will hit the same wall.

Jorge is investigating the right Android test setup (Expo Go vs development build vs emulator) before this is closed.

Local dev workflow is now a headless Android emulator driven entirely over adb, replacing the Expo Go loop the README originally described.

Toolchain: mise.toml pins temurin JDK 17 (the system JDK is 26, which AGP rejects) and exports ANDROID_HOME plus the SDK tool dirs. Android SDK installed under ~/Android via cmdline-tools 22.0 — no Android Studio. AVD 'kolvi-pixel' is a pixel_6 profile on system-images;android-36;google_apis;x86_64.

Chose google_apis over google_apis_playstore deliberately: the Play images block adb root and permission manipulation, which KMO-16's permission-state criteria depend on.

Dropped Expo Go rather than fixing the install: expo-notifications lost Android push support there in SDK 53 (blocks KMO-36/37) and Expo Go ignores the expo-build-properties minSdkVersion 28 that pins us to Android 9, so it runs a different runtime than we ship. Added expo-dev-client and build with expo run:android instead.

bin/ helpers turn device conditions into commands: bin/emu (start/stop/status), bin/shot (screenshot to .artifacts), bin/ui (visible text, or assert a string is on screen), bin/device (geo, gps, net, slow/fast, perm, finger, link, state). bin/device geo takes lat/lon in that order and swaps internally, because the emulator console expects longitude first.

Two bugs found and fixed while verifying the helpers: 'set -o pipefail' combined with a trailing 'grep -q' made pipelines return SIGPIPE and invert their result, and an unguarded grep under 'set -e' aborted bin/device state when the manifest declares no location permissions.

Validation: npm run check passes (typecheck, eslint, prettier, jest). Emulator boots headless in ~40s; first Gradle build 8m13s. Placeholder screen confirmed rendering on the emulator via screenshot and via bin/ui asserting 'App de empleados'.

Follow-up KMO-47 covers the Maestro flow harness. Physical-device criteria such as KMO-17 #9 stay manual and must not be signed off from an emulator run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scaffolded the Expo SDK 57 / TypeScript app and stood up the local Android workflow it is validated against. Pinned JDK 17 via mise, installed the Android SDK and a headless google_apis AVD without Android Studio, added expo-dev-client and replaced the Expo Go loop with a development build. Added bin/ helpers that make device conditions and on-screen text scriptable, so acceptance criteria are verified by command rather than by eye. Verified by npm run check passing and by the placeholder screen rendering on the emulator, confirmed with a screenshot and with bin/ui asserting 'App de empleados'.
<!-- SECTION:FINAL_SUMMARY:END -->
