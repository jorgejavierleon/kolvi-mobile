---
id: KMO-24
title: Offline receipt variant and post-sync reconciliation
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
updated_date: '2026-08-07 15:52'
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
- [ ] #1 An offline punch opens the receipt sheet with the headline Marca guardada en tu teléfono over the offline icon on the warning tint, not the success check
- [ ] #2 The folio and hash rows show no fabricated value
- [ ] #3 The sheet shows the explanatory line: Registrada en tu teléfono sin conexión. El folio y el hash los asigna el servidor al sincronizar — aún no forma parte del libro de asistencia electrónico.
- [ ] #4 The Copiar action is absent on an offline receipt
- [ ] #5 After a successful sync the punch shows its server-assigned folio and hash wherever it appears
- [ ] #6 The employee can open the confirmed receipt for a previously queued punch once it has synced
- [ ] #7 The legal note about the electronic attendance book is present on both receipt variants
- [ ] #8 A mark captured offline is identifiable as such wherever it appears, including on the confirmed receipt after it syncs — the provenance survives the sync rather than being erased by it (docs/design-decisions.md §4.6). Copy for this is not in the design and needs one line in src/i18n
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-08-07 15:52
---
KMO-21 is settled. #1-#4 and #7 are unchanged — §4.5 confirms an unsynced punch is not registered (Art. 9, Art. 20 a, Art. 22.1: the book is the central database) and the design's copy for it stands as written. #5 is unchanged and now has a contract behind it: folio and hash come off the 201 or the 200 in §4.3.

One criterion added: the offline provenance has to remain visible on the synced receipt. §4.6 is the reason — Art. 10 allows the exception only in casos particulares debidamente justificados, which is impossible if the register cannot say which marks were queued.
---
<!-- COMMENTS:END -->
