import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { AuthApi } from './auth-api';
import type { Biometrics, BiometricOutcome } from './biometrics';
import { LockProvider, useLock, type Lock } from './lock';
import { parsePermissions } from './permissions';
import type { SessionUser } from './session-user';
import { SessionProvider, useSession, type Session } from './session';
import { createMemoryTokenStore, type TokenStore } from './token-store';
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
  permissions: parsePermissions(['ClockOwn:Mark']),
};

const credentials = { email: 'employee@example.com', password: 'admin' };

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

/**
 * Captures the handler `LockProvider` registers, so a test can put the app in the
 * background without an emulator.
 */
function captureAppState() {
  const handlers: ((state: AppStateStatus) => void)[] = [];

  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
    if (event === 'change') {
      handlers.push(handler as (state: AppStateStatus) => void);
    }

    return { remove: jest.fn() } as never;
  });

  return async (state: AppStateStatus) => {
    await act(async () => {
      for (const handler of handlers) {
        handler(state);
      }
    });
  };
}

type MountOptions = {
  preference?: UnlockPreference;
  biometrics?: Biometrics;
  preferenceStore?: UnlockPreferenceStore;
  tokenStore?: TokenStore;
};

async function mount(options: MountOptions = {}) {
  const biometrics = options.biometrics ?? fakeBiometrics();
  const preferenceStore =
    options.preferenceStore ?? createMemoryUnlockPreferenceStore(options.preference);
  const tokenStore = options.tokenStore ?? createMemoryTokenStore();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider
      authApi={fakeAuthApi()}
      tokenStore={tokenStore}
      deviceName={async () => 'Kolvi test'}
    >
      <LockProvider biometrics={biometrics} preferenceStore={preferenceStore}>
        {children}
      </LockProvider>
    </SessionProvider>
  );

  const { result } = await renderHook(() => ({ lock: useLock(), session: useSession() }), {
    wrapper,
  });

  // The provider renders nothing until the preference and the sensor have both
  // answered, so the hook below it does not run at all before then — a null
  // `result.current` *is* the not-ready state.
  await waitFor(() => expect(result.current).not.toBeNull());

  return { result, biometrics, preferenceStore, tokenStore };
}

/** Mounted, restored, and signed in through the login path. */
async function mountSignedIn(options: MountOptions = {}) {
  const mounted = await mount(options);

  await waitFor(() => expect(mounted.result.current.session.status).toBe('signedOut'));
  await act(async () => {
    await mounted.result.current.session.signIn(credentials);
  });

  return mounted;
}

/** Mounted onto a token already in the store — a cold start for a signed-in employee. */
async function mountRestored(options: MountOptions = {}) {
  const tokenStore = createMemoryTokenStore();
  await tokenStore.write('tok_stored');

  const mounted = await mount({ ...options, tokenStore });
  await waitFor(() => expect(mounted.result.current.session.status).toBe('signedIn'));

  return mounted;
}

const lockOf = (result: { current: { lock: Lock; session: Session } }) => result.current.lock;

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the initial state', () => {
  it('is unlocked when the employee never turned the lock on', async () => {
    const { result } = await mountRestored({ preference: 'unset' });

    expect(lockOf(result).locked).toBe(false);
  });

  it('is unlocked when they turned it off', async () => {
    const { result } = await mountRestored({ preference: 'disabled' });

    expect(lockOf(result).locked).toBe(false);
  });

  /**
   * A cold start with a live token goes straight to the tabs without passing the
   * login screen (KMO-9 #3), so the lock has to already be up on that first frame.
   */
  it('is locked on a cold start when the lock is on', async () => {
    const { result } = await mountRestored({ preference: 'enabled' });

    expect(lockOf(result).locked).toBe(true);
  });

  /**
   * The launch latch is armed from the stored preference before anyone has signed
   * in, so an employee whose token had expired would meet the lock screen straight
   * after typing their password — having just presented the stronger of the two
   * credentials.
   */
  it('does not meet a fresh login with the lock screen', async () => {
    const { result } = await mountSignedIn({ preference: 'enabled' });

    expect(result.current.session.status).toBe('signedIn');
    expect(lockOf(result).locked).toBe(false);
  });

  it('renders nothing until the stored preference and the sensor have both answered', async () => {
    let release: (() => void) | undefined;
    const biometrics = fakeBiometrics({
      isAvailable: jest.fn(
        () =>
          new Promise<boolean>((resolve) => {
            release = () => resolve(true);
          }),
      ),
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <SessionProvider
        authApi={fakeAuthApi()}
        tokenStore={createMemoryTokenStore()}
        deviceName={async () => 'Kolvi test'}
      >
        <LockProvider
          biometrics={biometrics}
          preferenceStore={createMemoryUnlockPreferenceStore('enabled')}
        >
          {children}
        </LockProvider>
      </SessionProvider>
    );

    const { result } = await renderHook(() => useLock(), { wrapper });

    // Nothing below the provider has mounted, so the hook has not run — which is
    // the point. The splash is still up over this window, and the alternative is
    // drawing a tab and putting a lock over it a frame later.
    expect(result.current).toBeNull();

    await act(async () => {
      release?.();
    });
    await waitFor(() => expect(result.current).not.toBeNull());
  });
});

