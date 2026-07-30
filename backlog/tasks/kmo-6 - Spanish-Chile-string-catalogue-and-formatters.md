---
id: KMO-6
title: Spanish (Chile) string catalogue and formatters
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - foundation
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
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Res. 38 Art. 5 requires the platform and its manuals in Chilean Spanish. That makes a single string catalogue a compliance requirement rather than a nicety, and it must cover error messages and empty states, not just happy-path labels.

Domain vocabulary — leave types, workday statuses, document statuses — comes from the server as value/label pairs and is never re-translated in the app.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All app-authored user-facing text lives in one es-CL catalogue; no literal user-facing strings remain in components
- [ ] #2 The catalogue covers error messages, empty states, permission-denied states and loading states, not only primary labels
- [ ] #3 Date formatters produce the design formats: the long weekday-and-month header, the dd/mm/aa receipt date, and the hh:mm:ss receipt time with seconds
- [ ] #4 Weekday and month names are the Spanish forms used by the design, including the accented Miércoles and the lowercase month names
- [ ] #5 A RUT formatter renders the dotted format with the verifier digit, matching the receipt and profile
- [ ] #6 An hours formatter renders decimal hours as the design shows them in the week summary and history tiles
- [ ] #7 Domain labels received from the server are displayed verbatim and are never mapped through the catalogue
- [ ] #8 Tests cover each formatter including a midnight-crossing time and a RUT with a K verifier digit
<!-- AC:END -->
