---
id: KMO-34
title: Day detail with KPI tiles and attendance strip
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-16 19:07'
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
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Full-screen detail with four KPI tiles — Trabajado, Tiempo extra, Faltante, Entrada / Salida — and a strip plotting the day's punches against the scheduled window. Per docs/design-decisions.md §6 the strip axis is derived from the shift, not the mockup fixed 08:00-18:00, so night shifts and shifts crossing midnight render correctly. Each punch links to its comprobante, reusing GET /api/v1/marks/{mark} which already returns the full receipt fields (folio, hash) for any of the employee's own marks.

Reached by tapping a day in the Jornada tab's Historial (KMO-33), replacing the DayDetailPlaceholder bottom sheet it left in place. A day covered by an approved leave shows the leave type instead of the tiles/strip, mirroring how the Historial row itself already handles a leave day.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tapping a non-leave day in Historial opens a full-screen day-detail view (replacing the DayDetailPlaceholder sheet) titled with that day's own date label and status badge, matching the tone/text Historial already shows for that day
- [x] #2 The screen shows four KPI tiles — Trabajado, Tiempo extra, Faltante, and a combined Entrada / Salida tile showing the day's actual punch times as "HH:MM – HH:MM"
- [x] #3 An attendance strip plots the day's entrada and salida punches against an axis whose start and end are the day's own scheduled shift window, not a fixed 08:00-18:00 range
- [x] #4 A shift that crosses midnight (scheduled end earlier than scheduled start) renders the axis and both punch markers in the correct order and position rather than reversed or off the visible strip
- [x] #5 Tapping either punch marker opens that punch's own comprobante (type, date, time, worker, N° comprobante, hash) fetched by that punch's own id, not redrawn from the day-detail figures
- [x] #6 A day with zero or one recorded punches (a missing mark, or a day still without its second punch) shows the missing punch honestly on both the Entrada/Salida tile and the strip, rather than a marker at a fabricated position or a crash
- [x] #7 A day covered by an approved leave shows the leave type in place of the KPI tiles and the strip, the same treatment Historial's own row already gives it
- [x] #8 A failed load of the day's detail shows a retry that reloads only this screen
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Backend (ams, separate worktree, own ams ticket mirroring the KOL-65 shape — branch, implement, tests, left In Review, not merged by this ticket):
   - New App\\Http\\Resources\\WorkdayDetailResource: date, status_label, status_badge, shift_start, shift_end (HH:mm off Workday's shift_start_time/shift_end_time, null when no shift), worked_time, extra_time, missing_time, leave_type_label — same minimal snake_case shape and leave-day null-out convention as the existing WorkdayResource — plus mark_in/mark_out, each null or {time, mark_id}. mark_id is the one field the list resource does not need and this one does, so it is its own resource rather than WorkdayResource gaining a mode.
   - WorkdaysController::show(Request $request, string $date): parse $date, Workday::where('user_id', $user->id)->whereDate('date', $date)->with(['markIn','markOut','shift','leave'])->firstOrFail(), abort 404 when the employee has no computed workday for that date (a day before their hire, or one not yet rolled up) — the client shows this as the existing failed-load retry, since a date reached from Historial's own list should never legitimately 404.
   - Route::get('me/workdays/{date}', ...)->middleware('permission:ViewOwn:Workday')->where('date', '\\d{4}-\\d{2}-\\d{2}') beside the existing me/workdays route.
   - Feature tests: shift_start/shift_end reflect the assigned shift and are null without one; mark_in/mark_out each carry the punch's own mark_id; a leave day nulls the three time figures and carries leave_type_label; a day with only one punch nulls the other; 404 on a date with no workday row for this user; permission gating (403 without ViewOwn:Workday); a second employee's date 404s rather than 403 (route model resolution is scoped to the authenticated user, not just gated by permission).

2. Mobile — data layer (src/features/jornada/, self-contained per KMO-33's own reasoning: a feature never imports another feature, so this does not reach into features/marcaje/ for its API client or types):
   - day-detail-api.ts — GET /me/workdays/{date} client + parser (own WorkdayDetailResponseError, same defensive-parsing shape as workdays-api.ts). WorkdayDetail: date, statusLabel, statusTone, shiftStart/shiftEnd (NaiveTime | null), workedTime/extraTime/missingTime (string | null), leaveTypeLabel, markIn/markOut (each {time: NaiveTime, markId: number} | null).
   - use-day-detail.ts — loading/loaded/failed + retry for one date, same three-state shape use-upcoming-shifts.ts already establishes.
   - attendance-axis.ts — pure functions, no component: minutesSinceMidnight(NaiveTime), and buildAxis(shiftStart, shiftEnd, markIn, markOut) returning tick labels and each mark's 0-100 percent position, adding 1440 minutes to an end or a mark whose clock value is less than the shift start's — this is the one calculation that has to be right for #3/#4 and is easiest to prove correct as a pure function against fixtures (a normal day, a night shift, a shift crossing midnight, a day with only one punch) rather than folded into the strip component.
   - punch-receipt-api.ts — GET /marks/{id} client + a parser for the fields a *retrieved* receipt needs: type, datetime, hash, folio, employeeName, employeeRut, geoStatus, capturedOffline. Never the OfflineReceipt shape — a mark reachable from a computed workday has, by definition, already synced.

3. Mobile — presentation:
   - attendance-strip.tsx — the 'Asistencia del día' card: track, two markers (entrada tone-coloured per the day's status badge per the design, salida success-toned), axis tick labels from attendance-axis.ts. A null mark (AC#6) draws no marker rather than one at 0%.
   - kpi-tiles.tsx — the 2x2 grid: Trabajado, Tiempo extra, Faltante (danger-toned per the design), and the combined Entrada / Salida tile ('HH:MM – HH:MM', or '—' for a missing side).
   - punch-receipt-sheet.tsx — a confirmed-only receipt sheet sized down from marcaje's ReceiptSheet: the same Art. 13 rows (type, date, time, worker, RUT, folio, hash with copy-to-clipboard), the out-of-range and captured-offline notes when the retrieved mark carries them, but no OfflineReceipt branch and no offline icon/copy state, since every mark reachable here is already confirmed.
   - day-detail-screen.tsx — composes the header badge, kpi-tiles, attendance-strip (tapping a marker opens punch-receipt-sheet by that mark's id), leave-day treatment (leave sentence in place of tiles/strip, mirroring HistoryDayRow's own leave branch), the loading skeleton and LoadFailure+retry (Historial's own shapes).
   - src/app/jornada/[date].tsx — new route: useLocalSearchParams<{date: string}>(), Screen + OverlayHeader (back chevron, title = the day's own date label), renders DayDetailScreen. Historial's day rows push here (router.push(`/jornada/${day.date}`)) instead of opening DayDetailPlaceholder; DayDetailPlaceholder.tsx and its test are deleted.
   - src/i18n/strings.ts — es.jornada.dayDetail: tile labels, section title, leave-day sentence, load-failed retry text, comprobante sheet copy. Replaces the placeholder's dayDetail.{title,body,close}.

4. Tests written with the code: day-detail-api parsing (including the two-punch/one-punch/no-shift shapes), attendance-axis fixtures (ordinary day, night shift, midnight-crossing shift, one punch, matching AC#3/#4/#6), punch-receipt-api parsing, kpi-tiles/attendance-strip/punch-receipt-sheet rendering, day-detail-screen composition (loaded, leave day, failed+retry, marker tap), historial.test.tsx updated for the new push-to-route navigation in place of DayDetailPlaceholder.

5. flows/kmo-34-day-detail.yaml: sign in, Jornada tab, Historial, tap a day, assert the four tiles and the strip render, tap a punch marker, assert the comprobante's fields on screen, back twice to Historial.

Tier per criterion: #1, #2, #6, #7 — Jest (day-detail-screen, kpi-tiles) + Maestro for the visible render. #3, #4 — Jest fixtures against attendance-axis.ts (a night/midnight-crossing shift is not something an emulator can honestly fabricate) + Maestro for the ordinary-day visual. #5 — Jest (marker tap opens the sheet with the fetched fields, mocked api) + Maestro (tap marker on device, comprobante fields on screen). #8 — Jest (failed load, retry re-fetches).

Open decision for the user before implementation: punch-receipt-sheet.tsx duplicates a trimmed-down version of features/marcaje/receipt-sheet.tsx rather than importing it, per the feature-isolation rule and KMO-33's own precedent of a self-contained parser rather than reusing features/marcaje/*-api.ts. The alternative is promoting ReceiptSheet (or its Art. 13 row rendering) to src/ui/ as a shared presentational primitive, which would touch marcaje's existing files and tests for a second call site. Recommend the duplication, matching the established precedent and keeping this ticket from reshaping marcaje.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Backend: ams KOL-68 (GET /api/v1/me/workdays/{date}) built in a separate worktree (ams-worktrees/kol-workday-detail, branch feature/kol-68-workday-detail), extending Api\\WorkdaysController alongside KOL-65's index(). Left on its own branch, not merged to ams master, same as KOL-65 before it. shift_start/shift_end and each mark's time carry seconds (HH:mm:ss) rather than the list endpoint's display-trimmed HH:mm, so the client can read them as a real NaiveTime and do minute arithmetic rather than only display them.

attendance-axis.ts is the one piece of real arithmetic in this ticket: a punch reading earlier than the shift's own start only gets +24h added when doing so lands it inside the axis (i.e. the axis itself crosses midnight) — an early arrival on an ordinary same-day shift is clamped to the start rather than wrapped to the end. Caught by attendance-axis.test.ts's own clamping fixture before it reached a device.

Decision (asked and confirmed): punch-receipt-sheet.tsx duplicates a confirmed-only trimmed-down features/marcaje/receipt-sheet.tsx rather than importing it, per feature isolation and KMO-33's own precedent — recommended and chosen over promoting ReceiptSheet to src/ui/.

Verified: npm run check green (typecheck, lint, format, 1378 Jest tests, 89 suites). Live end-to-end against the ams KOL-68 branch: flows/kmo-34-day-detail.yaml and the updated flows/kmo-33-historial.yaml both pass (bin/e2e kmo-33, bin/e2e kmo-34), and the full suite (npm run test:e2e, 20 flows) shows no new failures — the two pre-existing failures (KMO-4, KMO-32) are in flows this ticket never touched and predate this branch (KMO-32's flow still expects the Historial placeholder KMO-33 replaced weeks ago). Screenshots read by eye: kmo-34-day-detail.png (tiles, strip, ticks 08:00..17:00) and kmo-34-punch-receipt.png (comprobante fetched by mark_id, matching the marcaje receipt's own Art. 13 layout).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Full-screen day-detail screen behind a Historial row, replacing the DayDetailPlaceholder sheet KMO-33 left in its place. Four KPI tiles (Trabajado, Tiempo extra, Faltante, Entrada / Salida) and an attendance strip whose axis is derived from the day's own scheduled shift (attendance-axis.ts), not the mockup's fixed 08:00-18:00 — verified against an ordinary day, a night shift and a shift crossing midnight in attendance-axis.test.ts and attendance-strip.test.tsx. Each punch marker opens that punch's own comprobante, fetched by its own mark_id through the existing GET /marks/{mark}, via a trimmed-down confirmed-only punch-receipt-sheet.tsx. A leave day shows the leave type in place of the tiles and the strip; a missing punch reads honestly as — rather than drawing a fabricated marker; a failed load offers a retry scoped to this screen.

New backend: ams KOL-68 (GET /api/v1/me/workdays/{date}), left on its own branch pending merge, same as KOL-65 before it. New route: src/app/jornada/[date].tsx. Verified with npm run check (1378 Jest tests) and live end-to-end on the emulator against the KOL-68 branch — flows/kmo-34-day-detail.yaml and flows/kmo-33-historial.yaml (updated for the real screen in place of its placeholder) both pass; the full 20-flow e2e suite shows no regressions.
<!-- SECTION:FINAL_SUMMARY:END -->
