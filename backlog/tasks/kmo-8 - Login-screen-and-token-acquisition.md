---
id: KMO-8
title: Login screen and token acquisition
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-02 14:04'
labels:
  - mobile
  - auth
milestone: m-0
dependencies:
  - KMO-5
  - KMO-6
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The employee signs in with the credentials they already use on the web app. POST /api/sanctum/token takes email, password and device_name and returns a token; it rejects wrong credentials and inactive users.

The design has no login screen, so this is composed from the design system primitives following the visual language of the designed surfaces.

The app must gate features on the permissions the API reports for the user, never on the role name and never on hardcoded assumptions. An admin who also punches gets a working Marcaje tab and empty-or-hidden states elsewhere rather than errors.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A login screen collects email and password, styled with the design tokens and primitives
- [x] #2 A stable device_name identifying this installation is generated once and reused across logins
- [x] #3 Successful login stores the token and lands the user on the Marcaje tab
- [x] #4 Wrong credentials and the inactive-user rejection each show a distinct Spanish message from the server, not a generic failure
- [x] #5 Network failure during login is distinguishable from a credential rejection and offers a retry
- [x] #6 The submit control shows a loading state and cannot be double-submitted
- [x] #7 The password field masks input and offers a reveal toggle
- [x] #8 The permissions reported for the user are stored and exposed to the app, and features gate on them rather than on the role name
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. package.json — add `expo-secure-store` and `expo-crypto` (npx expo install). SecureStore persists the device id chosen for AC#2; Crypto provides randomUUID(), since SecureStore stores but does not generate. KMO-9 needs SecureStore anyway, so this front-loads a dependency rather than adding a throwaway one. Both are native modules: one `npm run android` rebuild covers them.

2. src/features/auth/device-name.ts (+test) — resolveDeviceName(), memoised per process. Reads `kolvi.device-id` from SecureStore; on first launch generates a UUID, writes it back, and returns `Kolvi <os> <id>`. The value survives reinstall-free restarts, so the server keeps replacing one token per device rather than accumulating one per launch. If SecureStore throws (rooted device, keystore reset), fall back to a per-process id so login still works and only the token name churns. The SecureStore access sits behind a tiny DeviceIdStore seam so KMO-9 can share one storage module without rewriting this.

3. src/features/auth/permissions.ts (+test) — the nine RoleSeeder::EMPLOYEE_PERMISSIONS names as a Permission union, parsePermissions() tolerating ["X"] and [{name:"X"}], PermissionSet.has(). Absent field = no permissions: gates fail closed. This is the client half of AC#8; the server half is ams KOL-5.

4. src/features/auth/session-user.ts (+test) — parseSessionUser() over GET /api/user, keeping only {id, name, firstName, email, rut, permissions}. That endpoint returns the whole User model today (verified against the running ams), so the parse is a whitelist, not a cast. It already tolerates the shape KOL-5 will introduce.

