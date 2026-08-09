---
id: KMO-22
title: Connectivity detection and the pending-sync banner
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-09 14:57'
labels:
  - mobile
  - offline
  - marcaje
milestone: m-0
dependencies:
  - KMO-17
  - KMO-21
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The home-screen banner that tells the employee, honestly, that some of their punches are not yet in the attendance book. Copy is fixed by the design; see docs/design-decisions.md §4.

The banner appears only when there are queued punches. Being offline with an empty queue is not something the employee needs told.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The app detects connectivity changes and exposes online/offline state to the punch flow
- [x] #2 When queued punches exist a warning-tinted banner renders above the location card reading {n} marca esperando sincronizar in the singular and {n} marcas esperando sincronizar in the plural
- [x] #3 The banner subtitle reads Aún no forman parte del libro de asistencia
- [x] #4 A Sincronizar button on the banner triggers a flush attempt and shows progress
- [x] #5 The banner disappears when the queue empties
- [x] #6 No banner shows when the queue is empty, whether the device is online or offline
- [x] #7 A flush attempt that fails leaves the queue intact and explains why in Spanish
- [x] #8 There is no manual offline mode: the queue engages only on an actual failure to reach the server, never as a setting, a preference or a default (docs/design-decisions.md §4.6 — Res. 38 Art. 10 limits the exception to situaciones excepcionales, and a toggle would also hand the employee a way to choose their own timestamp)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. package.json — `npx expo install expo-network` (~57.0.1). New **native module**: the dev build needs one `npm run android` rebuild. No config plugin and no app.config.ts change — ACCESS_NETWORK_STATE is already in the RN core manifest and there is no iOS usage description to write.

2. src/features/marcaje/connectivity.ts (+ test) — the only module that imports expo-network, mirroring location.ts. `ConnectivitySource = { getState(): Promise<boolean>; subscribe(listener): () => void }` over getNetworkStateAsync / addNetworkStateListener, injected in tests. Online is `isInternetReachable ?? isConnected ?? true`: unknown reads as online, because the authority on reachability is a request that failed, not this flag.

