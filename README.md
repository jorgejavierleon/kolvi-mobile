# Kolvi — app de empleados

The employee mobile app for Kolvi. Its primary job is registering attendance punches
(_marcaje_) from the employee's own phone, with the geolocation and receipt (_comprobante_)
evidence that Chile's Resolución 38 expects. Around that it exposes the three other
self-service surfaces employees already have on the web: their computed workdays
(_jornada_), their leave requests (_permisos_) and their electronically-signed documents
(_documentos_).

React Native on Expo, TypeScript. **Android is the primary target** (Android 9 / API 28 and
up); iOS ships from the same codebase one release later. The interface is Spanish (Chile)
throughout — that is a compliance requirement, not a preference.

- `docs/prd-mobile-app.md` — the product requirements
- `docs/design-decisions.md` — the accepted decision record; **authoritative where it and the
  PRD disagree**
- `CLAUDE.md` — the Backlog.md workflow this repo uses for task tracking

## Requirements

- Node.js 20 or newer (developed on 24)
- [mise](https://mise.jdx.dev), which pins the toolchain from `mise.toml`
- The Android SDK under `~/Android` (see [Toolchain](#toolchain))

**Expo Go is not supported.** The app needs a development build: push notifications were
removed from Expo Go on Android in SDK 53, and the `expo-build-properties` `minSdkVersion 28`
that pins us to Android 9 is ignored there. Testing on Expo Go means testing a different
runtime than the one employees get.

## Install

```bash
npm install
mise trust && mise install    # JDK 17 + ANDROID_HOME
```

`mise.toml` pins **JDK 17** because the Android Gradle Plugin rejects newer JDKs and
**Maestro** for the E2E flows, and exports `ANDROID_HOME` plus the SDK tool directories onto
`PATH` when you `cd` into the repo.

### Toolchain

The SDK installs without Android Studio:

```bash
sdkmanager --install "platform-tools" "emulator" "platforms;android-36" \
  "build-tools;36.0.0" "system-images;android-36;google_apis;x86_64"
```

Use the **`google_apis`** image, not `google_apis_playstore` — the Play Store images block
`adb root` and permission manipulation, which the location acceptance criteria depend on.

## Run

```bash
bin/emu start      # boot the headless emulator (creates the AVD on first run)
npm run android    # build, install and start Metro
```

The first build takes several minutes. After that, JS changes hot-reload over Metro — only
rebuild when a native dependency changes.

The emulator runs headless by default because this repo is usually driven over SSH.
`bin/emu start --window` opens a window if you are sitting at the machine.

| Command          | What it does                 |
| ---------------- | ---------------------------- |
| `bin/emu start`  | boot the AVD and wait for it |
| `bin/emu stop`   | shut it down                 |
| `bin/emu status` | is a device up and booted    |

### Driving the emulator

Most acceptance criteria in this backlog describe a _device condition_ — permission denied,
GPS lost, network gone — or exact Spanish copy on screen. `bin/` makes both scriptable, so a
criterion can be verified by command rather than by eye:

| Command                                | What it does                                 |
| -------------------------------------- | -------------------------------------------- |
| `bin/shot [name.png]`                  | screenshot to `.artifacts/`, prints the path |
| `bin/ui`                               | every visible string, one per line           |
| `bin/ui "En jornada"`                  | exits 0 if that text is on screen, 1 if not  |
| `bin/ui --xml`                         | the raw hierarchy, with bounds and ids       |
| `bin/device geo <lat> <lon>`           | move the device                              |
| `bin/device gps on\|off`               | location services master switch              |
| `bin/device net on\|off`               | connectivity, for the offline queue          |
| `bin/device slow\|fast`                | degrade the network to GSM/GPRS              |
| `bin/device perm grant\|revoke\|reset` | location permission                          |
| `bin/device finger`                    | present an enrolled fingerprint              |
| `bin/device link <url>`                | open a `kolvi://` deep link                  |
| `bin/device state`                     | report all of the above at once              |

`bin/device geo` takes **latitude first**, matching the rest of the codebase; it swaps the
arguments internally because the emulator console expects longitude first.

### Flows

`bin/` verifies a criterion at the moment you run it. A [Maestro](https://maestro.dev) flow
makes the whole sequence a file that lives beside the task it verifies and re-runs on demand:

```bash
npm run test:e2e     # every flow in flows/, non-zero if any fails
bin/e2e kmo-1        # just that task's flow
```

Flows are YAML, they drive the app by the text a user sees, and they run against the same
headless emulator. Artifacts — the JUnit report, deliberate screenshots, and the screen plus
view hierarchy at the point of any failure — land in `.artifacts/e2e/`.

`flows/README.md` covers the naming convention and how to write one. Maestro is pinned in
`mise.toml`, so it arrives with `mise install`.

### Watching the emulator from another machine

The emulator lives on whichever machine runs the build. To see it from a laptop over SSH,
forward adb and mirror it with [scrcpy](https://github.com/Genymobile/scrcpy) — scrcpy is
installed on the **viewing** machine, not the build host:

```bash
ssh -L 5555:localhost:5555 <build-host>    # in one terminal, left open
adb connect localhost:5555 && scrcpy       # in another, on the viewing machine
```

That gives a live, clickable mirror. For a still, `bin/shot` writes a PNG you can `scp`.

### Web

`npm run web` renders via `react-native-web`. It exists for fast layout iteration only — it
is **not** a shipping surface. Anything touching a native module (geolocation, SecureStore,
biometrics) does not work there, so never treat a passing web render as evidence a feature
works.

### Native project

```bash
npm run prebuild   # writes ./android — gitignored, regenerate rather than edit
```

`android/` and `ios/` are generated output. Native configuration belongs in `app.json`, never
in the generated files: `expo prebuild --clean` throws away hand edits.

## Checks

```bash
npm run check         # everything below, in order — what CI runs
```

| Command                | What it does                                      |
| ---------------------- | ------------------------------------------------- |
| `npm run typecheck`    | `tsc --noEmit`, strict mode                       |
| `npm run lint`         | ESLint (`eslint-config-expo` + Prettier disables) |
| `npm run lint:fix`     | ESLint with autofix                               |
| `npm run format`       | Prettier, writes                                  |
| `npm run format:check` | Prettier, verifies only                           |
| `npm test`             | Jest via `jest-expo`                              |
| `npm run test:watch`   | Jest in watch mode                                |

`npx expo export --platform android` bundles the app headlessly — a useful smoke test that
everything resolves without needing a device.

All of these pass on a clean checkout. Keep it that way.

## Validation tiers

A criterion is signed off at the cheapest tier that can honestly carry it, and never at a
cheaper one than that. Three tiers, in that order:

| Tier                | Command                             | What it can prove                                                                                                      |
| ------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Jest**            | `npm test`, part of `npm run check` | Logic: formatters, the naive-datetime handling, reducers, queue ordering, what a component renders in isolation        |
| **Maestro**         | `npm run test:e2e`                  | The app on a device: navigation, exact Spanish copy on screen, permission and offline behaviour driven by `bin/device` |
| **Physical device** | by hand, written up on the task     | What neither can reproduce                                                                                             |

Jest runs on every commit and needs nothing. Maestro needs a booted emulator, so it is run
deliberately rather than on every commit — but a device-level criterion is not done until
there is a flow for it.

The third tier is not a formality. An emulator can be made to pass a criterion it has no
business passing: KMO-17 #9 — the punch button legible in direct sunlight and operable with
gloves — would go green on any emulator run and mean nothing. Physical conditions (sunlight,
gloves, real GPS drift, a genuinely weak mobile network, mid-range hardware) are verified on a
physical mid-range Android, and a task carrying such a criterion says so and is not closed on
a Maestro run.

## Where code goes

```
src/
  app/          Expo Router routes. Files here ARE the navigation tree.
  theme/        Design tokens — colours, type, spacing, radius, shadows.
  ui/           Shared presentational primitives: Button, Card, StatusBadge, …
  features/     Domain code, one directory per feature.
    marcaje/    Punching, geolocation, the comprobante.
    jornada/    Workdays, upcoming shifts, mark corrections.
    permisos/   Leave requests and balances.
    documentos/ Document list, reader, signing.
  api/          The typed /api/v1 client. Nothing else calls fetch.
  i18n/         The es-CL string catalogue and the date/RUT/hours formatters.
assets/         Fonts, icons, splash images.
```

Three rules keep this from decaying:

1. **`src/app/` composes, `src/features/` decides, `src/ui/` renders.** A route file wires a
   screen together and does nothing else. Business rules live in the feature. Anything that
   holds no domain knowledge belongs in `ui/`.
2. **A feature never imports from another feature.** When two need the same thing, it moves
   to `ui/`, `api/` or `i18n/`.
3. **Everything under `src/app/` becomes a route.** Expo Router builds the navigation tree
   from the filesystem and does not skip test files, so `*.test.tsx` must live beside the
   implementation in `features/` or `ui/` — never in `app/`.

Import with the `@/` alias (`@/ui/button`, `@/api/client`) rather than relative paths that
climb out of a directory. `@/assets/*` resolves to `assets/`.

Tests sit next to what they test: `button.tsx` and `button.test.tsx` in the same folder.

## Conventions

- **No raw hex colours or font sizes in feature code.** Everything comes from `src/theme`.
- **No user-facing string literals in components.** Everything comes from `src/i18n`, or from
  the server — domain vocabulary (leave types, workday statuses) arrives as `{value, label}`
  pairs and is shown verbatim, never re-translated.
- **Datetimes on the wire are naive Santiago wall-clock strings** (`YYYY-MM-DD HH:mm:ss`).
  Never apply a timezone conversion or stamp a device offset on them; doing so silently
  shifts legally-binding timestamps.
- **Tokens go in Expo SecureStore**, never `AsyncStorage`.
- Minimum hit target is 44px, and status is never encoded by colour alone.

## Project status

Scaffold only. The theme, UI primitives, tab navigation, API client and string catalogue are
tracked as tasks KMO-2 through KMO-6 — run `backlog task list --plain` to see the backlog.
`src/ui/placeholder-screen.tsx` is temporary and gets deleted when the navigation shell
lands.
