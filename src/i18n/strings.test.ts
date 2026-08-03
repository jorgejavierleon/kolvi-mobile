import type { ApiErrorKind } from '@/api';

import {
  es,
  pendingSyncSummary,
  sectionEnd,
  tabWithPendingCount,
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
