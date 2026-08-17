import { act, renderHook } from '@testing-library/react-native';

import type { ConnectivitySource } from '@/api';
import { useConnectivity } from './use-connectivity';

/**
 * A source the test drives. The first read is settled by hand rather than
 * resolved eagerly, so the state before the platform has answered is observable
 * — that window is the reason `online` starts optimistic.
 */
function fakeSource(initial = true) {
  const listeners: ((online: boolean) => void)[] = [];
  let removed = 0;
  let answerFirstRead: (() => void) | undefined;

  const source: ConnectivitySource = {
    getState: () =>
      new Promise<boolean>((resolve) => {
        answerFirstRead = () => resolve(initial);
      }),
    subscribe: (listener) => {
      listeners.push(listener);

      return () => {
        removed += 1;
      };
    },
  };

  return {
    source,
    /** Let the first read answer, and let the render it causes land. */
    answer: async () => {
      await act(async () => {
        answerFirstRead?.();
        await Promise.resolve();
      });
    },
    /** Report a change from the platform, and let the render it causes land. */
    emit: async (online: boolean) => {
      await act(async () => {
        for (const listener of listeners) {
          listener(online);
        }

        await Promise.resolve();
      });
    },
    subscriptions: () => listeners.length,
    removals: () => removed,
  };
}

describe('useConnectivity', () => {
  it('starts online, before the first read has answered', async () => {
    const { source } = fakeSource(false);

    const { result } = await renderHook(() => useConnectivity({ source }));

    // Optimistic on purpose: assuming offline for the milliseconds the first
    // read takes would flash a reason for a failure that has not happened.
    expect(result.current.online).toBe(true);
  });

  it('reports what the first read found', async () => {
    const { source, answer } = fakeSource(false);

    const { result } = await renderHook(() => useConnectivity({ source }));
    await answer();

    expect(result.current.online).toBe(false);
  });

  it('follows the platform as connectivity changes', async () => {
    const { source, answer, emit } = fakeSource(true);

    const { result } = await renderHook(() => useConnectivity({ source }));
    await answer();

    await emit(false);
    expect(result.current.online).toBe(false);

    await emit(true);
    expect(result.current.online).toBe(true);
  });

  describe('onRestored', () => {
    it('fires on the offline-to-online edge', async () => {
      const { source, answer, emit } = fakeSource(true);
      const onRestored = jest.fn();

      await renderHook(() => useConnectivity({ source, onRestored }));
      await answer();

      await emit(false);
      expect(onRestored).not.toHaveBeenCalled();

      await emit(true);
      expect(onRestored).toHaveBeenCalledTimes(1);
    });

    it('does not fire for a report that was already online', async () => {
      const { source, answer, emit } = fakeSource(true);
      const onRestored = jest.fn();

      await renderHook(() => useConnectivity({ source, onRestored }));
      await answer();

      // A Wi-Fi handover, or the same state reported twice. KMO-23 hangs the
      // automatic flush off this callback, and a flush per report would run on
      // every one of them with an empty queue.
      await emit(true);
      await emit(true);

      expect(onRestored).not.toHaveBeenCalled();
    });

    it('does not fire on mount, however the first read comes back', async () => {
      const { source, answer } = fakeSource(true);
      const onRestored = jest.fn();

      await renderHook(() => useConnectivity({ source, onRestored }));
      await answer();

      expect(onRestored).not.toHaveBeenCalled();
    });

    it('fires once for a run of reports, not once per report', async () => {
      const { source, answer, emit } = fakeSource(true);
      const onRestored = jest.fn();

      await renderHook(() => useConnectivity({ source, onRestored }));
      await answer();

      // Each report is compared against what the *previous report* left, not
      // against what the last render saw — otherwise the trailing `true`s would
      // each be measured against a stale `false` and fire again.
      await emit(false);
      await emit(true);
      await emit(true);

      expect(onRestored).toHaveBeenCalledTimes(1);
    });

    it('keeps the latest callback without resubscribing', async () => {
      const { source, answer, emit, subscriptions } = fakeSource(true);
      const first = jest.fn();
      const second = jest.fn();

      const { rerender } = await renderHook(
        ({ onRestored }: { onRestored: () => void }) => useConnectivity({ source, onRestored }),
        { initialProps: { onRestored: first } },
      );
      await answer();

      await act(async () => {
        rerender({ onRestored: second });
      });

      await emit(false);
      await emit(true);

      // One subscription across the re-render: every caller passes a fresh
      // arrow, and tearing the platform listener down for that would drop the
      // edge the flush depends on.
      expect(subscriptions()).toBe(1);
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  it('unsubscribes when the screen goes away', async () => {
    const { source, answer, removals } = fakeSource(true);

    const { unmount } = await renderHook(() => useConnectivity({ source }));
    await answer();

    await act(async () => {
      unmount();
    });

    expect(removals()).toBe(1);
  });

  it('ignores a report that arrives after unmount', async () => {
    const { source, answer, emit, removals } = fakeSource(true);
    const onRestored = jest.fn();

    const { unmount } = await renderHook(() => useConnectivity({ source, onRestored }));
    await answer();

    await act(async () => {
      unmount();
    });

    await emit(false);
    await emit(true);

    expect(removals()).toBe(1);
    expect(onRestored).not.toHaveBeenCalled();
  });
});
