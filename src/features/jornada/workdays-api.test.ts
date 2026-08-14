import { createApiClient, type ApiClient, type NaiveDate } from '@/api';

import { createWorkdaysApi, parseWorkdays, WorkdaysResponseError } from './workdays-api';

const from = '2026-08-01' as NaiveDate;
const to = '2026-08-31' as NaiveDate;

/** One row, as the contract in `workdays-api.ts` describes it. */
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    date: '2026-08-14',
    date_label: 'Vie 14 de ago',
    weekday: 'viernes',
    status: 'regular',
    status_label: 'A tiempo',
    status_badge: 'success',
    worked_time: '08:03',
    extra_time: '00:00',
    missing_time: '00:00',
    leave_type_label: null,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parseWorkdays', () => {
  it('reads a bare array of workdays', () => {
    expect(parseWorkdays([row()])).toEqual([
      {
        date: '2026-08-14',
        statusLabel: 'A tiempo',
        statusTone: 'success',
        workedTime: '08:03',
        extraTime: '00:00',
        missingTime: '00:00',
        leaveTypeLabel: null,
      },
    ]);
  });

  it('maps each server badge tone onto the client tone', () => {
    expect(parseWorkdays([row({ status_badge: 'warning' })])[0]?.statusTone).toBe('warning');
    expect(parseWorkdays([row({ status_badge: 'destructive' })])[0]?.statusTone).toBe('danger');
  });

  it('reads an unrecognised badge tone as null rather than guessing', () => {
    expect(parseWorkdays([row({ status_badge: 'mystery' })])[0]?.statusTone).toBeNull();
  });

  it('reads a day covered by an approved leave with the figures omitted', () => {
    const [workday] = parseWorkdays([
      row({
        leave_type_label: 'Vacaciones',
        worked_time: '00:00',
        extra_time: '00:00',
        missing_time: '00:00',
        status_label: 'Justificado',
        status_badge: 'success',
      }),
    ]);

    expect(workday).toMatchObject({
      leaveTypeLabel: 'Vacaciones',
      workedTime: null,
      extraTime: null,
      missingTime: null,
    });
  });

  it('reads an empty range as an empty list', () => {
    expect(parseWorkdays([])).toEqual([]);
  });

  describe('malformed responses', () => {
    it('rejects a body that is not an array', () => {
      expect(() => parseWorkdays({ data: [] })).toThrow(WorkdaysResponseError);
    });

    it('rejects a row that is not an object', () => {
      expect(() => parseWorkdays(['nope'])).toThrow(WorkdaysResponseError);
    });

    it('rejects a row with a non-naive date', () => {
      expect(() => parseWorkdays([row({ date: '14 ago' })])).toThrow(WorkdaysResponseError);
    });
  });
});

describe('createWorkdaysApi', () => {
  function clientFor(fetchImpl: jest.Mock): ApiClient {
    return createApiClient({ baseUrl: 'https://ams.test/api/v1', fetch: fetchImpl });
  }

  it('asks GET /me/workdays with the given range', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse([row()]));

    await createWorkdaysApi(clientFor(fetchImpl)).fetchWorkdays({
      from,
      to,
    });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ams.test/api/v1/me/workdays?from=2026-08-01&to=2026-08-31');
    expect(init).toMatchObject({ method: 'GET' });
  });

  it('passes the caller’s signal through, so a screen leaving cancels its own request', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse([row()]));
    const controller = new AbortController();

    await createWorkdaysApi(clientFor(fetchImpl)).fetchWorkdays({
      from,
      to,
      signal: controller.signal,
    });

    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeDefined();
  });

  it('rejects with the transport’s own error when the server refuses', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ message: 'Nope' }, 500));

    await expect(
      createWorkdaysApi(clientFor(fetchImpl)).fetchWorkdays({ from, to }),
    ).rejects.toMatchObject({ kind: 'server' });
  });
});
