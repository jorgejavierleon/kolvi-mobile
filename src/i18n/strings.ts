/**
 * The es-CL string catalogue. Res. 38 Art. 5 requires the platform to be in
 * Chilean Spanish, which makes one catalogue a compliance artefact rather than a
 * convenience: there is exactly one place to audit the wording an employee sees.
 *
 * **What belongs here.** Copy the app itself authors, including the states a screen
 * is in when it has nothing to show — loading, empty, failed, permission denied.
 * Those are the entries that get forgotten, and they are the ones an employee sees
 * on a bad day in a warehouse basement, so they carry the same Spanish requirement
 * as the happy path.
 *
 * **What does not.** Domain vocabulary — leave types, workday statuses, document
 * statuses — arrives from the server as `{value, label}` pairs and is rendered
 * verbatim. Re-translating it here would mean a status could read one way on the
 * web console and another on the phone, for the same record.
 *
 * **How it grows.** Cross-cutting copy lands here as it is needed; wording that
 * belongs to one screen arrives with that screen's own task. KMO-15, 19, 32, 39 and
 * 42 each add their own section.
 */
// The extension is spelled out for the same reason `app.config.ts` spells out
// `./src/theme/colors.ts`: since KMO-10 the config imports this catalogue for the
// Face ID usage description, and Expo's config loader is a plain ESM loader with
// no bundler behind it — it resolves a TypeScript file only when asked for one by
// name. `allowImportingTsExtensions` in tsconfig.json is what permits it.
import { formatDecimalHours } from './hours.ts';

