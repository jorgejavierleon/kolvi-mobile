---
id: KMO-2.5
title: Sign out with server-side token revocation
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
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cerrar sesión in the profile menu. Clearing local storage is not sign-out: the token stays valid on the server and a lost phone stays authorised. The revocation endpoint is a prerequisite in the ams repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Cerrar sesión revokes the device token server-side before clearing local state
- [ ] #2 The action asks for confirmation, since an offline queue with unsynced punches would be lost
- [ ] #3 Sign-out with unsynced offline punches warns explicitly about what will be lost and requires a deliberate confirmation
- [ ] #4 Revocation failing due to no connectivity still clears local state, and the app explains that the token stays active until the device reconnects
- [ ] #5 After sign-out the app returns to login and no cached employee data is readable
<!-- AC:END -->
