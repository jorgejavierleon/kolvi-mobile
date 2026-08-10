import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError, type NaiveDateTime } from '@/api';
import { es } from '@/i18n';

import {
  DuplicateMarkError,
  PunchResponseError,
  type PunchApi,
  type PunchReceipt,
} from './punch-api';
import { createPunchQueue, type PunchQueue, type QueuedPunch } from './punch-queue';
import type { PunchQueueStore } from './punch-queue-store';
import { usePunch, type UsePunchOptions } from './use-punch';

/**
 * `expo-crypto` has no Jest mock of its own, so `Crypto.randomUUID()` would
 * otherwise answer `undefined` under the test runner — each call hands back
 * the next of a fixed sequence instead, which is what lets a test assert that
 * the row's `id` and its `idempotencyKey` are two different values rather
 * than two reads of the same `undefined`.
 */
const mockUuids = ['uuid-one', 'uuid-two', 'uuid-three', 'uuid-four'];
let mockUuidIndex = 0;

jest.mock('expo-crypto', () => ({
  randomUUID: () => mockUuids[mockUuidIndex++] ?? `uuid-exhausted-${mockUuidIndex}`,
}));

function receipt(overrides: Partial<PunchReceipt> = {}): PunchReceipt {
  return {
    markId: 1841,
    type: 'in',
    datetime: '2026-08-05 08:03:11' as NaiveDateTime,
    hash: '9f2c1b0e5d4a',
    geoStatus: 'inside',
    folio: '20260805-0042',
    employeeName: 'María Fernanda Soto',
    employeeRut: '214375818',
    ...overrides,
  };
}

/**
 * An API whose calls the test settles, one at a time.
 *
 * Deferred rather than pre-resolved, because the whole of #6 happens *while* a
 * request is in flight: a mock that has already settled cannot show a second tap
 * arriving before the first answer does, which is exactly the slow network the
 * criterion is about.
 */
function deferredApi() {
  const calls: {
    request: Parameters<PunchApi['punch']>[0];
    resolve: (value: PunchReceipt) => void;
    reject: (error: unknown) => void;
  }[] = [];

  const api: PunchApi = {
    punch: (request) =>
      new Promise<PunchReceipt>((resolve, reject) => {
        calls.push({ request, resolve, reject });
      }),
  };

  return { api, calls };
}

/** Settle one call and let the state it sets land inside this act scope. */
async function settle(action: () => void) {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}

async function punchable(options: Partial<UsePunchOptions> = {}) {
  const { api, calls } = deferredApi();
  // A fresh in-memory queue by default, never the app singleton — a test that
  // wants to inspect what got queued passes its own.
  const queue = options.queue ?? createPunchQueue();
  const { result } = await renderHook(() => usePunch({ state: 'before', api, queue, ...options }));

  return { result, calls, queue };
}

describe('the state the button reads', () => {
  it('is the server’s until this hook records one of its own', async () => {
    const { result } = await punchable({ state: 'working' });

    expect(result.current.state).toBe('working');
  });

  // KMO-15 #4. A screen nobody has told about the day says nothing, rather than
  // telling an employee who punched in at 08:00 that they have not.
  it('is null when the server has not answered yet', async () => {
    const { result, calls } = await punchable({ state: null });

    expect(result.current.state).toBeNull();

    await act(async () => {
      result.current.punch();
    });

    expect(calls).toHaveLength(0);
  });

  it('has nothing to punch on a day that is already closed', async () => {
    const { result, calls } = await punchable({ state: 'done' });

    await act(async () => {
      result.current.punch();
    });

    expect(calls).toHaveLength(0);
  });
});

describe('a punch the server records', () => {
  // #2. `before → working → done`, one step per accepted punch.
  it('advances the state off the receipt', async () => {
    const { result, calls } = await punchable({ state: 'before' });

    await act(async () => {
      result.current.punch();
    });

    expect(result.current.status).toBe('submitting');
    expect(calls[0]?.request.type).toBe('in');

    await settle(() => calls[0]?.resolve(receipt()));

    expect(result.current.state).toBe('working');
    expect(result.current.status).toBe('idle');
  });

  it('closes the day on the salida', async () => {
    const { result, calls } = await punchable({ state: 'working' });

    await act(async () => {
      result.current.punch();
    });

    expect(calls[0]?.request.type).toBe('out');

    await settle(() => calls[0]?.resolve(receipt({ type: 'out' })));

    expect(result.current.state).toBe('done');
  });

  // The state moves because the register moved. A hook that advanced off the
  // *tap* would be an app claiming an attendance record that may not exist.
  it('follows the receipt rather than the type it asked for', async () => {
    const { result, calls } = await punchable({ state: 'before' });

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.resolve(receipt({ type: 'out' })));

    expect(result.current.state).toBe('done');
  });

  // #10's seam. KMO-19 opens the comprobante from here.
  it('hands the receipt on, and keeps it', async () => {
    const onPunched = jest.fn();
    const { result, calls } = await punchable({ onPunched });

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.resolve(receipt()));

    expect(onPunched).toHaveBeenCalledWith(receipt());
    expect(result.current.receipt).toEqual(receipt());
  });

  // #5 and #11. What the phone knew travels with the punch; what it did not know
  // travels as `unknown` rather than as silence.
  it('sends the fix and the client’s verdict as they were at the tap', async () => {
    const fix = { latitude: -33.4569, longitude: -70.5975, accuracyMeters: 12.4 };
    const { result, calls } = await punchable({ fix, geoStatus: 'inside' });

    await act(async () => {
      result.current.punch();
    });

    expect(calls[0]?.request).toEqual({ type: 'in', fix, geoStatus: 'inside' });
  });

  it('punches with no fix at all when the phone had none', async () => {
    const { result, calls } = await punchable({ fix: null, geoStatus: 'unknown' });

    await act(async () => {
      result.current.punch();
    });

    expect(calls[0]?.request).toEqual({ type: 'in', fix: null, geoStatus: 'unknown' });
  });
});

