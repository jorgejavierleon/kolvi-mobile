---
id: KMO-11
title: 'Session expiry, 401 handling and mid-session deactivation'
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-03 11:02'
labels:
  - mobile
  - auth
milestone: m-0
dependencies:
  - KMO-9
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A 401 arriving in the middle of a punch must not lose the punch. An employee deactivated while holding a token must lose access at the next request, not at the next login.

This is the path that decides whether a token problem is an inconvenience or a lost attendance record.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A 401 on any request clears the stored token and routes to login with a Spanish explanation that the session expired
- [ ] #2 A 401 during a punch attempt preserves the punch intent, so that after re-authenticating the employee is not silently left unmarked
- [x] #3 Concurrent 401s produce exactly one session-expiry transition and one login prompt
- [ ] #4 A user deactivated mid-session is signed out at the next request rather than continuing with a working token
- [x] #5 Signing out from an expired session leaves no employee data readable in the app
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/api/client.ts — `onSessionExpired` takes the `ApiError` that triggered it: `(error: ApiError) => void`. The latch, the once-per-session guarantee and `resetSession()` are already here from KMO-5 and do not change. The argument is what lets the session show the server's own sentence rather than a generic one, which is the whole of AC#4's app half: whether ams words a rejection as an expired token or a deactivated account, the employee reads that wording. client.test.ts follows.

2. src/features/auth/session.tsx — the session records *why* it ended. New `SessionEnd = { readonly message: string } | null` on the context as `ended`, set by the 401 path and by a restore that failed with a 401, cleared by a successful signIn and by an explicit signOut. `forget()` takes the end reason. Two guards: the notice is only raised when there was a live session to lose (a 401 arriving while already signed out sets nothing), and `forget` is re-entrant-safe so the client latch and the restore path cannot both raise it (AC#3).

3. Restore path, same file — today any failure to verify a stored token signs out silently. It splits: a 401 (the token is dead) ends the session *with* the notice; a connectivity failure keeps the current behaviour untouched. This is what makes AC#1 verifiable on a device at all — see 7 — and it is the honest reading of 'a 401 on any request'. Deliberately not KMO-49's job: that ticket decides whether an unverifiable session should sign out, this one only says what the employee is told when the server has actually refused the token.

4. src/i18n/strings.ts — `auth.sessionExpired`, the fallback for a 401 the server sent no message with. Worded for the login screen rather than reusing `errors.unauthorized`, which is the sentence a failed *request* shows. The server's own message always wins, per the catalogue's existing rule.

5. src/features/auth/login-screen.tsx — the notice above the form, `accessibilityLiveRegion="polite"`, testID `login-session-expired`, in the warning tone rather than danger so it does not read as a failed login attempt, and suppressed while a sign-in failure is showing so the screen never carries two messages.

6. Tests (Jest tier: AC#1, #3, #5 and the app half of #4). session.test.tsx — a mid-session 401 clears the token, ends the session and raises the notice; the server's message survives to the notice; two concurrent 401s produce one transition and one notice; a restore that 401s ends signed out with the notice; a restore that fails on connectivity does not raise one; signing in again clears it; after an expiry `user` is null, `permissions` empty and the store empty (AC#5). login-screen.test.tsx — the notice renders, and gives way to a login failure.

7. flows/kmo-11-session-expiry.yaml (device tier: AC#1, #5). The app makes no /api/v1 request after login yet — the tabs are scaffolds — so the only 401 an emulator can be made to produce today is on the restore call. Sign in, revoke that Sanctum token in the local ams, force-quit, cold start: the employee lands on the login screen reading the Spanish notice, with no name or employee data anywhere in the hierarchy. Tagged so it is run deliberately, since it needs a reachable ams like every other session flow.

Not in this ticket, and why:
- AC#2 (punch intent) has nothing to preserve: KMO-17 builds the punch and KMO-23 the durable queue, and KMO-49 #9 already owns 'a 401 while flushing does not drop the queue'. Building an intent holder now would be an API with no caller, provable only by a test of itself. Left unchecked with this note.
- AC#4 cannot close on this repo: ams checks `is_active` at token issue only (TokenController.php:40, PRD A7/A8), so a deactivated employee's token still works and no client change makes it stop. The app half is built and tested here; the criterion needs the API guard.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan step 1 was reversed during implementation, and the reason is worth keeping. It was going to hand the ApiError to onSessionExpired so the login notice could carry the server's own sentence. Checked ams first: Laravel's guard answers a dead token with a hardcoded 'Unauthenticated.' that never reaches the translator, and lang/es has no entry for it — so the 401 body is the one server message in this app that cannot be shown to an employee under Res. 38 Art. 5. The notice is therefore always es.auth.sessionExpired, and the *reason* reaches the employee accurately a moment later: a deactivated employee who signs in again gets ams' own auth.inactive ('Esta cuenta está inactiva.') through the path KMO-8 already built and tested. onSessionExpired keeps its original signature.

Verification. npm run check green (34 suites, 510 tests). Device tier: the three-command sequence in flows/kmo-11-session-expiry.yaml — sign in, revoke the employee's tokens in the local ams (54 deleted), cold start — passed, and the screenshot at .artifacts/e2e/'KMO-11 session expiry'/takeScreenshot/kmo-11-session-ended.png shows the amber notice above an empty form with no employee data anywhere on the screen. npm run test:e2e 6/6 afterwards, so the login-screen change broke none of the existing flows.

AC#1, #3 and #5 checked on that evidence. #3's two halves: the transport latch collapsing concurrent 401s is src/api/client.test.ts, and the session ending exactly once across them (one store.clear, one notice) is session.test.tsx — the guard for the second is the token ref being null, which holds even though auth-api deliberately runs a second client with no expiry callback.

AC#2 and AC#4 left unchecked, both deliberately and neither for want of trying — see the plan. #2 has no punch to preserve until KMO-17/KMO-23, and KMO-49 #9 already owns the queue-and-401 interaction. #4 is blocked in ams, not here: is_active is checked only at token issue (TokenController.php:40), so a deactivated employee's token keeps working and no change on this side stops it. The app half — the 401 that check would produce ending the session at the next request — is built and covered by the same tests as #1.

Also: the AVD had a device PIN left behind by KMO-10's fingerprint enrolment, which locked the screen and stalled the first flow run. bin/device finger clear plus an emulator restart cleared it; nothing in the app.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The session now says why it ended. A 401 on any request — mid-session or on the cold-start restore call — clears the token, drops every field the app holds about the employee, and returns them to the login screen with a Spanish notice above the form (es.auth.sessionExpired, warning tone, announced to a screen reader) instead of dropping them there unexplained. A connectivity failure deliberately raises nothing: an unverifiable token has not expired, and KMO-49 owns that case. The notice is the catalogue's sentence rather than the server's because Laravel's guard answers a dead token with an untranslated 'Unauthenticated.'; what actually ended the session reaches the employee in Spanish at the next sign-in attempt, from ams' own lang/es/auth.php.

Verified with npm run check (510 tests) and flows/kmo-11-session-expiry.yaml against a real revoked token on the emulator; npm run test:e2e 6/6. AC#1, #3 and #5 checked. #2 waits for a punch to preserve (KMO-17/23); #4 waits for the is_active guard in ams (PRD A8) — the app side of it is done and tested.
<!-- SECTION:FINAL_SUMMARY:END -->
