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
| `bin/device perm grant\|revoke\|reset` | location permission (`deny-forever` too)     |
| `bin/device font max\|reset\|<scale>`  | OS font scale, for the type-scaling criteria |
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

`android/` and `ios/` are generated output. Native configuration belongs in `app.config.ts`,
never in the generated files: `expo prebuild --clean` throws away hand edits.

The config is TypeScript rather than `app.json` so the splash background and the adaptive
icon read `colors.primary` out of `src/theme` — the native chrome an employee sees before any
JavaScript runs is then the same brand teal as the app, and cannot drift from it.

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

`bin/release-check` exports that same production bundle and greps it for demo scaffolding —
the mockup's flask button, demo panel and hardcoded verification code — and for debug logging
that should have been stripped. Run it before any release build; it exits non-zero and names
the match on failure.

All of these pass on a clean checkout. Keep it that way.

### Before a push

There is no hosted CI. `.githooks/pre-push` runs `npm run check` and aborts the push if it
fails, so the gate that keeps `master` building is local and runs the same command you would
run by hand. `npm install` installs it — the `prepare` script points `core.hooksPath` at
`.githooks/`, so a fresh checkout is gated after one command and nothing new is in
`package.json`'s dependency tree.

```bash
git config core.hooksPath      # .githooks — confirms it is installed
git push --no-verify           # skip it deliberately, for a WIP branch
```

Per push rather than per commit: a full typecheck and 310 tests are too slow to pay for on
every `git commit`, and a broken intermediate commit on a branch harms nobody.

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

- **No raw hex colours or font sizes in feature code.** Everything comes from `src/theme`,
  and ESLint fails the build on a hex, an `rgba()` or a bare `fontSize` anywhere outside it.
- **Status colour comes from a tone, never from the palette.** `tones.success` / `warning` /
  `danger` / `neutral` are background/foreground pairs that map 1:1 onto the server's
  `badge()` tones, so a state cannot look like one thing on web and another on the phone.
- **No user-facing string literals in components.** Everything comes from `src/i18n`, or from
  the server — domain vocabulary (leave types, workday statuses) arrives as `{value, label}`
  pairs and is shown verbatim, never re-translated.
- **Datetimes on the wire are naive Santiago wall-clock strings** (`YYYY-MM-DD HH:mm:ss`).
  Never apply a timezone conversion or stamp a device offset on them; doing so silently
  shifts legally-binding timestamps.
- **Tokens go in Expo SecureStore**, never `AsyncStorage`. ESLint blocks the imports that
  would put a credential anywhere else — AsyncStorage and `expo-file-system` — so this is a
  build failure rather than a convention.
- Minimum hit target is 44px, and status is never encoded by colour alone.

## Project status

Scaffold, the design tokens, the shared UI primitives — `Button`, `Card`, `StatusBadge`,
`SegmentedControl`, `BottomSheet`, `TileRow`, `ListRow`, `TextField`, `Skeleton` — the typed `/api/v1`
client, the es-CL catalogue with its formatters, and the navigation shell: the four-tab bar
(Inicio, Jornada, Permisos, Documentos) with the profile surface over it, in
`src/app/(tabs)/`.

A cold start now lands on `/login`. `src/features/auth/` exchanges the employee's credentials
for a Sanctum token, reads the user behind it and holds the session; `Stack.Protected` in
`src/app/_layout.tsx` decides which half of the app exists. The token lives in the platform
keystore (`src/features/auth/token-store.ts`), so a restart lands a signed-in employee back on
the tabs rather than at the login screen. A token the server stops accepting ends that session at
the next request and returns the employee to the login screen with a Spanish explanation, rather
than dropping them there unannounced.

Inicio is the first tab with a real body (`src/features/marcaje/`): the long date and
`Hola, {nombre}` over the shift card, the live clock and its status line, and the week
summary — all of it drawn from one `GET /api/v1/me/today`, with skeletons on the way and a
Spanish retry when it does not arrive. Above the shift card sits the geolocation card
(KMO-16): the employee's own position, read from the phone while the Marcaje tab is in view
and never otherwise, as one of `Ubicación confirmada`, `Fuera del rango permitido`, `Sin
señal de GPS` or the permission the design has no state for. The permission is asked for
behind a Spanish rationale, and refusing it never blocks a punch — an unrecordable
attendance is a legal problem, so the mark simply travels with no fix on it. The client's
distance is advisory throughout; the server decides, and a premise with no radius configured
is never out of range.

