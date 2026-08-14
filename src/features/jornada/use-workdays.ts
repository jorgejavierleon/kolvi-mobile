/**
 * Loading the Historial screen's workday history, a calendar month at a time.
 *
 * The initial load and `reload()` follow the same three-state-plus-retry
 * shape as `use-upcoming-shifts.ts`. `loadOlderMonth()` is this hook's own
 * addition: Res. 38 Art. 22.1 gives the worker 5 years of access, so the
 * screen pages back through history by asking for the calendar month before
 * whatever it has already loaded, appending rather than replacing — and a
 * failure paging back leaves the months already on screen alone rather than
 * losing them.
 *
 * "This month" is a UI bookmark, not a legal timestamp — it only decides
 * which month's page loads first, never a value that is stored or shown as
 * when something happened. So, like `features/marcaje/now-clock.ts`'s own
 * device read, it comes from `Date` behind an injectable clock rather than
 * from a naive wall-clock string, and it is read exactly once per mount
 * (`useState`'s lazy initializer) so a caller passing a fresh `() => new
 * Date()` closure every render cannot move the anchor mid-session.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { formatNaiveDate, type NaiveDate } from '@/api';

import { createWorkdaysApi, type Workday, type WorkdaysApi } from './workdays-api';

type MonthAnchor = { readonly year: number; readonly month: number };

export type WorkdaysLoad =
  | { readonly status: 'loading' }
  | {
      readonly status: 'loaded';
      readonly workdays: readonly Workday[];
      readonly retrying: boolean;
      readonly loadingMore: boolean;
      readonly loadMoreFailed: boolean;
    }
  | { readonly status: 'failed'; readonly error: unknown; readonly retrying: boolean };

export type WorkdaysState = WorkdaysLoad & {
  /** Ask the current month again. A no-op while a request is already in flight. */
  reload: () => void;
  /** Fetch the calendar month before whatever is already loaded, and append it. */
  loadOlderMonth: () => void;
};

export function useWorkdays(api?: WorkdaysApi, now: () => Date = () => new Date()): WorkdaysState {
  const workdaysApi = useMemo(() => api ?? createWorkdaysApi(), [api]);

  const [thisMonth] = useState<MonthAnchor>(() => anchorOf(now()));

  const [load, setLoad] = useState<WorkdaysLoad>({ status: 'loading' });

  const inFlight = useRef(false);
  const current = useRef<AbortController | null>(null);
  /** The oldest month requested so far, so `loadOlderMonth` knows what comes next. */
  const oldestLoaded = useRef<MonthAnchor>(thisMonth);

  const request = useCallback(
    (anchor: MonthAnchor) => {
      if (inFlight.current) {
        return;
      }

      inFlight.current = true;
      oldestLoaded.current = anchor;
      setLoad(markRetrying);

      const controller = new AbortController();
      current.current = controller;

      void (async () => {
        try {
          const { from, to } = rangeOf(anchor);
          const workdays = await workdaysApi.fetchWorkdays({ from, to, signal: controller.signal });

          if (!controller.signal.aborted) {
            setLoad({
              status: 'loaded',
              workdays,
              retrying: false,
              loadingMore: false,
              loadMoreFailed: false,
            });
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            setLoad({ status: 'failed', error, retrying: false });
          }
        } finally {
          inFlight.current = false;
        }
      })();
    },
    [workdaysApi],
  );

  const loadOlderMonth = useCallback(() => {
    if (inFlight.current || load.status !== 'loaded') {
      return;
    }

    const older = monthBefore(oldestLoaded.current);

    inFlight.current = true;
    setLoad((previous) =>
      previous.status === 'loaded'
        ? { ...previous, loadingMore: true, loadMoreFailed: false }
        : previous,
    );

    const controller = new AbortController();
    current.current = controller;

    void (async () => {
      try {
        const { from, to } = rangeOf(older);
        const olderWorkdays = await workdaysApi.fetchWorkdays({
          from,
          to,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          oldestLoaded.current = older;
          setLoad((previous) =>
            previous.status === 'loaded'
              ? {
                  ...previous,
                  workdays: [...previous.workdays, ...olderWorkdays],
                  loadingMore: false,
                }
              : previous,
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoad((previous) =>
            previous.status === 'loaded'
              ? { ...previous, loadingMore: false, loadMoreFailed: true }
              : previous,
          );
        }
      } finally {
        inFlight.current = false;
      }
    })();
  }, [load.status, workdaysApi]);

  useEffect(() => {
    request(thisMonth);

    return () => {
      current.current?.abort();
    };
  }, [request, thisMonth]);

  const reload = useCallback(() => {
    request(thisMonth);
  }, [request, thisMonth]);

  return useMemo(() => ({ ...load, reload, loadOlderMonth }), [load, reload, loadOlderMonth]);
}

function markRetrying(previous: WorkdaysLoad): WorkdaysLoad {
  if (previous.status === 'loaded') {
    return { ...previous, retrying: true };
  }

  if (previous.status === 'failed') {
    return { ...previous, retrying: true };
  }

  return previous;
}

function anchorOf(date: Date): MonthAnchor {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function monthBefore({ year, month }: MonthAnchor): MonthAnchor {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function rangeOf({ year, month }: MonthAnchor): { from: NaiveDate; to: NaiveDate } {
  return {
    from: formatNaiveDate({ year, month, day: 1 }),
    to: formatNaiveDate({ year, month, day: daysInMonth(year, month) }),
  };
}

const thirtyDayMonths: ReadonlySet<number> = new Set([4, 6, 9, 11]);

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return thirtyDayMonths.has(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
