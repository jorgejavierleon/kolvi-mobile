---
id: KMO-6
title: Spanish (Chile) string catalogue and formatters
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-02 00:17'
labels:
  - mobile
  - foundation
  - compliance
milestone: m-0
dependencies: []
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Res. 38 Art. 5 requires the platform and its manuals in Chilean Spanish. That makes a single string catalogue a compliance requirement rather than a nicety, and it must cover error messages and empty states, not just happy-path labels.

Domain vocabulary — leave types, workday statuses, document statuses — comes from the server as value/label pairs and is never re-translated in the app.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All app-authored user-facing text lives in one es-CL catalogue; no literal user-facing strings remain in components
- [x] #2 The catalogue covers error messages, empty states, permission-denied states and loading states, not only primary labels
- [x] #3 Date formatters produce the design formats: the long weekday-and-month header, the dd/mm/aa receipt date, and the hh:mm:ss receipt time with seconds
- [x] #4 Weekday and month names are the Spanish forms used by the design, including the accented Miércoles and the lowercase month names
- [x] #5 A RUT formatter renders the dotted format with the verifier digit, matching the receipt and profile
- [x] #6 An hours formatter renders decimal hours as the design shows them in the week summary and history tiles
- [ ] #7 Domain labels received from the server are displayed verbatim and are never mapped through the catalogue
- [x] #8 Tests cover each formatter including a midnight-crossing time and a RUT with a K verifier digit
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/i18n/strings.ts — the `es` catalogue, moved out of index.ts and grown. Keeps tabs/headers/navigation/profile/errors/scaffold; adds `actions` (Reintentar, Cancelar, Cerrar, Volver, Copiar/Copiado, Sincronizar, Abrir ajustes), `states` (loading, empty, failed) and `permissions` (location denied / denied-forever / services off, notifications denied, biometrics unavailable). Cross-cutting copy only — per-screen wording stays with the screen's own ticket (KMO-15/16/19/32/39/42), which is what AC #1 and #2 can honestly mean while the tabs are empty. Also holds the phrases assembled around a server value: tabWithPendingCount, sectionEnd, weekSummary, pendingSyncSummary.
2. src/i18n/dates.ts — the date/time formatters. Hand-rolled WEEKDAYS/MONTHS tables from the design (capitalised weekday, lowercase month), never `Intl`: Hermes ships without full ICU on Android, so `Intl.DateTimeFormat('es-CL')` gives a different answer on device than in Jest. Never `Date` either — the day of the week comes from Sakamoto's algorithm over the integers @/api/datetime already parsed. Imports from `@/api/datetime` directly rather than the `@/api` barrel, because the barrel re-exports errors.ts, which imports `@/i18n`, and going through it would close a runtime import cycle.
   formatLongDate → 'Miércoles 5 de agosto' (home header, AC #3/#4)
   formatLongDateWithYear → '5 de agosto 2026' (leave ranges)
   formatShortDate → 'Vie 24 jul' (upcoming shifts, history rows)
   formatMonthYear → 'agosto 2026' (calendar and date picker)
   formatReceiptDate → '01/08/26' (Res. 38 Art. 13 dd/mm/aa, AC #3)
   formatReceiptTime → '08:00:00' (Art. 13 hh:mm:ss with seconds, AC #3)
   formatClockTime → '08:00' (home clock, shift window)
   exported weekdayIndex and the weekdayNames / weekdayInitials / monthNames tables (AC #4)
3. src/i18n/rut.ts — formatRut('12345678K') → '12.345.678-K', plus isRut for a screen that would rather branch than catch. Accepts the raw server form and an already-punctuated one, uppercases a lowercase k, throws RutFormatError on anything else, matching how @/api/datetime fails loudly on a malformed wire value. Formatting only; it does not compute or check the módulo-11 verifier digit, because the server's immutable snapshot is what a receipt must reproduce.
4. src/i18n/hours.ts — formatDecimalHours(32.5) → '32,5' and (44) → '44' (no trailing zero); formatHoursAsClock(7.633) → '07:38' for the Trabajado/Extra/Faltante tiles, which the design renders as HH:mm rather than decimals. Throws HoursFormatError on a negative or non-finite duration.
5. src/i18n/index.ts — re-exports the catalogue and all three formatter modules; @/i18n stays the single import for components.
6. eslint.config.js — the selector arrays are lifted to named consts and composed, because a second `no-restricted-syntax` block replaces the first array rather than merging with it; without composing, adding an i18n block over src/ui would have silently switched the theme rules off there. New i18nSelectors over src/app, src/ui and src/features reject non-whitespace JSXText, string literals in accessibilityLabel/accessibilityHint/title/label/placeholder props, and `label`/`placeholder` object properties. Makes AC #1 a build failure rather than a claim.
7. Tests beside each module — dates.test.ts, rut.test.ts, hours.test.ts, strings.test.ts. AC #8's two named cases: a midnight-crossing shift (00:00:00, 23:59:59, and a night shift whose punches land on two dates) and a K verifier digit. strings.test.ts asserts one entry per ApiError kind, no blank entries, no obviously English entry, and — for AC #7 — that none of the ten domain labels the design shows appears anywhere in the catalogue.

Tiers: every criterion here is logic or a lint property, so Jest plus `npm run check` carries all eight. KMO-6 puts nothing new on screen, so there is no new Maestro flow; the existing flows are re-run instead, to prove the module split did not break the shell that already consumes the catalogue.

CHANGED DURING IMPLEMENTATION (was step 6, 'move gallery's literals into the catalogue'): src/ui/gallery.tsx keeps its literals and is exempted from the i18n selectors instead. Moving them would have violated AC #7 — 'Completo', 'Atrasado', 'Ausente' and 'Con permiso' are workday statuses, server domain vocabulary — and contradicted the decision KMO-3 recorded in that file's own header. The exemption is an `ignores` entry rather than an inline disable, so the theme selectors still apply to the file. KMO-30 deletes it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions taken with the user before implementation:
- Decimal hours render with a comma (`32,5 / 44 hrs esta semana`), not the dot the design's week summary draws. The design contradicts itself — its leave wizard already uses `0,5` — and the comma is the es-CL form, so the dot is read as a slip in the mockup.
- AC #1 is enforced by ESLint rather than left as a convention: a no-restricted-syntax block over src/app, src/ui and src/features rejecting non-whitespace JSXText, string literals in accessibilityLabel/accessibilityHint/title/label/placeholder props, and `label`/`title`/`placeholder` object properties. Test files are exempt.

Two mockup artefacts the ticket adjudicates against the design, recorded so a later ticket does not 'restore' them:
- The design renders the comprobante date via fmtDate as `5 de agosto 2026`, but AC #3 and Res. 38 Art. 13 both require `dd/mm/aa`. Both formatters exist; KMO-19 should use formatReceiptDate.
- The design's home header sets CSS `text-transform:capitalize` over `Miércoles 5 de agosto`, which would render `De Agosto`. AC #4 calls for lowercase months, so the catalogue emits them lowercase and no component re-cases them. Same call for the calendar month label, which the design hardcodes as `Agosto 2026` but computes elsewhere as lowercase.

Verification.

`npm run check` green: typecheck, eslint, prettier, 310 Jest tests across 20 suites (81 of them new, in src/i18n).

AC #1 is enforced, not asserted. `npx eslint .` is clean across src/app, src/ui and src/features, and the rule was proved to fire rather than assumed to: a throwaway component with `<Text accessibilityLabel="Abrir mi perfil">Marcar entrada</Text>` produced both errors, and was deleted. One documented exemption — src/ui/gallery.tsx, the dev-only primitives bench KMO-30 deletes, whose strings are stand-ins for server domain vocabulary (see the plan).

`npx expo export --platform android` bundles clean (2.9MB Hermes bytecode), which is what proves the new module graph resolves — src/api/errors.ts imports `@/i18n`, and the split into strings/dates/rut/hours had to not close an import cycle back through the `@/api` barrel.

On device (headless AVD, dev build over Metro): the app boots and the catalogue renders through the new split — the tab bar reads Inicio/Jornada/Permisos/Documentos and `sectionEnd` renders `Fin de Jornada`. Screenshot at .artifacts/kmo-6-after.png. No new flow: nothing new is on screen.

PRE-EXISTING FLAKE, not caused by this branch. `npm run test:e2e` fails one flow per run with 'Assertion is false: "Inicio" is visible', and which flow it hits moves run to run. The screenshot at the failure point shows the Android launcher rather than the app, which points at the `back` that closes the dev client's developer-menu onboarding in flows/shared/launch.yaml overshooting and backgrounding the app. Confirmed against clean master with this branch stashed: master failed KMO-1 and KMO-4 on the same assertion while KMO-3 passed. On this branch all four flows have passed across runs (KMO-4 twice). Left alone — launch.yaml's own header says it collapses to clearState + launchApp once KMO-7 lands a preview APK, which removes the cause.

AC #7 left unchecked, deliberately.

It has two clauses and only one of them can be proved today. 'Never mapped through the catalogue' is proved and now guarded against regression: src/i18n/strings.test.ts asserts that none of the ten domain labels the design shows — Vacaciones, Licencia médica, Sin goce de sueldo, Con goce de sueldo, Pendiente de firma, Firmado, Aprobado, Rechazado, Atrasado, Ausente — appears anywhere in the catalogue, and there is no lookup or mapping function for one to pass through. That test is also why src/ui/gallery.tsx keeps its literal status labels instead of moving them in.

'Displayed verbatim' has no consumer. No screen fetches a {value, label} pair yet, so there is nothing that renders one and nothing to point a test or a flow at. The first screen to receive them — KMO-33/34 for workday statuses, KMO-39/41 for leave types, KMO-42 for document statuses — is where that half becomes verifiable. Checking it here would be checking code presence.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Split src/i18n into the es-CL catalogue (strings.ts) and three formatter modules — dates.ts, rut.ts, hours.ts — behind the existing @/i18n import, and made the no-literal-copy rule a build failure.

The catalogue grew past happy-path labels to the states that get forgotten: loading, empty and failed for any screen, and denied/denied-forever/services-off for location plus notifications and biometrics. The formatters cover the design's date forms (Miércoles 5 de agosto, 5 de agosto 2026, Vie 24 jul, agosto 2026), Res. 38 Art. 13's receipt pair (01/08/26 and 08:00:00 with seconds), the dotted RUT with its verifier digit including K, and decimal hours in both renderings the design uses — 32,5 for the week summary and 07:38 for the KPI tiles.

Neither Date nor Intl appears in any of it. The day of the week comes from Sakamoto's algorithm over the integers @/api/datetime parsed, so a formatter cannot reinterpret a naive Santiago wall-clock value in the device's zone, and the Spanish names are tables rather than ICU data Hermes does not ship on Android.

Verified with: npm run check green (typecheck, eslint, prettier, 310 tests across 20 suites, 81 of them new); npx expo export --platform android bundling clean, which is what proves the new module graph does not close an import cycle through @/api; a deliberately-violating throwaway component proving the ESLint rule fires rather than assuming it; and the app booting on the headless AVD with the catalogue rendering — tab bar and Fin de Jornada — screenshot at .artifacts/kmo-6-after.png.

Seven of eight criteria checked. #7 is left open on purpose: its 'never mapped through the catalogue' half is proved and guarded by a test, but 'displayed verbatim' has no consumer until a screen fetches a {value, label} pair.
<!-- SECTION:FINAL_SUMMARY:END -->
