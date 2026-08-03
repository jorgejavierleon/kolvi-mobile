---
id: KMO-12
title: Sign out with server-side token revocation
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-03 16:38'
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
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cerrar sesión in the profile menu. Clearing local storage is not sign-out: the token stays valid on the server and a lost phone stays authorised. The revocation endpoint is a prerequisite in the ams repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cerrar sesión revokes the device token server-side before clearing local state
- [x] #2 The action asks for confirmation, since an offline queue with unsynced punches would be lost
- [ ] #3 Sign-out with unsynced offline punches warns explicitly about what will be lost and requires a deliberate confirmation
- [x] #4 Revocation failing due to no connectivity still clears local state, and the app explains that the token stays active until the device reconnects
- [x] #5 After sign-out the app returns to login and no cached employee data is readable
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/features/auth/auth-api.ts — add `revokeToken(token)`: DELETE `${API_VERSION_PREFIX}/tokens/current` (PRD A2) with an explicit `Authorization: Bearer` header, on auth-api's own origin-bound client rather than the @/api singleton. Same reason fetchSessionUser is here: the singleton's onSessionExpired latch would read a 401 during sign-out as 'your session ended' and put an expiry notice in front of someone who chose to leave. A 401 counts as revoked (the token was already dead); every other failure counts as not revoked.

2. src/features/auth/session.tsx — signOut() becomes revoke-then-forget (#1): call revokeToken with the live token, then forget(). Forget already nulls the token ref, clears the store, drops `user` and the permissions can() answers from (#5). When revocation did not happen, forget carries a SessionEnd so the login screen explains the token stays active until the device reconnects (#4). Widens SessionEnd's contract — see decision B below.

3. src/i18n/strings.ts — new `session` section under auth: sheet title, the plain confirmation body, the confirm and cancel labels, the backdrop label, and `notRevoked` for #4. Plus `pendingPunchesWarning(count)` for #3, in the same shape as pendingSyncSummary.

4. src/features/auth/sign-out.tsx — the Cerrar sesión control and its confirmation BottomSheet. Danger Button, 44dp target. Nothing happens until the sheet's confirm is pressed; backdrop and back button cancel (#2). Takes `pendingPunches?: number` (default 0) — above zero the sheet swaps to the explicit warning naming what will be lost (#3).

5. src/app/perfil.tsx — render <SignOut /> under UnlockSetting, above SectionScaffold, following the KMO-10 precedent rather than building KMO-25's four-row menu early. KMO-25 #4 folds it in; the route supplies pendingPunches once KMO-22/23 build the queue.

6. Tests, written with the code:
   - auth-api.test.ts — method, path, bearer header; 401 reads as revoked, connectivity and 5xx do not.
   - session.test.tsx — revocation is attempted before the store is cleared; a failed revocation still clears everything and sets the notice; a clean sign-out sets none.
   - sign-out.test.tsx — no session ends without the confirm; cancel leaves it intact; the warning variant renders the count.
   - strings.test.ts — the new entries.

7. flows/kmo-12-sign-out.yaml — from shared/sign-in.yaml: open Mi perfil, Cerrar sesión, cancel, confirm, land on login (#2, #5).
   flows/kmo-12-sign-out-offline.yaml — tagged for exclusion, run under `bin/device net off`, asserts the notRevoked sentence on the login screen (#4).

Tier per criterion: #2 #4 #5 Maestro; #1 and #3 Jest only, for the reasons on the notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Opened ams KOL-6 for the revocation endpoint (DELETE /api/v1/tokens/current, PRD A2). ams has no such route today and no /api/v1 group at all, so this ticket ships against the contract on that KOL ticket: until it answers, the DELETE 404s and the app treats that as 'revocation did not happen' — the #4 path.

Verification.

npm run check green (35 suites, 539 tests, typecheck + lint + format).
bin/e2e flows/kmo-12-sign-out.yaml — passed (54s), twice.
bin/device net off && bin/e2e flows/kmo-12-sign-out-offline.yaml — passed (12s).
Both screenshots read by eye: the sheet renders with the danger action and both
buttons; the login screen carries the unrevoked-token notice in the warning tone.

Checked #2, #4, #5. Left #1 and #3 open, deliberately:

#1 — the app sends DELETE /api/v1/tokens/current with the live token before it
clears anything, and both halves are pinned by tests (auth-api.test.ts for the
method, path and bearer; session.test.tsx for the ordering). But ams has no such
route yet, so against the running backend that DELETE comes back 404 and the token
is NOT revoked server-side. The criterion is about the server, and today the server
does not do it. Closes when KOL-6 ships — the app needs no further change, and the
#4 warning is what an employee sees until then.

#3 — the warning copy, its count agreement and the confirmation it requires are
built and covered by sign-out.test.tsx and strings.test.ts, but there is no offline
queue in the app (src/features/marcaje is a .gitkeep; KMO-21/22/23/24 are To Do), so
pendingPunches is 0 on every real screen and the warning cannot be reached on a
device. Closes when the queue exists and src/app/perfil.tsx passes a real count.

Also of note: a cold start with no network signs the employee out (session.tsx
treats an unreachable GET /api/user like a refused token), which is KMO-49's gap.
It is why kmo-12-sign-out-offline.yaml picks up the running app rather than
relaunching — its header says so.

Paused pending ams KOL-6, which Jorge is implementing. When the endpoint answers 204, retest here is:

  bin/emu start && npm run android
  bin/e2e flows/kmo-12-sign-out.yaml        # #1 becomes checkable: the DELETE now revokes
  bin/e2e flows/shared/sign-in.yaml && bin/device net off
  bin/e2e flows/kmo-12-sign-out-offline.yaml && bin/device net on

Plus one check no flow can make from the device: after an online sign-out, confirm
the token is gone server-side rather than merely unused —

  (cd ../ams && ./vendor/bin/sail artisan tinker --execute \
     "echo App\\Models\\User::where('email','employee@example.com')->firstOrFail()->tokens()->count()")

That is the evidence #1 actually asks for. Expect the notRevoked notice to stop
appearing on the online path at the same time; no app change should be needed.

#3 stays open regardless — it waits on the offline queue, not on KOL-6.

ams KOL-6 shipped, and moved the whole mobile surface under /api/v1 rather than only the new route: POST /api/v1/tokens, GET /api/v1/user, /api/v1/marks, DELETE /api/v1/tokens/current. Adapted this side — auth-api.ts now resolves resolveApiBaseUrl() and holds relative paths, so no path in the app spells its own version any more. It keeps its own client, but the reason narrowed to one: the @/api singleton latches a 401 into 'your session ended', which is wrong for a refused login, a revocation of an already-dead token, and a failed restore.

#1 now checked, on direct server-side evidence rather than request shape:

  after shared/sign-in.yaml      5 tokens, newest 'Kolvi android 2f622d8f-…'
  sign-out through the UI        4 tokens, that device's token gone, other four untouched

The other four are earlier installs' tokens and prove the 'only this device' half.
The notRevoked notice no longer appears on the online path, which is the visible
confirmation that the DELETE is landing.

#4 re-verified against the real endpoint, so it is now a genuine connectivity
failure rather than the old 404: bin/device net off, sign out, and the server still
holds 5 tokens afterwards — the token really does outlive the session, exactly as
the Spanish notice claims.

npm run check green (539 tests). D7 in docs/design-decisions.md rewritten: it
recorded 'v1 alongside the existing unversioned mark routes', which stopped being
true.
<!-- SECTION:NOTES:END -->
