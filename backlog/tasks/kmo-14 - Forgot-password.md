---
id: KMO-14
title: Forgot password
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-04 18:29'
labels:
  - mobile
  - auth
milestone: m-0
dependencies:
  - KMO-8
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A mobile-only employee who forgets their password currently has no route back in without going to a desktop or asking HR. That makes the app unusable for exactly the person it is built for.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A forgot-password link on the login screen collects the email and requests a reset
- [x] #2 The response is identical whether or not the email exists, so the screen does not disclose which addresses are registered
- [x] #3 The confirmation explains in Spanish what the employee should expect and where to look
- [x] #4 The reset link opens correctly from the phone and the employee can log in with the new password afterwards
- [x] #5 Repeated requests are rate-limited or throttled with a clear message rather than failing silently
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
0. BLOCKER — the endpoint does not exist. routes/api.php in `ams` is tokens / user / user-password / marks and nothing else (PRD 7.1 A4). Needs a paired KOL ticket, following KOL-5/6/7/8:

   POST /api/v1/forgot-password, public, body {email}.
   -> 204 No Content ALWAYS, whatever the broker answered. Password::broker()->sendResetLink() returns
      INVALID_USER for an unknown address and RESET_THROTTLED for a second request inside config/auth.php's
      60s per-user window; both are swallowed. Fortify's own POST /forgot-password does NOT do this — it 422s
      with 'No podemos encontrar un usuario con esa dirección…', which is exactly the disclosure AC#2 forbids.
      A malformed or missing email is still a 422 on errors.email: that leaks nothing.
   -> No is_active branch. A deactivated employee may reset their password and still cannot get a token
      (TokenController rejects), and branching would disclose account state.
   -> Throttled by a ThrottleTokenIssuance-shaped middleware keyed on email + IP, so AC#5 is a 429 with
      Retry-After that the app already knows how to handle (KMO-50). The broker's own per-user throttle
      cannot carry #5: it is invisible from outside, by design.
   -> The reset LINK is the existing web page, GET /reset-password/{token} (Fortify). No deep link, no
      in-app reset screen, no App Links / assetlinks.json.
   -> The reset EMAIL is Laravel's stock ResetPassword notification and lands in ENGLISH: ams has no
      lang/es.json, so 'Reset Password Notification' / 'You are receiving this email because…' is what an
      employee reads. Art. 5 and AC#3 both fail on that. KOL ticket adds App\Notifications\ResetPassword
      + resources/views/mail/reset-password.blade.php in Spanish and User::sendPasswordResetNotification().
   -> resources/js/pages/auth/reset-password.tsx is English too ('Reset password', 'Password', 'Confirm
      password'). It stops being an admin-only page the moment this ships. Raised separately.

1. src/ui/text-link.tsx (+test) — the text-link primitive AC#1 needs. Pressable + Text, 44px hit target
   (hitTargetMin), theme tokens only. In ui/ rather than inline in the login screen: it holds no domain
   knowledge, which is the README's own test for where it belongs.

2. src/features/auth/forgot-password-api.ts (+test) — createForgotPasswordApi(client?) with
   requestReset(email). Builds its OWN client like auth-api.ts, for auth-api.ts's reason: the @/api
   singleton latches a 401 into 'your session ended', and nobody on this screen has a session to lose.
   Failure mapping REUSES authFailureFrom from ./auth-api — connectivity/throttled/rejected is the same
   three-way split, and a second copy would be a second thing to keep in step.

3. src/i18n/strings.ts — es.auth.forgotPassword: action ('¿Olvidaste tu contraseña?'), title, back, intro,
   submit, successTitle, done. Plus passwordResetSent(email), a function like tooManyAttempts/
   unsyncedPunchesWarning, for the confirmation that has to name the address without confirming it exists
   (AC#2 + AC#3): 'Si <email> tiene una cuenta en Kolvi, te enviamos un enlace…', where to look, spam, and
   the 60-minute expiry. The expiry number is config/auth.php's 'expire' => 60 — a comment says so, because
   the app is stating a server-side duration it cannot read.

4. src/features/auth/forgot-password.tsx (+test) — the screen. One email field, submit with the loading +
   double-submit ref guard, the throttle gate (throttleDeadline / useThrottleCountdown, unchanged from
   KMO-50), the danger panel for a refusal, and a success panel that REPLACES the form the way
   change-password.tsx does — a second submit from a screen that already sent the mail only feeds the limiter.

5. src/app/recuperar-contrasena.tsx — the route; Screen + OverlayHeader, back to the login screen. Composes only.
6. src/app/login.tsx — stops being `export default LoginScreen` and becomes the wrapper that passes
   onForgotPassword, so no expo-router import enters src/features (nothing there has one today).
7. src/app/_layout.tsx — <Stack.Screen name="recuperar-contrasena" /> inside the !signedIn guard.
8. src/features/auth/login-screen.tsx — the TextLink under the submit button (AC#1), onForgotPassword prop.

9. Tiers.
   #1 Jest (the link renders and calls through; the request shape) + Maestro (tap it on the device).
   #2 SERVER-side criterion. ams feature test: unknown email and known email both 204, byte-identical, and
      no mail for the unknown one; plus a live probe against the running ams. Jest covers this side: a 204
      renders the same non-disclosing confirmation either way.
   #3 Jest for the copy + Maestro for it being on screen.
   #4 NEITHER Jest NOR Maestro can carry this — it needs a mail client and a browser. Manual on the
      emulator, written up: pull the link out of Mailpit, open it with `adb shell am start -a VIEW`,
      set a new password, then sign in through the app with it. If the AVD has no browser it is a physical/
      manual tier and this ticket says so rather than checking it.
   #5 Jest (429 -> tooManyAttempts, submit disabled) + flows/kmo-14-forgot-password.yaml, modelled on
      kmo-50-login-throttled.yaml: a throwaway address per run so the limiter bucket is fresh, N+1 requests,
      assert the Spanish and the dead button, assert 'Too Many Attempts.' never reaches the screen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan approved 2026-08-04 with three decisions:
- The reset link is the existing web page (GET /reset-password/{token}) opened in the phone's browser. No deep link, no in-app reset screen, no App Links — that would need assetlinks.json on the ams host and an https redirect, for a flow the browser already handles.
- The paired ams ticket covers the endpoint AND a Spanish reset email. Laravel's stock notification is English and ams has no lang/es.json, so shipping the endpoint alone would satisfy AC#3 on screen and break its promise in the inbox (Art. 5).
- The web reset page (resources/js/pages/auth/reset-password.tsx) is English too and becomes employee-facing the moment this ships. Deliberately NOT translated here — it is one page of an otherwise-English console and that is its own decision. Raised separately.

Backend shipped alongside as `ams` KOL-9 (branch feature/kol-9-forgot-password, one commit, not merged): POST /api/v1/forgot-password. Without it this ticket could not close — routes/api.php had no such route (PRD 7.1 A4).

Three things found while building it:

1. **Fortify's own endpoint is a user-enumeration oracle.** POST /forgot-password answers an unknown address with a 422 carrying 'No podemos encontrar un usuario con esa dirección de correo electrónico.' — so pointing the app at it would have satisfied #1 and broken #2 in the same call. The new endpoint swallows every broker status and returns 204. RESET_THROTTLED is swallowed too, and that one is easy to miss: an address with no account can never be throttled by the broker, so reporting the throttle discloses the account as plainly as reporting INVALID_USER.

2. **The reset email was English.** Laravel's ResetPassword notification reads its lines from a lang/es.json `ams` does not have, so app.locale=es made no difference: 'Reset Password Notification' / 'You are receiving this email because…'. Harmless while only administrators reset passwords; not harmless the moment this screen tells an employee, in Spanish, to go and read it (Art. 5). KOL-9 adds App\\Notifications\\ResetPassword + a Spanish mail view and points User::sendPasswordResetNotification at it, so the console mails the same thing.

3. **#5 cannot ride on the broker's own throttle.** config/auth.php throttles one reset per user per 60s, but that is invisible from outside by construction (see 1). The criterion is carried by route middleware keyed on email + IP at 3/minute, which counts every request — including for addresses with no account — so the 429 the app counts down is the same for everyone.

On this side the one decision worth recording: forgot-password-api.ts reuses `authFailureFrom` from auth-api.ts rather than mapping failures again. The three-way split it makes — nothing was decided / not yet / refused — is exactly this screen's, down to which one may offer a retry, and a second copy would be a second thing to keep in step with ams's error shapes.

src/ui/text-link.tsx is new: a text link with the full 44dp target, underlined as well as tinted. In ui/ rather than inline because it holds no domain knowledge, which is the README's own test.

The reset link deliberately goes to the console's existing page rather than into the app. Recorded as A4 in docs/design-decisions.md along with the non-disclosure decision.

Validation:
- npm run check green: typecheck, lint, format, 650 tests over 41 suites (31 new — forgot-password-api.test.ts 9, forgot-password.test.tsx 18, text-link.test.tsx 4, plus 3 added to login-screen.test.tsx).
- ams side: 9 new feature tests in tests/Feature/Api/ForgotPasswordApiTest.php, full suite 648 passed / 4 skipped, phpstan clean. Pint reports 9 pre-existing trailing-newline failures that predate this branch (confirmed by stashing) and none in the files it adds.
- bin/e2e kmo-14 passed. Covers #1, #3, the observable half of #2 and #5.
- Live against a running `ams` carrying KOL-9: a known and an unknown address both return 204 with byte-identical bodies; the fourth request for one address returns 429 with Retry-After: 60 and X-RateLimit-Limit: 3; a malformed address returns 422 with the Spanish validation sentence; the queued mail lands in Mailpit as 'Restablece tu contraseña', in Spanish, linking to /reset-password/{token}.
- #4 walked through by hand on the emulator end to end, against a throwaway employee cloned from the seeded one (kmo14@example.com) so employee@example.com's seeded password was never rotated — the trap KMO-13 documented. Requested the link from the app, drained the queue, opened the mailed URL with `adb shell am start -a VIEW`; Chrome loaded the console reset page with the address pre-filled, set a new password, and the page answered 'Su contraseña ha sido restablecida.' Signing into the app with that password landed on Inicio. The throwaway employee was deleted afterwards and the seeded one verified intact.
  Two dev-environment obstacles worth knowing for the next person: the page is blank on the emulator while public/hot points Vite at localhost:5173 (unreachable from the AVD, and the dev server was not running anyway) — serving the compiled bundle instead makes it same-origin and it renders. public/hot was restored.
- The flow's countdown assertion was rewritten after a first failure that was the flow's fault, not the app's: this limiter's window opens on the *first* of the four requests, so what is left of it by the fourth depends on how long Maestro took to walk back through the login screen three times. It was 7 seconds on the run that failed. The assertion now checks that an interval is named at all (Retry-After was read), then that it reaches single digits, then that the control comes back — which proves movement from whatever it started at.

Revised after review: the Spanish reset email is now built by `ResetPassword::toMailUsing()` in FortifyServiceProvider rather than by an App\\Notifications\\ResetPassword of our own. Same email, same blade view, same lang/es/mail.php copy — but the broker keeps sending the framework's class, so app/Models/User.php needs no sendPasswordResetNotification override and tests/Feature/Auth/PasswordResetTest.php goes back to untouched. KOL-9 is 8 files instead of 10, about 90 lines lighter.

Not a lang/es.json, which would have been smaller still: that file is keyed on the English source sentence, so a framework reword stops matching and silently reverts the line to English with nothing to fail. Laravel already changed this subject once ('Reset Password Notification' -> 'Reset your password'), so a translation written against the old key would be dead today. ForgotPasswordApiTest asserts through toMail() rather than against the catalogue, so removing the callback fails the suite — the class name alone would not notice.

One consequence worth carrying: the framework's notification is NOT ShouldQueue, so the reset email now goes out synchronously inside the request; the class it replaced was queued. Measured against the local Mailpit, a known address answers in ~245-270ms against ~232-234ms for an unknown one. The channel is not new — sendResetLink() already hashed a token and wrote a row for a known address only, so the difference existed before this change — but a synchronous send widens it, and a production SMTP provider would widen it much further than Mailpit on the same host does. Closing it properly means dispatching the whole sendResetLink() call to the queue so the controller does identical work either way. Raised, not done.

The reset mail is now queued: ForgotPasswordController dispatches App\\Jobs\\SendPasswordResetLink instead of calling Password::broker()->sendResetLink() inline, so the broker's token hash, its password_reset_tokens write and the SMTP handshake all happen off the request. That closes the timing side of #2, which the uniform 204 alone did not:

  before, inline    known 0.245 0.244 0.272s   unknown 0.231 0.234 0.234s
  after, dispatched known 0.032 0.034 0.033s   unknown 0.035 0.034 0.032s

Measured against the local Mailpit, warmed first and interleaved in both orders — the earlier run that put all the known addresses first showed a gap that turned out to be warm-up, not the address. After the change the ordering no longer predicts anything, which is the point: response time stops tracking whether the account exists.

Encoded as a test rather than left to the numbers, since a timing measurement cannot live in a suite: 'the request does identical work whether or not the address has an account' fakes the queue, asserts the job is pushed for both addresses, and asserts nothing was notified during the request — which only holds while the broker is off the request path.

Also restores the async send that was lost when App\\Notifications\\ResetPassword went away (the framework's notification is not ShouldQueue; the deleted class was). No new operational requirement — ams already needs a worker for the mark, leave and document mails.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added ¿Olvidaste tu contraseña? to the login screen and the Recuperar contraseña screen behind it, closing PRD 7.1 A4 — a mobile-only employee who forgets their password now has a route back in that does not need a desktop or a call to HR.

The screen is built around a server that deliberately tells it nothing. `ams` answers 204 whether or not the address has an account, so the confirmation is conditional — 'Si {correo} tiene una cuenta en Kolvi, te enviamos un enlace…' — and says where to look, that the link opens on this phone, and that it lasts an hour. That wording is not politeness: a screen that said 'te enviamos un correo' would be a claim the app cannot support and would turn a public endpoint into a way to test whether a given person works at the company.

The link goes to the console's existing reset page, opened by the phone's browser. A deep link into the app would have needed Android App Links — assetlinks.json on the ams host, cert fingerprints, an https redirect because mail clients do not follow a bare kolvi:// — to duplicate a page that already exists and already works on a phone.

Repeated requests are capped by a limiter rather than by the response, since the response cannot vary. The screen reads the 429, counts the wait down in Spanish and holds the submit control, reusing KMO-50's machinery unchanged; none of Laravel's 'Too Many Attempts.' reaches an employee.

Needs ams KOL-9 deployed; against a server without it the POST 404s and the confirmation never appears. That branch also fixes a pre-existing gap it exposed: the reset email itself was English, which no amount of Spanish on this screen would have made up for.

One thing left visibly imperfect and deliberately out of scope: the console reset page the link opens is in English ('Reset password', 'Password', 'Confirm password'). It was an administrator-only page until today and is now the employee-facing half of this flow. Translating one page of an otherwise-English console is its own decision, not a side effect of this ticket.
<!-- SECTION:FINAL_SUMMARY:END -->