export const es = {
  /** The four tab-bar items, in the order the design draws them. */
  tabs: {
    inicio: 'Inicio',
    jornada: 'Jornada',
    permisos: 'Permisos',
    documentos: 'Documentos',
  },

  /**
   * The title at the top of each tab. Not the same words as the tab item: the
   * design labels the tab `Jornada` and titles the screen `Mi jornada`.
   *
   * `inicio` is a placeholder. The design's home screen has no title — it opens
   * with the date and `Hola, {nombre}`, which KMO-15 builds once there is a
   * session to read a name from.
   */
  headers: {
    inicio: 'Inicio',
    jornada: 'Mi jornada',
    permisos: 'Permisos',
    documentos: 'Documentos',
  },

  /**
   * The login screen (KMO-8). The design has no login surface, so the wording is
   * authored here rather than transcribed.
   *
   * What is *not* here: why a login was refused. Wrong credentials and a deactivated
   * account are both 422s from `ams` carrying its own Spanish sentence, and the
   * screen shows that sentence verbatim — restating it here would give an employee
   * one wording on the phone and another on the web console for the same refusal.
   */
  auth: {
    /** The app's name is the heading; the screen is the first thing after the splash. */
    heading: 'Kolvi',
    intro: 'Ingresa con las credenciales que usas en Kolvi.',
    email: 'Correo electrónico',
    emailPlaceholder: 'nombre@empresa.cl',
    password: 'Contraseña',
    submit: 'Ingresar',
    /** The reveal toggle names what it will do, in each of its two states. */
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
    /** Caught before the request, so an empty field is not a round trip. */
    emailRequired: 'Ingresa tu correo electrónico.',
    passwordRequired: 'Ingresa tu contraseña.',

    /**
     * Why the employee is looking at this screen again (KMO-11 #1). The one 401
     * message in the app that is written here rather than taken from the server:
     * Laravel's guard answers a dead token with an untranslated `Unauthenticated.`,
     * and Res. 38 Art. 5 has no exception for a sentence that arrived over HTTP.
     *
     * It says the session ended and not *why* on purpose. An expired token and a
     * deactivated account look identical from here — one 401 each — and the
     * difference is announced accurately a moment later, by the server's own
     * Spanish, when the employee tries to sign in again.
     */
    sessionExpired: 'Tu sesión terminó. Vuelve a ingresar para continuar.',

    /**
     * Cerrar sesión (KMO-12).
     *
     * Signing out is destructive in a way the word does not suggest: it revokes
     * this phone's token and drops anything the phone was still holding. So it is
     * confirmed rather than done on one tap, and the confirmation says what
     * happens rather than asking `¿Estás seguro?` — a question with no
     * consequences in it is one employees learn to tap through.
     */
    signOut: {
      /** The row on Mi perfil, and the sheet's own confirm button. */
      action: 'Cerrar sesión',
      title: '¿Cerrar sesión?',
      /**
       * The ordinary case. It names the two things that change — the phone stops
       * being authorised, and the password is what comes back — so an employee
       * who tapped this by accident can see it is not a small thing.
       */
      body: 'Este teléfono dejará de tener acceso a tu cuenta. Para volver a entrar necesitarás tu correo y tu contraseña.',
      /** The backdrop, which is a control with nothing visible to name it. */
      close: 'Cerrar el aviso de cierre de sesión',

      /**
       * Revocation did not happen — no signal, or a server that did not answer
       * (#4). The session is over on this phone either way, and this is the part
       * that is still true afterwards, so it goes on the login screen rather than
       * into a sheet the employee has already left.
       *
       * It says *hasta que* rather than apologising: the token becomes unusable on
       * its own once the phone reaches the server again, and an employee who lost
       * the phone needs to know the window exists, not that the app is sorry.
       */
      notRevoked:
        'Cerramos tu sesión en este teléfono, pero no pudimos avisarle al servidor. El acceso de este teléfono seguirá activo hasta que vuelva a tener conexión.',
    },

    /**
     * Cambiar contraseña (KMO-13). Res. 38 Art. 7f: the worker changes their own
     * password, and a confirmation email follows.
     *
     * `intro` says *la misma que usas en Kolvi* on purpose. There is one
     * credential — `users.password` — and it is the same one the web console
     * takes, so an employee who changes it here has changed it everywhere. A
     * screen that let them believe this was a phone-only password would be
     * describing an account that does not exist.
     *
     * What is *not* here, again: why the server refused. A wrong current password
     * and a policy failure both arrive from `ams` in Spanish, out of
     * `lang/es/validation.php`, and are shown verbatim under the field they name.
     */
    changePassword: {
      /** The row on Mi perfil, the screen's title, and the submit button. */
      action: 'Cambiar contraseña',
      back: 'Volver a Mi perfil',
      intro:
        'Esta es la misma contraseña que usas para entrar a Kolvi desde el computador. Al cambiarla, cambia en los dos lugares.',
      current: 'Contraseña actual',
      new: 'Nueva contraseña',
      confirm: 'Repite la nueva contraseña',

      /** Caught before the request, so an empty field is not a round trip. */
      currentRequired: 'Ingresa tu contraseña actual.',
      newRequired: 'Ingresa la nueva contraseña.',
      confirmRequired: 'Repite la nueva contraseña.',
      /**
       * Also caught here rather than sent. The server's `confirmed` rule would
       * answer the same thing a second later, and a mismatch the employee can see
       * on screen is not worth a round trip to be told about.
       */
      mismatch: 'Las dos contraseñas no coinciden.',

      /**
       * The success state (#3). It names the email because Art. 7f is what the
       * email is for — an employee who did not change their password needs to
       * recognise the message as the warning it is when it arrives.
       *
       * It does not print the address. `ams` mails whichever of `personal_email`
       * and `email` it has, and the app is not told which was used; naming the
       * wrong inbox would send someone looking in a place nothing arrived.
       */
      successTitle: 'Tu contraseña quedó cambiada',
      successBody:
        'Te enviamos un correo confirmando el cambio. Desde ahora entra a Kolvi con la contraseña nueva.',
      /** Leaves the screen once the change is done. */
      done: 'Listo',
    },

    /**
     * ¿Olvidaste tu contraseña? (KMO-14). The one route back in for an employee
     * who is mobile-only — until this existed the answer was a desktop they may
     * not have or a call to HR.
     *
     * Every sentence here is written around a constraint the screen cannot see:
     * **the server never says whether the address has an account** (#2). It
     * answers the same 204 either way, so a confirmation that said *te enviamos
     * un correo* would be a claim the app cannot support, and would turn this
     * screen into a way to test whether a given person works at the company. The
     * copy is conditional — *si … tiene una cuenta* — which is the whole reason
     * `passwordResetSent` is a function: it names the address the employee typed,
     * which is theirs to know, without confirming anything about it.
     */
    forgotPassword: {
      /** The link under the login form, and the screen's own title. */
      action: '¿Olvidaste tu contraseña?',
      title: 'Recuperar contraseña',
      back: 'Volver a ingresar',
      intro:
        'Escribe el correo con el que entras a Kolvi y te enviaremos un enlace para crear una contraseña nueva.',
      submit: 'Enviar enlace',

      /**
       * The confirmation (#3). It answers the three things an employee standing
       * at a gate actually needs: where to look, that the link is opened on this
       * phone, and that it does not wait for them.
       *
       * The body is `passwordResetSent`, below — it names the address, so the
       * employee can see a typo rather than wonder why nothing arrived.
       */
      successTitle: 'Revisa tu correo',
      /**
       * Deliberately below the confirmation rather than inside it: it is the
       * thing to do *after* waiting, and putting it in the same sentence as
       * "revisa tu correo" invites tapping it immediately, which only feeds the
       * limiter.
       */
      retryHint: 'Si no llega en unos minutos, revisa que el correo esté bien escrito.',
      /** Leaves the screen once the mail is on its way. */
      done: 'Volver a ingresar',
    },
  },

  /**
   * Biometric app unlock (KMO-10).
   *
   * Every sentence here is written against one constraint: this is a lock on the
   * phone, not an identification of the employee. Res. 38 Art. 7g asks for two
   * identification alternatives and the password is the one that identifies —
   * copy that let an employee believe their fingerprint is what proves who punched
   * would misdescribe the register their attendance is recorded in. So the wording
   * says *abrir la app* and *este teléfono*, and never *identificar* or *verificar
   * tu identidad*.
   *
   * `huella o rostro` throughout, rather than naming the sensor the phone happens
   * to have: the same build runs on a fingerprint reader and on face unlock, and
   * asking for the wrong one is how copy stops matching the prompt beside it.
   */
  security: {
    /** The one-time offer after a first login. */
    offer: {
      title: 'Desbloqueo con huella o rostro',
      body: 'Puedes abrir Kolvi con la huella o el rostro que ya usas en este teléfono. Es un bloqueo de la app: no reemplaza tu contraseña y no cambia cómo se registran tus marcas.',
      enable: 'Activar',
      /** Declining is a real answer, not a postponement — the offer is made once. */
      dismiss: 'Ahora no',
      close: 'Cerrar el aviso de desbloqueo',
    },

    /** The gate the app shows on returning from the background. */
    lock: {
      title: 'Kolvi está bloqueado',
      body: 'Usa tu huella o rostro para volver a entrar.',
      unlock: 'Desbloquear',
      /** Clears the session and returns to login — the non-biometric alternative. */
      usePassword: 'Ingresar con contraseña',
      /** The sensor ran and did not recognise them. Another attempt is worth making. */
      failed: 'No pudimos reconocerte. Inténtalo de nuevo o ingresa con tu contraseña.',
      /** They dismissed the prompt. Not a failure, so the wording does not read as one. */
      cancelled: 'Inténtalo de nuevo o ingresa con tu contraseña.',
      /** Inside the OS prompt, which draws its own dialog over the app. */
      prompt: 'Desbloquea Kolvi',
    },

    /**
     * `NSFaceIDUsageDescription`, which iOS shows in its own dialog the first time
     * the app reaches for Face ID. It is copy an employee reads, so it is a
     * catalogue entry rather than a string typed into `app.config.ts` — the plugin's
     * default is English, and Res. 38 Art. 5 does not have an exception for text the
     * OS happens to draw.
     */
    faceIdUsage: 'Kolvi usa Face ID para desbloquear la app en este teléfono.',

    /** The Seguridad row on Mi perfil. KMO-25 folds this into the real menu card. */
    unlock: {
      section: 'Seguridad',
      label: 'Desbloqueo con huella o rostro',
      description: 'Pide tu huella o rostro al volver a la app.',
    },
  },

  navigation: {
    /** Names the tab bar itself for a screen reader. */
    tabBar: 'Secciones de la app',
  },

  /**
   * Inicio — the marcaje screen (KMO-15), and the copy the punch itself reads from
   * (KMO-17).
   *
   * Most of this is transcribed from the design rather than authored: `Turno de
   * hoy`, `Colación (informativo)` and the three status lines are drawn in the
   * mockup, and the mockup is authoritative per docs/design-decisions.md. The two
   * entries the design has no state for — a day with no shift, and a screen whose
   * request failed — are written here, because a home screen that is blank on a
   * day off is the "the app is broken" report `es.states` exists to prevent.
   */
  marcaje: {
    /**
     * The shift card. Read-only throughout: per docs/design-decisions.md §2
     * colación was dropped as a punch type, so the scheduled window is shown and
     * never punched — which is what `(informativo)` is there to say, and why it
     * is part of the label rather than a footnote under it.
     */
    shift: {
      eyebrow: 'Turno de hoy',
      lunch: 'Colación (informativo)',
      /**
       * A day with nothing scheduled (#7). It says which day it is talking about,
       * because the alternative an employee reaches for is "the app did not
       * load" — and then punches nowhere and calls their supervisor.
       *
       * `jefatura` rather than `supervisor`: it is the word `ams` and Chilean HR
       * use, and it covers the case where the person to ask is not one.
       */
      emptyTitle: 'Hoy no tienes turno programado',
      emptyBody: 'Si esto no es correcto, avísale a tu jefatura.',
    },

    /**
     * The line under the clock, one per punch state (#4). Verbatim from the
     * design's own `punchStatusLabels`; the state machine that chooses between
     * them is `punch-state.ts`, and KMO-17 hangs the button labels off the same
     * three states.
     *
     * There is no fourth entry for "we do not know yet". A screen that has not
     * been told the state says nothing here rather than guessing `Aún no marcas
     * entrada` — claiming an employee has not punched when they have is the one
     * wrong answer on this screen that costs them a workday.
     */
    status: {
      before: 'Aún no marcas entrada',
      working: 'En jornada',
      done: 'Jornada finalizada',
    },

    /**
     * The punch button and what happens after it is pressed (KMO-17).
     *
     * The two labels are transcribed from the design's own `primaryLabel`, and
     * they hang off the same three states as the status line above them — one
     * state machine, in `punch-state.ts`, rather than a second table that can
     * drift from the first.
     *
     * There is no third label. The `done` state has no button at all: the design
     * replaces it with `panel` below, which is a state and not an action.
     */
    punch: {
      in: 'Marcar entrada',
      out: 'Marcar salida',

      /**
       * The success panel that stands where the button was (#3).
       *
       * The title is `es.marcaje.status.done` — the same `Jornada finalizada`
       * that is already under the clock. It is not restated here: the design
       * draws one sentence twice on purpose, and two entries with the same words
       * in them is how the two start disagreeing.
       */
      panelBody: 'Nos vemos en tu próximo turno',

      /**
       * The punch was already recorded today (#7).
       *
       * This is a *state*, not an error, which is why it reads as news rather
       * than as a refusal: one `in` and one `out` per day is the design's own
       * rule (docs/design-decisions.md D-F1-b), so an employee who arrives here
       * has not done anything wrong — usually they tapped on a phone that had
       * already sent the punch and lost the answer. The screen corrects itself
       * to what the server has, and this line explains why the button moved.
       */
      alreadyMarked: 'Esta marca ya estaba registrada. Actualizamos tu jornada.',

      /**
       * A punch made with no connectivity, the instant it is durably queued
       * (KMO-23 #1). Deliberately not the same sentence KMO-24's offline
       * receipt sheet uses — that is the sheet's own headline and subtitle
       * (docs/design-decisions.md §4.5), verbatim from the design; this is the
       * inline line under the button, the same slot `alreadyMarked` and
       * `failed` use, and it exists so this ticket does not leave the
       * genuinely false `failed` sentence on screen for a punch that was, in
       * fact, captured.
       */
      queued: 'Marca guardada en tu teléfono. Se enviará automáticamente cuando haya conexión.',

      /**
       * The punch did not go through (#8).
       *
       * The fallback only. A server that said why — in Spanish, out of `ams`
       * `lang/` — is quoted verbatim instead, the same as everywhere else in the
       * app. What this sentence has to carry is the one thing the employee needs
       * to know and cannot see: that nothing was recorded, so the button below
       * it is still worth pressing.
       */
      failed: 'No pudimos registrar tu marca. No quedó guardada — inténtalo de nuevo.',

      /**
       * The escape hatch under a disabled button, when the employee is outside
       * the geofence (KMO-18 #1). Verbatim from the design, parenthesis and all.
       *
       * The consequence is *inside the label* rather than in a line beneath it,
       * and that is the whole point of the sentence: out of range is recorded
       * and flagged, never blocked (docs/design-decisions.md D-F1-c), so the
       * employee has to know before they press that the mark they are about to
       * make will be looked at by somebody. A shorter label — `Marcar de todas
       * formas` — would be an override that hides what it costs.
       */
      override: 'Marcar de todas formas (queda pendiente de revisión)',
    },

    /**
     * The comprobante — the receipt an employee sees the moment a punch is
     * recorded (KMO-19). Transcribed from the design's own overlay, and the one
     * section of this catalogue that is a compliance artefact twice over:
     * Res. 38 Art. 5 makes it Spanish, and Art. 13 makes the six row labels
     * below the *minimum content* of a receipt rather than a layout choice.
     *
     * Every value beside these labels comes off the 201. Nothing in this section
     * is a sentence about the phone, because nothing on the sheet is.
     */
    receipt: {
      /** The design's `comprobanteHeadline` for a mark the server confirmed. */
      headline: '¡Marca registrada!',
      subtitle: 'Comprobante de marca',

      /**
       * The design's `comprobanteHeadline` for the other branch of that same
       * ternary — a punch still in the queue, over the offline icon on the
       * warning tint rather than the success check (KMO-24 #1).
       */
      offlineHeadline: 'Marca guardada en tu teléfono',

      /**
       * What the folio and hash rows read while the punch is still in the
       * queue (KMO-24 #2) — the design's own `comprobanteFolio`/`comprobanteHash`
       * fallback, not an omission this catalogue invented. Neither is a
       * fabricated value: Art. 8 has the *system* generate the checksum and the
       * system has not seen this mark yet, so the honest row says it is
       * pending rather than printing something that looks like a folio.
       */
      pendingFolio: 'Pendiente de asignación',
      pendingHash: 'Pendiente de asignación (se calcula al sincronizar)',

      /**
       * The explanatory line on an offline receipt (KMO-24 #3), verbatim from
       * the design's `comprobanteOffline` block. It is what makes the missing
       * folio and hash legible as a status rather than as a bug: the register
       * assigns both at sync, and until then this mark is not part of the
       * libro de asistencia electrónico (§4.5).
       */
      offlineNote:
        'Registrada en tu teléfono sin conexión. El folio y el hash los asigna el servidor al sincronizar — aún no forma parte del libro de asistencia electrónico.',

      /**
       * The one line this catalogue authors rather than transcribes (KMO-24
       * #8) — the design has no state for a receipt that is both confirmed
       * and was once queued, because the mockup does not model sync at all.
       * Shown on a *confirmed* receipt when `capturedOffline` is true, so the
       * provenance §4.6 requires survives the sync instead of a folio and a
       * hash quietly erasing it.
       */
      capturedOffline: 'Esta marca se registró sin conexión y se sincronizó automáticamente.',

      /**
       * The Art. 13 rows, in the design's order. `folio` is `N° comprobante`
       * per docs/design-decisions.md D-F2-a — a real folio, `YYYYMMDD-NNNN`,
       * which `ams` allocates per organization and day (KOL-35).
       */
      type: 'Tipo',
      date: 'Fecha',
      time: 'Hora',
      worker: 'Trabajador',
      rut: 'RUT',
      folio: 'N° comprobante',

      /**
       * The `Tipo` value. `in` and `out` are how `ams` spells `Mark.type` on the
       * wire; these are how the design writes them on the receipt, and they are
       * app copy rather than server vocabulary — the 201 sends the enum, not a
       * `{value, label}` pair.
       */
      types: {
        in: 'Entrada',
        out: 'Salida',
      },

      /**
       * The checksum's label, with the algorithm in it because the design puts
       * it there and because an inspector reading the receipt needs to know
       * which one it is.
       *
       * What is deliberately *not* here is any sentence about verifying it. The
       * hash is copyable so an employee can keep it or quote it — to HR, or
       * against the emailed copy Art. 12 covers. `ams` has a checksum validation
       * tool, but it lives in the DT inspector portal behind authentication and
       * there is no public route; copy that implied otherwise would promise
       * something no employee can do.
       */
      hash: 'Hash de verificación (SHA-256)',

      /**
       * The punch was made outside the geofence (#7). Verbatim from the design,
       * em dash and all.
       *
       * It reads as a fact about the mark rather than as a warning about the
       * employee, which is D-F1-c on the receipt: out of range is recorded and
       * flagged, never blocked, so by the time this line is on screen the mark
       * is already in the register and somebody will look at it. The wording
       * says exactly that and stops.
       */
      outOfRange: 'Marca fuera de rango — pendiente de revisión',

      /**
       * Always on the sheet, for every mark (#8). It is what makes the receipt a
       * receipt: the employee is being told which register their punch just
       * joined, and under which resolution.
       */
      legal:
        'Este registro forma parte del libro de asistencia electrónico (Resolución 38 de la Dirección del Trabajo).',

      /** The pinned footer button, which only dismisses. Nothing is undone. */
      done: 'Listo',

      /** The backdrop, which a screen reader has nothing else to name. */
      close: 'Cerrar comprobante',
    },

    /**
     * The punch history (KMO-20). Res. 38 Art. 22.1 gives the worker permanent
     * and unrestricted access to their own record, and this list is Phase 1's
     * answer to it — so, like the receipt above, the section is a compliance
     * artefact and not a convenience.
     *
     * The design has no surface for it: it draws `Historial` under Jornada,
     * which is the five-year workday history Phase 2 builds. All of this is
     * therefore authored, in the design's own register.
     */
    marks: {
      /** The link under the week summary — the way in, from the Marcaje tab. */
      open: 'Ver mis últimas marcas',
      title: 'Mis últimas marcas',

      /**
       * Under the title, and load-bearing rather than decorative: the endpoint
       * answers with the ten most recent marks, and an employee who reads this
       * list as *all* their marks would conclude the register had lost the rest.
       * It says how far back the list goes, so the absence of an older punch is
       * the list's limit rather than evidence of anything.
       */
      subtitle: 'Tus diez marcas más recientes',

      /**
       * An employee who has never punched (#4). Two lines, because one would be
       * ambiguous: the first says the register holds nothing yet, and the second
       * says what will put something in it — an empty list with no explanation
       * is the "the app is broken" report `es.states` exists to prevent, and on
       * this screen it would be read as marks that went missing.
       */
      empty: 'Aún no tienes marcas registradas',
      emptyBody: 'Cuando marques entrada o salida, el comprobante quedará aquí.',

      /** The backdrop, which a screen reader has nothing else to name. */
      close: 'Cerrar mis marcas',
    },

    /**
     * The pending-sync banner, above the location card (KMO-22).
     *
     * Transcribed from the design, and load-bearing rather than decorative:
     * docs/design-decisions.md §4.5 settles that a queued punch is **not
     * registered** — the attendance book is the central database (Res. 38
     * Art. 9), an unsynced mark has no folio and no Art. 8 checksum, and it is
     * invisible to the Art. 17 fiscalización portal. So the employee is told,
     * in the app's own words, that what is on their phone is not yet in the
     * book. A banner that said "guardadas" and stopped would be describing a
     * record that does not exist.
     *
     * The title is `pendingSyncSummary` and the subtitle is
     * `pendingSyncSubtitle`, both below: the two lines are one sentence about a
     * number, so both of them decline with it.
     *
     * The banner appears **only when there are queued punches** (#6). Being
     * offline with an empty queue is not news: nothing is at risk, and a
     * standing "sin conexión" strip on the home screen is how an employee
     * learns to read past the one that matters.
     */
    sync: {
      /**
       * The flush did not go through (#7).
       *
       * The fallback only — a server that said why is quoted verbatim, and a
       * phone with no signal gets `es.errors.network`, which already names the
       * cause. What this has to carry is the part the employee cannot see: the
       * marks are still on the phone, so nothing was lost and the button is
       * still worth pressing.
       */
      failed: 'No pudimos sincronizar tus marcas. Siguen guardadas en este teléfono.',

      /**
       * A queued punch synced to a day that already held that type (KMO-23
       * #11, docs/design-decisions.md §4.3's `409`). Authored rather than
       * quoted from the server, matching how the live 409 on `punch.alreadyMarked`
       * already reads — this is the app describing what the register now
       * shows, not the server explaining a refusal.
       */
      duplicate: 'Una de tus marcas pendientes ya estaba registrada. La quitamos de tu lista.',
    },

    /**
     * The titles on the geolocation card, above the shift card (KMO-16).
     *
     * The first three are transcribed from the design's own `geoTitle`, and each
     * is paired with a tint — success, warning, danger — that never carries the
     * state on its own (#5). The subtitles live in `es.permissions.location` and
     * in the two formatters below, because two of the three are sentences about
     * a permission rather than about a place.
     *
     * `denied` is the state the design does not draw. Its three assume a phone
     * that answered; an employee who refused the permission permanently is in
     * none of them, and showing them `Sin señal de GPS` would send them waiting
     * for a signal that is not coming. It is a distinct title for a distinct
     * cause, and unlike the other two failures it does **not** stop them
     * punching — an unrecordable attendance is a legal problem (§2), so the
     * punch goes with no fix on it instead.
     *
     * `acquiring` is the state before any of them. The design has no frame for
     * the seconds a fix takes indoors, and a card that renders nothing for those
     * seconds is one an employee taps through on the assumption it is broken.
     */
    location: {
      acquiring: 'Buscando tu ubicación',
      acquiringBody: 'Dentro de un edificio puede tardar unos segundos.',
      confirmed: 'Ubicación confirmada',
      outside: 'Fuera del rango permitido',
      noSignal: 'Sin señal de GPS',
      denied: 'Sin permiso de ubicación',

      /**
       * The action under a disabled button in the no-signal state (KMO-18 #3).
       * The design's own label, and deliberately not `es.actions.retry`: that
       * one is the screen asking the server again, and this one is the phone
       * being asked where it is. An employee reading `Reintentar` under a card
       * that says `Sin señal de GPS` would not know which of the two it meant.
       */
      retry: 'Reintentar ubicación',
    },

    /**
     * The whole screen failed to load (#9). Distinct from `es.states.failed`,
     * which is a list that came back empty-handed: this one is the screen an
     * employee opened *in order to punch*, so it names the consequence rather
     * than the request, and the retry sits next to it.
     */
    loadFailed: 'No pudimos cargar tu turno de hoy.',
  },

  /**
   * Mi jornada (KMO-32, KMO-33). `es.headers.jornada` already carries the
   * screen's own title; this is the segmented control and the two sub-tabs'
   * own copy.
   */
  jornada: {
    /** The design's own two segment labels, verbatim. */
    segments: {
      proximos: 'Próximos',
      historial: 'Historial',
    },

    /**
     * The eyebrow over today's card (KMO-32 #2), matching the design's own
     * `HOY` above `{{shiftTime}} · {{shiftPlace}}`.
     */
    todayEyebrow: 'Hoy',

    /**
     * The prefix an upcoming row carries when its date is literally the day
     * after today (`daysBetween` decides which one that is, not row order —
     * the day after a free weekend is not "Mañana" just because it is the
     * list's first entry).
     */
    tomorrow: 'Mañana',

    /**
     * An employee without ViewOwn:Workday (#8) — there is nothing on this
     * screen for them, so the tab says so rather than showing an empty list
     * or a request that would 403.
     */
    noAccess: 'No tienes acceso para ver tu jornada.',

    /**
     * The failed-load retry (#9), matching home-screen's own `es.marcaje.loadFailed`
     * pattern: names the consequence, not the request. Reused by Historial's
     * own initial load (KMO-33 #6) — both are "this tab's one request failed",
     * not two different sentences for the same fact.
     */
    loadFailed: 'No pudimos cargar tu jornada.',

    /**
     * The Historial sub-tab (KMO-33): the day list's own tile labels, its
     * empty and load-more copy, and the day-detail placeholder pending
     * KMO-34.
     */
    historial: {
      /** The design's own three tile labels, verbatim — also `TileRow`'s own examples. */
      worked: 'Trabajado',
      extra: 'Extra',
      missing: 'Faltante',

      /**
       * A loaded range with no workdays in it (#5) — an employee paging back
       * past their hire date, most often. Says the range is genuinely empty
       * rather than leaving a blank card an employee would read as broken.
       */
      empty: 'No hay jornadas registradas en este período.',

      /** The action under the list that pages back a month at a time (#3). */
      loadOlderMonth: 'Cargar mes anterior',

      /**
       * A failed page-back (#3). Distinct from `loadFailed` above: the
       * months already on screen are untouched, so this names only the one
       * page that did not arrive rather than reading as the whole screen
       * failing.
       */
      loadOlderMonthFailed: 'No pudimos cargar el mes anterior.',
    },

    /**
     * The day-detail screen (KMO-34) a Historial row opens: the four KPI
     * tiles, the attendance strip's own title, and the leave-day treatment.
     * `worked`/`missing` reuse `historial.worked`/`historial.missing` above —
     * the design draws the same two words in both places — but `extra` does
     * not: the design's own day-detail tile reads `Tiempo extra`, longer than
     * the row's `Extra`, so this is its own string rather than a shared one
     * that happens to be right in one context and wrong in the other.
     */
    dayDetail: {
      back: 'Volver a Historial',
      extra: 'Tiempo extra',
      entradaSalida: 'Entrada / Salida',
      attendanceTitle: 'Asistencia del día',
      /** The eyebrow over the leave type, in place of the tiles and the strip (#7). */
      leave: 'Permiso',
    },

    /**
     * The pending-correction card (KMO-35): visible from either sub-tab,
     * above the segmented content — the design's own placement, not one row
     * of Historial. `expiryLabel` below is the countdown; everything else
     * here is static card copy.
     */
    corrections: {
      title: 'Corrección de marca propuesta',
      currentTime: 'Marca actual',
      proposedTime: 'Propuesta',
      approve: 'Aprobar',
      decline: 'Rechazar',
      /** A punch that does not exist yet — the correction adds one rather than changing one. */
      noCurrentTime: 'Sin marca previa',
      /**
       * The rare race between this screen's own load and the server's 10-min
       * sweep that consolidates an unopposed request (docs/design-decisions.md
       * §6): the window closed between the list arriving and the employee
       * tapping. Its own sentence, not `loadFailed` — nothing about the
       * *load* failed.
       */
      expired: 'Esta corrección ya venció y no se puede accionar.',
      /**
       * A tap that reached the server and was refused for a reason other than
       * expiry — the ownership guard, most plausibly a second device acting on
       * the same request first. Generic on purpose: `ApiError.kind` does not
       * distinguish the two on a 403, and neither is actionable by retrying.
       */
      reviewFailed: 'No pudimos procesar tu respuesta. Inténtalo de nuevo.',
    },
  },

  profile: {
    title: 'Mi perfil',
    /** The avatar button in every tab header. */
    open: 'Abrir mi perfil',
    /** The back chevron on the profile surface. */
    back: 'Volver',

    /**
     * The four-row menu (KMO-25 #3, #4). Cerrar sesión is `es.auth.signOut` —
     * it existed before this menu did (KMO-12) and stays there.
     */
    menu: {
      myData: {
        action: 'Mis datos',
        back: 'Volver a Mi perfil',
      },
      notifications: {
        action: 'Notificaciones',
        back: 'Volver a Mi perfil',
        /**
         * #5. KMO-38 replaces this with the real per-category toggles; until
         * then the row still has to go somewhere, and somewhere honest about
         * why it has nothing to show yet.
         */
        placeholder:
          'Las preferencias de notificaciones estarán disponibles cuando lleguen las notificaciones push.',
      },
      helpSupport: {
        action: 'Ayuda y soporte',
        back: 'Volver a Mi perfil',
      },
    },

    /**
     * Mis datos (KMO-51). Read-only — docs/design-decisions.md §9 reversed the
     * PRD's editable subset, so there is no form here, only the record.
     */
    misDatos: {
      fields: {
        name: 'Nombre',
        rut: 'RUT',
        corporateEmail: 'Correo corporativo',
        personalEmail: 'Correo personal',
        phone: 'Teléfono',
        position: 'Cargo',
        premise: 'Sucursal',
        /** `jefatura`, not `supervisor` — the same substitution home.shift.emptyBody makes. */
        supervisor: 'Jefatura',
        contractStart: 'Fecha de inicio de contrato',
      },
      /**
       * personal_email drives the Art. 12 receipt and document verification
       * codes (§9) — text only, no link out, since editing it happens on the
       * web app and this screen does not point anywhere.
       */
      noPersonalEmail:
        'No tienes un correo personal registrado. Ahí se envían tu comprobante de marcaje y los códigos de verificación de documentos.',
    },

    /**
     * Ayuda y soporte (KMO-27). Resolución 38 Art. 5 requires the platform and
     * its manuals in Chilean Spanish; this is where that lands for mobile.
     *
     * Written for someone who wants to know why their punch did not go
     * through, not for someone reading documentation — short sentences, no
     * jargon, no promise the app cannot keep. Every claim here is grounded in
     * shipped behaviour or a design decision already on record, not invented
     * for this screen: see each section's own comment.
     */
    helpSupport: {
      sections: {
        /**
         * Colación has no punch button in v1 (D-F1-a dropped it — see
         * src/features/marcaje/punch-state.ts, whose punchStates is only
         * ['before', 'working', 'done']), so this describes exactly that and
         * nothing the app does not do.
         */
        punching: {
          title: 'Cómo marcar tu asistencia',
          body: [
            'En la pestaña Inicio verás un botón grande: toca Marcar entrada cuando llegues a tu turno y Marcar salida cuando lo termines.',
            'La hora que queda registrada es la que asigna el servidor al recibir tu marca, nunca la hora de tu teléfono — así lo exige la ley, y es lo que hace válido tu comprobante.',
          ],
        },
        /**
         * Quotes the three geolocation cards verbatim (README's own Project
         * status section) and the permission-denied line
         * (es.permissions.location.denied) rather than paraphrasing them.
         */
        location: {
          title: 'Qué significa el estado de tu ubicación',
          body: [
            'Sobre el botón de marcar verás una tarjeta con tu ubicación. "Ubicación confirmada" quiere decir que estás dentro del rango de tu sucursal y puedes marcar con normalidad.',
            '"Fuera del rango permitido" aparece cuando el teléfono te ubica lejos de tu sucursal; puedes marcar igual con "Marcar de todas formas", pero esa marca queda pendiente de revisión.',
            '"Sin señal de GPS" aparece cuando el teléfono no logra ubicarte; "Reintentar ubicación" vuelve a intentarlo.',
            'Si no le das permiso de ubicación a Kolvi, igual puedes marcar — tu asistencia no puede depender de un permiso — pero la marca queda sin ubicación asociada.',
          ],
        },
        /**
         * Art. 10 capture-and-store, matching design-decisions.md §4.1/§4.5:
         * Sincronizar is an accelerator, never the only way the queue drains.
         */
        noSignal: {
          title: 'Si no tienes señal',
          body: [
            'Si marcas sin conexión, tu teléfono guarda la marca y la envía apenas recupere señal — no necesitas hacer nada más.',
            'El botón Sincronizar solo apura ese envío; no es la única forma en que tu marca llega al registro.',
          ],
        },
        /**
         * Names the Art. 13 fields already on receipt-sheet.tsx (Tipo, Fecha,
         * Hora, Trabajador, RUT, N° comprobante, Hash) rather than a new set.
         */
        receipt: {
          title: 'Cómo leer tu comprobante',
          body: [
            'Cada vez que marcas se abre un comprobante con el tipo de marca, la fecha, la hora, tu nombre, tu RUT, un número de comprobante y un hash de verificación.',
            'Ese comprobante también llega a tu correo personal, si lo tienes registrado en Mis datos.',
          ],
        },
        /**
         * Follows the precedent set by receipt-sheet's own hash comment: no
         * public validation endpoint exists, so this never implies a
         * self-serve verification tool — only that the hash is proof to keep
         * or quote.
         */
        hash: {
          title: 'Cómo verificar el hash',
          body: [
            'El hash es un código único que prueba que tu comprobante no fue alterado después de generarse — es la forma en que la ley exige resguardar cada marca.',
            'Puedes copiarlo desde el comprobante y guardarlo, o compararlo con el que llegó a tu correo. Si necesitas confirmarlo con Recursos Humanos o con la Dirección del Trabajo, es ese código el que debes entregarles.',
          ],
        },
        /**
         * Expands pendingSyncSummary/pendingSyncSubtitle into what to do —
         * nothing, it syncs automatically — rather than repeating the banner.
         */
        unsynced: {
          title: 'Qué significa una marca no sincronizada',
          body: [
            'Una marca "esperando sincronizar" quedó guardada en tu teléfono pero aún no forma parte del libro de asistencia electrónico — todavía no llega al registro central.',
            'No necesitas volver a marcar ni hacer nada especial: se envía sola apenas tu teléfono tenga señal. Sincronizar solo acelera ese envío.',
          ],
        },
      },

      /** Text-only, no link out — the same treatment misDatos.noPersonalEmail gives a gap it cannot fix in-app. */
      contact: {
        title: 'Contacto de soporte',
        action: 'Escribir a soporte',
        email: 'soporte@kolvi.cl',
      },
    },
  },

  /**
   * Verbs that mean the same thing on every screen. A second spelling of `Reintentar`
   * is how a catalogue starts drifting, so actions are named once and reused.
   */
  actions: {
    retry: 'Reintentar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    back: 'Volver',
    /** The comprobante's hash button, and its confirmed state. */
    copy: 'Copiar',
    copied: 'Copiado',
    /** Flushes the offline punch queue from the pending-sync banner. */
    sync: 'Sincronizar',
    openSettings: 'Abrir ajustes',
  },

  /**
   * A screen with no content to draw yet. Every list and every detail screen is in
   * one of these three states before it is in its real one, and each needs words —
   * a spinner with no caption and an empty screen with no explanation are the two
   * states employees report as "the app is broken".
   *
   * A screen with something more specific to say says it instead; these are the
   * fallbacks, not a ceiling.
   */
  states: {
    /** Under a spinner, while the first request for a screen is in flight. */
    loading: 'Cargando…',
    /** A list that loaded and came back with nothing in it. */
    empty: 'No hay nada que mostrar por ahora.',
    /** A screen whose data did not load, above an `actions.retry` button. */
    failed: 'No pudimos cargar esta información.',
  },

  /**
   * Denied permissions, which are a state and not an error: nothing went wrong, the
   * app simply cannot do its job until the employee changes something. So each one
   * names what is missing and what to do about it, and none of them blames the user.
   *
   * `deniedForever` is the Android case where the OS stops showing the prompt. There
   * is no way back from inside the app, so the copy sends them to system settings —
   * telling them to "allow the permission" would be advice they cannot act on.
   */
  permissions: {
    location: {
      denied: 'Kolvi necesita tu ubicación para registrar una marca.',
      deniedForever:
        'Activa el permiso de ubicación en los ajustes del teléfono para poder marcar.',
      /**
       * Location services off at the OS level, not a permission the app was
       * refused — and, since KMO-16, the subtitle under `Sin señal de GPS`,
       * which is why it lost its full stop: the design writes the line without
       * one, and a second spelling of the same sentence is how a catalogue
       * starts drifting.
       */
      servicesOff: 'Activa tu ubicación para poder marcar',

      /**
       * The rationale shown *before* the OS prompt (KMO-16 #1).
       *
       * Android gives one prompt and then, on a second refusal, stops asking
       * forever — so the sentence that explains why has to come before it, not
       * after. It says what the permission is for and what happens without it,
       * because an employee who refuses this one is not blocked from punching;
       * their marks simply carry no location, and that is a worse record for
       * them than for anyone else if a shift is ever disputed.
       *
       * `Ahora no` is a real answer. The prompt is not raised again on the next
       * launch — the way back is the card, which keeps offering the OS settings.
       */
      rationale: {
        title: 'Kolvi usa tu ubicación al marcar',
        body: 'Al marcar entrada o salida, Kolvi registra dónde estás para confirmar que estás en tu lugar de trabajo. Solo la lee mientras tienes la app abierta en Marcaje, nunca en segundo plano. Si no la activas igual puedes marcar, pero tu marca quedará sin ubicación.',
        allow: 'Continuar',
        dismiss: 'Ahora no',
        close: 'Cerrar el aviso de ubicación',
      },

      /**
       * The action on a card whose permission was refused but can still be asked
       * about again — it reopens the rationale, and the OS prompt behind it.
       * `es.actions.openSettings` is what the same slot says once Android has
       * stopped offering the prompt (#8).
       */
      enable: 'Activar ubicación',

      /**
       * `NSLocationWhenInUseUsageDescription`, which iOS draws in its own dialog.
       * Here rather than in `app.config.ts` for the same reason as
       * `es.security.faceIdUsage`: the plugin's default is an English sentence,
       * and Res. 38 Art. 5 has no exception for text the OS happens to show.
       */
      whenInUseUsage: 'Kolvi usa tu ubicación para registrar dónde marcas tu entrada y salida.',
    },
    notifications: {
      denied: 'Activa las notificaciones para enterarte de tus solicitudes y documentos.',
    },
    biometrics: {
      unavailable: 'Este teléfono no tiene huella o rostro configurado.',
    },
  },

  /**
   * What a failed request says when the server did not say anything itself.
   *
   * The server's own `message` is always preferred — it knows why the request was
   * refused and it is already in Spanish — so these are the fallbacks for the
   * cases where there is no server to ask (no connection, a timeout) or where the
   * body carried no usable message. One entry per `ApiError` kind in
   * `@/api/errors`.
   */
  errors: {
    network: 'Sin conexión. Revisa tu red e inténtalo de nuevo.',
    timeout: 'El servidor está tardando demasiado en responder. Inténtalo de nuevo.',
    unauthorized: 'Tu sesión expiró. Vuelve a iniciar sesión.',
    forbidden: 'No tienes permiso para realizar esta acción.',
    notFound: 'No encontramos lo que buscabas.',
    validation: 'Revisa los datos ingresados.',
    /**
     * The server refused because the app asked too often (KMO-50).
     *
     * Written here rather than taken from the server, which is the exception to
     * the rule the rest of this catalogue follows. `ams` throttles through
     * Laravel's own middleware, whose body is the untranslated `Too Many
     * Attempts.` — the same problem as the guard's `Unauthenticated.` that put
     * `sessionExpired` in this file. Art. 5 has no exception for a sentence that
     * arrived over HTTP.
     *
     * The wait is not in this sentence because `Retry-After` is not always
     * there; `tooManyAttempts` is what says it when it is.
     */
    rateLimited: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
    server: 'Ocurrió un error en el servidor. Inténtalo más tarde.',
    client: 'No pudimos completar la solicitud.',
    malformed: 'No pudimos leer la respuesta del servidor.',
  },

  /** Copy that belongs to scaffolding; it goes when the section is built. */
  scaffold: {
    underConstruction: 'Esta sección aún no está construida.',
  },
} as const;

