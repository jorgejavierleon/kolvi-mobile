---
id: KMO-50
title: Handle 429 and back off when the server throttles
status: To Do
assignee: []
created_date: '2026-08-03 22:20'
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
`ams` KOL-8 puts rate limits on the mobile API — `POST /api/v1/tokens` keyed on email + IP, `PUT /api/v1/user/password` per authenticated user, and a baseline limit on every other route. Once it ships, any request in this app can come back 429, and today none of them handle it.

### What the app does with a 429 right now

Nothing deliberate. `kindForStatus` in `src/api/errors.ts` has cases for 401, 403, 404, 419 and 422 and falls through to `status >= 500 ? 'server' : 'client'` for everything else — so a 429 becomes kind `client` and the employee reads *'No pudimos completar la solicitud.'*. That sentence is wrong in the way that matters: it does not say the request was refused for being too frequent, gives no idea how long to wait, and invites an immediate retry into the same limiter.

### Retry-After is not reachable yet

`errorFromResponse(status, body)` is called with the status and the parsed body and nothing else — `src/api/client.ts` never passes the response headers. Backing off for the interval the server names means threading headers through to `ApiError`, which is a change to the shared client every feature already depends on.

### The Spanish has to come from the catalogue, not the server

This is the exception to the app's usual rule. Laravel's `ThrottleRequests` answers `{"message": "Too Many Attempts."}` — untranslated, the same problem as the guard's `Unauthenticated.` that forced `es.auth.sessionExpired` to be written here in KMO-11. Res. 38 Art. 5 has no exception for a sentence that arrived over HTTP.

But it depends on which limiter KOL-8 uses. A Fortify-shaped limiter throws a ValidationException carrying `lang/es/auth.php`'s `throttle` string — *'Demasiados intentos de acceso. Por favor, inténtelo de nuevo en :seconds segundos.'* — under `errors.email`, which the login screen would render verbatim and correctly. Handle both: use the server's Spanish sentence when there is one, and fall back to the catalogue when the body is Laravel's English default.

### Where it shows

Login is the surface an employee will actually hit — a mistyped password at shift start, repeated. The change-password screen (KMO-13) is the other credential-checking route KOL-8 limits. Everything else inherits the baseline limit and needs only the generic message rather than its own treatment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A 429 maps to its own ApiErrorKind rather than falling through to the generic client failure
- [ ] #2 The Retry-After header reaches the caller, so a screen can say how long to wait and can back off rather than retry immediately
- [ ] #3 A throttled login shows a Spanish message naming the wait, using the server's own sentence when it sends one and the catalogue when the body is Laravel's untranslated default
- [ ] #4 The submit control on a throttled screen stays unavailable until the Retry-After interval has passed, so the app cannot hammer the limiter it just hit
- [ ] #5 A throttled change-password attempt (KMO-13) is reported the same way rather than as a wrong current password
- [ ] #6 A 429 on any other request surfaces the generic Spanish too-many-requests message rather than a generic failure
- [ ] #7 Jest covers the status mapping, the Retry-After parsing including a missing or unparseable header, and both the server-sentence and catalogue-fallback paths
<!-- AC:END -->
