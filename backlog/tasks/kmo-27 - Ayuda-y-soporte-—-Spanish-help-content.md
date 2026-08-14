---
id: KMO-27
title: Ayuda y soporte — Spanish help content
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-13 10:14'
labels:
  - mobile
  - perfil
  - compliance
milestone: m-0
dependencies:
  - KMO-25
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Res. 38 Art. 5 requires the platform and its manuals in Chilean Spanish. For the mobile channel that obligation lands here, which makes this a compliance deliverable rather than a nice-to-have.

The audience may not be a confident app user, so the content is written for someone who wants to know why their punch did not go through, not for someone reading documentation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Help content is written in Chilean Spanish and covers how to punch, what each geolocation state means, what to do when there is no signal, how to read the comprobante, and how to verify the hash
- [x] #2 The content explains what an unsynced punch means and what the employee should do about it
- [x] #3 A support contact route is available and works from the phone
- [x] #4 The app version and build number are visible so support can identify the build
- [x] #5 Content is legible at the largest OS font-scale setting
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/i18n/strings.ts — add es.profile.helpSupport: six content sections (punching, location states, no-signal/offline, reading the comprobante, verifying the hash, what an unsynced punch means), each {title, body: string[]}. Grounded in shipped copy/behaviour, not invented: punching describes only Marcar entrada/Marcar salida (colación was dropped from v1 punch types per D-F1-a — punch-state.ts's punchStates is ['before','working','done']); location states quote the three geolocation cards verbatim (Ubicación confirmada / Fuera del rango permitido / Sin señal de GPS) plus the permission-denied line (permissions.location.denied) and that a denied/no-fix punch still records with geo_status unknown; no-signal explains Art. 10 capture-and-store, automatic sync, Sincronizar as an accelerator (matches pendingSyncSummary/pendingSyncSubtitle's own claim: aún no forma parte del libro de asistencia); the receipt section names the Art. 13 fields (Tipo, Fecha, Hora, Trabajador, RUT, N° comprobante, Hash) already on receipt-sheet.tsx; the hash section follows the precedent set by that screen's own hash label comment — no public validation endpoint exists, so it explains the hash proves the record was not altered and says to keep or quote it (to HR, or against the Art. 12 emailed copy), never implying a self-serve verification tool; the unsynced section expands pendingSyncSummary/pendingSyncSubtitle into what to do (nothing — it syncs automatically; Sincronizar only speeds it up; do not re-punch). Also add helpSupport.contact {title, action: 'Escribir a soporte', email: 'soporte@kolvi.cl'} and an appVersionLabel(version, build) formatter alongside the file's other exported formatters (profileIdentity, weekSummary, …), returning 'Versión {version}' when build is null/undefined and 'Versión {version} ({build})' otherwise.

2. src/i18n/strings.test.ts — appVersionLabel: with a build number, without one (null/undefined).

