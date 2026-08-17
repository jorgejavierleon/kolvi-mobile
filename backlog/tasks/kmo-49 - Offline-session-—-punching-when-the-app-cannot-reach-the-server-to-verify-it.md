---
id: KMO-49
title: Offline session — punching when the app cannot reach the server to verify it
status: Done
assignee:
  - '@claude'
created_date: '2026-08-02 13:10'
updated_date: '2026-08-17 21:01'
labels:
  - mobile
  - offline
  - auth
  - compliance
milestone: m-0
dependencies:
  - KMO-9
  - KMO-21
  - KMO-23
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The offline epic (KMO-21 to KMO-24) settles what happens to a *punch* made with no connectivity. It says nothing about what happens to the *session* at that moment, and without an answer the queue is unreachable: an employee in a warehouse basement opens the app, the session cannot be verified, they are put on the login screen, and the punch button they were going to press is not on screen at all. The punch queue only earns its keep if the employee can get to the punch.

### What the app does today (KMO-8)

`src/features/auth/session.tsx` restores a session by calling `GET /api/user` with the stored token, and signs out on any failure — including a failure that never reached the server. So today a cold start with no connectivity always lands on the login screen. That was the right shape while the token was in memory and there was no queue; it is the wrong shape once KMO-9 persists the token and KMO-23 adds the queue.

Signing in itself is unavoidably online: `POST /api/sanctum/token` is the only way to get a token. That asymmetry is the crux — an employee who has signed in before must be able to punch offline, and an employee who never has cannot.

### What has to be decided, and written down

These are decisions, not just code, and they belong in docs/design-decisions.md alongside the §4 offline position:

- **How long the app trusts a token it cannot verify.** Indefinitely is a security position (a stolen phone keeps punching); a short bound is an availability position (a rural site loses the queue). Res. 38 Art. 8 and Art. 14a are about adulteration risk, so the answer has to be defensible, not merely convenient.
- **What the app shows while running on an unverified session.** The employee should know their session has not been confirmed, without the app crying wolf every time a lift blocks the signal.
- **What gates the punch button offline.** Permissions come from the server (`can(ClockOwn:Mark)`, once ams KOL-5 ships). Offline there is only the last known set — how stale may it be, and what happens when the employee was deactivated while offline (PRD A7/A8).
- **What sign-out (KMO-12) does with a non-empty queue.** Revoking the token strands punches that were made and never transmitted. Silently discarding them is not an option.
- **Whether a queued punch is bound to the employee who made it.** Flushing one employee’s punches under another employee’s token would put a mark in the wrong person’s attendance book — an adulteration, not a bug.

### Scope

The session half of offline punching. The queue, the banner and the receipt belong to KMO-22, KMO-23 and KMO-24; the token store to KMO-9; 401 handling and mid-session deactivation to KMO-11; sign-out to KMO-12. This task decides how those interact when there is no connection, and implements the session side of that.

Depends on KMO-21: if the spike concludes an offline queue is not defensible, most of this disappears with it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The decisions above are written into docs/design-decisions.md — offline session lifetime, what the employee is shown, offline permission gating, sign-out with a pending queue, and queue-to-employee binding — before any of the criteria below are implemented
- [x] #2 A cold start with no connectivity and a previously stored token lands the employee on the punch screen, not on the login screen
- [x] #3 The app tells the employee, in Spanish, that it is working from an unverified session, and stops saying so once the session is confirmed
- [x] #4 A session running unverified past the agreed lifetime ends and the employee is returned to the login screen with a Spanish explanation
- [x] #5 A cold start with no connectivity and no stored token shows the login screen and states that signing in needs a connection
- [x] #6 Offline the punch action is gated on the last known permission set, and a punch is refused when that set does not include ClockOwn:Mark
- [x] #7 Each queued punch records which employee made it, and the queue never flushes under a different employee token — covered by a test that signs in as a second employee with punches still queued
- [x] #8 Signing out with a non-empty queue behaves as the recorded decision specifies and never discards a queued punch without telling the employee
- [x] #9 A 401 while flushing ends the session without dropping the queue, and the punches still flush after the same employee signs in again
- [x] #10 A device-tier flow covers the core case: sign in, go offline, force-quit, cold start, and reach the punch screen
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Decisions to write into docs/design-decisions.md §4.7 (new) before any code (AC#1):

D1. Offline session lifetime: 24h, rolling from the last successful GET /api/v1/user (sign-in,
    cold-start restore, or a background reconfirm on connectivity return). Tied to the already-
    accepted §4.4 window: past 24h an unsynced punch stops being insertable as an ordinary mark
    and goes through the Art. 39 b)/40 pathway anyway, so trusting a session longer buys no
    additional attendance value while extending a lost/stolen phone's exposure.

