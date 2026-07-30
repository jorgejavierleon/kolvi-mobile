---
id: KMO-1.5
title: 'API client with auth, naive datetimes and error mapping'
status: To Do
assignee: []
created_date: '2026-07-30 14:33'
labels:
  - mobile
  - foundation
milestone: m-0
dependencies: []
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
parent_task_id: KMO-1
priority: high
type: feature
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
One typed client for the /api/v1 surface, so no screen talks to fetch directly and error and session handling exist in exactly one place.

Datetimes on the wire are naive Santiago wall-clock strings in the format YYYY-MM-DD HH:mm:ss. The app must not convert them on input or display, and must not stamp a device timezone offset onto them. Getting this wrong silently shifts legal timestamps.

The backend /api/v1 endpoints are built in the ams repository and are an external prerequisite; build against the documented contract and stub what is not deployed yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A typed client wraps the base URL, attaches the Sanctum bearer token, sets JSON headers, and applies a request timeout
- [ ] #2 Datetime values are parsed and formatted as naive Santiago wall-clock strings; no timezone conversion occurs anywhere in the client, verified by a test that a value survives a round trip unchanged
- [ ] #3 Server validation errors map to field-level messages the UI can display, and the server message is preferred over any app-side text
- [ ] #4 401 responses trigger the session-expiry path exactly once even when several requests fail concurrently
- [ ] #5 Network failure and server error are distinguishable by callers so offline behaviour can branch on them
- [ ] #6 All user-facing error text is Spanish (Chile) and comes from the string catalogue or the server
- [ ] #7 Tests cover the naive-datetime round trip, the 401 path and the error mapping
<!-- AC:END -->
