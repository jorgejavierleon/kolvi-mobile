---
id: KMO-15
title: 'Home screen shell — greeting, shift card, clock and week summary'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-04 21:45'
labels:
  - mobile
  - marcaje
milestone: m-0
dependencies:
  - KMO-4
  - KMO-5
  - KMO-6
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Marcaje tab above the punch button, rendered from a single GET /api/v1/me/today call so the screen costs one request per app open rather than five. That endpoint is an external prerequisite in the ams repository.

Per docs/design-decisions.md §2 the colación row is read-only and labelled Colación (informativo) — there are no break punch buttons in this app.

Layout from the design, top to bottom: date and Hola {first_name} with the avatar button; the geolocation card (KMO-16); the shift card; the live clock and status line; the punch button (KMO-17); the week summary.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The header shows the capitalised long date and Hola, {first_name} with the avatar button opening the profile
- [ ] #2 The shift card shows the eyebrow Turno de hoy, the premise name, the scheduled window as start – end, and a divided row reading Colación (informativo) with the scheduled lunch window
- [ ] #3 The clock renders the current time as hh:mm and updates at least every 30 seconds without re-rendering the whole screen
- [ ] #4 The status line under the clock reads the state text for the current punch state, per the state machine in KMO-17
- [ ] #5 The week summary renders as {worked} / {total} hrs esta semana using the contracted weekly hours as the denominator
- [x] #6 The whole screen renders from one GET /api/v1/me/today response
- [ ] #7 An employee with no shift scheduled today sees an explicit Spanish empty state instead of a blank or zeroed shift card
- [ ] #8 A user without the ClockOwn:Mark permission does not see the punch surface, and an admin who also punches sees a working tab
- [x] #9 Loading shows skeletons rather than a spinner over an empty screen, and a failed load offers retry without losing the tab
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/i18n/strings.ts + index.ts — add the `es.marcaje` section: `shift.eyebrow` (Turno de hoy), `shift.lunch` (Colación (informativo)), the three `status` lines (Aún no marcas entrada / En jornada / Jornada finalizada) transcribed from the design's punchStatusLabels, the no-shift empty state (#7) and the load-failure copy. Add `greeting(firstName)` → `Hola, {nombre}`.

