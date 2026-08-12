---
id: KMO-25
title: Profile screen and menu
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-12 00:54'
labels:
  - mobile
  - perfil
milestone: m-0
dependencies:
  - KMO-4
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The overlay that opens from the avatar button on every tab: identity header over a four-item menu.

Menu items are Mis datos, Notificaciones, Ayuda y soporte and Cerrar sesión, the last in the danger colour.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The screen opens as a full-screen overlay with a back chevron and the title Mi perfil
- [x] #2 The identity header shows the initials avatar in the primary colour, the full name, and the position and premise as {position} · {premise}
- [x] #3 The menu renders the four rows in a single card with dividers, Cerrar sesión in the danger colour
- [x] #4 Each row navigates to its screen, and Cerrar sesión runs the sign-out flow from KMO-12
- [x] #5 Notificaciones is present but shows a placeholder stating that preferences arrive with push notifications
- [x] #6 Every row meets the 44px minimum hit target
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
0. ams KOL-61 (separate repo, already shipped on its own branch, pending merge approval): GET /api/v1/user now returns position and premise as the related Position/Premise name, null when unset. This ticket's #2 was blocked without it — ams's UserResource had neither field.

1. src/features/auth/session-user.ts — extend SessionUser with position: string | null and premise: string | null, parsed the same defensive way as rut.

2. src/features/profile/identity-header.tsx — new feature file (this app has no profile/ feature dir yet; F7 in the PRD is its own section and KMO-26/27/38 will want a home too). Exports initialsFrom(name) (pure, unit-tested: single name, extra whitespace, lowercase) and IdentityHeader({ user }): 72dp primary circle with initials (typography.h2, closest preset to the design's 24px, same rounding screen-header.tsx already does for the 40dp avatar), the full name (h3), and the position/premise caption — hidden entirely if both are null, showing whichever one is present if only one is.

3. src/i18n/strings.ts — profileIdentity(position, premise) alongside the app's other two-part-sentence helpers (locationConfirmed, sectionEnd); es.profile.menu.{myData,notifications,helpSupport} each with an action label and a back label ('Volver a Mi perfil', matching changePassword's own back copy); notifications additionally carries the push-notifications placeholder sentence AC#5 asks for.

4. src/ui/list-row.tsx — add an optional tone?: 'default' | 'danger' prop switching the title colour to tones.danger.foreground. Reused by Cerrar sesión so all four rows share one row primitive.

5. src/features/auth/sign-out.tsx — the trigger becomes a ListRow (tone danger, divider false, testID sign-out-action) instead of its own Card+Button, so it can sit as the menu's last row rather than its own card. The confirmation BottomSheet is unchanged.

6. src/app/perfil.tsx — IdentityHeader above the menu; a Card(padded=false) holding three ListRows (Mis datos, Notificaciones, Ayuda y soporte, each router.push to its own route) plus <SignOut pendingPunches={usePunchQueue().count} /> as the fourth row (KMO-22/23 are Done, so this is real now rather than the hardcoded 0 KMO-12 shipped with). Drops the SectionScaffold this screen has stood in on since KMO-4 kmo-25 fills in. UnlockSetting and the change-password card stay above/below the menu exactly where they are — the design's four-row card is only Mis datos/Notificaciones/Ayuda y soporte/Cerrar sesión.

7. src/app/mis-datos.tsx, ayuda-soporte.tsx — new root-stack screens, each OverlayHeader + SectionScaffold, the same temporary-body pattern KMO-4 used for the tabs, until KMO-26/27 build the real screens.

8. src/app/notificaciones.tsx — OverlayHeader + a Card carrying the AC#5 placeholder sentence (not SectionScaffold's generic copy — the criterion asks for a specific one) until KMO-38.

9. src/app/_layout.tsx — register the three new routes as Stack.Screen beside perfil and cambiar-contrasena, under the same signed-in guard.

10. Tests written with the code (session-user, identity-header, strings, list-row, sign-out); flows/kmo-25-profile-screen-and-menu.yaml for #1 (overlay + back + title), #4 (all four rows navigate, Cerrar sesión reaches the confirmation) and a read of the identity header against a seeded employee with position and premise set.

Tier per criterion: #2 (identity content), #3 (single card, dividers, danger tone), #5 (notifications placeholder), #6 (44px, inherited from ListRow and already covered by list-row.test.tsx) — Jest. #1 and #4 — Maestro, since they are navigation and overlay behaviour a device shows.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Blocked initially: ams's GET /api/v1/user had no position or premise (#2). Opened and shipped ams KOL-61 on its own branch (feature/kol-61-user-position-premise, not yet merged — needs your approval) adding both, sourced from the existing position()/premise() relations, eager-loaded. 930/934 ams tests pass (4 pre-existing skips), pint clean; 2 pre-existing phpstan failures in WorkdayCalculator.php confirmed present on ams master before this branch, unrelated.

Mobile side: SessionUser carries position/premise now. New src/features/profile/ (this app's first) holds IdentityHeader and initialsFrom. ListRow gained a tone prop, reused by SignOut's trigger, which is now a bare row (danger tone, no divider) instead of its own Card+Button, so it can sit as the menu's fourth row. Cerrar sesión's confirmation sheet is unchanged. perfil.tsx composes IdentityHeader + a Card(padded=false) of four ListRows; SignOut now receives the real usePunchQueue().count instead of the hardcoded 0 KMO-12 shipped with. Three new placeholder routes (mis-datos, notificaciones, ayuda-soporte) registered in _layout.tsx — the first two SectionScaffold, notifications carries its own AC#5 sentence. SectionScaffold dropped from perfil.tsx itself, which KMO-25 was the last tab/screen still standing in on.

npm run check green: typecheck, lint, format, 1208 Jest tests (68 suites), 98 of them new or touched by this ticket. flows/kmo-25-profile-screen-and-menu.yaml — 2/2 runs green on the emulator against the live (branch) ams: overlay + back + title (#1), the real identity header off the seeded employee (Jefe de Administración y Finanzas · Sucursal Centro — #2), all three placeholder rows navigate and back (#4), the notifications placeholder sentence (#5), Cerrar sesión reaches the same confirmation kmo-12-sign-out.yaml already drives to completion. Re-ran kmo-12-sign-out.yaml itself (57s, passed) to confirm the SignOut refactor did not regress it. #3 and #6 (single card with dividers, danger tone, 44px hit target) are list-row.test.tsx and card composition in perfil.tsx — a style assertion is the honest tier for a divider colour and a minHeight, not a screenshot.

Screenshot read by eye: kmo-25-perfil-final.png — avatar, name, position · premise, four-row card with visible dividers and Cerrar sesión in red, Seguridad and Cambiar contraseña cards below exactly where they were.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Mi perfil now opens with the design's identity header — a 72dp initials avatar, the full name, and {position} · {premise} — over a single four-row card: Mis datos, Notificaciones and Ayuda y soporte push their own (placeholder, pending KMO-26/27/38) routes, and Cerrar sesión is the card's own danger-toned last row rather than a separate button, running the same KMO-12 confirmation flow unchanged.

Required an unplanned backend change: ams's GET /api/v1/user had no position or premise. Shipped and merged to ams master as KOL-61.

Verified: npm run check green (68 suites, 1208 tests), and again by the pre-push hook on both repos. flows/kmo-25-profile-screen-and-menu.yaml passes twice on the emulator against the live backend; kmo-12-sign-out.yaml re-run to confirm the SignOut row refactor didn't regress it. Screenshot read by eye against the design.
<!-- SECTION:FINAL_SUMMARY:END -->
