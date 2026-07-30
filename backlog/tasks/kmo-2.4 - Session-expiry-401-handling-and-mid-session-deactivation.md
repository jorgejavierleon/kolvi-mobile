---
id: KMO-2.4
title: 'Session expiry, 401 handling and mid-session deactivation'
status: To Do
assignee: []
created_date: '2026-07-30 14:35'
labels:
  - mobile
  - auth
milestone: m-0
dependencies:
  - KMO-2.2
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
parent_task_id: KMO-2
priority: high
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A 401 arriving in the middle of a punch must not lose the punch. An employee deactivated while holding a token must lose access at the next request, not at the next login.

This is the path that decides whether a token problem is an inconvenience or a lost attendance record.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A 401 on any request clears the stored token and routes to login with a Spanish explanation that the session expired
- [ ] #2 A 401 during a punch attempt preserves the punch intent, so that after re-authenticating the employee is not silently left unmarked
- [ ] #3 Concurrent 401s produce exactly one session-expiry transition and one login prompt
- [ ] #4 A user deactivated mid-session is signed out at the next request rather than continuing with a working token
- [ ] #5 Signing out from an expired session leaves no employee data readable in the app
<!-- AC:END -->
