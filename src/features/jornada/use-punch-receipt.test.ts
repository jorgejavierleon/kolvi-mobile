import { act, renderHook } from '@testing-library/react-native';

import type { NaiveDateTime } from '@/api';

import type { PunchReceipt, PunchReceiptApi } from './punch-receipt-api';
import { usePunchReceipt } from './use-punch-receipt';

const receipt: PunchReceipt = {
  markId: 501,
  type: 'in',
  datetime: '2026-08-05 08:03:11' as NaiveDateTime,
  hash: '9f2c1b0e5d4a3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443',
  geoStatus: 'inside',
  folio: '20260805-0042',
  employeeName: 'María Fernanda Soto',
  employeeRut: '214375818',
  capturedOffline: false,
};

function deferredApi() {
  const calls: {
    markId: number;
    resolve: (value: PunchReceipt) => void;
    reject: (e: unknown) => void;
  }[] = [];

  const api: PunchReceiptApi = {
    fetchPunchReceipt: (markId) =>
      new Promise<PunchReceipt>((resolve, reject) => {
        calls.push({ markId, resolve, reject });
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

describe('usePunchReceipt', () => {
  it('starts closed and asks nothing until opened', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => usePunchReceipt(api));

    expect(result.current.load).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('opens loading for the tapped mark, then settles into its receipt', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => usePunchReceipt(api));

    await act(async () => {
      result.current.open(501);
    });
    expect(result.current.load).toEqual({ status: 'loading' });
    expect(calls[0]?.markId).toBe(501);

    await settle(() => calls[0]?.resolve(receipt));
    expect(result.current.load).toEqual({ status: 'loaded', receipt });
  });

  it('reports a refusal as failed', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => usePunchReceipt(api));
    await act(async () => {
      result.current.open(501);
    });
    await settle(() => calls[0]?.reject(new Error('boom')));

    expect(result.current.load).toEqual({ status: 'failed' });
  });

  it('closes on dismiss', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => usePunchReceipt(api));
    await act(async () => {
      result.current.open(501);
    });
    await settle(() => calls[0]?.resolve(receipt));

    await act(async () => {
      result.current.dismiss();
    });

    expect(result.current.load).toBeNull();
  });

  it('opening a second punch replaces the first rather than merging with it', async () => {
    const { api, calls } = deferredApi();

    const { result } = await renderHook(() => usePunchReceipt(api));
    await act(async () => {
      result.current.open(501);
    });
    await act(async () => {
      result.current.open(502);
    });

    expect(calls).toHaveLength(2);
    expect(result.current.load).toEqual({ status: 'loading' });

    // The abandoned first request settling later must not clobber the second.
    await settle(() => calls[0]?.resolve(receipt));
    expect(result.current.load).toEqual({ status: 'loading' });

    await settle(() => calls[1]?.resolve({ ...receipt, markId: 502 }));
    expect(result.current.load).toEqual({
      status: 'loaded',
      receipt: { ...receipt, markId: 502 },
    });
  });

  describe('retry', () => {
    it('asks again for whichever mark is open', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => usePunchReceipt(api));
      await act(async () => {
        result.current.open(501);
      });
      await settle(() => calls[0]?.reject(new Error('boom')));

      await act(async () => {
        result.current.retry();
      });

      expect(calls).toHaveLength(2);
      expect(calls[1]?.markId).toBe(501);
    });

    it('is a no-op once dismissed', async () => {
      const { api, calls } = deferredApi();

      const { result } = await renderHook(() => usePunchReceipt(api));
      await act(async () => {
        result.current.open(501);
      });
      await act(async () => {
        result.current.dismiss();
      });

      await act(async () => {
        result.current.retry();
      });

      expect(calls).toHaveLength(1);
    });
  });
});