/**
 * What a screen reader says for a tab that is carrying a count badge —
 * `Jornada, 2 pendientes`. The badge is a coral pill with a bare number in it,
 * which is meaningless spoken on its own and invisible to anyone who cannot see
 * it, so the count travels in the tab's own name instead.
 */
export function tabWithPendingCount(tab: string, count: number): string {
  return `${tab}, ${count} ${count === 1 ? 'pendiente' : 'pendientes'}`;
}

/** The bottom marker of a scaffolded section, e.g. `Fin de Jornada`. */
export function sectionEnd(section: string): string {
  return `Fin de ${section}`;
}

/**
 * The pending-correction card's countdown — the design's own `Vence en 2
 * días` — from whole calendar days until `expiresAt`, per `daysBetween`.
 *
 * Negative and zero both read as `Vence hoy`: a countdown that went negative
 * is the same fact an employee needs to act on today, and drawing a
 * "vencido hace -1 días" would be arithmetic leaking into copy.
 */
export function correctionExpiryLabel(daysRemaining: number): string {
  if (daysRemaining <= 0) {
    return 'Vence hoy';
  }

  if (daysRemaining === 1) {
    return 'Vence mañana';
  }

  return `Vence en ${daysRemaining} días`;
}

/**
 * `{reason} · {requester}` under the current/proposed pair — the design's
 * own `{{ c.reason }} · {{ c.requestedBy }}`, and the same one-half-present
 * shape as `profileIdentity` above. Either half can be absent (the server
 * sends `null` for a reason it does not recognise, or a system-filed
 * correction with no named requester); `null` when both are, so the card
 * draws nothing rather than a bare separator.
 */
