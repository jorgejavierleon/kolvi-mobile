import type { LocalAuthenticationResult } from 'expo-local-authentication';

import {
  createBiometrics,
  createUnavailableBiometrics,
  type LocalAuthenticationModule,
} from './biometrics';

const prompt = { message: 'Desbloquea Kolvi', cancelLabel: 'Cancelar' };

function fakeModule(overrides: Partial<LocalAuthenticationModule> = {}): LocalAuthenticationModule {
  return {
    hasHardwareAsync: jest.fn(async () => true),
    isEnrolledAsync: jest.fn(async () => true),
    authenticateAsync: jest.fn(async () => ({ success: true }) as LocalAuthenticationResult),
    ...overrides,
  };
}

/** A refusal carrying one of `LocalAuthenticationError`'s values. */
function refusal(error: string): LocalAuthenticationResult {
  return { success: false, error } as LocalAuthenticationResult;
}

describe('isAvailable', () => {
  it('is true only when the phone has the hardware and something enrolled on it', async () => {
    await expect(createBiometrics(fakeModule()).isAvailable()).resolves.toBe(true);
  });

  // KMO-10 #4. A sensor with no registered finger would raise a prompt that cannot
  // succeed, so capability alone must not count as available.
  it('is false when the hardware exists but nothing is enrolled', async () => {
    const module = fakeModule({ isEnrolledAsync: jest.fn(async () => false) });

    await expect(createBiometrics(module).isAvailable()).resolves.toBe(false);
  });

  it('is false when there is no hardware at all', async () => {
    const module = fakeModule({ hasHardwareAsync: jest.fn(async () => false) });

    await expect(createBiometrics(module).isAvailable()).resolves.toBe(false);
  });

  it('is false, rather than throwing, when the biometric stack will not answer', async () => {
    const module = fakeModule({
      hasHardwareAsync: jest.fn(async () => {
        throw new Error('no biometric service');
      }),
    });

    // The second half of #4: the app stays usable on a device whose sensor is
    // broken, it simply never offers the lock.
    await expect(createBiometrics(module).isAvailable()).resolves.toBe(false);
  });
});

describe('authenticate', () => {
  it('reports success when the OS accepted the biometric', async () => {
    await expect(createBiometrics(fakeModule()).authenticate(prompt)).resolves.toBe('success');
  });

  it.each(['user_cancel', 'app_cancel', 'system_cancel', 'user_fallback'])(
    'treats %s as cancelled rather than as a failure',
    async (error) => {
      const module = fakeModule({ authenticateAsync: jest.fn(async () => refusal(error)) });

      await expect(createBiometrics(module).authenticate(prompt)).resolves.toBe('cancelled');
    },
  );

  it.each(['not_enrolled', 'not_available', 'passcode_not_set'])(
    'treats %s as unavailable, so the caller stops offering the prompt',
    async (error) => {
      const module = fakeModule({ authenticateAsync: jest.fn(async () => refusal(error)) });

      await expect(createBiometrics(module).authenticate(prompt)).resolves.toBe('unavailable');
    },
  );

  it.each(['authentication_failed', 'lockout', 'timeout', 'unable_to_process', 'unknown'])(
    'treats %s as a failed attempt',
    async (error) => {
      const module = fakeModule({ authenticateAsync: jest.fn(async () => refusal(error)) });

      await expect(createBiometrics(module).authenticate(prompt)).resolves.toBe('failed');
    },
  );

  it('reports failure, never success, when the prompt itself throws', async () => {
    const module = fakeModule({
      authenticateAsync: jest.fn(async () => {
        throw new Error('activity destroyed');
      }),
    });

    // The only reading of "did not succeed" that keeps #3 true.
    await expect(createBiometrics(module).authenticate(prompt)).resolves.toBe('failed');
  });

  it('leaves the device-passcode fallback on and asks for a strong biometric', async () => {
    const authenticateAsync = jest.fn(async () => ({ success: true }) as LocalAuthenticationResult);

    await createBiometrics(fakeModule({ authenticateAsync })).authenticate(prompt);

    expect(authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        // The employee in a basement with wet hands has no other way in: the app's
        // password fallback needs a server they cannot reach.
        disableDeviceFallback: false,
        // Class 2 face unlock is defeated by a photograph of the employee.
        biometricsSecurityLevel: 'strong',
      }),
    );
  });

  it('passes the caller the Spanish prompt copy rather than authoring its own', async () => {
    const authenticateAsync = jest.fn(async () => ({ success: true }) as LocalAuthenticationResult);

    await createBiometrics(fakeModule({ authenticateAsync })).authenticate(prompt);

    expect(authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: prompt.message, cancelLabel: prompt.cancelLabel }),
    );
  });

  /**
   * KMO-10 #6, as far as a test can carry it. The criterion is about what the app
   * *could* send, and this pins the shape of what it has: whatever the OS reports,
   * the value crossing into the app is one of four fixed strings. There is no
   * template, no image and no per-finger identifier to leak, because none of them
   * is ever in a variable.
   */
  it('yields nothing but one of four fixed strings, whatever the OS reports', async () => {
    const outcomes = await Promise.all(
      ['authentication_failed', 'user_cancel', 'not_enrolled'].map((error) =>
        createBiometrics(
          fakeModule({ authenticateAsync: jest.fn(async () => refusal(error)) }),
        ).authenticate(prompt),
      ),
    );

    for (const outcome of outcomes) {
      expect(['success', 'failed', 'cancelled', 'unavailable']).toContain(outcome);
    }
  });
});

describe('createUnavailableBiometrics', () => {
  it('answers the way a phone with no sensor does', async () => {
    const biometrics = createUnavailableBiometrics();

    await expect(biometrics.isAvailable()).resolves.toBe(false);
    await expect(biometrics.authenticate(prompt)).resolves.toBe('unavailable');
  });
});
