/**
 * Who is signed in, for the whole app.
 *
 * The provider owns three things that have to agree with each other: the token
 * every later request carries, the employee that token belongs to, and the
 * permissions the app gates on. Keeping them in one place is what makes signing in
 * and signing out single events rather than a sequence a screen could half-perform.
 *
 * The token lives behind `TokenStore`, which is the platform keystore in the app and
 * memory in the tests. Where it sits is entirely that module's business; this one
 * decides only when it is read, written and forgotten.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { configureApi, type ApiClient } from '@/api';

import {
  authFailureFrom,
  createAuthApi,
  type AuthApi,
  type AuthFailure,
  type Credentials,
} from './auth-api';
import { resolveDeviceName } from './device-name';
import { noPermissions, type Permission, type PermissionSet } from './permissions';
import type { SessionUser } from './session-user';
import { createSecureTokenStore, type TokenStore } from './token-store';

/**
 * `restoring` is the first frame, before the store has been asked whether there is
 * a token. The navigator waits it out rather than flashing the login screen at an
 * employee who is already signed in.
 */
export type SessionStatus = 'restoring' | 'signedOut' | 'signedIn';

export type SignInOutcome = { readonly ok: true } | { readonly ok: false; failure: AuthFailure };

export type Session = {
  readonly status: SessionStatus;
  readonly user: SessionUser | null;
  /** What the server says this employee may do. Empty unless signed in. */
  readonly permissions: PermissionSet;
  /**
   * The gate every feature uses. Never a role name, and false whenever the app is
   * not certain — an unsigned-in session, or a payload with no permissions in it.
   */
  can(permission: Permission): boolean;
  signIn(credentials: Credentials): Promise<SignInOutcome>;
  signOut(): Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export type SessionProviderProps = {
  children: ReactNode;
  /** Injected in tests, which use the in-memory store rather than the keystore. */
  tokenStore?: TokenStore;
  authApi?: AuthApi;
  deviceName?: () => Promise<string>;
};

export function SessionProvider({
  children,
  tokenStore,
  authApi,
  deviceName = resolveDeviceName,
}: SessionProviderProps) {
  const store = useMemo(() => tokenStore ?? createSecureTokenStore(), [tokenStore]);
  const api = useMemo(() => authApi ?? createAuthApi(), [authApi]);

  const [status, setStatus] = useState<SessionStatus>('restoring');
  const [user, setUser] = useState<SessionUser | null>(null);

  // The token is read by the API client on every request, from a callback that
  // must not go stale, so it lives in a ref and the state above is only what the
  // UI renders from.
  const token = useRef<string | null>(null);

  const forget = useCallback(async () => {
    token.current = null;
    await store.clear();
    setUser(null);
    setStatus('signedOut');
  }, [store]);

  // Installed during render, not in an effect: effects run child-first, so a
  // screen that fires a request as it mounts would otherwise reach an
  // unconfigured client. `configureApi` is idempotent, and the ref keeps the
  // second render of a StrictMode double-invoke from replacing a live client.
  const clientRef = useRef<ApiClient | null>(null);
  clientRef.current ??= configureApi({
    getToken: () => token.current,
    // The server stopped accepting the token mid-session — expired, or the
    // employee was deactivated (PRD A7/A8). KMO-11 adds the notice; the session
    // itself has to end here either way.
    onSessionExpired: () => {
      void forget();
    },
  });

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        const stored = await store.read();

        if (stored === null || stored.length === 0) {
          throw new Error('No stored token');
        }

        token.current = stored;
        const restored = await api.fetchSessionUser(stored);

        if (!cancelled) {
          setUser(restored);
          setStatus('signedIn');
        }
      } catch {
        // A token the server no longer accepts, or none at all. Either way the
        // employee starts at the login screen rather than at a tab that 401s.
        token.current = null;
        await store.clear();

        if (!cancelled) {
          setUser(null);
          setStatus('signedOut');
        }
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, [api, store]);

  const signIn = useCallback(
    async (credentials: Credentials): Promise<SignInOutcome> => {
      try {
        const issued = await api.issueToken(credentials, await deviceName());

        // Stored before the user is read, so the token is not lost if that second
        // request fails — and cleared again below if the sign-in does not complete.
        token.current = issued;
        await store.write(issued);

        const signedIn = await api.fetchSessionUser(issued);

        // A new session re-arms the expiry announcement the previous one latched.
        clientRef.current?.resetSession();

        setUser(signedIn);
        setStatus('signedIn');

        return { ok: true };
      } catch (error) {
        await forget();

        return { ok: false, failure: authFailureFrom(error) };
      }
    },
    [api, deviceName, forget, store],
  );

  const permissions = user?.permissions ?? noPermissions;

  const session = useMemo<Session>(
    () => ({
      status,
      user,
      permissions,
      can: (permission: Permission) => permissions.has(permission),
      signIn,
      signOut: forget,
    }),
    [forget, permissions, signIn, status, user],
  );

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);

  if (session === null) {
    throw new Error('useSession must be used inside a SessionProvider');
  }

  return session;
}