5. src/features/auth/auth-api.ts (+test) — issueToken() -> POST /api/sanctum/token, fetchSessionUser() -> GET /api/user. Both live outside /api/v1, so this module builds its own client with createApiClient({ baseUrl: resolveApiOrigin() }) instead of the app singleton. Failure maps to {kind:"rejected"|"connectivity", message}: "rejected" renders the server sentence verbatim (messageFor("email") ?? userMessage), which is what keeps the credential and inactive rejections distinct (AC#4) without the app parsing Spanish; "connectivity" uses the catalogue copy and offers Reintentar (AC#5).

6. src/features/auth/session.tsx (+test) — SessionProvider / useSession(): status, user, signIn(), signOut(), can(permission). The token sits behind a TokenStore interface, in-memory here; KMO-9 swaps in SecureStore persistence. configureApi({ getToken }) is wired here so every later request carries it.

7. src/ui/text-field.tsx (+test), plus EyeIcon/EyeOffIcon in src/ui/icons.tsx — the shared labelled input: 44px min target, theme tokens only, secureTextEntry with a reveal toggle (AC#7), error line and accessibilityState.invalid. It belongs in ui/ because KMO-13, KMO-41 and KMO-44 need the same control.

8. src/i18n/strings.ts (+strings.test.ts) — an `auth` section: heading, field labels, submit, the reveal-toggle spoken labels, the required-field messages, the connectivity headline.

9. src/features/auth/login-screen.tsx (+test) — the composed screen: heading, the two fields, the submit Button with loading (AC#6 — the handler guards re-entry and the button reports busy), and the error region carrying either the server sentence or the connectivity message with Reintentar.

10. src/app/login.tsx — the route. Renders the feature screen and nothing else.

11. src/app/_layout.tsx — wrap the tree in SessionProvider and gate the routes with Stack.Protected: (tabs) and perfil behind a signed-in guard, login behind its inverse, so a cold start lands on login and a successful sign-in lands on the Marcaje tab (AC#3).

12. flows/kmo-8-login.yaml — the device tier. Real login against the local ams for #1, #3, #7 and the wrong-credential half of #4; bin/device net off for #5; the in-flight button for #6.

13. README.md — refresh the stale "Project status" paragraph, which still describes launch as landing on the tab shell.

Tiers: #1 Jest + Maestro. #2 Jest only — no device tier can show a second login until KMO-12 adds sign-out. #3 Maestro. #4 wrong credentials Jest + Maestro; the inactive half Jest only, because no inactive user exists in the local ams database and this task does not write to it. #5 Maestro with the radio off. #6 Jest + Maestro. #7 Jest + Maestro. #8 stays unchecked: GET /api/user reports no permissions yet. ams KOL-5 adds the UserResource; once it ships, KMO-8 verifies against the real payload and closes #8.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented steps 1-13 of the plan. Deviations from the plan as recorded, and why:

- Step 1 became `expo-secure-store` **and** `expo-crypto`. SecureStore stores the device id but cannot generate one, and `Crypto.randomUUID()` is the documented Expo way to get a v4 UUID; hand-rolling one from `Math.random` for a value that names a security token was the worse trade. Both are Expo-maintained native modules and a single `npm run android` rebuild covers them. `expo-secure-store` is also registered as a config plugin in `app.config.ts`.
- Step 12 became two flows. `flows/kmo-8-login.yaml` needs the radio on and `flows/kmo-8-login-offline.yaml` needs it off for the whole run, and per flows/README.md the device condition is set outside the flow, so they cannot be one file. `bin/e2e kmo-8` still runs both.
- `src/features/auth/session.tsx` also restores a session from a stored token on mount. It is ~15 lines and it is what makes the TokenStore seam real; with the in-memory store there is never anything to restore, so it is Jest-verified against a fake store and KMO-9 inherits a working restore path rather than having to add one.

Everything else landed as planned: device-name, permissions, session-user, auth-api, session, TextField (plus EyeIcon/EyeOffIcon), the `auth` catalogue section, the login screen, the `/login` route, and `Stack.Protected` gating in `src/app/_layout.tsx`.

`npm run check` is green: typecheck, lint, prettier, 404 Jest tests across 27 suites.

Verification, criterion by criterion. Device tier ran against the local ams (Sail on port 80, EXPO_PUBLIC_API_URL=http://10.0.2.2 in a gitignored .env) on the kolvi-pixel emulator with a fresh dev build.

#1 Jest (`login-screen.test.tsx`: both fields by their catalogue labels, the submit button by role) and `flows/kmo-8-login.yaml`; `.artifacts/e2e/KMO-8 login/takeScreenshot/kmo-8-login.png` is the record for the styling.
#2 Both tiers, and the device tier is the stronger one. `device-name.test.ts` covers the module (generate once, reuse, single read under concurrent callers, keystore failure). On the device: the flow login produced the Sanctum token `Kolvi android 20d470ff-4197-47cb-a6e6-dc005dd72bcf`; force-stopping the app **without** clearing storage and signing in again produced a token of the exact same name, and ams deleted the previous one — so one device still means one token.
#3 `flows/kmo-8-login.yaml` lands on the tab shell; screenshot `kmo-8-signed-in.png`.
#4 Wrong credentials on the device: the screen shows `Estas credenciales no coinciden con nuestros registros.` verbatim, and no retry is offered (`kmo-8-wrong-credentials.png`). The inactive half is Jest only — `login-screen.test.tsx` renders a stubbed 422 carrying `Esta cuenta está inactiva.` and asserts the two sentences are distinct and rendered untouched. There is no inactive user in the local ams database and this task did not write one, so the inactive path has no on-device evidence; the code path is identical, since the app never inspects the sentence.
#5 `flows/kmo-8-login-offline.yaml` with `bin/device net off`: the catalogue connectivity copy plus Reintentar, and the credential sentence explicitly absent (`kmo-8-offline.png`, airplane mode visible in the status bar).
#6 Jest asserts the button reports busy and that two presses issue one request; `kmo-8-submitting.png` is the in-flight button on the device, spinner in place and label still readable.
#7 Jest (`text-field.test.tsx`, `login-screen.test.tsx`) and the device flow: the toggle renames itself, not only its glyph (`kmo-8-password-revealed.png`).
#8 Left unchecked. `GET /api/user` reports no permissions, so nothing on a device can gate on them. The client half is built and Jest-verified (`permissions.test.ts`, `session.test.tsx` — `can()` fails closed on an absent field). ams KOL-5 adds the UserResource; once it ships this criterion can be closed against the real payload.

Flows the login screen broke, and how they were repaired. A cold start no longer lands on the tab shell, so kmo-1 and kmo-2 now assert on the login screen (deliberately: they are the smoke tests and must not need a backend), kmo-3 waits for the login screen before deep-linking to the gallery (which sits outside the session guard), and kmo-4 starts from the new `flows/shared/sign-in.yaml`.

Two flow-harness fixes came out of this:
- `flows/shared/launch.yaml` pressed back unconditionally after the dev-menu Continue. When the menu had already closed, that press closed the app instead and the flow failed several steps later against the launcher. The press is now conditional on a row only the dev menu has. This was a pre-existing flake; it became reproducible with the extra launches this task added.
- `flows/config.yaml` excludes the tag `requires-offline`, so `npm run test:e2e` no longer collects a flow that can only pass with the radio off.

`npm run test:e2e`: 5/5 flows passed, twice in a row. `bin/device net off && bin/e2e flows/kmo-8-login-offline.yaml`: passed. `npm run check`: green (27 suites, 404 tests).

Note for the reviewer: the demo employee accumulated Sanctum tokens in the local ams database, one per flow run, because clearState wipes the stored device id. They are dev fixtures and were left alone.

ams KOL-5 shipped (ams commits c5e643d / f4ae279), so #8 was verified and checked.

Probed the live endpoint with a real token against the running ams: `GET /api/user` now returns exactly the contract KOL-5 was raised for — `{id, name, first_name, last_name, rut, email, avatar, permissions}` with `permissions` a flat array of the nine EMPLOYEE_PERMISSIONS names, and none of the internal columns the raw model used to leak.

Client-side evidence: `session-user.test.ts` and `auth-api.test.ts` now carry that payload byte for byte as their fixture, and assert that all nine names come out as a `PermissionSet` — the second one through the real `createApiClient`, so the whole path from response body to `can()` is covered. The old raw-model body is kept as a second fixture so the parse stays a whitelist and still fails closed when the field is absent.

Device evidence: `flows/kmo-8-login.yaml` signs in against the real ams and reaches the tab shell, and the ams request log shows the `GET /api/user` behind it. The app parses that response — a shape it could not read would fail the sign-in outright, since `parseSessionUser` returning null is a malformed-response error.

What is verified is that permissions are stored and exposed, and that the only gate the app has is `can(permission)`: no role name is parsed anywhere — `parseSessionUser` does not read one. No screen gates on anything yet because the tabs are still scaffolds; KMO-17 is the first real consumer.

Flow-harness state, for the record. `shared/launch.yaml` needed three more fixes while re-running the suite on a windowed emulator (`bin/emu start --window`, which the reviewer asked for): the app is stopped before its state is cleared, the flow waits for the stopped app frame to leave the hierarchy before waiting for the dev-client onboarding (otherwise the wait matches the *previous* run within two seconds and every step after it races a launch that has not started), and the dev menu is dismissed by tapping the scrim rather than with a back press (back closes the app whenever the sheet has already gone, and guarding on visibility does not help because the sheet can close between the check and the press).

That took the suite from a deterministic failure to passing, but not to reliably passing: three consecutive `npm run test:e2e` runs gave 5/5, 4/5 and 4/5, with a different flow failing each time and always the same symptom — the dev client never brings the app up and the assertion times out against the launcher. It reproduces on the windowed emulator and did not appear on the headless one earlier in the day. It is a harness problem, not an app problem: every flow passes when run on its own. KMO-47 owns the harness if this is worth chasing.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-08-02 12:35
---
Held in progress rather than moved to Done: #8 is the only criterion left and it needs ams KOL-5 (a UserResource exposing permissions on GET /api/user) before it can be verified. Everything else is implemented and verified — see the notes. Ping when KOL-5 ships and this closes with a device run against the real payload.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The employee signs in. `src/features/auth/` exchanges their credentials for a Sanctum token at `POST /api/sanctum/token`, reads the user behind it at `GET /api/user`, and holds the session; `Stack.Protected` in `src/app/_layout.tsx` decides which half of the app exists, so a cold start lands on `/login` and a successful login lands on the tab shell with no way back to the form.

Both endpoints sit outside `/api/v1`, so the feature builds its own client against the bare origin rather than the `@/api` singleton — which also keeps a wrong password out of the singleton latch that means "your session ended". The two rejections that matter are 422s distinguished only by the sentence under `errors.email`, so the screen renders that sentence verbatim and never inspects Spanish; a failure that never reached the server gets the catalogue copy and a Reintentar instead. The device is named by a UUID kept in SecureStore, so the server keeps replacing one token per phone rather than accumulating one per launch. `TextField` (masked input with a reveal toggle, error line, 44dp targets) went into `src/ui` because KMO-13, 41 and 44 need the same control.

Verified on the emulator against a locally running `ams`: `flows/kmo-8-login.yaml` covers #1, #3, #4 wrong credentials and #7; `flows/kmo-8-login-offline.yaml` under `bin/device net off` covers #5; #2 was confirmed by relaunching without clearing storage and watching the second login reuse the same token name. #6 is Jest for the double-submit guard plus a screenshot of the in-flight button. `npm run check` green (404 tests, 27 suites); `npm run test:e2e` 5/5 twice.

#8 is left open: `GET /api/user` reports no permissions, so nothing can gate on them yet. The client half — the Permission union, the tolerant parse, `can()` failing closed — is built and Jest-verified, and ams KOL-5 was raised for the UserResource that closes it.

Closed out after ams KOL-5 shipped: `GET /api/user` now returns the nine permission names, the parser is tested against that exact body end to end through the real client, and a device login consumes it. All eight criteria verified. The one caveat worth carrying forward is that nothing gates on `can()` yet — the tabs are scaffolds — so KMO-17 is where the gate first does visible work.
<!-- SECTION:FINAL_SUMMARY:END -->
