---
id: KMO-2.6
title: Change password
status: To Do
assignee: []
created_date: '2026-07-30 14:35'
labels:
  - mobile
  - auth
  - compliance
milestone: m-0
dependencies:
  - KMO-2.2
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
parent_task_id: KMO-2
priority: high
type: feature
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Res. 38 Art. 7f requires the worker to be able to change their own password, with an automatic confirmation email. This is a compliance checklist item, not a convenience feature. Reached from Mi perfil.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A change-password screen collects the current password and the new password with confirmation
- [ ] #2 Server-side validation errors, including a wrong current password and a password failing policy, display as field-level Spanish messages
- [ ] #3 A successful change confirms in-app and states that a confirmation email has been sent
- [ ] #4 The session remains valid after the change, or the app re-authenticates cleanly if the server revokes tokens
- [ ] #5 The screen is reachable from Mi perfil
<!-- AC:END -->
