/**
 * Loading the Jornada tab's pending-correction cards, and approving or
 * declining one.
 *
 * The list load is the same three-state-plus-retry shape as
 * `use-upcoming-shifts.ts`. Reviewing a card is a second, independent piece
 * of state layered on top: `reviewingIds` disables a card's own buttons while
 * its request is in flight, and `reviewErrors` keeps a card on screen with an
 * inline message when its request fails rather than making the failure look
 * like the whole list broke. A reviewed card is dropped from `corrections` on
 * success — the server does not re-list it, so there is nothing to reload for.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createPendingCorrectionsApi,
  type PendingCorrection,
  type PendingCorrectionsApi,
} from './corrections-api';

export type PendingCorrectionsLoad =
  | { readonly status: 'loading' }
  | {
      readonly status: 'loaded';
      readonly corrections: readonly PendingCorrection[];
      readonly retrying: boolean;
    }
  | { readonly status: 'failed'; readonly error: unknown; readonly retrying: boolean };

export type ReviewAction = 'approve' | 'decline';

export type PendingCorrectionsState = PendingCorrectionsLoad & {
  /** Ask again. A no-op while a request is already in flight. */
  reload: () => void;
  /** Ids of corrections whose approve/decline request is in flight. */
  reviewingIds: ReadonlySet<number>;
  /** The most recent review failure per correction id, cleared on the next attempt. */
  reviewErrors: ReadonlyMap<number, unknown>;
  review: (correction: PendingCorrection, action: ReviewAction) => void;
};

export function usePendingCorrections(api?: PendingCorrectionsApi): PendingCorrectionsState {
  const correctionsApi = useMemo(() => api ?? createPendingCorrectionsApi(), [api]);

  const [load, setLoad] = useState<PendingCorrectionsLoad>({ status: 'loading' });
  const [reviewingIds, setReviewingIds] = useState<ReadonlySet<number>>(new Set());
  const [reviewErrors, setReviewErrors] = useState<ReadonlyMap<number, unknown>>(new Map());

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
        const corrections = await correctionsApi.fetchPendingCorrections({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setLoad({ status: 'loaded', corrections, retrying: false });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoad({ status: 'failed', error, retrying: false });
        }
      } finally {
        inFlight.current = false;
      }
    })();
  }, [correctionsApi]);

  useEffect(() => {
    request();

    return () => {
      current.current?.abort();
    };
  }, [request]);

  const review = useCallback(
    (correction: PendingCorrection, action: ReviewAction) => {
      setReviewingIds((ids) => new Set(ids).add(correction.id));
      setReviewErrors((errors) => dropId(errors, correction.id));

      void (async () => {
        try {
          if (action === 'approve') {
            await correctionsApi.approve(correction.workdayId, correction.id);
          } else {
            await correctionsApi.decline(correction.workdayId, correction.id);
          }

          setLoad((previous) =>
            previous.status === 'loaded'
              ? {
                  ...previous,
                  corrections: previous.corrections.filter((row) => row.id !== correction.id),
                }
              : previous,
          );
        } catch (error) {
          setReviewErrors((errors) => new Map(errors).set(correction.id, error));
        } finally {
          setReviewingIds((ids) => {
            const next = new Set(ids);
            next.delete(correction.id);

            return next;
          });
        }
      })();
    },
    [correctionsApi],
  );

  return useMemo(
    () => ({ ...load, reload: request, reviewingIds, reviewErrors, review }),
    [load, request, reviewingIds, reviewErrors, review],
  );
}

function markRetrying(previous: PendingCorrectionsLoad): PendingCorrectionsLoad {
  if (previous.status === 'loaded') {
    return { ...previous, retrying: true };
  }

  if (previous.status === 'failed') {
    return { ...previous, retrying: true };
  }

  return previous;
}

function dropId(errors: ReadonlyMap<number, unknown>, id: number): ReadonlyMap<number, unknown> {
  if (!errors.has(id)) {
    return errors;
  }

  const next = new Map(errors);
  next.delete(id);

  return next;
}
