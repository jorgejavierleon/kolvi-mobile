---
id: KMO-20
title: Punch history and receipt retrieval
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-07 01:42'
labels:
  - mobile
  - marcaje
  - compliance
milestone: m-0
dependencies:
  - KMO-19
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Res. 38 Art. 22.1 requires the worker to have permanent and unrestricted access to their history. Phase 1 covers the recent punches available from GET /api/marks; the full five-year workday history arrives with the Jornada epic in Phase 2.

The employee must be able to retrieve any past receipt, not only the one shown at punch time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The recent punches are listed newest first with type, date and time
- [x] #2 Tapping a punch opens the same comprobante sheet built in KMO-19, populated from the stored mark
- [x] #3 A retrieved receipt shows the same folio and hash as when the punch was made
- [x] #4 An employee with no punches yet sees a Spanish empty state
- [x] #5 The list is reachable from the Marcaje tab without leaving the tab context
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/features/marcaje/marks-api.ts + marks-api.test.ts — `GET /api/v1/marks`, the ten most recent marks (PRD §8, `permission:ViewOwn:Mark`). Each row is parsed by **reusing `parsePunchReceipt`** from punch-api.ts rather than by a second parser: a stored mark and a just-made one become the same `PunchReceipt`, which is what makes #2 a reuse of KMO-19's sheet and #3 true by construction rather than by a field-by-field copy. Accepts a bare array and Laravel's `{data: […]}` envelope, the way `parsePermissions` accepts two shapes for a backend that has not been written yet. Sorts newest-first here (#1) instead of trusting the server's order — a client-side sort is a Jest-tier criterion, a server's ordering is not. Own `MarksResponseError` for the envelope; row failures keep travelling as `PunchResponseError`.

2. src/features/marcaje/use-marks.ts + use-marks.test.ts — the same three-state load as `use-today.ts` (loading / loaded / failed, one retry, aborted on unmount), with one difference: it is **gated on `enabled`** and fetches when the sheet opens, not on mount. Inicio keeps its one `/me/today` and time-to-punch (G1) pays nothing for a list nobody has opened.

