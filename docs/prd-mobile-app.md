# PRD — Kolvi Employee Mobile App

**Status:** Draft for review
**Date:** 2026-07-30
**Owner:** Jorge Leon
**Companion design:** Claude Design project `b62ea466-327b-4798-a07a-6afbc268c6bf`, file `Kolvi App.dc.html` (Android frame, 412×892)
**Backend:** this repository (`ams`) — Laravel 13, Inertia + React web app, Sanctum API

---

## 1. Summary

Kolvi is a Chilean attendance management system (AMS). The web app serves administrators, HR, supervisors and the Dirección del Trabajo (DT) fiscalization panel. Employees today clock in and out from a widget on the web dashboard, which requires a browser and a desktop-shaped workflow.

This PRD covers a **native mobile app for employees**. Its primary job is registering attendance punches (*marcaje*) from the employee's own phone, with the geolocation and receipt (*comprobante*) evidence that Resolución 38 expects. Around that primary job it exposes the three other self-service surfaces the employee already has on the web: their computed workdays (*jornada*), their leave requests (*permisos*), and their electronically-signed documents (*documentos*).

The app is a **client of the existing domain logic**, not a reimplementation of it. Every punch, leave and signature must flow through the same managers, observers and actions the web app uses, so the legal snapshot, checksum, shift resolution and audit trail stay identical regardless of entry channel.

### 1.1 Goals

| # | Goal | Measure |
|---|---|---|
| G1 | An employee can clock in/out in under 10 seconds from app open | Time-to-punch p90 < 10 s |
| G2 | Every punch carries geolocation and produces a compliant receipt | 100% of mobile punches have lat/lng or an explicit "no GPS" reason |
| G3 | Employees stop needing HR to answer "how many hours did I work?" | Reduction in mark-correction requests opened by admins |
| G4 | Leave requests and document signatures complete without a desktop | ≥70% of employee leave requests and signatures originate on mobile within 2 releases |
| G5 | The app satisfies the employee-facing obligations of Resolución 38 | Checklist items F01, F11, F12, F13, F23 move to *Cumple* |

### 1.2 Non-goals

- Administrator, HR or supervisor functions (employee management, shift authoring, workday review, reporting, org settings).
- The DT fiscalization panel — that is a web-only, browser-accessed surface by regulation.
- Supervisor leave approval. The `supervisor` role and its `ViewTeam:Leave` / `ApproveTeam:Leave` permissions exist, and approving from a phone is an obvious future want, but it is explicitly out of v1. See §11.
- Kiosk / shared-device mode (one tablet at the premise entrance, many employees). Different auth model; separate PRD if wanted.
- Biometric *identification* of the employee (fingerprint matched server-side). Device biometric *unlock* is in scope; see §7.1.
- Replacing the web self-service pages. Both channels stay live.

---

## 2. Users and context

**Primary persona — the employee (`employee` role).** Works a scheduled shift at an assigned premise. Owns a phone, often a low-to-mid Android device on mobile data with patchy coverage inside warehouses, basements and cold rooms. May not be a confident app user. Speaks Chilean Spanish. Cares about: clocking in without friction, not being marked absent unfairly, knowing their hours, and getting vacations approved.

Their existing permissions (from `RoleSeeder::EMPLOYEE_PERMISSIONS`) define the app's ceiling:

```
RequestOwn:Leave      ViewOwn:Leave         CancelOwn:Leave
ClockOwn:Mark         ViewOwn:Mark          ViewOwn:Workday
ReviewOwn:MarkModification
ViewOwn:Document      SignOwn:Document
```

Every feature in this PRD maps to one of those permissions. **The app must gate features on the permissions the API reports for the user, not on the role name and not on hardcoded assumptions** — an organization can revoke `CancelOwn:Leave` and the app must hide the cancel action accordingly.

