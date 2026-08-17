/**
 * The last confirmed employee, for the one moment the token store cannot cover
 * on its own: a cold start with a live token and no way to ask the server who
 * it belongs to (KMO-49).
 *
 * `token-store.ts` says whether this phone is still authorised; it says nothing
 * about who that is or what they may do, and both of those come from the same
 * `GET /api/v1/user` call that a cold start with no signal cannot make. Without
 * this cache, that call failing for any reason — dead token or dead radio —
 * looks identical to `session.tsx`, and both have signed the employee out since
 * KMO-8. This module is what lets the two be told apart: whatever the server
 * said the last time it *did* answer, kept beside the moment it said it, so an
 * unverified restore has a `SessionUser` to render the punch screen with and a
 * `verifiedAt` to measure docs/design-decisions.md §4.7's 24 h bound from.
 *
 * Employee PII — name, RUT, permissions — so it lives in SecureStore beside the
 * token rather than anywhere a backup or a file browser could read it, and
 * `forget()` clears both together.
 */

import * as SecureStore from 'expo-secure-store';

import { parsePermissions } from './permissions';
import type { SessionUser } from './session-user';

export const SESSION_CACHE_KEY = 'kolvi.session-cache';

/** What was last confirmed, and when. */
export type CachedSession = {
  readonly user: SessionUser;
  /** An ISO instant off the device clock — a trust window, never a legal timestamp. */
  readonly verifiedAt: string;
};

export type SessionCache = {
  read(): Promise<CachedSession | null>;
  write(session: CachedSession): Promise<void>;
  clear(): Promise<void>;
};

/** The slice of `expo-secure-store` this module uses, injected in tests. */
export type SecureCacheStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: SecureStore.SecureStoreOptions): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * The cache the app runs on. Degrades the same direction `token-store.ts`
 * does: a keystore that will not cooperate costs the employee the offline
 * fallback, never a fallback to somewhere less safe. A write that fails is
 * swallowed for the same reason `token-store.ts`'s is — the session works for
 * this process regardless, and only the *next* cold start loses the cushion.
 */
export function createSecureSessionCache(storage: SecureCacheStorage = SecureStore): SessionCache {
  return {
    read: async () => {
      let raw: string | null;

      try {
        raw = await storage.getItemAsync(SESSION_CACHE_KEY);
      } catch {
        await discard(storage);

        return null;
      }

      // `undefined` alongside the declared `null` — an unmocked native module
      // under Jest answers a call it has no implementation for with `undefined`
      // rather than honouring the real module's `string | null` contract, and
      // the read path needs to survive that the same way it survives every
      // other way this value can fail to be a string.
      if (raw === null || raw === undefined || raw.length === 0) {
        return null;
      }

      const parsed = parseCachedSession(raw);

      if (parsed === null) {
        // A value that will not parse stays unparseable, the same reasoning
        // `token-store.ts` gives for a value that will not decrypt.
        await discard(storage);
      }

      return parsed;
    },

    write: async (session) => {
      try {
        await storage.setItemAsync(SESSION_CACHE_KEY, serialize(session), KEYCHAIN_OPTIONS);
      } catch {
        // Swallowed on purpose, like `token-store.ts`'s write: a storage problem
        // here must not fail the sign-in or the restore that is already live.
      }
    },

    clear: () => discard(storage),
  };
}

async function discard(storage: SecureCacheStorage): Promise<void> {
  try {
    await storage.deleteItemAsync(SESSION_CACHE_KEY);
  } catch {
    // Nothing sensible to do about a keystore that will not delete.
  }
}

function serialize(session: CachedSession): string {
  return JSON.stringify({
    user: { ...session.user, permissions: [...session.user.permissions] },
    verifiedAt: session.verifiedAt,
  });
}

/**
 * Round-trip only. This module is the only writer, so reading its own JSON
 * back needs a shape guard against a corrupted or half-written entry, not a
 * parser for a payload some other system might send — that is `session-user
 * .ts`'s job, for the wire shape, which this is not.
 */
function parseCachedSession(raw: string): CachedSession | null {
  try {
    const value: unknown = JSON.parse(raw);

    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const { user, verifiedAt } = value as Record<string, unknown>;

    if (typeof verifiedAt !== 'string' || typeof user !== 'object' || user === null) {
      return null;
    }

    const record = user as Record<string, unknown>;
    const { id, name, email } = record;

    if (typeof id !== 'number' || typeof name !== 'string' || typeof email !== 'string') {
      return null;
    }

    return {
      verifiedAt,
      user: {
        id,
        name,
        firstName: nullableString(record.firstName),
        email,
        rut: nullableString(record.rut),
        position: nullableString(record.position),
        premise: nullableString(record.premise),
        personalEmail: nullableString(record.personalEmail),
        phone: nullableString(record.phone),
        supervisor: nullableString(record.supervisor),
        contractStartDate: nullableString(record.contractStartDate),
        permissions: parsePermissions(record.permissions),
      },
    };
  } catch {
    return null;
  }
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** In-memory only, for tests — the shape `createSecureSessionCache` degrades to
 * when the platform has nowhere safe to write. */
export function createMemorySessionCache(): SessionCache {
  let cached: CachedSession | null = null;

  return {
    read: async () => cached,
    write: async (session) => {
      cached = session;
    },
    clear: async () => {
      cached = null;
    },
  };
}
