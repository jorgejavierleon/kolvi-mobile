---
id: KMO-3.1
title: 'Home screen shell — greeting, shift card, clock and week summary'
status: To Do
assignee: []
created_date: '2026-07-30 14:36'
labels:
  - mobile
  - marcaje
milestone: m-0
dependencies:
  - KMO-1.4
  - KMO-1.5
  - KMO-1.6
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
parent_task_id: KMO-3
priority: high
type: feature
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Marcaje tab above the punch button, rendered from a single GET /api/v1/me/today call so the screen costs one request per app open rather than five. That endpoint is an external prerequisite in the ams repository.

Per docs/design-decisions.md §2 the colación row is read-only and labelled Colación (informativo) — there are no break punch buttons in this app.

Layout from the design, top to bottom: date and Hola {first_name} with the avatar button; the geolocation card (KMO-3.2); the shift card; the live clock and status line; the punch button (KMO-3.3); the week summary.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The header shows the capitalised long date and Hola, {first_name} with the avatar button opening the profile
- [ ] #2 The shift card shows the eyebrow Turno de hoy, the premise name, the scheduled window as start – end, and a divided row reading Colación (informativo) with the scheduled lunch window
- [ ] #3 The clock renders the current time as hh:mm and updates at least every 30 seconds without re-rendering the whole screen
- [ ] #4 The status line under the clock reads the state text for the current punch state, per the state machine in KMO-3.3
- [ ] #5 The week summary renders as {worked} / {total} hrs esta semana using the contracted weekly hours as the denominator
- [ ] #6 The whole screen renders from one GET /api/v1/me/today response
- [ ] #7 An employee with no shift scheduled today sees an explicit Spanish empty state instead of a blank or zeroed shift card
- [ ] #8 A user without the ClockOwn:Mark permission does not see the punch surface, and an admin who also punches sees a working tab
- [ ] #9 Loading shows skeletons rather than a spinner over an empty screen, and a failed load offers retry without losing the tab
<!-- AC:END -->
