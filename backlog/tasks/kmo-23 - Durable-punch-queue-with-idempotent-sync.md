---
id: KMO-23
title: Durable punch queue with idempotent sync
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
  - KMO-21
  - KMO-22
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The queue itself. Durability is the point: a punch written here must survive an app kill, a battery death and an OS restart, because the alternative is an employee who worked and has no record of it.

Ordering and idempotency are what keep a retry from becoming a double punch.

Implement to the wire contract settled in KMO-21.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A punch attempted with no connectivity is written to durable local storage before the employee sees any acknowledgement
- [ ] #2 Queued punches survive force-quit, device restart and app update
- [ ] #3 Each queued punch carries device_datetime as a naive Santiago wall-clock string read once at the moment of the punch, an idempotency_key UUIDv4, and the reported location — the wire contract in docs/design-decisions.md §4.3
- [ ] #4 The queue flushes automatically on connectivity restore, in the order the punches were made; the banner's Sincronizar button is an accelerator and never the only way it drains (Res. 38 Art. 9 forbids manual transmission, Art. 10 requires the send be automatic)
- [ ] #5 A retried or duplicated request cannot create a second punch server-side, verified by a test that submits the same queued punch twice; the idempotency_key is never regenerated on a retry
- [ ] #6 A replay answered 200 is treated as success and the punch leaves the queue with the receipt the server returned, exactly as a 201 is — the employee cannot tell the two apart (§4.3)
- [ ] #7 The device reading travels only as device_datetime; datetime is never sent and remains prohibited server-side, and the queue never re-reads the clock on flush
- [ ] #8 A punch whose device_datetime is more than 24 hours old at sync leaves the queue without being inserted and without being discarded, is filed for HR through the Res. 38 Art. 39 b) / Art. 40 addition pathway, and the employee is told in Spanish that it now needs their jefatura (§4.4)
- [ ] #9 A queued punch rejected by the server on sync surfaces to the employee with the server reason rather than being dropped silently
- [ ] #10 Tests cover ordering, idempotency, the 200-on-replay path, app-kill durability, the over-age path and the rejected-on-sync path
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-08-07 15:52
---
KMO-21 settled the contract; ACs updated to match docs/design-decisions.md §4.

The material change is the old #6, 'The device clock reading is never sent as the legal timestamp field'. §4.2 supersedes it: on the queued path the server assigns date_time *from* the validated device reading, because Res. 38 Art. 11 requires the sello de tiempo to be the hour the marcación is made and Art. 11 is textually attached to the Art. 10 offline exception. Stamping the sync time instead would put a false hour in the register. What survives of the old criterion is the part that is still true and is now #7 — the reading travels as device_datetime, datetime stays prohibited, and the clock is read once at the punch and never again.

Also added: 200-on-replay (#6), the concrete field names and types (#3), the 24 h cap and its Art. 40 exit (#8), and Sincronizar as an accelerator rather than the mechanism (#4).
---
<!-- COMMENTS:END -->
