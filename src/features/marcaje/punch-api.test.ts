import { ApiError, createApiClient, type ApiClient } from '@/api';

import {
  createPunchApi,
  DuplicateMarkError,
  isDuplicateMarkError,
  parsePunchReceipt,
  PunchResponseError,
  type PunchRequest,
} from './punch-api';

/** A complete 201, as the contract in `punch-api.ts` describes it. */
function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mark_id: 1841,
    hash: '9f2c1b0e5d4a3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443',
    datetime: '2026-08-05 08:03:11',
    type: 'in',
    geo_status: 'inside',
    // The Art. 13 identity, which `ams` KOL-35 added to `MarkResource`. The RUT
    // arrives undotted, exactly as `users.rut` holds it.
    folio: '20260805-0042',
    employee_name: 'María Fernanda Soto',
    employee_rut: '214375818',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientFor(fetchImpl: jest.Mock): ApiClient {
  return createApiClient({ baseUrl: 'https://ams.test/api/v1', fetch: fetchImpl });
}

/** A punch with a fix on it, unless the case is about not having one. */
function request(overrides: Partial<PunchRequest> = {}): PunchRequest {
  return {
    type: 'in',
    fix: { latitude: -33.4569, longitude: -70.5975, accuracyMeters: 12.4 },
    geoStatus: 'inside',
    ...overrides,
  };
}

/** The body the app actually put on the wire. */
async function bodySentBy(
  fetchImpl: jest.Mock,
  overrides: Partial<PunchRequest> = {},
): Promise<Record<string, unknown>> {
  await createPunchApi(clientFor(fetchImpl)).punch(request(overrides));

  return JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
}

describe('the punch request', () => {
  let fetchImpl: jest.Mock;

  beforeEach(() => {
    fetchImpl = jest.fn().mockResolvedValue(jsonResponse(payload()));
  });

  it('posts to /marks', async () => {
    await createPunchApi(clientFor(fetchImpl)).punch(request());

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://ams.test/api/v1/marks');
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
  });

  // #4, and the reason this file exists at all. Res. 38 Art. 11 makes the
  // register the legal record, and a time the phone chooses is a time the phone
  // can falsify — so the app does not merely leave the field out when it is
  // unsure, it has no code that could ever fill it in.
  it('carries no timestamp of any kind', async () => {
    const body = await bodySentBy(fetchImpl);

    expect(body).not.toHaveProperty('datetime');
    expect(Object.keys(body)).toEqual(['type', 'lat', 'lng', 'accuracy_m', 'geo_status']);
  });

  it('sends the fix and its accuracy in ams’ own spelling', async () => {
    expect(await bodySentBy(fetchImpl)).toEqual({
      type: 'in',
      lat: -33.4569,
      lng: -70.5975,
      accuracy_m: 12.4,
      geo_status: 'inside',
    });
  });

  it('sends salida as out', async () => {
    expect(await bodySentBy(fetchImpl, { type: 'out' })).toMatchObject({ type: 'out' });
  });

  // #5 and #11. The employee who refused the permission for good still punches;
  // what must not happen is their mark arriving indistinguishable from one whose
  // location the client silently dropped.
  it('sends the absence of a fix explicitly rather than omitting the keys', async () => {
    const body = await bodySentBy(fetchImpl, { fix: null, geoStatus: 'unknown' });

    expect(body).toEqual({
      type: 'in',
      lat: null,
      lng: null,
      accuracy_m: null,
      geo_status: 'unknown',
    });
    // The distinction the server has to be able to draw: present-and-null, not
    // missing.
    for (const key of ['lat', 'lng', 'accuracy_m']) {
      expect(Object.hasOwn(body, key)).toBe(true);
    }
  });

  // A phone can answer with a position and no accuracy at all. That is still a
  // fix worth sending — the coordinates are the evidence; the accuracy is what
  // the server spends deciding how much to trust them.
  it('sends a fix whose accuracy the phone did not report', async () => {
    const body = await bodySentBy(fetchImpl, {
      fix: { latitude: -33.4569, longitude: -70.5975, accuracyMeters: null },
    });

    expect(body).toMatchObject({ lat: -33.4569, lng: -70.5975, accuracy_m: null });
  });

  it('passes the caller’s abort signal through', async () => {
    const controller = new AbortController();

    await createPunchApi(clientFor(fetchImpl)).punch(request(), { signal: controller.signal });

    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeDefined();
  });
});

