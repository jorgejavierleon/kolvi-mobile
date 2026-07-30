---
id: KMO-4.4
title: Offline receipt variant and post-sync reconciliation
status: To Do
assignee: []
created_date: '2026-07-30 14:37'
labels:
  - mobile
  - offline
  - compliance
milestone: m-0
dependencies:
  - KMO-4.3
  - KMO-3.5
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
parent_task_id: KMO-4
priority: high
type: feature
ordinal: 35000
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
<!-- AC:END -->
