---
id: KMO-1.2
title: Port the Kolvi design tokens into a typed theme
status: To Do
assignee: []
created_date: '2026-07-30 14:33'
labels:
  - mobile
  - foundation
milestone: m-0
dependencies: []
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
parent_task_id: KMO-1
priority: high
type: feature
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design ships a token-based system that the app adopts rather than re-derives. Per the design-system decision the employee app does NOT share the admin console theme, so these tokens are the single source of truth for the app.

Source files in the design project under _ds/kolvi-design-system-6b0e16fe-306c-4d78-bc48-383a8012a48e/tokens/ (colors, typography, spacing, radius, shadows) plus styles.css. The token values are reproduced in the Design system tokens section of docs/design-decisions.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A theme module exports colors, typography, spacing, radius and shadows matching the token files exactly; hex values are not duplicated anywhere else in the codebase
- [ ] #2 Semantic tones success, warning, danger and neutral are exposed as background/foreground pairs and are the only way status colour is applied
- [ ] #3 The Sora and Plus Jakarta Sans font families are bundled and load before first paint; headlines use weight 700 and UI emphasis 600, not the boldest cuts
- [ ] #4 Typography presets exist for display, h1, h2, h3, body-lg, body, label, caption and eyebrow with the sizes and line heights from the token file
- [ ] #5 Spacing follows the 8px grid and a hit-target-min of 44px is exported for reuse
- [ ] #6 The theme is typed so an unknown token name is a compile error
- [ ] #7 A lint rule or documented convention prevents raw hex colours and raw font sizes in feature code
<!-- AC:END -->
