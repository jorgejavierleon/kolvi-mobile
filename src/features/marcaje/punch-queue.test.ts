import { act, renderHook } from '@testing-library/react-native';

import { ApiError, type NaiveDateTime } from '@/api';
import { es } from '@/i18n';

import {
  createPunchQueue,
  usePunchQueue,
  type PunchSync,
  type PunchSyncResult,
  type QueuedPunch,
} from './punch-queue';
import type { PunchQueueStore } from './punch-queue-store';

function punch(id: string, overrides: Partial<QueuedPunch> = {}): QueuedPunch {
  return {
    id,
    userId: 1,
    type: 'in',
    fix: null,
    geoStatus: 'unknown',
    idempotencyKey: `idem-${id}`,
    deviceDatetime: '2026-08-04 08:00:00' as NaiveDateTime,
    ...overrides,
  };
}

/** A store that behaves, and records what was asked of it. */
function fakeStore(
  seed: QueuedPunch[] = [],
): PunchQueueStore & { appended: QueuedPunch[]; removed: string[] } {
  let rows = [...seed];
  const appended: QueuedPunch[] = [];
  const removed: string[] = [];

  return {
    appended,
    removed,
    load: async () => rows,
    append: async (row) => {
      rows = [...rows, row];
      appended.push(row);
    },
    remove: async (id) => {
      rows = rows.filter((row) => row.id !== id);
      removed.push(id);
    },
  };
}

