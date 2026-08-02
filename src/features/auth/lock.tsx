/**
 * Whether the app is locked behind the phone's biometrics right now.
 *
 * The lock is a second thing on top of the session, not part of it: an employee
 * behind the lock screen is still signed in, still holds a token, and turning the
 * lock off does not sign them out (#5). Keeping it out of `SessionProvider` is what
 * makes that true by construction rather than by care.
 *
 * The one detail the whole criterion turns on: the lock latches when the app leaves
 * the foreground, not when it comes back. Locking on return means React has already
 * rendered a frame of whatever tab the employee was on before the prompt appears,
 * and #2 asks for no visible employee data at all. Latching on the way out means the
 * lock screen is the mounted screen before the app is ever on top again.
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
import { AppState } from 'react-native';

import { es } from '@/i18n';

import { createBiometrics, type BiometricOutcome, type Biometrics } from './biometrics';
import { useSession } from './session';
import {
  createSecureUnlockPreferenceStore,
  type UnlockPreference,
  type UnlockPreferenceStore,
} from './unlock-preference';

export type Lock = {
  readonly locked: boolean;
  readonly preference: UnlockPreference;
  /** Hardware present and something enrolled on it. */
  readonly available: boolean;
  /** The one-time offer is due: signed in, capable, and never answered (#1, #4). */
  readonly offerPending: boolean;
  /** Runs the OS prompt. Only `success` clears the lock (#3). */
  unlock(): Promise<BiometricOutcome>;
  /** Turns it on, behind a prompt the employee has to pass first. */
  enable(): Promise<BiometricOutcome>;
  /** Turns it off. Touches nothing else — the session is untouched (#5). */
  disable(): Promise<void>;
  /** `Ahora no`. Recorded, so the offer is made once rather than at every launch. */
  declineOffer(): Promise<void>;
};

const LockContext = createContext<Lock | null>(null);

export type LockProviderProps = {
  children: ReactNode;
  /** Injected in tests, which never touch the keystore or the sensor. */
  preferenceStore?: UnlockPreferenceStore;
  biometrics?: Biometrics;
};

