---
id: KMO-19
title: Comprobante bottom sheet
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - marcaje
  - compliance
milestone: m-0
dependencies:
  - KMO-17
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The receipt the employee sees immediately after punching. Res. 38 Art. 13 sets the minimum content: date, time, name, RUT and hash, with geolocation optional. Art. 12 covers the emailed copy, which the server sends.

The receipt is generated from the API response, never from client-side state — the server recorded time is the truth. Per docs/design-decisions.md §3 the folio is real, formatted YYYYMMDD-NNNN.

The hash is copyable so the employee can verify it against the public validation endpoint.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The sheet opens from the bottom over a scrim with the slide-up animation and a pinned Listo button that dismisses it
- [ ] #2 The headline reads ¡Marca registrada! over a success check icon on the success tint
- [ ] #3 The detail block lists Tipo, Fecha, Hora, Trabajador, RUT and N° comprobante with the values from the API response
- [ ] #4 The date renders as dd/mm/aa and the time includes seconds, per Art. 13
- [ ] #5 The SHA-256 hash renders in monospace under the label Hash de verificación (SHA-256), wrapping rather than truncating
- [ ] #6 A Copiar button copies the hash to the clipboard and confirms by changing its own label
- [ ] #7 An out-of-range punch adds the line Marca fuera de rango — pendiente de revisión in the warning colour
- [ ] #8 The legal note is always present: Este registro forma parte del libro de asistencia electrónico (Resolución 38 de la Dirección del Trabajo)
- [ ] #9 No value on the sheet is derived from client-side state or the device clock
- [ ] #10 The sheet body scrolls independently when the content exceeds the sheet height at large font scales
<!-- AC:END -->
