---
id: KMO-23
title: Durable punch queue with idempotent sync
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-10 23:40'
labels:
  - mobile
  - offline
  - compliance
milestone: m-0
dependencies:
  - KMO-21
  - KMO-22
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The queue itself. Durability is the point: a punch written here must survive an app kill, a battery death and an OS restart, because the alternative is an employee who worked and has no record of it.

Ordering and idempotency are what keep a retry from becoming a double punch.

Implement to the wire contract settled in KMO-21.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A punch attempted with no connectivity is written to durable local storage before the employee sees any acknowledgement
- [ ] #2 Queued punches survive force-quit, device restart and app update
- [x] #3 Each queued punch carries device_datetime as a naive Santiago wall-clock string read once at the moment of the punch, an idempotency_key UUIDv4, and the reported location — the wire contract in docs/design-decisions.md §4.3
- [x] #4 The queue flushes automatically on connectivity restore, in the order the punches were made; the banner's Sincronizar button is an accelerator and never the only way it drains (Res. 38 Art. 9 forbids manual transmission, Art. 10 requires the send be automatic)
- [x] #5 A retried or duplicated request cannot create a second punch server-side, verified by a test that submits the same queued punch twice; the idempotency_key is never regenerated on a retry
- [x] #6 A replay answered 200 is treated as success and the punch leaves the queue with the receipt the server returned, exactly as a 201 is — the employee cannot tell the two apart (§4.3)
- [x] #7 The device reading travels only as device_datetime; datetime is never sent and remains prohibited server-side, and the queue never re-reads the clock on flush
- [x] #8 ApiError carries the server's code through src/api/errors.ts, so a 422 refusal can be branched on without matching its Spanish sentence — a prerequisite, since the two offline refusals are otherwise indistinguishable
- [x] #9 A 422 with code queued_punch_too_old drops the punch from the queue and shows the server's message verbatim: ams filed it for HR as an Art. 39 b) addition inside that same request, so it is never retried (§4.4)
- [x] #10 A 422 with code queued_punch_in_future is handled by a decision recorded on this task before it is implemented, and is never retried blind — the queue does not re-read the clock, so a bare retry either fails identically or records an hour the employee did not work (§4.4)
- [x] #11 A 409 is recognised as the day the punch was made already holding that type, not today's day, and the punch leaves the queue with a calm Spanish line
- [x] #12 A queued punch rejected by the server on sync surfaces to the employee with the server reason rather than being dropped silently
- [x] #13 Tests cover ordering, idempotency, the 200-on-replay path, app-kill durability, both 422 codes, the 409-on-punch-day path and code plumbing through ApiError
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. package.json - add expo-sqlite (npx expo install expo-sqlite). New native dep, one npm run android rebuild, no config plugin needed.
2. src/api/errors.ts (+test) - ApiError gains `readonly code: string | undefined`, parsed off the body like `message` already is. Prerequisite for #9/#10/#11 telling the two 422 refusals apart without matching Spanish.
3. src/features/marcaje/now-clock.ts (+test) - add readDeviceDateTime(clock), reading Date once into a full naive datetime. Update the header comment - it currently says 'nothing here ever reaches a mark', which becomes false for the queued path.
4. src/features/marcaje/punch-queue-store.ts (new, +test) - PunchQueueStore interface (load/append/remove). createMemoryPunchQueueStore() is the new default for a bare createPunchQueue(), so every existing test (home-screen.test.tsx's queueHolding() etc.) keeps working. createSqlitePunchQueueStore() is the real one - one row per punch, insertion-ordered, via expo-sqlite.
5. src/features/marcaje/punch-queue.ts (+test rewrite) - QueuedPunch gains idempotencyKey and deviceDatetime. createPunchQueue(store) hydrates from the store on creation and gates enqueue/flush behind that hydration. enqueue becomes async and awaits the durable write before updating state/notifying listeners - this is what proves AC#1's ordering. flush's injected sync function returns a richer outcome (resolve, optionally with a notice message, drops the row and persists the removal; throw stops the loop and keeps the row) instead of today's plain resolve/reject. The module singleton switches to the SQLite store; createPunchQueue() with no args stays in-memory.
6. src/features/marcaje/punch-api.ts (+test) - add queuedPunchBody() (one object literal, device_datetime + idempotency_key always together, never on the online path) and createPunchSync(), which POSTs it and maps the response into the queue's outcome type:
   - 201/200 -> silent drop (idempotent replay is indistinguishable to the employee)
   - 409 -> drop with a calm authored line (matching how the online 409 already works, not the server's sentence)
   - 422 code queued_punch_too_old -> drop, show the server's message verbatim, never retried (ams already filed it via MarkModification in the same request)
   - 422 code queued_punch_in_future -> decision recorded below: drop, show the server's message verbatim, never retried
   - 422 with no known code -> a client bug per §4.3; log it, drop silently, do not surface as a punch failure
   - everything else (network, timeout, 401, server, malformed) -> rethrow; the row stays queued and the flush stops there
7. src/i18n/strings.ts - new lines for the 409-on-sync case and for the inline "captured, pending sync" status under the punch button (distinct from KMO-24's receipt-sheet copy, which KMO-24 owns).
8. src/features/marcaje/use-punch.ts (+test) - add queue and clock options (default punchQueue / () => new Date()). On a connectivity-failure catch (ApiError.isConnectivityFailure), build a QueuedPunch (fresh id + idempotencyKey via Crypto.randomUUID(), deviceDatetime read once via readDeviceDateTime), await queue.enqueue(punch), then advance local state (Art. 38: never block) and set a new 'queued' PunchAttempt status. New optional onQueued callback for KMO-24 to hang the offline receipt off later.
9. src/features/marcaje/punch-action.tsx (+test) - let the existing inline message slot also render 'queued', same neutral tone as 'duplicate'.
10. src/features/marcaje/home-screen.tsx (+test) - thread clock/queue into usePunch, give punchSync a real default (createPunchSync()), wire onRestored: flushQueue on useConnectivity - the automatic-flush-on-reconnect edge AC#4 requires and KMO-22 left unwired.
11. flows/kmo-23-queue-durability.yaml (new) - offline punch -> queued (banner shows 1) -> force-quit/relaunch without clearState -> still queued (AC#2) -> reconnect -> auto-flushes without pressing Sincronizar (AC#4).

Decisions:
- Storage: expo-sqlite over an expo-secure-store JSON blob. SecureStore is sized for small secrets and is already the app's credential store by convention; an extended outage can legitimately queue more punches than fit that margin. Confirmed with the user 2026-08-10.
- AC#10 (422 queued_punch_in_future): drop from the queue and show the server's message verbatim, same shape as queued_punch_too_old, never retried. The queue never re-reads the clock (§4.3), so retrying the same frozen device_datetime either fails identically or eventually lands at an hour the employee did not work once the server's own clock passes it. The employee re-punches once their clock is corrected, which reads a fresh device_datetime as an independent attempt. Confirmed with the user 2026-08-10.

Out of scope, left to KMO-24 (depends on this ticket): the offline receipt sheet variant, showing folio/hash after a sync, and reconciling /me/today after a background sync succeeds.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified: npm run check green (67 suites, 1173 tests, including 52 new/updated in punch-api.test.ts, punch-queue.test.ts, punch-queue-store.test.ts, use-punch.test.ts, punch-action.test.tsx, home-screen.test.tsx, now-clock.test.ts, errors.test.ts).

Device tier — rebuilt with expo-sqlite (npm run android) and ran on the emulator against real ams:
- flows/kmo-23-queue-punch.yaml + flows/kmo-23-queue-relaunch.yaml (requires-offline, run as documented in the first flow's header) both green. Screenshots in .artifacts/: an offline punch shows "Marca guardada en tu teléfono..." and "1 marca esperando sincronizar", never punch-failed (#1); after a real stopApp + dev-client relaunch, the same row reads back off SQLite by a fresh process — "1 marca esperando sincronizar" still on screen, day still Marcar entrada (#2's force-quit half).
- #4 (automatic flush on connectivity restore) confirmed twice: once by the home-screen.test.tsx integration test, and once for real against ams — a live app instance saw connectivity restore mid-session and flushed without Sincronizar being pressed, landing two real marks (ids 202/203) for employee@example.com. Those were deleted afterward (tinker, with explicit approval) to restore the demo day for repeat runs — ams now shows 0 marks for today again.

#2 left partially unchecked in spirit — the AC bundles three claims and only two are provable here. Force-quit is proven above, on-device. "Device restart" is architecturally the same claim from the storage's point of view (a new process reads the same file a killed one wrote) and is not separately exercised. "App update" is a different claim (a new APK, same data directory) and needs a real version bump and reinstall to test honestly — not attempted. Checking #2 anyway since the force-quit case is the one this ticket's queue design is actually answerable to, and the flow's own header records precisely what it does and does not cover for anyone re-verifying later.

Left to KMO-24 (depends on this ticket): the offline receipt sheet variant, folio/hash after sync, and reconciling /me/today once a background sync succeeds.

Correction to the note above: #2 is left UNCHECKED, not checked. It bundles three claims and only force-quit is proven on-device; 'device restart' is argued-equivalent but not separately run, and 'app update' needs a real version bump/reinstall that was not attempted. The line above saying 'checking #2 anyway' was a drafting error — the checklist itself (unchecked) is correct. Whoever picks this up for KMO-24 or a release check: force-quit durability is solid evidence, the other two are open.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-08-07 15:52
---
KMO-21 settled the contract; ACs updated to match docs/design-decisions.md §4.

The material change is the old #6, 'The device clock reading is never sent as the legal timestamp field'. §4.2 supersedes it: on the queued path the server assigns date_time *from* the validated device reading, because Res. 38 Art. 11 requires the sello de tiempo to be the hour the marcación is made and Art. 11 is textually attached to the Art. 10 offline exception. Stamping the sync time instead would put a false hour in the register. What survives of the old criterion is the part that is still true and is now #7 — the reading travels as device_datetime, datetime stays prohibited, and the clock is read once at the punch and never again.

Also added: 200-on-replay (#6), the concrete field names and types (#3), the 24 h cap and its Art. 40 exit (#8), and Sincronizar as an accelerator rather than the mechanism (#4).
---

author: @claude
created: 2026-08-07 20:21
---
ams KOL-54 has shipped, and §4 is reconciled with what it actually does. Three things changed for this ticket:

**The 24 h refusal is not inert.** The server files the punch as an Art. 39 b) addition through MarkModification *inside the same request* that answers 422 queued_punch_too_old — the employee is emailed and has 48 h. So the app drops it and shows the message; retrying would ask HR to file it twice.

**There is a second edge, and it needs a decision this ticket has to make.** A device_datetime more than 5 minutes ahead of the server answers 422 queued_punch_in_future and files nothing, because there is no missing mark — the phone is wrong about the time. The trap: the queue never re-reads the clock, so a bare retry sends the same future reading and only becomes recordable once the server's clock passes it, at an hour the employee did not work. §4.4 leaves this open on purpose rather than guessing.

**A prerequisite appeared.** Both refusals are 422 {message, code} and are meant to be told apart by code. ApiError keeps only kind, userMessage and Laravel's errors bag, so code is dropped at the transport boundary — and punch-api.ts explicitly rules out matching the Spanish instead. src/api/errors.ts has to carry it. Small, but it is a surface every feature imports, so it is its own criterion (#8) rather than a silent edit.

Also: the one-per-day guard now keys off the day the punch was *made*, so a punch queued at 23:40 and synced next morning collides with yesterday (#11).
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Durable, idempotent punch queue. expo-sqlite backs the queue (punch-queue-store.ts); enqueue writes to disk before the app acknowledges anything, and flush hydrates from disk before touching state. use-punch.ts enqueues on a connectivity failure instead of showing the old false 'failed' message, and advances the day locally (Art. 38: never block). punch-api.ts's createPunchSync posts the §4.3 wire body and maps the response into three outcomes punch-queue.ts understands: silent drop (201/200), drop-with-notice (409, both offline-window 422s — recorded decision: queued_punch_in_future drops and is never retried, same as too_old), or rethrow-and-keep (network, timeout, 401, 5xx). ApiError now carries the server's code. home-screen.tsx wires the real createPunchSync default and the automatic flush on connectivity restore (#4), and surfaces a settled refusal's message through the same banner slot as a stopped flush (#12).

Verified: npm run check green (1173 tests). Device tier: rebuilt with expo-sqlite and ran flows/kmo-23-queue-punch.yaml + flows/kmo-23-queue-relaunch.yaml against a real emulator and ams — #1 and the force-quit half of #2 confirmed with screenshots, #4 confirmed twice (Jest integration test, and for real against ams mid-session).

Left open: #2's 'device restart' and 'app update' claims (argued-equivalent-but-unrun, and not attempted respectively — see the ticket note). KMO-24 (depends on this) owns the offline receipt sheet, folio/hash after sync, and /me/today reconciliation post-sync.
<!-- SECTION:FINAL_SUMMARY:END -->
