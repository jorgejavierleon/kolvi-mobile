---
id: KMO-50
title: Handle 429 and back off when the server throttles
status: Done
assignee:
  - '@claude'
created_date: '2026-08-03 22:20'
updated_date: '2026-08-04 00:34'
labels:
  - mobile
  - auth
  - api
milestone: m-0
dependencies:
  - KMO-5
  - KMO-8
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`ams` KOL-8 (merged 2026-08-03) rate-limits the mobile API: `POST /api/v1/tokens` at 5/minute keyed on email + IP via `ThrottleTokenIssuance`, `PUT /api/v1/user/password` at 6/minute per authenticated user, and a baseline limit on every other route through `throttleApi()`. Any request this app makes can now come back 429, and none of them handle it.

### The app puts English on screen today

Worse than a vague message. `ThrottleTokenIssuance` extends `Illuminate\Routing\Middleware\ThrottleRequests`, so a refusal is a `ThrottleRequestsException` whose body is `{"message": "Too Many Attempts."}` — untranslated. `ApiError.userMessage` prefers the server's `message` whenever there is one, and the login screen's `authFailureFrom` finds no `errors.email` in that body and falls through to exactly that getter.

So a throttled employee reads **'Too Many Attempts.'** on a Chilean attendance app. Res. 38 Art. 5 requires Spanish and has no exception for a sentence that arrived over HTTP — this is the same problem as the guard's `Unauthenticated.`, which is why `es.auth.sessionExpired` is written in the catalogue rather than taken from the server.

Confirmed against the running server, not inferred: six failed logins for one email returned 429 with that body.

### The kind is wrong too

`kindForStatus` in `src/api/errors.ts` has cases for 401, 403, 404, 419 and 422 and falls through to `status >= 500 ? 'server' : 'client'`. A 429 becomes kind `client`, so nothing downstream can tell 'you are going too fast, wait' from 'that request failed'.

### Retry-After is not reachable

The server sends what the app needs to back off — `Retry-After: 59`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. But `errorFromResponse(status, body)` is called with the status and the parsed body only; `src/api/client.ts` never passes response headers. Reaching them means threading headers into `ApiError`, which is a change to the shared client every feature depends on — the real work here, rather than the string.

### Where it shows

Login is what an employee will actually hit: five wrong attempts at shift start, then a minute locked out, which is exactly when they need to clock in — so the wait has to be stated rather than left as a dead button. Change-password (KMO-13) is the other credential-checking route and must not report a throttle as a wrong current password. Everything else inherits the baseline limit and needs only the generic message.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A 429 maps to its own ApiErrorKind rather than falling through to the generic client failure
- [x] #2 The Retry-After header reaches the caller, so a screen can say how long to wait and can back off rather than retry immediately
- [x] #3 A throttled request shows a Spanish message from the catalogue naming the wait; the server's untranslated 'Too Many Attempts.' is never rendered, on any screen
- [x] #4 The submit control on a throttled screen stays unavailable until the Retry-After interval has passed, so the app cannot hammer the limiter it just hit
- [x] #5 A throttled change-password attempt (KMO-13) is reported as a throttle rather than as a wrong current password
- [x] #6 A 429 on any other request surfaces the generic Spanish too-many-requests message rather than a generic failure
- [x] #7 Jest covers the status mapping, the Retry-After parsing including a missing or unparseable header, and that no server-supplied 429 message reaches the screen
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/api/errors.ts — add 'rateLimited' to ApiErrorKind and a 429 case to kindForStatus. Add readonly retryAfterSeconds to ApiError, parsed from the response headers.
   **userMessage returns the catalogue sentence for this kind, always**, unlike every other kind where the server's message wins. Justification: a 429 from ams is only ever ThrottleRequestsException, whose body is Laravel's untranslated 'Too Many Attempts.' — a Fortify-shaped throttle would arrive as a 422 with errors.email instead, so there is no 429 carrying good Spanish to lose. serverMessage is still kept on the error for logging.

2. src/api/client.ts — pass response.headers into errorFromResponse at both call sites (handleResponse and readBody). The signature becomes errorFromResponse(status, body, headers?).
   The header read tolerates a missing `headers` object: the test doubles across client.test.ts, auth-api.test.ts and password-api.test.ts are `{ok, status, text}` literals, and a real Response always has headers, so tolerating absence is cheaper and less churn than rewriting every helper.
   Retry-After is parsed as delta-seconds (what Laravel sends); anything non-integer is treated as absent rather than guessed at.

