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
      /** Location services off at the OS level, not a permission the app was refused. */
      servicesOff: 'Activa tu ubicación para poder marcar.',
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
 * `32,5 / 44 hrs esta semana` — the line under the punch button.
 *
 * Both numbers are decimal hours from the server. The denominator is the shift's
 * contracted weekly total, which is not the same thing as the statutory maximum
 * under Ley 21.561 and is not computed here.
 */
export function weekSummary(worked: number, contracted: number): string {
  return `${formatDecimalHours(worked)} / ${formatDecimalHours(contracted)} hrs esta semana`;
}

/** `2 marcas esperando sincronizar` — the offline queue banner on the home screen. */
export function pendingSyncSummary(count: number): string {
  return `${count} ${count === 1 ? 'marca esperando' : 'marcas esperando'} sincronizar`;
}
