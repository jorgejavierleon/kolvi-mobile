import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { ApiError, api } from '@/api';
import { es } from '@/i18n';

import type { AuthApi } from './auth-api';
import { parsePermissions } from './permissions';
import type { SessionUser } from './session-user';
import { SessionProvider, useSession } from './session';
import { createMemoryTokenStore, type TokenStore } from './token-store';

const employee: SessionUser = {
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
};

const credentials = { email: 'employee@example.com', password: 'admin' };

function fakeAuthApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    issueToken: jest.fn(async () => 'tok_abc'),
    fetchSessionUser: jest.fn(async () => employee),
    revokeToken: jest.fn(async () => true),
    ...overrides,
  };
}

type MountOptions = { authApi?: AuthApi; tokenStore?: TokenStore };

async function mount(options: MountOptions = {}) {
  const authApi = options.authApi ?? fakeAuthApi();
  const tokenStore = options.tokenStore ?? createMemoryTokenStore();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider
      authApi={authApi}
      tokenStore={tokenStore}
      deviceName={async () => 'Kolvi test'}
    >
      {children}
    </SessionProvider>
  );

  const { result } = await renderHook(() => useSession(), { wrapper });

  return { result, authApi, tokenStore };
}

/** Mounted and past the restore pass, which is where every test but the first starts. */
async function mountSignedOut(options: MountOptions = {}) {
  const mounted = await mount(options);
  await waitFor(() => expect(mounted.result.current.status).toBe('signedOut'));

  return mounted;
}

describe('restoring', () => {
  // The navigator holds the splash up while this is the answer, so it has to be
  // the answer until the store has actually said something.
  it('stays restoring while the store is still being read', async () => {
    const tokenStore: TokenStore = {
      read: () => new Promise<string | null>(() => {}),
      write: async () => {},
      clear: async () => {},
    };

    const { result } = await mount({ tokenStore });

    expect(result.current.status).toBe('restoring');
  });

  it('settles signed out with an empty store', async () => {
    const { result } = await mount();

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.user).toBeNull();
  });

  it('signs the employee back in from a stored token', async () => {
    const tokenStore = createMemoryTokenStore();
    await tokenStore.write('tok_stored');
    const authApi = fakeAuthApi();

    const { result } = await mount({ authApi, tokenStore });

    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(authApi.fetchSessionUser).toHaveBeenCalledWith('tok_stored');
    expect(result.current.user).toEqual(employee);
  });

  it('discards a stored token the server no longer accepts', async () => {
    const tokenStore = createMemoryTokenStore();
    await tokenStore.write('tok_expired');
    const authApi = fakeAuthApi({
      fetchSessionUser: jest.fn(async () => {
        throw new ApiError({ kind: 'unauthorized', status: 401 });
      }),
    });

    const { result } = await mount({ authApi, tokenStore });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    await expect(tokenStore.read()).resolves.toBeNull();
  });
});