describe('createPunchQueue', () => {
  it('starts empty, with nothing to say', async () => {
    const queue = createPunchQueue();

    // The store load resolves in a microtask even for the in-memory default —
    // give it one before asserting the settled shape.
    await Promise.resolve();

    expect(queue.getState()).toEqual({
      entries: [],
      syncing: false,
      lastError: null,
      lastNotice: null,
    });
  });

  it('keeps punches in the order they were made', async () => {
    const queue = createPunchQueue();

    await queue.enqueue(punch('a'));
    await queue.enqueue(punch('b', { type: 'out' }));

    expect(queue.getState().entries.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('notifies subscribers, and stops once unsubscribed', async () => {
    const queue = createPunchQueue();
    const listener = jest.fn();

    const unsubscribe = queue.subscribe(listener);
    await queue.enqueue(punch('a'));
    expect(listener).toHaveBeenCalled();

    const callsAfterFirst = listener.mock.calls.length;
    unsubscribe();
    await queue.enqueue(punch('b'));
    expect(listener).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it('hands out a new state object per change', async () => {
    // `useSyncExternalStore` compares by identity: a mutated array would leave
    // the banner drawing a count that has already moved.
    const queue = createPunchQueue();
    await Promise.resolve();

    const before = queue.getState();
    await queue.enqueue(punch('a'));

    expect(queue.getState()).not.toBe(before);
  });

  describe('durability (#1, #2)', () => {
    it('does not tell the queue about a new punch until the store has it', async () => {
      const store = fakeStore();
      const queue = createPunchQueue(store);

      let storeHadItWhenStateChanged = false;
      queue.subscribe(() => {
        storeHadItWhenStateChanged = store.appended.length > 0;
      });

      await queue.enqueue(punch('a'));

      expect(storeHadItWhenStateChanged).toBe(true);
    });

    it('loads whatever the store already held, on construction', async () => {
      const store = fakeStore([punch('a'), punch('b')]);
      const queue = createPunchQueue(store);

      await Promise.resolve();
      await Promise.resolve();

      expect(queue.getState().entries.map((entry) => entry.id)).toEqual(['a', 'b']);
    });

    it('carries the idempotency key and the device reading through untouched', async () => {
      const queue = createPunchQueue();
      const entry = punch('a', {
        idempotencyKey: '0f9c4e6a-3b21-4d7f-9a58-1c2e7b40d913',
        deviceDatetime: '2026-08-07 08:03:11' as NaiveDateTime,
      });

      await queue.enqueue(entry);

      expect(queue.getState().entries[0]).toMatchObject({
        idempotencyKey: '0f9c4e6a-3b21-4d7f-9a58-1c2e7b40d913',
        deviceDatetime: '2026-08-07 08:03:11',
      });
    });
  });

  describe('flush', () => {
    it('transmits every punch, oldest first, and empties the queue', async () => {
      const queue = createPunchQueue();
      await queue.enqueue(punch('a'));
      await queue.enqueue(punch('b'));

      const seen: string[] = [];
      await queue.flush({
        userId: 1,
        sync: async (entry) => {
          seen.push(entry.id);

          return undefined;
        },
      });

      expect(seen).toEqual(['a', 'b']);
      expect(queue.getState().entries).toEqual([]);
      expect(queue.getState().lastError).toBeNull();
    });

    it('removes a settled row from the durable store too', async () => {
      const store = fakeStore();
      const queue = createPunchQueue(store);
      await queue.enqueue(punch('a'));

      await queue.flush({ userId: 1, sync: async () => undefined });

      expect(store.removed).toEqual(['a']);
    });

    it('reports itself busy while it runs', async () => {
      const queue = createPunchQueue();
      await queue.enqueue(punch('a'));

      let release: (() => void) | undefined;
      const flushed = queue.flush({
        userId: 1,
        sync: () =>
          new Promise<PunchSyncResult>((resolve) => {
            release = () => resolve(undefined);
          }),
      });

      await Promise.resolve();
      expect(queue.getState().syncing).toBe(true);

      release?.();
      await flushed;

      expect(queue.getState().syncing).toBe(false);
    });

    it('ignores a second press while the first is still going', async () => {
      // Two passes over the same rows would post each punch twice. §4.3's
      // idempotency key is the server's guard, not a licence to send one.
      const queue = createPunchQueue();
      await queue.enqueue(punch('a'));

      let release: (() => void) | undefined;
      const sync = jest.fn(
        () =>
          new Promise<PunchSyncResult>((resolve) => {
            release = () => resolve(undefined);
          }),
      );

      const first = queue.flush({ userId: 1, sync });
      await Promise.resolve();
      await queue.flush({ userId: 1, sync });

      expect(sync).toHaveBeenCalledTimes(1);

      release?.();
      await first;
    });

    it('does nothing at all when the queue is empty', async () => {
      const queue = createPunchQueue();
      const sync: PunchSync = jest.fn(async () => undefined);

      await queue.flush({ userId: 1, sync });

      expect(sync).not.toHaveBeenCalled();
      expect(queue.getState().lastError).toBeNull();
    });

    describe('when it fails', () => {
      it('leaves the queue intact and says why in the server’s Spanish', async () => {
        const queue = createPunchQueue();
        await queue.enqueue(punch('a'));
        await queue.enqueue(punch('b'));

        await queue.flush({
          userId: 1,
          sync: () =>
            Promise.reject(
              new ApiError({ kind: 'server', status: 500, serverMessage: 'El servidor falló.' }),
            ),
        });

        expect(queue.getState().entries.map((entry) => entry.id)).toEqual(['a', 'b']);
        expect(queue.getState().lastError).toBe('El servidor falló.');
        expect(queue.getState().syncing).toBe(false);
      });

      it('falls back to the catalogue for a failure that is not the API', async () => {
        const queue = createPunchQueue();
        await queue.enqueue(punch('a'));

        await queue.flush({
          userId: 1,
          sync: () => Promise.reject(new Error('undefined is not a function')),
        });

        // Not `Sin conexión`: a client bug over a working radio would send the
        // employee looking at their signal for a problem that is not there.
        expect(queue.getState().lastError).toBe(es.marcaje.sync.failed);
      });

      it('quotes the catalogue sentence an ApiError carries for its kind', async () => {
        const queue = createPunchQueue();
        await queue.enqueue(punch('a'));

        await queue.flush({
          userId: 1,
          sync: () => Promise.reject(new ApiError({ kind: 'network' })),
        });

        expect(queue.getState().lastError).toBe(es.errors.network);
      });

      it('stops at the first refusal that means try again, and keeps what it did not send', async () => {
        const queue = createPunchQueue();
        await queue.enqueue(punch('a'));
        await queue.enqueue(punch('b'));
        await queue.enqueue(punch('c'));

        const seen: string[] = [];
        await queue.flush({
          userId: 1,
          sync: async (entry) => {
            seen.push(entry.id);

            if (entry.id === 'b') {
              throw new ApiError({ kind: 'network' });
            }

            return undefined;
          },
        });

        // `a` is in the register and must not be sent again; `c` was never
        // attempted, and carrying on past a failure would report the wrong one.
        expect(seen).toEqual(['a', 'b']);
        expect(queue.getState().entries.map((entry) => entry.id)).toEqual(['b', 'c']);
      });

      it('keeps a punch made while the flush was in flight', async () => {
        const queue = createPunchQueue();
        await queue.enqueue(punch('a'));

        let release: (() => void) | undefined;
        const flushed = queue.flush({
          userId: 1,
          sync: () =>
            new Promise<PunchSyncResult>((resolve) => {
              release = () => resolve(undefined);
            }),
        });

        await queue.enqueue(punch('b'));
        release?.();
        await flushed;

        expect(queue.getState().entries.map((entry) => entry.id)).toEqual(['b']);
      });

      it('clears the previous reason when the next flush succeeds', async () => {
        const queue = createPunchQueue();
        await queue.enqueue(punch('a'));

        await queue.flush({
          userId: 1,
          sync: () => Promise.reject(new ApiError({ kind: 'network' })),
        });
        expect(queue.getState().lastError).not.toBeNull();

        await queue.flush({ userId: 1, sync: async () => undefined });
        expect(queue.getState().lastError).toBeNull();
      });
    });

    describe('a settlement with a notice (KMO-23 #9, #10, #11, #12)', () => {
      // A duplicate, or one of the two offline-window 422s, is not "try again
      // later" — the register has already decided this punch's fate, so the
      // row leaves the queue like a success does, carrying a line for the
      // employee instead of nothing at all.
      it('drops the row and keeps the message, without stopping the rest of the flush', async () => {
        const queue = createPunchQueue();
        await queue.enqueue(punch('a'));
        await queue.enqueue(punch('b'));

        const seen: string[] = [];
        await queue.flush({
          userId: 1,
          sync: async (entry) => {
            seen.push(entry.id);

            return entry.id === 'a' ? { message: 'Esa marca ya estaba registrada.' } : undefined;
          },
        });

        expect(seen).toEqual(['a', 'b']);
        expect(queue.getState().entries).toEqual([]);
        expect(queue.getState().lastNotice).toBe('Esa marca ya estaba registrada.');
        expect(queue.getState().lastError).toBeNull();
      });

      it('removes the settled row from the durable store even when it carries a notice', async () => {
        const store = fakeStore();
        const queue = createPunchQueue(store);
        await queue.enqueue(punch('a'));

        await queue.flush({
          userId: 1,
          sync: async () => ({ message: 'La marca es demasiado antigua.' }),
        });

        expect(store.removed).toEqual(['a']);
      });

      it('clears the previous notice at the start of the next flush', async () => {
        const queue = createPunchQueue();
        await queue.enqueue(punch('a'));
        await queue.enqueue(punch('b'));

        await queue.flush({
          userId: 1,
          sync: async (entry) =>
            entry.id === 'a'
              ? { message: 'primera' }
              : Promise.reject(new ApiError({ kind: 'network' })),
        });
        expect(queue.getState().lastNotice).toBe('primera');

        await queue.flush({ userId: 1, sync: async () => undefined });
        expect(queue.getState().lastNotice).toBeNull();
      });
    });

    describe('with no connectivity', () => {
      it('explains immediately rather than spending a doomed round trip', async () => {
        const queue = createPunchQueue();
        await queue.enqueue(punch('a'));
        const sync: PunchSync = jest.fn(async () => undefined);

        await queue.flush({ userId: 1, sync, online: false });

        expect(sync).not.toHaveBeenCalled();
        expect(queue.getState().lastError).toBe(es.errors.network);
        expect(queue.getState().entries).toHaveLength(1);
      });

      it('stays silent when there is nothing waiting', async () => {
        // Being offline with an empty queue is not something the employee needs
        // told (#6) — there is no banner to put the sentence on.
        const queue = createPunchQueue();

        await queue.flush({ userId: 1, sync: jest.fn(async () => undefined), online: false });

        expect(queue.getState().lastError).toBeNull();
      });
    });
  });
});

describe('usePunchQueue', () => {
  it('counts what is waiting', async () => {
    const queue = createPunchQueue();

    const { result } = await renderHook(() => usePunchQueue(queue, 1));

    expect(result.current.count).toBe(0);

    await act(async () => {
      await queue.enqueue(punch('a'));
    });

    expect(result.current.count).toBe(1);
    expect(result.current.entries.map((entry) => entry.id)).toEqual(['a']);
  });

  it('re-renders as the queue drains', async () => {
    const queue = createPunchQueue();
    await queue.enqueue(punch('a'));

    const { result } = await renderHook(() => usePunchQueue(queue, 1));
    expect(result.current.count).toBe(1);

    await act(async () => {
      await queue.flush({ userId: 1, sync: async () => undefined });
    });

    expect(result.current.count).toBe(0);
  });

  // §4.7 D5 — a shared device holding a second employee's leftover rows must
  // not show them to whoever is signed in now.
  it('shows only the signed-in employee’s rows', async () => {
    const queue = createPunchQueue();
    await queue.enqueue(punch('a', { userId: 1 }));
    await queue.enqueue(punch('b', { userId: 2 }));

    const { result } = await renderHook(() => usePunchQueue(queue, 1));

    expect(result.current.count).toBe(1);
    expect(result.current.entries.map((entry) => entry.id)).toEqual(['a']);
  });
});

describe('queue-to-employee binding (§4.7 D5, KMO-49 #7)', () => {
  it('never flushes a punch queued under a different employee', async () => {
    const queue = createPunchQueue();
    await queue.enqueue(punch('a', { userId: 1 }));
    await queue.enqueue(punch('b', { userId: 2 }));

    const sync = jest.fn(async () => undefined);
    // Employee 2 signs in and the automatic flush fires under their token —
    // employee 1's row, still on this phone from an earlier sign-in, must
    // never be posted under it.
    await queue.flush({ userId: 2, sync });

    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
    expect(queue.getState().entries.map((entry) => entry.id)).toEqual(['a']);
  });

  it('flushes the first employee’s row once they sign in again, leaving the second untouched', async () => {
    const queue = createPunchQueue();
    await queue.enqueue(punch('a', { userId: 1 }));
    await queue.enqueue(punch('b', { userId: 2 }));

    const sync = jest.fn(async () => undefined);
    await queue.flush({ userId: 1, sync });

    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(queue.getState().entries.map((entry) => entry.id)).toEqual(['b']);
  });

  it('preserves each employee’s own order when their rows are interleaved', async () => {
    const queue = createPunchQueue();
    await queue.enqueue(punch('a1', { userId: 1, type: 'in' }));
    await queue.enqueue(punch('b1', { userId: 2, type: 'in' }));
    await queue.enqueue(punch('a2', { userId: 1, type: 'out' }));

    const seen: string[] = [];
    await queue.flush({
      userId: 1,
      sync: async (entry) => {
        seen.push(entry.id);

        return undefined;
      },
    });

    expect(seen).toEqual(['a1', 'a2']);
    expect(queue.getState().entries.map((entry) => entry.id)).toEqual(['b1']);
  });

  // #9 — the queue's own half. `createPunchSync` rethrows a 401 like every
  // other server-answered-nothing-yet failure (punch-api.ts), which is what
  // this proves keeps the row rather than dropping it; the session actually
  // ending is `client.ts`'s app-wide latch, generic to any 401 and already
  // covered by session.test.tsx's "a session the server ends" suite. What is
  // new here is the row surviving to be flushed again once that same
  // employee — the same `userId` — is signed back in.
  it('keeps a punch a 401 refused, and flushes it once the same employee signs in again', async () => {
    const queue = createPunchQueue();
    await queue.enqueue(punch('a', { userId: 1 }));

    await queue.flush({
      userId: 1,
      sync: () => Promise.reject(new ApiError({ kind: 'unauthorized', status: 401 })),
    });

    expect(queue.getState().entries.map((entry) => entry.id)).toEqual(['a']);

    const sync = jest.fn(async () => undefined);
    await queue.flush({ userId: 1, sync });

    expect(sync).toHaveBeenCalledTimes(1);
    expect(queue.getState().entries).toEqual([]);
  });
});
