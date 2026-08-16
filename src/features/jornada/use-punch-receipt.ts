/**
 * The punch-receipt sheet's own load (KMO-34 #5): opened by a `markId`
 * rather than on mount, since which punch (if either) has been tapped is not
 * known until the attendance strip is on screen.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createPunchReceiptApi, type PunchReceiptApi } from './punch-receipt-api';
import type { PunchReceiptLoad } from './punch-receipt-sheet';

export type UsePunchReceipt = {
  /** `null` is the sheet closed. */
  load: PunchReceiptLoad | null;
  open: (markId: number) => void;
  dismiss: () => void;
  /** Asks again for whichever mark is currently open. A no-op once dismissed. */
  retry: () => void;
};

export function usePunchReceipt(api?: PunchReceiptApi): UsePunchReceipt {
  const receiptApi = useMemo(() => api ?? createPunchReceiptApi(), [api]);

  const [entry, setEntry] = useState<{ markId: number; load: PunchReceiptLoad } | null>(null);
  const current = useRef<AbortController | null>(null);

  const request = useCallback(
    (markId: number) => {
      current.current?.abort();

      const controller = new AbortController();
      current.current = controller;
      setEntry({ markId, load: { status: 'loading' } });

      void (async () => {
        try {
          const receipt = await receiptApi.fetchPunchReceipt(markId, { signal: controller.signal });

          if (!controller.signal.aborted) {
            setEntry({ markId, load: { status: 'loaded', receipt } });
          }
        } catch {
          if (!controller.signal.aborted) {
            setEntry({ markId, load: { status: 'failed' } });
          }
        }
      })();
    },
    [receiptApi],
  );

  const dismiss = useCallback(() => {
    current.current?.abort();
    setEntry(null);
  }, []);

  const retry = useCallback(() => {
    if (entry !== null) {
      request(entry.markId);
    }
  }, [entry, request]);

  useEffect(
    () => () => {
      current.current?.abort();
    },
    [],
  );

  return { load: entry?.load ?? null, open: request, dismiss, retry };
}
