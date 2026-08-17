import * as SecureStore from 'expo-secure-store';

import { parsePermissions } from './permissions';
import {
  createMemorySessionCache,
  createSecureSessionCache,
  SESSION_CACHE_KEY,
  type CachedSession,
  type SecureCacheStorage,
} from './session-cache';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const employee: CachedSession = {
  verifiedAt: '2026-08-17T12:00:00.000Z',
  user: {
    id: 3,
    name: 'Empleado Demo',
    firstName: 'Empleado',
    email: 'employee@example.com',
    rut: '21437581-8',
    position: null,
    premise: null,
    personalEmail: null,
    phone: null,
    supervisor: null,
    contractStartDate: null,
    permissions: parsePermissions(['ClockOwn:Mark', 'ViewOwn:Mark']),
  },
};

function fakeStorage(initial?: string): SecureCacheStorage & {
  values: Map<string, string>;
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
} {
  const values = new Map<string, string>();
  if (initial !== undefined) {
    values.set(SESSION_CACHE_KEY, initial);
  }

  return {
    values,
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };
}

function refusingStorage() {
  const refuse = async () => {
    throw new Error('keystore unavailable');
  };

  return {
    getItemAsync: jest.fn(refuse),
    setItemAsync: jest.fn(refuse),
    deleteItemAsync: jest.fn(refuse),
  };
}

const consoleSpies = ['log', 'info', 'warn', 'error', 'debug'] as const;
let spies: jest.SpyInstance[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  spies = consoleSpies.map((channel) => jest.spyOn(console, channel).mockImplementation(() => {}));
});

afterEach(() => {
  for (const spy of spies) {
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  }
});

describe('createSecureSessionCache', () => {
  it('reads and writes through expo-secure-store by default', async () => {
    const cache = createSecureSessionCache();

    await cache.write(employee);
    await cache.read();
    await cache.clear();

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SESSION_CACHE_KEY, expect.any(String), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(SESSION_CACHE_KEY);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SESSION_CACHE_KEY);
  });

  it('round-trips the user and the verification instant, permissions included', async () => {
    const storage = fakeStorage();
    const cache = createSecureSessionCache(storage);

    await cache.write(employee);

    await expect(cache.read()).resolves.toEqual(employee);
  });

  it('reads null when nothing has been cached', async () => {
    await expect(createSecureSessionCache(fakeStorage()).read()).resolves.toBeNull();
  });

  it('clears the cache', async () => {
    const storage = fakeStorage();
    const cache = createSecureSessionCache(storage);
    await cache.write(employee);

    await cache.clear();

    await expect(cache.read()).resolves.toBeNull();
    expect(storage.values.has(SESSION_CACHE_KEY)).toBe(false);
  });

  it('drops an entry that will not parse instead of failing on it every launch', async () => {
    const storage = fakeStorage('not json');
    const cache = createSecureSessionCache(storage);

    await expect(cache.read()).resolves.toBeNull();

    expect(storage.deleteItemAsync).toHaveBeenCalledWith(SESSION_CACHE_KEY);
  });

  it('drops an entry with no id, name or email rather than handing back half a user', async () => {
    const storage = fakeStorage(JSON.stringify({ user: { name: 'x' }, verifiedAt: 'now' }));
    const cache = createSecureSessionCache(storage);

    await expect(cache.read()).resolves.toBeNull();
  });

  it('never lets a keystore refusal fail a write', async () => {
    await expect(
      createSecureSessionCache(refusingStorage()).write(employee),
    ).resolves.toBeUndefined();
  });

  it('reads null when the keystore refuses', async () => {
    await expect(createSecureSessionCache(refusingStorage()).read()).resolves.toBeNull();
  });

  it('drops an entry it cannot decrypt instead of failing on it every launch', async () => {
    const storage = fakeStorage(JSON.stringify(employee));
    storage.getItemAsync.mockRejectedValue(new Error('could not decrypt'));
    const cache = createSecureSessionCache(storage);

    await expect(cache.read()).resolves.toBeNull();
    expect(storage.deleteItemAsync).toHaveBeenCalledWith(SESSION_CACHE_KEY);
  });

  it('survives a delete it cannot perform', async () => {
    await expect(createSecureSessionCache(refusingStorage()).clear()).resolves.toBeUndefined();
  });
});

describe('createMemorySessionCache', () => {
  it('holds the cache for the process and forgets it on clear', async () => {
    const cache = createMemorySessionCache();

    await expect(cache.read()).resolves.toBeNull();

    await cache.write(employee);
    await expect(cache.read()).resolves.toEqual(employee);

    await cache.clear();
    await expect(cache.read()).resolves.toBeNull();
  });
});
