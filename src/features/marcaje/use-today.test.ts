import { act, renderHook } from '@testing-library/react-native';

import type { NaiveDate, NaiveTime } from '@/api';

import type { TodayApi, TodaySummary } from './today-api';
import { useToday } from './use-today';

const summary: TodaySummary = {
  date: '2026-08-04' as NaiveDate,
  shift: {
    premise: 'Sucursal Ñuñoa',
    startTime: '08:00:00' as NaiveTime,
    endTime: '17:00:00' as NaiveTime,
    lunch: { startTime: '13:00:00' as NaiveTime, endTime: '14:00:00' as NaiveTime },
  },
  punchState: 'before',
  week: { workedHours: 32.5, contractedHours: 44 },
};

/**
 * An API whose calls are settled by the test, one at a time.
 *
 * A deferred promise rather than a resolved mock, because most of what this hook
 * does happens *while* a request is in flight — the retry guard, the state a
 * retry leaves on screen — and a mock that has already settled cannot show any
 * of it.
 */
function deferredApi() {
  const calls: { resolve: (value: TodaySummary) => void; reject: (error: unknown) => void }[] = [];

  const api: TodayApi = {
    fetchToday: () =>
      new Promise<TodaySummary>((resolve, reject) => {
        calls.push({ resolve, reject });
      }),
  };

  return { api, calls };
}

/** Settle one call and let the state it sets land inside this act scope. */
async function settle(action: () => void) {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}

describe('useToday', () => {
  it('starts loading and asks once', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => useToday(api));

    expect(result.current.status).toBe('loading');
    expect(calls).toHaveLength(1);
  });

  it('makes exactly one request across re-renders — the screen costs one call (#6)', async () => {
    const { api, calls } = deferredApi();

    const { rerender } = await renderHook(() => useToday(api));
    await rerender({});
    await rerender({});

    expect(calls).toHaveLength(1);
  });

  it('settles into the summary the server answered with', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => useToday(api));
    await settle(() => calls[0]?.resolve(summary));

    expect(result.current).toMatchObject({ status: 'loaded', summary, retrying: false });
  });

  it('reports a refusal as failed, carrying the error the screen has to explain', async () => {
    const { api, calls } = deferredApi();
    const refusal = new Error('boom');

    const { result } = await renderHook(() => useToday(api));
    await settle(() => calls[0]?.reject(refusal));

    expect(result.current).toMatchObject({ status: 'failed', error: refusal, retrying: false });
  });

  describe('reload', () => {
    it('asks again and recovers the screen', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useToday(api));
      await settle(() => calls[0]?.reject(new Error('no signal')));
      expect(result.current.status).toBe('failed');

      await act(async () => {
        result.current.reload();
      });
      expect(calls).toHaveLength(2);

      await settle(() => calls[1]?.resolve(summary));
      expect(result.current).toMatchObject({ status: 'loaded', summary });
    });

    it('keeps the failed state on screen while the retry runs, rather than flashing skeletons', async () => {
      // #9's second half: a retry must not lose the employee's place. Dropping
      // back to `loading` would replace the screen they are reading with the
      // skeletons they already sat through once.
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useToday(api));
      await settle(() => calls[0]?.reject(new Error('no signal')));

      await act(async () => {
        result.current.reload();
      });

      expect(result.current).toMatchObject({ status: 'failed', retrying: true });
    });

    it('keeps a loaded screen on screen while it refreshes', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useToday(api));
      await settle(() => calls[0]?.resolve(summary));

      await act(async () => {
        result.current.reload();
      });

      expect(result.current).toMatchObject({ status: 'loaded', summary, retrying: true });
    });

    it('ignores further presses while a request is already in flight', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useToday(api));
      await settle(() => calls[0]?.reject(new Error('no signal')));

      await act(async () => {
        result.current.reload();
        result.current.reload();
        result.current.reload();
      });

      expect(calls).toHaveLength(2);
    });

    it('does nothing while the first load is still running', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useToday(api));

      await act(async () => {
        result.current.reload();
      });

      expect(calls).toHaveLength(1);
    });
  });

  it('does not report a failure caused by its own unmount', async () => {
    // The screen going away aborts the request. Turning that into "no pudimos
    // cargar tu turno de hoy" would be the app announcing something the app did
    // — and on a tab switch the employee is not even looking at it.
    const { api, calls } = deferredApi();

    const { result, unmount } = await renderHook(() => useToday(api));
    await act(async () => {
      unmount();
    });

    await settle(() => calls[0]?.reject(new Error('Aborted')));

    expect(result.current.status).toBe('loading');
  });
});
