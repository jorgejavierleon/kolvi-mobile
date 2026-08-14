import { act, renderHook } from '@testing-library/react-native';

import type { NaiveDate, NaiveTime } from '@/api';

import type { UpcomingShifts, UpcomingShiftsApi } from './shifts-api';
import { useUpcomingShifts } from './use-upcoming-shifts';

const shifts: UpcomingShifts = {
  date: '2026-08-13' as NaiveDate,
  today: {
    date: '2026-08-13' as NaiveDate,
    premise: 'Sucursal Ñuñoa',
    startTime: '08:00:00' as NaiveTime,
    endTime: '17:00:00' as NaiveTime,
    lunch: { startTime: '13:00:00' as NaiveTime, endTime: '14:00:00' as NaiveTime },
    leaveTypeLabel: null,
    holidayName: null,
    punchState: 'before',
  },
  days: [],
};

/**
 * An API whose calls are settled by the test, one at a time — same reasoning
 * `use-today.test.ts`'s own `deferredApi` gives: most of what this hook does
 * happens while a request is in flight.
 */
function deferredApi() {
  const calls: { resolve: (value: UpcomingShifts) => void; reject: (error: unknown) => void }[] =
    [];

  const api: UpcomingShiftsApi = {
    fetchUpcomingShifts: () =>
      new Promise<UpcomingShifts>((resolve, reject) => {
        calls.push({ resolve, reject });
      }),
  };

  return { api, calls };
}

async function settle(action: () => void) {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}

describe('useUpcomingShifts', () => {
  it('starts loading and asks once', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => useUpcomingShifts(api));

    expect(result.current.status).toBe('loading');
    expect(calls).toHaveLength(1);
  });

  it('makes exactly one request across re-renders', async () => {
    const { api, calls } = deferredApi();

    const { rerender } = await renderHook(() => useUpcomingShifts(api));
    await rerender({});
    await rerender({});

    expect(calls).toHaveLength(1);
  });

  it('settles into the shifts the server answered with', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => useUpcomingShifts(api));
    await settle(() => calls[0]?.resolve(shifts));

    expect(result.current).toMatchObject({ status: 'loaded', shifts, retrying: false });
  });

  it('reports a refusal as failed, carrying the error the screen has to explain', async () => {
    const { api, calls } = deferredApi();
    const refusal = new Error('boom');

    const { result } = await renderHook(() => useUpcomingShifts(api));
    await settle(() => calls[0]?.reject(refusal));

    expect(result.current).toMatchObject({ status: 'failed', error: refusal, retrying: false });
  });

  describe('reload', () => {
    it('asks again and recovers the screen', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useUpcomingShifts(api));
      await settle(() => calls[0]?.reject(new Error('no signal')));
      expect(result.current.status).toBe('failed');

      await act(async () => {
        result.current.reload();
      });
      expect(calls).toHaveLength(2);

      await settle(() => calls[1]?.resolve(shifts));
      expect(result.current).toMatchObject({ status: 'loaded', shifts });
    });

    it('keeps the failed state on screen while the retry runs, rather than flashing skeletons', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useUpcomingShifts(api));
      await settle(() => calls[0]?.reject(new Error('no signal')));

      await act(async () => {
        result.current.reload();
      });

      expect(result.current).toMatchObject({ status: 'failed', retrying: true });
    });

    it('ignores further presses while a request is already in flight', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useUpcomingShifts(api));
      await settle(() => calls[0]?.reject(new Error('no signal')));

      await act(async () => {
        result.current.reload();
        result.current.reload();
        result.current.reload();
      });

      expect(calls).toHaveLength(2);
    });
  });

  it('does not report a failure caused by its own unmount', async () => {
    const { api, calls } = deferredApi();

    const { result, unmount } = await renderHook(() => useUpcomingShifts(api));
    await act(async () => {
      unmount();
    });

    await settle(() => calls[0]?.reject(new Error('Aborted')));

    expect(result.current.status).toBe('loading');
  });
});
