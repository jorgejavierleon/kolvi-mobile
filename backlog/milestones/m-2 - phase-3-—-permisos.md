---
id: m-2
title: "Phase 3 — Permisos"
---

## Description

Listado de permisos, calendario, asistente de solicitud con días hábiles calculados en servidor y saldo de vacaciones, cancelación mientras esté pendiente, y notificación de la decisión.

### Permisos — list, calendar and request wizard

Leave requests without a desktop: the employee's own requests with their status and the approver's note, a month calendar of approved leave, and a three-step request wizard ending in a confirmation.

Per docs/design-decisions.md §7 the type list comes from the API and is never hardcoded, Licencia médica appears only in history, half-day is supported, dates are chosen with a calendar range picker, and business days are always computed server-side.

Refine into implementation-sized tasks before starting.
