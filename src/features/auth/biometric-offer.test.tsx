import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { es } from '@/i18n';

import type { AuthApi } from './auth-api';
import { BiometricOffer } from './biometric-offer';
import type { Biometrics, BiometricOutcome } from './biometrics';
import { LockProvider } from './lock';
import { parsePermissions } from './permissions';
import type { SessionUser } from './session-user';
import { SessionProvider } from './session';
import { createMemoryTokenStore } from './token-store';
import {
  createMemoryUnlockPreferenceStore,
  type UnlockPreference,
  type UnlockPreferenceStore,
} from './unlock-preference';

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

/** A gesture-navigation Android phone, so the sheet's pinned footer has an inset to clear. */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

type MountOptions = { biometrics?: Biometrics; preference?: UnlockPreference };

/** Signed in on a restored token — the state the offer is judged against. */
async function mountSignedIn({ biometrics = fakeBiometrics(), preference }: MountOptions = {}) {
  const tokenStore = createMemoryTokenStore();
  await tokenStore.write('tok_stored');

  const preferenceStore: UnlockPreferenceStore = createMemoryUnlockPreferenceStore(preference);

  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SessionProvider
        authApi={fakeAuthApi()}
        tokenStore={tokenStore}
        deviceName={async () => 'Kolvi test'}
      >
        <LockProvider biometrics={biometrics} preferenceStore={preferenceStore}>
          <BiometricOffer />
        </LockProvider>
      </SessionProvider>
    </SafeAreaProvider>,
  );

  // Let the session restore and the preference read settle.
  await act(async () => {});

  return { biometrics, preferenceStore };
}

describe('the biometric offer', () => {
  // KMO-10 #1.
  it('is made after login, and explains in Spanish what it does', async () => {
    await mountSignedIn();

    expect(await screen.findByText(es.security.offer.title)).toBeTruthy();
    expect(screen.getByText(es.security.offer.body)).toBeTruthy();
  });

  /**
   * The wording is the compliance surface. This is app unlock, not identification
   * (Res. 38 Art. 7g is satisfied by the password *plus* this, not by this), so the
   * copy must not tell an employee their fingerprint is what proves who punched.
   */
  it('does not describe itself as identifying the employee', async () => {
    await mountSignedIn();

    await screen.findByText(es.security.offer.title);

    expect(es.security.offer.body).not.toMatch(/identific|verific.*identidad/i);
    expect(es.security.offer.body).toMatch(/contraseña/);
  });

  it('offers both an accept and a decline', async () => {
    await mountSignedIn();

    expect(await screen.findByText(es.security.offer.enable)).toBeTruthy();
    expect(screen.getByText(es.security.offer.dismiss)).toBeTruthy();
  });

  // KMO-10 #4: on a phone with nothing enrolled there is nothing to offer.
  it('is not made on a phone with no enrolled biometric', async () => {
    await mountSignedIn({
      biometrics: fakeBiometrics({ isAvailable: jest.fn(async () => false) }),
    });

    expect(screen.queryByText(es.security.offer.title)).toBeNull();
  });

  it('is not made again once the employee has answered', async () => {
    await mountSignedIn({ preference: 'disabled' });

    expect(screen.queryByText(es.security.offer.title)).toBeNull();
  });

  it('turns the lock on behind a prompt, and closes', async () => {
    const { biometrics, preferenceStore } = await mountSignedIn();

    fireEvent.press(await screen.findByTestId('biometric-offer-enable'));

    await waitFor(async () => {
      await expect(preferenceStore.read()).resolves.toBe('enabled');
    });
    expect(biometrics.authenticate).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(es.security.offer.title)).toBeNull());
  });

  it('stays open and says why when the prompt was not passed', async () => {
    const biometrics = fakeBiometrics({ authenticate: jest.fn(async () => 'failed') });
    const { preferenceStore } = await mountSignedIn({ biometrics });

    fireEvent.press(await screen.findByTestId('biometric-offer-enable'));

    expect(await screen.findByTestId('biometric-offer-notice')).toBeTruthy();
    expect(screen.getByText(es.security.lock.failed)).toBeTruthy();
    await expect(preferenceStore.read()).resolves.toBe('unset');
  });

  it('records a decline, so the next launch does not ask again', async () => {
    const { preferenceStore } = await mountSignedIn();

    fireEvent.press(await screen.findByTestId('biometric-offer-dismiss'));

    await waitFor(async () => {
      await expect(preferenceStore.read()).resolves.toBe('disabled');
    });
  });

  it('treats a dismissed sheet as the same answer as Ahora no', async () => {
    const { preferenceStore } = await mountSignedIn();

    fireEvent.press(await screen.findByTestId('bottom-sheet-backdrop'));

    await waitFor(async () => {
      await expect(preferenceStore.read()).resolves.toBe('disabled');
    });
  });
});
