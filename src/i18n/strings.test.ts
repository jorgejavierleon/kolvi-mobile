import type { ApiErrorKind } from '@/api';

import {
  appVersionLabel,
  es,
  locationConfirmed,
  locationOutOfRange,
  pendingSyncSubtitle,
  pendingSyncSummary,
  profileIdentity,
  sectionEnd,
  tabWithPendingCount,
  tooManyAttempts,
  unsyncedPunchesWarning,
  weekSummary,
} from './strings';

/** Every leaf of the catalogue, as `['errors.network', 'Sin conexión. …']` pairs. */
function entries(node: unknown, path: string[] = []): [string, string][] {
  if (typeof node === 'string') {
    return [[path.join('.'), node]];
  }

  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    entries(value, [...path, key]),
  );
}

const catalogue = entries(es);

describe('the catalogue as a whole', () => {
  it('is not empty anywhere — a blank entry renders as a screen with nothing on it', () => {
    for (const [path, value] of catalogue) {
      expect(`${path}: ${JSON.stringify(value)}`).toBe(`${path}: ${JSON.stringify(value.trim())}`);
      expect(value.length).toBeGreaterThan(0);
    }
  });

  // Res. 38 Art. 5 is about the platform being in Chilean Spanish. This will not
  // catch a bad translation, but it does catch the failure that actually happens:
  // an entry added in English during development and never revisited.
  // `error` and `cancelar` are not on the list: they are Spanish words that happen
  // to look English, and a guard that cries wolf gets deleted.
  it('holds no obviously English entry', () => {
    const english = /\b(?:the|and|loading|please|retry|failed|settings|sign|password)\b/i;

    for (const [path, value] of catalogue) {
      expect(`${path}: ${english.test(value)}`).toBe(`${path}: false`);
    }
  });
});

// #2 — the states that get forgotten. Each of these is a screen an employee lands
// on when something has gone wrong or has not happened yet, and each needs words.
describe('the states beyond the happy path', () => {
  it('covers loading', () => {
    expect(es.states.loading).toBe('Cargando…');
  });

  it('covers an empty list and a failed load', () => {
    expect(es.states.empty).toContain('No hay nada');
    expect(es.states.failed).toContain('No pudimos');
  });

  it('covers a denied permission for each capability the app asks for', () => {
    expect(es.permissions.location.denied).toBeTruthy();
    expect(es.permissions.location.deniedForever).toBeTruthy();
    expect(es.permissions.location.servicesOff).toBeTruthy();
    expect(es.permissions.notifications.denied).toBeTruthy();
    expect(es.permissions.biometrics.unavailable).toBeTruthy();
  });

  // Android stops showing the prompt after a second refusal, so there is no way
  // back from inside the app. The copy has to send them to system settings, and
  // there has to be a button saying so.
  it('sends a permanently denied permission to system settings', () => {
    expect(es.permissions.location.deniedForever).toContain('ajustes');
    expect(es.actions.openSettings).toBe('Abrir ajustes');
  });

  // One fallback per ApiError kind. The type below is the union from @/api, so
  // adding a kind without adding its copy fails the typecheck, not just this test.
  it('covers every ApiError kind', () => {
    const kinds: Record<ApiErrorKind, true> = {
      network: true,
      timeout: true,
      unauthorized: true,
      forbidden: true,
      notFound: true,
      validation: true,
      rateLimited: true,
      server: true,
      client: true,
      malformed: true,
    };

    expect(Object.keys(es.errors).sort()).toEqual(Object.keys(kinds).sort());
  });
});

describe('the login copy', () => {
  it('labels both fields and the submit action', () => {
    expect(es.auth.email).toBe('Correo electrónico');
    expect(es.auth.password).toBe('Contraseña');
    expect(es.auth.submit).toBe('Ingresar');
  });

  // #7 — the toggle says what pressing it will do, and the two states differ.
  it('names the reveal toggle in both of its states', () => {
    expect(es.auth.showPassword).toBe('Mostrar contraseña');
    expect(es.auth.hidePassword).toBe('Ocultar contraseña');
    expect(es.auth.showPassword).not.toBe(es.auth.hidePassword);
  });

  it('has a message for each field left empty', () => {
    expect(es.auth.emailRequired).toContain('correo');
    expect(es.auth.passwordRequired).toContain('contraseña');
  });

  // #4 — the reason a login was refused is the server's to word. A copy of either
  // sentence here is a second wording of the same refusal, and the one the screen
  // shows would then depend on which code path ran.
  it.each([
    'Estas credenciales no coinciden con nuestros registros.',
    'Esta cuenta está inactiva.',
  ])('does not restate the server rejection %s', (sentence) => {
    expect(catalogue.filter(([, value]) => value === sentence)).toEqual([]);
  });
});

