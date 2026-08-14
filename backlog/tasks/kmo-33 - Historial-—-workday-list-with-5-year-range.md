---
id: KMO-33
title: Historial — workday list with 5-year range
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-14 22:41'
labels:
  - mobile
  - jornada
  - compliance
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
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Days newest-first with a status badge and the Trabajado / Extra / Faltante tiles. Defaults to the current month and pages back through history; Res. 38 Art. 22.1 requires 5 years of access, so this is range-queryable and paginated rather than a fixed window. Status badges reuse the server badge tones so web and mobile agree. A day covered by an approved leave shows the leave type instead of hours.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Historial segment (Jornada tab) lists the current month's workdays newest-first, each showing the date, a status badge and the Trabajado / Extra / Faltante figures
- [x] #2 The status badge colour follows the server's badge tone (success/warning/destructive) for the day's WorkdayStatus, matching the web app's own tones
- [x] #3 Paging back is not capped short of the 5 years Art. 22.1 requires
- [x] #4 A day covered by an approved leave shows the leave type in place of the Trabajado / Extra / Faltante figures
- [x] #5 A month with no workdays (e.g. before the employee's hire date) shows an honest empty state rather than a blank or broken list
- [x] #6 A failed load shows a retry that reloads only this screen's data, leaving already-loaded months in place
- [x] #7 Tapping a day is wired for KMO-34's day detail; until that ticket ships it shows an honest placeholder rather than doing nothing or crashing
- [x] #8 A visible "Cargar mes anterior" action loads the next older month and appends it below what is already loaded, without losing or re-fetching the days already on screen
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Backend (ams, separate worktree, own ams ticket KOL-65 mirroring the KOL-64 shape — branch, implement, tests, left In Review, not merged by this ticket):
   - GET /api/v1/me/workdays?from=&to= (both optional; default = current month, mirroring My\WorkdayController::index) — new Api\WorkdaysController, permission:ViewOwn:Workday. Reuses Workday::betweenDates, scoped to the authenticated user, with('leave:id,type'), orderByDesc('date').
   - New WorkdayResource: date, date_label, weekday, status, status_label, status_badge (from WorkdayStatus::badge()), worked_time, extra_time, missing_time, leave_type_label (null unless the day is on leave, in which case the three time fields are null instead). Bare array response, matching /me/marks and /me/shifts/upcoming's envelope conventions.
   - Feature tests: default range is the current month, an explicit from/to is honoured and swapped if reversed, a day with an approved leave carries leave_type_label and omits the worked/extra/missing fields, permission gating (403 without ViewOwn:Workday), an empty range returns an empty array rather than an error, a 5-year-wide range is not truncated.

