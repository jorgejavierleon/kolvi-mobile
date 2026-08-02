---
id: KMO-9
title: Secure token storage
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-02 15:11'
labels:
  - mobile
  - auth
  - compliance
milestone: m-0
dependencies:
  - KMO-8
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Sanctum token is a long-lived credential to an employee attendance record. It goes in the platform keystore, never in AsyncStorage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The token is persisted in Expo SecureStore, backed by Keychain on iOS and EncryptedSharedPreferences on Android
- [x] #2 The token is never written to AsyncStorage, to a plain file, or to logs, and this is verifiable by inspecting the codebase
- [x] #3 A valid stored token restores the session on cold start without showing the login screen
- [x] #4 Clearing the session removes the token from secure storage
- [x] #5 The device where secure storage is unavailable degrades to requiring login each launch rather than falling back to insecure storage
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/features/auth/token-store.ts (+test) — the module KMO-8 left a seam for. It owns `TokenStore`, `createMemoryTokenStore` (moved out of session.tsx, still what tests mount with) and the new `createSecureTokenStore(store = SecureStore)`. Key `kolvi.auth-token`, beside `kolvi.device-id`. Written with `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` — Android ignores it, and on iOS it keeps an attendance credential out of an iCloud backup restored onto a second handset, which is the same reasoning device-name.ts already documents. The type moves here rather than staying in session.tsx because session.tsx has to import the store as a value, and a type import back the other way would be a cycle. session.test.tsx and login-screen.test.tsx follow the import.

