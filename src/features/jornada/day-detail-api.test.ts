import { createApiClient, type ApiClient, type NaiveDate } from '@/api';

import { createDayDetailApi, DayDetailResponseError, parseDayDetail } from './day-detail-api';

const date = '2026-08-14' as NaiveDate;

/** One workday detail, as the contract in `day-detail-api.ts` describes it. */
function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    date: '2026-08-14',
    status: 'regular',
    status_label: 'A tiempo',
    status_badge: 'success',
    shift_start: '08:00:00',
    shift_end: '17:00:00',
    worked_time: '08:03',
    extra_time: '00:00',
    missing_time: '00:00',
    leave_type_label: null,
    mark_in: { time: '08:02:00', mark_id: 501 },
    mark_out: { time: '17:05:00', mark_id: 502 },
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parseDayDetail', () => {
  it('reads the shift window, the figures and both punches', () => {
    expect(parseDayDetail(date, body())).toEqual({
      date,
      statusLabel: 'A tiempo',
      statusTone: 'success',
      shiftStart: '08:00:00',
      shiftEnd: '17:00:00',
      workedTime: '08:03',
      extraTime: '00:00',
      missingTime: '00:00',
      leaveTypeLabel: null,
      markIn: { time: '08:02:00', markId: 501 },
      markOut: { time: '17:05:00', markId: 502 },
    });
  });

  it('reads a day with no shift assigned as a null window', () => {
    const detail = parseDayDetail(date, body({ shift_start: null, shift_end: null }));

    expect(detail.shiftStart).toBeNull();
    expect(detail.shiftEnd).toBeNull();
  });

  it('reads a day with only one recorded punch without fabricating the other (#6)', () => {
    const detail = parseDayDetail(date, body({ mark_out: null }));

    expect(detail.markIn).toEqual({ time: '08:02:00', markId: 501 });
    expect(detail.markOut).toBeNull();
  });

  it('reads a day covered by an approved leave with the figures omitted (#7)', () => {
    const detail = parseDayDetail(
      date,
      body({
        leave_type_label: 'Vacaciones',
        worked_time: '00:00',
        extra_time: '00:00',
        missing_time: '00:00',
      }),
    );

    expect(detail).toMatchObject({
      leaveTypeLabel: 'Vacaciones',
      workedTime: null,
      extraTime: null,
      missingTime: null,
    });
  });

  it('maps each server badge tone onto the client tone', () => {
    expect(parseDayDetail(date, body({ status_badge: 'warning' })).statusTone).toBe('warning');
    expect(parseDayDetail(date, body({ status_badge: 'destructive' })).statusTone).toBe('danger');
  });

  describe('malformed responses', () => {
    it('rejects a body that is not an object', () => {
      expect(() => parseDayDetail(date, ['nope'])).toThrow(DayDetailResponseError);
    });

    it('rejects a mark whose mark_id is not a positive integer', () => {
      expect(() =>
        parseDayDetail(date, body({ mark_in: { time: '08:02:00', mark_id: 0 } })),
      ).toThrow(DayDetailResponseError);
    });

    it('rejects a shift_start that is not a naive time', () => {
      expect(() => parseDayDetail(date, body({ shift_start: '8am' }))).toThrow(
        DayDetailResponseError,
      );
    });
  });
});

describe('createDayDetailApi', () => {
  function clientFor(fetchImpl: jest.Mock): ApiClient {
    return createApiClient({ baseUrl: 'https://ams.test/api/v1', fetch: fetchImpl });
  }

  it('asks GET /me/workdays/{date}', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(body()));

    await createDayDetailApi(clientFor(fetchImpl)).fetchDayDetail(date);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ams.test/api/v1/me/workdays/2026-08-14');
    expect(init).toMatchObject({ method: 'GET' });
  });

  it('rejects with the transport’s own error on a 404', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ message: 'Not found' }, 404));

    await expect(
      createDayDetailApi(clientFor(fetchImpl)).fetchDayDetail(date),
    ).rejects.toMatchObject({ kind: 'notFound' });
  });
});
