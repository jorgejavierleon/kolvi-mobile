---
id: KMO-32
title: Próximos — upcoming shifts list
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-14 02:14'
labels:
  - mobile
  - jornada
milestone: m-1
dependencies:
  - KMO-4
  - KMO-9
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today as a highlighted primary-coloured card showing the shift window, premise and current punch status, followed by the next scheduled days with date, window and premise. Days covered by an approved leave or a holiday are annotated rather than shown as ordinary shifts.

PLACEHOLDER — captures scope only. Decompose into implementation-sized tasks with full acceptance criteria at Phase refinement, against the design file and the API contract as it then stands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Jornada tab shows a Próximos / Historial segmented control, Próximos selected by default
- [x] #2 Próximos shows today's shift as a highlighted card with the scheduled window, premise and current punch status; an employee with no shift scheduled today sees an honest no-shift state instead of a blank or broken card
- [x] #3 Below it, the next scheduled days appear in order, each with date, time window and premise
- [x] #4 A day covered by an approved leave shows the leave type in place of the time window
- [x] #5 A day covered by a holiday the shift does not work shows the holiday name in place of the time window
- [x] #6 A free (rest) day is omitted from the list rather than shown as an ordinary shift
- [x] #7 Tapping Historial switches segments without losing Próximos's own state when the employee switches back; Historial's content is KMO-33's and shows an honest placeholder until then
- [x] #8 An employee without permission to view their workday sees an explanatory state rather than a crash or an empty screen
- [x] #9 A failed load shows a retry that reloads only this screen's data
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Backend (ams, separate worktree, own backlog ticket mirroring the KOL-61/62 shape — branch, implement, tests, left In Review for approval, not merged by this ticket):