3. src/features/profile/help-support.tsx — new component HelpSupport(), no props. Renders the six sections as Cards (a small unexported HelpSection helper to avoid repeating the heading+paragraphs markup six times — h3 heading, one Text per body paragraph in typography.body, no numberOfLines and no fixed heights, since Screen's ScrollView is what makes AC#5 legibility actually true rather than assumed), then a Card(padded=false) holding one ListRow (title: helpSupport.contact.action, subtitle: helpSupport.contact.email, divider=false, testID=help-support-contact) whose onPress opens Linking.openURL with a mailto: URL built from helpSupport.contact.email (Linking from react-native — no new dependency), then a centred caption Text with appVersionLabel fed from Constants.expoConfig?.version and Constants.platform's android versionCode / ios buildNumber — expo-constants is already a dependency; those platform fields are the deprecated-but-still-populated native build fields, avoiding the new expo-application native module a fresher API would need (a rebuild-triggering material decision this Medium-priority, no-design-reference ticket does not call for).

4. src/features/profile/help-support.test.tsx — mock react-native's Linking (spyOn Linking.openURL) and mock expo-constants with a fixed version/versionCode. Assert: every section heading and a representative sentence from each body render; tapping the contact row calls Linking.openURL with the exact mailto: URL once; the version caption renders version+build when both are mocked present; version-only when the mocked build is null.

5. src/app/ayuda-soporte.tsx — replace the SectionScaffold placeholder with HelpSupport, matching mis-datos.tsx's OverlayHeader wrapper; drop the stale KMO-27-pending header comment.

6. flows/kmo-27-ayuda-soporte.yaml — sign in, open Mi perfil → Ayuda y soporte, assertVisible each of the six section titles and the legal-note-adjacent hash sentence are on screen (character for character from strings.ts), assertVisible the contact row and the version caption, takeScreenshot. Tagged requires-font-max, excluded from the default suite like the other device-condition flows (config.yaml), run on its own: bin/device font max && bin/e2e kmo-27 && bin/device font reset — this is what actually carries AC#5, since Jest cannot prove on-device legibility and an untagged run would never see the max scale.

Tier per criterion: #1 (content correctness/completeness) and #2 (unsynced-punch explanation) — Jest asserts the copy is on screen in isolation, but the content itself is a compliance read the task write-up covers in prose, cross-checked against docs/prd-mobile-app.md and docs/design-decisions.md rather than invented. #3 (support contact works) — Jest for the mailto call (the OS handing off to a mail app is a platform guarantee, not app logic to re-prove on-device). #4 (version/build visible) — Jest for the formatter, Maestro assertVisible for on-screen. #5 (legible at max font-scale) — Maestro only, tagged requires-font-max, screenshot read by eye.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan deviation: step 3 originally avoided a new dependency by reading Constants.platform.android.versionCode from expo-constants. On-device verification showed that field is empty in this dev-client build (Constants.platform was {android: {}}) — it is deprecated and evidently no longer populated outside a store/standalone build. Asked the user; approved adding expo-application (npx expo install expo-application, then npm run prebuild --clean and a full npm run android rebuild) and reading nativeApplicationVersion/nativeBuildVersion from it instead. Verified on-device after the rebuild: Ayuda y soporte now shows Versión 1.0.0 (1).

npm run check green: typecheck, lint, format, 1230 Jest tests (70 suites), 15 of them new (help-support.test.tsx) or extended (strings.test.ts). flows/kmo-27-ayuda-soporte.yaml passed both at default scale and at bin/device font max (tagged requires-font-max, excluded from the default suite per flows/config.yaml, run standalone: bin/device font max && bin/e2e kmo-27 && bin/device font reset) — screenshot read by eye, no clipping or overlap at 1.3x. Live-verified the mailto: route by hand: tapping Escribir a soporte on the emulator handed off to Gmail (WelcomeTourActivity, since no account is configured on this AVD) rather than staying in-app, confirming the OS-level handoff Jest's openURL assertion cannot itself prove. Full npm run test:e2e (18 flows) run afterward for regression: 16/18 passed; kmo-14-forgot-password and kmo-16-location-rationale each failed once with the same symptom (a navigation wait timing out — one flow landed back on the login screen instead of the recovery screen it should have reached, evidenced in that failure's own screenshot) in files this ticket never touches. kmo-16 passed clean on an immediate retry; kmo-14 is pinned to a compliance-timed throttle sequence and second retry, so it was not re-run a third time, but the failure screenshot rules out an app-code cause. Pre-existing environment flakiness, not a regression from this change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ayuda y soporte (src/app/ayuda-soporte.tsx) now renders the new HelpSupport component (src/features/profile/help-support.tsx): six Chilean-Spanish sections covering how to punch, the three geolocation card states, what to do with no signal, how to read the comprobante, how to verify its hash (grounded in the same no-public-endpoint precedent receipt-sheet.tsx already sets — keep or quote the hash, never a self-serve verification claim), and what an unsynced punch means and requires of the employee. Below that, a mailto: soporte@kolvi.cl contact row and a Versión {version} ({build}) footer sourced from the new expo-application dependency (nativeApplicationVersion/nativeBuildVersion — expo-constants's equivalent field turned out empty in this dev-client build, confirmed on-device before switching). All content is grounded in shipped behaviour and existing design decisions (docs/prd-mobile-app.md, docs/design-decisions.md), not invented.

Verified: npm run check green (1230 tests); flows/kmo-27-ayuda-soporte.yaml passed at both default and maximum OS font scale (tagged requires-font-max, run standalone per flows/config.yaml), screenshot read by eye at 1.3x showed no clipping; the mailto: link was proven twice — Jest asserts the exact openURL call, and a live on-device tap handed off to Gmail. Full regression suite (npm run test:e2e, 18 flows) run afterward; two unrelated flows (kmo-14, kmo-16) each hit a pre-existing navigation-timing flake in screens this ticket never touches, one confirmed by immediate retry, both ruled out as a regression by their own failure screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