3. src/i18n/strings.ts — es.errors.rateLimited for the generic case (AC#6), plus an exported tooManyAttempts(seconds?) formatter for the wait, following unsyncedPunchesWarning's shape. Singular/plural on 'segundo'.

4. src/features/auth/throttle-countdown.ts — a useThrottleCountdown(seconds) hook returning the remaining seconds and ticking to zero. A timer has to exist anyway to re-enable the button, so making it visible is nearly free, and a dead control with no feedback at shift start is the case worth avoiding.

5. src/features/auth/auth-api.ts — AuthFailure gains kind 'throttled' and retryAfterSeconds. authFailureFrom maps rateLimited to it.
6. src/features/auth/login-screen.tsx — the throttled branch: the message names the wait, the submit is disabled until it elapses, and no retry button (retry is for connectivity, where pressing again is the right move; here it is the wrong one).
7. src/features/auth/password-api.ts + change-password.tsx — same treatment, so a throttle is not reported as a wrong current password (AC#5).

8. Tests. Jest carries #1, #2, #3, #5, #6, #7:
   - errors.test.ts — the mapping table's [429, 'client'] row becomes 'rateLimited'; new cases for Retry-After present/missing/unparseable and for the catalogue winning over the server's message.
   - client.test.ts — headers reach the error.
   - auth-api.test.ts — **replace** 'passes the throttle message through as a rejection'. It asserts a Spanish sentence the server does not send; it was written against an imagined ams and now encodes the Art. 5 bug.
   - login-screen.test.tsx, change-password.test.tsx, throttle-countdown.test.ts, strings.test.ts.

9. flows/kmo-13... no — flows/kmo-50-login-throttled.yaml carries #3 and #4 on a device: six failed logins with a **throwaway email**, then assert the Spanish message and that the submit is disabled.
   The throwaway email matters. ThrottleTokenIssuance keys on email + IP, so throttling employee@example.com would break shared/sign-in.yaml for a minute and take most of flows/ with it. A non-existent address gets its own bucket and counts failures the same way. The baseline IP limit is 100/min unauthenticated, so six requests do not come near it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Two design changes from the approved plan, both forced by problems found while building:

1. **The hook takes a deadline, not a duration.** The plan had useThrottleCountdown(seconds). That is wrong twice over. First, two consecutive refusals can name the same Retry-After, and keyed on the number the countdown would sit at zero with the submit control live — the employee could hammer the limiter that had just refused them. Keying on the refusal's object identity fixed that but introduced something worse: a caller building the object inline every render drives an infinite render loop. A deadline timestamp solves both — two deadlines a minute apart differ even for the same interval, and the remaining seconds are derived from the clock on each render, so there is no reset to get wrong and no way to loop. throttleDeadline() is exported for the screens to call once, where the refusal lands.

2. **No setState in the effect body.** The first version reset state inside useEffect and tripped react-hooks/set-state-in-effect, which is a real cascade-render rule rather than style. The derived-value design removed the need entirely.

Also replaced auth-api.test.ts's 'passes the throttle message through as a rejection'. It asserted `ams` sends 'Demasiados intentos de acceso…' in Spanish. It does not — KOL-8 throttles through Laravel's own ThrottleRequests, whose body is 'Too Many Attempts.'. The old test was written against an imagined server and encoded putting English in front of an employee.

Validation:
- npm run check green: typecheck, lint, format, 616 tests over 38 suites (52 new).
- bin/e2e kmo-50 passed, then passed again immediately. The repeat matters: the flow generates a fresh email per run via evalScript, because the limiter is keyed on email and decays over a minute — a fixed address would make a second run inside that minute start already throttled and never show the five credentials refusals it asserts first.
- Verified against a live `ams` carrying KOL-8: six failed logins for one email return 429 with body {"message":"Too Many Attempts."} and headers Retry-After: 59, X-RateLimit-Limit: 5, X-RateLimit-Remaining: 0. The device screenshot shows 'Demasiados intentos. Espera 45 segundos e inténtalo de nuevo.' with Ingresar dimmed and unpressable.

**Pre-existing E2E flake, not from this branch.** Full-suite runs fail 1-4 flows at random with 'Ingresar/Inicio is visible' — the app not reaching a screen after launch. The failing flow moves between runs and each passes when run alone. Confirmed unrelated by stashing this branch entirely and running the suite on master: 3/8 failed with the identical symptom and none of this code present. Restarting Metro and the AVD reduces it but does not remove it. Worth its own ticket; it is a launch/dev-client problem, not an app one.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A 429 is now its own ApiErrorKind with the server's Retry-After threaded through the client onto the error, so a screen can wait rather than retry.

The reason this was a bug rather than a polish item: ApiError.userMessage prefers the server's own message, and ams throttles through Laravel's middleware, whose body is the untranslated 'Too Many Attempts.'. A throttled employee was reading English on a Chilean attendance app. This is the one kind where the catalogue overrules the server, and it is safe because a 429 here is never a translated sentence — a Fortify-shaped throttle arrives as a 422 with errors.email instead.

The login and change-password screens count the wait down out loud and hold their submit control until it elapses, so the app cannot feed the limiter that just refused it. No retry button is offered: retry belongs to a lost connection, where pressing again is the right move. A throttled password change is reported as a throttle rather than as a wrong current password, which would have sent an employee hunting for a mistake they did not make.

Everything else on /api/v1 inherits the baseline limit and gets the generic Spanish sentence.
<!-- SECTION:FINAL_SUMMARY:END -->
