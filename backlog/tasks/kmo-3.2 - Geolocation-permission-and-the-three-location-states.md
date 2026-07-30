---
id: KMO-3.2
title: Geolocation permission and the three location states
status: To Do
assignee: []
created_date: '2026-07-30 14:36'
labels:
  - mobile
  - marcaje
  - geo
milestone: m-0
dependencies:
  - KMO-3.1
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
parent_task_id: KMO-3
priority: high
type: feature
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The location card sits above the shift card and tells the employee, before they tap, whether they can punch. The three states and their exact copy are in docs/design-decisions.md §2.

The client evaluation is advisory only — the server decides authoritatively whether a punch was inside the geofence. The app must never treat its own distance calculation as the answer.

An employee who permanently denies location permission must still be able to punch. Otherwise attendance becomes unrecordable, which is a legal problem rather than a product one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Location permission is requested with a Spanish rationale explaining why attendance needs it, before the system prompt
- [ ] #2 Confirmed state renders on the success tint with Ubicación confirmada and the subtitle naming the premise and the distance in metres
- [ ] #3 Out-of-range state renders on the warning tint with Fuera del rango permitido and the subtitle Debes estar dentro de {premise} para marcar
- [ ] #4 No-signal state renders on the danger tint with Sin señal de GPS and the subtitle Activa tu ubicación para poder marcar
- [ ] #5 Each state shows its own icon from the design and pairs colour with text, never colour alone
- [ ] #6 A premise with no geofence radius configured does not show an out-of-range state and does not block punching
- [ ] #7 Permission permanently denied still allows punching, with the punch reported as having no location fix rather than being blocked
- [ ] #8 Permission permanently denied offers a route to the OS settings
- [ ] #9 Location acquisition has a timeout that resolves to the no-signal state rather than hanging the screen
- [ ] #10 Location is requested only while the Marcaje tab is in view; the app never tracks location in the background
<!-- AC:END -->
