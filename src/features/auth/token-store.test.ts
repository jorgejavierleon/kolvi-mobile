import * as SecureStore from 'expo-secure-store';

import {
  AUTH_TOKEN_KEY,
  createMemoryTokenStore,
  createSecureTokenStore,
  type SecureTokenStorage,
} from './token-store';

/**
 * The keystore itself is native, so the suite stubs it. What is being tested is the
 * contract this module keeps with it: which key, which options, and what happens on
 * every path where it refuses.
 */
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const TOKEN = '7|F5Ck0zqBqXQwTn2sLm9dVh3rPyJ1aWuE6NgH8bZt';

function fakeStorage(initial: string | null = null): SecureTokenStorage & {
  values: Map<string, string>;
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
} {
  const values = new Map<string, string>();
  if (initial !== null) {
    values.set(AUTH_TOKEN_KEY, initial);
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

/** A keystore that answers nothing: secure hardware gone, or an entry left undecryptable. */
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

/**
 * #2 — the token never reaches a log. Every console channel is watched for the whole
 * suite, so a stray warn added to any path below fails a test rather than shipping a
 * credential into logcat.
 */
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

describe('createSecureTokenStore', () => {
  // #1 — the store the app actually runs on is SecureStore, not something with a
  // SecureStore-shaped interface.
  it('reads and writes through expo-secure-store by default', async () => {
    const store = createSecureTokenStore();

    await store.write(TOKEN);
    await store.read();
    await store.clear();

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY, TOKEN, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
  });

  it('round-trips the token under its own key', async () => {
    const storage = fakeStorage();
    const store = createSecureTokenStore(storage);

    await store.write(TOKEN);

    await expect(store.read()).resolves.toBe(TOKEN);
    expect(storage.values.get(AUTH_TOKEN_KEY)).toBe(TOKEN);
  });

  it('writes it excluded from backups and unreadable while the device is locked', async () => {
    const storage = fakeStorage();

    await createSecureTokenStore(storage).write(TOKEN);

    expect(storage.setItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY, TOKEN, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });

  it('reads null when nothing has been stored', async () => {
    await expect(createSecureTokenStore(fakeStorage()).read()).resolves.toBeNull();
  });

  // #4 — the store half of clearing a session. The session half is in session.test.tsx.
  it('deletes the token from the keystore when the session is cleared', async () => {
    const storage = fakeStorage(TOKEN);
    const store = createSecureTokenStore(storage);

    await store.clear();

    expect(storage.deleteItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
    expect(storage.values.has(AUTH_TOKEN_KEY)).toBe(false);
    await expect(store.read()).resolves.toBeNull();
  });
});

/**
 * #5 — every one of these is a device whose keystore will not cooperate. The
 * behaviour is always the same: the call resolves, nothing is persisted anywhere
 * else, and the next launch therefore starts at the login screen.
 */
describe('when the keystore refuses', () => {
  it('lets the sign-in stand rather than failing it', async () => {
    const storage = refusingStorage();

    await expect(createSecureTokenStore(storage).write(TOKEN)).resolves.toBeUndefined();
    expect(storage.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('leaves nothing to restore, so the next launch asks for a login', async () => {
    const storage = refusingStorage();
    const store = createSecureTokenStore(storage);

    await store.write(TOKEN);

    await expect(store.read()).resolves.toBeNull();
  });

  it('drops an entry it cannot decrypt instead of failing on it every launch', async () => {
    const storage = fakeStorage(TOKEN);
    storage.getItemAsync.mockRejectedValue(new Error('could not decrypt'));
    const store = createSecureTokenStore(storage);

    await expect(store.read()).resolves.toBeNull();

    expect(storage.deleteItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
    expect(storage.values.has(AUTH_TOKEN_KEY)).toBe(false);
  });

  it('survives a delete it cannot perform', async () => {
    await expect(createSecureTokenStore(refusingStorage()).clear()).resolves.toBeUndefined();
  });
});

describe('createMemoryTokenStore', () => {
  it('holds the token for the process and forgets it on clear', async () => {
    const store = createMemoryTokenStore();

    await expect(store.read()).resolves.toBeNull();

    await store.write(TOKEN);
    await expect(store.read()).resolves.toBe(TOKEN);

    await store.clear();
    await expect(store.read()).resolves.toBeNull();
  });
});
