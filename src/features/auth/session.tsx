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

import { configureApi, isApiError, type ApiClient } from '@/api';
import { es } from '@/i18n';

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

/**
 * What the login screen still has to say about the session that just ended.
 *
 * Usually nothing: an employee who never signed in, and one whose Cerrar sesión
 * did everything it promised, are both `null` — neither is owed an explanation for
 * a screen they expected (KMO-11 #1).
 *
 * Two cases produce one. The server refused the token, so the session ended
 * without the employee choosing it (KMO-11); or the employee chose it but the
 * revocation never reached the server, which leaves a fact about this phone that
 * outlives the session (KMO-12 #4).
 */
export type SessionEnd = {
  /** The Spanish sentence the login screen shows. */
  readonly message: string;
};

export type Session = {
  readonly status: SessionStatus;
  readonly user: SessionUser | null;
  /** Set when the server ended this session; cleared by the next sign-in. */
  readonly ended: SessionEnd | null;
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
  const [ended, setEnded] = useState<SessionEnd | null>(null);

  // The token is read by the API client on every request, from a callback that
  // must not go stale, so it lives in a ref and the state above is only what the
  // UI renders from.
  const token = useRef<string | null>(null);

  /**
   * End the session and leave nothing of the employee behind (#5).
   *
   * Every field the app knows about an employee is either the token or derived
   * from `user` — the name, the RUT, the permissions `can()` answers from — so
   * dropping both is what makes the data unreadable rather than merely unrendered.
   * Nothing else is cached today; anything that starts caching has to be cleared
   * from here too.
   */
  const forget = useCallback(
    async (end: SessionEnd | null) => {
      token.current = null;
      await store.clear();
      setUser(null);
      setEnded(end);
      setStatus('signedOut');
    },
    [store],
  );

  /**
   * `Cerrar sesión`.
   *
   * The revocation goes first and the local clear happens regardless (#1, #4).
   * That order is the whole point of the criterion: clearing local storage is not
   * signing out, because the token keeps working for anyone holding the phone, so
   * the server has to be told while the app still has a token to tell it with.
   *
   * Failing to reach the server does not keep the employee signed in. A phone that
   * cannot revoke is often exactly the phone someone wants to sign out of, and
   * refusing would leave the session, the token and the cached employee sitting on
   * a device its owner is trying to hand over. So the token is cleared here and the
   * login screen carries the part that is still true.
   */
  const signOut = useCallback(async () => {
    const revoking = token.current;
    const revoked = revoking === null ? true : await api.revokeToken(revoking);

    await forget(revoked ? null : { message: es.auth.signOut.notRevoked });
  }, [api, forget]);

  // Installed during render, not in an effect: effects run child-first, so a
  // screen that fires a request as it mounts would otherwise reach an
  // unconfigured client. `configureApi` is idempotent, and the ref keeps the
  // second render of a StrictMode double-invoke from replacing a live client.
  const clientRef = useRef<ApiClient | null>(null);
  clientRef.current ??= configureApi({
    getToken: () => token.current,
    // The server stopped accepting the token mid-session — expired, or the
    // employee was deactivated (PRD A7/A8). Both end the session here, and both
    // put the same sentence on the login screen: from this side they are one 401.
    onSessionExpired: () => {
      // #3, the half the transport latch cannot give. That latch collapses the
      // concurrent 401s of *one* client, and `auth-api` deliberately runs a
      // second one; the token being null is what makes a session end once no
      // matter how many clients announce it, and what keeps a 401 answering a
      // request made with no session at all from putting an expiry notice in
      // front of an employee who never had one.
      if (token.current === null) {
        return;
      }

      void forget({ message: es.auth.sessionExpired });
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
      } catch (error) {
        // A token the server no longer accepts, or none at all. Either way the
        // employee starts at the login screen rather than at a tab that 401s.
        token.current = null;
        await store.clear();

        if (!cancelled) {
          setUser(null);
          setEnded(sessionEndFrom(error));
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
        setEnded(null);
        setStatus('signedIn');

        return { ok: true };
      } catch (error) {
        // The notice goes as soon as the attempt is made, not when it succeeds:
        // the screen is already showing this failure, and leaving the previous
        // session's explanation above it would stack two reasons for one screen.
        await forget(null);

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
      ended,
      permissions,
      can: (permission: Permission) => permissions.has(permission),
      signIn,
      signOut,
    }),
    [ended, permissions, signIn, signOut, status, user],
  );

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

/**
 * Whether a failed request is the server refusing this session, and what to say
 * about it.
 *
 * Only a 401. A stored token that could not be checked because the phone has no
 * signal has not expired, and telling an employee in a warehouse basement that
 * their session ended would be the app inventing a fact — KMO-49 decides what
 * that case should do instead of signing out.
 */
function sessionEndFrom(error: unknown): SessionEnd | null {
  return isApiError(error) && error.kind === 'unauthorized'
    ? { message: es.auth.sessionExpired }
    : null;
}

export function useSession(): Session {
  const session = useContext(SessionContext);

  if (session === null) {
    throw new Error('useSession must be used inside a SessionProvider');
  }

  return session;
}
