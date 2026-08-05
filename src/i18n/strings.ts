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
       * The punch did not go through (#8).
       *
       * The fallback only. A server that said why — in Spanish, out of `ams`
       * `lang/` — is quoted verbatim instead, the same as everywhere else in the
       * app. What this sentence has to carry is the one thing the employee needs
       * to know and cannot see: that nothing was recorded, so the button below
       * it is still worth pressing.
       */
      failed: 'No pudimos registrar tu marca. No quedó guardada — inténtalo de nuevo.',
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
    },

    /**
     * The whole screen failed to load (#9). Distinct from `es.states.failed`,
     * which is a list that came back empty-handed: this one is the screen an
     * employee opened *in order to punch*, so it names the consequence rather
     * than the request, and the retry sits next to it.
     */
    loadFailed: 'No pudimos cargar tu turno de hoy.',
  },

  profile: {
    title: 'Mi perfil',
    /** The avatar button in every tab header. */
    open: 'Abrir mi perfil',
    /** The back chevron on the profile surface. */
    back: 'Volver',
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
