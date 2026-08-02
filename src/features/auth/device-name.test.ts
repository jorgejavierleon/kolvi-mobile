import { Platform } from 'react-native';

import { DEVICE_ID_KEY, resetDeviceNameCache, resolveDeviceName } from './device-name';

/** The platform the suite happens to run as; the name carries it either way. */
const nameFor = (id: string) => `Kolvi ${Platform.OS} ${id}`;

/**
 * The ids are the only thing this module invents, so they are the only thing
 * stubbed: each call hands back the next one, which is what makes "the second
 * login reused the first id" an assertion rather than a coincidence.
 */
const mockGeneratedIds = ['id-one', 'id-two', 'id-three'];
let mockGeneratedIndex = 0;

jest.mock('expo-crypto', () => ({
  randomUUID: () => mockGeneratedIds[mockGeneratedIndex++] ?? 'exhausted',
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

function fakeStore(initial: string | null = null) {
  const values = new Map<string, string>();
  if (initial !== null) {
    values.set(DEVICE_ID_KEY, initial);
  }

  return {
    values,
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

function failingStore() {
  return {
    getItemAsync: jest.fn(async () => {
      throw new Error('keystore unavailable');
    }),
    setItemAsync: jest.fn(async () => undefined),
  };
}

beforeEach(() => {
  mockGeneratedIndex = 0;
  resetDeviceNameCache();
});

describe('resolveDeviceName', () => {
  it('names the device for the platform and the stored id', async () => {
    const store = fakeStore('9a3f1c2e');

    await expect(resolveDeviceName(store)).resolves.toBe(nameFor('9a3f1c2e'));
  });

  it('generates and persists an id on first launch', async () => {
    const store = fakeStore();

    await expect(resolveDeviceName(store)).resolves.toBe(nameFor('id-one'));
    expect(store.setItemAsync).toHaveBeenCalledWith(DEVICE_ID_KEY, 'id-one');
  });

  // #2 — the criterion itself. A second login is a second process, so the memo is
  // dropped and the value has to come back out of the store.
  it('reuses the stored id across logins rather than issuing a new one', async () => {
    const store = fakeStore();
    const first = await resolveDeviceName(store);

    resetDeviceNameCache();
    const second = await resolveDeviceName(store);

    expect(second).toBe(first);
    expect(store.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('reads the store once however many callers ask at the same time', async () => {
    const store = fakeStore();

    const [first, second] = await Promise.all([resolveDeviceName(store), resolveDeviceName(store)]);

    expect(second).toBe(first);
    expect(store.getItemAsync).toHaveBeenCalledTimes(1);
    expect(store.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('treats an empty stored value as no value', async () => {
    const store = fakeStore('');

    await expect(resolveDeviceName(store)).resolves.toBe(nameFor('id-one'));
    expect(store.setItemAsync).toHaveBeenCalledWith(DEVICE_ID_KEY, 'id-one');
  });

  it('still produces a name when the keystore refuses', async () => {
    const store = failingStore();

    await expect(resolveDeviceName(store)).resolves.toBe(nameFor('id-one'));
  });
});
