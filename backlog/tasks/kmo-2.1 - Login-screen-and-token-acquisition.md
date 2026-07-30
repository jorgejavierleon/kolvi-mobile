---
id: KMO-2.1
title: Login screen and token acquisition
status: To Do
assignee: []
created_date: '2026-07-30 14:34'
labels:
  - mobile
  - auth
milestone: m-0
dependencies:
  - KMO-1.5
  - KMO-1.6
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
parent_task_id: KMO-2
priority: high
type: feature
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The employee signs in with the credentials they already use on the web app. POST /api/sanctum/token takes email, password and device_name and returns a token; it rejects wrong credentials and inactive users.

The design has no login screen, so this is composed from the design system primitives following the visual language of the designed surfaces.

The app must gate features on the permissions the API reports for the user, never on the role name and never on hardcoded assumptions. An admin who also punches gets a working Marcaje tab and empty-or-hidden states elsewhere rather than errors.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A login screen collects email and password, styled with the design tokens and primitives
- [ ] #2 A stable device_name identifying this installation is generated once and reused across logins
- [ ] #3 Successful login stores the token and lands the user on the Marcaje tab
- [ ] #4 Wrong credentials and the inactive-user rejection each show a distinct Spanish message from the server, not a generic failure
- [ ] #5 Network failure during login is distinguishable from a credential rejection and offers a retry
- [ ] #6 The submit control shows a loading state and cannot be double-submitted
- [ ] #7 The password field masks input and offers a reveal toggle
- [ ] #8 The permissions reported for the user are stored and exposed to the app, and features gate on them rather than on the role name
<!-- AC:END -->