export function correctionSubtitle(
  reason: string | null,
  requestedBy: string | null,
): string | null {
  if (reason !== null && requestedBy !== null) {
    return `${reason} · ${requestedBy}`;
  }

  return reason ?? requestedBy;
}

/**
 * `{position} · {premise}` under the name on Mi perfil (KMO-25 #2) — the
 * design's own `{{ userRole }} · {{ shiftPlace }}`. `null` when there is
 * nothing to say: ams KOL-61 lands the fields on every employee, not a value
 * for every one of them, and a lone `·` with nothing on either side would be
 * worse than no line at all. One half present draws just that half.
 */
export function profileIdentity(position: string | null, premise: string | null): string | null {
  if (position !== null && premise !== null) {
    return `${position} · ${premise}`;
  }

  return position ?? premise;
}

/**
 * `Hola, Camila` — the home screen's own title, under the date (KMO-15 #1).
 *
 * The name is the server's, shown as it arrives. `first_name` is nullable in
 * `ams`, so the caller falls back to the full name rather than to `Hola, ` with
 * nothing after the comma — see `SessionUser`.
 */
export function greeting(firstName: string): string {
  return `Hola, ${firstName}`;
}

/**
 * `08:00 – 17:00` — the shift window on the card, and the punch pair on a
 * workday row.
 *
 * The separator is an en dash, as the design writes it — not a hyphen, which is
 * what gets typed when a range is spelled out per screen instead of here. Both
 * ends arrive already formatted: this joins two strings and computes nothing.
 */
