---
id: KMO-19
title: Comprobante bottom sheet
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-06 15:24'
labels:
  - mobile
  - marcaje
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
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The receipt the employee sees immediately after punching. Res. 38 Art. 13 sets the minimum content: date, time, name, RUT and hash, with geolocation optional. Art. 12 covers the emailed copy, which the server sends.

The receipt is generated from the API response, never from client-side state — the server recorded time is the truth. Per docs/design-decisions.md §3 the folio is real, formatted YYYYMMDD-NNNN.

The hash is copyable so the employee can keep or quote it — for HR, or against the emailed copy. It is deliberately **not** presented as something they can verify themselves: `ams` has a checksum validation tool but it lives in the DT inspector portal, behind authentication, and no public route exists. The button copies; the copy around it must not promise more than that.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The sheet opens from the bottom over a scrim with the slide-up animation and a pinned Listo button that dismisses it
- [x] #2 The headline reads ¡Marca registrada! over a success check icon on the success tint
- [x] #3 The detail block lists Tipo, Fecha, Hora, Trabajador, RUT and N° comprobante with the values from the API response
- [x] #4 The date renders as dd/mm/aa and the time includes seconds, per Art. 13
- [x] #5 The SHA-256 hash renders in monospace under the label Hash de verificación (SHA-256), wrapping rather than truncating
- [x] #6 A Copiar button copies the hash to the clipboard and confirms by changing its own label
- [x] #7 An out-of-range punch adds the line Marca fuera de rango — pendiente de revisión in the warning colour
- [x] #8 The legal note is always present: Este registro forma parte del libro de asistencia electrónico (Resolución 38 de la Dirección del Trabajo)
- [x] #9 No value on the sheet is derived from client-side state or the device clock
- [x] #10 The sheet body scrolls independently when the content exceeds the sheet height at large font scales
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. package.json — add `expo-clipboard` via `npx expo install`. #6 needs a clipboard and RN core's `Clipboard` was removed; expo-clipboard is the Expo-blessed replacement. Native dependency, so `npm run android` rebuilds once.

2. src/theme/typography.ts — add `fontFamilies.mono` (Android `monospace`, iOS `Menlo` via Platform.select) and a `typography.mono` preset at 11/1.5, the design's `font:600 11px/1.5 monospace`. It has to be a token: ESLint bans a bare `fontFamily`/`fontSize` outside src/theme, so #5's monospace cannot be written at the call site. No font asset is bundled — the design asks for generic monospace, not a specific face.

