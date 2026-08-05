---
id: KMO-16
title: Geolocation permission and the three location states
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-05 20:51'
labels:
  - mobile
  - marcaje
  - geo
milestone: m-0
dependencies:
  - KMO-15
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The location card sits above the shift card and tells the employee, before they tap, whether they can punch. The three states and their exact copy are in docs/design-decisions.md §2.

The client evaluation is advisory only — the server decides authoritatively whether a punch was inside the geofence. The app must never treat its own distance calculation as the answer.

An employee who permanently denies location permission must still be able to punch. Otherwise attendance becomes unrecordable, which is a legal problem rather than a product one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Location permission is requested with a Spanish rationale explaining why attendance needs it, before the system prompt
- [x] #2 Confirmed state renders on the success tint with Ubicación confirmada and the subtitle naming the premise and the distance in metres
- [x] #3 Out-of-range state renders on the warning tint with Fuera del rango permitido and the subtitle Debes estar dentro de {premise} para marcar
- [x] #4 No-signal state renders on the danger tint with Sin señal de GPS and the subtitle Activa tu ubicación para poder marcar
- [x] #5 Each state shows its own icon from the design and pairs colour with text, never colour alone
- [x] #6 A premise with no geofence radius configured does not show an out-of-range state and does not block punching
- [ ] #7 Permission permanently denied still allows punching, with the punch reported as having no location fix rather than being blocked
- [x] #8 Permission permanently denied offers a route to the OS settings
- [x] #9 Location acquisition has a timeout that resolves to the no-signal state rather than hanging the screen
- [x] #10 Location is requested only while the Marcaje tab is in view; the app never tracks location in the background
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. package.json + app.config.ts — add `expo-location` (~57.0.7) through `npx expo install`, configured foreground-only: `isAndroidBackgroundLocationEnabled: false`, `isIosBackgroundLocationEnabled: false`, `isAndroidForegroundServiceEnabled: false`, and `locationWhenInUsePermission` read from `es` the way KMO-10 reads `faceIdUsage` — the iOS string is copy an employee reads. Needs prebuild + a native rebuild. (#1, #10)
2. src/i18n/strings.ts — `es.marcaje.location`: the three titles and subtitles verbatim from the design, the permission-denied title the design has no state for, and the rationale sheet's copy. Plus `locationDistance(premise, metres)` -> `{premise} · a {n} m de la marca`, exported from @/i18n. Reuses `es.actions.openSettings` and `es.permissions.location.*`, which already exist. (#2, #3, #4, #8)
3. src/features/marcaje/today-api.ts — parse an optional `shift.geofence` block: `{lat, lng, radius_meters|null}`, per PRD §6's list of what /me/today carries. Absent or radius-null is legitimate and is #6's 'no geofence configured'. Covered in today-api.test.ts. **The endpoint does not send this yet** — see the note below.
4. src/features/marcaje/geofence.ts (+ test) — haversine metres and `evaluateGeofence(fix, geofence)` -> confirmed | outside. No radius, or a premise with no coordinates, yields confirmed-without-distance and never outside (#6). Pure; advisory only, per §2 — the server's result is the authoritative one.
5. src/features/marcaje/location.ts (+ test) — the only file importing `expo-location`, shaped like `auth/biometrics.ts`: an injectable module slice with `getPermission`, `requestPermission`, `hasServicesEnabled`, and `getFix({timeoutMs})` racing a timer so a hanging acquisition resolves to no-fix instead of hanging the screen (#9). Foreground only — `requestBackgroundPermissionsAsync` is never called and the test asserts it (#10). `openSettings()` via react-native `Linking` (#8).
6. src/features/marcaje/use-location.ts (+ test) — the state machine: checking | confirmed | outside | noSignal | denied, with `retry()`. Acquires only while Inicio is focused and aborts on blur, through `useFocusEffect` from expo-router (#10). Exposes `punchAllowed` and `geoStatus: inside|outside|unknown` so a permanently denied permission still permits a punch that reports no fix — KMO-17 #5 consumes it (#7).
7. src/features/marcaje/location-rationale.tsx (+ test) — the Spanish rationale sheet shown before the OS prompt, a `BottomSheet` in the shape of `auth/biometric-offer.tsx` (#1).
8. src/ui/icons.tsx — three Lucide glyphs transcribed path-for-path from the design's location card: map-pin, triangle-alert, wifi-off (#5).
9. src/features/marcaje/location-card.tsx (+ test) — tone background, the design's 36px round icon well, title over subtitle, and the `Abrir ajustes` button in the denied state (#8). Colour never carries a state alone: every tone change moves the title text too (#5).
10. src/features/marcaje/home-screen.tsx — the card above the shift card, the order the design draws it in.
11. flows/kmo-16-location.yaml — the device tier: `bin/device perm reset` for the rationale preceding the OS prompt (#1), `bin/device gps off` for the no-signal copy (#4), `bin/device perm revoke` for the denied state and its settings route (#8). `bin/device geo` in and out of the seeded premise covers #2/#3 once the wire carries a geofence.

Tiers: Jest carries #5, #6, #7, #9, #10 (a permission state, a distance and a timeout are logic, and the compositional half is an isolated render). Maestro carries #1, #4 and #8, which are Spanish copy under a device condition only an emulator produces. #2 and #3 are blocked device-side until /me/today carries the geofence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**`expo-location` (~57.0.7), foreground-only.** `app.config.ts` sets every background flag false — no `ACCESS_BACKGROUND_LOCATION`, no foreground service, no iOS background mode — and the generated `android/app/src/main/AndroidManifest.xml` was read after `npm run prebuild` to confirm it: the manifest carries only ACCESS_FINE/COARSE_LOCATION. That is #10's other half; the first half is an ESLint rule in `eslint.config.js` banning the five expo-location entry points that could track continuously, so adding one is a build failure rather than a review catch.

**A fourth card state the design does not draw.** The design's three assume a phone that answered. An employee who refused the permission is in none of them, and `Sin señal de GPS` would send them waiting for a signal that is not the problem — so `denied` has its own title (`Sin permiso de ubicación`), the danger tint it shares with no-signal, and, uniquely, **does not block the punch** (#7). Approved by the user before implementation.

**The card leans toward `confirmed` whenever it cannot show otherwise.** A fix's own accuracy is spent in the employee's favour — a ±60 m fix measured at 130 m from a 100 m radius reads as confirmed, not out of range. The client is advisory and the server decides (§2), so the cost of a wrong `confirmed` is a mark the server flags, while the cost of a wrong `outside` is someone at their own gate being told they are not there.

**The verdict is derived, not stored.** The geofence arrives from `/me/today` seconds after the fix does. `use-location.ts` holds a *phase* and re-evaluates the geofence in render, so a response landing late re-reads a fix the app already has instead of asking the phone again.

**The card is not drawn for a user without `ClockOwn:Mark`, and their phone is never asked.** Same reasoning as KMO-15 #8: reading someone's location for a card they are not shown is the collection this feature is otherwise careful not to do.

**A geofence block that is present but unreadable fails the load** rather than degrading to `null`. `null` means 'this premise has no geofence' and renders as `Ubicación confirmada`; confirming a location the app could not evaluate is the plausible-looking screen `today-api.ts` exists to refuse.

**`bin/device perm deny-forever` added.** `revoke` leaves the permission merely denied, which the app answers with the prompt; #8 needs the USER_FIXED flag a second refusal sets. Observed on device: `expo-location` reports `canAskAgain: true` from the *read* path even with USER_FIXED set, and only reports `false` once a request is actually attempted — so the card offers `Activar ubicación` first and switches to `Abrir ajustes` after one tap that raises no dialog. Self-correcting, and the employee reaches the settings route either way.

## Which criteria are checked, and why the rest are not

Checked:

- **#1** — on device, end to end: signed in on a phone with the permission never asked, the Spanish sheet came up *before* anything the OS drew (`.artifacts/kmo-16-rationale.png`), and `Continuar` then raised Android's own `Allow Kolvi to access this device's location?`. Jest covers the same order in `use-location.test.ts` and the copy in `location-rationale.test.tsx`.
- **#4** — on device: `bin/device gps off`, then back into the tab — `Sin señal de GPS` over `Activa tu ubicación para poder marcar`, on the danger tint (`.artifacts/kmo-16-no-signal.png`).
- **#5** — `location-card.test.tsx` proves every state has a title of its own and an icon of its own, so no tint ever carries a state alone; three of the four were read on the device.
- **#6** — on device and in Jest. No geofence on the wire means every premise is this case today: the card confirmed with `Sucursal Centro` and no distance clause, showed no out-of-range state, and blocked nothing (`.artifacts/kmo-16-confirmed.png`). `geofence.test.ts` covers both halves — no radius and no coordinates.
- **#8** — on device: `bin/device perm deny-forever`, and the card reached `Sin permiso de ubicación` over `Activa el permiso de ubicación en los ajustes del teléfono para poder marcar` with an `Abrir ajustes` button (`.artifacts/kmo-16-settings-route.png`).
- **#9** — `location.test.ts` with fake timers: a `getCurrentPositionAsync` that never settles resolves to no fix at 12s and is still pending at 12s − 1ms. Jest is the honest tier for a timeout; the device half — that the screen reaches a state rather than sitting on `Buscando tu ubicación` — was observed on the gps-off run.
- **#10** — three independent proofs. `use-location.test.ts`: the read happens inside `useFocusEffect`, does not repeat while the screen sits there, and a fix arriving after the screen is gone changes nothing. The generated AndroidManifest.xml carries no `ACCESS_BACKGROUND_LOCATION`. The ESLint rule fails the build on the five APIs that could track continuously. On the device the card only changed state when the tab was re-entered.

Left unchecked:

- **#2** — the state, the success tint and the premise are all verified on device, but the criterion also asks for **the distance in metres**, and there is no geofence on the wire to measure against (`ams` KOL-33). `locationConfirmed()` and `evaluateGeofence` are covered in Jest against a fixture; the on-screen distance is owed.
- **#3** — out of range cannot be reached at all without a premise radius. Same blocker, same Jest coverage (`geofence.test.ts`, `location-card.test.tsx`).
- **#7** — the app-side contract is built and proven: `punchAllowed` stays true and `geoStatus` is `unknown` for a permanently denied permission, and on the device the tab was whole with the refusal on the card. But the criterion is about a **punch**, and there is no punch button until KMO-17 — the wire half is KMO-17 #5. Checking it here would be signing off on a button that does not exist.

Blocked, and not this ticket's to fix: **the Maestro flows cannot get past the login screen on this AVD.** `shared/enter-credentials.yaml`'s `hideKeyboard` closes the app instead of dismissing the keyboard — the AVD is created with `hw.keyboard=yes` (bin/emu, so `adb shell input text` works) and a BACK press with a hardware keyboard present goes to the activity rather than to the IME. Reproduced by hand with `input keyevent 4`, and `flows/kmo-15-home-screen.yaml` — merged, untouched by this branch — fails identically at the same step. The four KMO-16 flows are written and committed; every criterion above was driven by hand with `bin/device` and `bin/ui` instead, and re-running them needs that shared subflow or the AVD fixed first.

Validation: `npm run check` green — typecheck, ESLint (including the new background-location rule), Prettier, 827 Jest tests across 54 suites, up from 747/49. Device verification was driven by hand with `bin/device` and `bin/ui` against a real `ams`; screenshots in `.artifacts/`: kmo-16-rationale.png, kmo-16-confirmed.png, kmo-16-no-signal.png, kmo-16-settings-route.png, kmo-16-after.png.

## The flows run now

The blocker in the previous note is fixed, and it turned up a regression of my own on the way.

**`shared/enter-credentials.yaml` no longer calls `hideKeyboard`.** It sends a back press, and the AVD is created with `hw.keyboard=yes` (bin/emu, so `adb shell input text` works); with a hardware keyboard present Android routes back to the activity rather than to the IME, so the app closed and every flow that signs in failed at the next step against the launcher. Reproduced outside Maestro with a bare `adb shell input keyevent 4`, and with the AVD's `show_ime_with_hard_keyboard` at both 0 and 1. Replaced with a tap on the empty page above the form — the same idiom `launch.yaml` already uses to get out from under the dev menu.

**The rationale sheet broke four sibling flows, and that was mine.** It is a `Modal`, so with it up nothing on the tab behind it is in the hierarchy — exactly the trap `sign-in.yaml` documents for the biometric offer. Any flow that reached Inicio and asserted something there failed on a sheet it never mentioned. Two fixes:

- `shared/sign-in.yaml` dismisses it, by `location-rationale-dismiss` rather than by text — the biometric offer above it uses the same `Ahora no` wording, and a text match would make which sheet got tapped depend on which was up. `kmo-8-login.yaml` and `kmo-9-secure-token-restore.yaml` sign in inline rather than through that subflow, so they carry the same block.
- **The sheet is now offered once per app session and never again on its own.** `run()` fires on every focus, so it was re-raising the modal every time the employee came back to Marcaje — a nag in front of the punch button several times a shift, and a nag is how the OS prompt behind it gets refused for good. A ref guards the automatic offer; the card's `Activar ubicación` still raises it on demand. Two tests cover both halves.

**Four flows, all passing on their own runs:**

- `flows/kmo-16-location.yaml` — #2's placement, #5, #6. In the suite.
- `flows/kmo-16-permission.yaml` — #1 and #7. In the suite.
- `flows/kmo-16-settings-route.yaml` — #8, by refusing twice inside the flow. In the suite.
- `flows/kmo-16-no-signal.yaml` — #4 and #9's observable half. Tagged `requires-gps-off`, run on its own.

None of them needs a permission arranged beforehand: `clearState` resets the app's runtime permissions, so each drives the rationale and the OS prompt itself. Two details the device taught them — Android renames the deny button on the refusal that makes the decision permanent (`permission_deny_button` → `permission_deny_and_dont_ask_again_button`), so both are matched by regex; and Maestro anchors its text regexes, so a substring of a longer paragraph needs wrapping.

**Suite: 12/15, up from 9/15 before any of this.** The three that fail there:

- **KMO-9** and **KMO-16 location confirmed** fail only inside a full 15-flow run, both after two minutes waiting for the app to appear at all — the dev client gets slower with each `clearState` cold start. Each passes on its own; re-run individually they are green.
- **KMO-14 forgot password** was already red before this branch, and stays red. Its `hideKeyboard` pops the route back to the login screen rather than closing the keyboard, and removing it gets the flow to the submit button but the submission then does not reach `ams`. That is KMO-14's own defect on this AVD; my experimental edit to it was reverted rather than half-shipped.

## After KOL-33 shipped

`GET /api/v1/me/today` now carries the block this ticket's parser was written against, and it needed no change on this side:

    "geofence": {"lat": -33.4489, "lng": -70.6693, "radius_meters": 150}

One thing to know for a fresh checkout: the local `ams` database predated the seeder change, so `Sucursal Centro` still held a factory-made premise with no radius. Patched that one demo row to the seeder's own values rather than re-seeding, which would have wiped the rest of the local data.

**#2 and #3 are now checked, both on device.**

- **#2** — `flows/kmo-16-location.yaml`, run with the phone at the premise (`bin/device geo -33.4489 -70.6693`). The card reads `Ubicación confirmada` over `Sucursal Centro · a 0 m de la marca` on the success tint. The flow asserts the shape rather than the numbers — `.+ · a \d+ m de la marca` — because the premise is the seeder's and the distance is the emulator's, and separately asserts the distance carries no decimals, which would claim a precision no fix supports. Screenshot `.artifacts/kmo-16-confirmed.png`.
- **#3** — `flows/kmo-16-out-of-range.yaml`, run about two kilometres west (`bin/device geo -33.4372 -70.6506`). `Fuera del rango permitido` over `Debes estar dentro de Sucursal Centro para marcar`, on the warning tint, with the triangle-alert icon. Screenshot `.artifacts/kmo-16-out-of-range.png`.

Both are tagged out of the suite and mutually exclusive by definition: one asserts the device is at the premise and the other that it is not, and where the device stands is the emulator's state rather than something a flow can set. `flows/config.yaml` carries the two commands.

**#6 is no longer reachable on a device**, now that the seeded premise has a radius. It stays checked on the evidence gathered before KOL-33 shipped — the card confirmed with the premise named and no distance clause, showed no out-of-range state and blocked nothing — plus `geofence.test.ts`, which covers both halves of it (no radius, and no coordinates at all).

**#7 is the only criterion still open, and it is not blocked on `ams`.** It is about a punch, and KMO-17 has not built one. The state machine already reports `punchAllowed: true` and `geoStatus: 'unknown'` for a permanently denied permission, proven in `use-location.test.ts`, and `flows/kmo-16-settings-route.yaml` shows the tab whole with the refusal on the card.

Also worth opening when KMO-17 starts: the **server-side** geofence evaluation on `POST /api/v1/marks` (PRD §6 item 2 — haversine at punch time, persisting `inside|outside|unknown` with the reported accuracy). KOL-33 deliberately excluded it, so nothing tracks it yet.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the geolocation card above the shift card on Inicio, with its permission flow: a Spanish rationale before the OS prompt, the design's three states plus a fourth for a refused permission, an advisory haversine evaluation that never blocks a punch, a 12s acquisition timeout, and acquisition scoped to the Marcaje tab being in view. New foreground-only `expo-location`; `today-api.ts` now parses the geofence block `ams` KOL-33 will send. Verified with 827 Jest tests, the generated AndroidManifest carrying no background-location permission, an ESLint rule that fails the build on the five tracking APIs, and hand-driven device runs for #1, #4, #6 and #8. #2's distance clause and #3 wait on KOL-33; #7's punch waits on KMO-17.
<!-- SECTION:FINAL_SUMMARY:END -->
