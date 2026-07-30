---
id: KMO-3
title: Build the shared UI primitives the design repeats
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - foundation
milestone: m-0
dependencies:
  - KMO-2
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design reuses a small set of shapes across all four tabs. Building them once keeps the app visually coherent and makes each feature task an assembly job.

Read the design file to derive exact paddings, radii and shadows rather than approximating them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Button supports primary, secondary/outline and danger-outline variants, a loading state with the spinner, and a disabled state that dims rather than hides
- [ ] #2 Card renders the white surface with radius-lg and shadow-1 used by the shift, history and document rows
- [ ] #3 StatusBadge takes a semantic tone and a label, renders as a pill, and always pairs colour with text so status is never encoded by colour alone
- [ ] #4 SegmentedControl renders the two-option control used by Jornada and Permisos, with the selected segment styled per the design
- [ ] #5 BottomSheet presents over a scrim with the slide-up animation, a scrollable body and a pinned footer action, and dismisses on backdrop press
- [ ] #6 TileRow renders the label-over-value tiles used for Trabajado / Extra / Faltante
- [ ] #7 Every interactive primitive meets the 44px minimum hit target and exposes an accessibility label
- [ ] #8 Primitives render correctly at the largest OS font-scale setting without clipping
<!-- AC:END -->
