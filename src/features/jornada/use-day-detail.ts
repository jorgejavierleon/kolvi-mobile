/**
 * Loading the day-detail screen's one workday, and offering it again when it
 * fails (#8). Same three-state-plus-retry shape as `use-upcoming-shifts.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { NaiveDate } from '@/api';

import { createDayDetailApi, type DayDetail, type DayDetailApi } from './day-detail-api';

export type DayDetailLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly detail: DayDetail; readonly retrying: boolean }
  | { readonly status: 'failed'; readonly error: unknown; readonly retrying: boolean };

export type DayDetailState = DayDetailLoad & {
  /** Ask again. A no-op while a request is already in flight. */
  reload: () => void;
};

export function useDayDetail(date: NaiveDate, api?: DayDetailApi): DayDetailState {
  const dayDetailApi = useMemo(() => api ?? createDayDetailApi(), [api]);

  const [load, setLoad] = useState<DayDetailLoad>({ status: 'loading' });

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
        const detail = await dayDetailApi.fetchDayDetail(date, { signal: controller.signal });

        if (!controller.signal.aborted) {
          setLoad({ status: 'loaded', detail, retrying: false });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoad({ status: 'failed', error, retrying: false });
        }
      } finally {
        inFlight.current = false;
      }
    })();
  }, [date, dayDetailApi]);

  useEffect(() => {
    request();

    return () => {
      current.current?.abort();
    };
  }, [request]);

  return useMemo(() => ({ ...load, reload: request }), [load, request]);
}

function markRetrying(previous: DayDetailLoad): DayDetailLoad {
  if (previous.status === 'loaded') {
    return { ...previous, retrying: true };
  }

  if (previous.status === 'failed') {
    return { ...previous, retrying: true };
  }

  return previous;
}
