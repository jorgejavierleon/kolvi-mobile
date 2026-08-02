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
  permissions: parsePermissions(['ClockOwn:Mark', 'ViewOwn:Mark']),
};

const credentials = { email: 'employee@example.com', password: 'admin' };

function fakeAuthApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    issueToken: jest.fn(async () => 'tok_abc'),
    fetchSessionUser: jest.fn(async () => employee),
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