export function LockProvider({ children, preferenceStore, biometrics }: LockProviderProps) {
  const store = useMemo(
    () => preferenceStore ?? createSecureUnlockPreferenceStore(),
    [preferenceStore],
  );
  const sensor = useMemo(() => biometrics ?? createBiometrics(), [biometrics]);

  const { status } = useSession();

  const [ready, setReady] = useState(false);
  const [preference, setPreference] = useState<UnlockPreference>('unset');
  const [available, setAvailable] = useState(false);

  // The raw latch, and not the same thing as `locked` below. It records only that
  // the app left the foreground with the lock armed; whether that *means* the app
  // is locked also depends on there still being a session and the preference still
  // being on, and both of those can change while the latch sits there.
  const [latched, setLatched] = useState(false);

  /**
   * Derived rather than stored, which is what keeps two obligations from needing an
   * effect to enforce them: signing out drops the lock (otherwise the login screen
   * would render behind it), and so does turning the preference off. State that
   * cannot disagree with the session is state that cannot strand somebody.
   */
  const locked = latched && status === 'signedIn' && preference === 'enabled';

  useEffect(() => {
    // Held until the session has settled, because whether to arm at launch depends
    // on which way it settled. Reading the preference earlier would mean deciding
    // without knowing, and the only way back from a wrong decision is a state
    // update during the first mount — a cascading render at exactly the moment the
    // app is least able to absorb one.
    if (status === 'restoring' || ready) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      const [stored, capable] = await Promise.all([store.read(), sensor.isAvailable()]);

      if (cancelled) {
        return;
      }

      setPreference(stored);
      setAvailable(capable);
      // Armed at launch only for a session that came back from the keystore. That
      // start goes straight to the tabs without passing the login screen (KMO-9
      // #3), so #2's gate has to be up on the first frame — an app that reopened
      // unlocked after being killed would be gated only against the lazier attack.
      //
      // A launch that landed on the login screen is the opposite case: whoever
      // gets past it will have typed the password, which is the stronger of the
      // two credentials, and meeting them with a fingerprint prompt for the same
      // arrival would be asking twice for one entry.
      setLatched(stored === 'enabled' && status === 'signedIn');
      setReady(true);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [ready, sensor, status, store]);

  // Written and read only inside effects. The transition matters, not the value:
  // `signedOut` on its own is also what a launch with no stored token looks like.
  const previousStatus = useRef(status);

  useEffect(() => {
    const was = previousStatus.current;
    previousStatus.current = status;

    // A sign-out — deliberate, or a 401 that ended the session — hands the phone
    // back to whoever holds it next. The preference belongs to the employee who
    // set it, so the next one is asked for themselves rather than inheriting a
    // lock they cannot open. A launch that merely found no stored token is not
    // that transition and leaves the preference alone.
    if (status === 'signedOut' && was === 'signedIn') {
      void store.clear().then(() => setPreference('unset'));
    }
  }, [status, store]);

  useEffect(() => {
    // Nothing to arm when the lock is off or there is no session behind it. The
    // subscription is rebuilt when either changes, which costs nothing and is why
    // the callback can read both from the closure instead of from a ref.
    if (preference !== 'enabled' || status !== 'signedIn') {
      return;
    }

    const subscription = AppState.addEventListener('change', (next) => {
      // `background` only. `inactive` is iOS's state for a system dialog on top of
      // the app — which is exactly what the biometric prompt is — so latching on it
      // would lock the employee out in the middle of the prompt that unlocks them.
      if (next === 'background') {
        setLatched(true);
      }
    });

    return () => subscription.remove();
  }, [preference, status]);

  const prompt = useMemo(
    () => ({ message: es.security.lock.prompt, cancelLabel: es.actions.cancel }),
    [],
  );

  const unlock = useCallback(async (): Promise<BiometricOutcome> => {
    const outcome = await sensor.authenticate(prompt);

    // The only place a passed prompt releases the latch, and it is behind an
    // equality check on `success`. A cancelled or failed prompt leaves it exactly
    // as it was (#3).
    if (outcome === 'success') {
      setLatched(false);
    }

    return outcome;
  }, [prompt, sensor]);

  const enable = useCallback(async (): Promise<BiometricOutcome> => {
    // Turning the lock on without passing it once is how an employee ends up
    // locked out by a sensor that never works for them. The prompt here is the
    // proof that the thing they are enabling can actually let them back in.
    const outcome = await sensor.authenticate(prompt);

    if (outcome === 'success') {
      // Released as well as recorded: a latch left over from an earlier session on
      // this phone would otherwise turn the lock on and immediately slam it, in
      // front of the employee who just asked for it.
      setLatched(false);
      setPreference('enabled');
      await store.write('enabled');
    }

    return outcome;
  }, [prompt, sensor, store]);

  const disable = useCallback(async () => {
    setPreference('disabled');
    await store.write('disabled');
  }, [store]);

  const declineOffer = useCallback(async () => {
    setPreference('disabled');
    await store.write('disabled');
  }, [store]);

  const lock = useMemo<Lock>(
    () => ({
      locked,
      preference,
      available,
      offerPending: status === 'signedIn' && available && preference === 'unset',
      unlock,
      enable,
      disable,
      declineOffer,
    }),
    [available, declineOffer, disable, enable, locked, preference, status, unlock],
  );

  /**
   * Nothing below this renders until the preference and the sensor have answered.
   *
   * The gate is here rather than a `ready` flag the navigator reads, so the app
   * has *one* asynchronous gate at mount instead of two independent ones that can
   * settle in either order. Two gates meant the tree below could commit and then
   * commit again a moment later when the second flipped, which is an extra mount
   * transaction nobody needed.
   *
   * Rendering nothing is safe because the splash is still up: `RootLayout` holds
   * it until the navigator below reports the session settled.
   */
  if (!ready) {
    return null;
  }

  return <LockContext.Provider value={lock}>{children}</LockContext.Provider>;
}

export function useLock(): Lock {
  const lock = useContext(LockContext);

  if (lock === null) {
    throw new Error('useLock must be used inside a LockProvider');
  }

  return lock;
}
