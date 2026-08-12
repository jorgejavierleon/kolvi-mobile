import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { es } from '@/i18n';

import type { AuthApi } from './auth-api';
import type { Biometrics, BiometricOutcome } from './biometrics';
import { LockProvider } from './lock';
import { LockScreen } from './lock-screen';
import { parsePermissions } from './permissions';
import type { SessionUser } from './session-user';
import { SessionProvider } from './session';
import { createMemoryTokenStore, type TokenStore } from './token-store';
import { createMemoryUnlockPreferenceStore } from './unlock-preference';

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
  permissions: parsePermissions(['ClockOwn:Mark']),
};

function fakeAuthApi(): AuthApi {
  return {
    issueToken: jest.fn(async () => 'tok_abc'),
    fetchSessionUser: jest.fn(async () => employee),
    revokeToken: jest.fn(async () => true),
  };
}

function fakeBiometrics(overrides: Partial<Biometrics> = {}): Biometrics {
  return {
    isAvailable: jest.fn(async () => true),
    authenticate: jest.fn(async (): Promise<BiometricOutcome> => 'success'),
    ...overrides,
  };
}

/** The screen as it appears in the app: signed in, behind the lock. */
async function mountLocked(biometrics: Biometrics = fakeBiometrics()) {
  const tokenStore: TokenStore = createMemoryTokenStore();
  await tokenStore.write('tok_stored');

  await render(
    <SessionProvider
      authApi={fakeAuthApi()}
      tokenStore={tokenStore}
      deviceName={async () => 'Kolvi test'}
    >
      <LockProvider
        biometrics={biometrics}
        preferenceStore={createMemoryUnlockPreferenceStore('enabled')}
      >
        <LockScreen />
      </LockProvider>
    </SessionProvider>,
  );

  await screen.findByTestId('lock-screen');

  return { biometrics, tokenStore };
}

describe('the lock screen', () => {
  it('says in Spanish that the app is locked and what opens it', async () => {
    await mountLocked();

    expect(await screen.findByText(es.security.lock.title)).toBeTruthy();
    expect(screen.getByText(es.security.lock.body)).toBeTruthy();
  });

  it('raises the prompt as soon as the app is in front of the employee', async () => {
    const { biometrics } = await mountLocked();

    // Not on mount — the lock latches while the app is in the background, and a
    // prompt raised there is one the employee never sees.
    await waitFor(() => expect(biometrics.authenticate).toHaveBeenCalled());
  });

  it('offers exactly two ways off it, and neither is free', async () => {
    await mountLocked();

    expect(await screen.findByTestId('lock-unlock')).toBeTruthy();
    expect(screen.getByTestId('lock-password')).toBeTruthy();
    expect(screen.getByText(es.security.lock.usePassword)).toBeTruthy();
  });

  // KMO-10 #3.
  it('explains a failed attempt without dropping the lock', async () => {
    const biometrics = fakeBiometrics({ authenticate: jest.fn(async () => 'failed') });
    await mountLocked(biometrics);

    expect(await screen.findByText(es.security.lock.failed)).toBeTruthy();
    // Still here. Nothing behind it was rendered.
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
  });

  it('does not tell an employee who cancelled that they were not recognised', async () => {
    const biometrics = fakeBiometrics({ authenticate: jest.fn(async () => 'cancelled') });
    await mountLocked(biometrics);

    expect(await screen.findByText(es.security.lock.cancelled)).toBeTruthy();
    expect(screen.queryByText(es.security.lock.failed)).toBeNull();
  });

  it('lets them try again after a failure', async () => {
    const authenticate = jest.fn(async (): Promise<BiometricOutcome> => 'failed');
    await mountLocked(fakeBiometrics({ authenticate }));

    await screen.findByText(es.security.lock.failed);
    const before = authenticate.mock.calls.length;

    fireEvent.press(screen.getByTestId('lock-unlock'));

    await waitFor(() => expect(authenticate.mock.calls.length).toBeGreaterThan(before));
  });

  /**
   * KMO-10 #4's other edge: the employee turned the lock on and later removed the
   * fingerprint from the phone. Offering a button that cannot succeed would strand
   * them, so the screen drops to the password route and says why.
   */
  it('hides the biometric button when the phone no longer has an enrolled biometric', async () => {
    const biometrics = fakeBiometrics({ isAvailable: jest.fn(async () => false) });
    await mountLocked(biometrics);

    await screen.findByTestId('lock-screen');

    expect(screen.queryByTestId('lock-unlock')).toBeNull();
    expect(screen.getByTestId('lock-password')).toBeTruthy();
    expect(screen.getByText(es.permissions.biometrics.unavailable)).toBeTruthy();
    expect(biometrics.authenticate).not.toHaveBeenCalled();
  });

  /**
   * The password route is a full re-authentication, not a second password check
   * invented here: it clears the local session so the navigator lands on KMO-8's
   * login screen. Which is also why the stored token must be gone afterwards.
   */
  it('clears the session when the employee chooses the password instead', async () => {
    const { tokenStore } = await mountLocked();

    fireEvent.press(await screen.findByTestId('lock-password'));

    await waitFor(async () => {
      await expect(tokenStore.read()).resolves.toBeNull();
    });
  });
});
