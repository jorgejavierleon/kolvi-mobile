---
id: m-1
title: "Phase 2 — Jornada"
---

## Description

Próximos turnos, historial de jornadas con rango de 5 años, detalle del día, y revisión de correcciones de marca con notificaciones push.

### Jornada — upcoming shifts, workday history and day detail

Turns the app from a punch clock into the employee's own record of their hours, so they stop asking HR 'how many hours did I work?'.

Two sub-tabs behind a segmented control — Próximos and Historial — plus a full-screen day detail with KPI tiles and an attendance strip.

Res. 38 Art. 22.1 requires permanent, unrestricted access to 5 years of history, so the history is range-queryable and paginated, never a fixed window.

Refine into implementation-sized tasks before starting: the tasks in this milestone are placeholders that capture scope, not finished tickets.

### Mark-correction review

Admins request corrections to an employee's marks, and the employee approves or declines them inside a time-boxed window before they expire. If mobile is the employee's primary channel and this is missing, corrections expire unnoticed — a real harm, not a missing nicety.

The design places the correction card on the Jornada tab, visible from either sub-tab, with a coral count badge on the tab-bar item.

Refine into implementation-sized tasks before starting.

### Push notifications

Nothing exists today; every notification is mail. Needed for the three moments where the employee must act and cannot be expected to poll: a document awaiting their signature, a leave decision, and a mark correction with an expiry window.

Covers device-token registration, permission handling, deep links into the right screen, and wiring the Notificaciones preference screen stubbed in KMO-25.

Refine into implementation-sized tasks before starting.