// KMO-12. Signing out is destructive and irreversible, so the copy carries the
// weight of the criteria: the sheet has to say what is lost, and the login screen
// has to be honest about a token that outlived the session.
describe('the sign-out copy', () => {
  it('names the action and asks before doing it', () => {
    expect(es.auth.signOut.action).toBe('Cerrar sesión');
    expect(es.auth.signOut.title).toContain('¿');
  });

  // #2 — a confirmation that only asks "are you sure" teaches employees to tap
  // through it. This one has to describe the consequence.
  it('says what signing out costs rather than merely asking twice', () => {
    expect(es.auth.signOut.body).toMatch(/dejará de tener acceso/);
    expect(es.auth.signOut.body).toMatch(/contraseña/);
  });

  // #4 — the sentence has to state that access survives, and say what ends it.
  it('admits the token stays usable when the revocation did not reach the server', () => {
    expect(es.auth.signOut.notRevoked).toMatch(/seguirá activo/);
    expect(es.auth.signOut.notRevoked).toMatch(/conexión/);
  });

  // Two different sessions ending for two different reasons. An employee who chose
  // to sign out must not be told their session expired.
  it('does not reuse the expiry sentence', () => {
    expect(es.auth.signOut.notRevoked).not.toBe(es.auth.sessionExpired);
  });
});

describe('phrases assembled around a server value', () => {
  it('agrees the count and the noun in a tab badge', () => {
    expect(tabWithPendingCount(es.tabs.jornada, 1)).toBe('Jornada, 1 pendiente');
    expect(tabWithPendingCount(es.tabs.documentos, 3)).toBe('Documentos, 3 pendientes');
    expect(tabWithPendingCount(es.tabs.permisos, 0)).toBe('Permisos, 0 pendientes');
  });

  it('agrees the count and the noun in the pending-sync banner', () => {
    expect(pendingSyncSummary(1)).toBe('1 marca esperando sincronizar');
    expect(pendingSyncSummary(2)).toBe('2 marcas esperando sincronizar');
  });

  // KMO-22 #3. The two lines of the banner are one sentence about a number, and
  // the design only ever drew the plural half of it — `no forman` over `1 marca`
  // is a plural verb with a singular subject, on an interface Art. 5 requires to
  // be Spanish.
  it('agrees the verb in the pending-sync subtitle with the count above it', () => {
    expect(pendingSyncSubtitle(1)).toBe('Aún no forma parte del libro de asistencia');
    expect(pendingSyncSubtitle(2)).toBe('Aún no forman parte del libro de asistencia');
  });

  // KMO-12 #3. The number and the verb both have to agree, and the sentence has to
  // name what is destroyed — an attendance record, not a session.
  it('agrees the count and the verb in the sign-out warning', () => {
    expect(unsyncedPunchesWarning(1)).toContain('1 marca registrada');
    expect(unsyncedPunchesWarning(1)).toContain('Se perderá ');
    expect(unsyncedPunchesWarning(4)).toContain('4 marcas registradas');
    expect(unsyncedPunchesWarning(4)).toContain('Se perderán ');
    expect(unsyncedPunchesWarning(2)).toContain('registro de asistencia');
  });

  it('writes the week summary with comma decimals and a bare contracted total', () => {
    expect(weekSummary(32.5, 44)).toBe('32,5 / 44 hrs esta semana');
    expect(weekSummary(0, 44)).toBe('0 / 44 hrs esta semana');
    expect(weekSummary(40, 40)).toBe('40 / 40 hrs esta semana');
  });

  it('marks the end of a scaffolded section by name', () => {
    expect(sectionEnd(es.tabs.jornada)).toBe('Fin de Jornada');
  });

  // KMO-25 #2. Verbatim from the design's `{{ userRole }} · {{ shiftPlace }}`.
  it('joins the position and the premise on Mi perfil', () => {
    expect(profileIdentity('Operaria de Bodega', 'Sucursal Ñuñoa')).toBe(
      'Operaria de Bodega · Sucursal Ñuñoa',
    );
  });

  it('draws only the half it has when the other is missing', () => {
    expect(profileIdentity('Operaria de Bodega', null)).toBe('Operaria de Bodega');
    expect(profileIdentity(null, 'Sucursal Ñuñoa')).toBe('Sucursal Ñuñoa');
  });

  it('has nothing to say when neither is set', () => {
    expect(profileIdentity(null, null)).toBeNull();
  });

  // KMO-16 #2. Verbatim from the design's `geoSub`, down to the middle dot.
  it('names the premise and the distance on the confirmed location card', () => {
    expect(locationConfirmed('Sucursal Ñuñoa', 12)).toBe('Sucursal Ñuñoa · a 12 m de la marca');
  });

  // A fix good to ±20 m rendered as `a 12,4 m` claims a precision nobody measured.
  it('rounds the distance to whole metres', () => {
    expect(locationConfirmed('Bodega Sur', 12.4)).toBe('Bodega Sur · a 12 m de la marca');
    expect(locationConfirmed('Bodega Sur', 12.6)).toBe('Bodega Sur · a 13 m de la marca');
  });

  // #6. A premise the server sent no coordinates for is confirmed with no
  // distance on it — `a 0 m` would be a measurement nobody took.
  it('drops the distance clause when there is no distance to name', () => {
    expect(locationConfirmed('Sucursal Ñuñoa', null)).toBe('Sucursal Ñuñoa');
  });

  it('names the premise the employee has to be inside of', () => {
    expect(locationOutOfRange('Sucursal Ñuñoa')).toBe(
      'Debes estar dentro de Sucursal Ñuñoa para marcar',
    );
  });
});

