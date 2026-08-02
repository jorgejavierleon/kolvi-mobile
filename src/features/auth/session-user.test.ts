import { parseSessionUser } from './session-user';

/**
 * Trimmed from the real body of `GET /api/user` against a locally running `ams`:
 * the endpoint returns the raw model, so the payload carries far more than this
 * and the parse has to ignore all of it.
 */
const payload = {
  id: 3,
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
    const user = parseSessionUser(payload);

    expect(user).toEqual({
      id: 3,
      name: 'Empleado Demo',
      firstName: 'Empleado',
      email: 'employee@example.com',
      rut: '21437581-8',
      permissions: new Set(),
    });
  });

  it('reads the permissions the server reports', () => {
    const user = parseSessionUser({ ...payload, permissions: ['ClockOwn:Mark'] });

    expect(user?.permissions.has('ClockOwn:Mark')).toBe(true);
  });

  // #8 — today's payload. The user parses, and holds nothing.
  it('parses a payload with no permissions field and grants nothing', () => {
    expect(parseSessionUser(payload)?.permissions.size).toBe(0);
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
