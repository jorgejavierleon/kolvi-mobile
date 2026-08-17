import { createApiClient, type ApiClient } from '@/api';

import {
  createPendingCorrectionsApi,
  parsePendingCorrections,
  PendingCorrectionsResponseError,
} from './corrections-api';

/** One row, as the contract in `corrections-api.ts` describes it. */
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    workday_id: 10,
    mark_type_label: 'Entrada',
    original_time: '08:00',
    proposed_time: '08:32',
    reason: 'Olvido de marcar',
    requested_by: 'Ana Pérez',
    expires_at: '2026-08-19 08:00:00',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

describe('parsePendingCorrections', () => {
  it('reads a bare array of corrections', () => {
    expect(parsePendingCorrections([row()])).toEqual([
      {
        id: 1,
        workdayId: 10,
        markTypeLabel: 'Entrada',
        originalTime: '08:00',
        proposedTime: '08:32',
        reason: 'Olvido de marcar',
        requestedBy: 'Ana Pérez',
        expiresAt: '2026-08-19 08:00:00',
      },
    ]);
  });

  it('reads a correction with no prior mark as a null original time', () => {
    const [correction] = parsePendingCorrections([row({ original_time: null })]);

    expect(correction?.originalTime).toBeNull();
  });

  it('reads an empty list as an empty array', () => {
    expect(parsePendingCorrections([])).toEqual([]);
  });

  describe('malformed responses', () => {
    it('rejects a body that is not an array', () => {
      expect(() => parsePendingCorrections({ data: [] })).toThrow(PendingCorrectionsResponseError);
    });

    it('rejects a row that is not an object', () => {
      expect(() => parsePendingCorrections(['nope'])).toThrow(PendingCorrectionsResponseError);
    });

    it('rejects a row with no id', () => {
      expect(() => parsePendingCorrections([row({ id: null })])).toThrow(
        PendingCorrectionsResponseError,
      );
    });

    it('rejects a row with a non-naive expires_at', () => {
      expect(() => parsePendingCorrections([row({ expires_at: '19 ago' })])).toThrow(
        PendingCorrectionsResponseError,
      );
    });
  });
});

describe('createPendingCorrectionsApi', () => {
  function clientFor(fetchImpl: jest.Mock): ApiClient {
    return createApiClient({ baseUrl: 'https://ams.test/api/v1', fetch: fetchImpl });
  }

  it('asks GET /me/mark-modifications', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse([row()]));

    await createPendingCorrectionsApi(clientFor(fetchImpl)).fetchPendingCorrections();

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ams.test/api/v1/me/mark-modifications');
    expect(init).toMatchObject({ method: 'GET' });
  });

  it('posts approve to the workday and modification in the path', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(emptyResponse());

    await createPendingCorrectionsApi(clientFor(fetchImpl)).approve(10, 1);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ams.test/api/v1/me/workdays/10/modifications/1/approve');
    expect(init).toMatchObject({ method: 'POST' });
  });

  it('posts decline to the workday and modification in the path', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(emptyResponse());

    await createPendingCorrectionsApi(clientFor(fetchImpl)).decline(10, 1);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ams.test/api/v1/me/workdays/10/modifications/1/decline');
    expect(init).toMatchObject({ method: 'POST' });
  });

  it('rejects with the transport’s own error when approve is refused', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ message: 'Nope' }, 403));

    await expect(
      createPendingCorrectionsApi(clientFor(fetchImpl)).approve(10, 1),
    ).rejects.toMatchObject({ kind: 'forbidden' });
  });
});