describe('signIn', () => {
  it('exchanges the credentials for a token and reads the employee', async () => {
    const { result, authApi, tokenStore } = await mountSignedOut();

    const outcome = await act(() => result.current.signIn(credentials));

    expect(outcome).toEqual({ ok: true });
    expect(authApi.issueToken).toHaveBeenCalledWith(credentials, 'Kolvi test');
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.user).toEqual(employee);
    await expect(tokenStore.read()).resolves.toBe('tok_abc');
  });

  // #4 — the server's own sentence reaches the caller untouched.
  it('reports a rejection with the message the server sent', async () => {
    const rejected = 'Esta cuenta está inactiva.';
    const authApi = fakeAuthApi({
      issueToken: jest.fn(async () => {
        throw new ApiError({
          kind: 'validation',
          status: 422,
          serverMessage: rejected,
          fieldErrors: { email: [rejected] },
        });
      }),
    });
    const { result } = await mountSignedOut({ authApi });

    const outcome = await act(() => result.current.signIn(credentials));

    expect(outcome).toEqual({ ok: false, failure: { kind: 'rejected', message: rejected } });

    expect(result.current.status).toBe('signedOut');
  });

  // #5 — a failure that never reached the server is reported as such.
  it('reports a connectivity failure as connectivity', async () => {
    const authApi = fakeAuthApi({
      issueToken: jest.fn(async () => {
        throw new ApiError({ kind: 'network' });
      }),
    });
    const { result } = await mountSignedOut({ authApi });

    const outcome = await act(() => result.current.signIn(credentials));

    expect(outcome).toEqual({
      ok: false,
      failure: { kind: 'connectivity', message: es.errors.network },
    });
  });

  it('leaves no token behind when the user request fails after the token was issued', async () => {
    const authApi = fakeAuthApi({
      fetchSessionUser: jest.fn(async () => {
        throw new ApiError({ kind: 'server', status: 500 });
      }),
    });
    const { result, tokenStore } = await mountSignedOut({ authApi });

    const outcome = await act(() => result.current.signIn(credentials));

    expect(outcome.ok).toBe(false);
    expect(result.current.status).toBe('signedOut');
    await expect(tokenStore.read()).resolves.toBeNull();
  });

  it('hands the token to the app-wide API client once signed in', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl as unknown as typeof globalThis.fetch;

    try {
      const { result } = await mountSignedOut();
      await act(() => result.current.signIn(credentials));

      await api.get('/me/today');

      const headers = (fetchImpl.mock.calls.at(-1)?.[1] as RequestInit).headers as Record<
        string,
        string
      >;
      expect(headers.Authorization).toBe('Bearer tok_abc');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('signOut', () => {
  it('clears the session and the stored token', async () => {
    const { result, tokenStore } = await mountSignedOut();
    await act(() => result.current.signIn(credentials));
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(() => result.current.signOut());

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.user).toBeNull();
    await expect(tokenStore.read()).resolves.toBeNull();
  });

  // The employee pressed the button. They know why they are looking at the login
  // screen, and telling them their session ended would read as something going
  // wrong with the thing they just asked for.
  it('leaves no notice behind, because the employee did it deliberately', async () => {
    const { result } = await mountSignedOut();
    await act(() => result.current.signIn(credentials));
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(() => result.current.signOut());

    expect(result.current.ended).toBeNull();
  });

  // KMO-12 #1, and the reason the criterion says "before": once the token is out
  // of the keystore there is nothing left to authenticate the revocation with, so
  // an order that cleared first could never revoke at all.
  it('revokes the token on the server before clearing it locally', async () => {
    const order: string[] = [];
    const tokenStore = createMemoryTokenStore();
    const authApi = fakeAuthApi({
      revokeToken: jest.fn(async (token: string) => {
        order.push(`revoke ${token}`);
        return true;
      }),
    });
    const recording: TokenStore = {
      ...tokenStore,
      clear: async () => {
        order.push('clear');
        await tokenStore.clear();
      },
    };

    const { result } = await mountSignedOut({ authApi, tokenStore: recording });
    await act(() => result.current.signIn(credentials));
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    // The restore pass clears an empty store on the way to `signedOut`; only what
    // the sign-out itself does is the subject here.
    order.length = 0;

    await act(() => result.current.signOut());

    expect(order).toEqual(['revoke tok_abc', 'clear']);
  });

  // #4. The employee is signing out of a phone; a server that cannot be reached
  // is not a reason to leave a live token sitting on it.
  it('clears everything even when the revocation never reached the server', async () => {
    const authApi = fakeAuthApi({ revokeToken: jest.fn(async () => false) });
    const { result, tokenStore } = await mountSignedOut({ authApi });
    await act(() => result.current.signIn(credentials));
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(() => result.current.signOut());

    expect(result.current.status).toBe('signedOut');
    expect(result.current.user).toBeNull();
    await expect(tokenStore.read()).resolves.toBeNull();
  });

  it('says the token stays active until the phone reconnects', async () => {
    const authApi = fakeAuthApi({ revokeToken: jest.fn(async () => false) });
    const { result } = await mountSignedOut({ authApi });
    await act(() => result.current.signIn(credentials));
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(() => result.current.signOut());

    expect(result.current.ended?.message).toBe(es.auth.signOut.notRevoked);
  });

  // Nothing to revoke and no server to ask: the lock screen's "Ingresar con
  // contraseña" reaches this on a session that failed to restore.
  it('does not call the server when there is no token to revoke', async () => {
    const authApi = fakeAuthApi();
    const { result } = await mountSignedOut({ authApi });

    await act(() => result.current.signOut());

    expect(authApi.revokeToken).not.toHaveBeenCalled();
    expect(result.current.ended).toBeNull();
  });
});

/**
 * KMO-11. The 401 path, which is the same path whether the token expired or the
 * employee was deactivated behind it (PRD A7/A8) — from this side both are one
 * status code with an untranslated body, and the difference is announced by the
 * server's own Spanish at the next sign-in attempt.
 */
describe('a session the server ends', () => {
  // Installed before the provider mounts, because `configureApi` captures `fetch`
  // when it builds the client and never looks at the global again.
  const originalFetch = globalThis.fetch;
  let answer: unknown = null;

  beforeEach(() => {
    globalThis.fetch = (async () => answer) as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /**
   * A 401 to whatever the app asks for next, on the app-wide client. Inside
   * `act`, because the session ends from the response handler rather than from
   * anything the test called directly.
   */
  async function withUnauthorizedServer(body: unknown, run: () => Promise<void>): Promise<void> {
    answer = { ok: false, status: 401, text: async () => JSON.stringify(body) };

    await act(run);
  }

  /** Signed in through the provider, which is what arms the app-wide client. */
  async function mountSignedIn(options: MountOptions = {}) {
    const mounted = await mountSignedOut(options);
    await act(() => mounted.result.current.signIn(credentials));
    await waitFor(() => expect(mounted.result.current.status).toBe('signedIn'));

    return mounted;
  }

  // #1 — the token goes, and the employee is told why in Spanish rather than
  // being dropped on the login screen with no explanation.
  it('clears the token and explains itself when a request comes back 401', async () => {
    const { result, tokenStore } = await mountSignedIn();

    await withUnauthorizedServer({ message: 'Unauthenticated.' }, async () => {
      await expect(api.get('/me/today')).rejects.toBeInstanceOf(ApiError);
    });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.ended).toEqual({ message: es.auth.sessionExpired });
    await expect(tokenStore.read()).resolves.toBeNull();
  });

  // #1 again, and the reason the sentence is not the server's. Laravel's guard
  // answers a dead token with an untranslated `Unauthenticated.`, and Res. 38
  // Art. 5 does not stop applying because a string arrived over HTTP.
  it('never puts the server 401 body in front of the employee', async () => {
    const { result } = await mountSignedIn();

    await withUnauthorizedServer({ message: 'Unauthenticated.' }, async () => {
      await expect(api.get('/me/today')).rejects.toBeInstanceOf(ApiError);
    });

    await waitFor(() => expect(result.current.ended).not.toBeNull());
    expect(result.current.ended?.message).not.toMatch(/Unauthenticated/);
  });

  // #5 — nothing about the employee is left readable. Every field the app holds
  // is the token or comes off `user`, so this is the whole of it until something
  // starts caching.
  it('leaves no employee data behind', async () => {
    const { result, tokenStore } = await mountSignedIn();
    expect(result.current.user).toEqual(employee);

    await withUnauthorizedServer({}, async () => {
      await expect(api.get('/me/today')).rejects.toBeInstanceOf(ApiError);
    });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.user).toBeNull();
    expect(result.current.permissions.size).toBe(0);
    expect(result.current.can('ClockOwn:Mark')).toBe(false);
    await expect(tokenStore.read()).resolves.toBeNull();
  });

  // #3 — opening the app fires several requests at once and they come back 401
  // together. One sign-out, one notice: `store.clear` counts the transitions
  // because the session cannot end without going through it.
  it('ends once across concurrent 401s', async () => {
    const memory = createMemoryTokenStore();
    const tokenStore: TokenStore = { ...memory, clear: jest.fn(memory.clear) };
    const { result } = await mountSignedIn({ tokenStore });
    (tokenStore.clear as jest.Mock).mockClear();

    await withUnauthorizedServer({}, async () => {
      const answers = await Promise.allSettled([
        api.get('/me/today'),
        api.get('/me/shifts/upcoming'),
        api.get('/me/documents'),
      ]);

      // Each caller still learns its own request failed; only the session
      // announcement is collapsed.
      expect(answers.map((answer) => answer.status)).toEqual(['rejected', 'rejected', 'rejected']);
    });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(tokenStore.clear).toHaveBeenCalledTimes(1);
    expect(result.current.ended).toEqual({ message: es.auth.sessionExpired });
  });

  // A 401 answering a request made with no token at all is not a session ending.
  // Without this guard the login screen would tell an employee who never signed
  // in that their session expired.
  it('raises no notice when there was no session to lose', async () => {
    const { result } = await mountSignedOut();

    await withUnauthorizedServer({}, async () => {
      await expect(api.get('/me/today')).rejects.toBeInstanceOf(ApiError);
    });

    expect(result.current.status).toBe('signedOut');
    expect(result.current.ended).toBeNull();
  });

  it('clears the notice once the employee signs in again', async () => {
    const { result } = await mountSignedIn();

    await withUnauthorizedServer({}, async () => {
      await expect(api.get('/me/today')).rejects.toBeInstanceOf(ApiError);
    });
    await waitFor(() => expect(result.current.ended).not.toBeNull());

    await act(() => result.current.signIn(credentials));

    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.ended).toBeNull();
  });

  // The restore call is a request like any other, and today it is the only 401 an
  // employee can actually reach — see flows/kmo-11-session-expiry.yaml.
  it('explains a stored token the server refuses on cold start', async () => {
    const tokenStore = createMemoryTokenStore();
    await tokenStore.write('tok_revoked');
    const authApi = fakeAuthApi({
      fetchSessionUser: jest.fn(async () => {
        throw new ApiError({ kind: 'unauthorized', status: 401 });
      }),
    });

    const { result } = await mount({ authApi, tokenStore });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.ended).toEqual({ message: es.auth.sessionExpired });
  });

  // The opposite case, and the one that matters in a warehouse basement: a token
  // that could not be checked has not expired, and saying so would be the app
  // inventing a fact. KMO-49 decides whether this should sign out at all.
  it('says nothing about a stored token it could not check', async () => {
    const tokenStore = createMemoryTokenStore();
    await tokenStore.write('tok_unchecked');
    const authApi = fakeAuthApi({
      fetchSessionUser: jest.fn(async () => {
        throw new ApiError({ kind: 'network' });
      }),
    });

    const { result } = await mount({ authApi, tokenStore });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.ended).toBeNull();
  });

  it('says nothing on a launch that simply had no token', async () => {
    const { result } = await mountSignedOut();

    expect(result.current.ended).toBeNull();
  });
});

