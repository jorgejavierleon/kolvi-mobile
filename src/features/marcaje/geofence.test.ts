import { distanceBetween, evaluateGeofence, type LocationFix } from './geofence';
import type { Geofence } from './today-api';

/** Plaza Ñuñoa, and the premise the fixtures below measure against. */
const premise: Geofence = { latitude: -33.4569, longitude: -70.5975, radiusMeters: 150 };

function fixAt(
  latitude: number,
  longitude: number,
  accuracyMeters: number | null = 5,
): LocationFix {
  return { latitude, longitude, accuracyMeters };
}

/** Roughly `metres` north of the premise. One degree of latitude is ~111.32 km. */
function metresNorth(metres: number): LocationFix {
  return fixAt(premise.latitude + metres / 111_320, premise.longitude);
}

describe('distanceBetween', () => {
  it('is zero for a point and itself', () => {
    expect(distanceBetween(premise, premise)).toBe(0);
  });

  // One degree of latitude is ~111.32 km anywhere on the sphere, which is the
  // one distance that can be checked without trusting the implementation.
  it('measures a degree of latitude as about 111 km', () => {
    const north = { latitude: premise.latitude + 1, longitude: premise.longitude };

    expect(distanceBetween(premise, north)).toBeGreaterThan(111_000);
    expect(distanceBetween(premise, north)).toBeLessThan(111_400);
  });

  it('measures the same distance in both directions', () => {
    const elsewhere = { latitude: -33.4372, longitude: -70.6506 };

    expect(distanceBetween(premise, elsewhere)).toBeCloseTo(distanceBetween(elsewhere, premise), 6);
  });

  it('is accurate at the scale a geofence works over', () => {
    expect(distanceBetween(premise, metresNorth(100))).toBeCloseTo(100, 0);
  });

  // A longitude that crosses ±180 subtracts to nearly 360 degrees, and a formula
  // that took that literally would put two adjacent points half a planet apart.
  it('crosses the antimeridian the short way', () => {
    expect(
      distanceBetween({ latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 }),
    ).toBeLessThan(500);
  });
});

describe('evaluateGeofence', () => {
  // #2 — inside the radius, with the distance the card names in its subtitle.
  it('confirms a fix inside the radius and reports how far in it is', () => {
    const verdict = evaluateGeofence(metresNorth(12), premise);

    expect(verdict.kind).toBe('confirmed');
    expect(verdict.distanceMeters).toBeCloseTo(12, 0);
  });

  // #3 — outside it, and still carrying the distance, because the state is about
  // the employee's position and not about the app having failed.
  it('reports a fix beyond the radius as outside', () => {
    const verdict = evaluateGeofence(metresNorth(400), premise);

    expect(verdict.kind).toBe('outside');
    expect(verdict.distanceMeters).toBeCloseTo(400, 0);
  });

  // The advisory asymmetry. A phone that cannot tell whether it is in or out
  // must not be the reason someone at their own gate is refused.
  it('gives an imprecise fix the benefit of the doubt', () => {
    expect(evaluateGeofence(fixAt(...atMetres(200), 80), premise).kind).toBe('confirmed');
    expect(evaluateGeofence(fixAt(...atMetres(200), 5), premise).kind).toBe('outside');
  });

  it('treats a missing accuracy as no slack rather than as unlimited slack', () => {
    expect(evaluateGeofence(fixAt(...atMetres(200), null), premise).kind).toBe('outside');
  });

  // A negative accuracy is a driver bug; read as slack it would confirm anything.
  it('ignores a negative accuracy', () => {
    expect(evaluateGeofence(fixAt(...atMetres(200), -1000), premise).kind).toBe('outside');
  });

  it('confirms a fix exactly on the boundary', () => {
    expect(evaluateGeofence(fixAt(...atMetres(150), 0), premise).kind).toBe('confirmed');
  });

  // #6, both halves.
  describe('a premise with no geofence', () => {
    it('is never out of range when it has no radius, however far away the phone is', () => {
      const verdict = evaluateGeofence(metresNorth(40_000), { ...premise, radiusMeters: null });

      expect(verdict.kind).toBe('confirmed');
      // Forty kilometres away, give or take what `metresNorth`'s flat-earth
      // arithmetic drifts by at that range. The point is the verdict, not the number.
      expect(verdict.distanceMeters).toBeGreaterThan(39_000);
    });

    it('is confirmed with no distance at all when there are no coordinates', () => {
      expect(evaluateGeofence(metresNorth(40_000), null)).toEqual({
        kind: 'confirmed',
        distanceMeters: null,
      });
    });
  });
});

/** The latitude/longitude pair roughly `metres` north of the premise. */
function atMetres(metres: number): [number, number] {
  return [premise.latitude + metres / 111_320, premise.longitude];
}
