---
id: KMO-6.1
title: Accessibility and field-conditions pass
status: To Do
assignee: []
created_date: '2026-07-30 14:38'
labels:
  - mobile
  - a11y
  - release
milestone: m-0
dependencies:
  - KMO-3.5
  - KMO-5.1
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
parent_task_id: KMO-6
priority: high
type: chore
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The employees this app is built for use low-to-mid Android phones, often outdoors, often with gloves, often one-handed. Accessibility here is not a checkbox — it decides whether the punch happens.

This is a review-and-fix pass across the Phase 1 surfaces, not new feature work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every interactive control meets the 44x44pt minimum touch target
- [ ] #2 Every icon-only control has a Spanish screen-reader label, and the app is navigable end to end with a screen reader to complete a punch
- [ ] #3 No status is conveyed by colour alone anywhere; every badge and state card pairs colour with text
- [ ] #4 All Phase 1 screens render without clipping or overlap at the largest OS font-scale setting
- [ ] #5 Text and interactive elements meet WCAG AA contrast, with the coral primary button on white explicitly verified
- [ ] #6 The punch button is confirmed usable in direct sunlight, with gloves, one-handed, on a physical mid-range Android
- [ ] #7 Cold start to a usable punch button is under 3 seconds on a mid-range Android
<!-- AC:END -->
