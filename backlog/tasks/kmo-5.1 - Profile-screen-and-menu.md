---
id: KMO-5.1
title: Profile screen and menu
status: To Do
assignee: []
created_date: '2026-07-30 14:38'
labels:
  - mobile
  - perfil
milestone: m-0
dependencies:
  - KMO-1.4
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
parent_task_id: KMO-5
priority: medium
type: feature
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The overlay that opens from the avatar button on every tab: identity header over a four-item menu.

Menu items are Mis datos, Notificaciones, Ayuda y soporte and Cerrar sesión, the last in the danger colour.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The screen opens as a full-screen overlay with a back chevron and the title Mi perfil
- [ ] #2 The identity header shows the initials avatar in the primary colour, the full name, and the position and premise as {position} · {premise}
- [ ] #3 The menu renders the four rows in a single card with dividers, Cerrar sesión in the danger colour
- [ ] #4 Each row navigates to its screen, and Cerrar sesión runs the sign-out flow from KMO-2.5
- [ ] #5 Notificaciones is present but shows a placeholder stating that preferences arrive with push notifications
- [ ] #6 Every row meets the 44px minimum hit target
<!-- AC:END -->
