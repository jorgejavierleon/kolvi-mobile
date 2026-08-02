---
id: KMO-10
title: Biometric app unlock
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-02 19:45'
labels:
  - mobile
  - auth
  - compliance
milestone: m-0
dependencies:
  - KMO-9
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Device fingerprint or face unlock gates access to the stored token. Per docs/design-decisions.md §5 this is the second of the two identification alternatives Res. 38 Art. 7g asks for, with the password as the non-biometric one.

This is app unlock, not identity proof. It does not identify the employee to the server and must not be described in the UI as if it did.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After first login the user is offered biometric unlock, with a clear Spanish explanation of what it does
- [x] #2 When enabled, returning to the app after backgrounding requires a successful biometric prompt before any screen with employee data is visible
- [x] #3 A failed or cancelled biometric prompt falls back to entering the password, and never silently grants access
- [x] #4 A device with no enrolled biometric does not offer the option and the app remains fully usable
- [x] #5 Biometric unlock can be turned off from the profile, which does not sign the user out
- [x] #6 No biometric data leaves the device and none is sent to the server
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. package.json + app.config.ts — add `expo-local-authentication` (new native module; needs prebuild + rebuild). Its config plugin adds Android USE_BIOMETRIC and an iOS NSFaceIDUsageDescription, which is authored in Spanish.

2. src/features/auth/biometrics.ts — the whole native surface, one file to audit for #6. `isAvailable()` = hasHardwareAsync && isEnrolledAsync; `authenticate()` returns 'success' | 'failed' | 'cancelled' | 'unavailable'. Nothing else crosses the boundary — the module never yields a template, an image or an identifier, so there is nothing that could be sent anywhere. Injectable, like TokenStore and AuthApi.

3. src/features/auth/unlock-preference.ts — the on/off flag in SecureStore under `kolvi.biometric-unlock`, same read/write/clear shape and same degrade-to-less-persistence behaviour as token-store.ts. AsyncStorage is ESLint-blocked, so SecureStore is where a preference goes anyway.

