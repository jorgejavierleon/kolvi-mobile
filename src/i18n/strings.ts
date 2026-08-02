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
import { formatDecimalHours } from './hours';

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