Under the clock is the button the app exists for (KMO-17): `Marcar entrada`, then `Marcar
salida`, then a success panel where the button was, walking the three states
`before → working → done`. The punch carries **no timestamp** — the server assigns the legal
time, and the receipt it answers with is the only time the app will ever show for a mark —
and it carries the fix, its accuracy and the client's advisory geofence verdict explicitly,
with `null` where there is nothing to report. Two taps make one punch, a refusal leaves the
day exactly as it was with the button as its own retry, and a punch the register already
holds is a calm Spanish line rather than an error. The endpoint that serves all of this is
`ams` KOL-34, which has shipped: `POST /api/v1/marks` assigns the legal time, evaluates the
geofence itself and enforces one `in` and one `out` per day.

Beneath the button are the two ways past it (KMO-18). Out of range the primary is held and
`Marcar de todas formas (queda pendiente de revisión)` sits under it — out of range is
recorded and flagged, **never blocked**, so the consequence is inside the label rather than
in a dialog after it, and the server's own geofence verdict is what lands on the row. With
no fix the primary is held and `Reintentar ubicación` asks the phone again, spinning in
place rather than vanishing under the thumb that pressed it. Neither appears once the
location is confirmed, and neither appears for a permission refused for good — no fix is
ever coming for that employee, so the mark travels with `geo_status: unknown` instead of
sitting behind a retry that cannot help. What holds the button is a `PunchHold`, and it
carries the escape hatch with it: there is no way to express a disabled punch button with
nothing beneath it.

A punch that lands opens the comprobante (KMO-19), which is the employee's evidence that
their attendance was recorded: `Tipo`, `Fecha`, `Hora`, `Trabajador`, `RUT` and
`N° comprobante` — the minimum content Res. 38 Art. 13 names, with the folio `ams` allocates
per organization per day — over the SHA-256 in monospace, with a `Copiar` button that
confirms in its own label. Every value on it comes off the 201 and **none** of it from this
phone: the sheet takes a receipt and has no other source, so it cannot show a time, a name or
a folio the register does not hold. The hash is copyable for keeping or quoting, and nothing
around the button implies the employee can verify it themselves — `ams`' checksum tool is in
the DT inspector portal, behind authentication, and no public route exists. A mark the server
flagged outside the geofence carries `Marca fuera de rango — pendiente de revisión`, and the
legal note naming the libro de asistencia is on every receipt without exception.

Under the week summary is the way back to any of that (KMO-20): `Ver mis últimas marcas`
opens the ten most recent punches from `GET /api/v1/marks`, newest first, each one a tap
away from the comprobante it was issued with. Res. 38 Art. 22.1 makes a receipt retrievable
rather than a one-time view, so a stored mark is parsed by the punch response's own parser
and handed to the same sheet — which is what makes a receipt pulled from the register carry
the folio and the hash it carried the moment it was made, rather than a second rendering of
them. It is a sheet and not a route: a pushed route lands on the root stack and covers the
tab bar, and the list has to stay inside Marcaje. The two sheets swap rather than stack, so
`Listo` on a retrieved receipt returns to the list it came from. The list costs the punch
screen nothing until it is opened — Inicio keeps its one request, and goal G1 is why. The
five-year workday history is Phase 2's, under Jornada.

Above the location card, in the slot the design puts it in, is the pending-sync banner
(KMO-22): `{n} marcas esperando sincronizar` over `Aún no forman parte del libro de
asistencia`, with `Sincronizar` beside it. It is on screen only when the phone is holding
punches — being offline with an empty queue is not news an employee needs, and §4.5 is why
the copy says _not part of the book_ rather than _saved_: the register is the central
database, and a queued punch has no folio and no Art. 8 checksum. `Sincronizar` is an
accelerator and never the mechanism (Art. 10 requires the deferred send to be automatic), so
it is never disabled, and a flush that fails leaves every punch where it was and says why in
the server's own Spanish. Connectivity itself comes from `expo-network` through
`src/features/marcaje/connectivity.ts`, and it is **optimism, not authority** — there is no
setter on it and no offline mode anywhere, because Art. 10 confines the exception to
_situaciones excepcionales_ and what puts a punch in the queue is a request that actually
failed. The queue behind the banner is `punch-queue.ts`; it holds rows in memory and nothing
fills it yet, which is KMO-23's along with durability and the wire contract.

Jornada, Permisos and Documentos are still empty — run `backlog task list --plain` to see the
backlog.

One thing the session still cannot do, and it is the backend's: a deactivated employee keeps a
working token, because `ams` checks `is_active` only when issuing one (PRD A7/A8) — the app ends
the session on the 401 that check would produce, and there is nothing on this side left to build
for it. `GET /api/v1/user` does now report permissions (`ams` KOL-5), so `can()` answers from the
real set rather than closing every gate.

One file is temporary: `src/ui/section-scaffold.tsx`, the stand-in body Permisos and Documentos
render until KMO-39 and 42 build them.
