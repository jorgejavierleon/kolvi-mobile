---
id: KMO-3
title: 'Marcaje — home screen, geolocation and punch'
status: To Do
assignee: []
created_date: '2026-07-30 14:31'
labels:
  - mobile
  - marcaje
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
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The reason the app exists. The employee opens the app and registers an entrada or salida in under 10 seconds, with geolocation evidence and a receipt that satisfies Res. 38 Art. 13.

Covers the home tab (greeting, geolocation card, today's shift with the informational colación row, live clock, punch button, week summary), the three geolocation states, the punch state machine before → working → done, and the comprobante bottom sheet.

Per docs/design-decisions.md §2: no colación punches, one entrada and one salida per day, out-of-range punches are recorded and flagged rather than blocked, and the server assigns the timestamp.
<!-- SECTION:DESCRIPTION:END -->
