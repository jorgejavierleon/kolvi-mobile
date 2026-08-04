/**
 * Loading the home screen's one request, and offering it again when it fails.
 *
 * There is no data-fetching library in this app, and this is the first screen
 * that needs one — so the shape is deliberately the smallest thing that covers
 * the criterion rather than a general-purpose cache. Three states, one retry, and
 * a request that is abandoned when the screen goes.
 *
 * `loading` is the *first* load only. A retry keeps whatever is already on screen
 * and raises `retrying` instead, because the alternative is replacing a screen the
 * employee is reading with skeletons they have already sat through once (#9).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createTodayApi, type TodayApi, type TodaySummary } from './today-api';

export type TodayLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly summary: TodaySummary; readonly retrying: boolean }
  | { readonly status: 'failed'; readonly error: unknown; readonly retrying: boolean };

export type Today = TodayLoad & {
  /** Ask again. A no-op while a request is already in flight. */
  reload: () => void;
};

export function useToday(api?: TodayApi): Today {
  // Same shape as `SessionProvider` and `ForgotPassword`: the default is built
  // once and a test injects its own. A caller passing a freshly-built object each
  // render would re-run the effect below and turn one request per app open into
  // one per render, which is the criterion this hook exists to hold (#6).
  const todayApi = useMemo(() => api ?? createTodayApi(), [api]);

  const [load, setLoad] = useState<TodayLoad>({ status: 'loading' });

  // Guards a second request while one is in flight — a double-tapped Reintentar,
  // or a retry pressed while the first load is still running. `retrying` lands a
  // render later, so the ref is what is true at the tap.
  const inFlight = useRef(false);

  // Cancels whatever is running when the screen goes.
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
        const summary = await todayApi.fetchToday({ signal: controller.signal });

        if (!controller.signal.aborted) {
          setLoad({ status: 'loaded', summary, retrying: false });
        }
      } catch (error) {
        // A screen that has gone is not a screen with a failed load on it. Its
        // own unmount aborted this, and reporting that as an error would be the
        // app telling the employee about something the app did.
        if (!controller.signal.aborted) {
          setLoad({ status: 'failed', error, retrying: false });
        }
      } finally {
        inFlight.current = false;
      }
    })();
  }, [todayApi]);

  useEffect(() => {
    request();

    return () => {
      current.current?.abort();
    };
  }, [request]);

  return useMemo(() => ({ ...load, reload: request }), [load, request]);
}

/** The first load stays `loading`; a settled screen keeps its content and says so. */
function markRetrying(previous: TodayLoad): TodayLoad {
  if (previous.status === 'loaded') {
    return { ...previous, retrying: true };
  }

  if (previous.status === 'failed') {
    return { ...previous, retrying: true };
  }

  return previous;
}