2. Degradation, in that same module (AC#5). Every call is wrapped: read -> null, write -> the token simply stays in memory for this process, clear -> best effort. No second storage backend, ever: an unavailable keystore means the employee logs in again next launch, and signIn must not fail because the write did — session.tsx awaits store.write() inside the try that otherwise signs the user back out. A read that throws also fires a best-effort delete, so an entry left undecryptable by a keystore reset does not poison every future launch. Nothing in the module logs, and no message anywhere carries the token (AC#2).

3. src/features/auth/session.tsx — the default store becomes createSecureTokenStore() instead of createMemoryTokenStore(), and the header comment stops saying KMO-9 will do it. That is the whole change: the restore-on-mount path, the clear-on-401 path and signOut were built in KMO-8 against this interface, so AC#3 and AC#4 are wiring that already exists meeting a store that now persists.

4. eslint.config.js — a no-restricted-imports block over src/** banning @react-native-async-storage/async-storage, @react-native-community/async-storage and expo-file-system. AC#2 asks for something verifiable by inspecting the codebase; a README convention is not that, and `npm run check` failing on the import is. Neither package is a dependency today, so the rule costs nothing and stops the next task adding one by reflex.

5. src/features/auth/token-store.test.ts — round-trips through a fake SecureStore and asserts the key and the keychainAccessible option; a store that throws on every call still reads null, writes nothing anywhere and lets the caller carry on; clear() deletes the key; a failing read attempts the delete; and console.log/warn/error are spied across all of it and never see the token.

6. flows/kmo-9-secure-token-restore.yaml — the device tier for AC#3. runFlow shared/sign-in.yaml, then stopApp and launchApp *without* clearState (clearState is exactly what this flow must not do), and assert 'Inicio' is up while 'Ingresar' never appears. Also carries the Android half of AC#1: only a real EncryptedSharedPreferences write survives a process death.

7. Evidence for AC#1/#2 on the device, by hand and written onto the ticket: `adb shell run-as cl.kolvi.empleados grep -rlE '[0-9]+\|[A-Za-z0-9]{40}'` over /data/data/cl.kolvi.empleados — a Sanctum plaintext token is `<id>|<40 chars>`, so a hit anywhere in the app's data dir is a token stored in the clear. Expect none, and expect the SecureStore prefs file to hold base64 blobs.

Tiers: #1 Jest + the flow + the adb grep. #2 the lint rule, the console assertions, the adb grep. #3 the flow. #5 Jest — an emulator has no way to make its keystore refuse. #4 is Jest only and is the one gap: 'clearing the session' has no user-facing trigger until KMO-12 adds sign-out, so the evidence is session.tsx's forget() path plus the store deleting the key, not a tap on a device.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence, per criterion.

#1 — `src/features/auth/token-store.test.ts` asserts the default store goes through expo-secure-store itself, under `kolvi.auth-token` and with the keychain option. On the device, after a sign-in: `adb shell run-as cl.kolvi.empleados cat shared_prefs/SecureStore.xml` holds `key_v1-kolvi.auth-token` as an AES ciphertext with `keystoreAlias: key_v1` — EncryptedSharedPreferences behind the Android keystore, beside the KMO-8 device id. The ciphertext changes with each new token. And `bin/e2e kmo-9` passing is the other half: nothing survives a process death unless it really reached that file.

#2 — three independent checks. `eslint.config.js` now blocks the AsyncStorage and expo-file-system imports across `src/**`, so putting a credential anywhere else fails `npm run check` (verified by linting a throwaway file that imports both: two errors). The unit test spies on console.log/info/warn/error/debug across every path including the failure ones and asserts none of them fire. On the device, a Sanctum plaintext token is `<id>|<random>` — confirmed against the running ams, which issues e.g. `29|jt4o…` — and `run-as … grep -rlE '[0-9]+\|[A-Za-z0-9]{30,}'` over the whole app data dir matches nothing, as does the same pattern over logcat. The only files naming the key at all are SecureStore.xml (the encrypted entry) and the JS bundle (the constant in the source).

#3 — `flows/kmo-9-secure-token-restore.yaml`, passing. Signs in, stops the app, relaunches without clearState, and lands on the tab shell with 'Ingresar' and 'Correo electrónico' both absent. The control is every other flow: they start with clearState, and each still reaches the login screen, so the flow can fail.

#4 — Jest only, as flagged in the plan and agreed with the user. `token-store.test.ts` asserts clear() deletes the key and a subsequent read returns null; `session.test.tsx` 'clears the session and the stored token' covers forget(). There is no user-facing way to clear a session until KMO-12 adds sign-out, so there is nothing to tap on a device.

#5 — Jest only, and honestly so: an emulator has no way to make its keystore refuse. Four tests over a storage that throws on every call — the write resolves so a sign-in is not lost, the following read is null so the next launch asks for a login, a read that cannot decrypt drops the entry rather than failing forever, and clear() survives.

Cross-checked a crash that showed up during verification and is NOT from this change. Cold starts segfault roughly 1 in 6 on the emulator (SIGSEGV in `facebook::react::MountingCoordinator::pullTransaction`, RN Fabric mount), which fails whichever flow happens to hit it. Measured: 6 runs of `bin/e2e kmo-1` on this branch, 5 pass; the same 6 on stashed master, also 5 pass. `/data/tombstones` carries the byte-identical signature back to 2026-08-01 20:06, two days before this branch and on a different APK install. Pre-existing, worth its own task, not opened here.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Sanctum token moved from memory to the platform keystore.

`src/features/auth/token-store.ts` is the new module and the only place that decides where a credential sits: it owns the `TokenStore` interface KMO-8 left as a seam, the in-memory store the tests mount with, and `createSecureTokenStore()` — expo-secure-store under `kolvi.auth-token`, written WHEN_UNLOCKED_THIS_DEVICE_ONLY so an iOS backup cannot carry an attendance credential onto a second handset. `session.tsx` changed by one line, because the restore, expiry and sign-out paths were already built against that interface.

Every call degrades rather than throws, and degrading always means less persistence and never other persistence: a keystore that refuses costs the employee a login per launch, and there is no fallback to fall back to. A write failure does not fail the sign-in in progress, and a read that cannot decrypt drops the entry instead of poisoning every future launch.

`eslint.config.js` blocks the AsyncStorage and expo-file-system imports across src/**, which is what makes #2 verifiable by inspection rather than by convention.

Verified with: npm run check green (28 suites, 415 tests, 10 of them new); flows/kmo-9-secure-token-restore.yaml passing, which relaunches without clearState and lands on the tab shell; and on the emulator, the encrypted keystore entry present in SecureStore.xml while a grep for the Sanctum plaintext token pattern over the entire app data dir and over logcat matches nothing. #4 and #5 are Jest-only and the notes say why.
<!-- SECTION:FINAL_SUMMARY:END -->
