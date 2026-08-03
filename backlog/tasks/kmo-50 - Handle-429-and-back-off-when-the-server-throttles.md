---
id: KMO-50
title: Handle 429 and back off when the server throttles
status: To Do
assignee: []
created_date: '2026-08-03 22:20'
updated_date: '2026-08-03 23:00'
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
- [ ] #1 A 429 maps to its own ApiErrorKind rather than falling through to the generic client failure
- [ ] #2 The Retry-After header reaches the caller, so a screen can say how long to wait and can back off rather than retry immediately
- [ ] #3 A throttled request shows a Spanish message from the catalogue naming the wait; the server's untranslated 'Too Many Attempts.' is never rendered, on any screen
- [ ] #4 The submit control on a throttled screen stays unavailable until the Retry-After interval has passed, so the app cannot hammer the limiter it just hit
- [ ] #5 A throttled change-password attempt (KMO-13) is reported as a throttle rather than as a wrong current password
- [ ] #6 A 429 on any other request surfaces the generic Spanish too-many-requests message rather than a generic failure
- [ ] #7 Jest covers the status mapping, the Retry-After parsing including a missing or unparseable header, and that no server-supplied 429 message reaches the screen
<!-- AC:END -->
