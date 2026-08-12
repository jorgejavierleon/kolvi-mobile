import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { es } from '@/i18n';

import type { AuthApi } from './auth-api';
import type { Biometrics, BiometricOutcome } from './biometrics';
import { LockProvider } from './lock';
import { parsePermissions } from './permissions';
import type { SessionUser } from './session-user';
import { SessionProvider } from './session';
import { createMemoryTokenStore, type TokenStore } from './token-store';
import {
  createMemoryUnlockPreferenceStore,
  type UnlockPreference,
  type UnlockPreferenceStore,
} from './unlock-preference';
import { UnlockSetting } from './unlock-setting';

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

type MountOptions = { biometrics?: Biometrics; preference?: UnlockPreference };

async function mountProfile({ biometrics = fakeBiometrics(), preference }: MountOptions = {}) {
  const tokenStore: TokenStore = createMemoryTokenStore();
  await tokenStore.write('tok_stored');

  const preferenceStore: UnlockPreferenceStore = createMemoryUnlockPreferenceStore(preference);

  await render(
    <SessionProvider
      authApi={fakeAuthApi()}
      tokenStore={tokenStore}
      deviceName={async () => 'Kolvi test'}
    >
      <LockProvider biometrics={biometrics} preferenceStore={preferenceStore}>
        <UnlockSetting />
      </LockProvider>
    </SessionProvider>,
  );

  await act(async () => {});

  return { biometrics, preferenceStore, tokenStore };
}

describe('the Seguridad setting on Mi perfil', () => {
  it('names itself in Spanish and says what it does', async () => {
    await mountProfile();

    expect(screen.getByText(es.security.unlock.section)).toBeTruthy();
    expect(screen.getByText(es.security.unlock.label)).toBeTruthy();
    expect(screen.getByText(es.security.unlock.description)).toBeTruthy();
  });

  it('shows the switch on when the lock is on', async () => {
    await mountProfile({ preference: 'enabled' });

    expect(screen.getByTestId('unlock-setting-switch').props.value).toBe(true);
  });

  it('shows it off when the lock is off', async () => {
    await mountProfile({ preference: 'disabled' });

    expect(screen.getByTestId('unlock-setting-switch').props.value).toBe(false);
  });

  /**
   * KMO-10 #5. The one thing this control must not do is end the session: an
   * employee turning off a convenience should not find themselves back at the
   * login screen, and their token must survive it.
   */
  it('turns the lock off without signing the employee out', async () => {
    const { preferenceStore, tokenStore } = await mountProfile({ preference: 'enabled' });

    fireEvent(screen.getByTestId('unlock-setting-switch'), 'valueChange', false);

    await waitFor(async () => {
      await expect(preferenceStore.read()).resolves.toBe('disabled');
    });

    await expect(tokenStore.read()).resolves.toBe('tok_stored');
    expect(screen.getByTestId('unlock-setting')).toBeTruthy();
  });

  it('turns the lock back on, behind a prompt', async () => {
    const { biometrics, preferenceStore } = await mountProfile({ preference: 'disabled' });

    fireEvent(screen.getByTestId('unlock-setting-switch'), 'valueChange', true);

    await waitFor(async () => {
      await expect(preferenceStore.read()).resolves.toBe('enabled');
    });
    expect(biometrics.authenticate).toHaveBeenCalled();
  });

  it('leaves the switch off and explains when the prompt was not passed', async () => {
    const biometrics = fakeBiometrics({ authenticate: jest.fn(async () => 'failed') });
    const { preferenceStore } = await mountProfile({ preference: 'disabled', biometrics });

    fireEvent(screen.getByTestId('unlock-setting-switch'), 'valueChange', true);

    expect(await screen.findByTestId('unlock-setting-notice')).toBeTruthy();
    expect(screen.getByTestId('unlock-setting-switch').props.value).toBe(false);
    await expect(preferenceStore.read()).resolves.toBe('disabled');
  });

  /**
   * KMO-10 #4: the option is not offered on a phone that cannot do it. It says so
   * rather than vanishing, so an employee who heard about the feature learns what
   * is missing instead of assuming the app is broken.
   */
  it('offers no switch on a phone with no enrolled biometric', async () => {
    await mountProfile({ biometrics: fakeBiometrics({ isAvailable: jest.fn(async () => false) }) });

    expect(screen.queryByTestId('unlock-setting-switch')).toBeNull();
    expect(screen.getByText(es.permissions.biometrics.unavailable)).toBeTruthy();
  });
});
