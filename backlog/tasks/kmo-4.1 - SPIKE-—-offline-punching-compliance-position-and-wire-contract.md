---
id: KMO-4.1
title: SPIKE — offline punching compliance position and wire contract
status: To Do
assignee: []
created_date: '2026-07-30 14:37'
labels:
  - mobile
  - offline
  - compliance
  - spike
milestone: m-0
dependencies: []
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
  - docs/context/resolucion_38.txt
parent_task_id: KMO-4
priority: high
type: spike
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Blocking research task. Nothing in this epic is implemented until it is answered in writing.

Res. 38 Art. 9 requires automatic online transmission. That constrains a queue but does not forbid one — it forbids MANUAL transmission. Art. 8 and Art. 14a are about adulteration risk, which is precisely why a device clock must never become the legal timestamp.

The design already commits to the employee-facing behaviour (docs/design-decisions.md §4). What is unsettled is whether a queue is defensible at all, and exactly what the client and server exchange.

Cross-check every compliance claim against docs/context/resolucion_38.txt directly. Do not paraphrase the regulation from the PRD.

The output of this task is a written decision appended to docs/design-decisions.md, not code. If the answer is that a queue is not defensible, this epic moves out of Phase 1 and the remaining subtasks are closed — that is a valid and expected outcome.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A written position states whether an offline queue is defensible under Res. 38 Art. 9, citing the article text from docs/context/resolucion_38.txt, and is signed off by the compliance owner
- [ ] #2 The decision names which timestamp is legal and confirms the device reading is stored separately and never substituted
- [ ] #3 The wire contract for a queued punch is specified: the field carrying the device clock, the sync time, the idempotency key, and what the server returns
- [ ] #4 The maximum queue age is decided, along with what happens to a punch that exceeds it
- [ ] #5 The decision states whether an unsynced punch counts as registered for the purposes of the attendance book, and what the employee is told
- [ ] #6 The outcome is appended to docs/design-decisions.md §4 and the dependent subtasks are updated or closed to match
- [ ] #7 The corresponding backend work is raised in the ams repository
<!-- AC:END -->
