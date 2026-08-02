/**
 * Whether this employee turned biometric unlock on, and whether they have been
 * asked yet.
 *
 * Three states rather than a boolean, because "off" and "not asked" behave
 * differently: the offer is made once (#1) and an employee who said *Ahora no* is
 * not asked again on the next launch. A plain boolean cannot tell those apart and
 * would either nag forever or never offer at all.
 *
 * It sits in SecureStore beside the token. Not because a preference is a secret —
 * it is not — but because `eslint.config.js` blocks AsyncStorage and app-storage
 * files outright, and adding a second persistence mechanism to hold one enum would
 * mean the next person has a choice about where a credential goes. There is one
 * place things persist in this app, and this is it.
 */

import * as SecureStore from 'expo-secure-store';

/** Namespaced beside `kolvi.device-id` and `kolvi.auth-token`. */
export const UNLOCK_PREFERENCE_KEY = 'kolvi.biometric-unlock';

/** `unset` is "never asked"; the other two are an answer the employee gave. */
export type UnlockPreference = 'unset' | 'enabled' | 'disabled';

export type UnlockPreferenceStore = {
  read(): Promise<UnlockPreference>;
  write(preference: Exclude<UnlockPreference, 'unset'>): Promise<void>;
  /** Back to `unset`. Sign-out calls this, so the next employee on this phone is asked for themselves. */
  clear(): Promise<void>;
};

/** The slice of `expo-secure-store` this module uses, matching `SecureTokenStorage`. */
export type PreferenceStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export function createSecureUnlockPreferenceStore(
  storage: PreferenceStorage = SecureStore,
): UnlockPreferenceStore {
  return {
    read: async () => {
      try {
        const stored = await storage.getItemAsync(UNLOCK_PREFERENCE_KEY);

        // Anything unrecognised — a value from a future version, a half-written
        // entry — reads as `unset`. The failure mode is being asked once more,
        // which is the harmless direction to fail in.
        return stored === 'enabled' || stored === 'disabled' ? stored : 'unset';
      } catch {
        // A keystore that will not answer must not lock an employee out of their own
        // app. `unset` leaves the lock off and the offer pending, so the app stays
        // fully usable — the same degradation `token-store.ts` makes.
        return 'unset';
      }
    },

    write: async (preference) => {
      try {
        await storage.setItemAsync(UNLOCK_PREFERENCE_KEY, preference);
      } catch {
        // Swallowed, like the token write. The preference holds for this process;
        // the cost of losing it is being asked again next launch, and turning a
        // storage problem into a failed toggle would be worse.
      }
    },

    clear: async () => {
      try {
        await storage.deleteItemAsync(UNLOCK_PREFERENCE_KEY);
      } catch {
        // Nothing sensible to do about a keystore that will not delete a preference.
      }
    },
  };
}

/** In-memory, for tests. Mirrors `createMemoryTokenStore`. */
export function createMemoryUnlockPreferenceStore(
  initial: UnlockPreference = 'unset',
): UnlockPreferenceStore {
  let preference: UnlockPreference = initial;

  return {
    read: async () => preference,
    write: async (value) => {
      preference = value;
    },
    clear: async () => {
      preference = 'unset';
    },
  };
}
