---
id: KMO-4
title: Offline punch queue
status: To Do
assignee: []
created_date: '2026-07-30 14:31'
labels:
  - mobile
  - marcaje
  - offline
  - compliance
milestone: m-0
dependencies: []
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An attendance app that cannot record a punch without signal will be worked around, and the workaround is a paper book. Warehouses, basements and cold rooms are exactly where Kolvi's employees work.

A punch attempted offline is written to a durable local queue and acknowledged with a visually distinct receipt that is honest about not yet being in the attendance book. The queue flushes in order on reconnect, with idempotency keys so a retry cannot double-punch.

This is the highest-risk item in the PRD (§7.3). The compliance position and the wire contract are settled by a blocking spike before any implementation task starts.
<!-- SECTION:DESCRIPTION:END -->