describe('parsePunchReceipt', () => {
  it('reads the receipt the server recorded', () => {
    expect(parsePunchReceipt(payload())).toEqual({
      markId: 1841,
      type: 'in',
      datetime: '2026-08-05 08:03:11',
      hash: '9f2c1b0e5d4a3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443',
      geoStatus: 'inside',
      folio: '20260805-0042',
      employeeName: 'María Fernanda Soto',
      employeeRut: '214375818',
    });
  });

  // #4's other half. The time on the receipt is the server's, and it is shown
  // exactly as it arrived.
  it('keeps the wall-clock string exactly as it arrived', () => {
    expect(parsePunchReceipt(payload()).datetime).toBe('2026-08-05 08:03:11');
  });

  // What `ams` sends today, from `MarkResource::toArray`. An offset accepted
  // here would be re-read against whatever zone the phone believes it is in,
  // which moves a legally-binding punch by an hour twice a year — on the screen
  // the employee is shown as proof. KOL-34 is what fixes it.
  it('rejects an ISO 8601 datetime with an offset stamped on it', () => {
    expect(() => parsePunchReceipt(payload({ datetime: '2026-08-05T08:03:11-04:00' }))).toThrow(
      PunchResponseError,
    );
  });

  it.each([
    ['the body is not an object', 'not a receipt'],
    ['mark_id is missing', payload({ mark_id: undefined })],
    ['mark_id is not a stored id', payload({ mark_id: 0 })],
    ['type is a state rather than a type', payload({ type: 'working' })],
    ['datetime is missing', payload({ datetime: undefined })],
    ['the hash is empty', payload({ hash: '   ' })],
    ['the hash is missing', payload({ hash: undefined })],
  ])('fails loudly when %s', (_case, body) => {
    expect(() => parsePunchReceipt(body)).toThrow(PunchResponseError);
  });

  describe('the server’s geofence verdict', () => {
    it.each(['inside', 'outside', 'unknown'] as const)('reads %s', (status) => {
      expect(parsePunchReceipt(payload({ geo_status: status })).geoStatus).toBe(status);
    });

    // Every server until KOL-34 ships. A server that did not evaluate the
    // geofence has not told us the mark was inside it, and `unknown` is the word
    // for exactly that.
    it.each([undefined, null])('reads %p as unknown rather than as inside', (absent) => {
      expect(parsePunchReceipt(payload({ geo_status: absent })).geoStatus).toBe('unknown');
    });

    // Present but unrecognised is a disagreement about the domain, and this is
    // the field that decides whether the comprobante carries `Marca fuera de
    // rango — pendiente de revisión` (KMO-19 #7).
    it('fails on a verdict it does not recognise rather than rounding it down', () => {
      expect(() => parsePunchReceipt(payload({ geo_status: 'out_of_range' }))).toThrow(
        PunchResponseError,
      );
    });
  });

  /**
   * The three Res. 38 Art. 13 fields `ams` KOL-35 added (KMO-19 #3).
   *
   * All three are nullable, and that is the register's own shape rather than a
   * concession to a backend that has not caught up: `MarkObserver` stamps the
   * identity from `$user?->rut`, and `users.rut` is itself nullable. The
   * comprobante omits a row it has no value for instead of drawing an empty one.
   */
  describe('the Art. 13 identity', () => {
    it('reads the folio as the server allocated it, not as a dressed-up mark id', () => {
      const receipt = parsePunchReceipt(payload());

      expect(receipt.folio).toBe('20260805-0042');
      expect(receipt.folio).not.toContain(String(receipt.markId));
    });

    it('keeps the RUT undotted, leaving the punctuation to formatRut', () => {
      expect(parsePunchReceipt(payload()).employeeRut).toBe('214375818');
    });

    /** The wire spelling and the receipt's, for the three nullable fields. */
    const identity = [
      ['folio', 'folio'],
      ['employee_name', 'employeeName'],
      ['employee_rut', 'employeeRut'],
    ] as const;

    // An empty string is the same absence written differently, and the row it
    // would draw is a label with nothing after it.
    it.each(identity)('reads an absent or blank %s as null', (wire, field) => {
      for (const absent of [null, undefined, '   ']) {
        expect(parsePunchReceipt(payload({ [wire]: absent }))[field]).toBeNull();
      }
    });

    // Present and not a string is a disagreement about the contract, and the
    // failure it would otherwise cause is a worker's name rendering as
    // `[object Object]` on a legal receipt.
    it.each(identity)('fails on a %s that is not text', (wire) => {
      expect(() => parsePunchReceipt(payload({ [wire]: { value: 'x' } }))).toThrow(
        PunchResponseError,
      );
    });
  });
});

// #7. One `in` and one `out` per day (D-F1-b), so the second one is news about
// the day rather than a failure to apologise for.
describe('a punch that already exists for today', () => {
  it('is raised as its own type, not as a generic refusal', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ message: 'Ya registraste tu entrada de hoy.' }, 409));

    const punching = createPunchApi(clientFor(fetchImpl)).punch(request());

    await expect(punching).rejects.toThrow(DuplicateMarkError);
  });

  it('keeps the server’s own Spanish on the cause', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ message: 'Ya registraste tu entrada de hoy.' }, 409));

    await createPunchApi(clientFor(fetchImpl))
      .punch(request())
      .catch((error: unknown) => {
        expect(isDuplicateMarkError(error)).toBe(true);
        expect((error as DuplicateMarkError).cause.userMessage).toBe(
          'Ya registraste tu entrada de hoy.',
        );
      });

    expect.hasAssertions();
  });

  // Everything else stays an `ApiError`, whose `userMessage` the screen already
  // knows how to show. A 422 is the employee being told something is wrong with
  // the request; a 409 is the register already containing the punch.
  it.each([422, 500, 403])('leaves a %d as the ApiError it is', async (status) => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ message: 'No' }, status));

    const punching = createPunchApi(clientFor(fetchImpl)).punch(request());

    await expect(punching).rejects.toBeInstanceOf(ApiError);
    await expect(punching).rejects.not.toBeInstanceOf(DuplicateMarkError);
  });

  it('leaves a malformed 201 as a response error, not a duplicate', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(payload({ hash: null })));

    const punching = createPunchApi(clientFor(fetchImpl)).punch(request());

    await expect(punching).rejects.toThrow(PunchResponseError);
  });
});