**Secondary persona — the admin who also punches.** The `admin` role holds `ClockOwn:Mark` and `ViewOwn:Mark` explicitly (the super-admin gate does not bypass Spatie's `permission:` middleware). An admin using the app should get a working Marcaje tab and empty-or-hidden states elsewhere rather than errors.

**Tenancy.** Users belong to `organization` → `company` → `premise`. Models use the `BelongsToOrganization` concern with a global scope, so the API inherits tenant isolation as long as endpoints resolve the tenant from the authenticated user and never from a client-supplied parameter.

---

## 3. Platform and architecture

### 3.1 Decisions to confirm before ticketing

| # | Decision | Recommendation | Why it matters |
|---|---|---|---|
| D1 | Framework | **React Native (Expo)** | Team is already deep in React 19 / TypeScript; Expo gives OTA updates, managed builds, and first-class geolocation, secure-storage, biometric and push modules. Alternative (native Kotlin/Swift) doubles the surface for no feature gain here. |
| D2 | Platforms & minimums | **Android first** (design is an Android frame), iOS in the same codebase, shipped one release later. Android 9+ / iOS 15+. | Chilean blue-collar workforce is overwhelmingly Android. |
| D3 | Distribution | Play Store + App Store, single app, org resolved from the user's credentials | Per-tenant white-label builds would multiply release work. Revisit only if a customer demands it. |
| D4 | Auth model | Sanctum personal access token per device, obtained from `POST /api/sanctum/token` | Already implemented; see §7.1 for the gaps. |
| D5 | Offline punching | **In scope for v1**, queued with dual timestamps | See §7.3. This is the single biggest field-reality risk. |
| D6 | Push notifications | Expo Push (FCM/APNs behind it), new Laravel notification channel | Needed for pending-signature and leave-decision nudges; nothing exists today. |
| D7 | API shape | Extend `routes/api.php` with a versioned `/api/v1` prefix, Eloquent API Resources throughout | The existing three mark routes are unversioned. Decide whether to move them or leave them and start v1 alongside. |

### 3.2 API principles

- **All new endpoints are `auth:sanctum` + `permission:` guarded**, mirroring the web routes exactly. A mobile route must never be more permissive than its `my.*` web counterpart.
- **Every response goes through an Eloquent API Resource.** `GET /api/user` currently returns `$request->user()` raw — the whole model, including `two_factor_secret`, `remember_token` and `password` hash unless hidden. That is a bug to fix as part of this work, not a new feature.
- **All writes go through the existing manager/action layer** (`MarkManager`, `LeaveManager`, `SendVerificationCode`, `SignDocument`, `RejectDocument`, `MarkModificationManager`). No endpoint may write a `Mark` directly.
- **Datetimes are naive, Santiago-local.** The codebase stores wall-clock time without a timezone offset and displays it naively; the API must not apply `setTimezone` on output, and the app must not convert on input or display. `MarkResource` currently emits `toIso8601String()`, which stamps the app timezone onto a naive value — decide on one wire format (recommendation: `YYYY-MM-DD HH:mm:ss` naive strings, documented as Santiago wall time) and apply it consistently.
- **All user-facing strings come from the server or from the app's own Spanish catalogue.** Server-side enums already expose translated `label()`s via `lang/`; prefer sending `{value, label}` pairs so the app never re-translates domain vocabulary.

---

## 4. What the backend already provides

Accurate as of `f0a4498`. This section is the baseline; §5 states what each feature still needs.

### 4.1 Existing mobile API (`routes/api.php`) — the entire current surface

| Endpoint | Guard | Behavior |
|---|---|---|
| `POST /api/sanctum/token` | public | `{email, password, device_name}` → `{token}`. Rejects wrong credentials and inactive users (`auth.inactive`). Deletes the prior token with the same `device_name`. |
| `GET /api/user` | `auth:sanctum` | Returns the raw User model. |
| `POST /api/marks` | `permission:ClockOwn:Mark` | `{type: in\|out, datetime, lat?, lng?}` → 201 `{mark_id, hash, datetime, type}`. Creates via `MarkManager::createMark`; attaches lat/lng *after* stamping, so geolocation is deliberately outside the checksum. |
| `GET /api/marks` | `permission:ViewOwn:Mark` | The user's 10 most recent marks, newest first. Not paginated, no date filter. |
| `GET /api/marks/{mark}` | `permission:ViewOwn:Mark` | One mark, 404 if not the caller's. |

### 4.2 Domain logic the app can rely on

- **`MarkManager`** — resolves the punch time in the user's timezone, looks up the `ShiftAssignment` active on that date, finds the matching `ShiftDay` (weekday 0=Monday…6=Sunday, `is_free` respected), and snapshots `shift_id` / `shift_start_time` / `shift_end_time` onto the mark. Also exposes `getShiftForToday()` and `getTodayMark(type)`.
- **`MarkObserver`** — on create, stamps the immutable legal snapshot (`employee_rut`, `employee_name`, `employer_rut`, `employer_name`, `premise_name`, `premise_address`, resolved from the user's company and assigned premise) and the SHA-256 `checksum` over `user_id + type + ISO8601 datetime`. On created, emails a `MarkCreated` receipt **only when `personal_email` is set**.
- **`WorkdayCalculator` / `Workday`** — the daily roll-up: `mark_in_at`, `mark_out_at`, `worked_time`, `extra_time`, `missing_time`, `in_time_difference`, `out_time_difference`, and a `WorkdayStatus` (`regular`, `irregular`, `absent`, `incomplete`, `justified`) with a semantic `badge()` tone.
- **`MarkModification`** — admin-initiated corrections to an employee's marks, which **the employee approves or declines** within `config('ams.mark_modification_timeout_hours')`. `isActionable()` = pending and not expired.
- **`Leave` / `LeaveManager` / `BusinessDaysCalculator`** — types `vacation_lead`, `medical_lead`, `unpaid_lead`, `paid_lead`, `other_lead`; statuses `pending`, `approved`, `rejected`; half-day support (`half_day`, `half_day_type` morning/afternoon, always 0.5 days); server-side business-day calculation honoring holidays; `selfServiceOptions()` deliberately **excludes medical leave** because `LeaveObserver` auto-approves it. Submitting notifies approvers resolved by `LeaveApprovers`.
- **Vacation balance** — `My\LeaveController::vacationBalance()` computes `{used, available, total}` from approved vacation leaves against `user.vacation_days + user.additional_vacation_days`.
- **Documents & firma electrónica simple** — `Document` (status `draft` … `signed`/`rejected`/`voided`/`archived`), `DocumentSignature` per signatory with `type` (employee/legal_rep/supervisor), optional `order` for sequenced signing, `verification_code` + `verification_code_expires_at`, and post-signature evidence `signed_ip`, `signed_user_agent`, `signed_content_hash`. `SendVerificationCode` mints a 6-digit code with a **15-minute expiry**, emails it to `personal_email ?? email`, and reuses a live code unless `resend()` forces a new one. `SignDocument` and `RejectDocument` complete the flow. Document bodies are rendered through `DocumentVariableResolver`; a signed PDF is available via a media collection once complete.
- **Shift schedule detail** — `ShiftDay` carries `lunch_start_time` / `lunch_end_time` (so the design's *Colación* row has real data) and `total_work_hours`; `Shift` carries `tolerance_in` / `tolerance_out` and `work_on_holidays`.

### 4.3 What does **not** exist and the design assumes

These are the substantive engineering items hiding inside the mockup. Each is broken out in §5 and §6.

1. **No geofence.** `Premise` has `lat`/`lng` but **no radius**. `Mark.lat`/`lng` are optional, unvalidated metadata. There is no "out of range" concept, no server-side distance check, and no queue for out-of-range punches.
2. **No break/colación marks.** `MarkType` is `in` | `out` only. The design's *Iniciar colación* / *Terminar colación* buttons have no backend representation.
3. **One punch per type per day.** The web `My\MarkController` blocks a second mark of the same type on the same day. The design's state machine (before → working → break → afterbreak → done) requires more than two punches per day.
4. **No folio.** The design's receipt shows `N° comprobante`. Marks have `id` and `checksum`; there is no human-readable folio, and `MarkResource` omits the name, RUT, date and time that Art. 13 requires on a receipt.
5. **No API for shift, workdays, leaves, or documents.** All four exist only as Inertia web pages under `My\*`.
6. **No push notification infrastructure.** All notifications are mail today.
7. **No mobile-appropriate auth lifecycle** — no logout/revoke endpoint, no password change, no forgot-password, no throttling on the token endpoint, no biometric unlock.
8. **No offline support** anywhere in the stack.

---

## 5. Feature specification

Structure mirrors the design's four tabs plus profile. Each feature lists the employee-visible behavior, the backend work it implies, and the deltas where the mockup and the domain disagree — those deltas are decisions, and each one should become a ticket comment or its own ticket.

### F1 — Marcaje (home tab): register a punch

**Permission:** `ClockOwn:Mark`

**The screen.** Date and greeting (`Hola, {first_name}`). A geolocation status card. Today's shift card with the scheduled window and colación. A live clock (updates at least every 30 s) and a status line. One large primary action button, an optional secondary action, and contextual recovery actions. A week-to-date hours summary at the bottom.

**Punch state machine (design).**

| State | Status line | Primary | Secondary |
|---|---|---|---|
| `before` | "Aún no marcas entrada" | Marcar entrada | — |
| `working` | "En jornada" | Marcar salida | Iniciar colación |
| `break` | "En colación" | Terminar colación | — |
| `afterbreak` | "En jornada" | Marcar salida | — |
| `done` | "Jornada finalizada" | *(replaced by a success panel)* | — |

**Geolocation states.**

| State | Card | Effect on punching |
|---|---|---|
| Confirmed | success tint, "Ubicación confirmada · {premise} · a {n} m" | Punch enabled |
| Out of range | warning tint, "Fuera del rango permitido" | Primary disabled; an explicit *"Marcar de todas formas (queda pendiente de revisión)"* escape hatch |
| No GPS signal | danger tint, "Sin señal de GPS" | Primary disabled; *"Reintentar ubicación"* |

**After a successful punch:** a bottom-sheet receipt (F2) opens.

**Backend work required.**
- `GET /api/v1/me/today` — a single call returning everything the home screen needs: today's shift (`start_time`, `end_time`, `lunch_start_time`, `lunch_end_time`, premise name, shift name, tolerances), the punch state derived from today's marks, the week-to-date worked vs. scheduled hours, and the geofence parameters (premise lat/lng + radius). One request per app open, not five.
- Extend `POST /api/marks` (or its v1 successor) to accept and act on geolocation: validate distance server-side, and mark the punch as out-of-range when applicable rather than trusting the client's assessment.
- Server-authoritative time: the endpoint currently **requires** a client `datetime`. Resolución 38 Art. 11 wants the system to assign the timestamp. Recommendation: make `datetime` optional and default to server time for online punches; accept a client `device_datetime` only for queued offline punches, storing it separately from the authoritative `date_time` (see §7.3).

**Design ↔ domain deltas — must be resolved before ticketing.**

- **D-F1-a — Colación marks.** Two options. (a) **Add `MarkType::BreakStart` / `BreakEnd`.** Touches the enum, the checksum input, `WorkdayCalculator`, the workday schema, DT reports, and the web UI — a large, cross-cutting change with legal reporting implications. (b) **Drop colación from v1**, showing the scheduled colación window read-only (data already exists on `ShiftDay`) without punchable break buttons. **Recommendation: (b) for v1**, and treat break marks as their own epic with a legal review, since what a *colación* punch means in the attendance book is a compliance question, not a UI question.
- **D-F1-b — Multiple punches per day.** Even without breaks, real days involve leaving and returning. The current one-per-type-per-day guard makes the second `in` fail. Decide: keep the guard (and let the app surface "ya marcaste entrada hoy" cleanly), or allow multiple pairs and teach `WorkdayCalculator` to reduce them. **Recommendation: keep the guard in v1**, surface it as a friendly state rather than an error, and open a separate epic for multi-pair days.
- **D-F1-c — Out-of-range punches "pending review".** There is no such queue. Options: a new `is_out_of_range` / `geo_status` column on `Mark` plus an admin review list; or reuse `MarkModification` (a poor fit — those are admin-initiated corrections the *employee* reviews, the opposite direction). **Recommendation: a flag on `Mark` plus an admin filter**, since the mark itself is valid and legally recorded; it is only *suspect*, and marks are immutable by design.
- **D-F1-d — Week summary ("32.5 / 44 hrs esta semana").** Requires summing `Workday.worked_time` for the ISO week against the shift's `total_week_hours`. Cheap, but define whether the denominator is the shift's contracted weekly hours or the statutory maximum under Ley 21.561 (44 → 40 h transition). Ask a domain expert; do not guess.

### F2 — Comprobante de marca (receipt)

**Regulatory anchor:** Resolución 38 Art. 12 (automatic emailed receipt) and Art. 13 (minimum content: date `dd/mm/aa`, time `hh:mm:ss`, name, RUT, hash; geolocation optional).

**The screen.** A bottom sheet with a success mark, the punch type, date, time, receipt number, the "pending review" warning when applicable, and the standing legal note that the record forms part of the electronic attendance book under Resolución 38. Single "Listo" dismiss.

**Behavior.**
- The receipt is generated from the API response, never from client-side state — the server's recorded time is the truth.
- The employee must be able to retrieve any past receipt, not just the one shown at punch time (Art. 22.1 requires permanent, unrestricted access to 5 years of history). Reachable from the workday detail (F4).
- The receipt must display the SHA-256 hash (or offer to copy it) so the employee can verify it against the public validation endpoint (checklist F08).

**Backend work required.**
- Extend `MarkResource` to Art. 13 completeness: `employee_name`, `employee_rut`, formatted date and time (with seconds), `checksum`, premise name, and lat/lng when present. The snapshot columns are already on the model — this is a resource change, not a schema change.
- **D-F2-a — Folio.** The design shows `N° comprobante` as `YYYYMMDD-NNNN`. Decide whether to introduce a real folio column (unique, sequential per organization, generated in `MarkObserver`) or to present `mark_id` in a formatted way. **Recommendation: a real folio**, because a receipt number the employee reads aloud to HR needs to be short, stable and unambiguous, and Art. 20a expects receipt-to-database consistency.
- Confirm the Art. 12 email works for mobile punches: `MarkObserver::created` sends `MarkCreated` **only if `personal_email` is set**. If a compliant deployment requires the receipt email unconditionally, fall back to `email`, and consider surfacing "add your personal email" as an onboarding nudge in the app.

### F3 — Jornada · Próximos (upcoming shifts)

**Permission:** `ViewOwn:Workday`

**The screen.** A segmented control (Próximos | Historial). Próximos shows today's shift as a highlighted card with the current punch status, then the next N scheduled days with date, time window and premise.

**Backend work required.**
- `GET /api/v1/me/shifts/upcoming?days=14` — resolve the active `ShiftAssignment`, expand `ShiftDay` rows across the requested horizon, skip `is_free` days, and annotate days covered by an approved leave or a `Holiday` (respecting `Shift.work_on_holidays`). Return `{date, weekday_label, start_time, end_time, lunch_start_time, lunch_end_time, premise, is_free, leave_type_label?, holiday_name?}`.
- Note there is no server-side shift-expansion service today; `MarkManager::getShiftForDate` resolves a single date. Extract a small `ShiftScheduleResolver` rather than duplicating that logic.

### F4 — Jornada · Historial and day detail

**Permission:** `ViewOwn:Workday`, plus `ReviewOwn:MarkModification` for the correction actions

**The screen.** Historial lists days newest-first: date, status badge, and Trabajado / Extra / Faltante. Tapping a day opens a full-screen detail with four KPI tiles (worked, extra, missing, in–out), and an attendance strip plotting the in and out punches against the scheduled window on an 08:00–18:00 axis.

**Behavior.**
- Default range: current month, with paging back through history. Art. 22.1 requires access to 5 years, so the endpoint must be range-queryable and paginated, not a fixed window.
- Status badges reuse `WorkdayStatus::badge()` tones so web and mobile agree: `regular`/`justified` → success, `irregular`/`incomplete` → warning, `absent` → destructive.
- Days covered by an approved leave show the leave type instead of hours ("Con permiso" in the mockup).
- The day detail links to each punch's receipt (F2).

**Backend work required.**
- `GET /api/v1/me/workdays?from=&to=&page=` and `GET /api/v1/me/workdays/{workday}` — port `My\WorkdayController::index`/`show` to API resources. `WorkdayPresenter` already shapes the detail (KPIs, attendance strip, modification timeline) for the web view; reuse it.
- **Mark-correction review — missing from the design, and it should not be.** The employee holds `ReviewOwn:MarkModification`, and the web app surfaces admin-requested corrections with approve/decline inside a time-boxed window (`config('ams.mark_modification_timeout_hours')`), after which they expire. If the mobile app is the employee's primary channel, corrections will silently expire unnoticed. **Recommendation: include in v1** — a pending-corrections card on the Jornada tab (original vs. proposed time, reason, requester, time remaining), approve/decline actions, and a push notification when one is opened. Requires `POST /api/v1/me/workdays/{workday}/modifications/{modification}/approve` and `/decline`, both honoring `isActionable()`.
- The attendance strip's hardcoded 08:00–18:00 axis must become dynamic — night shifts and shifts crossing midnight will break a fixed axis.

### F5 — Permisos · list, calendar, and request

**Permissions:** `ViewOwn:Leave`, `RequestOwn:Leave`, `CancelOwn:Leave`

**The screens.** Segmented control (Mis solicitudes | Calendario). The list shows type, date range, status badge and the approver's note when present, above a prominent "+ Nueva solicitud". The calendar is a month grid highlighting approved leave days with a legend. The request flow is a three-step wizard — type → dates + optional note → review → submit — ending in a confirmation.

**Behavior.**
- Statuses map to `LeaveStatus`: `pending` → warning, `approved` → success, `rejected` → destructive.
- Business days are **computed server-side** by `BusinessDaysCalculator` (it honors holidays) and shown in the review step before submit. The app must never compute this locally.
- Vacation balance (`used` / `available` / `total`) should be visible in the request flow, so an employee sees they are asking for more days than they hold *before* submitting.
- Cancel is available only while `pending`, and only if the user holds `CancelOwn:Leave`.
- Submitting notifies the approvers resolved by `LeaveApprovers`; the employee should get a push when the decision lands.

**Backend work required.**
- `GET /api/v1/me/leaves` (filters: status, from, to; paginated; includes `vacationBalance`), `GET /api/v1/me/leaves/options` (self-service types + half-day types), `POST /api/v1/me/leaves`, `GET /api/v1/me/leaves/business-days`, `DELETE /api/v1/me/leaves/{leave}`. All four exist as web actions in `My\LeaveController` — port them, keeping the half-day validation (half-day must be a single day and always counts 0.5).
- `GET /api/v1/me/leaves/calendar?month=` — month-grid data. `LeaveCalendarController::events` exists for the web calendar; confirm whether it scopes to own leaves or to a team before reusing it.

**Design ↔ domain deltas.**

- **D-F5-a — Leave types are wrong in the mockup.** It offers *Vacaciones, Licencia médica, Permiso administrativo, Día compensatorio*. The domain offers `vacation_lead`, `medical_lead`, `unpaid_lead`, `paid_lead`, `other_lead`, and **`LeaveType::selfServiceCases()` deliberately excludes medical leave** because `LeaveObserver` auto-approves it — letting an employee self-request it would bypass approval entirely. "Día compensatorio" does not exist as a type. **The app must render the list the API returns from `selfServiceOptions()`, never a hardcoded list.** If the business genuinely needs medical-leave upload (with `medical_leave_number` and `medical_leave_doctor`, which the model already carries) that is a separate feature with its own approval design.
- **D-F5-b — Half-day is missing from the mockup.** The domain supports it and employees will want it. Add a half-day toggle plus morning/afternoon selection to step 2.
- **D-F5-c — The date stepper is not shippable.** Step 2 uses `–` / `+` buttons that move one day at a time from a 7-day-out default. Requesting leave three months out means dozens of taps. Replace with a native date-range picker.
- **D-F5-d — Rejection reason.** The list shows an approver note ("Cupo mensual excedido"). Confirm which column that maps to — `Leave.notes` is the *requester's* note. If a rejection reason is a distinct field, it may need adding.

### F6 — Documentos · list, read, sign

**Permissions:** `ViewOwn:Document`, `SignOwn:Document`

**The screens.** A list with a "{n} pendientes de firma" subheading and a count badge on the tab bar item; each row shows title, date and a status pill. Tapping opens the document body with a sticky "Firmar documento" bar. Signing sends a 6-digit code to the employee's email, which they enter to confirm; success shows a folio.

**Behavior.**
- Visibility mirrors `My\DocumentController`: non-draft documents that either belong to the user or list them as a signatory.
- `awaiting_me` (from `Document::actionableSignatureFor($user)`) drives both the pending count and whether the sign bar appears — it already accounts for ordered signing, so a signatory whose turn has not come sees the document but cannot sign.
- The code has a **15-minute expiry**; a live code is reused rather than reminted unless explicitly resent. The app must show the expiry, offer resend, and handle the "not your turn" response.
- Signing records `signed_ip`, `signed_user_agent` and `signed_content_hash` — the evidence trail for the *firma electrónica simple*. The app must send nothing that weakens it, and should surface `signed_content_hash` as the "folio" the design shows.

**Backend work required.**
- `GET /api/v1/me/documents`, `GET /api/v1/me/documents/{document}` (body resolved through `DocumentVariableResolver`), `POST .../send-code`, `POST .../sign`, `POST .../reject`, `GET .../download`. All exist as web actions — port them.
- Signed-PDF download on mobile: decide between a native share-sheet download and an in-app viewer.

**Design ↔ domain deltas.**

- **D-F6-a — Reject is missing.** The backend supports rejecting a document with a reason (`RejectDocument`, `rejection_reason`), and a signature flow with no refusal path is legally lopsided. Add a "Rechazar" secondary action with a reason field.
- **D-F6-b — The document body is rendered as prose HTML.** Documents are template-driven with resolved variables. Confirm the wire format (sanitized HTML vs. structured blocks) and how the app renders it safely — an HTML renderer in a signing flow is a security-relevant choice.
- **D-F6-c — Where does the code go?** `SendVerificationCode` mails to `personal_email ?? email`. On a work-issued corporate address the employee may not have mobile access. Consider SMS as an alternative channel (`user.phone` exists) — and note Resolución 38 Art. 7g's "two identification alternatives" requirement pushes in the same direction.
- **D-F6-d — Remove the demo affordance.** The mockup prints "Modo demostración: código 482913" on screen. Obvious, but it must not survive into a build.

### F7 — Mi perfil

**The screen.** Avatar/initials, full name, "{position} · {premise}", then a menu: Mis datos, Notificaciones, Ayuda y soporte, Cerrar sesión.

**Scope for v1.**
- **Mis datos** — read-only view of name, RUT (formatted), corporate email, personal email, phone, position, premise, supervisor, contract start date. Editable subset: personal email, phone, emergency contact. (`UpdateUserProfileInformation` exists via Fortify; expose a narrow API equivalent.)
- **Notificaciones** — per-category push toggles (punch reminders, leave decisions, documents to sign, mark corrections).
- **Ayuda y soporte** — Spanish help content plus a support contact. Resolución 38 Art. 5 requires the platform *and its manuals* in Chilean Spanish; the in-app help is where that obligation lands for mobile.
- **Cerrar sesión** — must revoke the device's Sanctum token server-side, not merely clear local storage. No endpoint exists today (§7.1).
- **Change password** — Art. 7f requires the worker to be able to change their own password, with an automatic confirmation email. Belongs here.

---

## 6. Geolocation and geofencing

This is a feature area, not a detail, and it is entirely unbuilt.

**Current state.** `Premise.lat`/`lng` exist. `Mark.lat`/`lng` exist and are written *after* the checksum is computed — geolocation is explicitly non-integrity metadata. Nothing validates, requires or reviews them.

**Required for the design's behavior.**

1. **A radius per premise** (`Premise.geofence_radius_meters`, nullable = no geofence). Admin-editable in the web premise form.
2. **Server-side distance evaluation** on punch: haversine between the reported point and the premise, compared against the radius, producing a status — `inside` | `outside` | `unknown` (no fix) — persisted on the mark alongside the reported accuracy.
3. **Client-side pre-flight** so the app can render the three geolocation card states *before* the employee taps, and to decide whether to disable the primary button. The client's view is advisory; the server's evaluation is authoritative.
4. **A review path** for out-of-range punches (see D-F1-c).
5. **A policy decision:** does an out-of-range punch get *blocked* or *recorded-and-flagged*? The design records-and-flags, which is the right call — refusing to record a punch an employee actually made is worse than recording a suspect one, and Resolución 38 treats the register as the legal record. Confirm with the compliance owner.
6. **Permission handling.** Android and iOS both require runtime location permission with a clear rationale, and both allow permanent denial. Define the degraded path: an employee who denies location must still be able to punch (with `geo_status = unknown`), or attendance becomes unrecordable — which is a legal problem, not a product one.
7. **Anti-spoofing is out of scope for v1**, but note it: mock-location apps are trivially available on Android. Detecting them (`isFromMockProvider`) is a cheap signal worth capturing on the mark even if nothing acts on it yet.

Art. 13 lists geolocation on the receipt as **optional**, so none of this is strictly mandatory — but it is the main reason an employer prefers a phone app over a fixed reader, and it is what the design promises.

---

## 7. Cross-cutting requirements

### 7.1 Authentication, session and device lifecycle

Existing: `POST /api/sanctum/token` (email + password + device_name → token), one token per device name, inactive users rejected.

Gaps to close:

| # | Requirement | Note |
|---|---|---|
| A1 | **Throttle the token endpoint** | It is currently unthrottled and publicly reachable — a credential-stuffing target. `throttle` middleware, per email + IP. |
| A2 | **Logout / token revocation endpoint** | `DELETE /api/v1/tokens/current`. Needed for F7's Cerrar sesión and for a lost phone. |
| A3 | **Password change** | Art. 7f: worker-changeable password with automatic email confirmation. |
| A4 | **Forgot password** | Not available to a mobile-only user today. |
| A5 | **Biometric unlock** | Device-local Face ID / fingerprint gating access to a token held in secure storage (Keychain / Keystore). This is *app unlock*, not identity proof — but combined with the password it is a reasonable reading of Art. 7g's "two identification alternatives, one non-biometric". Get this confirmed by whoever owns the DT certification. |
| A6 | **Token storage** | Expo SecureStore / Keychain / EncryptedSharedPreferences. Never AsyncStorage. |
| A7 | **Token expiry and 401 handling** | Sanctum PATs do not expire by default. Decide on an expiry, and define the app's re-auth flow so a 401 mid-punch does not lose the punch. |
| A8 | **Deactivation mid-session** | `is_active` is checked at token issue but not on subsequent requests. A deactivated employee keeps a working token. Add a check to the API guard. |
| A9 | **2FA** | The web app has Fortify 2FA (`two_factor_*` columns). Decide whether mobile login must honor it, or whether device-bound tokens plus biometric unlock substitute. Unresolved today. |

### 7.2 Notifications

Nothing exists; all notifications are mail. Needed:

- A device-token registration endpoint (`POST /api/v1/me/devices`) and a Laravel notification channel (Expo Push / FCM).
- Notification types for v1: **document awaiting your signature**, **leave decision (approved/rejected)**, **mark correction requested (with the expiry window)**. Optional: **punch reminders** derived from the shift schedule — high value for reducing absences, but they need care not to become noise, and they require a scheduled job scanning shift starts.
- Deep links from each notification to the right screen.
- Server-side respect for the per-category preferences from F7.

### 7.3 Offline punching

An attendance app that cannot record a punch without signal will be worked around, and the workaround is a paper book. Resolución 38 Art. 9 requires automatic online transmission, which constrains the design but does not forbid a queue — it forbids *manual* transmission.

Proposed behavior:
- A punch attempted offline is written to a local durable queue, and the employee sees an explicit "pendiente de sincronizar" receipt — visually distinct from a confirmed one, and honest about the fact that it is not yet in the attendance book.
- The queue flushes automatically on connectivity restore, in order, with idempotency keys so a retried request cannot double-punch.
- The device's clock reading is sent as `device_datetime` and stored **separately** from the server-assigned `date_time`, with the sync time recorded too. Never let a client clock become the legal timestamp — that is precisely the adulteration risk Art. 8 and Art. 14a are about.
- Cap the queue age (e.g. 24 h). Beyond that, the punch becomes a correction request for HR, not a silent backdated insert.
- This needs a compliance decision before it is built. **Flagging it as the highest-risk item in this PRD.**

### 7.4 Localization, accessibility, quality

- **Spanish (Chile) only** for v1 — including all error messages, empty states and help content. Art. 5 makes this a compliance requirement, not a nicety. Domain vocabulary comes from the server's `lang/` catalogues.
- **Accessibility:** minimum 44×44 pt touch targets (the design's primary punch button is 64 pt tall — good), respect OS font scaling, screen-reader labels on every icon-only control, and do not encode status through color alone (the status badges pair color with text — keep that).
- **Field conditions:** the primary punch button must remain usable in direct sunlight, with gloves, one-handed. Verify contrast of coral `#FF4F5E` on white at outdoor brightness.
- **Performance:** cold start to a usable punch button under 3 s on a mid-range Android; one API call to render the home screen.
- **Telemetry:** crash reporting plus a minimal funnel (app open → punch attempted → punch confirmed, with failure reasons). Do not log location or personal data.
- **Testing:** every new API endpoint gets Pest feature tests, run with `./vendor/bin/sail artisan test`. Cover permission gating (a user lacking the permission gets 403), tenant isolation (another org's record 404s), and the geofence evaluation matrix.

---

## 8. Resolución 38 mapping

Items from `docs/checklist_resolucion_38.csv` that this app moves or touches:

| ID | Art. | Requirement | Effect of the mobile app |
|---|---|---|---|
| F01 | 6a | Enrollment/capture hardware (reader or phone) | **The app is the answer to this item.** |
| F05 | 7f | Worker-changeable password + automatic email | F7 change-password |
| F06 | 7g | Two identification alternatives, one non-biometric | Password + biometric unlock — needs certification sign-off (A5) |
| F07 | 8 | Automatic hash/checksum (SHA-2) | Already implemented; the app surfaces it on the receipt |
| F08 | 8 | Web functionality to validate a receipt hash | The app should display/copy the hash so the employee can use it |
| F10 | 11 | Electronic timestamp | Requires server-authoritative time (§5 F1, §7.3) |
| F11 | 12 | Automatic receipt email | Exists via `MarkObserver`, **but only when `personal_email` is set** — close that gap |
| F12 | 13 | Minimum receipt content: date, time, name, RUT, hash | `MarkResource` is currently insufficient — extend it (F2) |
| F13 | 13 | Geolocation on the receipt (optional) | §6 |
| F23 | 22.1 | Worker access: permanent, unrestricted, 5 years of history | F4 must be range-queryable and paginated, not a fixed window |

Cross-check any compliance claim against `docs/context/resolucion_38.txt` before writing acceptance criteria. Do not paraphrase the regulation from this PRD.

---

## 9. Design system

The design ships a token-based system (`_ds/kolvi-design-system-…`) that the app should adopt rather than re-derive:

- **Brand:** primary `#003D5C` (deep teal-navy), primary-deep `#00293D`, accent coral `#FF4F5E` (the punch action and every primary CTA), ink `#0B2530`.
- **Neutrals:** deliberately warm-tinted teal grays, not cool grays — slate `#3E5964`, mid `#5F8993`, muted `#AFD0DA`, border `#D6EBEE`, surface `#F5F7FA`, page `#E4F1F4`.
- **Semantic compliance states:** success `#DFF3EC`/`#0E7A54`, warning `#FDECC8`/`#A66A0A`, danger `#FFE1E1`/`#C41E2E`. These carry meaning — geolocation status, workday status, leave status, signature status — and must map 1:1 onto the server's `badge()` tones (`success` / `warning` / `destructive` / `neutral`) so web and mobile never disagree about what a state looks like.
- Also provided: typography, spacing, radius and shadow token files, plus a shared `_ds_bundle.js`.

Port the tokens into the app's theme as the single source of truth. Note that the design system is *not* the web app's Tailwind/shadcn theme — reconciling the two (or accepting a deliberate visual split between the employee app and the admin console) is a decision worth making explicitly.

---

## 10. Release plan

**Phase 1 — Marcaje MVP.** The punch loop end to end and nothing else: token auth with secure storage and biometric unlock, home screen with today's shift, geolocation with the three states, punch with server-side geofence evaluation, compliant receipt, last-10-punches history. Profile with logout and password change. Ships to a pilot premise.

*Rationale: this is the entire reason the app exists, it maps to the smallest set of backend gaps, and it is the only phase with a hard compliance dependency.*

**Phase 2 — Jornada.** Upcoming shifts, workday history with the 5-year range, day detail, and mark-correction review with push notifications. Turns the app from a punch clock into the employee's record of their own hours.

**Phase 3 — Permisos.** Leave list, calendar, request wizard with server-computed business days and vacation balance, cancel-while-pending, decision notifications.

**Phase 4 — Documentos.** Document list with pending count, reader, sign with email OTP, reject with reason, signed-PDF access.

**Later / separate epics.** Colación (break) marks; multi-pair days; offline punch queue *(may need to move earlier if pilot connectivity is bad — decide from pilot data)*; supervisor leave approval; kiosk mode; iOS parity if Android ships first.

---

## 11. Open questions

Ordered by how much downstream work they block.

1. **Framework and platform (D1, D2).** Everything downstream depends on it.
2. **Colación marks: in or out (D-F1-a)?** A new `MarkType` is a cross-cutting change to the attendance book, the calculator and DT reporting. Needs a legal answer about what a break punch means in the register, not just a product one.
3. **Offline punching (D5, §7.3).** Compliance-sensitive and architecturally invasive. Needs a decision before Phase 1 is scoped, even if the answer is "not yet".
4. **Out-of-range policy (§6.5):** block, or record-and-flag?
5. **Server-authoritative timestamps.** `POST /api/marks` currently requires a client-supplied `datetime`. Changing it is a small edit with real legal weight (Art. 11) and an API-compatibility question if anything already calls it.
6. **Folio (D-F2-a):** new column, or formatted `mark_id`?
7. **2FA on mobile (A9).**
8. **Biometric unlock as an Art. 7g "second alternative" (A5, F06).** Needs whoever owns DT certification to confirm.
9. **Week-summary denominator (D-F1-d):** contracted weekly hours or the statutory maximum under Ley 21.561?
10. **Mark-correction review in v1 (F4).** Recommended yes; confirm, because expiring corrections on a mobile-primary employee is a real harm.
11. **Leave rejection reason (D-F5-d):** which column?
12. **Verification-code channel (D-F6-c):** email only, or SMS too?
13. **API versioning (D7):** move the existing three mark routes under `/api/v1`, or start v1 alongside them?
14. **Design system reconciliation (§9):** one visual language across web and mobile, or a deliberate split?

---

## 12. Suggested epic breakdown

A starting shape for the mobile-app Backlog project. Acceptance criteria are deliberately not written here — they should be authored per task, against the resolved decisions above.

**Backend (this repository)**
1. API foundation — `/api/v1`, a proper `UserResource`, throttling, token revocation, `is_active` enforcement on the guard
2. `GET /me/today` — the home-screen aggregate
3. Geofence — premise radius, distance evaluation, geo status on marks, admin review filter
4. Receipt completeness — extend `MarkResource` to Art. 13, folio, unconditional receipt email
5. Workdays API — list with range/pagination, detail, mark-correction approve/decline
6. Upcoming-shifts API — extract `ShiftScheduleResolver`
7. Leaves API — list, options, business-days, store, cancel, calendar
8. Documents API — list, show, send-code, sign, reject, download
9. Push notifications — device registration, channel, three notification types, preferences
10. Auth lifecycle — password change, forgot password
11. *(Conditional)* Break mark types
12. *(Conditional)* Offline punch ingestion — dual timestamps, idempotency

**Mobile app**
13. Project setup — Expo, TypeScript, design tokens, navigation, CI/build pipeline
14. Auth — login, secure token storage, biometric unlock, 401 handling, logout
15. Marcaje — home screen, geolocation states, punch, receipt sheet
16. Jornada — upcoming, history, day detail, correction review
17. Permisos — list, calendar, request wizard
18. Documentos — list, reader, sign flow, reject
19. Perfil — my data, notification preferences, help, password change
20. Cross-cutting — Spanish catalogue, accessibility pass, crash reporting and telemetry, store submission
