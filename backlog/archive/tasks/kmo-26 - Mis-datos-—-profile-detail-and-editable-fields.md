---
id: KMO-26
title: Mis datos — profile detail and editable fields
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - perfil
milestone: m-0
dependencies:
  - KMO-25
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The employee reads their own record and corrects the few fields that are genuinely theirs to correct.

Personal email matters beyond convenience: the Art. 12 receipt email and the document verification code both go to personal_email when it is set, so an employee without one silently misses both. Prompting for it is worth doing well.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Read-only fields show name, formatted RUT, corporate email, personal email, phone, position, premise, supervisor and contract start date
- [ ] #2 Personal email, phone and emergency contact are editable and persist to the server
- [ ] #3 Validation errors return as field-level Spanish messages from the server
- [ ] #4 An employee with no personal email set sees an explicit prompt explaining that receipts and verification codes are sent there
- [ ] #5 A field the server does not return is omitted rather than shown blank or as a placeholder
- [ ] #6 Unsaved edits prompt before the employee navigates away
<!-- AC:END -->