4. src/features/auth/lock.tsx — LockProvider/useLock. Latches `locked` when AppState leaves 'active' while signed in and the preference is on, *not* when it returns: locking on the way out is what guarantees there is no frame of employee data on the way back in (#2). unlock() runs the prompt; failed or cancelled leaves it locked (#3).

5. src/features/auth/lock-screen.tsx — the gate. Wordmark, one Spanish sentence saying this unlocks the app on this phone, a Desbloquear button that retries the prompt, and Ingresar con contraseña, which clears local session state and drops to /login. Never a path that unlocks without one of the two (#3).

6. src/features/auth/biometric-offer.tsx — the post-login offer, a BottomSheet over the tabs, shown once when the device has an enrolled biometric and the preference has never been recorded (#1, #4). Copy says what it does — locks the app — and does not claim it identifies the employee. Activar / Ahora no both record an answer so it is asked once.

7. src/app/_layout.tsx — LockProvider inside SessionProvider; tabs and perfil move behind `guard={signedIn && !locked}`, and a new src/app/bloqueo.tsx behind `guard={signedIn && locked}` renders LockScreen. Stack.Protected takes the screens out of the navigator rather than redirecting off them, which is the same mechanism that already keeps a signed-out employee off a tab.

8. src/app/perfil.tsx — a Seguridad card above the scaffold with the toggle row (#5). Turning it off writes the preference and nothing else; the session is untouched. KMO-25 later folds this row into the real menu card.

9. src/i18n/strings.ts — a `security` section: the offer, the lock screen, the profile row, and the already-present permissions.biometrics.unavailable.

10. Tests beside each file, plus flows/kmo-10-biometric-unlock.yaml.

Tier per criterion:
- #1 Jest (the offer appears after a first login, exact copy) + Maestro
- #2 Jest (the AppState transition latches the lock) + Maestro (backgrounding and returning)
- #3 Jest (failed and cancelled both stay locked, no unlock path without success or password) + Maestro
- #4 Jest (no hardware and not-enrolled both suppress the offer) + Maestro on the default AVD, which has no enrolled fingerprint — that is exactly this criterion's condition
- #5 Jest + Maestro
- #6 Code inspection of biometrics.ts plus a Jest test that the lock flow makes no API call. Argued from the module surface, not proved by a network capture — noted as such rather than claimed.

Open: #2 and #3 need an *enrolled* fingerprint on the AVD, which bin/device finger presupposes and nothing in bin/ sets up.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fallback for #3, decided with the user: the lock screen's `Ingresar con contraseña` clears local session state and drops to /login for a full re-auth, reusing KMO-8 rather than inventing a second password path. The prompt itself runs with `disableDeviceFallback: false`, so repeated biometric failures let the OS offer the phone's own PIN or pattern — the only unlock that works with no signal, which matters because the alternative strands an employee who cannot reach the server in a basement. Rejected inline password re-auth on the lock screen: it mints a fresh Sanctum token on every unlock and KMO-12 has not built revocation yet.

#2 and #3 need an enrolled fingerprint on the AVD, which bin/device finger presupposes. Adding `bin/device finger enroll` (scripted, idempotent) rather than enrolling by hand, so the flow is honest evidence on a fresh AVD instead of one carrying an undocumented precondition.

Verification.

`npm run check` green: typecheck, lint, format, 496 Jest tests across 34 suites (168 of them in src/features/auth).

Device tier, on the headless AVD with a development build:
- `bin/device finger enroll && bin/e2e flows/kmo-10-biometric-unlock.yaml` — passes. Covers #1, #2, #3 and #5.
- `bin/device finger clear && bin/e2e flows/kmo-10-biometric-unavailable.yaml` — passes. Covers #4.

Walked by hand as well, because the flow cannot do it: Maestro's runScript has no shell, so a flow cannot call `adb emu finger touch`. Where the flow has to pass the prompt it taps through to the device PIN via `button_use_credential`. The fingerprint route itself was driven manually — presented finger 1 to the enable prompt and it recorded the preference and closed the sheet, then backgrounded and returned to a locked app and presented it again to get back in. Screenshots in .artifacts/: kmo-10-offer.png, kmo-10-lockscreen.png, kmo-10-perfil.png.

#6 is checked on inspection rather than on a test that could fail. expo-local-authentication answers with a boolean and an error string; src/features/auth/biometrics.ts narrows even that to one of four fixed strings, and nothing else in the app touches the module. There is no template, image or per-finger identifier in a variable anywhere, so there is nothing a log line or a request body could carry. `biometrics.test.ts` pins the four-string surface; it cannot prove a negative about the network.

Found on the way past, and NOT fixed here: the app crashes on cold start with a SIGSEGV in Fabric's `MountingCoordinator::pullTransaction` (SEGV_ACCERR, jumping to a heap address — a corrupted function pointer). It predates this branch.

Measured on flows/kmo-1-app-launch.yaml, 10 cold starts each, same APK, only the JS swapped:
- master's JS: 1 crash in 10
- this branch: 3 crashes in 10

Which flow fails is random from run to run, so a full `npm run test:e2e` currently loses one or two flows to it per run and passes them on a re-run. 1-vs-3 out of 10 is not strong evidence on its own, but the direction was consistent across three suite runs.

Two things were tried and neither moved the branch rate off 3/10: not keeping the offer's Modal mounted while hidden, and collapsing the two independent async mount gates into one. Both are kept because they are better code, not because they fixed anything. What is ruled out: it is not the offer sheet (the failing runs have no biometric enrolled, so it never mounts) and not a render-phase state update (removed, no change).

Left alone deliberately. Chasing a use-after-free in React Native's mounting layer is its own investigation and is nowhere in this task's acceptance criteria. Worth its own ticket — raised with the user rather than opened unasked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Biometric app unlock, as a gate in front of the session rather than a part of it.

src/features/auth/biometrics.ts is the app's whole biometric surface — one file to audit for #6 — and it narrows expo-local-authentication down to four fixed strings, so there is no biometric datum in a variable anywhere. LockProvider latches the lock when the app *leaves* the foreground, which is what makes #2's "before any screen with employee data is visible" true by construction: the gate is already the mounted screen before the app is on top again. Stack.Protected swaps the tabs for src/app/bloqueo.tsx, the same mechanism that already keeps a signed-out employee off them.

There are exactly two ways off the lock screen. A prompt the OS accepted, or 'Ingresar con contraseña', which clears local session state and drops to KMO-8's login for a full re-auth. The prompt runs with disableDeviceFallback off, so repeated biometric failures let the OS offer the phone's own PIN — the only unlock that works with no signal, which matters for an employee in a basement whose finger is wet.

Turning it on is behind a prompt they have to pass first, so nobody is locked out by a sensor that never works for them. The offer is made once and the answer recorded, including a decline. A phone with nothing enrolled never sees the offer and says so on Mi perfil (#4). Turning it off writes a preference and nothing else — the token, the session and the screen are untouched (#5). Signing out forgets the preference, so the next employee on the phone is asked for themselves.

The Seguridad card sits above the profile scaffold rather than inside the menu KMO-25 has not built yet; that task folds the row in.

Also here because KMO-10 broke them: shared/sign-in.yaml now declines the offer on its way to the shell (the sheet is a modal, so on an AVD with a fingerprint every flow using that subflow failed on an unrelated assertion), split so shared/enter-credentials.yaml can be started from; and bin/device grew finger enroll|clear|status, which walks Settings' enrolment wizard because adb has no equivalent — without it the biometric flows are not honestly re-runnable.

Verified with npm run check green and both Maestro flows passing under their opposite device conditions. One thing found and left alone: a cold-start Fabric crash that predates this branch, written up in the notes.
<!-- SECTION:FINAL_SUMMARY:END -->
