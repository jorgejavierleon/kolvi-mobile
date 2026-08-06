---
id: KMO-17
title: Punch action and the before/working/done state machine
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-06 15:25'
labels:
  - mobile
  - marcaje
  - compliance
milestone: m-0
dependencies:
  - KMO-16
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The single most important interaction in the app. Goal G1 is time-to-punch under 10 seconds from app open at p90.

Per docs/design-decisions.md §2 there are exactly three states and one entrada and one salida per day. The server assigns the legal timestamp; the app does not send one for an online punch.

| State | Status line | Primary button |
|---|---|---|
| before | Aún no marcas entrada | Marcar entrada |
| working | En jornada | Marcar salida |
| done | Jornada finalizada | replaced by the success panel |
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The primary button is at least 64pt tall, full width, coral, with the display font, and shows a spinner in its loading state
- [x] #2 The three states drive the status line and the primary label exactly as tabulated in the description
- [x] #3 The done state replaces the punch button with the success panel reading Jornada finalizada and Nos vemos en tu próximo turno
- [x] #4 The punch request carries no client-supplied timestamp; the server-assigned time is what the receipt displays
- [x] #5 The reported latitude, longitude and accuracy are sent when available, and their absence is sent explicitly rather than omitted
- [x] #6 The button cannot be double-tapped into two punches, including on a slow network
- [x] #7 A server rejection because the punch already exists for today renders as a friendly Spanish state, never as an error dialog
- [x] #8 A failed punch leaves the state unchanged and offers retry without the employee losing their place
- [ ] #9 The button remains legible and operable in direct sunlight and with gloves, verified on a physical mid-range Android
- [x] #10 A successful punch transitions the state and opens the comprobante sheet built in KMO-19
- [x] #11 A punch made without a location fix — permission permanently denied, or no signal — is recorded rather than blocked, and travels with geo_status unknown (carried over from KMO-16 #7)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/i18n/strings.ts — add `es.marcaje.punch`: `entrada: 'Marcar entrada'`, `salida: 'Marcar salida'`, `doneBody: 'Nos vemos en tu próximo turno'` (the panel title reuses `es.marcaje.status.done`, so 'Jornada finalizada' keeps one spelling), plus the two failure sentences — already-marked (#7) and punch-failed (#8). Covered in strings.test.ts.
2. src/features/marcaje/punch-state.ts — extend the existing machine rather than restate it: `punchTypeFor(state)` (before→'in', working→'out', done→null), `punchActionLabel(state)` and `stateAfterPunch(type)`. #2 then has one source for both the status line and the button label.
3. src/features/marcaje/punch-api.ts + punch-api.test.ts — `POST /marks` through the `@/api` singleton, same shape as today-api.ts. The body always carries `{type, lat, lng, accuracy_m, geo_status}` with explicit nulls rather than omitted keys (#5, #11), and carries **no datetime** (#4). The 201 is parsed into `PunchReceipt {markId, type, datetime: NaiveDateTime, hash, folio, geoStatus}`, failing loudly on a body that is not one. A rejection meaning the punch already exists today is classified into its own error so the screen can answer it calmly (#7).
4. src/features/marcaje/use-punch.ts + test — `idle | submitting | failed | duplicate`, an in-flight ref latch so two taps make one request even on a slow link (#6), the receipt held on success, an `onPunched(receipt)` seam for KMO-19 (#10), and the punch state left exactly as it was on any failure (#8).
5. src/features/marcaje/punch-action.tsx + test — the slot under the clock. before/working: Button `variant="accent" size="lg"`, full width, 64dp minimum, display font, spinner while in flight (#1). done: the success panel on the success tint — Jornada finalizada over Nos vemos en tu próximo turno, replacing the button entirely (#3). A failure renders a Spanish line and Reintentar beneath the unchanged button; a duplicate renders the friendly line — neither is a dialog (#7, #8).
6. src/features/marcaje/home-screen.tsx — wire PunchAction under Clock inside the existing `canPunch` gate, hand it the fix and geoStatus from useLocation, hold the punched state locally so the transition is immediate, and `today.reload()` after a duplicate so the screen corrects to what the server has.
7. src/theme/shadows.ts — add `shadows.accent`, the design's `0 8px 24px rgba(255,79,94,.35)` glow under the punch button, expressed as `withAlpha(colors.accentCoral, .35)`. THEME CHANGE — needs approval.
8. flows/kmo-17-punch.yaml — sign in, assert Marcar entrada, punch, assert En jornada over Marcar salida, punch, assert the success panel. Header comment naming #1, #2, #3.

Tiers: Jest carries #1–#8 and #11's wire half; Maestro carries #1, #2, #3 and #11's device half; #9 is physical-device only and cannot close on my run; #10 is owed to KMO-19, which builds the sheet this ticket only opens.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**KMO-16 #7 was carried here as #11.** The criterion is about a punch, and KMO-16 has no button to punch with — it built the state behind it instead. What is already done and does not need rebuilding:

- `useLocation` in `src/features/marcaje/use-location.ts` reports `punchAllowed: true` and `geoStatus: 'unknown'` for a permanently denied permission, and `fix: null`. `punchAllowed` is false for `outside` (KMO-18 reopens it with the override) and for the two transient states.
- `use-location.test.ts` proves that mapping; `flows/kmo-16-settings-route.yaml` shows the tab whole on a device with the permission refused for good.

What #11 adds is the half only a punch can show: that the request actually goes, and that `geo_status` travels on it. That is the same wire as #5, so the two are one piece of work.

Also unbuilt and untracked, and this ticket will need it: the **server-side** geofence evaluation on `POST /api/v1/marks` — PRD §6 item 2, haversine at punch time against `Premise.geofence_radius_meters` (shipped by `ams` KOL-33), persisting `inside | outside | unknown` alongside the reported accuracy. KOL-33 deliberately excluded it. The client's own evaluation is advisory and must never be treated as the answer (docs/design-decisions.md §2).

**The server side is tracked as `ams` KOL-34** — "Make POST /api/v1/marks server-authoritative: timestamp, geofence verdict and the one-per-day guard", HIGH, depends on KOL-33.

`POST /api/v1/marks` as it stands cannot serve four of this ticket's criteria, read from `~/Work/ams`:

- `MarkController::store` validates `'datetime' => ['required', 'date']` — the opposite of #4 and of docs/design-decisions.md §2.
- It accepts `lat`/`lng` only. No accuracy, no `geo_status`, no columns for either, and no geofence evaluation — #5 and #11's wire half.
- `MarkManager::createMark` has no one-in-one-out guard, so nothing produces the rejection #7 is about. `TodayController::punchState` already derives `before|working|done` from that rule, so the read side and the write side currently disagree.
- `MarkResource` emits `toIso8601String()`, an offset-stamped datetime this app's parser rejects at the boundary by design.

The client is built to the contract KOL-34 specifies — `punch-api.ts` is the authoritative reading, as `today-api.ts` was for KOL-31 and KOL-33. Until KOL-34 lands, #4, #5, #7 and #11 carry Jest evidence only and their device half is owed.

## What was built

Five files under `src/features/marcaje/`, in the shape the rest of the screen already has — the hook decides, the component draws, the route composes:

- `punch-api.ts` — `POST /marks`. The request body is one object literal with no conditional keys, deliberately: this is the file where a forgotten `datetime` or a dropped `lat` would be a compliance bug, and both are visible in one read. `DuplicateMarkError` is raised off **409 Conflict and nothing else** — `ApiError` keeps only `message` and Laravel's `errors` bag, so a body `code` would not survive the transport layer, and matching on the Spanish sentence would make a compliance behaviour depend on wording somebody may improve.
- `use-punch.ts` — the attempt, the in-flight ref latch, and the state. The state it draws is the server's *advanced by what it has since recorded*, never the other way round: a reload is `/me/today` correcting the screen, and it should.
- `punch-action.tsx` — one component, not two. The button and the success panel are the same slot, and splitting them would let a screen render both, which is a finished day still offering to finish.
- `punch-state.ts` gained `punchTypeFor`, `punchActionLabel` and `stateAfterPunch`, so the status line and the button label come from one machine.
- `GeoStatus` moved from `use-location.ts` to `geofence.ts` and is re-exported. It is now read at both ends — what the app sends and what the server answers — and the api module had no business importing a hook for a type.

**The state advances off the receipt, never off the tap.** `stateAfterPunch(receipt.type)`, not `stateAfterPunch(type)`. A screen that moved because a button was pressed would be an app claiming an attendance record that may not exist.

**`shadows.accent` was added to the theme** — the design's `0 8px 24px rgba(255,79,94,.35)`, as `withAlpha(colors.accentCoral, .35)`. Approved by the user before implementation, along with using `typography.h3` for the label rather than adding a ninth type token for the design's 18px: AC #1 asks for the display font, and 2px on a 64dp button is not what an employee outdoors is struggling with.

**The button is not disabled in the out-of-range state, and that is deliberate.** `useLocation.punchAllowed` exists and this ticket does not read it. KMO-18 #1 and #3 disable the primary action *and* add the two escape hatches beneath it, and they have to arrive together: disabling now, with no override, would leave an employee standing outside a geofence unable to record attendance at all — which is the one thing docs/design-decisions.md D-F1-c forbids. `PunchAction` takes a `disabled` prop for KMO-18 to wire.

**The success panel's subtitle is drawn at full strength**, not at the design's `opacity:.8`. Success foreground on the success tint is already close to the contrast floor, and this panel is read outdoors.

## Which criteria are checked, and why the rest are not

Checked:

- **#1** — `punch-action.test.tsx` asserts full width, `minHeight >= 64`, `colors.accentCoral`, the display family, and the spinner appearing in the loading state with the label kept. On the device the button measured **975 × 168 px at density 2.625 = 372 × 64 dp**, read off the view hierarchy — full width inside the screen's own padding. Screenshot `.artifacts/kmo-17-button.png`.
- **#2** — all three rows read on screen. `before` on the live app (`kmo-17-button.png`); `working` and `done` by writing the marks straight into the register, since no punch can complete against `ams` yet: `En jornada` over `Marcar salida`, then `Jornada finalizada`. `flows/kmo-17-punch-button.yaml` asserts the `before` row and its pairing in the suite; `home-screen.test.tsx` walks all three, which is where the *transitions* are proven.
- **#3** — `.artifacts/kmo-17-jornada-finalizada.png`: the panel on the success tint reading `Jornada finalizada` over `Nos vemos en tu próximo turno`, and `punch-button` absent from the hierarchy rather than disabled in it. Jest covers the same in isolation.
- **#5** — `punch-api.test.ts` asserts the request body exactly: the five keys in order, the fix and its accuracy in `ams`' spelling, and — for a phone with no fix — `lat`, `lng` and `accuracy_m` all present and explicitly `null`, checked with `Object.hasOwn`. Jest is the honest tier here and stays the honest tier after KOL-34: no device tier can see a request body.
- **#6** — `use-punch.test.ts` with a deferred promise, which is exactly what "a slow network" is: three taps inside one act scope make one request; a second tap after the `submitting` state has landed still makes one; the latch reopens once the first settles, and reopens after a failure. `punch-action.test.tsx` proves the button independently blocks the second *press*. The ref rather than a read of state is the whole point — `setAttempt` lands a render later, so on a slow link the second tap arrives while the button still believes it is idle.
- **#8** — on the device, against the live `ams`. The punch was refused; the state stayed `Aún no marcas entrada`, the button kept `Marcar entrada` and stayed pressable, and the refusal rendered as a Spanish line beneath it with no dialog anywhere (`.artifacts/kmo-17-punch-refused.png`). Jest covers the state being untouched, no receipt being recorded, and the latch reopening.

Left unchecked:

- **#4** — the first clause is proven twice over: `punch-api.test.ts` asserts the body has no `datetime` key at all, and the live `ams` answered `El campo datetime es obligatorio.`, which is the server itself confirming the app sent none. The second clause — that the server-assigned time is what the **receipt displays** — has no surface: no punch has ever succeeded against any server, and the sheet that would display it is KMO-19. Checking it would be signing off on a time nobody has seen.
- **#7** — the client half is built and proven (`DuplicateMarkError` off 409, a calm line, `/me/today` reloaded so the screen ends up showing the register). But the criterion is about *a server rejection*, and no server rejects that way: `MarkManager::createMark` has no one-per-day guard. KOL-34 is what produces it.
- **#9** — physical-device tier by definition. Sunlight and gloves cannot be reproduced on an emulator, and a run that "passed" it would mean nothing. Owed on a mid-range Android.
- **#10** — the seam is built and tested: `usePunch` holds the receipt and calls `onPunched(receipt)`. The sheet it opens is KMO-19, which depends on this ticket, so nothing here can open it yet.
- **#11** — half proven on the device, and the half that matters most for it: with the permission refused for good (`bin/device perm deny-forever`), the card reads `Sin permiso de ubicación` and the button is still there, still pressable, and the request goes — it is refused by the server for the missing `datetime`, not blocked by the app (`.artifacts/kmo-17-no-permission.png`). Jest proves the wire half — `{lat: null, lng: null, accuracy_m: null, geo_status: 'unknown'}`. What is missing is *recorded*, which is KOL-34 again.

## Validation

`npm run check` green: typecheck, ESLint, Prettier, **912 Jest tests across 57 suites**, up from 827/54.

**Maestro: `flows/kmo-17-punch-button.yaml` passes, in the suite.** `flows/kmo-17-punch.yaml` walks the whole day and is tagged `requires-punch-endpoint`, excluded until KOL-34 lands; it is also single-use per seed, since the register keeps one `in` and one `out` per day.

**The full suite reported 11/15, and none of the four failures is this branch's.** KMO-8, KMO-9 and KMO-15 all pass on their own runs here; KMO-14 was already red before this branch (recorded on KMO-16). The suite failure mode is the one KMO-16 documented — the dev client degrades with each `clearState` cold start — and this time it ended in a native `SIGSEGV` in `libreactnative.so` on the JS thread, with the app gone and the flow looking at the launcher. Checked properly rather than assumed: KMO-8 was run on `master` (passed, 56s) and then again on this branch (passed, 56s), so the branch is not the cause.

**Two probe marks were written into the local `ams` demo data** to reach the `working` and `done` states, and both were force-deleted afterwards. `employee@example.com` is back to an unpunched day, which is what `kmo-17-punch-button.yaml` needs.

## After KOL-34 shipped

`POST /api/v1/marks` now serves the contract `punch-api.ts` was written against, and **it needed no change on this side.** Read against the client parser before running anything: `datetime` is `['prohibited']`, the four location keys are nullable, the duplicate answers `409` with a real Spanish sentence out of `lang/es/ui.php` (`ui.marks.api.already_marked.{in,out}`), `MarkResource` emits `date_time->format('Y-m-d H:i:s')`, and `geo_status` is nullable — which this parser already reads as `unknown`, and which `MarkResource`'s own comment says means the same thing.

**#4, #7 and #11 are now checked, all three on the device against the live `ams`, with the register inspected afterwards rather than the screen taken at its word.**

- **#4** — punched from the app; the row landed as `2026-08-05 21:40:28`, the server's own stamp in the employee's timezone, matching the clock on screen. The app sent nothing: `datetime` is `prohibited` server-side now, so a request carrying one would 422, and the punch succeeded. The receipt the app holds is parsed from that response and from nothing else.
- **#5** — re-confirmed end to end rather than in Jest alone. The same row carried `lat=-33.448900 lng=-70.669300 accuracy_meters=5.00`, and the server's own verdict `geo_status='inside'` — measured by its haversine against the premise, not taken from what the client reported.
- **#7** — arranged honestly: the `out` was recorded straight through the API (`201`, `mark_id=207`) so the register held it and the app did not know. Pressing `Marcar salida` then produced the real `409`, and the screen answered with `Esta marca ya estaba registrada. Actualizamos tu jornada.` on the neutral tint, reloaded `/me/today`, and settled on `Jornada finalizada` with the success panel. No dialog anywhere. Screenshot `.artifacts/kmo-17-duplicate.png`.
- **#11** — the whole criterion, not half of it. With the permission refused for good (`bin/device perm deny-forever`) the punch went and **was recorded**: row 208, `lat=NULL lng=NULL accuracy_meters=NULL geo_status='unknown'`. The card read `Sin permiso de ubicación` throughout and the screen advanced to `En jornada`.

**The app shows its own sentence for the duplicate, not the server's.** `ams` now sends `Ya registraste tu entrada de hoy.`, which is good Spanish and is kept on `DuplicateMarkError.cause`. The screen shows `es.marcaje.punch.alreadyMarked` instead — a deliberate exception to the server-message-wins rule, and the only one in this feature: our sentence also says *Actualizamos tu jornada*, which is the half the employee needs to explain why the button moved under their thumb. The server has no way to know the screen reconciled.

**`flows/kmo-17-punch.yaml` now passes** — the whole day driven by Maestro in 50s, `before → working → done`, and the two marks were confirmed in the register afterwards. Its tag changed from `requires-punch-endpoint` to **`requires-unpunched-day`**, because the reason it stays out of the suite has changed rather than gone away: the punches are real now and the flow *spends* the day it needs, so a second run finds a day it already closed. `kmo-17-punch-button.yaml` needs the same unpunched day and stays in the suite because it does not press the button.

One thing worth knowing when reading those rows: the flow's marks carry no fix. `clearState` in `shared/launch.yaml` resets the app's runtime permissions, so its punches are made by an employee who has not granted location and travel as `unknown`. The flow header now says so.

`npm run check` still green — 912 tests, 57 suites; nothing in `src/` changed for KOL-34. `kmo-17-punch-button.yaml` failed once on a cold AVD with the same `Ingresar`-visible signature as the earlier flakiness and passed on the immediate re-run.

All probe data was removed: marks 206–210 force-deleted and the `probe` token revoked. `employee@example.com` is back to an unpunched day.

## Closing with #9 and #10 unchecked

Both stay unchecked because neither has evidence, not because they were forgotten — and the two are open for different reasons.

- **#9** — the user waived it as a blocker on closing this ticket. Nothing about the criterion changed: sunlight and gloves need a physical mid-range Android, an emulator run that "passed" them would be worthless, and the button has never been in front of either. It is a real gap in the record and the button's outdoor legibility is still unproven. What is known is what shaped it: 64dp minimum, full width, the app's one coral on a pale page, the display font, and a glow that separates it from everything else on the screen.
- **#10** — carried to **KMO-19**, which builds the sheet this ticket only opens. Recorded there in that task's notes, along with what is already wired (`onPunched(receipt)`, `punch.receipt`, the `PunchReceipt` shape) and the one thing still missing on the wire: `MarkResource` sends no worker name, no RUT and no folio, so KMO-19's Art. 13 detail block needs a companion `ams` ticket that nobody has written yet.

Nine of eleven checked, every one of them against evidence that can be re-run.

**#10 is now verified and checked**, from KMO-19's branch as that ticket's notes said it would be. `flows/kmo-19-comprobante.yaml` punches on the device and waits for `¡Marca registrada!`: the sheet rises from the receipt the server answered with, and the day underneath moved to `Marcar salida` behind it. `home-screen.test.tsx` covers the same seam at the Jest tier — the sheet opens on a 201 and stays shut on a punch that failed.

#9 remains open and still needs the physical-device tier: sunlight and gloves are not things an emulator can be made to honestly pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the punch — `punch-api.ts`, `use-punch.ts` and `punch-action.tsx` under `src/features/marcaje/`, wired into the home screen under the clock. The request carries no timestamp and never can (the server assigns the legal time, Art. 11 / design-decisions §2) and sends the fix, its accuracy and the client's advisory geofence verdict with explicit nulls where there is nothing to report. Two taps make one punch, the state advances off the receipt rather than off the tap, a refusal leaves the day untouched with the button as its own retry, and a punch the register already holds is a calm Spanish line plus a reload rather than an error. `shadows.accent` was added to the theme for the design's coral glow, approved beforehand.

Verified with `npm run check` green (912 tests, 57 suites), both Maestro flows passing, and — once `ams` KOL-34 shipped — the whole thing driven on the emulator against the live server with the register inspected afterwards: the server-stamped time, the fix and its accuracy and the server's own `inside` verdict on the row, a real 409 rendered as a calm state, and a permission-denied punch recorded with `geo_status='unknown'` rather than blocked. KOL-34 needed no change on this side; the parser was already written to it.

**Nine of eleven criteria are checked.** #9 needs a physical mid-range Android — sunlight and gloves are not reproducible on an emulator, and a run that passed them would mean nothing. #10 opens the comprobante sheet that KMO-19 builds; the `onPunched(receipt)` seam is built and tested, but KMO-19 depends on this ticket, so nothing here can open it yet.
<!-- SECTION:FINAL_SUMMARY:END -->
