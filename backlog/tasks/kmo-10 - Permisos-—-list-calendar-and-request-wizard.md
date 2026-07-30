---
id: KMO-10
title: 'Permisos — list, calendar and request wizard'
status: To Do
assignee: []
created_date: '2026-07-30 14:32'
labels:
  - mobile
  - permisos
milestone: m-2
dependencies:
  - KMO-1
  - KMO-2
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Leave requests without a desktop: the employee's own requests with their status and the approver's note, a month calendar of approved leave, and a three-step request wizard ending in a confirmation.

Per docs/design-decisions.md §7 the type list comes from the API and is never hardcoded, Licencia médica appears only in history, half-day is supported, dates are chosen with a calendar range picker, and business days are always computed server-side.

Refine into implementation-sized subtasks before starting.
<!-- SECTION:DESCRIPTION:END -->
