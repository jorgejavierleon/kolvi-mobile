import { act, renderHook } from '@testing-library/react-native';

import type { NaiveDateTime } from '@/api';

import type { MarksApi } from './marks-api';
import type { PunchReceipt } from './punch-api';
import { useMarks } from './use-marks';

function receipt(overrides: Partial<PunchReceipt> = {}): PunchReceipt {
  return {
    markId: 1841,
    type: 'in',
    datetime: '2026-08-05 08:03:11' as NaiveDateTime,
    hash: '9f2c1b0e5d4a3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443',
    geoStatus: 'inside',
    folio: '20260805-0042',
    employeeName: 'María Fernanda Soto',
    employeeRut: '214375818',
    ...overrides,
  };
}

/**
 * An API whose calls are settled by the test, one at a time — the same shape
 * `use-today.test.ts` uses, for the same reason: most of what this hook does
 * happens while a request is in flight.
 */
function deferredApi() {
  const calls: {
    resolve: (value: readonly PunchReceipt[]) => void;
    reject: (error: unknown) => void;
  }[] = [];

  const api: MarksApi = {
    fetchMarks: () =>
      new Promise<readonly PunchReceipt[]>((resolve, reject) => {
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

describe('useMarks', () => {
  it('asks for nothing until the list is opened', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => useMarks({ enabled: false, api }));

    // The home screen's one-request budget: an unopened list costs the punch
    // screen nothing.
    expect(calls).toHaveLength(0);
    expect(result.current.status).toBe('loading');
  });

  it('asks once when the list opens', async () => {
    const { api, calls } = deferredApi();

    const { rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useMarks({ enabled, api }),
      { initialProps: { enabled: false } },
    );

    await rerender({ enabled: true });

    expect(calls).toHaveLength(1);
  });

  it('makes exactly one request across re-renders', async () => {
    const { api, calls } = deferredApi();

    const { rerender } = await renderHook(() => useMarks({ enabled: true, api }));

    await rerender({});
    await rerender({});

    expect(calls).toHaveLength(1);
  });

  it('hands back the marks the register answered with', async () => {
    const { api, calls } = deferredApi();
    const marks = [receipt(), receipt({ markId: 1840, type: 'out' })];

    const { result } = await renderHook(() => useMarks({ enabled: true, api }));

    await settle(() => calls[0]?.resolve(marks));

    expect(result.current).toMatchObject({ status: 'loaded', marks, retrying: false });
  });

  it('reads an employee with no punches as a loaded empty list (#4)', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => useMarks({ enabled: true, api }));

    await settle(() => calls[0]?.resolve([]));

    // Loaded and empty, not failed: nothing went wrong, and the sheet has a
    // Spanish empty state to draw rather than a retry to offer.
    expect(result.current).toMatchObject({ status: 'loaded', marks: [] });
  });

  it('reports a refusal as failed, with the error it was given', async () => {
    const { api, calls } = deferredApi();
    const error = new Error('nope');

    const { result } = await renderHook(() => useMarks({ enabled: true, api }));

    await settle(() => calls[0]?.reject(error));

    expect(result.current).toMatchObject({ status: 'failed', error, retrying: false });
  });

  it('keeps the rows on screen while a retry is in flight', async () => {
    const { api, calls } = deferredApi();
    const marks = [receipt()];

    const { result } = await renderHook(() => useMarks({ enabled: true, api }));

    await settle(() => calls[0]?.resolve(marks));
    await act(async () => result.current.reload());

    expect(result.current).toMatchObject({ status: 'loaded', marks, retrying: true });
  });

  it('ignores a reload while a request is already in flight', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => useMarks({ enabled: true, api }));

    await act(async () => {
      result.current.reload();
      result.current.reload();
    });

    expect(calls).toHaveLength(1);
  });

  it('asks again each time the list is opened', async () => {
    const { api, calls } = deferredApi();

    const { rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useMarks({ enabled, api }),
      { initialProps: { enabled: true } },
    );

    await settle(() => calls[0]?.resolve([receipt()]));

    await rerender({ enabled: false });
    await rerender({ enabled: true });

    // The register changes while the sheet is shut — usually because this app
    // recorded a punch — and a history missing the mark the employee made a
    // minute ago is the one wrong answer this list can give.
    expect(calls).toHaveLength(2);
  });

  it('keeps the rows on screen while that refetch runs', async () => {
    const { api, calls } = deferredApi();
    const marks = [receipt()];

    const { result, rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useMarks({ enabled, api }),
      { initialProps: { enabled: true } },
    );

    await settle(() => calls[0]?.resolve(marks));

    await rerender({ enabled: false });
    await rerender({ enabled: true });

    // Being current costs a moment's staleness, never a blank sheet in front of
    // rows the employee was reading a second ago.
    expect(result.current).toMatchObject({ status: 'loaded', marks, retrying: true });
  });

  it('does not ask again merely because the screen re-rendered while open', async () => {
    const { api, calls } = deferredApi();

    const { rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useMarks({ enabled, api }),
      { initialProps: { enabled: true } },
    );

    await settle(() => calls[0]?.resolve([receipt()]));

    await rerender({ enabled: true });
    await rerender({ enabled: true });

    // It is the *transition* into open that asks. This is also what keeps a
    // comprobante opened from a row — which hides the list without closing it —
    // from re-requesting the register on the way back.
    expect(calls).toHaveLength(1);
  });

  it('does not report a load that was abandoned when the screen went', async () => {
    const { api, calls } = deferredApi();

    const { result, unmount } = await renderHook(() => useMarks({ enabled: true, api }));

    await act(async () => {
      unmount();
    });
    await settle(() => calls[0]?.reject(new Error('aborted')));

    expect(result.current.status).toBe('loading');
  });
});