export function timeRange(start: string, end: string): string {
  return `${start} – ${end}`;
}

/**
 * `Entrada · Mié 5 ago · 08:03` — one row of the punch history, announced as a
 * single element (KMO-20 #1).
 *
 * The row draws the three values in two columns, which a screen reader would
 * otherwise read as three unrelated strings with no way to tell which date the
 * time belongs to. This is what it announces instead, and the separator is the
 * middot the location card already uses rather than a fourth spelling of "and".
 *
 * All three arrive already formatted: this joins strings and computes nothing.
 */
export function markSummary(type: string, date: string, time: string): string {
  return `${type} · ${date} · ${time}`;
}

/**
 * `32,5 / 44 hrs esta semana` — the line under the punch button.
 *
 * Both numbers are decimal hours from the server. The denominator is the shift's
 * contracted weekly total, which is not the same thing as the statutory maximum
 * under Ley 21.561 and is not computed here.
 */
export function weekSummary(worked: number, contracted: number): string {
  return `${formatDecimalHours(worked)} / ${formatDecimalHours(contracted)} hrs esta semana`;
}

/**
 * `Sucursal Ñuñoa · a 12 m de la marca` — the subtitle of the confirmed
 * location card (KMO-16 #2).
 *
 * The distance is `null` for a premise the server sent no coordinates for. The
 * card still confirms — a premise with no geofence configured is not a premise
 * an employee is out of range of (#6) — and the subtitle is then the premise
 * alone, because `a 0 m` would be a measurement nobody took.
 *
 * Rounded to whole metres. A fix good to ±20 m rendered as `a 12,4 m` claims a
 * precision the phone does not have.
 */
