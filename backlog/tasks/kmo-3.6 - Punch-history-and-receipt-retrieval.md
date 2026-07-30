---
id: KMO-3.6
title: Punch history and receipt retrieval
status: To Do
assignee: []
created_date: '2026-07-30 14:36'
labels:
  - mobile
  - marcaje
  - compliance
milestone: m-0
dependencies:
  - KMO-3.5
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
parent_task_id: KMO-3
priority: medium
type: feature
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Res. 38 Art. 22.1 requires the worker to have permanent and unrestricted access to their history. Phase 1 covers the recent punches available from GET /api/marks; the full five-year workday history arrives with the Jornada epic in Phase 2.

The employee must be able to retrieve any past receipt, not only the one shown at punch time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The recent punches are listed newest first with type, date and time
- [ ] #2 Tapping a punch opens the same comprobante sheet built in KMO-3.5, populated from the stored mark
- [ ] #3 A retrieved receipt shows the same folio and hash as when the punch was made
- [ ] #4 An employee with no punches yet sees a Spanish empty state
- [ ] #5 The list is reachable from the Marcaje tab without leaving the tab context
<!-- AC:END -->
