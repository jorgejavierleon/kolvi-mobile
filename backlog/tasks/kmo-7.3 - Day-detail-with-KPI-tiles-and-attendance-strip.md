---
id: KMO-7.3
title: Day detail with KPI tiles and attendance strip
status: To Do
assignee: []
created_date: '2026-07-30 14:39'
labels:
  - mobile
  - jornada
milestone: m-1
dependencies: []
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
parent_task_id: KMO-7
priority: medium
type: feature
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Full-screen detail with four KPI tiles — worked, extra, missing, in-out — and a strip plotting the punches against the scheduled window. Per docs/design-decisions.md §6 the strip axis is derived from the shift, not the mockup fixed 08:00-18:00, so night shifts and shifts crossing midnight render correctly. Each punch links to its comprobante.

PLACEHOLDER — captures scope only. Decompose into implementation-sized tasks with full acceptance criteria at Phase refinement, against the design file and the API contract as it then stands.
<!-- SECTION:DESCRIPTION:END -->
