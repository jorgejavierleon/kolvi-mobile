---
id: KMO-41
title: 'Request wizard — type, dates, review, submit'
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - permisos
milestone: m-2
dependencies:
  - KMO-4
  - KMO-9
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three steps ending in a confirmation. Per docs/design-decisions.md §7: the type list comes from the API and is never hardcoded, Licencia médica is absent from the wizard, half-day with mañana/tarde is supported and always counts 0.5 days on a single day, dates are chosen with a calendar range picker rather than a day stepper, and the business-day count shown in the review step is computed server-side. The vacation balance is visible before submit so the employee sees they are over their allowance before asking.

PLACEHOLDER — captures scope only. Decompose into implementation-sized tasks with full acceptance criteria at Phase refinement, against the design file and the API contract as it then stands.
<!-- SECTION:DESCRIPTION:END -->
