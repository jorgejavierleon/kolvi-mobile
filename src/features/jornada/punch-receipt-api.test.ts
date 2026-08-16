import { createApiClient, type ApiClient } from '@/api';

import {
  createPunchReceiptApi,
  parsePunchReceipt,
  PunchReceiptResponseError,
} from './punch-receipt-api';

/** A complete mark, as `MarkResource` describes it. */
function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mark_id: 1841,
    hash: '9f2c1b0e5d4a3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443',
    datetime: '2026-08-05 08:03:11',
    type: 'in',
    geo_status: 'inside',
    folio: '20260805-0042',
    employee_name: 'María Fernanda Soto',
    employee_rut: '214375818',
    device_datetime: null,
    synced_at: '2026-08-05 08:03:11',
    captured_offline: false,
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parsePunchReceipt', () => {
  it('reads a confirmed mark', () => {
    expect(parsePunchReceipt(body())).toEqual({
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

  it('reads a mark once captured offline, as provenance rather than a live state', () => {
    expect(parsePunchReceipt(body({ captured_offline: true })).capturedOffline).toBe(true);
  });

  it('reads a missing folio and rut as null rather than a blank string', () => {
    const receipt = parsePunchReceipt(body({ folio: null, employee_rut: null }));

    expect(receipt.folio).toBeNull();
    expect(receipt.employeeRut).toBeNull();
  });

  it('reads a missing geo_status as unknown', () => {
    expect(parsePunchReceipt(body({ geo_status: null })).geoStatus).toBe('unknown');
  });

  describe('malformed responses', () => {
    it('rejects a body that is not an object', () => {
      expect(() => parsePunchReceipt(['nope'])).toThrow(PunchReceiptResponseError);
    });

    it('rejects a mark_id that is not a positive integer', () => {
      expect(() => parsePunchReceipt(body({ mark_id: 0 }))).toThrow(PunchReceiptResponseError);
    });

    it('rejects a datetime that is not naive Santiago wall-clock', () => {
      expect(() => parsePunchReceipt(body({ datetime: '2026-08-05T08:03:11-04:00' }))).toThrow(
        PunchReceiptResponseError,
      );
    });

    it('rejects a blank hash', () => {
      expect(() => parsePunchReceipt(body({ hash: '' }))).toThrow(PunchReceiptResponseError);
    });
  });
});

describe('createPunchReceiptApi', () => {
  function clientFor(fetchImpl: jest.Mock): ApiClient {
    return createApiClient({ baseUrl: 'https://ams.test/api/v1', fetch: fetchImpl });
  }

  it('asks GET /marks/{mark_id}', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(body()));

    await createPunchReceiptApi(clientFor(fetchImpl)).fetchPunchReceipt(1841);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ams.test/api/v1/marks/1841');
    expect(init).toMatchObject({ method: 'GET' });
  });

  it('rejects with the transport’s own error on a 404', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ message: 'Not found' }, 404));

    await expect(
      createPunchReceiptApi(clientFor(fetchImpl)).fetchPunchReceipt(1841),
    ).rejects.toMatchObject({ kind: 'notFound' });
  });
});