export function locationConfirmed(premise: string, distanceMeters: number | null): string {
  return distanceMeters === null
    ? premise
    : `${premise} · a ${Math.round(distanceMeters)} m de la marca`;
}

/** `Debes estar dentro de Sucursal Ñuñoa para marcar` — the out-of-range subtitle (#3). */
export function locationOutOfRange(premise: string): string {
  return `Debes estar dentro de ${premise} para marcar`;
}

/** `2 marcas esperando sincronizar` — the offline queue banner on the home screen. */
export function pendingSyncSummary(count: number): string {
  return `${count} ${count === 1 ? 'marca esperando' : 'marcas esperando'} sincronizar`;
}

/**
 * `Aún no forman parte del libro de asistencia` — the line under it (KMO-22 #3).
 *
 * A formatter rather than the fixed string the design draws, and the reason is
 * visible the first time an employee queues exactly one punch: the design only
 * ever renders this banner in the plural, so its subtitle is `no forman`, and
 * over `1 marca esperando sincronizar` that is a plural verb with a singular
 * subject. Res. 38 Art. 5 makes the Spanish a compliance requirement, and the
 * singular is already the register's own wording — the offline comprobante in
 * docs/design-decisions.md §4.5 says `aún no forma parte del libro de asistencia
 * electrónico`.
 *
 * What it says is the same claim in both numbers, and it is §4.5's: the
 * attendance book is the central database (Art. 9), and a punch on this phone is
 * captured and stored pending transmission, which is not registration.
 */
