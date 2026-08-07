---
id: KMO-22
title: Connectivity detection and the pending-sync banner
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
updated_date: '2026-08-07 15:52'
labels:
  - mobile
  - offline
  - marcaje
milestone: m-0
dependencies:
  - KMO-17
  - KMO-21
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The home-screen banner that tells the employee, honestly, that some of their punches are not yet in the attendance book. Copy is fixed by the design; see docs/design-decisions.md §4.

The banner appears only when there are queued punches. Being offline with an empty queue is not something the employee needs told.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The app detects connectivity changes and exposes online/offline state to the punch flow
- [ ] #2 When queued punches exist a warning-tinted banner renders above the location card reading {n} marca esperando sincronizar in the singular and {n} marcas esperando sincronizar in the plural
- [ ] #3 The banner subtitle reads Aún no forman parte del libro de asistencia
- [ ] #4 A Sincronizar button on the banner triggers a flush attempt and shows progress
- [ ] #5 The banner disappears when the queue empties
- [ ] #6 No banner shows when the queue is empty, whether the device is online or offline
- [ ] #7 A flush attempt that fails leaves the queue intact and explains why in Spanish
- [ ] #8 There is no manual offline mode: the queue engages only on an actual failure to reach the server, never as a setting, a preference or a default (docs/design-decisions.md §4.6 — Res. 38 Art. 10 limits the exception to situaciones excepcionales, and a toggle would also hand the employee a way to choose their own timestamp)
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-08-07 15:52
---
KMO-21 is settled; §4.6 adds one criterion this ticket did not carry — no offline toggle. The banner stays the only offline affordance. #4 (Sincronizar) is unchanged but read it with KMO-23 #4: the automatic flush is the compliance mechanism, the button only accelerates it.
---
<!-- COMMENTS:END -->
