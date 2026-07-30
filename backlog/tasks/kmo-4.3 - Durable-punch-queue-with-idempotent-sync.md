---
id: KMO-4.3
title: Durable punch queue with idempotent sync
status: To Do
assignee: []
created_date: '2026-07-30 14:37'
labels:
  - mobile
  - offline
  - compliance
milestone: m-0
dependencies:
  - KMO-4.1
  - KMO-4.2
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
parent_task_id: KMO-4
priority: high
type: feature
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The queue itself. Durability is the point: a punch written here must survive an app kill, a battery death and an OS restart, because the alternative is an employee who worked and has no record of it.

Ordering and idempotency are what keep a retry from becoming a double punch.

Implement to the wire contract settled in KMO-4.1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A punch attempted with no connectivity is written to durable local storage before the employee sees any acknowledgement
- [ ] #2 Queued punches survive force-quit, device restart and app update
- [ ] #3 Each queued punch carries an idempotency key, the device clock reading in the agreed field, and the reported location
- [ ] #4 The queue flushes automatically on connectivity restore, in the order the punches were made
- [ ] #5 A retried or duplicated request cannot create a second punch server-side, verified by a test that submits the same queued punch twice
- [ ] #6 The device clock reading is never sent as the legal timestamp field
- [ ] #7 A punch exceeding the maximum queue age agreed in KMO-4.1 is handled as that decision specifies, and the employee is told what happened
- [ ] #8 A queued punch rejected by the server on sync surfaces to the employee with the server reason rather than being dropped silently
- [ ] #9 Tests cover ordering, idempotency, app-kill durability and the rejected-on-sync path
<!-- AC:END -->