// KMO-18. Both labels are transcribed from the design rather than authored, and
// the override's is a compliance sentence: docs/design-decisions.md D-F1-c words
// the escape hatch, and an employee pressing it has to have been told what it
// costs before they do.
describe('the escape hatches under the punch button', () => {
  it('warns inside the override label that the mark will be reviewed', () => {
    expect(es.marcaje.punch.override).toBe('Marcar de todas formas (queda pendiente de revisión)');
    expect(es.marcaje.punch.override).toContain('pendiente de revisión');
  });

  // Two different retries on one screen: `Reintentar` asks the server for the day
  // again, this one asks the phone where it is. An employee reading the bare verb
  // under `Sin señal de GPS` would not know which had happened.
  it('names what the location retry retries', () => {
    expect(es.marcaje.location.retry).toBe('Reintentar ubicación');
    expect(es.marcaje.location.retry).not.toBe(es.actions.retry);
  });
});

// The one thing that must never appear here. A workday status or a leave type
// arrives from the server as a {value, label} pair and is rendered as it came; a
// copy of that vocabulary in the catalogue is how a record ends up reading one way
// on the web console and another on the phone.
describe('domain vocabulary, which belongs to the server', () => {
  it.each([
    'Vacaciones',
    'Licencia médica',
    'Sin goce de sueldo',
    'Con goce de sueldo',
    'Pendiente de firma',
    'Firmado',
    'Aprobado',
    'Rechazado',
    'Atrasado',
    'Ausente',
  ])('does not translate %s', (label) => {
    const found = catalogue.filter(([, value]) => value === label).map(([path]) => path);

    expect(found).toEqual([]);
  });
});

describe('the throttle copy (KMO-50)', () => {
  it('names the wait in seconds', () => {
    expect(tooManyAttempts(59)).toContain('59 segundos');
  });

  it('says one second in the singular', () => {
    expect(tooManyAttempts(1)).toContain('1 segundo');
    expect(tooManyAttempts(1)).not.toContain('1 segundos');
  });

  // `Retry-After` is not guaranteed. A sentence naming no interval beats one
  // naming an invented one.
  it.each([undefined, 0])('falls back to the wait-less sentence for %p', (seconds) => {
    expect(tooManyAttempts(seconds)).toBe(es.errors.rateLimited);
  });

  // Art. 5. `ams` throttles through Laravel's own middleware, whose body is
  // untranslated — this catalogue is the only thing standing between that and
  // the screen.
  it('is Spanish, with nothing of the server default in it', () => {
    for (const message of [es.errors.rateLimited, tooManyAttempts(30)]) {
      expect(message).not.toMatch(/Too Many|Attempts/i);
      expect(message).toMatch(/[áéíóúñ¡¿]|intentos/i);
    }
  });
});

describe('appVersionLabel (KMO-27 #4)', () => {
  it('names the version and the build number', () => {
    expect(appVersionLabel('1.0.0', 12)).toBe('Versión 1.0.0 (12)');
  });

  it('omits the parenthetical rather than showing a blank build', () => {
    expect(appVersionLabel('1.0.0', null)).toBe('Versión 1.0.0');
  });

  it('falls back to a named unknown rather than an empty string', () => {
    expect(appVersionLabel(null, null)).toBe('Versión desconocida');
  });
});