export function pendingSyncSubtitle(count: number): string {
  return count === 1
    ? 'Aún no forma parte del libro de asistencia'
    : 'Aún no forman parte del libro de asistencia';
}

/**
 * What Cerrar sesión says when the phone is still holding punches nobody has
 * seen — KMO-12 #3, replacing `auth.signOut.body` rather than sitting under it.
 *
 * It leads with the count and the word `perderán`, because the thing at risk is
 * not the session: an unsynced punch is an attendance record that exists only on
 * this phone, and signing out is the one action that can destroy one. The
 * employee is told to sync first, since that is the way out that costs nothing.
 */
/**
 * The throttle message with the wait in it (KMO-50).
 *
 * Separate from `es.errors.rateLimited` rather than replacing it: `Retry-After`
 * is not guaranteed, and a sentence that names no interval is better than one
 * that names a made-up one. Falls back to the catalogue sentence when the server
 * did not say how long.
 *
 * Seconds rather than a rounded minute because that is the unit the server
 * answers in — `Retry-After: 59` is a wait an employee will sit through at a
 * shift change, and rounding it to "un minuto" would overstate it every time.
 */
export function tooManyAttempts(seconds?: number): string {
  if (seconds === undefined || seconds <= 0) {
    return es.errors.rateLimited;
  }

  const wait = seconds === 1 ? '1 segundo' : `${seconds} segundos`;

  return `Demasiados intentos. Espera ${wait} e inténtalo de nuevo.`;
}

