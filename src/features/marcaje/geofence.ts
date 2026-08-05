/**
 * How far the phone is from the premise, and whether that still counts.
 *
 * **Advisory only.** Every state this module produces is a label on a card the
 * employee reads before they tap; the server evaluates the geofence again when
 * the punch arrives and its answer is the one that goes in the register
 * (docs/design-decisions.md §2). Nothing here may ever be treated as the
 * decision — a phone that has been in a lift for thirty seconds is wrong about
 * where it is, and an app that trusted itself over the server would refuse
 * punches at a premise the employee is standing in.
 *
 * That asymmetry is what shapes the rules below. `confirmed` is the answer
 * whenever the app cannot show otherwise, because the cost of a wrong
 * `confirmed` is a punch the server flags for review, while the cost of a wrong
 * `outside` is an employee at their own gate being told they are not.
 */

import type { Geofence } from './today-api';

/** A reading from the phone. `accuracyMeters` is the radius the OS is unsure within. */
export type LocationFix = {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number | null;
};

/**
 * What the punch reports about where it was made, mirroring the server's own
 * column (PRD §6): inside the geofence, outside it, or no fix at all.
 *
 * `unknown` is a first-class answer and not a missing one. A punch made with a
 * permission the employee refused travels as `unknown` and is recorded —
 * blocking it would make attendance unrecordable, which is a legal problem
 * rather than a product one (KMO-16 #7). KMO-17 #5 and #11 put it on the wire.
 *
 * It lives here rather than beside the hook that produces it because it is also
 * what comes *back*: the server evaluates the geofence again at punch time and
 * its verdict is the one on the record (docs/design-decisions.md §2), so both
 * ends of `punch-api.ts` read this union.
 */
export const geoStatuses = ['inside', 'outside', 'unknown'] as const;

export type GeoStatus = (typeof geoStatuses)[number];

/**
 * What the card says. `distanceMeters` is `null` only when there was nothing to
 * measure against — a premise the server sent no coordinates for.
 */
export type GeofenceVerdict =
  | { readonly kind: 'confirmed'; readonly distanceMeters: number | null }
  | { readonly kind: 'outside'; readonly distanceMeters: number };

/** Mean Earth radius, in metres — the sphere the haversine below assumes. */
const EARTH_RADIUS_METERS = 6_371_008.8;

/**
 * Is this fix inside the premise, and how far from it (KMO-16 #2, #3, #6).
 *
 * Two absences both mean "not out of range", and for different reasons: a
 * premise with no coordinates cannot be measured against at all, and a premise
 * with no radius is one nobody configured a geofence for. Neither is a state an
 * employee can act on, and neither may block a punch (#6).
 */
export function evaluateGeofence(fix: LocationFix, geofence: Geofence | null): GeofenceVerdict {
  if (geofence === null) {
    return { kind: 'confirmed', distanceMeters: null };
  }

  const distance = distanceBetween(fix, geofence);

  if (geofence.radiusMeters === null) {
    return { kind: 'confirmed', distanceMeters: distance };
  }

  /**
   * The fix's own uncertainty counts in the employee's favour. A ±60 m urban fix
   * measured at 130 m from a premise with a 100 m radius is a phone that cannot
   * tell whether it is inside or out — and calling that `outside` disables the
   * punch button and pushes someone standing at their own gate onto the override
   * that flags their mark for review. The server still decides; this only
   * chooses which way the card leans while it is unsure.
   */
  const uncertainty = fix.accuracyMeters === null ? 0 : Math.max(0, fix.accuracyMeters);

  return distance - uncertainty <= geofence.radiusMeters
    ? { kind: 'confirmed', distanceMeters: distance }
    : { kind: 'outside', distanceMeters: distance };
}

/**
 * Great-circle metres between two points, by the haversine formula.
 *
 * A sphere rather than the WGS-84 ellipsoid: the error is about 0.3%, which at
 * the scale a geofence works over — a couple of hundred metres — is well under a
 * metre, and far inside the accuracy of any phone fix it is compared against.
 */
export function distanceBetween(
  from: { readonly latitude: number; readonly longitude: number },
  to: { readonly latitude: number; readonly longitude: number },
): number {
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
