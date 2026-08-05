/**
 * Where the employee is, as the card above the shift card states it (KMO-16).
 *
 * The hook owns three things a component should not: when to ask the OS for the
 * permission, when to spend battery on a fix, and what to do with each of the
 * ways that can fail. What it hands back is a state with a title on it and two
 * values the punch will need — the fix itself and a `geoStatus` for the wire.
 *
 * **It runs only while Inicio is on screen** (#10). Acquisition starts on focus
 * and is abandoned on blur; nothing here subscribes, polls or survives the tab
 * being left. An attendance app has no business knowing where an employee is
 * between punches, and the smallest way to guarantee that is to have no code
 * that could.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { evaluateGeofence, type LocationFix } from './geofence';
import { createLocationSource, type LocationSource } from './location';
import type { Geofence } from './today-api';

/**
 * What the card draws. The first four are the design's three states plus the
 * seconds before any of them; `denied` is the one the design has no frame for.
 *
 * `canAskAgain` is what the action under a `denied` card offers: the OS prompt
 * while there is still one to raise, and system settings once Android has
 * stopped showing it (#8).
 */
export type LocationState =
  | { readonly kind: 'acquiring' }
  | { readonly kind: 'confirmed'; readonly distanceMeters: number | null }
  | { readonly kind: 'outside'; readonly distanceMeters: number }
  | { readonly kind: 'noSignal' }
  | { readonly kind: 'denied'; readonly canAskAgain: boolean };

/**
 * How far the reading got, before the geofence has anything to say about it.
 *
 * `located` is the one that differs from `LocationState`: the phone answered,
 * and whether that answer is `confirmed` or `outside` is a question about the
 * premise rather than about the phone.
 */
type LocationPhase =
  | { readonly kind: 'acquiring' }
  | { readonly kind: 'located' }
  | { readonly kind: 'noSignal' }
  | { readonly kind: 'denied'; readonly canAskAgain: boolean };

/**
 * What the punch reports about where it was made, mirroring the server's own
 * column (PRD §6): inside the geofence, outside it, or no fix at all.
 *
 * `unknown` is a first-class answer and not a missing one. A punch made with a
 * permission the employee refused travels as `unknown` and is recorded —
 * blocking it would make attendance unrecordable, which is a legal problem
 * rather than a product one (#7). KMO-17 #5 sends this.
 */
export type GeoStatus = 'inside' | 'outside' | 'unknown';

export type LocationReading = {
  readonly state: LocationState;
  /** The fix to send with a punch, or `null` when there is none to send. */
  readonly fix: LocationFix | null;
  readonly geoStatus: GeoStatus;
  /**
   * Whether the geolocation card is a reason to hold the punch button.
   *
   * False for `outside`, which KMO-18 reopens with an explicit override, and for
   * the two transient states — a fix that is still arriving or a signal that
   * might come back are both worth another few seconds. True for `denied`,
   * which is neither transient nor overridable: there is no later moment at
   * which that employee gets a fix, so the punch goes without one (#7).
   */
  readonly punchAllowed: boolean;
  /** The Spanish rationale, raised before the OS prompt and never after it (#1). */
  readonly rationaleVisible: boolean;
  /**
   * Offer the rationale again, from the card's own action.
   *
   * The sheet comes back rather than the prompt going straight up: an employee
   * reaching for this has already refused once, and the OS will stop asking
   * after the next refusal — which makes the explanation more important the
   * second time, not less.
   */
  offerRationale: () => void;
  /** `Continuar` — the OS prompt follows immediately. */
  acceptRationale: () => void;
  /** `Ahora no`, the backdrop, the back button. Recorded as an answer, not a postponement. */
  dismissRationale: () => void;
  /** Ask the phone again, from the card or from KMO-18's `Reintentar ubicación`. */
  retry: () => void;
  /** The OS settings, for the refusal the app cannot prompt its way out of (#8). */
  openSettings: () => void;
};

export type UseLocationOptions = {
  /** The premise's geofence from `GET /me/today`; `null` until a shift has loaded. */
  geofence?: Geofence | null;
  /**
   * Whether this employee has a punch surface at all.
   *
   * False for a user without `ClockOwn:Mark` — an admin who does not punch gets
   * the tab without it (KMO-15 #8) — and then the phone is never asked anything.
   * Reading someone's location for a card they are not shown is the collection
   * this feature is otherwise careful not to do.
   */
  enabled?: boolean;
  /** Injected in tests; the app reads the phone. */
  source?: LocationSource;
};

