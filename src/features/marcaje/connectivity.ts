/**
 * Whether the phone thinks it can reach anything — the only module that imports
 * `expo-network` (KMO-22).
 *
 * **This flag is optimism, not authority.** What it reports is what the OS
 * believes about the radio; what decides whether a punch is queued is a request
 * that actually failed (`ApiError.isConnectivityFailure`). The two are not the
 * same claim, and confusing them breaks the position docs/design-decisions.md
 * §4.6 takes: Res. 38 Art. 10 confines the offline exception to *situaciones
 * excepcionales*, so the queue engages on a real failure to reach the server and
 * never on a phone's opinion of its own signal. A captive portal reports a
 * perfectly connected network; a warehouse basement reports one for the seconds
 * before the request times out.
 *
 * So this is used for exactly two things — explaining a failure the employee can
 * see, and knowing when to try a flush again (KMO-23 #4) — and for nothing that
 * decides what goes in the register.
 */

import * as Network from 'expo-network';

/**
 * The slice of the platform this app uses. Two calls: what is true now, and tell
 * me when that changes. Injected in tests, like `LocationModule`.
 */
export type NetworkModule = {
  getNetworkStateAsync(): Promise<Network.NetworkState>;
  addNetworkStateListener(listener: (event: Network.NetworkStateEvent) => void): {
    remove(): void;
  };
};

export type ConnectivitySource = {
  /** What the OS says right now. */
  getState(): Promise<boolean>;
  /** Calls back on every change. Returns the unsubscribe. */
  subscribe(listener: (online: boolean) => void): () => void;
};

export function createConnectivitySource(module: NetworkModule = Network): ConnectivitySource {
  return {
    getState: async () => {
      try {
        return isOnline(await module.getNetworkStateAsync());
      } catch {
        // A network stack that will not answer a question about itself is not
        // evidence of anything. Online is the assumption that costs least: the
        // app tries the request, and the request is the thing that knows.
        return true;
      }
    },

    subscribe: (listener) => {
      try {
        const subscription = module.addNetworkStateListener((event) => {
          listener(isOnline(event));
        });

        return () => {
          try {
            subscription.remove();
          } catch {
            // Unsubscribing is housekeeping. A platform that will not do it
            // must not take a screen down on its way off — the listener above
            // is guarded by the hook's own liveness flag either way.
          }
        };
      } catch {
        // Nothing to unsubscribe, and nothing lost: without the edge the queue
        // drains on the next punch or on `Sincronizar` instead of the moment
        // signal returns. Slower, never wrong.
        return () => {};
      }
    },
  };
}

/**
 * Reachability first, connection second, optimism last.
 *
 * `isInternetReachable` is the stronger claim and the one worth having: Android
 * only reports it true for a network the system has actually validated
 * (`NET_CAPABILITY_VALIDATED`), which is what tells a joined-but-useless Wi-Fi
 * from a working one. iOS aliases it to `isConnected`, so the fallback is not a
 * degradation there — it is the same value under another name.
 *
 * Both undefined reads as **online**, deliberately. The failure this module must
 * not produce is a false offline: that is the reading that would put a punch in
 * the queue instead of the attendance book, and Art. 10 does not permit the
 * exception to be invoked on a guess.
 */
function isOnline(state: Network.NetworkState | Network.NetworkStateEvent): boolean {
  return state.isInternetReachable ?? state.isConnected ?? true;
}
