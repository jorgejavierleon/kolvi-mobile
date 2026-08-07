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
The blocking spike it shipped behind is KMO-21, and this section is that spike's output: it
settles the compliance position and the wire contract, and **supersedes both the three
provisional bullets it replaces and `docs/prd-mobile-app.md` §7.3**. Every claim below is
cited from `docs/context/resolucion_38.txt` directly, not from the PRD's paraphrase of it.

**Compliance sign-off:** Jorge Leon, 2026-08-07 (KMO-21 #1).

**The server half has shipped** — `ams` KOL-54, 2026-08-07. §4.2's checksum question and §4.4's
second window edge were open when this was signed off and are now settled; both are recorded below
as implemented rather than as intent. Where this section and the endpoint disagree, the endpoint is
the fact and this section is the bug.

### 4.1 A queue conforms — and refusing the punch does not

The PRD argued the queue from Art. 9 alone, that automatic online transmission "constrains the
design but does not forbid a queue". That argues uphill from the wrong article. **Art. 10 is an
express exception:**

> Artículo 10º. Excepción: Considerando que en ciertas actividades productivas o áreas
> geográficas podría no haber conexión permanente de datos para su transmisión, **se
> considerará ajustado a la norma que el sistema permita capturar y almacenar la
> correspondiente marca**, sin perjuicio de que su envío posterior a la plataforma Web se
> realice automáticamente cuando recupere la señal.

Capture-and-store is conforming in the regulation's own words. One condition travels with it —
the later send must be **automatic** (`se realice automáticamente cuando recupere la señal`),
which is what Art. 9 actually forbids: manual transmission, not deferred transmission. A
`Sincronizar` button is therefore an accelerator the employee may press, never the only way the
queue drains.

And refusing the punch is not the cautious alternative. Art. 38 names as **not** conforming:

> a) El bloqueo o cierre de los equipos en los cuales se realicen las marcas, dado que ello
> impide que los registros reflejen la realidad de la acción.
> b) El bloqueo de las aplicaciones para PC o smartphones utilizadas para realizar marcaciones
> remotas como ocurre, por ejemplo, en el caso del teletrabajo.

An app that will not take a punch without signal is a blocked app. The queue is not a liberty
this design took; the alternative was the infraction.

### 4.2 The legal timestamp — assigned by the server, and offline assigned *from the device*

Art. 11 is bolted onto Art. 10 by its own opening clause:

> Artículo 11º. Sello de tiempo: **Para cumplir el fin señalado en el párrafo anterior**, el
> sistema deberá contar con una marca de tiempo, vale decir, asignación por medios electrónicos
> de la fecha y hora **en que se efectúa** una marcación.

"El párrafo anterior" is the Art. 10 exception: the sello de tiempo exists *to serve the offline
case*, and it is the hour the marcación **is made**, not the hour the register hears about it.

So this section's earlier reading — the server's own clock stamps every mark — is **wrong for a
queued mark**, and is superseded. It would put the sync time in the attendance book: a punch made
at 08:00 in a basement and transmitted at 12:00 registered as 12:00. That is a false record, and
it breaks three articles at once — Art. 11 above, Art. 44 (`calcular con precisión de hora,
minuto y segundo de cada marcaje, restando las cantidades exactas sin aproximación`) and Art. 41
b) (`sólo podrán realizarse cuando su resultado final no cause perjuicio a los trabajadores`),
the *perjuicio* being a four-hour late arrival the employee did not commit.

| Field | Online punch | Queued punch |
|---|---|---|
| `date_time` — **the legal timestamp** | the server's clock | the device reading, **adjudicated** by the server |
| `device_datetime` | never sent, and rejected like `datetime` already is (`prohibited`, `ams` KOL-34) | the raw phone reading, stored immutably as sent |
| `synced_at` | equal to `date_time` | when the register received it |
| `captured_offline` | `false` | `true`, and identified as such wherever the mark appears (§4.6) |

**Adjudicated, not trusted.** The server assigns `date_time` in both cases; offline it derives it
from `device_datetime` after validating it against the window in §4.4, and refuses rather than
accepting blind. The raw reading is kept beside the legal value permanently, so the two can always
be compared — which is the point of storing it, and the reason the design's original instinct to
carry both was right.

Art. 8 and Art. 14 a) ii) were read as forbidding this and do not. They govern adulteration
**after the fact** — `prevengan la adulteración de la información post - registro` — not where a
timestamp originates. Nothing here alters a mark once it is in the register.

**The Art. 8 checksum — decided by `ams` KOL-54.** Offline provenance goes **inside** the envelope,
through a conditional suffix:

- online, and every mark already in the register: `sha256(user_id . type . date_time)`, byte for
  byte the string KOL-34 left;
- queued: that string plus `'|offline|' . device_datetime`.

