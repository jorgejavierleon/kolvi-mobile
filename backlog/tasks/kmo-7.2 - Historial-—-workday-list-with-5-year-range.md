---
id: KMO-7.2
title: Historial — workday list with 5-year range
status: To Do
assignee: []
created_date: '2026-07-30 14:39'
labels:
  - mobile
  - jornada
  - compliance
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
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Days newest-first with a status badge and the Trabajado / Extra / Faltante tiles. Defaults to the current month and pages back through history; Res. 38 Art. 22.1 requires 5 years of access, so this is range-queryable and paginated rather than a fixed window. Status badges reuse the server badge tones so web and mobile agree. A day covered by an approved leave shows the leave type instead of hours.

PLACEHOLDER — captures scope only. Decompose into implementation-sized tasks with full acceptance criteria at Phase refinement, against the design file and the API contract as it then stands.
<!-- SECTION:DESCRIPTION:END -->
