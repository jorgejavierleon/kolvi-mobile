/**
 * The es-CL string catalogue. Res. 38 Art. 5 requires the platform to be in
 * Chilean Spanish, which makes one catalogue a compliance artefact rather than a
 * convenience: there is exactly one place to audit the wording an employee sees.
 *
 * This is the **start** of it — KMO-4 needs the navigation shell's copy and adds
 * only that, KMO-5 adds the transport-level error copy the API client falls back
 * to. KMO-6 grows it to cover the remaining error, empty, permission-denied and
 * loading states across the app, and adds the date/RUT/hours formatters.
 *
 * Domain vocabulary — leave types, workday statuses, document statuses — arrives
 * from the server as `{value, label}` pairs and is shown verbatim. It never
 * passes through here.
 */
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
