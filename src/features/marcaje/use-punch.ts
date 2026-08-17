/**
 * Pressing the button, and everything that can happen next (KMO-17).
 *
 * The hook owns three things the component must not: that one tap is one punch
 * however many times it is pressed (#6), that the screen only advances on a
 * punch the **server** recorded (#2), and that nothing which goes wrong on the
 * way costs the employee their place (#8).
 *
 * The state it draws is the server's, advanced by whatever this hook has since
 * recorded. That order matters: `/me/today` is the truth about the day, and the
 * local step is only there so the button changes the moment the receipt lands
 * rather than after a second round trip — a screen whose goal is ten seconds
 * from app open (G1) cannot spend one of them re-reading what it just did.
 *
 * Since KMO-23, "the server recorded it" has a second shape: a request that
 * never reached the server at all — `ApiError.isConnectivityFailure` — is not
 * a failure here, it is the Art. 10 exception. The punch is written to the
 * durable queue before this hook advances anything (#1), the state moves the
 * same way it does off a receipt (Art. 38: never block), and the queue —
 * `punch-queue.ts`, flushed by `createPunchSync` — is what eventually gets it
 * to the register.
 */

import * as Crypto from 'expo-crypto';
import { useCallback, useMemo, useRef, useState } from 'react';

import { isApiError } from '@/api';
import { es } from '@/i18n';

import type { GeoStatus, LocationFix } from './geofence';
import { readDeviceDateTime } from './now-clock';
import {
  createPunchApi,
  isDuplicateMarkError,
  type PunchApi,
  type PunchReceipt,
} from './punch-api';
import { punchQueue as appPunchQueue, type PunchQueue, type QueuedPunch } from './punch-queue';
import { punchTypeFor, stateAfterPunch, type PunchState } from './punch-state';

/**
 * What the last attempt did.
 *
 * `duplicate` and `queued` are deliberately not kinds of `failed`. The register
 * already holds the punch in the first case; in the second it is on its way,
 * captured durably rather than lost — and the screen says so in a calm line
 * instead of an error either time (#7, KMO-23 #1).
 */
export type PunchAttempt =
  | { readonly status: 'idle' }
  | { readonly status: 'submitting' }
  | { readonly status: 'failed'; readonly message: string }
  | { readonly status: 'duplicate'; readonly message: string }
  | { readonly status: 'queued'; readonly message: string };

export type Punch = PunchAttempt & {
  /**
   * The state to draw: the server's, plus any punch recorded since it answered.
   * `null` when nobody has said — the screen then shows no punch surface at all,
   * rather than guessing at `before` (KMO-15 #4).
   */
  readonly state: PunchState | null;
  /** The last receipt the server returned, for the comprobante (KMO-19). */
  readonly receipt: PunchReceipt | null;
  /** Press the primary button. A no-op while a punch is already in flight. */
  readonly punch: () => void;
};

export type UsePunchOptions = {
  /** Today's punch state from `GET /me/today`; `null` until it has answered. */
  state?: PunchState | null;
  /** The phone's reading, from `useLocation`. `null` when there is none (#11). */
  fix?: LocationFix | null;
  /** The client's advisory verdict, which travels with the punch (#5). */
  geoStatus?: GeoStatus;
  /**
   * Called with the receipt the server returned. KMO-19 opens the comprobante
   * sheet from here (#10); until it does, the punch is confirmed by the screen
   * changing state under the employee's thumb.
   */
  onPunched?: (receipt: PunchReceipt) => void;
  /**
   * Called when the server says the punch was already recorded (#7). The screen
   * reloads `/me/today` from here, so what it shows afterwards is what the
   * register actually holds rather than what this hook inferred.
   */
  onAlreadyMarked?: () => void;
  /**
   * Called once the punch is durably queued (KMO-23 #1) — after the write, not
   * before, so a caller that opens something off this callback is opening it
   * onto a punch that is actually on disk. KMO-24 hangs the offline receipt
   * off this; nothing in this ticket consumes it.
   */
  onQueued?: (punch: QueuedPunch) => void;
  /**
   * Whose token made this punch (docs/design-decisions.md §4.7 D5) — stamped
   * on the `QueuedPunch` this hook builds on a connectivity failure, so a
   * shared device's queue can never flush this row under a different
   * employee's sign-in later. The screen that mounts this hook is always
   * behind the `signedIn` guard, so a real id is always at hand.
   */
  userId: number;
  /** Injected in tests; the app uses the configured client. */
  api?: PunchApi;
  /** Injected in tests; the app uses the process-wide queue. */
  queue?: PunchQueue;
  /** Injected in tests; the app reads the phone. */
  clock?: () => Date;
};

