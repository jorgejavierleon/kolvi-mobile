import {
  UNLOCK_PREFERENCE_KEY,
  createMemoryUnlockPreferenceStore,
  createSecureUnlockPreferenceStore,
  type PreferenceStorage,
} from './unlock-preference';

function fakeStorage(overrides: Partial<PreferenceStorage> = {}): PreferenceStorage {
  return {
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe('createSecureUnlockPreferenceStore', () => {
  it('reads back what was written', async () => {
    const storage = fakeStorage({ getItemAsync: jest.fn(async () => 'enabled') });

    await expect(createSecureUnlockPreferenceStore(storage).read()).resolves.toBe('enabled');
  });

  it('writes under the namespaced key the other stored values use', async () => {
    const setItemAsync = jest.fn(async () => undefined);

    await createSecureUnlockPreferenceStore(fakeStorage({ setItemAsync })).write('enabled');

    expect(setItemAsync).toHaveBeenCalledWith(UNLOCK_PREFERENCE_KEY, 'enabled');
    expect(UNLOCK_PREFERENCE_KEY).toMatch(/^kolvi\./);
  });

  // "Never asked" and "asked and said no" are different states: the first owes the
  // employee an offer (#1) and the second does not.
  it('reports unset when nothing has been stored', async () => {
    await expect(createSecureUnlockPreferenceStore(fakeStorage()).read()).resolves.toBe('unset');
  });

  it('reports unset for a value it does not recognise', async () => {
    const storage = fakeStorage({ getItemAsync: jest.fn(async () => 'perhaps') });

    // Being asked once more is the harmless direction to fail in; silently
    // treating a garbled value as `enabled` would lock someone behind a
    // preference they never set.
    await expect(createSecureUnlockPreferenceStore(storage).read()).resolves.toBe('unset');
  });

  it('reports unset rather than throwing when the keystore refuses to read', async () => {
    const storage = fakeStorage({
      getItemAsync: jest.fn(async () => {
        throw new Error('keystore unavailable');
      }),
    });

    // Degrading has to mean "no lock", not "locked out of your own app".
    await expect(createSecureUnlockPreferenceStore(storage).read()).resolves.toBe('unset');
  });

  it('does not turn a failed write into a failed toggle', async () => {
    const storage = fakeStorage({
      setItemAsync: jest.fn(async () => {
        throw new Error('keystore unavailable');
      }),
    });

    await expect(
      createSecureUnlockPreferenceStore(storage).write('disabled'),
    ).resolves.toBeUndefined();
  });

  it('deletes the entry on clear, and survives a keystore that will not', async () => {
    const deleteItemAsync = jest.fn(async () => {
      throw new Error('keystore unavailable');
    });

    await expect(
      createSecureUnlockPreferenceStore(fakeStorage({ deleteItemAsync })).clear(),
    ).resolves.toBeUndefined();
    expect(deleteItemAsync).toHaveBeenCalledWith(UNLOCK_PREFERENCE_KEY);
  });
});

describe('createMemoryUnlockPreferenceStore', () => {
  it('round-trips a preference and forgets it on clear', async () => {
    const store = createMemoryUnlockPreferenceStore();

    await expect(store.read()).resolves.toBe('unset');

    await store.write('enabled');
    await expect(store.read()).resolves.toBe('enabled');

    await store.clear();
    await expect(store.read()).resolves.toBe('unset');
  });
});
