/**
 * Loading the Jornada tab's one request, and offering it again when it fails.
 *
 * Same three-state-plus-retry shape as `features/marcaje/use-today.ts` —
 * loading/loaded/failed, a `retrying` flag that keeps whatever is already on
 * screen rather than replacing it with skeletons the employee already sat
 * through once, and a request abandoned when the screen goes. A separate hook
 * rather than a shared one: a feature never imports another feature, and the
 * two screens' loads are independent regardless.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createUpcomingShiftsApi, type UpcomingShifts, type UpcomingShiftsApi } from './shifts-api';

export type UpcomingShiftsLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly shifts: UpcomingShifts; readonly retrying: boolean }
  | { readonly status: 'failed'; readonly error: unknown; readonly retrying: boolean };

export type UpcomingShiftsState = UpcomingShiftsLoad & {
  /** Ask again. A no-op while a request is already in flight. */
  reload: () => void;
};

export function useUpcomingShifts(api?: UpcomingShiftsApi): UpcomingShiftsState {
  const shiftsApi = useMemo(() => api ?? createUpcomingShiftsApi(), [api]);

  const [load, setLoad] = useState<UpcomingShiftsLoad>({ status: 'loading' });

  const inFlight = useRef(false);
  const current = useRef<AbortController | null>(null);

  const request = useCallback(() => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setLoad(markRetrying);

    const controller = new AbortController();
    current.current = controller;

    void (async () => {
      try {
        const shifts = await shiftsApi.fetchUpcomingShifts({ signal: controller.signal });

        if (!controller.signal.aborted) {
          setLoad({ status: 'loaded', shifts, retrying: false });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoad({ status: 'failed', error, retrying: false });
        }
      } finally {
        inFlight.current = false;
      }
    })();
  }, [shiftsApi]);

  useEffect(() => {
    request();

    return () => {
      current.current?.abort();
    };
  }, [request]);

  return useMemo(() => ({ ...load, reload: request }), [load, request]);
}

function markRetrying(previous: UpcomingShiftsLoad): UpcomingShiftsLoad {
  if (previous.status === 'loaded') {
    return { ...previous, retrying: true };
  }

  if (previous.status === 'failed') {
    return { ...previous, retrying: true };
  }

  return previous;
}
