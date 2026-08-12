---
id: KMO-51
title: Mis datos — read-only profile detail
status: Done
assignee:
  - '@claude'
created_date: '2026-08-12 01:16'
updated_date: '2026-08-12 19:43'
labels:
  - mobile
  - perfil
milestone: m-0
dependencies:
  - KMO-25
priority: medium
type: feature
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The employee reads their own record on the phone; correcting it happens on the web app now, not here. This reverses KMO-26's editable subset (personal email, phone, emergency contact) — see docs/design-decisions.md §9 for why. Fills in src/app/mis-datos.tsx, which KMO-25 shipped as a placeholder route specifically for this screen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Read-only fields show name, formatted RUT, corporate email, personal email, phone, position, premise, supervisor and contract start date
- [x] #2 A field the server does not return is omitted rather than shown blank or as a placeholder
- [x] #3 An employee with no personal email set sees an explicit prompt explaining that receipts and verification codes are sent there
- [x] #4 No editable fields, save action, form controls or link to the web app appear on the screen
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/features/auth/session-user.ts — extend SessionUser with personalEmail, phone, supervisor (the related user's name) and contractStartDate (naive YYYY-MM-DD), parsed defensively the same way position/premise already are (null when absent, never invented). Requires ams UserResource to expose these fields first (see backend plan below) — none of them are on the wire today.
2. src/features/auth/session-user.test.ts — extend fixtures/tests for the four new fields: present, explicitly null, and missing from the payload.
3. src/features/profile/profile-detail.tsx — new component, ProfileDetail({ user }). Renders each field as its own row inside a Card: Nombre, RUT (formatRut), Correo corporativo, Correo personal, Teléfono, Cargo, Sucursal, Jefatura (ams/HR's own word for supervisor, per strings.ts's existing convention), Fecha de inicio de contrato (formatLongDateWithYear). A null field is omitted entirely (AC#2), not shown blank. personalEmail === null renders the AC#3 prompt in its place — text only, no link out anywhere on the screen (AC#4).
4. src/features/profile/profile-detail.test.tsx — renders every field when present; omits each field individually when null (including the RUT-null case); shows the personal-email prompt only when personalEmail is null; asserts no Pressable/TextInput/button exists anywhere in the tree.
5. src/i18n/strings.ts — es.profile.misDatos: the eight field labels plus the personal-email prompt sentence.
6. src/app/mis-datos.tsx — replace the SectionScaffold placeholder with useSession() + ProfileDetail, matching perfil.tsx's OverlayHeader wrapper. Drop the stale KMO-26 comment.
7. flows/kmo-51-mis-datos-read-only.yaml — sign in as the seeded employee, open Mis datos, assert the fields the seed data actually sets (name, RUT, corporate email, personal email, premise, Jefatura: Supervisor Demo) are visible, assert the labels for fields the seed leaves null (Teléfono, Cargo, Fecha de inicio de contrato) are absent, assert no editable control appears. The missing-personal-email prompt (AC#3) is proven at the Jest tier in step 4 instead — no seeded user lacks personal_email, and adding one is a heavier lift than the criterion needs.

Backend blocker, ams repo (separate ticket, mirroring KOL-61's shape):
8. app/Http/Resources/UserResource.php — add personal_email, phone, supervisor ($this->supervisor?->name) and contract_start_date ($this->contract_start_date?->format('Y-m-d')).
9. routes/api.php — loadMissing(['position', 'premise', 'supervisor']) on the user route.
10. tests/Feature/Api/UserApiTest.php — extend the KOL-61-pattern tests for the three new fields plus the eager-load query-count bound.
11. A new ams backlog ticket, its own branch and PR-equivalent commit, merged to ams master before steps 1-2 and 7 can be verified against a real backend. The ams working tree currently has unrelated uncommitted work on feature/kol-42-overtime-pactos, so this needs a separate git worktree rather than switching that branch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
npm run check green (69 suites, 1223 tests, including 12 new in profile-detail.test.tsx and 9 extended in session-user.test.ts). Backend blocker resolved as ams KOL-62 (separate worktree/branch feature/kol-mis-datos-user-fields off ams master, status In Review — not yet merged/pushed, held for user approval): GET /api/v1/user now returns personal_email, phone, supervisor and contract_start_date. Live-verified end to end: booted the emulator, ran 'php artisan serve' from the KOL-62 worktree against the shared dev database (temporarily repointed EXPO_PUBLIC_API_URL at it, reverted after — .env is gitignored, no diff), built and installed the app, and ran flows/kmo-51-mis-datos-read-only.yaml — 1/1 passed. Screenshot read by eye: kmo-51-mis-datos.png matches the app's card/row language, shows every field the live seeded employee actually has (personal email included — the seed always sets one, so AC#3's prompt is Jest-only, per the flow's own header comment), and Teléfono/Fecha de inicio de contrato are correctly absent rather than blank. Cargo turned out to be set on the live seed data (contrary to the seeder source's own comment), so the flow asserts it neither way — same treatment kmo-25-profile-screen-and-menu.yaml gives position for the same reason.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Mis datos (src/app/mis-datos.tsx) now shows the employee's own record read-only via the new ProfileDetail component (src/features/profile/profile-detail.tsx): every field the server returns, each omitted individually when absent, a text-only prompt when personal_email is unset, and no editable control anywhere. SessionUser gained personalEmail/phone/supervisor/contractStartDate, sourced from ams KOL-62's UserResource change. Verified with Jest (12 new tests + 9 extended), the full npm run check, and a live Maestro run against the real endpoint with a screenshot read by eye.
<!-- SECTION:FINAL_SUMMARY:END -->