2. Mobile (this repo). Revised from the original plan after re-reading src/ui/screen.tsx: every screen (Proximos included) renders inside one outer ScrollView, so a FlatList with onEndReached would nest one VirtualizedList inside another — the plain View+map pattern every other list in this app already uses, plus an explicit "Cargar mes anterior" action, is the fix rather than introducing the app's first FlatList for one screen.
   - src/features/jornada/workdays-api.ts — GET /me/workdays client + parser (own WorkdaysResponseError), same defensive-parsing shape as shifts-api.ts. Only date, status, status_label, status_badge, worked_time, extra_time, missing_time, leave_type_label are read; date_label/weekday are ignored the way shifts-api.ts already ignores any server-formatted date, per the client's own no-Intl/table-based dates.ts. status/status_label pass through verbatim per strings.ts's own rule that domain vocabulary is server-labelled, never re-translated client-side.
   - src/features/jornada/use-workdays.ts — same three-state load as use-upcoming-shifts.ts for the initial (current) month, plus loadOlderMonth() that fetches the calendar month before the oldest one loaded and appends it, and its own loadingMore/failed-to-load-more state so a failure paging back does not blank out what already loaded.
   - src/features/jornada/history-day-row.tsx — one row via the shared src/ui/list-row.tsx primitive: date label (formatShortDate), StatusBadge (tone mapped from status_badge), TileRow with Trabajado/Extra/Faltante or, on a leave day, the leave type where the tiles would sit.
   - src/features/jornada/historial.tsx — the list: skeleton while loading, LoadFailure+retry on a failed initial load (Proximos's own shape), empty state when the loaded range has no days, the day rows, then "Cargar mes anterior" (TextLink/Button, loading while loadingMore) with its own inline failure text on a failed page rather than losing the list. Tap on a row navigates to an honest "Detalle de jornada" placeholder pending KMO-34.
   - src/app/(tabs)/jornada.tsx / jornada-screen.tsx — swap the SectionScaffold placeholder KMO-32 left for the Historial segment for the new Historial component; permission gate and segment-state preservation are already in place from KMO-32.
   - src/i18n/strings.ts — es.jornada.historial: empty state copy, "Cargar mes anterior" label, the load-more failure line, the day-detail placeholder sentence.
   - Tests written with the code: workdays-api parsing (bare array, leave annotation omitting the time fields, malformed body), use-workdays (initial load, loadOlderMonth appends without refetching earlier months, initial failed+retry, load-more failure keeps existing months), history-day-row rendering (badge tone per status_badge value, leave in place of figures), historial.tsx composition (empty, failed+retry, load-more, row tap).
   - flows/kmo-33-historial.yaml — sign in, open Jornada, switch to Historial, assert the current month's days and badges render, tap "Cargar mes anterior" and assert an older month's day appears, tap a day and assert the placeholder.

Tier per criterion: #1, #2 — Jest (history-day-row, historial.tsx) + Maestro for the visible render. #8 (load-more) — Jest for the accumulate-without-refetch logic (use-workdays) + Maestro tapping it once. #3 (no 5-year cap) — the backend contract test plus a Jest test that use-workdays never stops offering loadOlderMonth. #4 (leave) — Jest, fixture-driven, same reasoning KMO-32 gave for leave annotation. #5, #6 — Jest, mirroring use-upcoming-shifts's own empty/failure tests. #7 (day tap placeholder) — Jest + Maestro tap-through.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Screen.tsx wraps every tab in one outer ScrollView (confirmed by reading it before building the list), so the original plan's FlatList + onEndReached would have nested one VirtualizedList inside another. Revised to the plain View+map every other list in this app already uses, plus an explicit "Cargar mes anterior" action — recorded on the plan before writing the component.

history-day-row.tsx composes Card (wrapped in a Pressable, per Card's own doc comment naming this exact row) + StatusBadge + TileRow rather than ListRow — ListRow's title/subtitle/trailing shape has no room for a badge line over a row of figures, and Card's doc comment already names 'a workday row in Historial' as the reason that Pressable-wraps-Card convention exists.

Backend: ams KOL-65 (GET /api/v1/me/workdays) built in a separate worktree (ams-worktrees/kol-65-workday-history, branch feature/kol-65-workday-history), status Done, NOT merged to ams master — pending approval, same as KOL-64 before it.

date_label/weekday/status (the raw enum value) come back on the wire but are deliberately unread: dates are formatted client-side via dates.ts's own no-Intl table lookup (matching shifts-api.ts's own precedent), and status/status_label pass through verbatim per strings.ts's documented rule that domain vocabulary is server-labelled so it can never read one way on mobile and another on web.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Historial lists the employee's own workdays newest-first, each with a status badge in the server's own tone and the Trabajado / Extra / Faltante figures, or the leave type in their place on a day covered by an approved leave. A visible "Cargar mes anterior" action pages back a calendar month at a time — Res. 38 Art. 22.1's 5-year requirement met by the client moving from/to itself against an uncapped backend query, not a fixed window. Tapping a day opens an honest placeholder pending KMO-34's day detail.

Required an unplanned backend change, same as KMO-32 before it: no endpoint exposed the web self-service workday list as JSON. Built ams KOL-65 (GET /api/v1/me/workdays) in a separate worktree — reuses Workday::betweenDates and WorkdayStatus::badge() rather than duplicating that query — shipped and left on its own branch, not yet merged to ams master, pending approval.

New: src/features/jornada/{workdays-api,use-workdays,history-day-row,historial,day-detail-placeholder}.tsx with their tests, es.jornada.historial in the catalogue, and flows/kmo-33-historial.yaml.

Verified with npm run check (typecheck, lint, format, 1314 Jest tests, 81 suites) and live end-to-end against the ams KOL-65 branch — real seeded data, screenshots read by eye, including the load-older-month action appending July's data below August's without losing it. flows/kmo-33-historial.yaml passing on the same live branch.
<!-- SECTION:FINAL_SUMMARY:END -->
