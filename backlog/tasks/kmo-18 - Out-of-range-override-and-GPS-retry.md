---
id: KMO-18
title: Out-of-range override and GPS retry
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-06 13:13'
labels:
  - mobile
  - marcaje
  - geo
  - compliance
milestone: m-0
dependencies:
  - KMO-17
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The escape hatches beneath the primary button. Per docs/design-decisions.md §2 an out-of-range punch is recorded and flagged, never blocked — refusing to record a punch an employee actually made is worse than recording a suspect one, and Res. 38 treats the register as the legal record.

The override is deliberately worded so the employee knows the punch will be reviewed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the out-of-range state the primary button is disabled and a secondary button reads Marcar de todas formas (queda pendiente de revisión)
- [ ] #2 The override records a real punch that the server flags as out of range, and the resulting receipt shows the pending-review line
- [x] #3 In the no-signal state the primary button is disabled and a secondary button reads Reintentar ubicación
- [x] #4 Retry re-acquires the location and updates the card, showing a loading state while it works
- [x] #5 A retry that succeeds into the confirmed state enables the primary button without requiring a screen reload
- [x] #6 Neither secondary button appears in the confirmed state
- [x] #7 Both secondary buttons meet the 44px minimum hit target
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/i18n/strings.ts (+ strings.test.ts) — two strings, both verbatim from the design: `es.marcaje.punch.override` = 'Marcar de todas formas (queda pendiente de revisión)' and `es.marcaje.location.retry` = 'Reintentar ubicación'. The override lives under `punch` because it performs one; the retry lives under `location` because it re-reads the phone.

2. src/ui/button.tsx (+ button.test.tsx) — add a fifth variant, `warning`: transparent background, 1px `tones.warning.foreground` border, same foreground. The design draws the override as a warning-toned outline, which is exactly the shape `danger` already has with a different tone. UI PRIMITIVE CHANGE — needs approval. The retry button needs nothing new: `variant="secondary" size="sm"` is the design's border and text colour already, and `sm` is `hitTargetMin` (44), which is #7.

3. src/features/marcaje/use-location.ts (+ test) — expose `retrying`, true only while an acquisition the employee asked for is in flight. Needed because a retry moves the state to `acquiring`, and a retry button that vanished the moment it was pressed is the control disappearing under the thumb. `run()` takes the flag, `retry()` sets it, focus clears it.
   Same file: DELETE `punchAllowed`. It reports false for `acquiring`, and the design's own `primaryDisabled = geoOutside || geoNoGps` does not — disabling for the up-to-12s a cold fix takes would put a dead button with no escape hatch in front of goal G1. Nothing in src/ reads it. NEEDS APPROVAL: it is a seam KMO-16 built for this ticket, and this ticket is declining it.

