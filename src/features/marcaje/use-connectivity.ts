/**
 * Connectivity as the punch flow sees it (KMO-22 #1).
 *
 * **There is no setter, and that is criterion #8.** Nothing here can be told the
 * app is offline — the value comes from the OS and from nowhere else, so there is
 * no call a settings screen could make and no state a preference could persist.
 * docs/design-decisions.md §4.6 reads Res. 38 Art. 10's *situaciones
 * excepcionales* as forbidding a manual offline mode outright: a toggle would
 * make the exception the operating mode, and would hand the employee a way to
 * choose their own timestamp. The cheapest guarantee against building one later
 * is a type that cannot express it.
 *
 * What the value is *for* is narrow. It explains a failure the employee can see —
 * pressing `Sincronizar` with no signal says so instead of spending a doomed
 * round trip — and `onRestored` is the edge KMO-23 hangs the automatic flush off,
 * which is the Art. 10 condition that the deferred send happen by itself.
 *
 * What it is never for is deciding that a punch goes to the queue. That decision
 * belongs to a request that actually failed; see the header of `connectivity.ts`.
 */

import { useEffect, useRef, useState } from 'react';

import { createConnectivitySource, type ConnectivitySource } from './connectivity';

export type UseConnectivityOptions = {
  /** Injected in tests; the app reads the phone. */
  source?: ConnectivitySource;
  /**
   * Called when connectivity comes back — the `false → true` edge only, never
   * the state merely being true.
   *
   * The distinction is the whole value of the callback. A flush fired on every
   * report would run on each Wi-Fi handover with an empty queue, and one fired
   * on mount would run before the employee has done anything.
   */
  onRestored?: () => void;
};

export type Connectivity = {
  /**
   * What the OS believes. Starts optimistic: the first read is asynchronous, and
   * a screen that assumed offline for those milliseconds would flash a reason
   * for a failure that has not happened.
   */
  readonly online: boolean;
};

export function useConnectivity({ source, onRestored }: UseConnectivityOptions = {}): Connectivity {
  const [online, setOnline] = useState(true);

  /**
   * Kept in a ref so a caller passing a fresh arrow each render — which every
   * caller does — cannot tear down the subscription and rebuild it on every
   * render of the screen.
   */
  const restored = useRef(onRestored);

  useEffect(() => {
    restored.current = onRestored;
  }, [onRestored]);

  /**
   * What the last report said, read at the moment the next one arrives.
   *
   * A ref rather than the state above because the edge has to be decided against
   * a value that is already true, and `setOnline` lands a render later: two
   * changes inside one frame would both compare against the stale render's
   * value, and the second would fire `onRestored` a second time.
   */
  const previous = useRef(true);

  useEffect(() => {
    const connectivity = source ?? createConnectivitySource();
    let live = true;

    const report = (next: boolean): void => {
      if (!live) {
        return;
      }

      const wasOffline = !previous.current;
      previous.current = next;
      setOnline(next);

      if (next && wasOffline) {
        restored.current?.();
      }
    };

    void connectivity.getState().then(report);
    const unsubscribe = connectivity.subscribe(report);

    return () => {
      live = false;
      unsubscribe();
    };
  }, [source]);

  return { online };
}