export function useLocation({
  geofence = null,
  enabled = true,
  source,
}: UseLocationOptions = {}): LocationReading {
  // Built once, like `useToday`'s api: a caller passing a fresh object each
  // render would restart acquisition on every render.
  const location = useMemo(() => source ?? createLocationSource(), [source]);

  /**
   * How far the reading itself got — which is deliberately *not* the same thing
   * as what the card says.
   *
   * The geofence arrives from `GET /me/today`, seconds after the fix does and on
   * a different clock. Holding the verdict in state would make the geofence an
   * input to the effect that acquires, so a response landing mid-shift would
   * throw away a perfectly good fix and ask the phone all over again. Keeping
   * the phase here and deriving the verdict below means a geofence that arrives
   * late re-evaluates what the app already knows, at no cost to the employee.
   */
  const [phase, setPhase] = useState<LocationPhase>({ kind: 'acquiring' });
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [rationaleVisible, setRationaleVisible] = useState(false);

  /**
   * Which attempt is the current one.
   *
   * Every await below can outlive the screen — a fix takes up to twelve seconds
   * and an employee can leave the tab in one — so each result checks that its
   * own attempt is still the live one before writing state. That is what blur
   * cancels: not the promise, which cannot be cancelled, but its right to
   * report (#10).
   */
  const attempt = useRef(0);

  const acquire = useCallback(
    async (generation: number): Promise<void> => {
      // Services can be off with the permission granted, which is #4's state and
      // not a refusal: the OS switch is what the copy asks them to turn on.
      if (!(await location.hasServicesEnabled())) {
        if (generation === attempt.current) {
          setFix(null);
          setPhase({ kind: 'noSignal' });
        }

        return;
      }

      const acquired = await location.getFix();

      if (generation !== attempt.current) {
        return;
      }

      setFix(acquired);
      setPhase(acquired === null ? { kind: 'noSignal' } : { kind: 'located' });
    },
    [location],
  );

  const start = useCallback(
    async (generation: number): Promise<void> => {
      const permission = await location.getPermission();

      if (generation !== attempt.current) {
        return;
      }

      // Never asked. The rationale comes first and the OS prompt follows only if
      // they accept it (#1) — Android gives one prompt and then, after a second
      // refusal, stops asking forever, so an unexplained prompt is a permission
      // an employee can lose on a reflex.
      if (permission === 'undetermined') {
        setFix(null);
        setPhase({ kind: 'denied', canAskAgain: true });
        setRationaleVisible(true);

        return;
      }

      if (permission !== 'granted') {
        setFix(null);
        setPhase({ kind: 'denied', canAskAgain: permission === 'denied' });

        return;
      }

      await acquire(generation);
    },
    [acquire, location],
  );

  const run = useCallback((): void => {
    const generation = attempt.current + 1;
    attempt.current = generation;

    if (!enabled) {
      return;
    }

    setPhase({ kind: 'acquiring' });
    void start(generation);
  }, [enabled, start]);

  /**
   * On focus, and only on focus.
   *
   * The cleanup does not stop a request in flight — there is nothing in the
   * platform API to stop — it retires the generation, so whatever comes back
   * lands on a screen that is no longer listening and changes nothing.
   */
  useFocusEffect(
    useCallback(() => {
      run();

      return () => {
        attempt.current += 1;
      };
    }, [run]),
  );

  const acceptRationale = useCallback((): void => {
    setRationaleVisible(false);

    const generation = attempt.current + 1;
    attempt.current = generation;

    setPhase({ kind: 'acquiring' });

    void (async () => {
      const permission = await location.requestPermission();

      if (generation !== attempt.current) {
        return;
      }

      if (permission === 'granted') {
        await acquire(generation);

        return;
      }

      setFix(null);
      setPhase({ kind: 'denied', canAskAgain: permission === 'denied' });
    })();
  }, [acquire, location]);

  /**
   * `Ahora no`. The sheet closes onto the card it was covering, which is already
   * the denied state with a way back on it — the employee is not prompted again
   * on the next focus, because a nag is how the OS prompt gets refused for good.
   */
  const dismissRationale = useCallback((): void => {
    setRationaleVisible(false);
  }, []);

  const offerRationale = useCallback((): void => {
    setRationaleVisible(true);
  }, []);

  const openSettings = useCallback((): void => {
    void location.openSettings();
  }, [location]);

  /**
   * What the card draws: the phase, with the geofence applied to it once there
   * is both a fix and a premise to measure against.
   */
  const state = useMemo<LocationState>(() => {
    if (phase.kind !== 'located') {
      return phase;
    }

    // `located` without a fix cannot happen — the two are set together — and
    // reading it as no-signal is the honest fallback rather than a confirmation.
    if (fix === null) {
      return { kind: 'noSignal' };
    }

    const verdict = evaluateGeofence(fix, geofence);

    return verdict.kind === 'confirmed'
      ? { kind: 'confirmed', distanceMeters: verdict.distanceMeters }
      : { kind: 'outside', distanceMeters: verdict.distanceMeters };
  }, [fix, geofence, phase]);

  return useMemo(
    () => ({
      state,
      fix: state.kind === 'confirmed' || state.kind === 'outside' ? fix : null,
      geoStatus: geoStatusOf(state),
      punchAllowed: state.kind === 'confirmed' || state.kind === 'denied',
      rationaleVisible,
      offerRationale,
      acceptRationale,
      dismissRationale,
      retry: run,
      openSettings,
    }),
    [
      acceptRationale,
      dismissRationale,
      fix,
      offerRationale,
      openSettings,
      rationaleVisible,
      run,
      state,
    ],
  );
}

/**
 * What the punch reports.
 *
 * `confirmed` is `inside` even when there was no geofence to be inside of: the
 * app is saying where the employee was, and the server — which owns the
 * authoritative evaluation — is the one that decides what that means about a
 * premise it knows the radius of.
 */
function geoStatusOf(state: LocationState): GeoStatus {
  if (state.kind === 'confirmed') {
    return 'inside';
  }

  return state.kind === 'outside' ? 'outside' : 'unknown';
}
