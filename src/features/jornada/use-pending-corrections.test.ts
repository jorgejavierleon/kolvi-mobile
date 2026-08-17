import { act, renderHook } from '@testing-library/react-native';

import type { NaiveDateTime } from '@/api';

import type { PendingCorrection, PendingCorrectionsApi } from './corrections-api';
import { usePendingCorrections } from './use-pending-corrections';

const correction: PendingCorrection = {
  id: 1,
  workdayId: 10,
  markTypeLabel: 'Entrada',
  originalTime: '08:00',
  proposedTime: '08:32',
  reason: 'Olvido de marcar',
  requestedBy: 'Ana Pérez',
  expiresAt: '2026-08-19 08:00:00' as NaiveDateTime,
};

/** Settled by the test, one call at a time — same reasoning `use-upcoming-shifts.test.ts` gives. */
function deferredApi() {
  const listCalls: {
    resolve: (value: readonly PendingCorrection[]) => void;
    reject: (error: unknown) => void;
  }[] = [];
  const reviewCalls: {
    action: 'approve' | 'decline';
    workdayId: number;
    modificationId: number;
    resolve: () => void;
    reject: (error: unknown) => void;
  }[] = [];

  const api: PendingCorrectionsApi = {
    fetchPendingCorrections: () =>
      new Promise<readonly PendingCorrection[]>((resolve, reject) => {
        listCalls.push({ resolve, reject });
      }),
    approve: (workdayId, modificationId) =>
      new Promise<void>((resolve, reject) => {
        reviewCalls.push({ action: 'approve', workdayId, modificationId, resolve, reject });
      }),
    decline: (workdayId, modificationId) =>
      new Promise<void>((resolve, reject) => {
        reviewCalls.push({ action: 'decline', workdayId, modificationId, resolve, reject });
      }),
  };

  return { api, listCalls, reviewCalls };
}

async function settle(action: () => void) {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}

describe('usePendingCorrections', () => {
  it('starts loading and asks once', async () => {
    const { api, listCalls } = deferredApi();

    const { result } = await renderHook(() => usePendingCorrections(api));

    expect(result.current.status).toBe('loading');
    expect(listCalls).toHaveLength(1);
  });

  it('settles into the corrections the server answered with', async () => {
    const { api, listCalls } = deferredApi();

    const { result } = await renderHook(() => usePendingCorrections(api));
    await settle(() => listCalls[0]?.resolve([correction]));

    expect(result.current).toMatchObject({
      status: 'loaded',
      corrections: [correction],
      retrying: false,
    });
  });

  it('reports a refusal as failed', async () => {
    const { api, listCalls } = deferredApi();
    const refusal = new Error('boom');

    const { result } = await renderHook(() => usePendingCorrections(api));
    await settle(() => listCalls[0]?.reject(refusal));

    expect(result.current).toMatchObject({ status: 'failed', error: refusal });
  });

  describe('review', () => {
    it('marks the correction as reviewing while approve is in flight', async () => {
      const { api, listCalls, reviewCalls } = deferredApi();

      const { result } = await renderHook(() => usePendingCorrections(api));
      await settle(() => listCalls[0]?.resolve([correction]));

      await act(async () => {
        result.current.review(correction, 'approve');
      });

      expect(result.current.reviewingIds.has(correction.id)).toBe(true);
      expect(reviewCalls).toMatchObject([
        { action: 'approve', workdayId: correction.workdayId, modificationId: correction.id },
      ]);
    });

    it('drops the correction from the list once approve succeeds', async () => {
      const { api, listCalls, reviewCalls } = deferredApi();

      const { result } = await renderHook(() => usePendingCorrections(api));
      await settle(() => listCalls[0]?.resolve([correction]));

      await act(async () => {
        result.current.review(correction, 'approve');
      });
      await settle(() => reviewCalls[0]?.resolve());

      expect(result.current).toMatchObject({ status: 'loaded', corrections: [] });
      expect(result.current.reviewingIds.has(correction.id)).toBe(false);
    });

    it('drops the correction from the list once decline succeeds', async () => {
      const { api, listCalls, reviewCalls } = deferredApi();

      const { result } = await renderHook(() => usePendingCorrections(api));
      await settle(() => listCalls[0]?.resolve([correction]));

      await act(async () => {
        result.current.review(correction, 'decline');
      });
      await settle(() => reviewCalls[0]?.resolve());

      expect(result.current).toMatchObject({ status: 'loaded', corrections: [] });
      expect(reviewCalls[0]).toMatchObject({ action: 'decline' });
    });

    it('keeps the correction on screen with an inline error when the request fails', async () => {
      const { api, listCalls, reviewCalls } = deferredApi();
      const refusal = new Error('expired');

      const { result } = await renderHook(() => usePendingCorrections(api));
      await settle(() => listCalls[0]?.resolve([correction]));

      await act(async () => {
        result.current.review(correction, 'approve');
      });
      await settle(() => reviewCalls[0]?.reject(refusal));

      expect(result.current).toMatchObject({ status: 'loaded', corrections: [correction] });
      expect(result.current.reviewingIds.has(correction.id)).toBe(false);
      expect(result.current.reviewErrors.get(correction.id)).toBe(refusal);
    });

    it('clears a previous error once a new attempt starts', async () => {
      const { api, listCalls, reviewCalls } = deferredApi();

      const { result } = await renderHook(() => usePendingCorrections(api));
      await settle(() => listCalls[0]?.resolve([correction]));

      await act(async () => {
        result.current.review(correction, 'approve');
      });
      await settle(() => reviewCalls[0]?.reject(new Error('expired')));
      expect(result.current.reviewErrors.has(correction.id)).toBe(true);

      await act(async () => {
        result.current.review(correction, 'decline');
      });

      expect(result.current.reviewErrors.has(correction.id)).toBe(false);
    });
  });
});
