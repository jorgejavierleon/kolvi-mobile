---
id: KMO-17
title: Punch action and the before/working/done state machine
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - marcaje
  - compliance
milestone: m-0
dependencies:
  - KMO-16
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The single most important interaction in the app. Goal G1 is time-to-punch under 10 seconds from app open at p90.

Per docs/design-decisions.md §2 there are exactly three states and one entrada and one salida per day. The server assigns the legal timestamp; the app does not send one for an online punch.

| State | Status line | Primary button |
|---|---|---|
| before | Aún no marcas entrada | Marcar entrada |
| working | En jornada | Marcar salida |
| done | Jornada finalizada | replaced by the success panel |
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The primary button is at least 64pt tall, full width, coral, with the display font, and shows a spinner in its loading state
- [ ] #2 The three states drive the status line and the primary label exactly as tabulated in the description
- [ ] #3 The done state replaces the punch button with the success panel reading Jornada finalizada and Nos vemos en tu próximo turno
- [ ] #4 The punch request carries no client-supplied timestamp; the server-assigned time is what the receipt displays
- [ ] #5 The reported latitude, longitude and accuracy are sent when available, and their absence is sent explicitly rather than omitted
- [ ] #6 The button cannot be double-tapped into two punches, including on a slow network
- [ ] #7 A server rejection because the punch already exists for today renders as a friendly Spanish state, never as an error dialog
- [ ] #8 A failed punch leaves the state unchanged and offers retry without the employee losing their place
- [ ] #9 The button remains legible and operable in direct sunlight and with gloves, verified on a physical mid-range Android
- [ ] #10 A successful punch transitions the state and opens the comprobante sheet built in KMO-19
<!-- AC:END -->