2. src/features/marcaje/punch-state.ts (+test) — the `PunchState` union ('before'|'working'|'done'), `parsePunchState` and `punchStatusLine`. KMO-15 owns the type and the status line (#4); KMO-17 adds the button labels and the transitions on top of it rather than restating the union.

3. src/features/marcaje/today-api.ts (+test) — the GET /me/today contract and `parseTodaySummary`. Uses the @/api singleton (a 401 here should end the session, unlike the auth endpoints). Times parse through `naiveTime` so an ISO instant cannot enter as a shift window. A malformed body fails the load rather than degrading to a plausible-looking screen.

4. src/features/marcaje/use-today.ts (+test) — loading → loaded | failed, with `reload()`. Exactly one request per mount, which is #6.

5. src/features/marcaje/now-clock.ts (+test) — the device wall clock as naive date + time parts, and `useNowClock()` ticking on a 30s interval. The reading is held in state, never derived during render: React Compiler memoises render-time computation on tracked inputs and `Date.now()` is not one, which is the freeze KMO-50 hit. Explicitly a display clock and never a legal timestamp — the server assigns those.

6. src/features/marcaje/clock.tsx (+test) — the display clock and the status line under it (#3, #4). Its own component holding its own tick state, so 30s ticks re-render it and nothing else.

7. src/features/marcaje/shift-card.tsx (+test) — eyebrow, premise, `start – end`, and the divided `Colación (informativo)` row (#2); the explicit Spanish empty state when no shift is scheduled (#7). The colación row is omitted when the shift carries no lunch window rather than drawn with an em dash.

8. src/ui/skeleton.tsx (+test) — a tinted block primitive for #9. Holds no domain knowledge, so ui/ rather than features/.

9. src/ui/screen-header.tsx — add an optional `eyebrow` prop for the date line the design draws above `Hola, {nombre}`. Presentational and generic; the existing title-only tabs are unaffected.

10. src/features/marcaje/home-screen.tsx (+test) — composes the header (long date + greeting + avatar → /perfil), the shift card, the clock, the punch surface and the week summary; skeletons while the request is in flight and a failure card with Reintentar that leaves the tab intact (#9). The status line and the punch-button region KMO-17 will fill render only under `can('ClockOwn:Mark')` (#8); the clock, shift card and week summary do not, so an admin who only punches and an employee who cannot both get a working tab.

11. src/app/(tabs)/index.tsx — collapses to `<HomeScreen />`. SectionScaffold stops being rendered by Inicio.

12. flows/kmo-15-home-screen.yaml — the device tier for what a device can honestly show today: #1 end to end against the real session (the capitalised long date, `Hola, Empleado`, the avatar opening Mi perfil) and the failed-load half of #9, which the missing endpoint produces naturally.

13. README.md — the Project status paragraph: Inicio is no longer scaffolded, and the KOL-5 line is stale (permissions now arrive on /api/v1/user).

Tiers. Jest carries #2–#8 as isolated rendering against a fixture response, and #6 by counting requests. Maestro carries #1 and the retry half of #9. The rest of the device tier is blocked on ams shipping GET /me/today — including the React Compiler half of #3, which Jest cannot see because it does not run the compiler. Those criteria stay unchecked with a note rather than being signed off on a Jest render.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions taken during implementation.

- **The wire contract is defined here, not consumed.** `GET /api/v1/me/today` 404s on the local `ams`, so `src/features/marcaje/today-api.ts` is currently the only written form of the contract. Shape: `{date, shift:{premise,start_time,end_time,lunch_start_time,lunch_end_time}|null, punch:{state}, week:{worked_hours,contracted_hours}}`. Approved by the user before implementation.
- **The punch surface is the status line plus the button region KMO-17 will fill; the clock is not.** The design gates only the button, but that button belongs to KMO-17, so gating nothing visible would have left #8 unverifiable here. The clock stays visible because it is the screen's ambient time and hiding it leaves a hole where the design's largest element is.
- **A malformed response fails the load rather than degrading.** Dropping unparsed fields would render a screen that looks like a normal day off, or like an employee who has not punched, from a response that said neither. `TodayResponseError` → the retry state.
- **An unknown or absent punch state shows no status line.** Rounding it down to `before` would tell an employee who punched in at 08:00 that they have not marked entrada.
- **`now-clock.ts` is the one module that reads `Date`**, and holds its reading in state rather than deriving it during render — a render-time `readNow()` freezes under React Compiler exactly as KMO-50's countdown did, and Jest cannot see it.
- **`ams` KOL-5 has shipped**: `/api/v1/user` now returns `first_name` and a flat `permissions` array, so `can()` answers from the real set. The README paragraph saying otherwise was stale and was corrected (it also still claimed sign-out was unbuilt; KMO-12 is Done).

Observed while verifying, not acted on: `ams` answers repeated logins with a 422 carrying the *credentials* message rather than a 429, for roughly a minute. It cleared on its own. KMO-50 handles a real 429; this looks like a separate `ams`-side lockout path and is not in this ticket's scope.

## Which criteria are checked, and why the rest are not

Checked:

- **#1** — Jest (`home-screen.test.tsx`: the long date, the greeting, the `first_name`-null fallback, the avatar) **and** on device: `flows/kmo-15-home-screen.yaml` asserts the capitalised weekday with a lowercase month against the real session, and taps the avatar through to Mi perfil. Screenshot `.artifacts/e2e/KMO-15 home screen shell/takeScreenshot/kmo-15-header.png`.
- **#6** — `today-api.test.ts` proves the client asks `GET /me/today` once and nothing else; `use-today.test.ts` proves one request across re-renders; `home-screen.test.tsx` proves every element the other criteria name is on screen after that single call, and that a clock tick does not re-ask.
- **#9** — Jest for the skeletons, the named loading state, the retry and the recovery; on device for the failed half, which the missing endpoint produces naturally — the flow asserts the Spanish message, the retry, that no Laravel English reached the screen, that the header and tab bar survived, and that the tab is still navigable afterwards.

**Left unchecked — all of them blocked on `ams` shipping `GET /api/v1/me/today`.** Each has full Jest coverage against a fixture, but Jest renders a component in isolation and these are criteria about what an employee sees on a phone, which is the Maestro tier. Checking them off a Jest render would be signing off at a cheaper tier than the criterion can honestly carry.

- **#2** shift card — `shift-card.test.tsx` (eyebrow, premise, en-dash window, the divided colación row, no punchable colación control) and `home-screen.test.tsx`.
- **#3** clock — `clock.test.tsx` proves hh:mm, the 30s tick, and that a tick re-renders the clock and not its siblings. **The device half is the important one and is missing**: a clock derived during render freezes under React Compiler, and Jest does not run the compiler — this is precisely the failure KMO-50 hit, and only a device can show it. `now-clock.ts` holds the reading in state for that reason, but the proof is owed.
- **#4** status line — `clock.test.tsx` covers all three states and the no-state case.
- **#5** week summary — `home-screen.test.tsx` covers the format, the es-CL comma, and omission when the server sends no week.
- **#7** empty state — `shift-card.test.tsx` and `home-screen.test.tsx`.
- **#8** permission gate — `home-screen.test.tsx` covers all four cases including the admin who carries only `ClockOwn:Mark`/`ViewOwn:Mark`. Now verifiable on device too, since KOL-5 shipped, but only once there is a screen behind the gate to see.

Validation: `npm run check` green — typecheck, lint, format, 747 Jest tests across 49 suites. `bin/e2e kmo-15` passed in 49s.
<!-- SECTION:NOTES:END -->
