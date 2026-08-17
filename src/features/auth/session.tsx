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
 *
 * Since KMO-49, a fourth thing: whether the server actually said so. A cold start
 * with a live token and no signal restores `signedIn` off `SessionCache`'s last
 * confirmation rather than the login screen — docs/design-decisions.md §4.7 is the
 * decision record and `verified` on `Session` is how a screen tells the two apart.
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

import {
  configureApi,
  createConnectivitySource,
  isApiError,
  type ApiClient,
  type ConnectivitySource,
} from '@/api';
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
import { createSecureSessionCache, type SessionCache } from './session-cache';
import type { SessionUser } from './session-user';
import { createSecureTokenStore, type TokenStore } from './token-store';

/**
 * docs/design-decisions.md §4.7 D1 — how long a session runs on the last
 * confirmed `GET /api/v1/user` before it must reconfirm or end. Shared between
 * the cold-start restore and the background bound check below, so the two
 * enforce the same number by construction rather than by two constants staying
 * in sync.
 */
export const OFFLINE_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** How often a running-but-unverified session re-checks the bound above. */
const OFFLINE_BOUND_CHECK_INTERVAL_MS = 60_000;

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
  /**
   * Whether the server has confirmed this session, not merely the phone's own
   * memory of it (docs/design-decisions.md §4.7). Always `true` once signed in
   * the ordinary way; `false` only for a `signedIn` session restored from the
   * cache on a cold start that could not reach the server, until the next
   * confirmation succeeds or docs/design-decisions.md §4.7's 24 h bound ends it.
   * Meaningless while `status` is not `signedIn`.
   */
  readonly verified: boolean;
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
  /** Injected in tests, which use the in-memory cache rather than the keystore. */
  sessionCache?: SessionCache;
  /** Injected in tests; the app reads the phone (§4.7). */
  connectivitySource?: ConnectivitySource;
};

