---
id: KMO-4
title: Navigation shell with the four-tab bar
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - foundation
milestone: m-0
dependencies:
  - KMO-3
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The persistent chrome: a bottom tab bar with Inicio, Jornada, Permisos and Documentos, plus the profile surface that opens over any tab from the avatar button in the header.

Jornada and Documentos carry a coral count badge for pending mark corrections and pending signatures respectively.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Four tabs render with the design icons and labels Inicio, Jornada, Permisos, Documentos; the active tab uses the primary colour and inactive tabs the muted colour
- [ ] #2 Tab bar sits on a white surface with the border-top from the design and respects the device safe area
- [ ] #3 Jornada and Documentos tab items render a coral count badge when their pending count is greater than zero, and no badge when it is zero
- [ ] #4 The avatar button in each tab header opens the profile surface as a full-screen overlay with a back affordance, over any tab
- [ ] #5 Tab state and per-tab scroll position survive switching tabs and returning
- [ ] #6 Screen-reader users hear the tab name and the pending count when a badge is present
<!-- AC:END -->
