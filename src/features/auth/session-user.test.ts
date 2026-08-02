import { employeePermissions } from './permissions';
import { parseSessionUser } from './session-user';

/**
 * The body of `GET /api/user` copied byte for byte off a locally running `ams`
 * after KOL-5, which narrowed the endpoint to a `UserResource` and added the
 * permission names. Reproduced rather than paraphrased: the whole point of these
 * tests is that the app agrees with what the server actually sends.
 */
const payload = {
  id: 5,
  name: 'Empleado Demo',
  first_name: 'Empleado',
  last_name: 'Demo',
  rut: '21437581-8',
  email: 'employee@example.com',
  avatar: null,
  permissions: [
    'RequestOwn:Leave',
    'ViewOwn:Leave',
    'CancelOwn:Leave',
    'ClockOwn:Mark',
    'ViewOwn:Mark',
    'ViewOwn:Workday',
    'ReviewOwn:MarkModification',
    'ViewOwn:Document',
    'SignOwn:Document',
  ],
};

/**
 * What the endpoint returned before KOL-5: the raw Eloquent model, every column
 * and no permissions. Kept because the parse is a whitelist and has to stay one —
 * a column added in `ams` must not become something the app reads.
 */
const rawModelPayload = {
  id: 5,
  organization_id: 1,
  company_id: 1,
  name: 'Empleado Demo',
  first_name: 'Empleado',
  last_name: 'Demo',
  rut: '21437581-8',
  email: 'employee@example.com',
  personal_email: null,
  is_active: true,
  is_admin: false,
  timezone: 'America/Santiago',
  avatar: null,
  formatted_rut: '21.437.581-8',
};

describe('parseSessionUser', () => {
  it('keeps only the fields the app uses', () => {
    const user = parseSessionUser(rawModelPayload);

    expect(user).toEqual({
      id: 5,
      name: 'Empleado Demo',
      firstName: 'Empleado',
      email: 'employee@example.com',
      rut: '21437581-8',
      permissions: new Set(),
    });
  });

  // #8 — the real payload, and the whole point of it: every permission the
  // employee role grants arrives and is readable by name.
  it('reads all nine permissions out of the payload ams actually sends', () => {
    const user = parseSessionUser(payload);

    expect(user?.permissions.size).toBe(employeePermissions.length);
    for (const permission of employeePermissions) {
      expect(user?.permissions.has(permission)).toBe(true);
    }
  });

  // A payload from before KOL-5, or from a deployment that has not caught up.
  it('parses a payload with no permissions field and grants nothing', () => {
    expect(parseSessionUser(rawModelPayload)?.permissions.size).toBe(0);
  });

  it.each<[string, unknown]>([
    ['null first_name', null],
    ['an empty first_name', ''],
    ['a numeric first_name', 7],
  ])('reports %s as no first name', (_label, first_name) => {
    expect(parseSessionUser({ ...payload, first_name })?.firstName).toBeNull();
  });

  it('reports a missing rut as null rather than inventing one', () => {
    expect(parseSessionUser({ ...payload, rut: null })?.rut).toBeNull();
  });

  it.each<[string, unknown]>([
    ['a string body', '<html>502 Bad Gateway</html>'],
    ['an array', [payload]],
    ['null', null],
    ['an empty object', {}],
    ['a user with no id', { ...payload, id: undefined }],
    ['a user whose id is a string', { ...payload, id: '3' }],
    ['a user with no email', { ...payload, email: undefined }],
    ['a user with no name', { ...payload, name: undefined }],
  ])('refuses %s', (_label, value) => {
    expect(parseSessionUser(value)).toBeNull();
  });
});
