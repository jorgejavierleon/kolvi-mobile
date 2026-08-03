/**
 * What the signed-in employee is allowed to do, as the server reports it.
 *
 * The app gates on permissions and never on a role name. The names come from
 * `ams`'s `RoleSeeder::EMPLOYEE_PERMISSIONS`, which is the ceiling of what the
 * employee app can offer: an admin who also punches carries `ClockOwn:Mark` and
 * `ViewOwn:Mark` and nothing else, and must get a working Marcaje tab with empty
 * or hidden sections elsewhere rather than a screenful of 403s.
 *
 * `GET /api/v1/user` does not report permissions yet — it returns the raw model. That
 * is `ams` KOL-5. Until it ships, `parsePermissions` finds nothing and every gate
 * closes, which is the safe direction to be wrong in: a hidden action is a support
 * call, a shown one that 403s is an employee who thinks their punch registered.
 */

/**
 * Spatie permission names, verbatim. Spelling drift is not a compile error on the
 * wire, so the union is the one place they are written down.
 */
export const employeePermissions = [
  'ClockOwn:Mark',
  'ViewOwn:Mark',
  'ViewOwn:Workday',
  'RequestOwn:Leave',
  'ViewOwn:Leave',
  'CancelOwn:Leave',
  'ReviewOwn:MarkModification',
  'ViewOwn:Document',
  'SignOwn:Document',
] as const;

export type Permission = (typeof employeePermissions)[number];

export type PermissionSet = ReadonlySet<Permission>;

const known: ReadonlySet<string> = new Set<string>(employeePermissions);

/** Nothing granted. Shared so a signed-out or unparsed session is one object. */
export const noPermissions: PermissionSet = new Set<Permission>();

/**
 * Read the permission names out of whatever `GET /api/v1/user` sends.
 *
 * Two shapes are accepted: a flat `["ClockOwn:Mark"]`, which is what KOL-5 asks
 * for, and Spatie's own `[{"name": "ClockOwn:Mark"}]`, which is what a plain
 * `getAllPermissions()` serialises to. Accepting both means the app does not break
 * on the day the backend resource is written, and does not need a release the day
 * after if it is written the other way.
 *
 * Names the app does not know are dropped rather than kept as strings: a gate can
 * only be written against the union, so an unknown name has nothing to open.
 */
export function parsePermissions(value: unknown): PermissionSet {
  if (!Array.isArray(value)) {
    return noPermissions;
  }

  const granted = new Set<Permission>();

  for (const entry of value) {
    const name = nameOf(entry);

    if (name !== undefined && known.has(name)) {
      granted.add(name as Permission);
    }
  }

  return granted;
}

function nameOf(entry: unknown): string | undefined {
  if (typeof entry === 'string') {
    return entry;
  }

  if (typeof entry === 'object' && entry !== null && 'name' in entry) {
    const { name } = entry as { name: unknown };

    return typeof name === 'string' ? name : undefined;
  }

  return undefined;
}
