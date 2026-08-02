/**
 * The name this installation gives its Sanctum token.
 *
 * `POST /api/sanctum/token` keys tokens by `device_name`, and `ams` deletes the
 * user's existing token of that name before issuing a new one. So the name is not
 * cosmetic: a name that changes between logins leaves a trail of live tokens for
 * one phone, and a name shared by two phones lets the second login silently revoke
 * the first. It has to be stable for the life of the install and unique to it.
 *
 * The id behind it lives in SecureStore — the Android keystore, the iOS keychain —
 * rather than in app storage, so a device backup restored onto a second handset
 * cannot bring it along and inherit the first handset's token.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * SecureStore keys allow letters, digits, `.`, `-` and `_`. Namespaced because
 * KMO-9 stores the token itself beside this.
 */
export const DEVICE_ID_KEY = 'kolvi.device-id';

/**
 * The slice of SecureStore this module uses. Injected in tests, and the seam KMO-9
 * reuses when the token joins the id in the same store.
 */
export type DeviceIdStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
};

let cached: Promise<string> | undefined;

/**
 * `Kolvi android 5f1c…` — what the employee will see if the web console ever lists
 * their devices, and what the server matches on.
 *
 * Memoised on the promise rather than on the value, so two screens asking at once
 * during startup share one SecureStore round trip instead of racing to generate two
 * ids and writing one over the other.
 */
export function resolveDeviceName(store: DeviceIdStore = SecureStore): Promise<string> {
  cached ??= loadDeviceId(store).then((id) => `Kolvi ${Platform.OS} ${id}`);

  return cached;
}

/**
 * Drops the in-process memo. For tests — it does not forget the stored id, and
 * signing out must not call it: the whole point is that the next login reuses the
 * same name.
 */
export function resetDeviceNameCache(): void {
  cached = undefined;
}

async function loadDeviceId(store: DeviceIdStore): Promise<string> {
  try {
    const stored = await store.getItemAsync(DEVICE_ID_KEY);

    if (stored !== null && stored.length > 0) {
      return stored;
    }

    const generated = Crypto.randomUUID();
    await store.setItemAsync(DEVICE_ID_KEY, generated);

    return generated;
  } catch {
    // A keystore that refuses to answer — reset after a lock-screen change, or a
    // device whose secure hardware is unavailable — must not be the reason an
    // employee cannot clock in. Login proceeds with a name that lasts as long as
    // the process; the cost is an extra token per launch, not a failed punch.
    return Crypto.randomUUID();
  }
}
