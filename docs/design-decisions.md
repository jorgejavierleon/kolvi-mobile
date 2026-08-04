# Resolved product decisions — Kolvi Employee Mobile App

**Status:** Accepted
**Date:** 2026-07-30
**Owner:** Jorge Leon
**Supersedes:** `docs/prd-mobile-app.md` §11 "Open questions" and every `D-*` delta in §5

The PRD was written before the design existed and left 14 questions open. The companion
design — Claude Design project `b62ea466-327b-4798-a07a-6afbc268c6bf`, file `Kolvi App.dc.html` —
answers them. **This document is the decision record. The design is authoritative where it
and the PRD disagree.** Tasks reference this file so they are not re-litigated per ticket.

Scope note: this Backlog tracks the **mobile app only**. Every feature depends on new
`/api/v1` endpoints built in the Laravel `ams` repository; those are named per task as
external prerequisites but are not tracked here.

---

## 1. Platform and architecture

| # | Decision |
|---|---|
| D1 | **React Native (Expo)**, TypeScript. |
| D2 | **Android first** (the design is a 412×892 Android frame), iOS from the same codebase one release later. Android 9+ / iOS 15+. |
| D3 | Single app on Play Store / App Store; the organization resolves from the user's credentials. No per-tenant white-label builds. |
| D7 | API versioning: **the mobile surface is `/api/v1` in its entirety** — login, the user payload, marks, token revocation. The app targets it exclusively, and there is nothing outside it for the app to reach. Superseded the original "v1 alongside the existing unversioned mark routes" on 2026-08-03 (`ams` KOL-6): those routes had been added for this app days earlier and had no other consumer, so leaving them would have meant two surfaces where the app's own client can only resolve one. Internal XHR endpoints the web console calls stay unversioned in `routes/web.php` and are not part of this. |
| §9 | Design system: **deliberate split**. The employee app adopts the Kolvi design-system tokens as its single source of truth; the admin console keeps its Tailwind/shadcn theme. The two are not reconciled. |

## 2. Marcaje

| # | Decision |
|---|---|
| D-F1-a — Colación | **Dropped as a punch type.** The design shows the scheduled window read-only on the shift card as `Colación (informativo)  13:00 – 14:00`. There are no *Iniciar colación* / *Terminar colación* buttons and no new `MarkType`. |
| D-F1-b — Punches per day | **One `in` and one `out` per day retained.** The state machine is `before → working → done`. A day already closed shows the "Jornada finalizada" success panel instead of punch buttons — a friendly state, never an error. |
| D-F1-c — Out-of-range policy | **Record and flag, never block.** Out of range disables the primary button and offers an explicit escape hatch: `Marcar de todas formas (queda pendiente de revisión)`. The resulting receipt carries `Marca fuera de rango — pendiente de revisión`. |
| §5 F1 — Timestamps | **Server-authoritative.** The server assigns the legal timestamp; the client never supplies it for an online punch. |
| D-F1-d — Week summary | Contracted weekly hours from the shift, rendered `{worked} / {total} hrs esta semana` (design: `32.5 / 44 hrs esta semana`). |

**Geolocation card — the three states, verbatim from the design:**

| State | Title | Subtitle | Effect |
|---|---|---|---|
| `ok` | `Ubicación confirmada` | `{premise} · a {n} m de la marca` | success tint; punch enabled |
| `outside` | `Fuera del rango permitido` | `Debes estar dentro de {premise} para marcar` | warning tint; primary disabled + override button |
| `nogps` | `Sin señal de GPS` | `Activa tu ubicación para poder marcar` | danger tint; primary disabled + `Reintentar ubicación` |

The client's evaluation is **advisory only**; the server's geofence result is authoritative.
An employee who permanently denies location permission must still be able to punch
(`geo_status = unknown`) — otherwise attendance becomes unrecordable, which is a legal problem.

## 3. Comprobante (receipt)

| # | Decision |
|---|---|
| D-F2-a — Folio | **A real folio**, format `YYYYMMDD-NNNN`, labelled `N° comprobante`. Not a formatted `mark_id`. |
| Art. 13 content | The sheet shows `Tipo`, `Fecha`, `Hora`, `Trabajador`, `RUT`, `N° comprobante`, and the SHA-256 `Hash de verificación` with a `Copiar` button. |
| Legal note | Always present: *"Este registro forma parte del libro de asistencia electrónico (Resolución 38 de la Dirección del Trabajo)."* |
| Headline | Online: `¡Marca registrada!` · Offline: `Marca guardada en tu teléfono` |

## 4. Offline punching

**In scope for Phase 1** — the design commits to it, and field connectivity is the core risk.
It ships behind a blocking spike that settles the compliance position and the wire contract.

