/**
 * The whole biometric surface of the app, in one file so that KMO-10 #6 — no
 * biometric data leaves the device — is a claim someone can check by reading
 * rather than by trusting.
 *
 * What `expo-local-authentication` hands back is the reason this stays honest: the
 * OS runs the prompt in its own process, matches against templates held in hardware
 * the app cannot address, and answers with a boolean and an error string. There is
 * no fingerprint image, no template, no per-finger identifier anywhere in the API,
 * so there is nothing an accidental log line or a request body could carry off.
 * `BiometricOutcome` below is the widest value this module ever produces, and it is
 * four strings.
 *
 * This is app unlock, not identification. It proves the phone's owner is holding it;
 * it says nothing to the server about who they are, and the copy in `src/i18n` is
 * careful not to imply otherwise (Res. 38 Art. 7g wants two identification
 * alternatives — the password is the one that identifies, this is the second factor
 * on the device).
 */

import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Why a prompt ended, reduced to the three things a caller can act on plus the
 * case where it never ran.
 *
 * `failed` and `cancelled` are kept apart because they mean different things to the
 * employee: a finger the sensor did not recognise invites another try, while a
 * dismissed prompt was a deliberate choice and the screen should stop insisting.
 * Neither one unlocks anything.
 */
export type BiometricOutcome = 'success' | 'failed' | 'cancelled' | 'unavailable';

export type Biometrics = {
  /** Hardware present *and* something enrolled on it. Both, or the offer is not made (#4). */
  isAvailable(): Promise<boolean>;
  authenticate(prompt: BiometricPrompt): Promise<BiometricOutcome>;
};

/**
 * The words the OS prompt shows. Passed in rather than imported, because
 * `src/i18n` is where user-facing copy is auditable and this module is where the
 * native call is.
 */
export type BiometricPrompt = {
  message: string;
  cancelLabel: string;
};

/** The slice of `expo-local-authentication` used here, injected in tests. */
export type LocalAuthenticationModule = {
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
  authenticateAsync(
    options: LocalAuthentication.LocalAuthenticationOptions,
  ): Promise<LocalAuthentication.LocalAuthenticationResult>;
};

/**
 * Dismissals rather than rejections. The employee chose to stop, or the OS stopped
 * on their behalf — nothing was refused, so the screen offers the prompt again
 * instead of implying they failed something.
 */
const CANCELLED: ReadonlySet<string> = new Set([
  'user_cancel',
  'app_cancel',
  'system_cancel',
  'user_fallback',
]);

/**
 * The sensor is not a route onto this phone at all: no hardware, nothing enrolled,
 * or no device passcode to fall back to. Distinct from a refusal, because the
 * answer is to stop offering biometric unlock rather than to retry it (#4).
 */
const UNAVAILABLE: ReadonlySet<string> = new Set([
  'not_enrolled',
  'not_available',
  'passcode_not_set',
]);

export function createBiometrics(
  module: LocalAuthenticationModule = LocalAuthentication,
): Biometrics {
  return {
    isAvailable: async () => {
      try {
        // Hardware alone is not enough. A phone with a sensor nobody has registered
        // a finger on would show a prompt that cannot succeed, so #4's "does not
        // offer the option" has to test enrolment, not capability.
        return (await module.hasHardwareAsync()) && (await module.isEnrolledAsync());
      } catch {
        // A biometric stack that will not answer is one the app cannot lock behind.
        // Treating the failure as "no biometrics" keeps the app fully usable, which
        // is the second half of #4.
        return false;
      }
    },

    authenticate: async ({ message, cancelLabel }) => {
      try {
        const result = await module.authenticateAsync({
          promptMessage: message,
          cancelLabel,
          // Left at its default of `false` on purpose: after a few unrecognised
          // attempts the OS offers the phone's own PIN or pattern. That is the only
          // unlock available to an employee with wet or dusty hands and no signal —
          // the app's own password fallback needs the server, and a warehouse
          // basement does not have one.
          disableDeviceFallback: false,
          // Android Class 3 only. Class 2 is camera-based face unlock, which is
          // defeated by a photograph; a credential that can punch someone's
          // attendance deserves the stronger class.
          biometricsSecurityLevel: 'strong',
          // The prompt is the whole interaction — there is no destructive action
          // behind it that would want a second confirming tap.
          requireConfirmation: false,
        });

        if (result.success) {
          return 'success';
        }

        if (CANCELLED.has(result.error)) {
          return 'cancelled';
        }

        return UNAVAILABLE.has(result.error) ? 'unavailable' : 'failed';
      } catch {
        // A prompt that threw did not succeed, and the only safe reading of "did not
        // succeed" is that the app stays locked.
        return 'failed';
      }
    },
  };
}

/**
 * A device with no biometrics, for tests and for anywhere the real module cannot
 * run. Answers the same way a phone with no sensor does, so the not-available path
 * is the default rather than the exception.
 */
export function createUnavailableBiometrics(): Biometrics {
  return {
    isAvailable: async () => false,
    authenticate: async () => 'unavailable',
  };
}