// #6. The criterion names a slow network because that is the only place the bug
// lives: on a fast one the button is already showing its spinner by the time a
// second tap could land.
describe('the double-tap guard', () => {
  it('makes one punch out of two taps while the first is still in flight', async () => {
    const { result, calls } = await punchable();

    await act(async () => {
      result.current.punch();
      result.current.punch();
      result.current.punch();
    });

    expect(calls).toHaveLength(1);
  });

  it('holds even across the re-render the spinner causes', async () => {
    const { result, calls } = await punchable();

    await act(async () => {
      result.current.punch();
    });

    // The state has landed now — `submitting` is on screen — and the employee
    // taps again anyway, which is what someone does with a button that has not
    // visibly done anything on a warehouse connection.
    await act(async () => {
      result.current.punch();
    });

    expect(calls).toHaveLength(1);
  });

  it('lets the next punch through once the first has settled', async () => {
    const { result, calls } = await punchable({ state: 'before' });

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.resolve(receipt()));

    await act(async () => {
      result.current.punch();
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]?.request.type).toBe('out');
  });

  // #8's other half: a failure has to reopen the button, or the employee is
  // stuck with an unpressable control and an unrecorded shift.
  //
  // `server`, not `network` — since KMO-23 a `network`/`timeout` rejection is
  // the Art. 10 exception rather than a failure; see 'a punch made with no
  // connectivity' below for that path.
  it('reopens after a failure', async () => {
    const { result, calls } = await punchable();

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(new ApiError({ kind: 'server', status: 500 })));

    await act(async () => {
      result.current.punch();
    });

    expect(calls).toHaveLength(2);
  });
});

// #8. Nothing about the day changes, and the employee is standing where they
// were: same state, same label, one line saying what happened.
describe('a punch that failed', () => {
  it('leaves the state exactly as it was', async () => {
    const { result, calls } = await punchable({ state: 'before' });

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(new ApiError({ kind: 'server', status: 500 })));

    expect(result.current.state).toBe('before');
    expect(result.current.status).toBe('failed');
  });

  it('records no receipt', async () => {
    const { result, calls } = await punchable();

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(new ApiError({ kind: 'server', status: 500 })));

    expect(result.current.receipt).toBeNull();
  });

  // The server knows why it refused and says so in Spanish, out of `ams` lang/.
  it('quotes the server’s own sentence when there is one', async () => {
    const { result, calls } = await punchable();

    await act(async () => {
      result.current.punch();
    });
    await settle(() =>
      calls[0]?.reject(
        new ApiError({ kind: 'validation', status: 422, serverMessage: 'Tu turno ya terminó.' }),
      ),
    );

    expect(result.current).toMatchObject({ status: 'failed', message: 'Tu turno ya terminó.' });
  });

  // Nothing to quote: a 201 whose body was not a receipt. The catalogue sentence
  // is the one that says the thing the employee cannot see — that no mark was
  // stored, so the button below is worth pressing again.
  it('falls back to the catalogue when there is no server sentence', async () => {
    const { result, calls } = await punchable();

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(new PunchResponseError('`hash` is not a checksum')));

    expect(result.current).toMatchObject({
      status: 'failed',
      message: es.marcaje.punch.failed,
    });
  });

  it('never surfaces an English fetch message', async () => {
    const { result, calls } = await punchable();

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(new TypeError('Network request failed')));

    expect(result.current).toMatchObject({ message: es.marcaje.punch.failed });
  });
});