describe('can', () => {
  // #8 — the gate is on the permission the server reported, never on a role.
  it('opens only for a permission the employee holds', async () => {
    const { result } = await mountSignedOut();
    await act(() => result.current.signIn(credentials));
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    expect(result.current.can('ClockOwn:Mark')).toBe(true);
    expect(result.current.can('ViewOwn:Mark')).toBe(true);
    expect(result.current.can('SignOwn:Document')).toBe(false);
  });

  it('fails closed when the payload reports no permissions at all', async () => {
    const authApi = fakeAuthApi({
      fetchSessionUser: jest.fn(async () => ({ ...employee, permissions: parsePermissions([]) })),
    });
    const { result } = await mountSignedOut({ authApi });
    await act(() => result.current.signIn(credentials));
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    expect(result.current.can('ClockOwn:Mark')).toBe(false);
  });

  it('fails closed while signed out', async () => {
    const { result } = await mountSignedOut();

    expect(result.current.can('ClockOwn:Mark')).toBe(false);
    expect(result.current.permissions.size).toBe(0);
  });
});

describe('useSession', () => {
  // A screen that reads the session outside the provider would silently see a
  // signed-out app rather than a broken one, and would render as if nobody were
  // logged in on a phone where somebody is.
  it('refuses to be used outside a provider', async () => {
    function Probe() {
      try {
        useSession();

        return <Text>no error</Text>;
      } catch (error) {
        return <Text>{(error as Error).message}</Text>;
      }
    }

    await render(<Probe />);

    expect(screen.getByText(/SessionProvider/)).toBeOnTheScreen();
  });
});