D2. What the employee is shown: a calm, neutral-tone (not warning/danger) strip on the tab
    shell, all four tabs, non-dismissible: "No pudimos confirmar tu sesión con el servidor.
    Algunos datos podrían estar desactualizados." It appears only when the session is actually
    unverified (a cold-start restore that could not reach the server) — never for an ordinary
    mid-session signal drop, which the existing pending-sync banner already covers. Clears the
    instant a background reconfirm succeeds.

D3. Offline permission gating: the last known permission set, i.e. whatever `session.can()`
    already gates on — free once the last-known SessionUser is cached and restored on a cold
    start (home-screen.tsx's existing `session.can('ClockOwn:Mark')` needs no change). Mid-
    session deactivation cannot be detected offline (ams checks `is_active` at token issue only —
    KMO-11's open AC#4, PRD A7/A8); D1's 24h bound is the mitigation, not a fix to that gap.

D4. Sign-out with a non-empty queue: never discarded. sign-out.tsx's current copy
    ("Se perderán al cerrar sesión") is corrected — it was already inaccurate: `forget()` has
    never touched the punch queue. The queue stays on the phone, bound to the employee who made
    each punch (D5), and flushes only once that employee is signed in again. The confirmation
    sheet, when punches are pending, says they're saved and need the employee to sign back in to
    sync — not that they'll be lost.

D5. Queue-to-employee binding: every QueuedPunch carries the userId it was made under. The
    queue is read/flushed filtered to the signed-in employee's id, so another employee's
    leftover rows on a shared device stay dormant and invisible until that employee returns, and
    a flush can never post under the wrong token.

Plan:

1. docs/design-decisions.md — new §4.7 "Offline session" recording D1-D5, cited against Art. 8 /
   14a (adulteration risk framing) the way §4 already does. Present to user before writing (HIGH
   priority + material decisions) — this message.

2. src/features/marcaje/connectivity.ts (+.test.ts) — move to src/api/connectivity.ts, re-
   exported from src/api/index.ts (matching datetime.ts's precedent: a device-adjacent
   primitive, not a fetch caller, already lives in api/). Update the 4 importers
   (use-connectivity.ts, use-connectivity.test.ts, home-screen.tsx, home-screen.test.tsx) to
   `@/api`. Needed because both marcaje (existing) and auth (new, this ticket) need it, and
   "a feature never imports another feature" pushes shared device capability to api/.

3. src/features/auth/session-cache.ts (new, +test) — mirrors token-store.ts's shape
   (createSecureSessionCache / createMemorySessionCache: read/write/clear), SecureStore key
   `kolvi.session-cache`, JSON `{ user: <SessionUser, permissions as string[]>, verifiedAt:
   <ISO> }`. Written on every successful fetchSessionUser, cleared by forget().

4. src/features/auth/session.tsx — the material rewrite:
   - restore(): on fetchSessionUser failure, branch on `isApiError(error) && !isConnectivityFailure`
     (401 → existing forget+ended path, unchanged) vs a connectivity failure. On the latter, read
     the session cache; within D1's 24h of its `verifiedAt` → status 'signedIn', user from cache,
     new `verified: false`; expired or absent → forget() with a new `es.auth.offlineSessionExpired`
     message (AC#4's cold-start shape). No stored token at all: unchanged today (signedOut,
     ended: null) UNLESS also offline — checked via `createConnectivitySource().getState()` (cheap,
     no request) — in which case set a new `es.auth.signInNeedsConnection` message on `ended`
     (AC#5).
   - New `verified: boolean` (default true once signed in the ordinary way) on `Session`.
   - A background reconfirm: subscribe to the connectivity restore edge while `verified === false`;
     on it, re-run fetchSessionUser — success updates cache/user/verified=true; 401 → forget();
     failure → stays unverified.
   - A periodic bound check (same interval shape as throttle-countdown.ts) while unverified: past
     D1's window, forget() with the same offline-expiry message — the "stays open past the bound
     without restarting" half of AC#4.
   - signIn() and the online restore path both write the session cache after a successful
     fetchSessionUser; forget() clears it.
   - SessionProviderProps grows an injectable `sessionCache` / `connectivitySource`, test pattern
     matching tokenStore's.

5. src/i18n/strings.ts — `es.auth.offlineSessionExpired`, `es.auth.signInNeedsConnection`,
   `es.auth.unverifiedSession` (the tab-shell strip), and reworded `unsyncedPunchesWarning` /
   `auth.signOut.body` copy for D4.

6. src/features/auth/unverified-session-banner.tsx (new, +test) — the neutral strip, reads
   `useSession().verified`, renders nothing when true. Composed in src/app/(tabs)/_layout.tsx
   (wrapping `<Tabs>`, sibling to it) rather than owned by marcaje, since it's a session-wide
   fact and (tabs)/_layout.tsx already imports useSession for the corrections badge.

7. src/features/marcaje/punch-queue.ts — QueuedPunch gains `userId: number`. `flush({sync,
   online, userId})` selects `state.entries.filter(e => e.userId === userId)` as the pending set,
   still oldest-first and still stopping at the first failure within that subset; removal
   switches from `state.entries.slice(settled)` to filtering out the specific ids settled (needed
   once "pending" is no longer a prefix of the full array). `usePunchQueue(queue, userId)` filters
   `entries`/`count` the same way for the banner and sign-out's `pendingPunches`.

8. src/features/marcaje/punch-queue-store.ts — schema gains `user_id INTEGER NOT NULL` (CREATE
   TABLE redefinition, not a migration — no pilot/production install exists yet, same basis
   KMO-23 shipped on). `append` writes it; `load` returns it on `QueuedPunch`.

9. src/features/marcaje/use-punch.ts — `usePunch` takes a `userId: number` option, stamps it on
   the QueuedPunch it builds. src/features/marcaje/home-screen.tsx wires it from
   `session.user!.id` (screen is behind the signedIn guard) and passes `userId` through to both
   `flush` call sites and to `usePunchQueue`.

10. src/features/auth/sign-out.tsx + src/app/perfil.tsx — copy per D4; `pendingPunches` already
    comes from `usePunchQueue()` in perfil.tsx, changes to pass the session's own userId once #7
    lands.

11. Tests throughout (Jest tier, alongside each file above): D1's rolling 24h bound, D2's show/
    hide edges, cold-start-offline-with-cache → punch screen, cold-start-offline-no-cache/expired
    → login with message, cold-start-offline-no-token → login with connection message, AC#7's
    two-employee non-flush (sign in as employee A, queue a punch, sign out, sign in as employee B,
    B's flush never touches A's row), AC#9 (401 mid-flush keeps the queue, same employee's next
    sign-in flushes it).

12. flows/kmo-49-offline-cold-start.yaml (new) — AC#10: sign in, `bin/device net off`, `stopApp`,
    cold start, reach Inicio with the unverified strip visible — modelled on
    kmo-23-queue-relaunch.yaml's force-quit/relaunch-through-dev-client recipe, which already
    flags this exact gap in its own header ("a cold start with no connectivity does not reach
    Inicio at all... that gap is KMO-49's").

Verification tier per AC: #2-#5 Jest (session.test.tsx) + the device flow for #2/#10 together;
#6 Jest + device screenshot of the strip; #7 Jest (punch-queue.test.ts, home-screen.test.tsx);
#8 Jest (sign-out.test.tsx); #9 Jest (session.test.tsx, punch-queue.test.ts). npm run check
after each slice.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Jest tier complete for the session/queue-binding halves. §4.7 written into
docs/design-decisions.md (D1-D5). session.tsx: cold-start offline restore from
SessionCache within 24h (verified:false), background reconfirm on connectivity
restore, 24h bound timer, no-token+offline message. connectivity.ts moved
src/features/marcaje -> src/api (shared with auth). UnverifiedSessionBanner
composed in (tabs)/_layout.tsx. punch-queue.ts/punch-queue-store.ts: QueuedPunch
gains userId, flush/usePunchQueue filter by employee (§4.7 D5), SQLite schema
gains user_id column. sign-out copy corrected (queue was never actually
discarded by forget() - now the copy matches).

npm run check green: 95 suites, 1439 tests, lint/format/typecheck clean.

Remaining: device-tier flow for #10, npm run android rebuild (schema/native
unchanged actually - no new native module, so likely no rebuild needed, just
Metro), manual verification of the offline cold-start scenario and the
unverified banner on screen, final AC checks.

Device tier verified: flows/kmo-49-offline-cold-start.yaml passes against a
real emulator (sign in online, bin/device net off, force-quit, relaunch
through the dev client) - screenshot shows Inicio (not /login) with the
unverified-session strip on screen, verbatim Spanish, and the punch surface
gated on the cached ClockOwn:Mark permission. .artifacts/e2e/'KMO-49 offline
cold start reaches the punch screen'/takeScreenshot/kmo-49-offline-cold-start.png

Full npm run test:e2e run (21 flows): 18/21 passed, 3 pre-existing failures
(KMO-4 navigation shell, KMO-32 Proximos, KMO-35 pending correction) verified
unrelated to this branch by running the same 3 flows against master (git
stash) - all three fail identically there. All are stale Jornada-tab fixtures
predating this ticket (KMO-32/34/35 replaced the tab's placeholder content
after these flows were written; the flows were never updated to match). Not
touched by this ticket's scope, not introduced by it.

npm run check: 95 suites, 1441 tests, lint/format/typecheck all green.

AC#9's session-ends half rides on the existing app-wide 401 latch in
src/api/client.ts (onSessionExpired), which createPunchSync's default client
already goes through - unchanged by this ticket, generically covered by
session.test.tsx's "a session the server ends" suite. What's new is
punch-queue.test.ts's explicit 401-during-flush test proving the row survives
and flushes on the next attempt under the same userId.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-08-07 15:52
---
KMO-21 is settled and the queue is defensible (Res. 38 Art. 10 is an express exception, and Art. 38 a/b make refusing the punch independently non-conforming) — so nothing in this ticket disappears, which was the conditional its description raised.

Two contacts with §4: the idempotency_key in §4.3 is scoped per user server-side via a unique (user_id, idempotency_key) index, which is half of this ticket's #7; and §4.4's 24 h cap bounds how long a stranded queue stays flushable, which is context for #8 (sign-out with a non-empty queue) and #9 (401 while flushing). The offline *session* lifetime in #1 is still this ticket's to decide — §4 deliberately says nothing about it.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Offline session lifecycle, decided and built. docs/design-decisions.md §4.7
records the five decisions (D1-D5): a 24h rolling trust window tied to the
already-accepted §4.4 boundary, a calm neutral tab-shell strip while
unverified, offline permission gating off the last confirmed set (free, via
session-cache.ts), sign-out never discarding a queued punch (the old copy was
already inaccurate - forget() never touched the queue), and every queued
punch bound to the employee who made it.

session.tsx: a cold start with a stored token and no connectivity restores
signed-in from SessionCache (new, SecureStore-backed) rather than signing
out, with verified:false; a background effect reconfirms on connectivity
return and enforces the 24h bound independently of a restart. No token and no
connectivity gets a distinct "necesitas conexion" message instead of a blank
form. connectivity.ts moved src/features/marcaje -> src/api since both
marcaje and auth need it now (features can't import each other).

punch-queue.ts/punch-queue-store.ts: QueuedPunch and the SQLite schema gain
userId; flush and usePunchQueue filter to the signed-in employee, so a shared
device's leftover rows from a previous sign-in stay dormant and invisible
until that employee returns, and can never flush under someone else's token.

Verified: npm run check green (95 suites, 1441 tests). Device tier:
flows/kmo-49-offline-cold-start.yaml passes on the emulator - screenshot
confirms Inicio (not /login) with the unverified strip and a live punch
surface with no connectivity at all. Full flow suite run: 18/21 passed, the
3 failures confirmed pre-existing and unrelated (same failures reproduce on
master).
<!-- SECTION:FINAL_SUMMARY:END -->
