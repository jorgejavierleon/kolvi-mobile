import { createApiClient, type ApiClient } from '@/api';

import {
  createUpcomingShiftsApi,
  parseUpcomingShifts,
  UpcomingShiftsResponseError,
} from './shifts-api';

/** A complete response, as the contract in `shifts-api.ts` describes it. */
function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    date: '2026-08-13',
    today: {
      date: '2026-08-13',
      premise: 'Sucursal Ñuñoa',
      start_time: '08:00:00',
      end_time: '17:00:00',
      lunch_start_time: '13:00:00',
      lunch_end_time: '14:00:00',
      leave_type_label: null,
      holiday_name: null,
      punch_state: 'before',
    },
    days: [
      {
        date: '2026-08-14',
        premise: 'Sucursal Ñuñoa',
        start_time: '08:00:00',
        end_time: '17:00:00',
        lunch_start_time: '13:00:00',
        lunch_end_time: '14:00:00',
        leave_type_label: null,
        holiday_name: null,
      },
    ],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parseUpcomingShifts', () => {
  it('reads the top-level date, today and days out of one response', () => {
    expect(parseUpcomingShifts(payload())).toEqual({
      date: '2026-08-13',
      today: {
        date: '2026-08-13',
        premise: 'Sucursal Ñuñoa',
        startTime: '08:00:00',
        endTime: '17:00:00',
        lunch: { startTime: '13:00:00', endTime: '14:00:00' },
        leaveTypeLabel: null,
        holidayName: null,
        punchState: 'before',
      },
      days: [
        {
          date: '2026-08-14',
          premise: 'Sucursal Ñuñoa',
          startTime: '08:00:00',
          endTime: '17:00:00',
          lunch: { startTime: '13:00:00', endTime: '14:00:00' },
          leaveTypeLabel: null,
          holidayName: null,
        },
      ],
    });
  });

  it('rejects a datetime with an offset stamped on it', () => {
    expect(() => parseUpcomingShifts(payload({ date: '2026-08-13T00:00:00-04:00' }))).toThrow(
      UpcomingShiftsResponseError,
    );
  });

  describe('today', () => {
    it('reads an explicit null as nothing scheduled', () => {
      expect(parseUpcomingShifts(payload({ today: null })).today).toBeNull();
    });

    it('reads punch_state as null when the field is absent — never fabricated', () => {
      const { punch_state: _omitted, ...todayWithoutPunchState } = payload().today as Record<
        string,
        unknown
      >;

      const summary = parseUpcomingShifts(payload({ today: todayWithoutPunchState }));

      expect(summary.today?.punchState).toBeNull();
    });

    it('rejects an unrecognised punch_state rather than guessing', () => {
      const summary = parseUpcomingShifts(
        payload({
          today: { ...(payload().today as Record<string, unknown>), punch_state: 'on_break' },
        }),
      );

      expect(summary.today?.punchState).toBeNull();
    });
  });

  describe('an annotated date', () => {
    it('reads a leave-covered date with no schedule fields', () => {
      const summary = parseUpcomingShifts(
        payload({
          days: [
            {
              date: '2026-08-14',
              premise: 'Sucursal Ñuñoa',
              start_time: null,
              end_time: null,
              lunch_start_time: null,
              lunch_end_time: null,
              leave_type_label: 'Vacaciones',
              holiday_name: null,
            },
          ],
        }),
      );

      expect(summary.days[0]).toEqual({
        date: '2026-08-14',
        premise: 'Sucursal Ñuñoa',
        startTime: null,
        endTime: null,
        lunch: null,
        leaveTypeLabel: 'Vacaciones',
        holidayName: null,
      });
    });

    it('reads a holiday-covered date the same way', () => {
      const summary = parseUpcomingShifts(
        payload({
          days: [
            {
              date: '2026-08-15',
              premise: 'Sucursal Ñuñoa',
              start_time: null,
              end_time: null,
              lunch_start_time: null,
              lunch_end_time: null,
              leave_type_label: null,
              holiday_name: 'Fiestas Patrias',
            },
          ],
        }),
      );

      expect(summary.days[0]?.holidayName).toBe('Fiestas Patrias');
      expect(summary.days[0]?.startTime).toBeNull();
    });
  });

  describe('the colación window', () => {
    it('is null when either end is missing — half a window is treated as none', () => {
      const summary = parseUpcomingShifts(
        payload({
          days: [
            {
              date: '2026-08-14',
              premise: 'Sucursal Ñuñoa',
              start_time: '08:00:00',
              end_time: '17:00:00',
              lunch_start_time: '13:00:00',
              lunch_end_time: null,
              leave_type_label: null,
              holiday_name: null,
            },
          ],
        }),
      );

      expect(summary.days[0]?.lunch).toBeNull();
    });
  });

  describe('malformed responses', () => {
    it('rejects a body that is not an object', () => {
      expect(() => parseUpcomingShifts('nope')).toThrow(UpcomingShiftsResponseError);
    });

    it('rejects days that is not an array', () => {
      expect(() => parseUpcomingShifts(payload({ days: {} }))).toThrow(UpcomingShiftsResponseError);
    });

    it('rejects a day entry with a non-naive date', () => {
      const [firstDay] = payload().days as [Record<string, unknown>];

      expect(() =>
        parseUpcomingShifts(payload({ days: [{ ...firstDay, date: '14 ago' }] })),
      ).toThrow(UpcomingShiftsResponseError);
    });
  });
});

describe('createUpcomingShiftsApi', () => {
  function clientFor(fetchImpl: jest.Mock): ApiClient {
    return createApiClient({ baseUrl: 'https://ams.test/api/v1', fetch: fetchImpl });
  }

  it('asks GET /me/shifts/upcoming', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(payload()));

    await createUpcomingShiftsApi(clientFor(fetchImpl)).fetchUpcomingShifts();

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ams.test/api/v1/me/shifts/upcoming');
    expect(init).toMatchObject({ method: 'GET' });
  });

  it('sends days as a query param when given one', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(payload()));

    await createUpcomingShiftsApi(clientFor(fetchImpl)).fetchUpcomingShifts({ days: 7 });

    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe('https://ams.test/api/v1/me/shifts/upcoming?days=7');
  });

  it('passes the caller’s signal through, so a screen leaving cancels its own request', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(payload()));
    const controller = new AbortController();

    await createUpcomingShiftsApi(clientFor(fetchImpl)).fetchUpcomingShifts({
      signal: controller.signal,
    });

    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeDefined();
  });

  it('rejects with the transport’s own error when the server refuses', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ message: 'Nope' }, 500));

    await expect(
      createUpcomingShiftsApi(clientFor(fetchImpl)).fetchUpcomingShifts(),
    ).rejects.toMatchObject({ kind: 'server' });
  });
});
