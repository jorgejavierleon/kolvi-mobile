import { act, renderHook } from '@testing-library/react-native';

import { ApiError } from '@/api';
import { es } from '@/i18n';

import { createPunchQueue, usePunchQueue, type QueuedPunch } from './punch-queue';

function punch(id: string, overrides: Partial<QueuedPunch> = {}): QueuedPunch {
  return { id, type: 'in', fix: null, geoStatus: 'unknown', ...overrides };
}

describe('createPunchQueue', () => {
  it('starts empty, with nothing to say', () => {
    const queue = createPunchQueue();

    expect(queue.getState()).toEqual({ entries: [], syncing: false, lastError: null });
  });

  it('keeps punches in the order they were made', () => {
    const queue = createPunchQueue();

    queue.enqueue(punch('a'));
    queue.enqueue(punch('b', { type: 'out' }));

    expect(queue.getState().entries.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('notifies subscribers, and stops once unsubscribed', () => {
    const queue = createPunchQueue();
    const listener = jest.fn();

    const unsubscribe = queue.subscribe(listener);
    queue.enqueue(punch('a'));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    queue.enqueue(punch('b'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('hands out a new state object per change', () => {
    // `useSyncExternalStore` compares by identity: a mutated array would leave
    // the banner drawing a count that has already moved.
    const queue = createPunchQueue();

    const before = queue.getState();
    queue.enqueue(punch('a'));

    expect(queue.getState()).not.toBe(before);
  });

  describe('flush', () => {
    it('transmits every punch, oldest first, and empties the queue', async () => {
      const queue = createPunchQueue();
      queue.enqueue(punch('a'));
      queue.enqueue(punch('b'));

      const seen: string[] = [];
      await queue.flush({
        sync: async (entry) => {
          seen.push(entry.id);
        },
      });

      expect(seen).toEqual(['a', 'b']);
      expect(queue.getState().entries).toEqual([]);
      expect(queue.getState().lastError).toBeNull();
    });

    it('reports itself busy while it runs', async () => {
      const queue = createPunchQueue();
      queue.enqueue(punch('a'));

      let release: (() => void) | undefined;
      const flushed = queue.flush({
        sync: () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      });

      expect(queue.getState().syncing).toBe(true);

      release?.();
      await flushed;

      expect(queue.getState().syncing).toBe(false);
    });

    it('ignores a second press while the first is still going', async () => {
      // Two passes over the same rows would post each punch twice. §4.3's
      // idempotency key is the server's guard, not a licence to send one.
      const queue = createPunchQueue();
      queue.enqueue(punch('a'));

      let release: (() => void) | undefined;
      const sync = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );

      const first = queue.flush({ sync });
      await queue.flush({ sync });

      expect(sync).toHaveBeenCalledTimes(1);

      release?.();
      await first;
    });

    it('does nothing at all when the queue is empty', async () => {
      const queue = createPunchQueue();
      const sync = jest.fn();

      await queue.flush({ sync });

      expect(sync).not.toHaveBeenCalled();
      expect(queue.getState().lastError).toBeNull();
    });

    describe('when it fails', () => {
      it('leaves the queue intact and says why in the server’s Spanish', async () => {
        const queue = createPunchQueue();
        queue.enqueue(punch('a'));
        queue.enqueue(punch('b'));

        await queue.flush({
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
        queue.enqueue(punch('a'));

        await queue.flush({ sync: () => Promise.reject(new Error('undefined is not a function')) });

        // Not `Sin conexión`: a client bug over a working radio would send the
        // employee looking at their signal for a problem that is not there.
        expect(queue.getState().lastError).toBe(es.marcaje.sync.failed);
      });

      it('quotes the catalogue sentence an ApiError carries for its kind', async () => {
        const queue = createPunchQueue();
        queue.enqueue(punch('a'));

        await queue.flush({ sync: () => Promise.reject(new ApiError({ kind: 'network' })) });

        expect(queue.getState().lastError).toBe(es.errors.network);
      });

      it('stops at the first refusal and keeps what it did not send', async () => {
        const queue = createPunchQueue();
        queue.enqueue(punch('a'));
        queue.enqueue(punch('b'));
        queue.enqueue(punch('c'));

        const seen: string[] = [];
        await queue.flush({
          sync: async (entry) => {
            seen.push(entry.id);

            if (entry.id === 'b') {
              throw new ApiError({ kind: 'network' });
            }
          },
        });

        // `a` is in the register and must not be sent again; `c` was never
        // attempted, and carrying on past a failure would report the wrong one.
        expect(seen).toEqual(['a', 'b']);
        expect(queue.getState().entries.map((entry) => entry.id)).toEqual(['b', 'c']);
      });

      it('keeps a punch made while the flush was in flight', async () => {
        const queue = createPunchQueue();
        queue.enqueue(punch('a'));

        let release: (() => void) | undefined;
        const flushed = queue.flush({
          sync: () =>
            new Promise<void>((resolve) => {
              release = resolve;
            }),
        });

        queue.enqueue(punch('b'));
        release?.();
        await flushed;

        expect(queue.getState().entries.map((entry) => entry.id)).toEqual(['b']);
      });

      it('clears the previous reason when the next flush succeeds', async () => {
        const queue = createPunchQueue();
        queue.enqueue(punch('a'));

        await queue.flush({ sync: () => Promise.reject(new ApiError({ kind: 'network' })) });
        expect(queue.getState().lastError).not.toBeNull();

        await queue.flush({ sync: async () => {} });
        expect(queue.getState().lastError).toBeNull();
      });
    });

    describe('with no connectivity', () => {
      it('explains immediately rather than spending a doomed round trip', async () => {
        const queue = createPunchQueue();
        queue.enqueue(punch('a'));
        const sync = jest.fn();

        await queue.flush({ sync, online: false });

        expect(sync).not.toHaveBeenCalled();
        expect(queue.getState().lastError).toBe(es.errors.network);
        expect(queue.getState().entries).toHaveLength(1);
      });

      it('stays silent when there is nothing waiting', async () => {
        // Being offline with an empty queue is not something the employee needs
        // told (#6) — there is no banner to put the sentence on.
        const queue = createPunchQueue();

        await queue.flush({ sync: jest.fn(), online: false });

        expect(queue.getState().lastError).toBeNull();
      });
    });
  });
});

describe('usePunchQueue', () => {
  it('counts what is waiting', async () => {
    const queue = createPunchQueue();

    const { result } = await renderHook(() => usePunchQueue(queue));

    expect(result.current.count).toBe(0);

    await act(async () => {
      queue.enqueue(punch('a'));
    });

    expect(result.current.count).toBe(1);
    expect(result.current.entries.map((entry) => entry.id)).toEqual(['a']);
  });

  it('re-renders as the queue drains', async () => {
    const queue = createPunchQueue();
    queue.enqueue(punch('a'));

    const { result } = await renderHook(() => usePunchQueue(queue));
    expect(result.current.count).toBe(1);

    await act(async () => {
      await queue.flush({ sync: async () => {} });
    });

    expect(result.current.count).toBe(0);
  });
});