describe('backgrounding the app', () => {
  // KMO-10 #2, and the reason the latch is on the way out rather than the way back:
  // by the time the app is active again the lock is already up, so no frame of a
  // tab is ever rendered.
  it('locks when the app goes to the background and the lock is on', async () => {
    const send = captureAppState();
    const { result } = await mountSignedIn({ preference: 'enabled' });

    expect(lockOf(result).locked).toBe(false);

    await send('background');

    expect(lockOf(result).locked).toBe(true);
  });

  it('does not lock when the employee never turned the lock on', async () => {
    const send = captureAppState();
    const { result } = await mountSignedIn({ preference: 'disabled' });

    await send('background');

    expect(lockOf(result).locked).toBe(false);
  });

  /**
   * `inactive` is what iOS reports while a system dialog covers the app — which is
   * what the biometric prompt itself is. Latching on it would lock the employee out
   * in the middle of the prompt that was about to let them in.
   */
  it('ignores inactive, which is the prompt covering the app rather than a departure', async () => {
    const send = captureAppState();
    const { result } = await mountSignedIn({ preference: 'enabled' });

    await send('inactive');

    expect(lockOf(result).locked).toBe(false);
  });

  it('does not lock a signed-out app, which has nothing to protect', async () => {
    const send = captureAppState();
    const { result } = await mount({ preference: 'enabled' });

    await waitFor(() => expect(result.current.session.status).toBe('signedOut'));
    await send('background');

    expect(lockOf(result).locked).toBe(false);
  });

  it('coming back to the foreground does not unlock on its own', async () => {
    const send = captureAppState();
    const { result } = await mountSignedIn({ preference: 'enabled' });

    await send('background');
    await send('active');

    // Only a passed prompt clears it (#3). Returning to the app is not a credential.
    expect(lockOf(result).locked).toBe(true);
  });
});

describe('unlocking', () => {
  it('clears the lock when the OS accepted the biometric', async () => {
    const send = captureAppState();
    const { result } = await mountSignedIn({ preference: 'enabled' });

    await send('background');
    await act(async () => {
      await lockOf(result).unlock();
    });

    expect(lockOf(result).locked).toBe(false);
  });

  // KMO-10 #3. Neither of these is access.
  it.each<BiometricOutcome>(['failed', 'cancelled', 'unavailable'])(
    'stays locked when the prompt came back %s',
    async (outcome) => {
      const send = captureAppState();
      const biometrics = fakeBiometrics({ authenticate: jest.fn(async () => outcome) });
      const { result } = await mountSignedIn({ preference: 'enabled', biometrics });

      await send('background');

      let reported: BiometricOutcome | undefined;
      await act(async () => {
        reported = await lockOf(result).unlock();
      });

      expect(reported).toBe(outcome);
      expect(lockOf(result).locked).toBe(true);
    },
  );

  it('keeps the session while it is locked, so unlocking is not a fresh login', async () => {
    const send = captureAppState();
    const { result } = await mountSignedIn({ preference: 'enabled' });

    await send('background');

    expect(result.current.session.status).toBe('signedIn');
    expect(result.current.session.user).toEqual(employee);
  });
});

