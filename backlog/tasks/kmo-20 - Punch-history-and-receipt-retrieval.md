---
id: KMO-20
title: Punch history and receipt retrieval
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - marcaje
  - compliance
milestone: m-0
dependencies:
  - KMO-19
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Res. 38 Art. 22.1 requires the worker to have permanent and unrestricted access to their history. Phase 1 covers the recent punches available from GET /api/marks; the full five-year workday history arrives with the Jornada epic in Phase 2.

The employee must be able to retrieve any past receipt, not only the one shown at punch time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The recent punches are listed newest first with type, date and time
- [ ] #2 Tapping a punch opens the same comprobante sheet built in KMO-19, populated from the stored mark
- [ ] #3 A retrieved receipt shows the same folio and hash as when the punch was made
- [ ] #4 An employee with no punches yet sees a Spanish empty state
- [ ] #5 The list is reachable from the Marcaje tab without leaving the tab context
<!-- AC:END -->
