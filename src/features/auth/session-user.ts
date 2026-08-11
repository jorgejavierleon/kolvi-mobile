/**
 * The signed-in employee, as the app is willing to hold them.
 *
 * `GET /api/v1/user` currently returns the whole Eloquent model — every column on the
 * users table plus an appended avatar — so this is a whitelist rather than a cast.
 * Reading only what a screen actually uses means a column added in `ams` cannot
 * quietly become something the app depends on, and the parse keeps working once
 * KOL-5 narrows the endpoint to a resource.
 */

import { parsePermissions, type PermissionSet } from './permissions';

export type SessionUser = {
  readonly id: number;
  /** The full name, as the console shows it. */
  readonly name: string;
  /**
   * For `Hola, {nombre}` on the home screen (KMO-15). Nullable in `ams`, so the
   * greeting falls back to the full name rather than to an empty sentence.
   */
  readonly firstName: string | null;
  readonly email: string;
  /** Unformatted, e.g. `21437581-8`. `formatRut` in `@/i18n` dots it for display. */
  readonly rut: string | null;
  /** The employee's job title, e.g. `Operaria de Bodega`. `null` if none is assigned. */
  readonly position: string | null;
  /** The employee's assigned premise, e.g. `Sucursal Ñuñoa`. `null` if none is assigned. */
  readonly premise: string | null;
  readonly permissions: PermissionSet;
};

/**
 * `null` when the payload is not a user at all — an HTML error page from a proxy,
 * or a body that lost its `id`. The caller turns that into a failed sign-in; a
 * half-built user would be worse, because the app would sign in with no way to
 * name the employee on a legally binding punch.
 */
export function parseSessionUser(payload: unknown): SessionUser | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const id = record.id;
  const name = record.name;
  const email = record.email;

  if (typeof id !== 'number' || typeof name !== 'string' || typeof email !== 'string') {
    return null;
  }

  return {
    id,
    name,
    firstName: optionalString(record.first_name),
    email,
    rut: optionalString(record.rut),
    position: optionalString(record.position),
    premise: optionalString(record.premise),
    permissions: parsePermissions(record.permissions),
  };
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
