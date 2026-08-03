---
id: KMO-13
title: Change password
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-03 20:46'
labels:
  - mobile
  - auth
  - compliance
milestone: m-0
dependencies:
  - KMO-9
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Res. 38 Art. 7f requires the worker to be able to change their own password, with an automatic confirmation email. This is a compliance checklist item, not a convenience feature. Reached from Mi perfil.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A change-password screen collects the current password and the new password with confirmation
- [x] #2 Server-side validation errors, including a wrong current password and a password failing policy, display as field-level Spanish messages
- [x] #3 A successful change confirms in-app and states that a confirmation email has been sent
- [x] #4 The session remains valid after the change, or the app re-authenticates cleanly if the server revokes tokens
- [x] #5 The screen is reachable from Mi perfil
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
0. BLOCKER — the endpoint does not exist. routes/api.php in `ams` is tokens/user/marks and nothing else (PRD 7.1 A3). Needs a paired KOL ticket, following KOL-5 and KOL-6:
   PUT /api/v1/user/password, auth:sanctum, body {current_password, password, password_confirmation}
   -> 204 on success; 422 errors.current_password ('La contraseña es incorrecta.') or errors.password
   Reuses PasswordValidationRules (currentPasswordRules + passwordRules) and lang/es/validation.php, both already Spanish.
   Art. 7f email needs no work: UserObserver::updated already mails AuthProfileUpdated on a password change.
   Decision for AC#4: revoke the employee's OTHER device tokens, keep the one that made the change.

1. src/features/auth/password-api.ts — createPasswordApi(client?) with changePassword({currentPassword, newPassword}).
   Uses the @/api SINGLETON, unlike auth-api.ts which deliberately builds its own client. auth-api opts out of
   the session-expiry latch because its 401s mean 'wrong password' / 'already dead'. Here a 401 means the token
   really is gone, so the latch is exactly what is wanted — that is AC#4's second branch, already built by KMO-11.
   Failure mapping reuses ApiError.messageFor('current_password') / messageFor('password') — AC#2.

2. src/i18n/strings.ts — es.auth.changePassword: action, title, intro, the three field labels, per-field required
   messages, the client-side confirmation-mismatch message, and the success title/body naming the email (AC#3).
   NOT here: why the server refused. Wrong-current-password and policy failures arrive in Spanish from ams and are
   shown verbatim, same rule as the login refusal (strings.test.ts asserts it).

3. src/features/auth/change-password.tsx — the form. Three TextFields (secureTextEntry + reveal toggle), submit
   Button with loading + double-submit guard, per-field errors, and an inline success panel replacing the form
   once it succeeds (AC#1, #2, #3). Empty fields and a mismatched confirmation are caught before the request,
   like login-screen.tsx does.

4. src/app/cambiar-contrasena.tsx — the route; Screen + OverlayHeader, composes only (README rule).
5. src/app/_layout.tsx — <Stack.Screen name="cambiar-contrasena" /> inside the signedIn && !locked guard.
6. src/app/perfil.tsx — a Card with a secondary Button routing to it (AC#5), above SectionScaffold and carrying
   the same 'KMO-25 folds this into the real menu' note UnlockSetting and SignOut already have.

7. Tests. Jest carries #1, #2, #3, #4: password-api.test.ts (request shape, 422 field mapping, 401 reaching the
   latch) and change-password.test.tsx (rendering, client-side validation, both server error fields on the right
   inputs, the success panel).
   flows/kmo-13-change-password.yaml carries #5 and the on-screen Spanish: sign in, Mi perfil, tap through,
   submit a deliberately WRONG current password, assert 'La contraseña es incorrecta.' lands under that field.
   The flow deliberately does not complete a successful change — it would rotate the seeded employee@example.com
   password and make every later run of shared/sign-in.yaml fail. The success path is Jest plus one manual run.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Backend shipped alongside as `ams` KOL-7 (branch feature/kol-7-change-password, two commits, not merged): PUT /api/v1/user/password. Without it this ticket could not close — routes/api.php had no password endpoint at all.

Two things found while building it, both fixed in KOL-7:

1. **The current_password rule needed its guard named.** Unqualified it resolves the *default* guard; auth:sanctum happens to make that sanctum today, but if it ever stops being so the rule compares against a null web-guard user and rejects every correct password — telling employees they got their own password wrong. Now 'current_password:sanctum', with a test.

2. **'El campo password debe tener al menos 8 caracteres.'** — the policy message had an English field name in the middle of a Spanish sentence, and this screen renders it verbatim under the input. lang/es/validation.php had an attributes map with password simply missing from it. Now 'El campo contraseña debe...'. Art. 5.

On the mobile side, the one decision worth recording: password-api.ts talks through the @/api **singleton**, unlike auth-api.ts which deliberately builds its own client to opt out of the session-expiry latch. Here the latch is wanted — a 401 on this call means the token really is dead — so #4's second branch is KMO-11's machinery and needed no new code.

Validation:
- npm run check green: typecheck, lint, format, 564 tests over 37 suites (25 new — password-api.test.ts 10, change-password.test.tsx 15).
- bin/e2e kmo-13 passed twice, second time after the seeded password had been changed and restored, which is what proves the flow is re-runnable.
- Live against a running `ams`: wrong current password -> 422 errors.current_password; weak new password -> 422 errors.password in full Spanish; success -> 204; the token that made the change still GETs /api/v1/user 200 while the same employee's other device gets 401; queue drained and 'Datos de perfil actualizados' landed in Mailpit at the employee's personal_email.
- The success path was also run once by hand on the emulator through a throwaway flow (screenshot .artifacts/e2e, since deleted), because flows/kmo-13-change-password.yaml deliberately stops short of completing a change: succeeding would rotate employee@example.com's seeded password and break shared/sign-in.yaml for most of flows/. The seeded password was restored with saveQuietly() afterwards, deliberately, so an administrative restore did not mail the employee a security warning.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Cambiar contraseña, reached from Mi perfil, closing Res. 38 Art. 7f (checklist F05) for a mobile-only employee.

The screen collects the current password and the new one twice, catches empty fields and a mismatched confirmation before spending a round trip, and puts each server refusal under the input it names — the wrong-current-password and password-policy sentences come from ams in Spanish and are rendered verbatim, so the same rejection reads identically on the phone and on the web console. Success replaces the form rather than sitting above it, and says the confirmation email is on its way.

There is one password. It is users.password, the same credential the web console takes, and the screen says so — an employee who believed this was a phone-only password would be picturing an account that does not exist.

The session survives the change on the device that made it, while the employee's other device tokens are revoked, so a password changed under duress ends the other sessions without locking the employee out of punching on the phone in their hand. If a future policy revokes the current token too, the app already lands cleanly on the login screen via KMO-11.

Needs ams KOL-7 deployed; against a server without it the PUT 404s.
<!-- SECTION:FINAL_SUMMARY:END -->
