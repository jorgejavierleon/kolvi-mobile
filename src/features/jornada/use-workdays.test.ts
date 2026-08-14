import { act, renderHook } from '@testing-library/react-native';

import type { NaiveDate } from '@/api';

import type { Workday, WorkdaysApi } from './workdays-api';
import { useWorkdays } from './use-workdays';

/** 14 August 2026 — a Friday, so "this month" is unambiguous in every test below. */
const fixedNow = () => new Date(2026, 7, 14);

function workday(date: NaiveDate): Workday {
  return {
    date,
    statusLabel: 'A tiempo',
    statusTone: 'success',
    workedTime: '08:00',
    extraTime: '00:00',
    missingTime: '00:00',
    leaveTypeLabel: null,
  };
}

/**
 * An API whose calls are settled by the test, one at a time — same reasoning
 * `use-upcoming-shifts.test.ts`'s own `deferredApi` gives: most of what this
 * hook does happens while a request is in flight.
 */
function deferredApi() {
  const calls: {
    from: NaiveDate;
    to: NaiveDate;
    resolve: (value: readonly Workday[]) => void;
    reject: (error: unknown) => void;
  }[] = [];

  const api: WorkdaysApi = {
    fetchWorkdays: ({ from, to }) =>
      new Promise<readonly Workday[]>((resolve, reject) => {
        calls.push({ from, to, resolve, reject });
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

describe('useWorkdays', () => {
  it('starts loading and asks once, for the current calendar month', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => useWorkdays(api, fixedNow));

    expect(result.current.status).toBe('loading');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('settles into the workdays the server answered with', async () => {
    const { api, calls } = deferredApi();
    const workdays = [workday('2026-08-14' as NaiveDate)];

    const { result } = await renderHook(() => useWorkdays(api, fixedNow));
    await settle(() => calls[0]?.resolve(workdays));

    expect(result.current).toMatchObject({
      status: 'loaded',
      workdays,
      retrying: false,
      loadingMore: false,
      loadMoreFailed: false,
    });
  });

  it('reports a refusal as failed, carrying the error the screen has to explain', async () => {
    const { api, calls } = deferredApi();
    const refusal = new Error('boom');

    const { result } = await renderHook(() => useWorkdays(api, fixedNow));
    await settle(() => calls[0]?.reject(refusal));

    expect(result.current).toMatchObject({ status: 'failed', error: refusal, retrying: false });
  });

  describe('reload', () => {
    it('asks again for the same month and recovers the screen', async () => {
      const { api, calls } = deferredApi();
      const workdays = [workday('2026-08-14' as NaiveDate)];

      const { result } = await renderHook(() => useWorkdays(api, fixedNow));
      await settle(() => calls[0]?.reject(new Error('no signal')));
      expect(result.current.status).toBe('failed');

      await act(async () => {
        result.current.reload();
      });
      expect(calls).toHaveLength(2);
      expect(calls[1]).toMatchObject({ from: '2026-08-01', to: '2026-08-31' });

      await settle(() => calls[1]?.resolve(workdays));
      expect(result.current).toMatchObject({ status: 'loaded', workdays });
    });

    it('keeps the failed state on screen while the retry runs, rather than flashing skeletons', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useWorkdays(api, fixedNow));
      await settle(() => calls[0]?.reject(new Error('no signal')));

      await act(async () => {
        result.current.reload();
      });

      expect(result.current).toMatchObject({ status: 'failed', retrying: true });
    });
  });

  describe('loadOlderMonth', () => {
    it('fetches the calendar month before the current one and appends it', async () => {
      const { api, calls } = deferredApi();
      const august = [workday('2026-08-14' as NaiveDate)];
      const july = [workday('2026-07-20' as NaiveDate)];

      const { result } = await renderHook(() => useWorkdays(api, fixedNow));
      await settle(() => calls[0]?.resolve(august));

      await act(async () => {
        result.current.loadOlderMonth();
      });
      expect(calls).toHaveLength(2);
      expect(calls[1]).toMatchObject({ from: '2026-07-01', to: '2026-07-31' });

      await settle(() => calls[1]?.resolve(july));

      expect(result.current).toMatchObject({
        status: 'loaded',
        workdays: [...august, ...july],
        loadingMore: false,
        loadMoreFailed: false,
      });
    });

    it('pages back a further month from whatever was loaded last, not from the first page again', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useWorkdays(api, fixedNow));
      await settle(() => calls[0]?.resolve([]));

      await act(async () => {
        result.current.loadOlderMonth();
      });
      await settle(() => calls[1]?.resolve([]));

      await act(async () => {
        result.current.loadOlderMonth();
      });

      expect(calls).toHaveLength(3);
      expect(calls[2]).toMatchObject({ from: '2026-06-01', to: '2026-06-30' });
    });

    it('reports loadingMore while the page-back request is in flight', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useWorkdays(api, fixedNow));
      await settle(() => calls[0]?.resolve([]));

      await act(async () => {
        result.current.loadOlderMonth();
      });

      expect(result.current).toMatchObject({ status: 'loaded', loadingMore: true });
    });

    it('keeps the months already loaded when the page-back request fails', async () => {
      const { api, calls } = deferredApi();
      const august = [workday('2026-08-14' as NaiveDate)];

      const { result } = await renderHook(() => useWorkdays(api, fixedNow));
      await settle(() => calls[0]?.resolve(august));

      await act(async () => {
        result.current.loadOlderMonth();
      });
      await settle(() => calls[1]?.reject(new Error('no signal')));

      expect(result.current).toMatchObject({
        status: 'loaded',
        workdays: august,
        loadingMore: false,
        loadMoreFailed: true,
      });
    });

    it('is a no-op while the initial load has not settled yet', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => useWorkdays(api, fixedNow));

      await act(async () => {
        result.current.loadOlderMonth();
      });

      expect(calls).toHaveLength(1);
    });
  });

  it('does not report a failure caused by its own unmount', async () => {
    const { api, calls } = deferredApi();

    const { result, unmount } = await renderHook(() => useWorkdays(api, fixedNow));
    await act(async () => {
      unmount();
    });

    await settle(() => calls[0]?.reject(new Error('Aborted')));

    expect(result.current.status).toBe('loading');
  });
});
