---
id: KMO-21
title: SPIKE — offline punching compliance position and wire contract
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-07 18:15'
labels:
  - mobile
  - offline
  - compliance
  - spike
milestone: m-0
dependencies: []
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
  - docs/context/resolucion_38.txt
priority: high
type: spike
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Blocking research task. Nothing in this epic is implemented until it is answered in writing.

Res. 38 Art. 9 requires automatic online transmission. That constrains a queue but does not forbid one — it forbids MANUAL transmission. Art. 8 and Art. 14a are about adulteration risk, which is precisely why a device clock must never become the legal timestamp.

The design already commits to the employee-facing behaviour (docs/design-decisions.md §4). What is unsettled is whether a queue is defensible at all, and exactly what the client and server exchange.

Cross-check every compliance claim against docs/context/resolucion_38.txt directly. Do not paraphrase the regulation from the PRD.

The output of this task is a written decision appended to docs/design-decisions.md, not code. If the answer is that a queue is not defensible, this epic moves out of Phase 1 and the remaining subtasks are closed — that is a valid and expected outcome.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A written position states whether an offline queue is defensible under Res. 38 Art. 9, citing the article text from docs/context/resolucion_38.txt, and is signed off by the compliance owner
- [x] #2 The decision names which timestamp is legal and confirms the device reading is stored separately and never substituted
- [x] #3 The wire contract for a queued punch is specified: the field carrying the device clock, the sync time, the idempotency key, and what the server returns
- [x] #4 The maximum queue age is decided, along with what happens to a punch that exceeds it
- [x] #5 The decision states whether an unsynced punch counts as registered for the purposes of the attendance book, and what the employee is told
- [x] #6 The outcome is appended to docs/design-decisions.md §4 and the dependent subtasks are updated or closed to match
- [x] #7 The corresponding backend work is raised in the ams repository
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
This spike produces prose and two backlog edits, no app code. No device tier applies — nothing changes on screen.

1. Read Res. 38 directly for the articles that govern a queue: Art. 8, 9, 10, 11, 12, 13, 14, 20, 22.1, 36, 38, 39-41, 44, 45.1, 52.2. Done — Art. 10 (express exception permitting capture-and-later-send) and Art. 11 (the sello de tiempo attached to it, 'para cumplir el fin señalado en el párrafo anterior') are the authority the PRD missed; it argued only from Art. 9.
2. docs/design-decisions.md §4 — replace the three-bullet placeholder with the decision record: the Art. 10 position (AC1), which timestamp is legal and how the device reading is adjudicated rather than trusted (AC2), the wire contract (AC3), the 24 h queue age and what happens past it (AC4), and whether an unsynced punch is registered plus what the employee is told (AC5). Cite article text verbatim, not the PRD's paraphrase.
3. Material refinement to flag before writing: §4 currently says the server-assigned date_time is the legal timestamp for every mark. For a queued mark that would put the *sync* time in the register — a false time, against Art. 11 ('la fecha y hora en que se efectúa una marcación'), Art. 44 (exact precision per marcaje) and Art. 41 b) (no perjuicio to the worker). The position instead has the server *adjudicate* date_time from a validated device reading on the queued path only, with the raw reading, the clock skew and the offline provenance stored beside it and flagged. Recommended, and it is a change to a shipped decision, so it goes to the user first.
4. Note the Art. 10 second paragraph constraint the design does not yet carry: the exception covers 'situaciones excepcionales... casos particulares debidamente justificados'. So no manual offline toggle, ever, and offline frequency must be measurable per employee/premise (KMO-29 telemetry). Art. 38 a)/b) make the alternative — refusing the punch — independently non-conforming.
5. backlog task edit on the dependents so they match the settled contract (AC6): KMO-23 (device_datetime semantics, idempotency key placement, 24 h handling, 200-on-replay), KMO-24 (offline receipt has no folio/hash because both are assigned at sync, and the provenance flag survives onto the synced receipt), KMO-22 (no offline toggle; banner is the only offline affordance), KMO-49 (idempotency key scoped per user server-side). None get closed — the queue is defensible, so the epic stays in Phase 1.
6. ams KOL ticket for the backend half (AC7): device_datetime/synced_at/idempotency_key/captured_offline columns, the unique index that makes the retry idempotent, the accepted-window validation, 200-on-replay, the over-age punch filed through the Art. 39 b)/40 addition pathway rather than inserted, and the question of pulling offline provenance inside the checksum envelope.
7. AC1 cannot be self-checked — it requires the compliance owner's sign-off. It is left unchecked with a note naming what is outstanding unless the user signs off in this session.

Verification tier: Jest and Maestro have nothing to carry here. Evidence is the article citations being accurate against docs/context/resolucion_38.txt, and npm run check staying green (docs-only change).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Res. 38 read directly. The PRD's framing was arguing from the wrong article: it defended the queue against Art. 9 alone, when **Art. 10 is an express exception** permitting capture-and-store with automatic later transmission. Art. 38 a)/b) then make the alternative — an app that will not take a punch without signal — independently non-conforming. So the queue is on firmer ground than the PRD claimed, and the epic stays in Phase 1.

The one material reversal: **Art. 11 is textually attached to Art. 10** ('Para cumplir el fin señalado en el párrafo anterior') and requires the sello de tiempo to be the hour 'en que se efectúa una marcación'. §4's previous line — the server-assigned date_time is the legal timestamp for every mark — would therefore register a queued punch at its *sync* time. A punch made at 08:00 in a basement and transmitted at 12:00 would enter the book as 12:00: false, and against Art. 11, Art. 44 (exact per-marcaje precision) and Art. 41 b) (no perjuicio to the worker). Position adopted instead: the server assigns date_time on both paths, and on the queued path it *adjudicates* it from a validated device_datetime, keeping the raw reading, synced_at and captured_offline beside it. Approved by the owner in session before writing.

