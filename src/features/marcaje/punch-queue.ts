/**
 * The punches this phone is holding, as the banner above the location card reads
 * them (KMO-22).
 *
 * **This is the queue's observable surface and not yet the queue.** Rows live in
 * memory and die with the process; nothing enqueues one yet. KMO-23 is the ticket
 * that makes it durable, gives it the wire body from
 * docs/design-decisions.md §4.3 — `device_datetime`, the `idempotency_key`, the
 * fix — and calls `enqueue` from the one place allowed to: a punch whose request
 * actually failed to reach the server. The split is the dependency order (KMO-23
 * depends on this ticket), and the boundary is drawn here rather than half-built:
 * a punch written somewhere it cannot survive a force-quit, under a receipt
 * telling the employee it was *guardada en tu teléfono*, would be a claim about
 * their attendance record that this ticket cannot honour.
 *
 * What it does own is the arithmetic the banner is about, and one rule from
 * §4.1: `Sincronizar` is an **accelerator**, never the mechanism. Res. 38 Art. 10
 * requires the deferred send to happen automatically — `flush` is therefore
 * something the button and the connectivity edge (KMO-23 #4) both call, and
 * neither is privileged.
 */

import { useSyncExternalStore } from 'react';

import { isApiError } from '@/api';
import { es } from '@/i18n';

import type { GeoStatus, LocationFix } from './geofence';
import type { PunchType } from './punch-state';

/**
 * One punch waiting to be transmitted.
 *
 * `id` is this row's identity **inside the app** and is not the
 * `idempotency_key` the wire carries: KMO-23 adds that field, along with the
 * device reading, and both are compliance-bearing in a way a list key is not.
 */
export type QueuedPunch = {
  readonly id: string;
  readonly type: PunchType;
  readonly fix: LocationFix | null;
  readonly geoStatus: GeoStatus;
};

/**
 * What transmitting one row means. Injected rather than owned, because the body
 * it posts is KMO-23's to specify: this file knows only that a resolved promise
 * means the register has it and a rejected one means it does not.
 */
export type PunchSync = (punch: QueuedPunch) => Promise<void>;

export type PunchQueueState = {
  readonly entries: readonly QueuedPunch[];
  /** A flush in progress, which is what `Sincronizar` shows as busy (#4). */
  readonly syncing: boolean;
  /** Why the last flush stopped, in Spanish, or `null` (#7). */
  readonly lastError: string | null;
};

export type PunchQueue = {
  getState(): PunchQueueState;
  subscribe(listener: () => void): () => void;
  /** Add a punch. KMO-23 owns the only caller: a request that failed. */
  enqueue(punch: QueuedPunch): void;
  /**
   * Try to transmit everything, oldest first.
   *
   * `online` is the phone's opinion and is used for one thing: saying why,
   * immediately, instead of spending a doomed round trip on a radio that is off.
   * It is never what decides that a punch belongs in the queue — see the header
   * of `connectivity.ts`.
   */
  flush(options: { sync: PunchSync; online?: boolean }): Promise<void>;
};

export function createPunchQueue(): PunchQueue {
  let state: PunchQueueState = { entries: [], syncing: false, lastError: null };
  const listeners = new Set<() => void>();

  /**
   * Replace the state and tell everyone. A fresh object every time, because
   * `useSyncExternalStore` compares by identity and a mutated array would leave
   * the banner showing a count that has already changed.
   */
  const set = (next: Partial<PunchQueueState>): void => {
    state = { ...state, ...next };

    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getState: () => state,

    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    enqueue: (punch) => {
      set({ entries: [...state.entries, punch] });
    },

    flush: async ({ sync, online = true }) => {
      // A second press while the first is still going is not a second flush.
      // Two passes over the same rows would post each punch twice, and the
      // §4.3 idempotency key is the server's guard rather than an excuse to
      // send one.
      if (state.syncing || state.entries.length === 0) {
        return;
      }

      if (!online) {
        // Nothing was attempted, so nothing left the queue. The employee gets
        // the sentence a failed request would have produced, without the wait.
        set({ lastError: es.errors.network });

        return;
      }

      set({ syncing: true, lastError: null });

      // Oldest first, and stopping at the first refusal. Order is what keeps an
      // entrada from being transmitted after the salida that followed it, and a
      // queue that carried on past a failure would report the last error rather
      // than the one that stopped it.
      const pending = [...state.entries];
      let transmitted = 0;
      let failure: string | null = null;

      for (const punch of pending) {
        try {
          await sync(punch);
          transmitted += 1;
        } catch (error) {
          failure = messageFor(error);
          break;
        }
      }

      // Only what the server took. Rows added while the flush was in flight are
      // still in `state.entries` and are kept — dropping by count from the head
      // rather than replacing the array is what makes a punch made mid-sync
      // survive it (#7).
      set({
        entries: state.entries.slice(transmitted),
        syncing: false,
        lastError: failure,
      });
    },
  };
}

/**
 * The one the app uses. A module singleton rather than a provider: the queue
 * outlives any screen — a punch made on Inicio is still waiting when the
 * employee is on Documentos — and there is nothing for a React tree to scope it
 * to. Tests pass their own through `usePunchQueue`.
 */
export const punchQueue = createPunchQueue();

export type PunchQueueReading = PunchQueueState & {
  readonly count: number;
};

export function usePunchQueue(queue: PunchQueue = punchQueue): PunchQueueReading {
  const state = useSyncExternalStore(
    (listener) => queue.subscribe(listener),
    () => queue.getState(),
  );

  return { ...state, count: state.entries.length };
}

/**
 * Why the flush stopped, in Spanish.
 *
 * The server's own sentence wins whenever there is one, as everywhere else in
 * the app — `ams` answers in Spanish out of `lang/` and it knows why it refused.
 * `ApiError` already falls back to `es.errors` per kind, so the catalogue entry
 * here is for the case that is not an API failure at all: a bug. It says the
 * marks are still on the phone rather than guessing at a cause, because
 * `Sin conexión` over a client error would send the employee looking at their
 * signal for a problem that is not there.
 */
function messageFor(error: unknown): string {
  return isApiError(error) ? error.userMessage : es.marcaje.sync.failed;
}
