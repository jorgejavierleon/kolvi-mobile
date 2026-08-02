---
id: KMO-49
title: Offline session — punching when the app cannot reach the server to verify it
status: To Do
assignee: []
created_date: '2026-08-02 13:10'
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
- [ ] #1 The decisions above are written into docs/design-decisions.md — offline session lifetime, what the employee is shown, offline permission gating, sign-out with a pending queue, and queue-to-employee binding — before any of the criteria below are implemented
- [ ] #2 A cold start with no connectivity and a previously stored token lands the employee on the punch screen, not on the login screen
- [ ] #3 The app tells the employee, in Spanish, that it is working from an unverified session, and stops saying so once the session is confirmed
- [ ] #4 A session running unverified past the agreed lifetime ends and the employee is returned to the login screen with a Spanish explanation
- [ ] #5 A cold start with no connectivity and no stored token shows the login screen and states that signing in needs a connection
- [ ] #6 Offline the punch action is gated on the last known permission set, and a punch is refused when that set does not include ClockOwn:Mark
- [ ] #7 Each queued punch records which employee made it, and the queue never flushes under a different employee token — covered by a test that signs in as a second employee with punches still queued
- [ ] #8 Signing out with a non-empty queue behaves as the recorded decision specifies and never discards a queued punch without telling the employee
- [ ] #9 A 401 while flushing ends the session without dropping the queue, and the punches still flush after the same employee signs in again
- [ ] #10 A device-tier flow covers the core case: sign in, go offline, force-quit, cold start, and reach the punch screen
<!-- AC:END -->
