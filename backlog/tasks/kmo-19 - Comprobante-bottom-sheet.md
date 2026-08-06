---
id: KMO-19
title: Comprobante bottom sheet
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
updated_date: '2026-08-06 02:48'
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

The hash is copyable so the employee can keep or quote it — for HR, or against the emailed copy. It is deliberately **not** presented as something they can verify themselves: `ams` has a checksum validation tool but it lives in the DT inspector portal, behind authentication, and no public route exists. The button copies; the copy around it must not promise more than that.
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**KMO-17 #10 is owed here, and it is the only criterion of that ticket left open.** It reads: *"A successful punch transitions the state and opens the comprobante sheet built in KMO-19."* KMO-17 could not close it — the sheet is this ticket's, and this ticket depends on that one — so it was left unchecked deliberately rather than signed off on a seam.

Everything the sheet needs is already built and tested:

- `src/features/marcaje/use-punch.ts` takes an **`onPunched(receipt: PunchReceipt)`** callback and calls it with the parsed 201, and also keeps the last receipt on `punch.receipt`. `use-punch.test.ts` covers both. Nothing is wired to it yet — `home-screen.tsx` passes `onAlreadyMarked` but no `onPunched`, which is the one line this ticket adds.
- `src/features/marcaje/punch-api.ts` defines `PunchReceipt` — `markId`, `type`, `datetime` (naive Santiago wall-clock), `hash`, `geoStatus`. That is what `ams` returns today, verified against the live endpoint after KOL-34.

Two things to know before building the detail block:

- **`ams` does not yet send the Art. 13 fields.** `MarkResource` returns `mark_id`, `hash`, `datetime`, `type` and `geo_status` and nothing else — no worker name, no RUT, and **no folio**. This ticket's #3, #4 and its `N° comprobante` row need those on the wire first, and KOL-34 deliberately scoped them out (PRD §420 item 4; the folio is its own decision, D-F2-a, `YYYYMMDD-NNNN`). That is a companion `ams` ticket nobody has written yet.
- **#7's out-of-range line reads `geoStatus`**, which the receipt already carries and the server already decides — `'outside'` is what puts `Marca fuera de rango — pendiente de revisión` on the sheet. That half needs no backend work.

When this ships, verify KMO-17 #10 on the device — punch, and watch the sheet come up from the receipt — and check it on KMO-17 rather than here.

**The `ams` side is tracked as KOL-35** — "Complete the mark receipt for Res. 38 Art. 13: a real folio and the worker identity on MarkResource", HIGH, depends on KOL-34. It adds `folio`, `employee_name` and `employee_rut` to the 201 body.

Correcting one thing in the note above it: the Art. 13 identity is **not** missing from `ams`, only from the response. `MarkObserver::creating` already snapshots `employee_name`, `employee_rut`, `employer_name` and `employer_rut` onto every mark, so a receipt reprinted years later shows who the employee was at the time. `MarkResource` just does not send it. The only genuinely new data in KOL-35 is the folio, which has no column.

**One thing for this ticket to settle, not KOL-35.** This task's description says the hash is copyable *"so the employee can verify it against the public validation endpoint"*. That endpoint — `marks/validate` in `ams` `routes/web.php` — is not public: it is inside the DT inspector portal, behind authentication and `password_expires`. So either #6's copy button is promising employees something they cannot do, or a public validation route is missing and nobody has scoped it. Worth deciding before writing the copy around the `Copiar` button.

**Settled: no public hash validation.** The description's original claim — that the employee could verify the hash against a public validation endpoint — was wrong; `marks/validate` in `ams` is inspector-only. The user's call was to drop the promise rather than build a public route, so the description now says the hash is copyable for keeping or quoting, and #6 is unchanged: the button copies and confirms, and nothing in the copy around it may imply self-verification.
<!-- SECTION:NOTES:END -->