// #7. One `in` and one `out` per day (D-F1-b). The register already holds this
// punch, so the screen is behind rather than wrong — and it says so as news.
describe('a punch that already exists', () => {
  function duplicate(): DuplicateMarkError {
    return new DuplicateMarkError(
      new ApiError({ kind: 'client', status: 409, serverMessage: 'Ya registraste tu entrada.' }),
    );
  }

  it('advances the state rather than refusing, because the punch exists', async () => {
    const { result, calls } = await punchable({ state: 'before' });

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(duplicate()));

    expect(result.current.state).toBe('working');
  });

  it('is its own status, not a failure', async () => {
    const { result, calls } = await punchable();

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(duplicate()));

    expect(result.current).toMatchObject({
      status: 'duplicate',
      message: es.marcaje.punch.alreadyMarked,
    });
  });

  it('asks the screen to reload the day, so what shows is what the register holds', async () => {
    const onAlreadyMarked = jest.fn();
    const { result, calls } = await punchable({ onAlreadyMarked });

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(duplicate()));

    expect(onAlreadyMarked).toHaveBeenCalledTimes(1);
  });

  it('records no receipt — there is none to build a comprobante from', async () => {
    const { result, calls } = await punchable();

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(duplicate()));

    expect(result.current.receipt).toBeNull();
  });
});

/** A punch made with the phone's radio off, never reaching a server at all. */
function offline(): ApiError {
  return new ApiError({ kind: 'network' });
}

/** A store whose `append` the test settles by hand, to prove an ordering. */
function deferredQueue(): { queue: PunchQueue; releaseAppend: () => void } {
  let release: (() => void) | undefined;
  const store: PunchQueueStore = {
    load: async () => [],
    append: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    remove: async () => {},
  };

  return { queue: createPunchQueue(store), releaseAppend: () => release?.() };
}

// KMO-23. Res. 38 Art. 10: capture-and-store is conforming, and refusing the
// punch is the actual infraction (§4.1) — so a request that never reached a
// server is not this hook's kind of failure.
describe('a punch made with no connectivity (KMO-23 #1, #7)', () => {
  it('writes the punch to the durable queue before anything on screen moves', async () => {
    const { queue, releaseAppend } = deferredQueue();
    const { result, calls } = await punchable({ queue });

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(offline()));

    // The durable write has not resolved yet — nothing has advanced, and the
    // button still reads as busy rather than as failed or done.
    expect(result.current.status).toBe('submitting');
    expect(result.current.state).toBe('before');

    releaseAppend();
    await waitFor(() => expect(result.current.status).toBe('queued'));

    expect(result.current.state).toBe('working');
  });

  it('is its own status, not a failure', async () => {
    const { result, calls } = await punchable();

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(offline()));

    expect(result.current).toMatchObject({ status: 'queued', message: es.marcaje.punch.queued });
  });

  it('advances the state, because Art. 38 never blocks the punch', async () => {
    const { result, calls } = await punchable({ state: 'before' });

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(offline()));

    expect(result.current.state).toBe('working');
  });

  it('treats a timeout the same as an absent network', async () => {
    const { result, calls } = await punchable();

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(new ApiError({ kind: 'timeout' })));

    expect(result.current.status).toBe('queued');
  });

  it('carries the type, the fix and the client’s geofence verdict into the queued row', async () => {
    const fix = { latitude: -33.4569, longitude: -70.5975, accuracyMeters: 12.4 };
    const queue = createPunchQueue();
    const { result, calls } = await punchable({ queue, fix, geoStatus: 'inside' });

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(offline()));

    expect(queue.getState().entries).toEqual([
      expect.objectContaining({ type: 'in', fix, geoStatus: 'inside' }),
    ]);
  });

  // §4.3. Read once, at the tap, never re-read — and a fresh UUID each time,
  // never the row's own `id`.
  it('reads the device clock once and generates a fresh idempotency key', async () => {
    const queue = createPunchQueue();
    const clock = () => new Date('2026-08-07T08:03:11');
    const { result, calls } = await punchable({ queue, clock });

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(offline()));

    const [queued] = queue.getState().entries;
    expect(queued?.deviceDatetime).toBe('2026-08-07 08:03:11');
    // Two independent UUIDs — the mocked `Crypto.randomUUID()` above hands out
    // a fresh value on every call, so the row's own `id` and the compliance-
    // bearing `idempotencyKey` are provably not the same read reused twice.
    expect(queued?.idempotencyKey).toBeDefined();
    expect(queued?.idempotencyKey).not.toBe(queued?.id);
  });

  it('hands the queued punch on, once it is durably written', async () => {
    const onQueued = jest.fn();
    const { result, calls } = await punchable({ onQueued });

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(offline()));

    expect(onQueued).toHaveBeenCalledTimes(1);
    expect(onQueued.mock.calls[0]?.[0]).toMatchObject({
      type: 'in',
    } satisfies Partial<QueuedPunch>);
  });

  it('records no receipt — nothing has been confirmed by the register yet', async () => {
    const { result, calls } = await punchable();

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(offline()));

    expect(result.current.receipt).toBeNull();
  });

  it('reopens the button once the durable write has landed', async () => {
    const { result, calls } = await punchable({ state: 'before' });

    await act(async () => {
      result.current.punch();
    });
    await settle(() => calls[0]?.reject(offline()));

    await act(async () => {
      result.current.punch();
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]?.request.type).toBe('out');
  });
});
