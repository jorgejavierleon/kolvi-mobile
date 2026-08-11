---
id: KMO-24
title: Offline receipt variant and post-sync reconciliation
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-11 00:58'
labels:
  - mobile
  - offline
  - compliance
milestone: m-0
dependencies:
  - KMO-19
  - KMO-23
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The offline receipt must be visually distinct from a confirmed one and honest about its status. It has no folio and no hash, because the server assigns both on sync — showing an invented folio would be worse than showing none.

Copy is fixed by the design; see docs/design-decisions.md §4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An offline punch opens the receipt sheet with the headline Marca guardada en tu teléfono over the offline icon on the warning tint, not the success check
- [x] #2 The folio and hash rows show no fabricated value
- [x] #3 The sheet shows the explanatory line: Registrada en tu teléfono sin conexión. El folio y el hash los asigna el servidor al sincronizar — aún no forma parte del libro de asistencia electrónico.
- [x] #4 The Copiar action is absent on an offline receipt
- [x] #5 After a successful sync the punch shows its server-assigned folio and hash wherever it appears
- [x] #6 The employee can open the confirmed receipt for a previously queued punch once it has synced
- [x] #7 The legal note about the electronic attendance book is present on both receipt variants
- [x] #8 A mark captured offline is identifiable as such wherever it appears, including on the confirmed receipt after it syncs — the provenance survives the sync rather than being erased by it (docs/design-decisions.md §4.6). Copy for this is not in the design and needs one line in src/i18n
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/features/marcaje/punch-api.ts — add `capturedOffline: boolean` to `PunchReceipt`, parsed from `captured_offline` (absent/null -> false, per §4.3's echo). Add `OfflineReceipt` type (type, deviceDatetime, employeeName, employeeRut) — the draft shown before the register has a folio or hash for it.
2. src/ui/icons.tsx — add the offline glyph, transcribed verbatim from the design's comprobante SVG (path copied via DesignSync), matching CloudUploadIcon's structure.
3. src/i18n/strings.ts — under marcaje.receipt: offlineHeadline, pendingFolio, pendingHash, offlineNote (all transcribed verbatim from the design's own comprobante state — 'Pendiente de asignación' etc.), and one authored line, capturedOffline, for #8 (no design copy exists for it).
4. src/features/marcaje/receipt-sheet.tsx — replace the `receipt: PunchReceipt | null` prop with `view: ReceiptView | null` (`{kind:'confirmed', receipt} | {kind:'offline', receipt}`). Body branches on `view.kind`: offline icon/warning tint vs check/success tint (#1); Tipo/Fecha/Hora/Trabajador/RUT for both; folio/hash show the design's placeholder copy with no Copiar button on offline (#2, #4), server values with Copiar on confirmed; offline explanatory line only on offline (#3); new provenance line only on confirmed when capturedOffline is true (#8); legal note unconditional on both (#7, already is).
5. src/features/marcaje/home-screen.tsx — local `receipt` state becomes `ReceiptView | null`. `usePunch`'s existing `onQueued` (left for this ticket per its own doc comment) builds an OfflineReceipt from the QueuedPunch plus session.user's name/rut and opens the sheet; `onPunched` and the marks-sheet selection wrap their PunchReceipt as `{kind:'confirmed', receipt}`.
6. Tests beside each file above: receipt-sheet.test.tsx (offline variant rendering, provenance line on a synced receipt), punch-api.test.ts (captured_offline parsing), home-screen.test.tsx (onQueued opens the offline sheet; a synced mark reopened from Mis últimas marcas shows the confirmed sheet with the provenance line).
7. flows/kmo-24-offline-receipt.yaml — Maestro, requires-offline like KMO-23's pair: punch with `net off` and assert the offline sheet's headline/icon-tint/explanatory-line/no-Copiar (#1, #3, #4), then `net on`, Sincronizar, reopen Mis últimas marcas and the same punch's row to assert the confirmed sheet's folio/hash and the offline-provenance line (#5, #6, #8).

Tier: Jest carries the rendering/parsing logic (1-3, 6); Maestro (7) is what proves the actual offline-punch -> sheet -> sync -> reopen pipeline, since that is a real device/network condition rather than a render.

Material decisions, flagged for review: `ReceiptSheet`'s prop changes from `receipt` to a `view` union (touches its only two callers, home-screen.tsx and, indirectly, marks-sheet.tsx's onSelect); the offline receipt's Trabajador/RUT rows are sourced from the signed-in session rather than the register (the only source available before a folio exists); the folio/hash rows show the design's own placeholder text ('Pendiente de asignación') rather than being omitted, since that text is itself transcribed from the design's dc.html rather than invented.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split the Maestro coverage into two flows (kmo-24-offline-draft.yaml, kmo-24-synced-receipt.yaml) rather than one, matching KMO-23's pair: toggling net on/off happens between bin/e2e runs in this repo, never inside a flow. Ran both against the real emulator + local ams: net off, punch, offline sheet confirmed by screenshot (warning tint, offline icon, placeholder folio/hash, explanatory line, no Copiar); net on, then discovered the automatic flush (KMO-23 #4) usually wins the race against an explicit Sincronizar press since the app is foregrounded live when connectivity returns — the second flow now tolerates either outcome instead of assuming the banner survives. Confirmed receipt screenshot shows the real folio (20260810-0003), real hash, Copiar, and the offline-provenance line.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-08-07 15:52
---
KMO-21 is settled. #1-#4 and #7 are unchanged — §4.5 confirms an unsynced punch is not registered (Art. 9, Art. 20 a, Art. 22.1: the book is the central database) and the design's copy for it stands as written. #5 is unchanged and now has a contract behind it: folio and hash come off the 201 or the 200 in §4.3.

One criterion added: the offline provenance has to remain visible on the synced receipt. §4.6 is the reason — Art. 10 allows the exception only in casos particulares debidamente justificados, which is impossible if the register cannot say which marks were queued.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the offline receipt variant to ReceiptSheet (a ReceiptView union of confirmed/offline) and the post-sync reconciliation that lets a synced mark still say it was captured offline. usePunch's onQueued (left in place by KMO-23) now opens the offline draft, sourced from the queued punch plus the signed-in session's own name/RUT since the register has nothing yet. PunchReceipt gained capturedOffline, parsed from captured_offline and echoed on every mark, so a receipt reached from Mis últimas marcas after sync still carries its provenance. Verified with npm run check (67 suites, 1190 tests, green) and two Maestro flows run against the real emulator and local ams — kmo-24-offline-draft.yaml (net off: headline, icon tint, placeholder folio/hash, explanatory line, no Copiar, legal note) and kmo-24-synced-receipt.yaml (net on: real folio/hash, offline-provenance line) — both screenshots reviewed by eye.
<!-- SECTION:FINAL_SUMMARY:END -->
