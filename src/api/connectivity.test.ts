import { createConnectivitySource, type NetworkModule } from './connectivity';

function moduleWith(overrides: Partial<NetworkModule> = {}): NetworkModule {
  return {
    getNetworkStateAsync: jest.fn().mockResolvedValue({ isConnected: true }),
    addNetworkStateListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    ...overrides,
  };
}

describe('createConnectivitySource', () => {
  describe('getState', () => {
    it('prefers isInternetReachable over isConnected', async () => {
      // A joined Wi-Fi the system could not validate. `isConnected` says yes and
      // is wrong about the only thing the app cares about.
      const source = createConnectivitySource(
        moduleWith({
          getNetworkStateAsync: jest
            .fn()
            .mockResolvedValue({ isConnected: true, isInternetReachable: false }),
        }),
      );

      await expect(source.getState()).resolves.toBe(false);
    });

    it('falls back to isConnected when reachability is not reported', async () => {
      const source = createConnectivitySource(
        moduleWith({
          getNetworkStateAsync: jest.fn().mockResolvedValue({ isConnected: false }),
        }),
      );

      await expect(source.getState()).resolves.toBe(false);
    });

    it('reads an empty state as online rather than guessing offline', async () => {
      // The reading this module must never invent. A false offline is what would
      // queue a punch that the server was reachable for.
      const source = createConnectivitySource(
        moduleWith({ getNetworkStateAsync: jest.fn().mockResolvedValue({}) }),
      );

      await expect(source.getState()).resolves.toBe(true);
    });

    it('reads a network stack that throws as online', async () => {
      const source = createConnectivitySource(
        moduleWith({
          getNetworkStateAsync: jest.fn().mockRejectedValue(new Error('no such module')),
        }),
      );

      await expect(source.getState()).resolves.toBe(true);
    });
  });

  describe('subscribe', () => {
    it('reports each change as a boolean', () => {
      let emit: ((event: { isInternetReachable?: boolean }) => void) | undefined;
      const source = createConnectivitySource(
        moduleWith({
          addNetworkStateListener: jest.fn((listener) => {
            emit = listener;

            return { remove: jest.fn() };
          }),
        }),
      );

      const seen: boolean[] = [];
      source.subscribe((online) => seen.push(online));

      emit?.({ isInternetReachable: false });
      emit?.({ isInternetReachable: true });

      expect(seen).toEqual([false, true]);
    });

    it('removes the platform subscription when unsubscribed', () => {
      const remove = jest.fn();
      const source = createConnectivitySource(
        moduleWith({ addNetworkStateListener: jest.fn().mockReturnValue({ remove }) }),
      );

      source.subscribe(() => {})();

      expect(remove).toHaveBeenCalledTimes(1);
    });

    it('survives a platform that cannot subscribe at all', () => {
      const source = createConnectivitySource(
        moduleWith({
          addNetworkStateListener: jest.fn(() => {
            throw new Error('unsupported');
          }),
        }),
      );

      expect(() => source.subscribe(() => {})()).not.toThrow();
    });
  });
});
