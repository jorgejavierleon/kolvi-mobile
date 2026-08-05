/**
 * The whole location surface of the app, in one file — the only module that
 * imports `expo-location` (KMO-16).
 *
 * Everything here is **foreground and one-shot**. There is no `watchPosition`,
 * no background task, and `requestBackgroundPermissionsAsync` is never called;
 * `app.config.ts` turns off the background permission, the foreground service
 * and the iOS background mode, so the generated manifest is the check on that
 * rather than this comment (#10). An attendance app that tracked where employees
 * were between punches would be collecting something it has no business holding.
 *
 * The reading it produces is advisory — `geofence.ts` says why — and every
 * failure resolves rather than throws: no permission, no services, no fix and a
 * fix that never arrives all end as "we do not know where you are", which is a
 * state the card draws and never an error that takes the screen down. An
 * employee must be able to punch through all four of them (#7).
 */

import * as Location from 'expo-location';
import { Linking } from 'react-native';

import type { LocationFix } from './geofence';

/**
 * What the OS will let the app do, reduced to the four cases the screen acts on
 * differently.
 *
 * `denied` and `deniedForever` are the pair that matters. Android stops showing
 * the system prompt after a second refusal, so `deniedForever` has no route back
 * from inside the app at all: the card offers system settings instead (#8), and
 * asking again would be a button that does nothing.
 */
export type LocationPermission = 'granted' | 'undetermined' | 'denied' | 'deniedForever';

export type LocationSource = {
  /** What the app already holds. Never prompts. */
  getPermission(): Promise<LocationPermission>;
  /** Raises the OS prompt. The Spanish rationale comes first — see `location-rationale.tsx` (#1). */
  requestPermission(): Promise<LocationPermission>;
  /** Location services at the OS level, which a granted permission does not imply. */
  hasServicesEnabled(): Promise<boolean>;
  /** One fix, or `null` if the phone could not produce one in time (#9). */
  getFix(options?: { timeoutMs?: number }): Promise<LocationFix | null>;
  /** The route out of `deniedForever` (#8). */
  openSettings(): Promise<void>;
};

/**
 * How long to wait for a fix before calling it no-signal (#9).
 *
 * Twelve seconds is a compromise between a cold GPS start in a warehouse, which
 * genuinely takes ten or more, and a punch button an employee is standing in
 * front of waiting to press. Timing out is not a dead end — the no-signal state
 * carries `Reintentar ubicación` (KMO-18) and a punch is still possible without
 * a fix — so the cost of cutting it short is a retry, and the cost of not
 * cutting it is a screen that never resolves.
 */
export const FIX_TIMEOUT_MS = 12_000;

/** The slice of `expo-location` used here, injected in tests. */
export type LocationModule = {
  getForegroundPermissionsAsync(): Promise<Location.LocationPermissionResponse>;
  requestForegroundPermissionsAsync(): Promise<Location.LocationPermissionResponse>;
  hasServicesEnabledAsync(): Promise<boolean>;
  getCurrentPositionAsync(options?: Location.LocationOptions): Promise<Location.LocationObject>;
};

/** The slice of `Linking` used here, injected in tests. */
export type SettingsOpener = { openSettings(): Promise<void> };

export function createLocationSource(
  module: LocationModule = Location,
  settings: SettingsOpener = Linking,
): LocationSource {
  return {
    getPermission: async () => {
      try {
        return readPermission(await module.getForegroundPermissionsAsync());
      } catch {
        // A permission stack that will not answer is one the app cannot punch
        // behind, and it is not a refusal — treated as undetermined, the screen
        // offers the rationale and lets the OS have the last word.
        return 'undetermined';
      }
    },

    requestPermission: async () => {
      try {
        return readPermission(await module.requestForegroundPermissionsAsync());
      } catch {
        return 'undetermined';
      }
    },

    hasServicesEnabled: async () => {
      try {
        return await module.hasServicesEnabledAsync();
      } catch {
        // Assume they are on. The fix attempt is about to answer the question
        // properly, and a false "no signal" over a query that merely failed
        // would hide a working GPS behind an error message.
        return true;
      }
    },

    getFix: async ({ timeoutMs = FIX_TIMEOUT_MS } = {}) => {
      const position = await withTimeout(
        module.getCurrentPositionAsync({
          // `High` rather than the `Balanced` default. Balanced is accurate to
          // about a hundred metres, which is the size of a whole geofence — at
          // that precision the card's answer would be decided by the error bar
          // rather than by where the employee is standing.
          accuracy: Location.Accuracy.High,
          // The OS's own "turn on better location" dialog, suppressed. It would
          // appear over the app with no warning and in the system's own words;
          // services being off is a state this app already draws, in Spanish,
          // with an action attached (#4).
          mayShowUserSettingsDialog: false,
        }),
        timeoutMs,
      );

      return position === null ? null : toFix(position);
    },

    openSettings: async () => {
      try {
        await settings.openSettings();
      } catch {
        // Nothing to recover to. The card is already telling them which setting
        // to change, so a phone with no settings activity to open leaves them
        // exactly where they were rather than with an error over the top.
      }
    },
  };
}

/**
 * `deniedForever` is the case Android reaches after a second refusal, and it is
 * only distinguishable through `canAskAgain` — the status alone reads `denied`
 * either way, and the difference is whether the prompt or system settings is the
 * route back (#8).
 */
function readPermission(response: Location.LocationPermissionResponse): LocationPermission {
  if (response.granted) {
    return 'granted';
  }

  if (response.status === 'undetermined') {
    return 'undetermined';
  }

  return response.canAskAgain ? 'denied' : 'deniedForever';
}

function toFix(position: Location.LocationObject): LocationFix {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    // `accuracy` is nullable on both platforms and is the radius the OS is
    // unsure within, which `evaluateGeofence` spends in the employee's favour.
    accuracyMeters: position.coords.accuracy ?? null,
  };
}

/**
 * The fix, or `null` if it did not arrive in time or at all (#9).
 *
 * There is no way to cancel `getCurrentPositionAsync` — `LocationOptions` takes
 * no signal — so a late fix is dropped rather than aborted. That is the whole
 * reason the timeout lives here instead of being asked of the module: without
 * it, a phone that never resolves leaves the card acquiring for the length of
 * the shift.
 */
async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      // A rejected fix is a `null` too: no provider, no services, a permission
      // revoked between the check and the call. Each is the same answer to the
      // screen — we do not know where you are — and none of them is an error an
      // employee can act on.
      work.catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