The design specifies:
- A warning banner on the home screen: `{n} marca(s) esperando sincronizar` / `Aún no forman parte del libro de asistencia`, with a `Sincronizar` action.
- The offline receipt has **no folio and no hash**, and says so: *"Registrada en tu teléfono sin conexión. El folio y el hash los asigna el servidor al sincronizar — aún no forma parte del libro de asistencia electrónico."*
- The device clock is never the legal timestamp. It travels as `device_datetime` and is stored separately from the server-assigned `date_time`.

## 5. Authentication

| # | Decision |
|---|---|
| A5 / F06 — Biometric | **Adopted.** Device biometric unlock gates a token held in secure storage. Combined with the password it is the Art. 7g "two identification alternatives, one non-biometric". |
| A9 — 2FA | **Not in the mobile login for v1.** The device-bound token plus biometric unlock substitutes. |
| A6 — Token storage | Expo SecureStore / Keychain / EncryptedSharedPreferences. Never AsyncStorage. |
| A4 — Forgot password | **The app requests the link; the console's existing page accepts the new password.** `POST /api/v1/forgot-password` (`ams` KOL-9) puts the request on the mobile surface, and the mail links to `GET /reset-password/{token}`, which the phone's browser opens. Rejected: a deep link into the app with its own reset screen — it would need Android App Links (`assetlinks.json` on the `ams` host, cert fingerprints, an https redirect, because mail clients do not follow a bare `kolvi://`) to duplicate a page that already exists and already works on a phone. |
| A4 — Non-disclosure | **The endpoint answers `204` whether or not the address has an account**, and the app's confirmation is worded conditionally (`Si {correo} tiene una cuenta…`). Fortify's own route cannot be used: it answers an unknown address with a 422 naming it as unknown, which makes a public endpoint a way to test whether a given person works at the company. Repetition is capped by a limiter keyed on email + IP that counts every request, so a 429 discloses nothing either. |

## 6. Jornada

| # | Decision |
|---|---|
| F4 — Mark-correction review | **In v1 (Phase 2).** The design places the correction card on the Jornada tab, visible from either sub-tab, with the original vs. proposed time, reason, requester, an expiry label (`Vence en 2 días`), `Aprobar` / `Rechazar` actions, and a coral count badge on the tab-bar item. |
| Attendance strip | The axis is dynamic, derived from the shift window — not the mockup's fixed 08:00–18:00. Night shifts and shifts crossing midnight must render correctly. |

## 7. Permisos

| # | Decision |
|---|---|
| D-F5-a — Leave types | **From the API, never hardcoded.** Today: `Vacaciones`, `Sin goce de sueldo`, `Con goce de sueldo`, `Otro`. `Licencia médica` is created by HR and auto-approved, so it appears **only in the history**, never in the request wizard. |
| D-F5-b — Half day | **Added.** A half-day toggle plus `mañana` / `tarde` selection; always counts 0.5 days and must be a single day. |
| D-F5-c — Date selection | **A calendar date-range picker overlay.** The PRD mockup's `–` / `+` day stepper is replaced. |
| D-F5-d — Rejection reason | A distinct approver note shown on the request row (design: `Cupo mensual excedido`), separate from the requester's own `notes`. |
| Business days | **Always computed server-side** and shown in the review step before submit. The app never computes this locally. |

## 8. Documentos

| # | Decision |
|---|---|
| D-F6-a — Reject | **Added.** A `Rechazar` secondary action with a reason field. |
| D-F6-c — Code channel | **Email only for v1.** SMS is not in scope. |
| D-F6-d — Demo affordance | The flask button, the demo panel and `Modo demostración: código 482913` are **mockup-only scaffolding and must not reach a build.** |

---

## Design system tokens

Ported verbatim from `_ds/kolvi-design-system-6b0e16fe-306c-4d78-bc48-383a8012a48e/tokens/`.

**Colors** — brand `--color-primary #003D5C`, `--color-primary-deep #00293D`, `--color-accent-coral #FF4F5E`, `--color-ink #0B2530`. Neutrals are warm-tinted teal grays: `--color-slate #3E5964`, `--color-mid #5F8993`, `--color-muted #AFD0DA`, `--color-border #D6EBEE`, `--color-surface #F5F7FA`, `--color-bg-page #E4F1F4`. Semantic: success `#DFF3EC`/`#0E7A54`, warning `#FDECC8`/`#A66A0A`, danger `#FFE1E1`/`#C41E2E`, neutral `--color-border`/`--color-slate`.

These semantic tones map **1:1** onto the server's `badge()` tones (`success` / `warning` / `destructive` / `neutral`) so web and mobile never disagree about what a state looks like.

**Typography** — display `Sora`, UI `Plus Jakarta Sans`. Kolvi ships lighter weights than the boldest cuts: 700 for headlines (not 800), 600 for UI emphasis (not 700).

**Spacing** — 8px base grid, `--hit-target-min: 44px`.
**Radius** — sm 8 (chips), md 12 (buttons, fields), lg 16 (cards, modals), pill 999.
**Shadows** — `--shadow-1` rows/default cards, `--shadow-2` elevated, `--shadow-modal`.