/**
 * The forgot-password confirmation (KMO-14 #2, #3).
 *
 * Conditional on purpose. `ams` answers the same 204 for an address with an
 * account and one without, so this screen genuinely does not know whether a mail
 * was sent — and *si … tiene una cuenta* is the only honest phrasing as well as
 * the one that keeps the endpoint from being used to test who works here.
 *
 * It names the address the employee typed. That discloses nothing they did not
 * just write, and it is what turns "nothing arrived" from a mystery into a typo
 * they can see.
 *
 * `60 minutos` is `config/auth.php`'s `passwords.users.expire` in `ams`. The app
 * cannot read it, so this sentence is the one place a server-side duration is
 * restated here — if that config ever changes, this string changes with it.
 */
export function passwordResetSent(email: string): string {
  return `Si ${email} tiene una cuenta en Kolvi, te enviamos un enlace para crear una contraseña nueva. Ábrelo en este teléfono dentro de los próximos 60 minutos. Si no lo ves, revisa la carpeta de spam o correo no deseado.`;
}

export function unsyncedPunchesWarning(count: number): string {
  const marks = count === 1 ? '1 marca registrada' : `${count} marcas registradas`;
  const lost = count === 1 ? 'Se perderá' : 'Se perderán';

  return `Tienes ${marks} en este teléfono que aún no llegan al servidor. ${lost} al cerrar sesión y no quedarán en tu registro de asistencia. Conéctate y sincroniza antes de salir.`;
}

/**
 * Ayuda y soporte's footer (KMO-27 #4) — the app version and build number so
 * support can identify which build an employee is reporting from.
 *
 * The build number is omitted rather than shown as a placeholder when the
 * platform did not report one, same treatment `misDatos.noPersonalEmail`'s
 * field gives an absent value: nothing invented, nothing left blank.
 */
export function appVersionLabel(version: string | null, build: string | number | null): string {
  if (version === null) {
    return 'Versión desconocida';
  }

  return build === null ? `Versión ${version}` : `Versión ${version} (${build})`;
}
