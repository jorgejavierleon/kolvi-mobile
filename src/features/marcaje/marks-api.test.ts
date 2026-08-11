import { createApiClient, type ApiClient } from '@/api';

import { createMarksApi, MarksResponseError, parseMarks } from './marks-api';
import { PunchResponseError } from './punch-api';

/** One row, as `MarkResource` serialises it — the same shape the 201 answers with. */
function mark(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mark_id: 1841,
    hash: '9f2c1b0e5d4a3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443',
    datetime: '2026-08-05 08:03:11',
    type: 'in',
    geo_status: 'inside',
    folio: '20260805-0042',
    employee_name: 'María Fernanda Soto',
    employee_rut: '214375818',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientFor(fetchImpl: jest.Mock): ApiClient {
  return createApiClient({ baseUrl: 'https://ams.test/api/v1', fetch: fetchImpl });
}

describe('the marks request', () => {
  it('gets /marks', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse([mark()]));

    await createMarksApi(clientFor(fetchImpl)).fetchMarks();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://ams.test/api/v1/marks');
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('GET');
  });

  it('passes the caller’s abort signal through', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse([]));
    const controller = new AbortController();

    await createMarksApi(clientFor(fetchImpl)).fetchMarks({ signal: controller.signal });

    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('parseMarks', () => {
  it('reads a mark into the same receipt a punch answers with', () => {
    const [receipt] = parseMarks([mark()]);

    // Field for field the punch response's own contract — because it is parsed
    // by the punch response's own parser. #2 and #3 rest on this: the sheet
    // KMO-19 built draws a stored mark without knowing it is one.
    expect(receipt).toEqual({
      markId: 1841,
      type: 'in',
      datetime: '2026-08-05 08:03:11',
      hash: '9f2c1b0e5d4a3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443',
      geoStatus: 'inside',
      folio: '20260805-0042',
      employeeName: 'María Fernanda Soto',
      employeeRut: '214375818',
      capturedOffline: false,
    });
  });

  it('keeps the folio and the hash the register recorded (#3)', () => {
    const [receipt] = parseMarks([
      mark({ folio: '20260731-0007', hash: 'a'.repeat(64), mark_id: 12 }),
    ]);

    expect(receipt?.folio).toBe('20260731-0007');
    expect(receipt?.hash).toBe('a'.repeat(64));
  });

  it('accepts Laravel’s data envelope as well as a bare array', () => {
    expect(parseMarks({ data: [mark()] })).toHaveLength(1);
    expect(parseMarks([mark()])).toHaveLength(1);
  });

  it('reads an employee with no marks as an empty list, not a failure (#4)', () => {
    expect(parseMarks([])).toEqual([]);
    expect(parseMarks({ data: [] })).toEqual([]);
  });

  describe('the order (#1)', () => {
    it('puts the newest mark first whatever order the server sent', () => {
      const marks = parseMarks([
        mark({ mark_id: 1, datetime: '2026-08-03 08:01:00' }),
        mark({ mark_id: 3, datetime: '2026-08-05 08:03:11' }),
        mark({ mark_id: 2, datetime: '2026-08-04 17:59:02' }),
      ]);

      expect(marks.map((receipt) => receipt.datetime)).toEqual([
        '2026-08-05 08:03:11',
        '2026-08-04 17:59:02',
        '2026-08-03 08:01:00',
      ]);
    });

    it('orders the entrada and the salida of one day by their time', () => {
      const marks = parseMarks([
        mark({ mark_id: 10, type: 'in', datetime: '2026-08-05 08:03:11' }),
        mark({ mark_id: 11, type: 'out', datetime: '2026-08-05 18:02:40' }),
      ]);

      expect(marks.map((receipt) => receipt.type)).toEqual(['out', 'in']);
    });

    it('compares wall-clock strings rather than re-reading them as instants', () => {
      // 03:00 on the day Chile leaves DST. Read through `Date` in a zone-aware
      // way these two can collapse or invert; as naive strings the later one is
      // later, which is the only reading a legal register admits.
      const marks = parseMarks([
        mark({ mark_id: 1, datetime: '2026-04-04 23:59:59' }),
        mark({ mark_id: 2, datetime: '2026-04-05 00:00:01' }),
      ]);

      expect(marks.map((receipt) => receipt.markId)).toEqual([2, 1]);
    });

    it('breaks a tie on the mark id so the list does not reshuffle between loads', () => {
      const marks = parseMarks([
        mark({ mark_id: 7, datetime: '2026-08-05 08:03:11' }),
        mark({ mark_id: 9, datetime: '2026-08-05 08:03:11' }),
      ]);

      expect(marks.map((receipt) => receipt.markId)).toEqual([9, 7]);
    });
  });

  describe('a body that is not a list of marks', () => {
    it.each([
      ['an object with no data key', { marks: [] }],
      ['a data key that is not an array', { data: { 0: mark() } }],
      ['a bare object', mark()],
      ['a string', 'ok'],
      ['nothing at all', undefined],
    ])('fails on %s', (_case, payload) => {
      expect(() => parseMarks(payload)).toThrow(MarksResponseError);
    });
  });

  describe('a row the register sent that this app cannot read', () => {
    it('fails as a punch response error rather than dropping the row', () => {
      // Dropping it would render a history that is silently one punch short,
      // and a short history is indistinguishable from a correct one.
      expect(() => parseMarks([mark(), mark({ hash: null })])).toThrow(PunchResponseError);
    });

    it('refuses a datetime carrying an offset, in the list as on the receipt', () => {
      expect(() => parseMarks([mark({ datetime: '2026-08-05T08:03:11-04:00' })])).toThrow(
        PunchResponseError,
      );
    });

    it('takes the whole list down rather than answering with the rows that parsed', () => {
      expect(() => parseMarks([mark(), mark({ type: 'break' })])).toThrow(PunchResponseError);
    });
  });
});
