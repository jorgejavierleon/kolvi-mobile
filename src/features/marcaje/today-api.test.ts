import { createApiClient, type ApiClient } from '@/api';

import { createTodayApi, parseTodaySummary, TodayResponseError } from './today-api';

/** A complete response, as the contract in `today-api.ts` describes it. */
function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    date: '2026-08-04',
    shift: {
      premise: 'Sucursal Ñuñoa',
      start_time: '08:00:00',
      end_time: '17:00:00',
      lunch_start_time: '13:00:00',
      lunch_end_time: '14:00:00',
      geofence: { lat: -33.4569, lng: -70.5975, radius_meters: 150 },
    },
    punch: { state: 'before' },
    week: { worked_hours: 32.5, contracted_hours: 44 },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parseTodaySummary', () => {
  it('reads the whole screen out of one response', () => {
    expect(parseTodaySummary(payload())).toEqual({
      date: '2026-08-04',
      shift: {
        premise: 'Sucursal Ñuñoa',
        startTime: '08:00:00',
        endTime: '17:00:00',
        lunch: { startTime: '13:00:00', endTime: '14:00:00' },
        geofence: { latitude: -33.4569, longitude: -70.5975, radiusMeters: 150 },
      },
      punchState: 'before',
      week: { workedHours: 32.5, contractedHours: 44 },
    });
  });

  it('keeps the wall-clock strings exactly as they arrived', () => {
    // Res. 38 Art. 8: a shift window redisplayed an hour off is a different fact
    // with nothing on screen to say it changed. The naive types exist so this
    // cannot happen by accident; the assertion is here so it cannot happen on
    // purpose either.
    const summary = parseTodaySummary(payload());

    expect(summary.shift?.startTime).toBe('08:00:00');
    expect(summary.date).toBe('2026-08-04');
  });

  it('rejects a datetime with an offset stamped on it', () => {
    // `MarkResource` in `ams` emits `toIso8601String()` today (PRD §3.2). If the
    // new endpoint does the same, this is where it is caught.
    expect(() => parseTodaySummary(payload({ date: '2026-08-04T00:00:00-04:00' }))).toThrow(
      TodayResponseError,
    );
  });

  describe('a day with nothing scheduled', () => {
    it('reads an explicit null shift as no shift', () => {
      expect(parseTodaySummary(payload({ shift: null })).shift).toBeNull();
    });

    it('reads an omitted shift the same way', () => {
      const { shift: _omitted, ...withoutShift } = payload();

      expect(parseTodaySummary(withoutShift).shift).toBeNull();
    });
  });

  describe('the colación window', () => {
    it('is null when the shift carries none', () => {
      const summary = parseTodaySummary(
        payload({
          shift: { premise: 'Sucursal Ñuñoa', start_time: '08:00:00', end_time: '17:00:00' },
        }),
      );

      expect(summary.shift?.lunch).toBeNull();
    });

    it('is null when only one end of it arrived, rather than half a range', () => {
      const summary = parseTodaySummary(
        payload({
          shift: {
            premise: 'Sucursal Ñuñoa',
            start_time: '08:00:00',
            end_time: '17:00:00',
            lunch_start_time: '13:00:00',
            lunch_end_time: null,
          },
        }),
      );

      expect(summary.shift?.lunch).toBeNull();
    });
  });

  describe('the geofence (KMO-16)', () => {
    /** A shift with whatever geofence the case is about, and nothing else new. */
    function shiftWith(geofence: unknown): Record<string, unknown> {
      return payload({
        shift: {
          premise: 'Sucursal Ñuñoa',
          start_time: '08:00:00',
          end_time: '17:00:00',
          ...(geofence === undefined ? {} : { geofence }),
        },
      });
    }

    // The ordinary case until `ams` KOL-33 ships, and a defined state rather
    // than a degraded one: no geofence is a premise nobody configured one for.
    it('is null when the shift carries none', () => {
      expect(parseTodaySummary(shiftWith(undefined)).shift?.geofence).toBeNull();
      expect(parseTodaySummary(shiftWith(null)).shift?.geofence).toBeNull();
    });

    // #6. The premise is on the map but has no radius, which is not the same
    // thing as having no geofence — the card still names the distance.
    it('keeps the coordinates when no radius is configured', () => {
      expect(
        parseTodaySummary(shiftWith({ lat: -33.4569, lng: -70.5975, radius_meters: null })).shift
          ?.geofence,
      ).toEqual({ latitude: -33.4569, longitude: -70.5975, radiusMeters: null });
    });

    // Latitude and longitude are both plausible numbers, so a server that sends
    // them the other way round renders every state on the card correctly while
    // measuring against a premise in the wrong ocean.
    it('refuses a latitude outside its own hemisphere range', () => {
      expect(() => parseTodaySummary(shiftWith({ lat: -70.5975, lng: -33.4569 }))).not.toThrow();
      expect(() => parseTodaySummary(shiftWith({ lat: -100, lng: -70.5975 }))).toThrow(
        TodayResponseError,
      );
      expect(() => parseTodaySummary(shiftWith({ lat: -33.4569, lng: 200 }))).toThrow(
        TodayResponseError,
      );
    });

    it.each([
      ['a string, which is what a decimal cast emits', { lat: '-33.4569', lng: '-70.5975' }],
      ['half a pair', { lat: -33.4569 }],
      ['not an object at all', 'Sucursal Ñuñoa'],
    ])('refuses a geofence that is %s', (_case, geofence) => {
      expect(() => parseTodaySummary(shiftWith(geofence))).toThrow(TodayResponseError);
    });

    // A radius nobody can stand inside puts every employee out of range at a
    // premise they are standing in.
    it.each([0, -150])('refuses a radius of %s metres', (radius) => {
      expect(() =>
        parseTodaySummary(shiftWith({ lat: -33.4569, lng: -70.5975, radius_meters: radius })),
      ).toThrow(TodayResponseError);
    });
  });

  describe('the punch state', () => {
    it('is null when the response carries no punch block', () => {
      // An employee without `ClockOwn:Mark` has no punch state, and still gets a
      // working tab (#8).
      const { punch: _omitted, ...withoutPunch } = payload();

      expect(parseTodaySummary(withoutPunch).punchState).toBeNull();
    });

    it('is null for a state the decision record does not have', () => {
      expect(parseTodaySummary(payload({ punch: { state: 'break' } })).punchState).toBeNull();
    });
  });

  describe('the week summary', () => {
    it('is null when the server sent none', () => {
      expect(parseTodaySummary(payload({ week: null })).week).toBeNull();
    });

    it('is null when nothing is contracted, rather than a 0 / 0 week', () => {
      expect(
        parseTodaySummary(payload({ week: { worked_hours: 0, contracted_hours: 0 } })).week,
      ).toBeNull();
    });

    it('keeps a zero numerator — a week that has not started is not a missing week', () => {
      expect(
        parseTodaySummary(payload({ week: { worked_hours: 0, contracted_hours: 44 } })).week,
      ).toEqual({ workedHours: 0, contractedHours: 44 });
    });

    it('refuses negative worked time rather than rendering it', () => {
      // A server-side arithmetic bug. `formatDecimalHours` would throw mid-render
      // and take the tab with it; caught here it is a retry.
      expect(() =>
        parseTodaySummary(payload({ week: { worked_hours: -1, contracted_hours: 44 } })),
      ).toThrow(TodayResponseError);
    });
  });

  describe('a response that is not one', () => {
    it.each([
      ['not an object', 'nope'],
      ['an array', []],
      ['null', null],
      ['missing its date', { shift: null }],
      [
        'carrying a shift with no premise',
        payload({ shift: { start_time: '08:00:00', end_time: '17:00:00' } }),
      ],
      [
        'carrying a shift window that is not a wall clock',
        payload({ shift: { premise: 'Sucursal Ñuñoa', start_time: '8am', end_time: '17:00:00' } }),
      ],
    ])('throws for a body %s', (_case, body) => {
      expect(() => parseTodaySummary(body)).toThrow(TodayResponseError);
    });
  });
});

describe('createTodayApi', () => {
  function clientFor(fetchImpl: jest.Mock): ApiClient {
    return createApiClient({ baseUrl: 'https://ams.test/api/v1', fetch: fetchImpl });
  }

  it('asks GET /me/today and nothing else — the screen costs one request (#6)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(payload()));

    await createTodayApi(clientFor(fetchImpl)).fetchToday();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://ams.test/api/v1/me/today');
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
  });

  it('passes the caller’s signal through, so a screen leaving cancels its own request', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(payload()));
    const controller = new AbortController();

    await createTodayApi(clientFor(fetchImpl)).fetchToday({ signal: controller.signal });

    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeDefined();
  });

  it('rejects with the transport’s own error when the server refuses', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ message: 'Nope' }, 500));

    await expect(createTodayApi(clientFor(fetchImpl)).fetchToday()).rejects.toMatchObject({
      kind: 'server',
    });
  });
});