1. GET /api/v1/me/shifts/upcoming?days= (default 14, capped at 30) — new UpcomingShiftsController, permission:ViewOwn:Workday. Extract ShiftScheduleResolver from MarkManager::getShiftAssignmentForDate/getShiftDayForAssignment so a date range expands rather than one date at a time (PRD's own suggestion — no such service exists yet, confirmed by search). Response: { today: {shift: {premise, start_time, end_time, lunch_start_time, lunch_end_time} | null, punch_state} | null, days: [{date, weekday_label, start_time, end_time, lunch_start_time, lunch_end_time, premise, leave_type_label, holiday_name}] }. today.punch_state gated on ClockOwn:Mark, same conditional TodayController already applies — the block is never omitted for lacking permission itself, only the punch_state field is. days[] skips is_free rows entirely (MarkManager::getShiftDayForAssignment already returns null for a free ShiftDay); a date covered by an approved Leave (LeaveStatus::Approved, start_date<=date<=end_date) sets leave_type_label from LeaveType::label() instead of the time fields; a Holiday on that date sets holiday_name instead, unless Shift.work_on_holidays is true. today reuses TodayResource's own field names for consistency with /me/today.
2. Feature tests: the horizon expands correctly across weekdays/is_free, an approved leave day is annotated and its time fields absent, a holiday day is annotated unless work_on_holidays, permission gating (403 without ViewOwn:Workday, punch_state absent without ClockOwn:Mark), the days param is capped.

Mobile (this repo):

3. src/features/jornada/shifts-api.ts — GET /me/shifts/upcoming client + parser, same defensive-parsing shape as today-api.ts (throws UpcomingShiftsResponseError on a malformed body, one place the contract changes). Self-contained: no import from features/marcaje/, since a feature never imports another (README). Own tiny PunchState-shaped label lookup reading es.marcaje.status (shared i18n data, not marcaje code) rather than importing marcaje's punch-state.ts.
4. src/features/jornada/use-upcoming-shifts.ts — same three-state+retry shape as use-today.ts (loading/loaded/failed, retrying, reload()), new hook rather than a shared one — the two screens' loads are independent and the existing hook is marcaje's own file.
5. src/features/jornada/today-shift-card.tsx — the mockup's primary-tinted 'Hoy' card: eyebrow HOY, {{start}} – {{end}} · {{premise}}, punch status line. No shift today renders an honest 'Sin turno programado hoy' body instead of an empty card.
6. src/features/jornada/upcoming-shift-row.tsx — non-pressable row (title=date label, subtitle=premise, trailing=time window|leave label|holiday name) — not ListRow, whose onPress is required and these rows are not interactive; a small local presentational component instead.
7. src/features/jornada/proximos.tsx — composes today-shift-card + the upcoming list off use-upcoming-shifts, with HomeScreen's own loading-skeleton/failed-retry pattern (Skeleton, TextLink retry, es.states.failed).
8. src/app/(tabs)/jornada.tsx — SegmentedControl (Próximos default) gated on session.can('ViewOwn:Workday') — false renders an explanatory SectionScaffold-style message, never a fetch. Historial segment renders SectionScaffold(es.tabs.jornada) until KMO-33; Próximos renders the new Proximos component. Segment state is local (useState), so switching back to Próximos does not remount/refetch it.
9. src/i18n/strings.ts — es.jornada: title already exists as headers.jornada; new keys for the segmented control labels (Próximos/Historial — SegmentedControl takes labels as props, so these are the one place they're spelled), today card's no-shift-today sentence, the permission-denied explanatory sentence, and formatShortDate's existing 'Mañana · {date}' composition (new small formatter mañanaLabel(date) alongside formatShortDate, verbatim from the mockup's fmtDateShort composition).
10. Tests written with the code: shifts-api parsing (today present/absent/no-permission, leave/holiday annotation, malformed body), use-upcoming-shifts (loading/loaded/failed/retry, mirroring use-today.test.ts), today-shift-card and upcoming-shift-row rendering, proximos.tsx composition (segmented switch, skeleton, retry), jornada.tsx permission gating.
11. flows/kmo-32-proximos.yaml — sign in, open Jornada, assert the Hoy card and at least one upcoming row are on screen with real seeded data, tap Historial and back to Próximos asserting the segment switch and that Próximos' content is still there.

Tier per criterion: #1 (segmented control + default) — Jest + Maestro (visible + tappable). #2 (Hoy card, no-shift state) — Jest for the no-shift branch (seed data controls whether today has a shift, unreliable to force from a flow), Maestro for the happy path against real seed data. #3, #4, #5, #6 (upcoming list, leave/holiday annotation, free-day omission) — Jest, since forcing a seeded leave/holiday on a specific upcoming date is a fixture concern the parser test can pin exactly and a flow cannot without mutating the seed. #7 (segment switch keeps state) — Maestro. #8 (permission gating) — Jest only, same tier KMO-15 used for canPunch=false (home-screen.test.tsx), since no seeded employee lacks ViewOwn:Workday to drive a flow against. #9 (failed + retry) — Jest, mirroring use-today.test.ts's own failure-injection tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Backend: ams KOL-64 (GET /api/v1/me/shifts/upcoming) built in a separate worktree (ams-worktrees/kol-upcoming-shifts, branch feature/kol-upcoming-shifts), status Done, NOT merged to ams master — pending approval, same as KOL-61/62 before it. This ticket cannot go fully live until that merges.

npm run check green: typecheck, lint, format, 1272 Jest tests (76 suites), 8 new files (shifts-api, use-upcoming-shifts, today-shift-card, upcoming-shift-row, proximos, jornada-screen + their tests) plus jornada.tsx reduced to a route one-liner matching (tabs)/index.tsx's own pattern, and dates.ts gaining daysBetween (pure Julian-day arithmetic, no Date — matches weekdayIndex's own no-Date discipline; a Date diff would cross the device's timezone the same way the ams-side bug below did).

Live-verified end to end against the ams KOL-64 branch: ran php artisan serve from the worktree on host PHP 8.4 against the shared dev database (port 8001; temporarily repointed EXPO_PUBLIC_API_URL, reverted after — .env is gitignored, no diff), rebuilt and installed the app, signed in as employee@example.com. Screenshot read by eye: kmo-32-proximos-live.png shows the Hoy card (08:00–17:00 · Sucursal Centro, Aún no marcas entrada), Mañana · Vie 14 ago correctly labelled tomorrow, and — genuinely useful real-data coincidence — Sáb 15 ago showing Asunción de la Virgen (a real Chilean holiday landing on a working Saturday for this seed's shift) in place of a time window, proving #5 against real data rather than only a fixture. Sunday the 16th is correctly absent (#6). Manually toggled Historial and back to Próximos, state preserved (#7). flows/kmo-32-proximos.yaml 1/1 pass against the same live branch (two earlier runs hit an unrelated Android system 'Sign in with ease' Google-account overlay stealing the foreground mid-flow — dismissed by hand, unrelated to app code, resolved on retry).

#4 (leave annotation) is Jest-only (shifts-api.test.ts, proximos.test.tsx) — no seeded employee has an approved leave on a specific upcoming date, and mutating the seed for it is a heavier lift than the criterion needs, same reasoning kmo-51's flow gave for its own personal-email prompt.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Jornada's Próximos screen: a segmented control (Próximos default, Historial a placeholder pending KMO-33), today's shift highlighted in a primary-tinted card with punch status, and the schedule for the next two weeks below it — free days omitted, an approved leave or an unworked holiday annotated in place of the time window, tomorrow's row labelled Mañana via pure date arithmetic (no Date, no timezone risk). Gated on ViewOwn:Workday with an honest explanatory state for anyone without it, and a retry on a failed load.

Required an unplanned backend change: no endpoint expanded a shift across a date range. Built ams KOL-64 (GET /api/v1/me/shifts/upcoming) in a separate worktree — a new ShiftScheduleResolver service plus a small MarkManager extraction (punchStateForDate, now shared with TodayController) — shipped and left on its own branch, not yet merged to ams master, pending approval.

Verified: npm run check green (1272 tests). Live end-to-end against the ams branch — real seeded data, including a real Chilean holiday (Asunción de la Virgen) landing on a working Saturday, confirming the holiday-annotation criterion against actual data rather than only a fixture — screenshot read by eye, and flows/kmo-32-proximos.yaml passing on the same live branch.
<!-- SECTION:FINAL_SUMMARY:END -->
