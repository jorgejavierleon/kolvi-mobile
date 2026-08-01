---
id: KMO-5
title: 'API client with auth, naive datetimes and error mapping'
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-01 23:34'
labels:
  - mobile
  - foundation
milestone: m-0
dependencies: []
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
One typed client for the /api/v1 surface, so no screen talks to fetch directly and error and session handling exist in exactly one place.

Datetimes on the wire are naive Santiago wall-clock strings in the format YYYY-MM-DD HH:mm:ss. The app must not convert them on input or display, and must not stamp a device timezone offset onto them. Getting this wrong silently shifts legal timestamps.

The backend /api/v1 endpoints are built in the ams repository and are an external prerequisite; build against the documented contract and stub what is not deployed yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A typed client wraps the base URL, attaches the Sanctum bearer token, sets JSON headers, and applies a request timeout
- [x] #2 Datetime values are parsed and formatted as naive Santiago wall-clock strings; no timezone conversion occurs anywhere in the client, verified by a test that a value survives a round trip unchanged
- [x] #3 Server validation errors map to field-level messages the UI can display, and the server message is preferred over any app-side text
- [x] #4 401 responses trigger the session-expiry path exactly once even when several requests fail concurrently
- [x] #5 Network failure and server error are distinguishable by callers so offline behaviour can branch on them
- [x] #6 All user-facing error text is Spanish (Chile) and comes from the string catalogue or the server
- [x] #7 Tests cover the naive-datetime round trip, the 401 path and the error mapping
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/api/config.ts — base URL from `process.env.EXPO_PUBLIC_API_URL` (Expo inlines EXPO_PUBLIC_* at build), the /api/v1 prefix, and the request timeout constant. Add .env.example documenting the var; .gitignore already excludes .env but keeps .env.example.
2. src/api/datetime.ts (+ .test.ts) — the naive wall-clock layer. Branded `NaiveDateTime` / `NaiveDate` / `NaiveTime` string types, `parseNaiveDateTime` to plain {year..second} parts and `formatNaiveDateTime` back, with zero use of `Date`, `toISOString` or `getTimezoneOffset` — a value cannot be converted because the code path that would convert it does not exist. Parsing rejects an offset-bearing or Z-suffixed value loudly rather than coercing it, so the known MarkResource toIso8601String bug surfaces as an error instead of a silent shift. Carries AC#2.
3. src/api/errors.ts (+ .test.ts) — `ApiError extends Error` with a `kind` discriminant: network | timeout | unauthorized | forbidden | notFound | validation | server | client | malformed. `fieldErrors` populated from Laravel's {message, errors:{field:[...]}} 422 shape, plus `messageFor(field)`. `userMessage` prefers the server's `message` and falls back to the es-CL catalogue, never to English or to a raw status code. Carries AC#3, #5, #6.
4. src/api/client.ts (+ .test.ts) — `createApiClient({ baseUrl, getToken, onSessionExpired, timeoutMs, fetch })` returning typed `request<T>` plus get/post/put/del. Attaches `Authorization: Bearer` from the injected token provider (KMO-9 owns where the token is stored, so the client only takes a getter), sets Accept/Content-Type JSON, aborts via AbortController + setTimeout. A one-shot latch makes `onSessionExpired` fire exactly once across concurrent 401s, reset by `resetSession()` when a new token is set. Also exports a module singleton `api` configured by `configureApi()`, so screens import `@/api` and never fetch. Carries AC#1, #4, #5.
5. src/api/index.ts — the public surface (`@/api`); everything above is imported through it.
6. src/i18n/index.ts — add an `errors` namespace (sin conexión, tiempo de espera agotado, sesión expirada, error del servidor, …) in es-CL, following KMO-4's precedent of adding only the copy this ticket needs and leaving the rest to KMO-6. Carries AC#6.

Validation tiers: every criterion here is logic with no rendered surface — no screen consumes the client until KMO-8/KMO-15 — so Jest carries all seven (AC#7 is the round-trip, concurrent-401 and error-mapping tests named above) and no Maestro flow is written; there would be nothing on screen for it to drive. Verified with `npm run check`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Moved the 'no timezone conversion anywhere in the client' half of AC#2 from a Jest source-scan into ESLint (`eslint.config.js`, `src/api/**` minus tests): `Date`, `Intl` and the ISO/locale formatters are banned there the same way raw hex is banned outside `src/theme`. The scan-as-a-test needed `@types/node`, which the repo does not carry, and a lint rule is the stronger guard anyway — it fails every commit rather than only when someone runs the suite. Verified the rule fires by temporarily adding `new Date().toISOString() + Date.now() + Intl.DateTimeFormat()` to config.ts: 4 errors, then reverted.

Errors are thrown as one `ApiError` carrying a `kind` discriminant rather than returned as a Result — idiomatic for the data-fetching layer the feature tickets will add, and it keeps the 401 latch in one place. `userMessage` prefers the server's `message` and falls back to `es.errors[kind]`; `Error.message` stays an English log line and is never what a screen shows.

Boundary with the auth tickets: the client takes an injected `getToken` and `onSessionExpired`, so KMO-9 owns SecureStore and KMO-11 owns clearing the session and routing to login. KMO-11 calls `resetSession()` when a new session starts to re-arm the one-shot latch.

Writing the caller-abort test found a real defect: the abort listener was attached after `await getToken()`, so a screen unmounting during the SecureStore read left the request running and uncancellable. The timer and the listener are now armed before the token lookup, and an abort during it throws before `fetch` is called — covered by 'cancels before the network when aborted while the token is being read'.

Validation: `npm run check` green — typecheck, lint, format:check and 229 Jest tests across 16 suites, of which 100 are the new src/api suites (client 26, errors 40, datetime 28, config 6). No Maestro flow: every criterion is transport logic and no screen consumes the client yet, so there is nothing on a device for a flow to drive. AC#6 is proven at the catalogue and client level — that error text on screen is Spanish becomes device-verifiable from KMO-8 onward, when a surface first renders it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the typed /api/v1 client under src/api: createApiClient (base URL, injected Sanctum bearer token, JSON headers, AbortController timeout, typed request/get/post/put/patch/del) plus the app-wide `api` singleton, so no screen calls fetch. Datetimes are handled as naive Santiago wall-clock strings by a module that never constructs a Date, with ESLint banning Date/Intl/ISO formatters across src/api. Failures land as one ApiError with a kind discriminant that separates a request that never reached the server (network, timeout) from one the server refused, maps Laravel's 422 bag to per-field messages, and prefers the server's Spanish message over the new es.errors catalogue entries. A one-shot latch fires the session-expiry callback exactly once across concurrent 401s. Verified with npm run check: typecheck, lint, format:check and 229 Jest tests green, 100 of them new — including the wall-clock round trip through a full request (DST-gap and DST-ambiguous readings), three concurrent 401s producing one expiry, and the 422 field mapping.
<!-- SECTION:FINAL_SUMMARY:END -->
