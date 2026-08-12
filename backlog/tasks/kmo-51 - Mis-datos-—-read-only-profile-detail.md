---
id: KMO-51
title: Mis datos — read-only profile detail
status: To Do
assignee: []
created_date: '2026-08-12 01:16'
updated_date: '2026-08-12 01:21'
labels:
  - mobile
  - perfil
milestone: m-0
dependencies:
  - KMO-25
priority: medium
type: feature
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The employee reads their own record on the phone; correcting it happens on the web app now, not here. This reverses KMO-26's editable subset (personal email, phone, emergency contact) — see docs/design-decisions.md §9 for why. Fills in src/app/mis-datos.tsx, which KMO-25 shipped as a placeholder route specifically for this screen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Read-only fields show name, formatted RUT, corporate email, personal email, phone, position, premise, supervisor and contract start date
- [ ] #2 A field the server does not return is omitted rather than shown blank or as a placeholder
- [ ] #3 An employee with no personal email set sees an explicit prompt explaining that receipts and verification codes are sent there
- [ ] #4 No editable fields, save action, form controls or link to the web app appear on the screen
<!-- AC:END -->
