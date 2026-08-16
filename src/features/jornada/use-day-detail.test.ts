import { act, renderHook } from '@testing-library/react-native';

import type { NaiveDate } from '@/api';

import type { DayDetail, DayDetailApi } from './day-detail-api';
import { useDayDetail } from './use-day-detail';

const date = '2026-08-14' as NaiveDate;

const detail: DayDetail = {
  date,
  statusLabel: 'A tiempo',
  statusTone: 'success',
  shiftStart: null,
  shiftEnd: null,
  workedTime: '08:03',
  extraTime: '00:00',
  missingTime: '00:00',
  leaveTypeLabel: null,
  markIn: null,
  markOut: null,
};

/** Same reasoning `use-upcoming-shifts.test.ts`'s own `deferredApi` gives. */
function deferredApi() {
  const calls: { resolve: (value: DayDetail) => void; reject: (error: unknown) => void }[] = [];

  const api: DayDetailApi = {
    fetchDayDetail: () =>
      new Promise<DayDetail>((resolve, reject) => {
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

describe('useDayDetail', () => {
  it('starts loading and asks once', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => useDayDetail(date, api));

    expect(result.current.status).toBe('loading');
    expect(calls).toHaveLength(1);
  });

  it('settles into the detail the server answered with', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => useDayDetail(date, api));
    await settle(() => calls[0]?.resolve(detail));

    expect(result.current).toMatchObject({ status: 'loaded', detail, retrying: false });
  });

  it('reports a refusal as failed (#8)', async () => {
    const { api, calls } = deferredApi();
    const refusal = new Error('boom');

    const { result } = await renderHook(() => useDayDetail(date, api));
    await settle(() => calls[0]?.reject(refusal));

    expect(result.current).toMatchObject({ status: 'failed', error: refusal, retrying: false });
  });

  describe('reload', () => {
    it('asks again and recovers the screen', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useDayDetail(date, api));
      await settle(() => calls[0]?.reject(new Error('no signal')));
      expect(result.current.status).toBe('failed');

      await act(async () => {
        result.current.reload();
      });
      expect(calls).toHaveLength(2);

      await settle(() => calls[1]?.resolve(detail));
      expect(result.current).toMatchObject({ status: 'loaded', detail });
    });

    it('ignores further presses while a request is already in flight', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useDayDetail(date, api));
      await settle(() => calls[0]?.reject(new Error('no signal')));

      await act(async () => {
        result.current.reload();
        result.current.reload();
      });

      expect(calls).toHaveLength(2);
    });
  });

  it('does not report a failure caused by its own unmount', async () => {
    const { api, calls } = deferredApi();

    const { result, unmount } = await renderHook(() => useDayDetail(date, api));
    await act(async () => {
      unmount();
    });

    await settle(() => calls[0]?.reject(new Error('Aborted')));

    expect(result.current.status).toBe('loading');
  });
});
