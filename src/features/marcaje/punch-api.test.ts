import { ApiError, createApiClient, type ApiClient, type NaiveDateTime } from '@/api';
import { es } from '@/i18n';

import {
  createPunchApi,
  createPunchSync,
  DuplicateMarkError,
  isDuplicateMarkError,
  parsePunchReceipt,
  PunchResponseError,
  type PunchRequest,
} from './punch-api';
import type { QueuedPunch } from './punch-queue';

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
      capturedOffline: false,
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

  /**
   * §4.2's provenance flag, echoed on every mark (KMO-24 #8). It is what lets a
   * synced receipt still say it was captured offline, rather than the sync
   * erasing the one fact §4.6 requires the register to keep.
   */
  describe('captured_offline (§4.2, KMO-24 #8)', () => {
    it('reads true when the server says the mark was adjudicated from a device reading', () => {
      expect(parsePunchReceipt(payload({ captured_offline: true })).capturedOffline).toBe(true);
    });

    // Every mark before `ams` KOL-54 shipped, and every online mark since.
    it.each([undefined, null])('reads %p as false rather than as offline', (absent) => {
      expect(parsePunchReceipt(payload({ captured_offline: absent })).capturedOffline).toBe(false);
    });

    it('fails on a value that is not a boolean rather than rounding it down', () => {
      expect(() => parsePunchReceipt(payload({ captured_offline: 'true' }))).toThrow(
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

/** A queued punch, exactly as `use-punch.ts` builds one. */
function queuedPunch(overrides: Partial<QueuedPunch> = {}): QueuedPunch {
  return {
    id: 'row-1',
    userId: 1,
    type: 'in',
    fix: { latitude: -33.4569, longitude: -70.5975, accuracyMeters: 12.4 },
    geoStatus: 'inside',
    idempotencyKey: '0f9c4e6a-3b21-4d7f-9a58-1c2e7b40d913',
    deviceDatetime: '2026-08-07 08:03:11' as NaiveDateTime,
    ...overrides,
  };
}

describe('createPunchSync (KMO-23 §4.3)', () => {
  it('puts device_datetime and idempotency_key on the wire, alongside the ordinary body', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(payload(), 201));

    await createPunchSync(clientFor(fetchImpl))(queuedPunch());

    const body = JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;
    expect(body).toEqual({
      type: 'in',
      lat: -33.4569,
      lng: -70.5975,
      accuracy_m: 12.4,
      geo_status: 'inside',
      device_datetime: '2026-08-07 08:03:11',
      idempotency_key: '0f9c4e6a-3b21-4d7f-9a58-1c2e7b40d913',
    });
  });

  it('sends an absent fix the same way the online path does — explicit nulls', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(payload(), 201));

    await createPunchSync(clientFor(fetchImpl))(queuedPunch({ fix: null, geoStatus: 'unknown' }));

    const body = JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({ lat: null, lng: null, accuracy_m: null, geo_status: 'unknown' });
  });

  // #6. `client.post` already treats a 200 as `ok`, exactly like a 201 — this
  // is the whole idempotency contract, and it needs no branch to hold.
  it.each([201, 200])('drops the row silently on a %d', async (status) => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(payload(), status));

    await expect(createPunchSync(clientFor(fetchImpl))(queuedPunch())).resolves.toBeUndefined();
  });

  // #5. The same idempotency key, submitted twice, settles the same way both
  // times — the second call is what a retry after a lost 201 answer sends.
  it('treats a resend under the same idempotency key exactly like the first send', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(payload(), 201))
      .mockResolvedValueOnce(jsonResponse(payload(), 200));

    const sync = createPunchSync(clientFor(fetchImpl));
    const punch = queuedPunch();

    await expect(sync(punch)).resolves.toBeUndefined();
    await expect(sync(punch)).resolves.toBeUndefined();

    const keys = fetchImpl.mock.calls.map(
      (call) => (JSON.parse(call[1]?.body as string) as Record<string, unknown>).idempotency_key,
    );
    expect(keys).toEqual([punch.idempotencyKey, punch.idempotencyKey]);
  });

  // #11. Authored, not the server's sentence — matching how the live 409 on
  // `punch.alreadyMarked` already reads.
  it('drops a 409 with the app’s own calm line, not a stop', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ message: 'Ya existe una marca de este tipo hoy.' }, 409));

    await expect(createPunchSync(clientFor(fetchImpl))(queuedPunch())).resolves.toEqual({
      message: es.marcaje.sync.duplicate,
    });
  });

  // #9. Filed for HR inside the same request per §4.4 — retrying would ask to
  // file it twice, so this drops and never throws.
  it('drops queued_punch_too_old and shows the server’s sentence verbatim', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          message: 'La marca es demasiado antigua para transmitirse automáticamente.',
          code: 'queued_punch_too_old',
        },
        422,
      ),
    );

    await expect(createPunchSync(clientFor(fetchImpl))(queuedPunch())).resolves.toEqual({
      message: 'La marca es demasiado antigua para transmitirse automáticamente.',
    });
  });

  // #10, the decision this ticket recorded: dropped and never retried, same
  // shape as the too-old case, because the queue never re-reads the clock and
  // a bare retry can only fail identically or land at a wrong hour later.
  it('drops queued_punch_in_future and shows the server’s sentence verbatim', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { message: 'El reloj de tu teléfono está adelantado.', code: 'queued_punch_in_future' },
          422,
        ),
      );

    await expect(createPunchSync(clientFor(fetchImpl))(queuedPunch())).resolves.toEqual({
      message: 'El reloj de tu teléfono está adelantado.',
    });
  });

  it('never retries either offline-window 422 — one call is the whole attempt', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ message: 'x', code: 'queued_punch_too_old' }, 422));

    await createPunchSync(clientFor(fetchImpl))(queuedPunch());

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  // A malformed or half pair, a bad UUID — a client bug per §4.3's own table,
  // not a punch failure. Dropped rather than left to jam the queue behind it.
  it('drops a 422 with no recognised code, logging it as a bug rather than surfacing it', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ message: 'Los datos entregados no son válidos.' }, 422));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createPunchSync(clientFor(fetchImpl))(queuedPunch())).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalled();

    errorLog.mockRestore();
  });

  // Nothing here means the register has decided anything — `punch-queue.ts`
  // keeps the row, and everything queued after it, for the next attempt. A
  // fake `ApiClient` rather than a fetch mock: `createApiClient` always
  // re-wraps a rejected `fetch` as `network`, which is the one kind among
  // these that is not itself worth re-deriving through the real transport.
  it.each([
    ['network', new ApiError({ kind: 'network' })],
    ['timeout', new ApiError({ kind: 'timeout' })],
    ['401', new ApiError({ kind: 'unauthorized', status: 401 })],
    ['500', new ApiError({ kind: 'server', status: 500 })],
  ])('rethrows on %s, so the queue keeps the row', async (_label, error) => {
    const client: ApiClient = {
      request: async () => Promise.reject(error),
      get: async () => Promise.reject(error),
      post: async () => Promise.reject(error),
      put: async () => Promise.reject(error),
      patch: async () => Promise.reject(error),
      del: async () => Promise.reject(error),
      resetSession: () => {},
    };

    await expect(createPunchSync(client)(queuedPunch())).rejects.toBe(error);
  });

  it('really does surface a network failure as `network` through the real transport', async () => {
    // The one integration check that the fake client above bypasses on
    // purpose — a genuine `fetch` rejection still comes out the other side
    // as a connectivity failure, which is what `punch-queue.ts` breaks the
    // flush loop on.
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    const syncing = createPunchSync(clientFor(fetchImpl))(queuedPunch());

    await expect(syncing).rejects.toMatchObject({ kind: 'network' });
  });
});
