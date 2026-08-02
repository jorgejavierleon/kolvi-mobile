/**
 * Where the Sanctum token lives between launches.
 *
 * The token is a bearer credential to an employee's attendance record — anything
 * holding it can punch as them — so it goes in the platform keystore and nowhere
 * else: `expo-secure-store` is the Android keystore behind
 * EncryptedSharedPreferences, and the iOS keychain. Never AsyncStorage, never a
 * file, never a log line. `eslint.config.js` blocks the imports that would make
 * the first two possible; this module is what keeps the third true.
 *
 * The interface is deliberately three methods wide. `SessionProvider` owns when a
 * token is read, written and forgotten, and this module owns only where it sits, so
 * the whole persistence question is one file to audit.
 */

import * as SecureStore from 'expo-secure-store';

/**
 * Namespaced beside `kolvi.device-id`, and under the same key rules SecureStore
 * enforces: letters, digits, `.`, `-` and `_`.
 */
export const AUTH_TOKEN_KEY = 'kolvi.auth-token';

export type TokenStore = {
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  clear(): Promise<void>;
};

/**
 * The slice of `expo-secure-store` this module uses, injected in tests. Matches
 * `DeviceIdStore` in device-name.ts, one method wider.
 */
export type SecureTokenStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: SecureStore.SecureStoreOptions): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/**
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY` is iOS-only — Android ignores the option — and
 * it does two things there. The token is unreadable while the phone is locked, and
 * it is excluded from encrypted backups, so an iCloud restore onto a second handset
 * cannot bring an attendance credential along with it. That is the same reasoning
 * that puts the device id in the keychain rather than in app storage.
 */
const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * The store the app runs on.
 *
 * Every call degrades rather than throws, and degrading always means *less*
 * persistence, never other persistence. A keystore that refuses — secure hardware
 * unavailable, or an entry left undecryptable by a lock-screen change — costs the
 * employee a login at each launch; falling back to somewhere readable would cost
 * them the credential, so there is no fallback to fall back to.
 */
export function createSecureTokenStore(storage: SecureTokenStorage = SecureStore): TokenStore {
  return {
    read: async () => {
      try {
        return await storage.getItemAsync(AUTH_TOKEN_KEY);
      } catch {
        // A stored value that will not decrypt stays undecryptable, so leaving it
        // in place would fail this read on every launch from now on. Dropping it
        // costs nothing: an unreadable token is already worthless.
        await discard(storage);

        return null;
      }
    },

    write: async (token: string) => {
      try {
        await storage.setItemAsync(AUTH_TOKEN_KEY, token, KEYCHAIN_OPTIONS);
      } catch {
        // Swallowed on purpose. The caller has just signed the employee in and
        // holds the token in memory; the session works for this process and ends
        // with it. Rethrowing would turn a storage problem into a failed login.
      }
    },

    clear: () => discard(storage),
  };
}

/** Best effort by definition: there is nothing sensible to do about a keystore that will not delete. */
async function discard(storage: SecureTokenStorage): Promise<void> {
  try {
    await storage.deleteItemAsync(AUTH_TOKEN_KEY);
  } catch {
    // Nothing to report and nowhere to report it: a message naming this key is a
    // breadcrumb to the credential, and the token itself must never be logged.
  }
}

/**
 * In-memory only: the token is gone when the process is.
 *
 * What the tests mount with, so a suite never touches the keystore, and the shape
 * `createSecureTokenStore` degrades to when the platform has nowhere safe to write.
 */
export function createMemoryTokenStore(): TokenStore {
  let token: string | null = null;

  return {
    read: async () => token,
    write: async (value: string) => {
      token = value;
    },
    clear: async () => {
      token = null;
    },
  };
}