Art. 8 / Art. 14 a) ii) were read as forbidding this and do not — they govern adulteración post-registro, not where a timestamp originates. Useful property: ams hashes user_id + type + date_time, so the Art. 8 checksum covers the truthful time with no formula change and no loss of verifiability for existing marks.

Two constraints the design did not carry, both from Art. 10 ¶2 ('situaciones excepcionales… casos particulares debidamente justificados'): no manual offline mode, ever, and offline frequency has to be measurable per employee and premise (KMO-29). The same clause is why captured_offline must be explicit on the mark — a case cannot be justified if the register cannot say which marks were queued.

Verification: every Spanish quotation in §4 checked as a verbatim substring of docs/context/resolucion_38.txt by script, whitespace-normalised (the one elision in the Art. 39 b) quote is marked and drops only 'tanto individuales como colectivas'). npm run check green — 62 suites, 1060 tests, format:check clean on the markdown. No Jest or Maestro tier applies; this ticket ships prose and changes nothing on screen.

AC #1 and AC #7 left unchecked deliberately — see the final summary.

On AC #2's wording: it says the device reading is 'stored separately and never substituted', which was written under the position §4.2 supersedes. Checked because it is satisfied in substance — §4.2 names the legal timestamp explicitly, and device_datetime is stored raw, immutably and permanently beside date_time so the two can always be compared. What no longer holds is the implication that date_time on the queued path comes from the server's own clock. It does not; it is adjudicated from the device reading. Recorded here rather than by rewriting the criterion.

AC #1 signed off by Jorge Leon (compliance owner, per the design-decisions.md header) on 2026-08-07, in session, after the written §4. The pending line in §4 is replaced with the recorded sign-off.

AC #7 raised as ams KOL-54 — 'Ingest queued offline punches on POST /api/v1/marks: device timestamp, idempotency and the 24 h cap'. High, depends on KOL-34 and KOL-35, 11 acceptance criteria: the two new request fields and their 422s, date_time adjudicated from device_datetime, the unique (user_id, idempotency_key) index with a byte-identical 200 on replay, the 24 h cap filing over-age punches through the Art. 39 b)/40 pathway, MarkResource echoing the provenance, and an explicit decision on whether offline provenance enters the Art. 8 checksum input. The ticket file is left uncommitted in /home/jj/Work/ams: that tree has unrelated WIP (KOL-38, the overtime PRD, the QA checklist), so committing it is the owner's call.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-08-07 15:53
---
Substantively done and left In Progress, because two criteria need you rather than evidence.

**AC #1 — compliance sign-off.** §4 is written and every citation verified verbatim against docs/context/resolucion_38.txt. It carries the line 'Compliance sign-off: pending the compliance owner's review (KMO-21 #1)'. If you are the compliance owner for this (design-decisions.md names you as Owner), read §4 and say so; I will replace that line with the sign-off and check the criterion. If it belongs to a lawyer or the client, the criterion stays open until they have seen it.

**AC #7 — the ams ticket.** The backend half does not exist: device_datetime / synced_at / idempotency_key / captured_offline columns, the unique (user_id, idempotency_key) index, the 24 h window validation, 200-on-replay, filing an over-age punch through the Art. 39 b) / Art. 40 pathway instead of inserting it, and the open question of pulling offline provenance inside the Art. 8 checksum envelope. Awaiting your go-ahead to raise it in /home/jj/Work/ams.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Settled the blocking compliance question: an offline punch queue conforms, on stronger grounds than the PRD claimed. Res. 38 Art. 10 is an express exception permitting capture-and-store with automatic later transmission, and Art. 38 a)/b) make the alternative — an app that refuses a punch without signal — independently non-conforming, so the offline epic stays in Phase 1 and no dependent subtask was closed.

One shipped decision is reversed. Art. 11 is textually attached to Art. 10 ('Para cumplir el fin señalado en el párrafo anterior') and requires the sello de tiempo to be the hour the marcación is made, so §4's previous position — the server's clock stamps every mark — would have registered a queued punch at its sync time: a punch made at 08:00 and transmitted at 12:00 entering the book as 12:00, against Art. 11, Art. 44 and Art. 41 b). The server now adjudicates date_time from a validated device_datetime on the queued path only, keeping the raw reading, synced_at and captured_offline beside it. Art. 8 and Art. 14 a) ii) do not forbid this — they govern adulteración post-registro, not the origin of a timestamp.

Also settled: the wire contract (device_datetime and idempotency_key in the body, 201/200/409/422/401 and what each means to the client), a 24 h queue age with over-age punches filed through the Art. 39 b)/40 bilateral addition pathway rather than inserted or dropped, and that an unsynced punch is captured-and-stored but not registered — the book is the central database (Art. 9, Art. 20 a, Art. 22.1). Two constraints the design lacked came out of Art. 10's second paragraph: no manual offline mode, and offline frequency must be measurable per employee and premise.

Written into docs/design-decisions.md §4.1-§4.6, superseding the three provisional bullets and PRD §7.3. Signed off by Jorge Leon on 2026-08-07. KMO-22, KMO-23, KMO-24 and KMO-49 updated to match — KMO-23 most of all, whose old criterion #6 ('the device clock reading is never sent as the legal timestamp field') the decision contradicts and which is reworded to what survives it. Backend half raised as ams KOL-54.

Verified: every Spanish quotation in §4 confirmed by script as a verbatim substring of docs/context/resolucion_38.txt, whitespace-normalised, with the single elision marked. npm run check green — 62 suites, 1060 tests, Prettier clean. No Jest or Maestro tier applies; the ticket ships prose and changes nothing on screen.
<!-- SECTION:FINAL_SUMMARY:END -->