describe('the one-time offer', () => {
  it('is pending once a signed-in employee is on a phone that can do it', async () => {
    const { result } = await mountSignedIn({ preference: 'unset' });

    expect(lockOf(result).offerPending).toBe(true);
  });

  // KMO-10 #4.
  it('is never pending on a phone with no enrolled biometric', async () => {
    const biometrics = fakeBiometrics({ isAvailable: jest.fn(async () => false) });
    const { result } = await mountSignedIn({ preference: 'unset', biometrics });

    expect(lockOf(result).offerPending).toBe(false);
    expect(lockOf(result).available).toBe(false);
  });

  it('is not pending before there is a session to protect', async () => {
    const { result } = await mount({ preference: 'unset' });

    await waitFor(() => expect(result.current.session.status).toBe('signedOut'));

    expect(lockOf(result).offerPending).toBe(false);
  });

  it('stops being pending once the employee answers, and stays answered', async () => {
    const { result, preferenceStore } = await mountSignedIn({ preference: 'unset' });

    await act(async () => {
      await lockOf(result).declineOffer();
    });

    expect(lockOf(result).offerPending).toBe(false);
    // Recorded, not merely dismissed: the next launch must not ask again.
    await expect(preferenceStore.read()).resolves.toBe('disabled');
  });
});

describe('turning it on', () => {
  it('records the preference only after a prompt the employee passed', async () => {
    const { result, preferenceStore } = await mountSignedIn({ preference: 'unset' });

    await act(async () => {
      await lockOf(result).enable();
    });

    expect(lockOf(result).preference).toBe('enabled');
    await expect(preferenceStore.read()).resolves.toBe('enabled');
  });

  it('leaves it off when the prompt was not passed, so nobody is locked out by a sensor that fails them', async () => {
    const biometrics = fakeBiometrics({ authenticate: jest.fn(async () => 'failed') });
    const { result, preferenceStore } = await mountSignedIn({ preference: 'unset', biometrics });

    await act(async () => {
      await lockOf(result).enable();
    });

    expect(lockOf(result).preference).toBe('unset');
    await expect(preferenceStore.read()).resolves.toBe('unset');
  });
});

describe('turning it off', () => {
  // KMO-10 #5, the whole of it.
  it('does not sign the employee out', async () => {
    const { result, preferenceStore, tokenStore } = await mountSignedIn({ preference: 'enabled' });

    await act(async () => {
      await lockOf(result).disable();
    });

    expect(lockOf(result).preference).toBe('disabled');
    await expect(preferenceStore.read()).resolves.toBe('disabled');

    expect(result.current.session.status).toBe('signedIn');
    expect(result.current.session.user).toEqual(employee);
    await expect(tokenStore.read()).resolves.toBe('tok_abc');
  });

  it('stops the app locking on the next backgrounding', async () => {
    const send = captureAppState();
    const { result } = await mountSignedIn({ preference: 'enabled' });

    await act(async () => {
      await lockOf(result).disable();
    });
    await send('background');

    expect(lockOf(result).locked).toBe(false);
  });
});

describe('signing out', () => {
  it('forgets the preference, so the next employee on this phone is asked for themselves', async () => {
    const { result, preferenceStore } = await mountSignedIn({ preference: 'enabled' });

    await act(async () => {
      await result.current.session.signOut();
    });

    await waitFor(() => expect(lockOf(result).preference).toBe('unset'));
    await expect(preferenceStore.read()).resolves.toBe('unset');
  });

  it('drops the lock, so the login screen is not behind it', async () => {
    const send = captureAppState();
    const { result } = await mountSignedIn({ preference: 'enabled' });

    await send('background');
    await act(async () => {
      await result.current.session.signOut();
    });

    expect(lockOf(result).locked).toBe(false);
  });

  /**
   * A launch that simply found no stored token is not a sign-out. Clearing the
   * preference there would re-offer the lock after every login on a phone whose
   * token expired, which is the nagging the recorded answer exists to prevent.
   */
  it('leaves the preference alone when a cold start merely found no token', async () => {
    const { result, preferenceStore } = await mount({ preference: 'disabled' });

    await waitFor(() => expect(result.current.session.status).toBe('signedOut'));

    await expect(preferenceStore.read()).resolves.toBe('disabled');
    expect(lockOf(result).preference).toBe('disabled');
  });
});

describe('useLock', () => {
  it('refuses to be used outside a provider', async () => {
    // The error is the point: a screen reading a lock that does not exist would
    // otherwise render as unlocked.
    await expect(renderHook(() => useLock())).rejects.toThrow(
      'useLock must be used inside a LockProvider',
    );
  });
});