export function SessionProvider({
  children,
  tokenStore,
  authApi,
  deviceName = resolveDeviceName,
  sessionCache,
  connectivitySource,
}: SessionProviderProps) {
  const store = useMemo(() => tokenStore ?? createSecureTokenStore(), [tokenStore]);
  const api = useMemo(() => authApi ?? createAuthApi(), [authApi]);
  const cache = useMemo(() => sessionCache ?? createSecureSessionCache(), [sessionCache]);
  const connectivity = useMemo(
    () => connectivitySource ?? createConnectivitySource(),
    [connectivitySource],
  );

  const [status, setStatus] = useState<SessionStatus>('restoring');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ended, setEnded] = useState<SessionEnd | null>(null);
  const [verified, setVerified] = useState<boolean>(true);

  // The token is read by the API client on every request, from a callback that
  // must not go stale, so it lives in a ref and the state above is only what the
  // UI renders from.
  const token = useRef<string | null>(null);

  /**
   * When the current `user` was last confirmed by the server, off the device
   * clock — a trust window (§4.7), never a legal timestamp, and never sent
   * anywhere. A ref because the bound-check interval below reads it without
   * wanting to restart every time it moves. `0` is never read as a real value:
   * every path that sets `verified` to `false` sets this in the same breath,
   * and nothing consults it otherwise — `Date.now()` itself cannot seed it
   * here, since a render body may not call an impure function.
   */
  const verifiedAt = useRef<number>(0);

  /**
   * End the session and leave nothing of the employee behind (#5).
   *
   * Every field the app knows about an employee is either the token, derived
   * from `user`, or the session cache's own copy of both (§4.7) — so dropping
   * all three is what makes the data unreadable rather than merely unrendered.
   * Anything that starts caching beyond this has to be cleared from here too.
   */
  const forget = useCallback(
    async (end: SessionEnd | null) => {
      token.current = null;
      await store.clear();
      await cache.clear();
      setUser(null);
      setEnded(end);
      setVerified(true);
      setStatus('signedOut');
    },
    [store, cache],
  );

  /**
   * Record a server confirmation — the moment `verified` becomes (or stays)
   * true. Both halves matter: the ref is what the bound check and a later
   * offline restore measure against, and the cache is what makes that restore
   * possible at all on a cold start with no signal.
   */
  const persist = useCallback(
    async (confirmed: SessionUser): Promise<void> => {
      const now = Date.now();

      verifiedAt.current = now;
      await cache.write({ user: confirmed, verifiedAt: new Date(now).toISOString() });
    },
    [cache],
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
      const stored = await store.read();

      if (stored === null || stored.length === 0) {
        // Nothing to restore — the ordinary "never signed in" case, which says
        // nothing (KMO-11 #1). One exception (§4.7 D2/#5): a phone with no
        // signal cannot sign in either, since `POST /api/v1/sanctum/token` is
        // the only way to get a token, and an employee opening the app for the
        // first time at a dead site deserves that reason rather than a blank
        // form. `getState()` reads the OS, not a request — no round trip spent
        // finding this out.
        const offline = !(await connectivity.getState());

        if (!cancelled) {
          setUser(null);
          setEnded(offline ? { message: es.auth.signInNeedsConnection } : null);
          setStatus('signedOut');
        }

        return;
      }

      token.current = stored;

      try {
        const restored = await api.fetchSessionUser(stored);
        await persist(restored);

        if (!cancelled) {
          setUser(restored);
          setVerified(true);
          setStatus('signedIn');
        }
      } catch (error) {
        if (isApiError(error) && !error.isConnectivityFailure) {
          // The server actually answered, and the answer was no — a dead
          // token, same as before this ticket.
          token.current = null;
          await store.clear();
          await cache.clear();

          if (!cancelled) {
            setUser(null);
            setEnded(sessionEndFrom(error));
            setStatus('signedOut');
          }

          return;
        }

        // The request never reached the server. §4.7: fall back to the last
        // confirmation this phone has, within D1's 24 h — an unverifiable
        // token has not expired, and a basement with no signal is not a
        // reason to send the employee back to the login screen they cannot
        // usefully retry from either.
        const cached = await cache.read();
        const withinBound =
          cached !== null &&
          Date.now() - Date.parse(cached.verifiedAt) < OFFLINE_SESSION_LIFETIME_MS;

        if (withinBound) {
          verifiedAt.current = Date.parse(cached.verifiedAt);

          if (!cancelled) {
            setUser(cached.user);
            setVerified(false);
            setEnded(null);
            setStatus('signedIn');
          }

          return;
        }

        // Ends either way, but only one of these two is a fact this app is
        // entitled to state. A cache past its bound genuinely ran out the
        // clock on §4.7 D1 and says so. No cache at all means this token was
        // never confirmed online in the first place — `signIn` always writes
        // one, so a live token with nothing behind it is a token from before
        // this app cached anything, or a test that wrote one directly — and
        // that token has not been told anything by anyone, so neither is this
        // employee (KMO-11's original reasoning, unchanged for this case).
        token.current = null;
        await store.clear();
        await cache.clear();

        if (!cancelled) {
          setUser(null);
          setEnded(cached === null ? null : { message: es.auth.offlineSessionExpired });
          setStatus('signedOut');
        }
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, [api, store, cache, connectivity, persist]);

  /**
   * Keeps a running-but-unverified session honest (§4.7 D1/D2): tries to
   * reconfirm whenever the phone might be able to reach the server, and ends
   * the session if the bound elapses before one succeeds. Scoped to
   * `!verified` so it does nothing — no timer, no subscription — for the
   * overwhelming majority of sessions that never enter this state at all.
   */
  useEffect(() => {
    if (status !== 'signedIn' || verified) {
      return;
    }

    let cancelled = false;

    const reconfirm = async () => {
      if (token.current === null) {
        return;
      }

      try {
        const confirmed = await api.fetchSessionUser(token.current);
        await persist(confirmed);

        if (!cancelled) {
          setUser(confirmed);
          setVerified(true);
          setEnded(null);
        }
      } catch (error) {
        if (isApiError(error) && !error.isConnectivityFailure && !cancelled) {
          void forget({ message: es.auth.sessionExpired });
        }
        // A connectivity failure here means the retry was as unlucky as the
        // restore that started this: stay unverified and wait for the next
        // edge, or the bound below.
      }
    };

    const onOnline = (online: boolean): void => {
      if (online) {
        void reconfirm();
      }
    };

    void connectivity.getState().then(onOnline);
    const unsubscribe = connectivity.subscribe(onOnline);

    const boundCheck = setInterval(() => {
      if (Date.now() - verifiedAt.current >= OFFLINE_SESSION_LIFETIME_MS) {
        void forget({ message: es.auth.offlineSessionExpired });
      }
    }, OFFLINE_BOUND_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(boundCheck);
    };
  }, [status, verified, api, persist, forget, connectivity]);

  const signIn = useCallback(
    async (credentials: Credentials): Promise<SignInOutcome> => {
      try {
        const issued = await api.issueToken(credentials, await deviceName());

        // Stored before the user is read, so the token is not lost if that second
        // request fails — and cleared again below if the sign-in does not complete.
        token.current = issued;
        await store.write(issued);

        const signedIn = await api.fetchSessionUser(issued);
        await persist(signedIn);

        // A new session re-arms the expiry announcement the previous one latched.
        clientRef.current?.resetSession();

        setUser(signedIn);
        setVerified(true);
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
    [api, deviceName, forget, persist, store],
  );

  const permissions = user?.permissions ?? noPermissions;

  const session = useMemo<Session>(
    () => ({
      status,
      user,
      ended,
      verified,
      permissions,
      can: (permission: Permission) => permissions.has(permission),
      signIn,
      signOut,
    }),
    [ended, permissions, signIn, signOut, status, user, verified],
  );

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

/**
 * Whether a failed request is the server refusing this session, and what to say
 * about it.
 *
 * Only a 401. Every other server-answered failure still ends a *restore* here —
 * unchanged since KMO-11 — but says nothing about why, since only a dead token
 * means the session itself is over. A request that never reached the server at
 * all does not call this: `restore()`'s own branch on `isConnectivityFailure`
 * keeps it out, because a phone with no signal has not been told its session
 * expired by anyone (§4.7).
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