3. src/ui/icons.tsx — add `CheckIcon` (`M20 6 9 17l-5-5`, the design's stroke-width 3), the success glyph in the sheet's 64dp circle. Transcribed from `Kolvi App.dc.html` like every other icon in the file.

4. src/i18n/strings.ts — a new `es.marcaje.receipt` section, transcribed from the design's comprobante overlay: `headline: '¡Marca registrada!'`, `subtitle: 'Comprobante de marca'`, the six row labels (`Tipo`, `Fecha`, `Hora`, `Trabajador`, `RUT`, `N° comprobante`), `hash: 'Hash de verificación (SHA-256)'`, `outOfRange: 'Marca fuera de rango — pendiente de revisión'`, `legal: 'Este registro forma parte del libro de asistencia electrónico (Resolución 38 de la Dirección del Trabajo).'`, `done: 'Listo'`, and `type: { in: 'Entrada', out: 'Salida' }` for the `Tipo` value. The `Copiar`/`Copiado` pair already exists as `es.actions.copy`/`copied` and is reused. Nothing in or around the copy button implies the employee can verify the hash themselves — the settled position on this ticket.

5. src/features/marcaje/punch-api.ts — extend `PunchReceipt` with `folio`, `employeeName`, `employeeRut`, each `string | null`, parsed the way `geo_status` is: absent or null reads as null (that is every server until `ams` KOL-35 ships), present-but-not-a-string fails loudly. The sheet then omits the row rather than inventing a value — see the note below on #3.

6. src/features/marcaje/receipt-sheet.tsx + receipt-sheet.test.tsx — the sheet. Built on `@/ui/bottom-sheet`, which already carries #1's scrim, slide-up, pinned footer and independently scrolling body (#10). Renders from a `PunchReceipt` prop and from nothing else (#9): no session, no clock, no `Date`. Dates through `formatReceiptDate`/`formatReceiptTime` and the RUT through `formatRut`, all three of which exist and are tested (#4). The hash block is the mono preset with `flexShrink`+wrapping, never `numberOfLines` (#5). `geoStatus === 'outside'` adds the warning line (#7). The legal note is unconditional (#8).

7. src/features/marcaje/home-screen.tsx — pass `onPunched` to `usePunch` (the one line KMO-17 left for this ticket), hold the receipt being shown in screen state, render `<ReceiptSheet>` under the body. Dismiss clears it. This closes KMO-17 #10, which is verified and checked on KMO-17, not here.

8. flows/kmo-19-comprobante.yaml — the device tier: punch, the sheet rises, the headline, the legal note, `Copiar` becoming `Copiado`, and `Listo` dismissing it. A second flow or a `bin/device geo` run covers #7's out-of-range line via KMO-18's override.

Tiers: #1 #2 #3 #4 #5 #7 #8 #9 are Jest on a fixture receipt; #1 #2 #6 #7 #8 are also Maestro because they are copy on a device; #10 is a screenshot at `bin/device font max`, which is the only tier that can show the body scrolling under the pinned footer.

**Open question this plan cannot settle: #3 and the Art. 13 identity.** `ams` does not send `folio`, `employee_name` or `employee_rut` today — that is KOL-35, which nobody has started. Step 5 makes them optional so the app is correct the day they arrive, but until then the sheet shows Tipo, Fecha and Hora and omits the other three rows rather than filling them from the session (which would break #9) or printing a placeholder for a folio that will never exist (which would be a false statement on a legal receipt). #3 stays unchecked with a note.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**KMO-17 #10 is owed here, and it is the only criterion of that ticket left open.** It reads: *"A successful punch transitions the state and opens the comprobante sheet built in KMO-19."* KMO-17 could not close it — the sheet is this ticket's, and this ticket depends on that one — so it was left unchecked deliberately rather than signed off on a seam.

Everything the sheet needs is already built and tested:

- `src/features/marcaje/use-punch.ts` takes an **`onPunched(receipt: PunchReceipt)`** callback and calls it with the parsed 201, and also keeps the last receipt on `punch.receipt`. `use-punch.test.ts` covers both. Nothing is wired to it yet — `home-screen.tsx` passes `onAlreadyMarked` but no `onPunched`, which is the one line this ticket adds.
- `src/features/marcaje/punch-api.ts` defines `PunchReceipt` — `markId`, `type`, `datetime` (naive Santiago wall-clock), `hash`, `geoStatus`. That is what `ams` returns today, verified against the live endpoint after KOL-34.

Two things to know before building the detail block:

- **`ams` does not yet send the Art. 13 fields.** `MarkResource` returns `mark_id`, `hash`, `datetime`, `type` and `geo_status` and nothing else — no worker name, no RUT, and **no folio**. This ticket's #3, #4 and its `N° comprobante` row need those on the wire first, and KOL-34 deliberately scoped them out (PRD §420 item 4; the folio is its own decision, D-F2-a, `YYYYMMDD-NNNN`). That is a companion `ams` ticket nobody has written yet.
- **#7's out-of-range line reads `geoStatus`**, which the receipt already carries and the server already decides — `'outside'` is what puts `Marca fuera de rango — pendiente de revisión` on the sheet. That half needs no backend work.

When this ships, verify KMO-17 #10 on the device — punch, and watch the sheet come up from the receipt — and check it on KMO-17 rather than here.

**The `ams` side is tracked as KOL-35** — "Complete the mark receipt for Res. 38 Art. 13: a real folio and the worker identity on MarkResource", HIGH, depends on KOL-34. It adds `folio`, `employee_name` and `employee_rut` to the 201 body.

Correcting one thing in the note above it: the Art. 13 identity is **not** missing from `ams`, only from the response. `MarkObserver::creating` already snapshots `employee_name`, `employee_rut`, `employer_name` and `employer_rut` onto every mark, so a receipt reprinted years later shows who the employee was at the time. `MarkResource` just does not send it. The only genuinely new data in KOL-35 is the folio, which has no column.

**One thing for this ticket to settle, not KOL-35.** This task's description says the hash is copyable *"so the employee can verify it against the public validation endpoint"*. That endpoint — `marks/validate` in `ams` `routes/web.php` — is not public: it is inside the DT inspector portal, behind authentication and `password_expires`. So either #6's copy button is promising employees something they cannot do, or a public validation route is missing and nobody has scoped it. Worth deciding before writing the copy around the `Copiar` button.

**Settled: no public hash validation.** The description's original claim — that the employee could verify the hash against a public validation endpoint — was wrong; `marks/validate` in `ams` is inspector-only. The user's call was to drop the promise rather than build a public route, so the description now says the hash is copyable for keeping or quoting, and #6 is unchanged: the button copies and confirms, and nothing in the copy around it may imply self-verification.

**KOL-35 has shipped** (`ams` fa8e04a, merged 41052b0), so the open question in the plan is settled by the backend rather than by a workaround. `MarkResource` now sends `folio`, `employee_name` and `employee_rut`, and `MarkObserver` allocates a real `YYYYMMDD-NNNN` folio under a row lock on every create (`app/Support/Folio.php`). #3 is buildable in full and the sheet reads all six rows off the 201.

All three stay `string | null` in the parser anyway: `employee_name` and `employee_rut` are stamped from `$user?->rut` / `$user?->name` and `users.rut` is itself nullable, so a null is a real answer about the register rather than a parse failure. A row with nothing behind it is omitted rather than drawn empty.

Mono font: the system face (`Platform.select({android:'monospace', ios:'Menlo'})`), not a bundled one. The design asks for generic `monospace`, and a fourth family in `useKolviFonts` is a font file that can fail to decode on the splash path for a hash nobody reads glyph by glyph.

## Verification

`npm run check` green — typecheck, lint, format, 991 Jest tests across 58 suites (33 of them new in `receipt-sheet.test.tsx`, 5 in `home-screen.test.tsx`, 5 in `punch-api.test.ts`).

Device tier, on the AVD against the live `ams`:

- `bin/e2e flows/kmo-19-comprobante.yaml` — **passed**. Covers #1 #2 #3 #4 #5 #8 and KMO-17 #10. It walks the whole day, entrada then salida, because that is how it gets two clean screens: `Listo` is pressed on the first receipt and `Copiar` on the second.
- `bin/device geo -33.4372 -70.6506 && bin/e2e flows/kmo-19-out-of-range.yaml` — **passed**. #7, on a mark the server itself flagged `outside` (folio 20260806-0007), reached through KMO-18's override.
- #10 by hand at `bin/device font 2.0`: at 1.3 (the AVD's slider maximum) the whole sheet still fits, so the criterion needed a scale past it. At 2.0 the content overflows, the body scrolls the headline away and brings the full hash and the legal note up, and `Listo` does not move. `.artifacts/kmo-19-fontscale-2x-top.png` and `-scrolled.png`.

Screenshots: `.artifacts/e2e/KMO-19 comprobante/takeScreenshot/` and `.artifacts/kmo-19-fontscale-2x-*.png`.

**#6 is split across two tiers deliberately.** `Copiar` → `Copiado` stands for 1500ms — the design's own `setTimeout` — and Maestro's settle after a tap measured 3.7s on this emulator, so no device assertion can ever catch the label. Slowing the app down to be observable would be changing the product to suit the test. The label swap and the clipboard call are asserted in `receipt-sheet.test.tsx`; the flow presses the button (proving `expo-clipboard` linked and ran natively) and screenshots the moment, and `kmo-19-comprobante-copiado.png` catches both the button reading `Copiado` **and** Android's own clipboard preview holding the same hash — the OS confirming it accepted the write.

## Decisions

- **`expo-clipboard` (~57.0.1) is a new native dependency.** RN core's `Clipboard` was removed; this is the Expo-blessed replacement. It is injected as `copyToClipboard` so the sheet's tests never touch a native module.
- **`typography.mono` uses the platform's own monospace face** (`monospace` on Android, `Menlo` on iOS), not a bundled one — the design asks for generic `monospace` and names no typeface. `FontFamily` split into `BundledFontFamily` so `fontAssets` cannot be asked for a file that does not exist.
- **The headline takes `typography.h2`.** The design draws 19px, which is between `h2` (22) and `h3` (16); presets are taken whole rather than resized, and `h2` is the one whose role matches.
- **The `Copiar` chip is a `Button size="sm" variant="secondary"`**, so it clears the 44px minimum hit target. The design's own chip is ~29px tall, which the app's accessibility floor does not allow.
- **A row with no value is omitted, not drawn empty.** `employee_name` and `employee_rut` are stamped from `$user?->rut`, and `users.rut` is nullable, so an absent value is a fact about the register. A malformed RUT omits its row through `isRut` rather than throwing and taking the whole receipt — including the hash — off the screen.
- **The screen holds the open receipt, not the hook.** `punch.receipt` survives dismissal, so a sheet drawn from it would reopen itself on the next render.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The comprobante an employee sees the instant a punch is recorded: `src/features/marcaje/receipt-sheet.tsx` over the existing `BottomSheet`, wired into `home-screen.tsx` through the `onPunched` callback KMO-17 left for it. It draws the Res. 38 Art. 13 rows — Tipo, Fecha, Hora, Trabajador, RUT and the `YYYYMMDD-NNNN` folio — over the SHA-256 in a new monospace theme preset, with a `Copiar` button (`expo-clipboard`) that confirms in its own label, the out-of-range line when the server flagged the mark, and the legal note on every receipt without exception.

The sheet takes a `PunchReceipt` and has no other source — no session, no clock, no `Date` — so it cannot show a time, a name or a folio the register does not hold (#9). `PunchReceipt` gained `folio`, `employeeName` and `employeeRut` from `ams` KOL-35, each nullable because the register's own columns are, and a row with no value is omitted rather than drawn empty.

Verified with `npm run check` (991 tests green), `bin/e2e flows/kmo-19-comprobante.yaml` and `flows/kmo-19-out-of-range.yaml` both passing against the live `ams`, and #10 by hand at font scale 2.0 where the body scrolls under a pinned `Listo`. All ten criteria checked. KMO-17 #10 is now demonstrable and belongs on that ticket.
<!-- SECTION:FINAL_SUMMARY:END -->
