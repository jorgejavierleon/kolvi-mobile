import { employeePermissions, noPermissions, parsePermissions } from './permissions';

describe('employeePermissions', () => {
  // The nine names from ams's RoleSeeder::EMPLOYEE_PERMISSIONS. Spelled out rather
  // than derived, so a typo in the source shows up as a failure here instead of as
  // a permanently closed gate on a device.
  it('lists the nine names the employee role grants', () => {
    expect([...employeePermissions]).toEqual([
      'ClockOwn:Mark',
      'ViewOwn:Mark',
      'ViewOwn:Workday',
      'RequestOwn:Leave',
      'ViewOwn:Leave',
      'CancelOwn:Leave',
      'ReviewOwn:MarkModification',
      'ViewOwn:Document',
      'SignOwn:Document',
    ]);
  });
});

describe('parsePermissions', () => {
  it('reads a flat array of names', () => {
    const granted = parsePermissions(['ClockOwn:Mark', 'ViewOwn:Mark']);

    expect(granted.has('ClockOwn:Mark')).toBe(true);
    expect(granted.has('ViewOwn:Mark')).toBe(true);
    expect(granted.size).toBe(2);
  });

  it("reads Spatie's own [{name}] shape", () => {
    const granted = parsePermissions([{ name: 'SignOwn:Document' }, { name: 'ViewOwn:Document' }]);

    expect(granted.has('SignOwn:Document')).toBe(true);
    expect(granted.has('ViewOwn:Document')).toBe(true);
  });

  it('reads a payload that mixes both shapes', () => {
    const granted = parsePermissions(['ClockOwn:Mark', { name: 'ViewOwn:Mark' }]);

    expect(granted.size).toBe(2);
  });

  it('drops names the app does not know', () => {
    const granted = parsePermissions(['ClockOwn:Mark', 'ManageAll:Company', { name: 42 }, null]);

    expect([...granted]).toEqual(['ClockOwn:Mark']);
  });

  it('ignores duplicates', () => {
    expect(parsePermissions(['ClockOwn:Mark', 'ClockOwn:Mark']).size).toBe(1);
  });

  // #8 — the field is missing today, and every gate has to close rather than
  // assume the employee may do everything.
  it.each<[string, unknown]>([
    ['absent', undefined],
    ['null', null],
    ['an empty array', []],
    ['an object', { 'ClockOwn:Mark': true }],
    ['a string', 'ClockOwn:Mark'],
  ])('grants nothing when permissions are %s', (_label, value) => {
    expect(parsePermissions(value).size).toBe(0);
  });
});

describe('noPermissions', () => {
  it('is empty', () => {
    expect(noPermissions.size).toBe(0);
  });
});