4. src/features/marcaje/punch-action.tsx (+ test) — replace the `disabled` prop with a `hold`:
   `{kind:'outside'; onOverride} | {kind:'noSignal'; onRetry; retrying} | null`.
   The primary is disabled iff there is a hold, so the type makes it impossible to disable the button without shipping the way out of it — which is D-F1-c expressed in the signature rather than in a comment. The secondary renders under the primary at the slot's existing 10px gap (the design's `margin-top:10px`), inside the same branch as the button so it is absent in `done` (#6), and the disabled primary carries the card's own title as its `accessibilityHint`.

5. src/features/marcaje/home-screen.tsx (+ test) — derive the hold from `location.state` and `location.retrying`; `onOverride` is `punch.punch` itself. The override sends no extra flag: `geoStatus` already travels as 'outside' and the server runs its own haversine (KOL-34), so an override is the same request made deliberately, not a different one.

6. src/ui/gallery.tsx — the warning variant on the device beside the other four, for flows/kmo-3.

7. flows/kmo-18-out-of-range.yaml — tagged `requires-geo-off-premise` like kmo-16's: the primary disabled, the override's exact sentence, no `Reintentar ubicación`.

8. flows/kmo-18-gps-retry.yaml — tagged `requires-gps-off`: the primary disabled, `Reintentar ubicación`, tapping it, and the card returning to `Buscando tu ubicación`.

Tiers. Jest: #1, #3, #4, #5, #6, #7 in isolation, plus the transition #5 is really about. Maestro: #1, #3, #4, #6, #7's rendered bounds. By hand on the device against live `ams`: #2's punch half — override from outside the geofence, then read `geo_status` off the row — and #5, because flipping the GPS switch mid-flow is not something Maestro can do.
#2's second clause — 'the resulting receipt shows the pending-review line' — has no surface to show: the comprobante sheet is KMO-19 (its own #7 is the same line). It is owed there, the way KMO-17 #10 was.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Built

Five files changed under `src/`, plus two flows.

- `src/ui/button.tsx` — a fifth variant, `warning`: transparent, 1px `tones.warning.foreground` border, same foreground. The design draws the override as a warning-toned outline, which is the shape `danger` already had with a different tone. Its own tone rather than a dimmed `danger` because an override is a way forward, not a destruction — drawing it in the red the app uses for `Rechazar` would read as a refusal to an employee being offered the one action left to them. Approved by the user before implementation.
- `src/i18n/strings.ts` — `es.marcaje.punch.override` and `es.marcaje.location.retry`, both verbatim from the design. The retry is deliberately not `es.actions.retry`: that one asks the server for the day again, this one asks the phone where it is, and the bare verb under `Sin señal de GPS` would not say which.
- `src/features/marcaje/use-location.ts` — `retrying`, and `punchAllowed` deleted.
- `src/features/marcaje/punch-action.tsx` — `PunchHold` replaces the `disabled` prop.
- `src/features/marcaje/home-screen.tsx` — derives the hold and hands it down.

**The `disabled` prop became a `hold` that carries its own escape hatch.** `{kind:'outside', onOverride} | {kind:'noSignal', onRetry, retrying} | null`. There is now no way to express a disabled punch button with nothing beneath it — D-F1-c stated in the type system rather than in a comment somebody has to remember. `punch-action.test.tsx` asserts it anyway, for the day that stops being true.

**`punchAllowed` was deleted rather than read.** KMO-16 built it for this ticket and it reports false for `acquiring`; the design's own `primaryDisabled` is `geoOutside || geoNoGps` and nothing else. A button dimmed for the twelve seconds a warehouse GPS start can run, with nothing under it to press, is goal G1 spent on a dead control — and it is the one state where a hold could not carry an escape hatch, because there is no action that helps except waiting. Nothing in `src/` read it. User approved the deletion before implementation.

**`retrying` exists because `acquiring` cannot say who asked.** A retry moves the state back to `acquiring`, so without it the button would vanish the instant it was pressed — a control disappearing under the thumb reads as a tap that did nothing. With it the retry stays put and spins. False for the acquisition every focus starts, and for the one behind the rationale: neither is anybody's action.

**The override sends nothing extra.** It calls `punch.punch` itself. `geoStatus` already travels as `outside` and `ams` KOL-34 runs its own haversine, so an override is the same request made deliberately — which is exactly what the label above it warns about. A second code path would have been a second thing that can disagree with the server.

`npm run check` green: 944 tests across 57 suites, up from 912.

## Device tier — blocked on an unpunched day

The emulator holds a **closed day**: `GET /me/today` reports `punch.state = done`, from marks 211 (`in`) and 212 (`out`) left behind by KMO-17's `flows/kmo-17-punch.yaml` run tonight. A closed day replaces the punch button with the success panel, so none of KMO-18's states can be reached on the device: #1, #3, #4 and #7 all describe a button that is not currently rendered, and #2 needs a punch that is still available to make.

Clearing those two marks was **denied by the sandbox** — `docker compose exec laravel.test php artisan tinker` against the local `ams` is blocked, both the force-delete and a read-only listing. Raised with the user rather than worked around.

What was verified on the device in the meantime, through `kolvi://gallery`, which needs no punch state:

- The `warning` variant renders as the design draws it — amber outline, amber label, transparent so the page tint reads through, and visibly not the red of `Rechazar` directly beneath it. `.artifacts/kmo-18-warning-variant.png`.
- **#7's measurement, on the device**: the `warning` button at `size="sm"` measures **1028−53 × 1017−901 px at density 420 (×2.625) = 371 × 44 dp**, read off the view hierarchy. 44 is `hitTargetMin` exactly. The retry uses the same size, so both clear the floor by construction rather than by a number either one carries.

## Verification

`npm run check` green: **944 tests across 57 suites**, up from 912.

**Both flows pass, and neither needs an unpunched day.** `flows/kmo-18-out-of-range.yaml` (50s) and `flows/kmo-18-gps-retry.yaml` (51s), each run twice — once on a `before` day and again on the `working` day the override below left behind. That second run is why the label assertions read `Marcar (entrada|salida)`: the first revision pinned them to `Marcar entrada` and would have been a flow that silently stopped covering anything the moment somebody punched. Neither flow presses the primary, so neither spends the day.

**#2, end to end against the live `ams`.** Device moved to Estación Central (about 2 km outside `Sucursal Centro`'s 150 m radius), the card read `Fuera del rango permitido`, `punch-button` reported `enabled=false` in the hierarchy, and the override was pressed. The register answered:

```
mark_id 213  type=in  datetime 2026-08-06 06:32:41  geo_status "outside"
```

Read back through `GET /api/v1/marks`, not off the screen. `geo_status` is the **server's** haversine verdict, not the value the client reported — recorded and flagged, never blocked, which is D-F1-c. The screen then advanced to `En jornada` over `Marcar salida` with the override still offered, because the employee is still outside the radius and still has a salida to make.

**#5, by hand, because Maestro cannot flip the OS switch mid-run.** The app was left sitting on `Sin señal de GPS` from the flow; `bin/device gps on` was then run *without touching the app*, which changed nothing on screen — the hook reads on focus and on retry, and neither had happened. One press of `Reintentar ubicación`:

- `Sin señal de GPS` → `Ubicación confirmada · Sucursal Centro · a 0 m de la marca`
- `punch-button` `enabled=false` → `enabled=true`
- the retry button gone from the hierarchy (#6)

No reload, no remount, no navigation. The Jest half asserts the same sequence *and* that `fetchToday` ran exactly once across it.

**#7, measured rather than asserted.** Off the view hierarchy at density 420 (×2.625), on the live out-of-range screen: `punch-button` **371 × 64 dp**, `punch-override` **371 × 54 dp**, 26 px = **10 dp** apart, which is the design's `margin-top:10px`. The override is 54 rather than 44 because its label wraps to two lines and `Button` sets `minHeight`, never `height` — the criterion is a floor and the control grew past it rather than clipping. The primitive at its unwrapped size measures exactly 44 in the gallery.

Screenshots: `.artifacts/e2e/KMO-18 out-of-range override/takeScreenshot/kmo-18-out-of-range.png`, `.artifacts/e2e/KMO-18 GPS retry/takeScreenshot/kmo-18-no-signal.png`, `.artifacts/kmo-18-retry-confirmed.png`, `.artifacts/kmo-18-warning-variant.png`.

### One flow assertion was wrong and was corrected

The first revision of `kmo-18-gps-retry.yaml` asserted `Buscando tu ubicación` after the retry press and **failed**. The reason is worth keeping: with location services off, `useLocation` calls `hasServicesEnabled()` before anything else and the OS answers no synchronously, so `acquiring` lasts a microtask and the loading copy never survives a frame. That is the app being honest — there is nothing to wait for — and this device condition simply cannot show #4's spinner. The flow now asserts what it can see: the retry re-asks, the card resolves rather than hanging, and the button survives its own press. The loading state itself is Jest's (`retrying` true only while the fix is outstanding; the button keeps its label and spins in place).

### Probe data left behind, and it needs removing

**Mark 213 is real and I could not delete it** — `docker compose exec … artisan tinker` is blocked by the sandbox. It leaves `employee@example.com` on a `working` day, which `flows/kmo-17-punch-button.yaml` cannot run against (it needs `before`). Both KMO-18 flows are fine either way. It clears on its own at midnight; to clear it now:

```
cd ~/Work/ams && docker compose exec -T laravel.test php artisan tinker --execute="
  \$u = App\Models\User::where('email','employee@example.com')->first();
  App\Models\Mark::where('user_id', \$u->id)->whereDate('date_time','2026-08-06')->forceDelete();
"
```

The `kmo18-probe` API token created to read the register **was revoked** (204, and the token now answers 401). Marks 211/212 from KMO-17's run are untouched on 2026-08-05, where they are ordinary history.

## Which criteria are checked, and why #2 is not

Checked, each against evidence that can be re-run:

- **#1** — Jest (disabled primary, the design's sentence, the warning tone, the primary still legible) and `flows/kmo-18-out-of-range.yaml`, plus `enabled=false` read off the live hierarchy.
- **#3** — Jest and `flows/kmo-18-gps-retry.yaml`, with `Reintentar ubicación` on screen under a held primary.
- **#4** — the re-acquisition and the card update on the device in the flow; the loading state in Jest, because the one device condition that produces no signal also answers instantly (see above). The button surviving its own press is asserted in both.
- **#5** — by hand on the emulator, gps off → on → one press, with the primary going `enabled=false` → `enabled=true` and no reload. Jest asserts the same sequence and that `fetchToday` ran once across it.
- **#6** — Jest for confirmed, denied and acquiring; both flows assert the absence of the button that belongs to the other state; verified again live when the retry succeeded and the retry button left the hierarchy.
- **#7** — measured on the device at 371 × 44 dp for the primitive and 371 × 54 dp for the wrapped override, both at or above `hitTargetMin`, plus the Jest floor that ties the size to the token rather than to a number.

**#2 is left unchecked, and it is half proven.** Its first clause is done to the same standard as everything above: the override recorded mark 213 and the server flagged it `geo_status="outside"` by its own evaluation. Its second clause — *and the resulting receipt shows the pending-review line* — has no surface to show it. The comprobante sheet is **KMO-19**, whose own #7 is that same line, `Marca fuera de rango — pendiente de revisión`. Checking #2 now would be signing off on a line nobody has seen.

What KMO-19 inherits, beyond what KMO-17 already left it: `punch-api.ts` parses the server's `geo_status` back onto `PunchReceipt.geoStatus` and `usePunch` holds it, so the sheet has the flag it needs on the receipt itself — no second request, and not the client's own advisory verdict. Mark 213 is a real out-of-range row it can be built against.

Merged to `master` as `4a21f47` (fast-forward, linear history kept) and pushed. `README.md`'s project status now describes the escape hatches and no longer claims KMO-18 is unbuilt — it also corrected a stale KMO-17 sentence saying the punch is refused, which stopped being true when `ams` KOL-34 shipped (`89049df`).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the two escape hatches under the punch button. Out of range, the primary is held and `Marcar de todas formas (queda pendiente de revisión)` sits beneath it in the warning tone the card above is tinted with; with no fix, it is held and `Reintentar ubicación` asks the phone again, spinning in place rather than vanishing under the thumb that pressed it. Neither appears once the location is confirmed, and neither appears for a permission refused for good — no fix is ever coming for that employee, so the punch goes with `geo_status: unknown` rather than being held behind a retry that cannot help.

The `disabled` prop KMO-17 left became a `hold` that carries its own escape hatch, so there is no longer a way to express a disabled punch button with nothing beneath it — docs/design-decisions.md D-F1-c in the type system rather than in a comment. `Button` gained a fifth variant, `warning`, and `useLocation` gained `retrying` and lost `punchAllowed`: the design disables the primary for out-of-range and no-GPS and nothing else, and a button dimmed for the twelve seconds a cold fix can take, with nothing under it to press, is goal G1 spent on a dead control. Both changes were approved before implementation.

Verified with `npm run check` green (944 tests, 57 suites, up from 912) and both Maestro flows passing — twice each, once on a `before` day and again on a `working` one, which is what the label assertions were widened to survive. On the device against the live `ams`: the override recorded mark 213 and the server flagged it `geo_status="outside"` by its own haversine, read back through `GET /marks` rather than off the screen; and the GPS retry took the screen from `Sin señal de GPS` to `Ubicación confirmada` with the primary going `enabled=false` → `enabled=true` on one press, no reload. Hit targets measured off the hierarchy at 371 × 44 dp and 371 × 54 dp.

**Six of seven criteria are checked.** #2 is half proven — the punch it describes is recorded and flagged — and its second clause, the receipt's pending-review line, is owed to KMO-19, which builds the sheet. One flow assertion was written wrong and corrected rather than made optional: with location services off the OS answers synchronously, so #4's loading state cannot render on that device condition and Jest carries it.

Left behind: mark 213 is real and the sandbox blocked its deletion, so `employee@example.com` sits on a `working` day until midnight — `flows/kmo-17-punch-button.yaml` needs `before` and cannot run until it clears. The command is in the notes. The probe API token was revoked.
<!-- SECTION:FINAL_SUMMARY:END -->
