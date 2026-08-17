import { render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError, type ConnectivitySource } from '@/api';
import { es } from '@/i18n';

import type { AuthApi } from './auth-api';
import { parsePermissions } from './permissions';
import { SessionProvider } from './session';
import { createMemorySessionCache } from './session-cache';
import type { SessionUser } from './session-user';
import { createMemoryTokenStore } from './token-store';
import { UnverifiedSessionBanner } from './unverified-session-banner';

const employee: SessionUser = {
  id: 3,
  name: 'Empleado Demo',
  firstName: 'Empleado',
  email: 'employee@example.com',
  rut: null,
  position: null,
  premise: null,
  personalEmail: null,
  phone: null,
  supervisor: null,
  contractStartDate: null,
  permissions: parsePermissions(['ClockOwn:Mark']),
};

function fakeConnectivity(online = true): ConnectivitySource {
  return {
    getState: async () => online,
    subscribe: () => () => {},
  };
}

async function renderUnverified() {
  const tokenStore = createMemoryTokenStore();
  await tokenStore.write('tok_cached');
  const sessionCache = createMemorySessionCache();
  await sessionCache.write({ user: employee, verifiedAt: new Date().toISOString() });
  const authApi: AuthApi = {
    issueToken: jest.fn(async () => 'tok_abc'),
    fetchSessionUser: jest.fn(async () => {
      throw new ApiError({ kind: 'network' });
    }),
    revokeToken: jest.fn(async () => true),
  };

  await render(<UnverifiedSessionBanner />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <SessionProvider
        authApi={authApi}
        tokenStore={tokenStore}
        sessionCache={sessionCache}
        connectivitySource={fakeConnectivity(false)}
        deviceName={async () => 'Kolvi test'}
      >
        {children}
      </SessionProvider>
    ),
  });
}

async function renderVerified() {
  const tokenStore = createMemoryTokenStore();
  await tokenStore.write('tok_live');
  const authApi: AuthApi = {
    issueToken: jest.fn(async () => 'tok_abc'),
    fetchSessionUser: jest.fn(async () => employee),
    revokeToken: jest.fn(async () => true),
  };

  await render(<UnverifiedSessionBanner />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <SessionProvider
        authApi={authApi}
        tokenStore={tokenStore}
        sessionCache={createMemorySessionCache()}
        deviceName={async () => 'Kolvi test'}
      >
        {children}
      </SessionProvider>
    ),
  });
}

describe('UnverifiedSessionBanner', () => {
  it('shows nothing for an ordinary, confirmed session', async () => {
    await renderVerified();

    await waitFor(() => expect(screen.queryByTestId('unverified-session-banner')).toBeNull());
  });

  it('shows nothing while signed out', async () => {
    await render(<UnverifiedSessionBanner />, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SessionProvider
          tokenStore={createMemoryTokenStore()}
          sessionCache={createMemorySessionCache()}
          deviceName={async () => 'Kolvi test'}
        >
          {children}
        </SessionProvider>
      ),
    });

    expect(screen.queryByTestId('unverified-session-banner')).toBeNull();
  });

  // #3 — a signed-in session restored from the cache, not yet reconfirmed.
  it('tells the employee the session could not be confirmed', async () => {
    await renderUnverified();

    await waitFor(() => expect(screen.getByTestId('unverified-session-banner')).toBeTruthy());
    expect(screen.getByText(es.auth.unverifiedSession)).toBeTruthy();
  });
});