Inside, because on a queued punch the provenance *is* part of the operation Art. 8 hashes
(`de los datos de cada operación`) rather than metadata about it — `date_time` was adjudicated from
the device reading instead of read off the server's clock, and a `captured_offline` that could be
cleared without breaking the hash would leave the register unable to say how its own legal
timestamp was obtained. Conditional rather than unconditional, because folding the new fields into
every mark would make every checksum already printed on an Art. 13 g) comprobante fail
recomputation — invalidating the existing register to spare a branch. Geolocation stays outside, as
KOL-34 left it: a coordinate is a measurement *about* the punch and legitimately absent; the
provenance of the legal timestamp is the punch.

### 4.3 The wire contract

`POST /api/v1/marks`, the same endpoint as an online punch. Two fields are added and appear
**only** on a queued punch:

```json
{
  "type": "in",
  "lat": -33.4569,
  "lng": -70.5975,
  "accuracy_m": 12.4,
  "geo_status": "inside",
  "device_datetime": "2026-08-07 08:03:11",
  "idempotency_key": "0f9c4e6a-3b21-4d7f-9a58-1c2e7b40d913"
}
```

- **`device_datetime`** — naive Santiago wall-clock like every datetime on this wire, never an
  offset. Read once, at the moment of the punch, and never re-read: a queue row that re-reads the
  clock on flush has recorded the flush.
- **`idempotency_key`** — UUIDv4 generated on the device when the punch is queued, stored with it,
  and **never regenerated on a retry**. In the body rather than an `Idempotency-Key` header
  because the server must persist it on the mark for the unique `(user_id, idempotency_key)` index
  that makes the guarantee real, and because `punch-api.ts` builds its body as a single literal
  precisely so a compliance-bearing field cannot go missing unnoticed. Scoped per user, never
  globally — see KMO-49 on queue-to-employee binding.
- Either field on an online punch, or one of the pair without the other, is a `422`. An online
  punch keeps sending neither, and `datetime` stays `prohibited`.

| Status | Meaning | What the client does |
|---|---|---|
| `201` | recorded — full receipt: server folio, hash, `date_time`, geofence verdict | drop from the queue, show the confirmed receipt |
| `200` | this `idempotency_key` is already recorded; the **identical** receipt | drop from the queue; indistinguishable to the employee |
| `409` | the day the punch **was made** already holds this type (D-F1-b) | drop from the queue, say so calmly (never a dialog) |
| `422` + `code: queued_punch_too_old` | past the §4.4 window; the server has **already filed it** for HR | drop from the queue, show the server's message |
| `422` + `code: queued_punch_in_future` | the phone's clock is ahead of the server beyond tolerance | do not retry blind — §4.4 |
| `422` (plain Laravel validation) | a malformed or half pair, a bad UUID, an offset on `device_datetime`, a `datetime` on either path | a client bug; log it, do not surface it as a punch failure |
| `401` | the token is dead | keep the queue intact (KMO-49) |

`200` against `201` is the whole idempotency contract: a retry whose answer was lost is not a
second punch, and the register is what says so rather than the client guessing. `ams` looks the
replay up **before** it checks the window and before the one-per-day guard, so a punch already in
the register stays answerable however old the queue has since become.

The receipt echoes `device_datetime`, `synced_at` and `captured_offline` (`MarkResource`), so a
synced receipt can show its own provenance.

**The two refusals are distinguished by `code`, not by their message** — the copy is the server's
Spanish, shown verbatim, and branching on a sentence somebody may improve is exactly what
`punch-api.ts` rules out. `ApiError` does not carry `code` today; it keeps `kind`, `userMessage` and
Laravel's `errors` bag, so the field is dropped at the transport boundary. Carrying it through
`src/api/errors.ts` is a prerequisite of KMO-23, not an optional refinement: the two refusals need
opposite outcomes and are otherwise indistinguishable to the app.

### 4.4 The window: 24 hours old, 5 minutes ahead

Measured from `device_datetime` to the moment the server receives it. Both edges live in `ams`
config — `offline_punch_max_age_hours` (24) and `offline_punch_future_tolerance_minutes` (5) — and
they are **not symmetric**, because the two failures are not the same failure.

Why a day: Art. 45.1 requires an automatic email to employee and employer 30 minutes after a
missed punch, and Art. 40 f) lets the system fill a missing mark `al día siguiente` with the
pactada hour. Inside a day, the queue is a transmission delay. Past it, the regulation's own
regularization machinery has already run — the alert went out, and HR may have added a mark for
the gap — so a late insert becomes a second, competing version of a record somebody has acted on.

A punch older than 24 h is **neither inserted nor discarded**. It is filed through the Art. 39 b) /
Art. 40 pathway, the same bilateral procedure HR uses for a forgotten punch:

> Art. 39 b) Agregar marcaciones: El empleador podrá también agregar marcaciones faltantes de
> entrada o salida […] derivadas, por ejemplo, de olvido de marcar por parte de los trabajadores,
> cortes de energía eléctrica, fallas del sistema […]