3. src/i18n/strings.ts — `es.marcaje.marks`: `open` ('Mis últimas marcas', the entry link), `title` ('Mis últimas marcas'), `empty` + `emptyBody` (#4 — the design has no state for an employee who has never punched, so it is authored: it says nothing is wrong, marks appear here once they punch), `close` ('Cerrar marcas', the backdrop's screen-reader name). The failure reuses `es.states.failed` + `es.actions.retry`; the row's Entrada/Salida reuse `es.marcaje.receipt.types`.

4. src/features/marcaje/marks-sheet.tsx + marks-sheet.test.tsx — the list, in `@/ui/bottom-sheet`. One row per mark: `Entrada`/`Salida` over `formatShortDate` (`Mié 5 ago`), `formatClockTime` on the right (#1). Seconds are deliberately not on the row — dates.ts's own rule is that they belong on the receipt, and the receipt is one tap away. Each row is a 44dp `Pressable` announcing type + date + time as one element, calling `onSelect(receipt)`. Loading, empty (#4) and failed states in the sheet body.

5. src/features/marcaje/home-screen.tsx — the entry point (#5) and the swap. A `TextLink` under the week summary, gated on `session.can('ViewOwn:Mark')` the way the punch surface is gated on `ClockOwn:Mark`. A **sheet, not a route**: a pushed route lands on the root stack and covers the tab bar (that is what makes /perfil an overlay), so the sheet is what keeps the list inside the tab context. Tapping a row sets the existing `receipt` state, and the marks sheet's `visible` is `marksOpen && receipt === null` — the two sheets **swap rather than stack**, so there are never two RN `Modal`s over each other, and `Listo` returns the employee to the list they came from. The punch-time receipt path is untouched.

6. flows/kmo-20-marcas.yaml — the device tier for #5 (the link opens the list without leaving Inicio; the tab bar is still there), #1 (rows with type, date and time) and #2/#3 (tapping the newest row opens the comprobante carrying the same folio and hash the punch showed). #4's empty state needs an employee with no marks, so it is Jest-tier and noted as such.

Backend requirement this depends on: #3 needs `GET /api/v1/marks` to answer the **same Art. 13-complete `MarkResource`** the 201 does — hash, folio, employee_name, employee_rut, geo_status — not the thin row the PRD sketches. `ams` KOL-35 completed that resource; this file is the authoritative reading that the list endpoint uses it too.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Placement (#5) — a BottomSheet over Inicio rather than a route. A pushed route lands on the root stack and covers the tab bar (that is what makes /perfil an overlay), so a route would take the employee out of Marcaje to reach a list about marcaje. Entry point is a TextLink under the week summary, outside the three load states: Art. 22.1 access to the register is not conditional on /me/today having arrived, so an employee whose summary failed can still read a receipt.

Reuse over re-parsing (#2, #3) — every row from GET /api/v1/marks is read by `parsePunchReceipt`, the punch response's own parser, so a stored mark and a just-made one are the same `PunchReceipt`. That is what makes the retrieved receipt carry the folio and hash the punch showed: there is no second reading of the register that could disagree with the first.

The two sheets **swap** rather than stack — `visible={marksOpen && receipt === null}`. Two RN Modals over each other is a stack neither platform agrees about, and `Listo` on a retrieved receipt returns the employee to the list they came from.

Ordering (#1) sorted client-side in `parseMarks` via `compareNaiveDateTime`, not trusted from the server: a server's ORDER BY is not a criterion this app can prove, a boundary sort is. Naive wall-clock comparison, never `Date` — sorting through the device timezone is the same mistake as displaying through it.

Caching, corrected mid-implementation — the hook first loaded only on the *first* open, which meant open list → close → punch → reopen showed a history missing the employee's own punch. Now every opening refetches, keeping the previous rows on screen while it does. The gate is the sheet being open, not visible, so opening a comprobante from a row does not re-request on the way back.

New shared primitive: src/ui/list-row.tsx. Every tappable thing in features/ goes through a ui/ primitive and there was no pressable row yet; `Button`'s five variants are all weighted and ten of them would be ten competing calls to action. KMO-33 (Jornada Historial) and KMO-42 (Documentos) need the same row.

Backend contract confirmed against the live ams, not assumed: GET /api/v1/marks answers the full Art. 13 MarkResource — mark_id, folio, hash, datetime, type, geo_status, employee_name, employee_rut — as a bare array. The parser also accepts Laravel's {data: […]} envelope, the way parsePermissions accepts two shapes.

#4 is Jest-tier and deliberately so: its empty state needs an employee with no marks at all, and the flow's first act is to give them one. Covered in marks-sheet.test.tsx and home-screen.test.tsx.

Validation:
- npm run check green — typecheck, lint, format:check, 62 suites / 1060 tests (was 1046 on master).
- bin/e2e flows/kmo-20-marcas.yaml PASSED (57s). It punches, copies the hash off the punch-time receipt with copyTextFrom, opens the list, taps the newest row, and asserts ${maestro.copiedText} on the retrieved receipt — #3 proven on a device as two renderings of one mark rather than as two matching patterns. Screenshots in .artifacts/e2e/'KMO-20 mis últimas marcas'/takeScreenshot/.
- By hand on the emulator against the live ams, before the flow: the retrieved receipt for mark 223 rendered folio 20260806-0011 and hash 924936fb…f16d6, byte-identical to what GET /api/v1/marks holds for it; dismissing the list returned to Inicio with the tab bar and the tab unchanged.

One correction made during verification: the flow first asserted 'tab-inicio' visible while the list was up. That is unprovable and also untrue — a sheet is an RN Modal (its own window, nothing behind it in the hierarchy) and at 86% height it genuinely covers the bar. #5's real claim is that no navigation happened, so the assertion moved to the end of the flow: dismissing the list lands on Inicio itself, tab bar and shift card intact, with no back journey.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the punch history and receipt retrieval Res. 38 Art. 22.1 requires: `Ver mis últimas marcas` under the week summary on Inicio opens a bottom sheet listing the ten most recent punches from GET /api/v1/marks, newest first with type, date and time, each one a tap away from the comprobante KMO-19 built.

The design of it is one decision: a stored mark is read by `parsePunchReceipt`, the punch response's own parser, so the history hands ReceiptSheet exactly what a fresh punch hands it. A retrieved receipt therefore carries the folio and hash the register recorded rather than a second rendering of them. A sheet and not a route, because a route lands on the root stack and covers the tab bar; the two sheets swap rather than stack, so Listo on a retrieved receipt returns to the list. The list costs the punch screen no request until it is opened, and refetches on every opening so it can never omit a punch the employee just made.

New: src/features/marcaje/{marks-api,use-marks,marks-sheet}.tsx with their tests, the shared src/ui/list-row.tsx primitive, es.marcaje.marks and markSummary in the catalogue, and flows/kmo-20-marcas.yaml.

Verified with npm run check (62 suites, 1060 tests) and a green bin/e2e kmo-20 against the live ams, which copies the hash off the receipt at punch time and finds the same string on the receipt retrieved from the list. All five criteria met; #4's empty state is Jest-tier because the flow's own punch would destroy the condition it tests.
<!-- SECTION:FINAL_SUMMARY:END -->
