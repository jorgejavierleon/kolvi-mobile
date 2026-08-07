/**
 * Loading the punch history, and offering it again when it fails.
 *
 * The same three states, one retry and one abort-on-unmount as `use-today.ts`,
 * with one difference that is the reason it is a separate hook rather than a
 * second call to that one: it is **gated**, and does not fetch until the
 * employee opens the list.
 *
 * That gate is the home screen's one-request architecture holding. Goal G1 is
 * time-to-punch under ten seconds from app open at p90; a second request fired
 * on mount for a list nobody has looked at yet spends a warehouse connection's
 * bandwidth on the screen where it is most expensive. Opened, the list pays its
 * own round trip, and the employee is by then waiting for a list rather than
 * reaching for a button.
 *
 * **Every opening asks again**, and the rows already loaded stay on screen while
 * it does. The register changes while the sheet is shut — this app is usually
 * what changed it, by recording a punch — and a history that omits the mark the
 * employee made a minute ago is the one wrong answer this list can give. The
 * previous rows are kept during the refetch rather than replaced by a skeleton,
 * so the cost of being current is a moment's staleness and never a blank sheet.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createMarksApi, type MarksApi } from './marks-api';
import type { PunchReceipt } from './punch-api';

export type MarksLoad =
  | { readonly status: 'loading' }
  | {
      readonly status: 'loaded';
      readonly marks: readonly PunchReceipt[];
      readonly retrying: boolean;
    }
  | { readonly status: 'failed'; readonly error: unknown; readonly retrying: boolean };

export type Marks = MarksLoad & {
  /** Ask again. A no-op while a request is already in flight. */
  reload: () => void;
};

export type UseMarksOptions = {
  /**
   * Whether the list is being looked at. `false` holds the request; the first
   * `true` sends it.
   */
  enabled: boolean;
  /** Injected in tests; the app uses the configured client. */
  api?: MarksApi;
};

export function useMarks({ enabled, api }: UseMarksOptions): Marks {
  // Built once, like `useToday`'s: a caller passing a freshly-built object each
  // render would re-run the effect below and turn one request into one per
  // render.
  const marksApi = useMemo(() => api ?? createMarksApi(), [api]);

  const [load, setLoad] = useState<MarksLoad>({ status: 'loading' });

  // Guards a second request while one is in flight — a double-tapped retry, or
  // a sheet closed and reopened before the first load answered. `retrying`
  // lands a render later, so the ref is what is true at the tap.
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
        const marks = await marksApi.fetchMarks({ signal: controller.signal });

        if (!controller.signal.aborted) {
          setLoad({ status: 'loaded', marks, retrying: false });
        }
      } catch (error) {
        // A sheet that has gone is not a sheet with a failed load on it. Its own
        // unmount aborted this, and reporting that as an error would be the app
        // telling the employee about something the app did.
        if (!controller.signal.aborted) {
          setLoad({ status: 'failed', error, retrying: false });
        }
      } finally {
        inFlight.current = false;
      }
    })();
  }, [marksApi]);

  // The *transition* into `enabled` is what asks, not `enabled` being true — so
  // a re-render while the list is open costs nothing, and each fresh opening
  // gets the register as it is now. The gate is the sheet being open and not the
  // sheet being visible: opening a comprobante from a row hides the list without
  // closing it, and coming back must not re-request.
  const wasEnabled = useRef(false);

  useEffect(() => {
    if (enabled && !wasEnabled.current) {
      request();
    }

    wasEnabled.current = enabled;
  }, [enabled, request]);

  useEffect(
    () => () => {
      current.current?.abort();
    },
    [],
  );

  return useMemo(() => ({ ...load, reload: request }), [load, request]);
}

/** The first load stays `loading`; a settled list keeps its rows and says so. */
function markRetrying(previous: MarksLoad): MarksLoad {
  if (previous.status === 'loaded') {
    return { ...previous, retrying: true };
  }

  if (previous.status === 'failed') {
    return { ...previous, retrying: true };
  }

  return previous;
}
