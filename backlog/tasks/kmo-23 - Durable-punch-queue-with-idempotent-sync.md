---
id: KMO-23
title: Durable punch queue with idempotent sync
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
updated_date: '2026-08-07 20:21'
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
- [ ] #8 ApiError carries the server's code through src/api/errors.ts, so a 422 refusal can be branched on without matching its Spanish sentence — a prerequisite, since the two offline refusals are otherwise indistinguishable
- [ ] #9 A 422 with code queued_punch_too_old drops the punch from the queue and shows the server's message verbatim: ams filed it for HR as an Art. 39 b) addition inside that same request, so it is never retried (§4.4)
- [ ] #10 A 422 with code queued_punch_in_future is handled by a decision recorded on this task before it is implemented, and is never retried blind — the queue does not re-read the clock, so a bare retry either fails identically or records an hour the employee did not work (§4.4)
- [ ] #11 A 409 is recognised as the day the punch was made already holding that type, not today's day, and the punch leaves the queue with a calm Spanish line
- [ ] #12 A queued punch rejected by the server on sync surfaces to the employee with the server reason rather than being dropped silently
- [ ] #13 Tests cover ordering, idempotency, the 200-on-replay path, app-kill durability, both 422 codes, the 409-on-punch-day path and code plumbing through ApiError
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

author: @claude
created: 2026-08-07 20:21
---
ams KOL-54 has shipped, and §4 is reconciled with what it actually does. Three things changed for this ticket:

**The 24 h refusal is not inert.** The server files the punch as an Art. 39 b) addition through MarkModification *inside the same request* that answers 422 queued_punch_too_old — the employee is emailed and has 48 h. So the app drops it and shows the message; retrying would ask HR to file it twice.

**There is a second edge, and it needs a decision this ticket has to make.** A device_datetime more than 5 minutes ahead of the server answers 422 queued_punch_in_future and files nothing, because there is no missing mark — the phone is wrong about the time. The trap: the queue never re-reads the clock, so a bare retry sends the same future reading and only becomes recordable once the server's clock passes it, at an hour the employee did not work. §4.4 leaves this open on purpose rather than guessing.

**A prerequisite appeared.** Both refusals are 422 {message, code} and are meant to be told apart by code. ApiError keeps only kind, userMessage and Laravel's errors bag, so code is dropped at the transport boundary — and punch-api.ts explicitly rules out matching the Spanish instead. src/api/errors.ts has to carry it. Small, but it is a surface every feature imports, so it is its own criterion (#8) rather than a silent edit.

Also: the one-per-day guard now keys off the day the punch was *made*, so a punch queued at 23:40 and synced next morning collides with yesterday (#11).
---
<!-- COMMENTS:END -->
