---
id: KMO-3.4
title: Out-of-range override and GPS retry
status: To Do
assignee: []
created_date: '2026-07-30 14:36'
labels:
  - mobile
  - marcaje
  - geo
  - compliance
milestone: m-0
dependencies:
  - KMO-3.3
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
parent_task_id: KMO-3
priority: high
type: feature
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The escape hatches beneath the primary button. Per docs/design-decisions.md §2 an out-of-range punch is recorded and flagged, never blocked — refusing to record a punch an employee actually made is worse than recording a suspect one, and Res. 38 treats the register as the legal record.

The override is deliberately worded so the employee knows the punch will be reviewed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In the out-of-range state the primary button is disabled and a secondary button reads Marcar de todas formas (queda pendiente de revisión)
- [ ] #2 The override records a real punch that the server flags as out of range, and the resulting receipt shows the pending-review line
- [ ] #3 In the no-signal state the primary button is disabled and a secondary button reads Reintentar ubicación
- [ ] #4 Retry re-acquires the location and updates the card, showing a loading state while it works
- [ ] #5 A retry that succeeds into the confirmed state enables the primary button without requiring a screen reload
- [ ] #6 Neither secondary button appears in the confirmed state
- [ ] #7 Both secondary buttons meet the 44px minimum hit target
<!-- AC:END -->