export function usePunch({
  state = null,
  fix = null,
  geoStatus = 'unknown',
  onPunched,
  onAlreadyMarked,
  onQueued,
  userId,
  api,
  queue = appPunchQueue,
  clock,
}: UsePunchOptions): Punch {
  // Built once, like `useToday`'s: a caller passing a fresh object each render
  // would rebuild the client on every keystroke elsewhere on the screen.
  const punchApi = useMemo(() => api ?? createPunchApi(), [api]);

  const [attempt, setAttempt] = useState<PunchAttempt>({ status: 'idle' });

  /** What this hook has recorded since the server last answered. */
  const [recorded, setRecorded] = useState<PunchState | null>(null);

  const [receipt, setReceipt] = useState<PunchReceipt | null>(null);

  /**
   * #6, and the reason this is a ref rather than a read of `attempt`.
   *
   * `setAttempt` lands a render later, so on a slow link the second tap arrives
   * while the button still believes it is idle — which is precisely the network
   * the criterion is about. The ref is what is true at the moment of the tap,
   * and it is what stops a warehouse double-tap becoming two rows in the
   * attendance book.
   */
  const inFlight = useRef(false);

  // The server's, unless this hook has since recorded a punch it did not know
  // about. Never the other way round: a reload that reports the day differently
  // is `/me/today` correcting us, and it should.
  const current = recorded ?? state;

  const punch = useCallback(() => {
    if (inFlight.current) {
      return;
    }

    // Nothing left to punch today, or nobody has said what the day looks like.
    // Both are the button not being on screen at all, so this is belt and
    // braces — and the belt matters: the one thing worse than a missing punch
    // is a third one in a register that allows two.
    const type = current === null ? null : punchTypeFor(current);
    if (type === null) {
      return;
    }

    inFlight.current = true;
    setAttempt({ status: 'submitting' });

    // Read once, at the moment of the tap, and carried rather than re-read if
    // this punch ends up queued — see the header of `now-clock.ts` and
    // docs/design-decisions.md §4.3. Computed unconditionally because there is
    // no way to know yet whether the request will need it.
    const deviceDatetime = readDeviceDateTime(clock);

    void (async () => {
      try {
        const receipt = await punchApi.punch({ type, fix, geoStatus });

        // Off the receipt, not off the tap. The state moves because the register
        // moved, which is the difference between a screen that reports
        // attendance and one that claims it.
        setRecorded(stateAfterPunch(receipt.type));
        setReceipt(receipt);
        setAttempt({ status: 'idle' });
        onPunched?.(receipt);
      } catch (error) {
        if (isDuplicateMarkError(error)) {
          // The register already holds it, so the screen is behind rather than
          // wrong. It advances — the punch exists — and asks for the day again.
          setRecorded(stateAfterPunch(type));
          setAttempt({ status: 'duplicate', message: es.marcaje.punch.alreadyMarked });
          onAlreadyMarked?.();

          return;
        }

        if (isApiError(error) && error.isConnectivityFailure) {
          // Art. 10's exception, not #8's failure: the request never reached
          // the server, so capture-and-store is what the regulation calls
          // conforming. `queue.enqueue` durably writes the row before this
          // hook advances anything — KMO-23 #1 — which is why every state
          // change below sits after the `await` rather than before it.
          const queued: QueuedPunch = {
            id: Crypto.randomUUID(),
            userId,
            type,
            fix,
            geoStatus,
            idempotencyKey: Crypto.randomUUID(),
            deviceDatetime,
          };

          await queue.enqueue(queued);

          // Never blocked (Art. 38): the day advances exactly as it would off
          // a receipt, because the punch has been captured even though the
          // register does not have it yet.
          setRecorded(stateAfterPunch(type));
          setAttempt({ status: 'queued', message: es.marcaje.punch.queued });
          onQueued?.(queued);

          return;
        }

        // #8. Nothing about the day changes: the state is untouched, the button
        // keeps its label, and the employee is standing where they were.
        setAttempt({ status: 'failed', message: messageFor(error) });
      } finally {
        inFlight.current = false;
      }
    })();
  }, [
    current,
    fix,
    geoStatus,
    onAlreadyMarked,
    onPunched,
    onQueued,
    punchApi,
    queue,
    clock,
    userId,
  ]);

  return useMemo(
    () => ({ ...attempt, state: current, receipt, punch }),
    [attempt, current, punch, receipt],
  );
}

/**
 * What to put in front of the employee when the punch did not go through.
 *
 * The server's own sentence wins whenever there is one — `ams` already answers
 * in Spanish out of `lang/`, and it knows why it refused. The catalogue covers
 * the two cases where there is nothing to quote: a request that never reached a
 * server, and a 201 whose body was not a receipt.
 */
function messageFor(error: unknown): string {
  return isApiError(error) ? error.userMessage : es.marcaje.punch.failed;
}