with the Art. 40 consequence that the employee is emailed and has 48 hours to object. That is the
right shape: their evidence enters the record, flagged and bilaterally, rather than as a silent
backdated insert.

`ams` KOL-54 implements this by **reusing `MarkModification`** rather than a new model — it already
represents an addition (`mark_id` null, `mark_type` set) and already carries the whole Art. 40
apparatus: the notification, the 48 h window, the consolidation on silence. The reason is
`SystemError`, which is what Art. 39 b)'s `fallas del sistema` names. `mark_modifications` carries
`device_datetime` and `captured_offline` too, so the mark that eventually lands does not read as an
ordinary punch — the Art. 10 ¶2 problem again, one step later.

The filing happens **inside the same request** that refuses the punch. So `queued_punch_too_old` is
not "nothing happened": the punch is in HR's hands, the employee has been emailed, and the app's job
is to drop it from the queue and show the server's message. Retrying it would be asking to file it
twice.

**`queued_punch_in_future` is the other edge and needs its own answer.** A phone more than five
minutes ahead is not a punch to file — there is no missing mark, the device is simply wrong about
the time, and the fix is on the device. Note the trap: the queue never re-reads the clock (§4.3), so
a retry sends the same future reading, and the punch becomes recordable only once the server's own
clock passes it — at which point it would land at an hour the employee did not work. **KMO-23 decides
what the app does here**, and "keep retrying" is not the answer. Left open deliberately rather than
guessed at.

The Spanish for both is the server's, from `ui.marks.api.offline.*`, shown verbatim.

### 4.5 An unsynced punch is not registered, and the employee is told so

**Not registered.** The attendance book is the central database, not the phone: Art. 9
(`transferidas en línea a una base de datos central`), Art. 20 a) (`La información de los
comprobantes de marcaje deberá ser consistente con aquella contenida en las respectivas bases de
datos`) and Art. 22.1, which grants the employee `acceso permanente e irrestricto` to what *the
platform* holds. A queued punch has no folio and no checksum — Art. 8 has the *system*
generate it (`Luego de cada marcación el sistema deberá generar, automáticamente, un Checksum o
Hash`) and Art. 13 g) requires it on the comprobante — and is
invisible to the Art. 17 fiscalización portal. Under Art. 10 it is *captured and stored, pending
transmission*. That is a real status and it is not registration.

What the employee is told, verbatim from the design and unchanged by this spike:

- A warning banner on the home screen: `{n} marca(s) esperando sincronizar` / `Aún no forman parte del libro de asistencia`, with a `Sincronizar` action.
- The offline receipt has **no folio and no hash**, and says so: *"Registrada en tu teléfono sin conexión. El folio y el hash los asigna el servidor al sincronizar — aún no forma parte del libro de asistencia electrónico."*

Two consequences follow. The Art. 12 comprobante email is sent at sync rather than at capture,
which `MarkObserver::created` already does by construction. And none of this is the employee's
burden: Art. 52.2 c) puts the data plan on the employer, and Art. 32 requires the rules governing
offline punching to be in the reglamento interno or the contract. That last is an employer
obligation, named here so it is not mistaken for app work.

### 4.6 The exception is exceptional — no offline toggle, and the frequency is measured

> Art. 10, second paragraph. Con todo, lo señalado en este número se refiere únicamente a
> **situaciones excepcionales**, por lo que sólo se podrá invocar en casos particulares
> debidamente justificados.

Two constraints follow that the design did not carry:

- **There is no manual offline mode.** The queue engages only on an actual failure to reach the
  server — never as a setting, a preference or a default. A toggle would make the exception the
  operating mode, and would hand the employee a way to choose their own timestamp.
- **Offline frequency has to be visible.** An employee who queues every punch is not an
  exceptional case; that is a site without connectivity, and the employer must fix it or change
  mechanism. The system's job is to make that visible, not to absorb it quietly. **Per employee and
  per premise, that reporting is server-side**, in `ams`, where the mark already carries `user_id`,
  `premise_id` and `captured_offline` — not in mobile telemetry, which is forbidden from carrying
  personal data at all (KMO-29 #5). The app's share is the aggregate count of offline punches and
  sync outcomes it already owes under KMO-29 #4.

This is also what makes `captured_offline` mandatory on the mark rather than inferable from
timing: a case cannot be `debidamente justificado` if the register cannot say which marks were
queued. Art. 41 a) (`deberán quedar visibles en pantalla mediante un signo, símbolo o color`) and
Art. 14 b) (alterations `indicadas de manera destacada en pantalla y en los reportes`) both point
the same way, though neither is squarely on point — a queued mark is not an *alteración*, which is
precisely why its provenance has to be stated rather than left to resemble an ordinary
transmission.

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
