/**
 * The punches this phone is holding, as the banner above the location card
 * reads them (KMO-22) — durable since KMO-23.
 *
 * A punch written here survives an app kill, a battery death and an OS
 * restart: `store` is a `PunchQueueStore` (`punch-queue-store.ts`), and every
 * mutation below goes through it before the in-memory state — which is what
 * `usePunchQueue` and the banner actually read — is allowed to change. That
 * ordering is #1: the durable write finishes before anything on screen can
 * say the punch was captured.
 *
 * What this file owns is the arithmetic the banner is about, and one rule from
 * §4.1: `Sincronizar` is an **accelerator**, never the mechanism. Res. 38
 * Art. 10 requires the deferred send to happen automatically — `flush` is
 * therefore something the button and the connectivity edge (#4) both call,
 * and neither is privileged.
 *
 * `flush`'s `sync` is injected rather than owned, because the wire body is
 * `punch-api.ts`'s to specify (§4.3) and the branching on the server's answer
 * is `createPunchSync`'s. This file knows only three outcomes: resolving
 * (with or without a message) means the row is settled and comes off the
 * queue; throwing means it does not, and the row — and everything queued
 * after it — waits for the next attempt.
 */

import { useSyncExternalStore } from 'react';

import { isApiError, type NaiveDateTime } from '@/api';
import { es } from '@/i18n';

import type { GeoStatus, LocationFix } from './geofence';
import {
  createMemoryPunchQueueStore,
  createSqlitePunchQueueStore,
  type PunchQueueStore,
} from './punch-queue-store';
import type { PunchType } from './punch-state';

/**
 * One punch waiting to be transmitted.
 *
 * `id` is this row's identity **inside the app** and is not the
 * `idempotency_key` the wire carries — two different UUIDs, generated
 * independently, so nothing about the list key is ever mistaken for the
 * compliance-bearing field. `idempotencyKey` and `deviceDatetime` are both
 * written once, at the moment the punch was made, and never touched again —
 * see the header of `now-clock.ts` and docs/design-decisions.md §4.3.
 */
export type QueuedPunch = {
  readonly id: string;
  readonly type: PunchType;
  readonly fix: LocationFix | null;
  readonly geoStatus: GeoStatus;
  readonly idempotencyKey: string;
  readonly deviceDatetime: NaiveDateTime;
};

/**
 * What transmitting one row resolved with, or the reason it did not.
 *
 * Resolving — with `undefined`, or with a `message` — means the register has
 * settled this punch one way or another and it comes off the queue: a 201, a
 * 200 replay, and a refusal that will never succeed (a duplicate, the two
 * offline-window 422s) are all "settled" in that sense, even though only the
 * first two are what most people mean by "it worked". `message` is what the
 * employee is told when the settlement was a refusal, `undefined` when it
 * needs no comment (the ordinary case).
 *
 * Throwing means the opposite: the register does not have this punch, and
 * neither does anything after it in the queue, because `flush` stops there.
 */
export type PunchSyncResult = { readonly message?: string } | undefined;

export type PunchSync = (punch: QueuedPunch) => Promise<PunchSyncResult>;

export type PunchQueueState = {
  readonly entries: readonly QueuedPunch[];
  /** A flush in progress, which is what `Sincronizar` shows as busy (#4). */
  readonly syncing: boolean;
  /** Why the last flush stopped and kept the rest of the queue, or `null`. */
  readonly lastError: string | null;
  /**
   * What the last flush said about a punch it settled with a refusal — a
   * duplicate, or one of the two offline-window 422s — or `null`. Distinct
   * from `lastError`: a notice does not mean the flush stopped, only that one
   * row left with something the employee should read rather than silently
   * (#12).
   */
  readonly lastNotice: string | null;
};

export type PunchQueue = {
  getState(): PunchQueueState;
  subscribe(listener: () => void): () => void;
  /**
   * Add a punch. Resolves only once the durable write has actually landed —
   * the queue's own half of #1, the caller's half is not showing anything to
   * the employee before awaiting this.
   */
  enqueue(punch: QueuedPunch): Promise<void>;
  /**
   * Try to transmit everything, oldest first.
   *
   * `online` is the phone's opinion and is used for one thing: saying why,
   * immediately, instead of spending a doomed round trip on a radio that is
   * off. It is never what decides that a punch belongs in the queue — see the
   * header of `connectivity.ts`.
   */
  flush(options: { sync: PunchSync; online?: boolean }): Promise<void>;
};

/**
 * A bare `createPunchQueue()` — every test, and this is the whole reason there
 * are two `PunchQueueStore` implementations — gets an in-memory store rather
 * than the real one, so a test suite never opens a SQLite handle it did not
 * ask for. Production is the one caller that asks for the durable store, and
 * it does so explicitly below.
 */
export function createPunchQueue(
  store: PunchQueueStore = createMemoryPunchQueueStore(),
): PunchQueue {
  let state: PunchQueueState = {
    entries: [],
    syncing: false,
    lastError: null,
    lastNotice: null,
  };
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

  /**
   * Loaded once, at construction. `enqueue` and `flush` both await this before
   * touching `state`, so neither can run ahead of the store's own read and
   * either lose a row that was on disk already or clobber one just written —
   * see the module header.
   */
  const hydrated: Promise<void> = store.load().then((entries) => {
    set({ entries });
  });

  return {
    getState: () => state,

    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    enqueue: async (punch) => {
      await hydrated;
      await store.append(punch);
      set({ entries: [...state.entries, punch] });
    },

    flush: async ({ sync, online = true }) => {
      await hydrated;

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

      set({ syncing: true, lastError: null, lastNotice: null });

      // Oldest first, and stopping at the first refusal that means "try
      // again later". Order is what keeps an entrada from being transmitted
      // after the salida that followed it, and a queue that carried on past
      // that kind of failure would report the last error rather than the one
      // that stopped it.
      const pending = [...state.entries];
      let settled = 0;
      let failure: string | null = null;
      let notice: string | null = null;

      for (const entry of pending) {
        try {
          const result = await sync(entry);
          await store.remove(entry.id);
          settled += 1;

          if (result?.message !== undefined) {
            notice = result.message;
          }
        } catch (error) {
          failure = messageFor(error);
          break;
        }
      }

      // Only what settled. Rows added while the flush was in flight are still
      // in `state.entries` and are kept — dropping by count from the head
      // rather than replacing the array is what makes a punch made mid-sync
      // survive it.
      set({
        entries: state.entries.slice(settled),
        syncing: false,
        lastError: failure,
        lastNotice: notice,
      });
    },
  };
}

/**
 * The one the app uses. A module singleton rather than a provider: the queue
 * outlives any screen — a punch made on Inicio is still waiting when the
 * employee is on Documentos — and there is nothing for a React tree to scope it
 * to. Tests pass their own through `usePunchQueue`, backed by
 * `createMemoryPunchQueueStore()` unless a test says otherwise.
 */
export const punchQueue = createPunchQueue(createSqlitePunchQueueStore());

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