3. src/features/marcaje/use-connectivity.ts (+ test) — `useConnectivity({ source, onRestored })` -> `{ online }`. Subscribes on mount, fires onRestored on the false->true edge only (KMO-23 #4 hangs its automatic flush off that edge). #8 is structural here: the type has **no setter**, so there is nothing a preference screen could call. The OS flag is an optimism signal — it explains a failure and will trigger a flush; it never decides to queue.

4. src/features/marcaje/punch-queue.ts (+ test) — the queue's observable surface, which is what the banner reads and all this ticket owns. `createPunchQueue()` -> `{ count, entries, enqueue, flush(sync), syncing, lastError, subscribe }`, a module singleton `punchQueue`, read through `usePunchQueue(queue = punchQueue)` with useSyncExternalStore — the house DI shape (`createPunchApi`), not a provider, so _layout.tsx is untouched. Rows are held **in memory**; the file header says so. flush() is serialised, drops only what sync resolves for, and on rejection leaves every row in place with the Spanish in lastError (#7). Durability, the wire body, the real sync and the enqueue-on-failure call site are KMO-23's.

5. src/i18n/strings.ts — add `es.marcaje.sync = { subtitle: 'Aún no forman parte del libro de asistencia', failed: <fallback> }`. `pendingSyncSummary(count)` and `es.actions.sync` already exist from KMO-6 and are used verbatim (#2, #4).

6. src/ui/button.tsx (+ test) — the design draws Sincronizar as a **filled** warning pill (--color-warning-fg ground, white label, border-radius:999px). The five variants have no filled warning and only radius.md, so: add `variant: 'warningSolid'` and `shape?: 'rounded' | 'pill'`. size="sm" keeps the 44px hit target the repo requires — the design's own 30px pill does not.

7. src/ui/icons.tsx — add CloudUploadIcon. **Deviation from the design, deliberate**: the mockup's banner icon transcribes to lucide `sunrise`, which reads as a sunrise on a banner about untransmitted punches. Almost certainly a slip, and the repo's rule that status is never carried by colour alone puts weight on the icon. Spacing, colour and copy are taken from the design unchanged.

8. src/features/marcaje/pending-sync-banner.tsx (+ test) — warning-tone strip in the design's geometry (tones.warning, radius.lg, 12/14 padding, 10 gap, 14 bottom margin — the shape location-card.tsx already uses). Title `pendingSyncSummary(count)`, the subtitle, Button for Sincronizar with loading={syncing} (#4), lastError under it in Spanish (#7). Renders null at zero (#5, #6). One accessible element with accessibilityLiveRegion="polite", like the location card.

9. src/features/marcaje/home-screen.tsx (+ test) — compose the banner directly above LocationCard, outside the three load states: the queue is a fact about the phone, not about /me/today. `queue?: PunchQueue` prop injected in tests like api/punchApi. Mounts useConnectivity() and hands `online` to the flush: pressing Sincronizar with no connectivity short-circuits to es.errors.network rather than spending a doomed round trip (#1 wired to something real, #7 without a request). The button always attempts — it is an Art. 10 accelerator, never a gate.

10. flows/kmo-22-sin-conexion.yaml — the device tier for #6 and #8: `bin/device net off`, cold start, Inicio, assert 'Sincronizar' and 'esperando sincronizar' are **not** on screen and that no offline control exists anywhere.

## Tiers

- #1 Jest (connectivity, use-connectivity) + the flow, which proves losing connectivity changes nothing on Inicio.
- #2 #3 #5 Jest (pending-sync-banner, home-screen).
- #4 Jest — press calls sync, button reports busy.
- #6 Jest + flows/kmo-22-sin-conexion.yaml.
- #7 Jest, both paths: the offline short-circuit and a rejecting sync.
- #8 architectural — no setter on useConnectivity, no preference anywhere — plus the flow.

**Gap, stated rather than papered over**: #2, #3, #4, #5 and #7 get **no device tier in this ticket**, because nothing enqueues a punch until KMO-23 #1. The banner is Jest-verified here and gets its Maestro flow with KMO-23, where a punch can actually be queued on a device.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Validation

`npm run check` green — 66 suites, 1123 tests. `bin/e2e kmo-22` 1/1 passed against a booted AVD and a live `ams`.

Per criterion:

- **#1** — `connectivity.test.ts` (7) and `use-connectivity.test.ts` (10) cover the read, the false→true edge and the unsubscribe. Wired into HomeScreen and used by the flush. On device: `bin/device net off` / `net on` around a live session changed nothing on Inicio and crashed nothing.
- **#2, #3** — `pending-sync-banner.test.tsx`, `home-screen.test.tsx`. Also confirmed **on the emulator by eye**: the queue was seeded over Metro, screenshotted, and the seed reverted (`.artifacts/kmo-22-banner.png`, `kmo-22-banner-singular.png`). The banner renders above the location card in the design's warning tint.
- **#4** — press calls the sync, and the button reports `accessibilityState.busy` rather than disabled. Never disabled: Art. 38 b) names a blocked app as non-conforming.
- **#5** — home-screen test flushes a two-punch queue and waits for the banner to leave.
- **#6** — Jest for both, plus `flows/kmo-22-sin-banner.yaml` online, plus `bin/device net off` + `bin/ui` probes offline (all four strings absent).
- **#7** — covered three ways: the queue keeps its rows and the server's sentence, the banner draws it under the count, and the offline short-circuit produces `es.errors.network` with no request. Seen on the emulator too (`.artifacts/kmo-22-banner-failed.png`).
- **#8** — structural rather than asserted-once: `useConnectivity` has no setter, so there is no call a preference screen could make; the flow asserts no offline control on Inicio or Mi perfil; and offline with an empty queue shows nothing at all.

## Decisions

**expo-network over @react-native-community/netinfo** — first-party, matches the `expo-*` tree. Native module, so the dev build needed one rebuild. No config plugin and no manifest change: `ACCESS_NETWORK_STATE` is already in the RN core manifest.

**The OS flag is optimism, not authority.** `isInternetReachable ?? isConnected ?? true` — unknown reads as **online**, deliberately. A false offline is the reading that would queue a punch the server was reachable for, and Art. 10 does not permit invoking the exception on a guess. What decides that a punch is queued stays `ApiError.isConnectivityFailure` (KMO-23).

**The KMO-22/KMO-23 seam.** This ticket owns the queue's observable surface — count, `flush(sync)`, `syncing`, `lastError` — and holds rows in memory. It deliberately does **not** wire enqueue: a punch written somewhere that cannot survive a force-quit, under copy telling the employee it was *guardada en tu teléfono*, is a claim about their attendance record this ticket cannot honour. KMO-23 supplies durability, the §4.3 wire body, the real sync and the one caller allowed to enqueue.

**Button gained `variant: 'warningSolid'` and `shape: 'pill'`.** The design draws `Sincronizar` as a filled warning pill; no existing variant is filled-warning and the radius was fixed at `md`. `size="sm"` also raises the design's own 30dp control to the repo's 44dp floor — which is why the subtitle wraps to two lines at default font scale where the mockup shows one. Deliberate: the floor wins.

**Icon deviates from the design.** The mockup's banner glyph transcribes to Lucide `sunrise` (rays, the `M22 22H2` horizon, the `M16 18a4 4 0 0 0-8 0` arc) — almost certainly a slip reaching for the arrow-up silhouette. A sunrise means nothing on a banner about untransmitted punches, and with "status is never colour alone" the icon is load-bearing, so it is `cloud-upload`. Spacing, colour and copy are the design's, unchanged.

**One copy fix the design could not have caught.** The design only ever draws this banner in the plural, so its subtitle is fixed at `Aún no forman parte…` — a plural verb over `1 marca esperando sincronizar`. Found by looking at the singular on the emulator. Art. 5 makes the Spanish a requirement, and the singular is already the register's own wording in §4.5's offline comprobante, so the subtitle became `pendingSyncSubtitle(count)` alongside the existing `pendingSyncSummary`.

## Left open, deliberately

**#2, #3, #4, #5 and #7 have no Maestro flow.** Nothing enqueues a punch until KMO-23 #1, so the banner cannot be put on screen by driving the app — the emulator confirmation above came from seeding the queue over Metro and reverting, which is a look rather than a repeatable check. They get their flow with KMO-23.

**The offline half of #6 is not in the flow either.** A cold start with no connectivity lands on the login screen — `session.tsx` signs out on any failure to verify the token, including one that never reached a server — so Inicio is unreachable with the radio off until KMO-49. Verified with `bin/device net off` against a session that was already up; the flow header carries the commands.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-08-07 15:52
---
KMO-21 is settled; §4.6 adds one criterion this ticket did not carry — no offline toggle. The banner stays the only offline affordance. #4 (Sincronizar) is unchanged but read it with KMO-23 #4: the automatic flush is the compliance mechanism, the button only accelerates it.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added connectivity detection and the pending-sync banner.

`expo-network` arrives behind `src/features/marcaje/connectivity.ts` — the only module that imports it — and `useConnectivity` exposes online/offline to the punch flow with an `onRestored` edge for KMO-23's automatic flush. The flag is treated as optimism rather than authority: unknown reads as online, and what decides a punch is queued stays a request that actually failed, which is what keeps §4.6's no-offline-toggle true by construction rather than by policy — the hook has no setter for a preference screen to call.

`punch-queue.ts` is the queue's observable surface: count, `flush(sync)`, `syncing`, `lastError`, over a module singleton read with `useSyncExternalStore`. Rows are in memory and nothing enqueues yet; durability, the §4.3 wire body and the enqueue call site are KMO-23's, and the seam is drawn rather than half-built.

`PendingSyncBanner` sits above the location card in the design's warning tint, outside the three load states — an untransmitted punch is a fact about the phone, not about /me/today. It draws nothing at an empty queue, so being offline with nothing waiting says nothing. `Sincronizar` is a filled warning pill (new `Button` variant and shape, at the repo's 44dp floor rather than the design's 30dp) and is never disabled: Art. 10 makes it an accelerator on an automatic send, and Art. 38 b) makes a blocked app non-conforming. A failed flush keeps every punch and shows the server's own Spanish.

Verified with `npm run check` (66 suites, 1123 tests), `bin/e2e kmo-22` 1/1, `bin/device net off` + `bin/ui` probes for the offline half of #6, and a screenshot of the banner rendering on the emulator from a seeded queue that was reverted. Two things the design could not have caught, both found by looking: the subtitle now agrees in number with the count above it, and the banner icon is `cloud-upload` rather than the mockup's `sunrise`.
<!-- SECTION:FINAL_SUMMARY:END -->
