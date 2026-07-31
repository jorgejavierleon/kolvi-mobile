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
- The [Expo Go](https://expo.dev/go) app on an Android device, _or_ Android Studio with an
  emulator running Android 9+
- For local native builds only: JDK 17 and the Android SDK

## Install

```bash
npm install
```

## Run

The everyday loop is the Metro dev server plus Expo Go — no Android SDK needed:

```bash
npm start          # starts Metro, prints a QR code
```

Scan the QR with Expo Go on your device, or press `a` in the terminal to launch a connected
emulator. `npm run android` does the same in one step.

`npm run web` opens the app in a browser via `react-native-web`. That target exists for fast
layout iteration and for rendering components in a desktop browser during development — it
is **not** a shipping surface. Employees get the native app; the web console is a separate
product. Anything that depends on a native module (geolocation, SecureStore, biometrics) will
not work there, so never treat a passing web render as evidence the feature works.

To produce the native Android project (needed for a local Gradle build or to inspect the
generated manifest):

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
