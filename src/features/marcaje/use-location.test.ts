import { act, renderHook } from '@testing-library/react-native';
import { useFocusEffect } from 'expo-router';

import type { LocationFix } from './geofence';
import type { LocationPermission, LocationSource } from './location';
import type { Geofence } from './today-api';
import { useLocation } from './use-location';

/**
 * Focus is the whole point of #10, so it is mocked rather than assumed: the
 * effect runs when the screen is focused and its cleanup runs when the screen
 * leaves. `useEffect` is that contract with mount standing in for focus, which
 * lets a test retire a screen mid-acquisition the way leaving the tab does.
 *
 * The assertion that the hook uses *this* hook and not a plain `useEffect` is
 * below — without it, a location read that ran while the employee was on
 * Documentos would pass every other test in this file.
 */
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: jest.fn((effect: () => void | (() => void)) => useEffect(effect, [effect])),
  };
});

const premise: Geofence = { latitude: -33.4569, longitude: -70.5975, radiusMeters: 150 };

const inside: LocationFix = { latitude: -33.4569, longitude: -70.5975, accuracyMeters: 5 };
const faraway: LocationFix = { latitude: -33.4372, longitude: -70.6506, accuracyMeters: 5 };

type SourceOverrides = Partial<LocationSource>;

function sourceWith(overrides: SourceOverrides = {}): LocationSource {
  return {
    getPermission: jest.fn(async (): Promise<LocationPermission> => 'granted'),
    requestPermission: jest.fn(async (): Promise<LocationPermission> => 'granted'),
    hasServicesEnabled: jest.fn(async () => true),
    getFix: jest.fn(async (): Promise<LocationFix | null> => inside),
    openSettings: jest.fn(async () => {}),
    ...overrides,
  };
}

/**
 * Run `action` and let every promise it started settle inside one act scope.
 *
 * The chain this hook runs is three awaits deep on its longest path — permission,
 * then services, then the fix — so a single microtask flush would leave it
 * halfway and assert on a state it was passing through.
 */
async function settle(action: () => void | Promise<void>) {
  await act(async () => {
    await action();

    for (let tick = 0; tick < 5; tick += 1) {
      await Promise.resolve();
    }
  });
}

/** Render and let the acquisition the first focus started run to its end. */
async function render(source: LocationSource, geofence: Geofence | null = premise) {
  const rendered = await renderHook(() => useLocation({ geofence, source }));

  await settle(() => {});

  return rendered;
}

describe('the state it reports', () => {
  // #2
  it('confirms a fix inside the premise, with how far in it is', async () => {
    const { result } = await render(sourceWith());

    expect(result.current.state).toEqual({ kind: 'confirmed', distanceMeters: expect.any(Number) });
    expect(result.current.geoStatus).toBe('inside');
    expect(result.current.punchAllowed).toBe(true);
  });

  // #3
  it('reports a fix beyond the radius as out of range', async () => {
    const { result } = await render(sourceWith({ getFix: async () => faraway }));

    expect(result.current.state.kind).toBe('outside');
    expect(result.current.geoStatus).toBe('outside');
  });

  // #4, both of its causes.
  it('reports no signal when the phone cannot produce a fix', async () => {
    const { result } = await render(sourceWith({ getFix: async () => null }));

    expect(result.current.state).toEqual({ kind: 'noSignal' });
    expect(result.current.geoStatus).toBe('unknown');
    expect(result.current.fix).toBeNull();
  });

  it('reports no signal when location services are off, without asking for a fix', async () => {
    const getFix = jest.fn(async () => inside);

    const { result } = await render(sourceWith({ hasServicesEnabled: async () => false, getFix }));

    expect(result.current.state).toEqual({ kind: 'noSignal' });
    expect(getFix).not.toHaveBeenCalled();
  });

  it('starts out acquiring rather than claiming a state it has not reached', async () => {
    // A phone that has not answered yet, held there so the assertion is about
    // the first state and not about how fast the mock settled. The source is
    // built once outside the render callback: a fresh one per render would
    // restart acquisition on every state change, the hazard `useToday` documents.
    const source = sourceWith({ getPermission: () => new Promise(() => {}) });

    const { result } = await renderHook(() => useLocation({ geofence: premise, source }));

    expect(result.current.state).toEqual({ kind: 'acquiring' });
  });

  // #6. Every premise reads this way until `ams` KOL-33 ships the geofence.
  it('confirms with no distance when the premise has no geofence', async () => {
    const { result } = await render(sourceWith({ getFix: async () => faraway }), null);

    expect(result.current.state).toEqual({ kind: 'confirmed', distanceMeters: null });
    expect(result.current.punchAllowed).toBe(true);
  });
});

describe('the permission', () => {
  // #1. The rationale is raised instead of the prompt, and the prompt is not
  // raised behind it.
  it('offers the rationale before the OS prompt, and does not prompt on its own', async () => {
    const requestPermission = jest.fn(async (): Promise<LocationPermission> => 'granted');

    const { result } = await render(
      sourceWith({ getPermission: async () => 'undetermined', requestPermission }),
    );

    expect(result.current.rationaleVisible).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('raises the OS prompt only once the rationale is accepted, and then acquires', async () => {
    const requestPermission = jest.fn(async (): Promise<LocationPermission> => 'granted');

    const { result } = await render(
      sourceWith({ getPermission: async () => 'undetermined', requestPermission }),
    );

    await settle(() => result.current.acceptRationale());

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(result.current.rationaleVisible).toBe(false);
    expect(result.current.state.kind).toBe('confirmed');
  });

  it('closes the sheet onto a card with a way back when the rationale is dismissed', async () => {
    const { result } = await render(sourceWith({ getPermission: async () => 'undetermined' }));

    await settle(() => result.current.dismissRationale());

    expect(result.current.rationaleVisible).toBe(false);
    expect(result.current.state).toEqual({ kind: 'denied', canAskAgain: true });
  });

  // #7. The whole reason `denied` is a state of its own rather than another way
  // of saying "no signal": there is no later moment at which this employee gets
  // a fix, and attendance that cannot be recorded is a legal problem.
  it('still allows a punch when the permission is refused for good, reporting no fix', async () => {
    const { result } = await render(sourceWith({ getPermission: async () => 'deniedForever' }));

    expect(result.current.state).toEqual({ kind: 'denied', canAskAgain: false });
    expect(result.current.punchAllowed).toBe(true);
    expect(result.current.geoStatus).toBe('unknown');
    expect(result.current.fix).toBeNull();
  });

  // #8's precondition: which of the two routes back the card offers.
  it('separates a refusal it can ask about again from one only settings can undo', async () => {
    const { result } = await render(sourceWith({ getPermission: async () => 'denied' }));

    expect(result.current.state).toEqual({ kind: 'denied', canAskAgain: true });
  });

  it('reports a refused prompt as denied rather than leaving the card acquiring', async () => {
    const { result } = await render(
      sourceWith({
        getPermission: async () => 'undetermined',
        requestPermission: async () => 'deniedForever',
      }),
    );

    await settle(() => result.current.acceptRationale());

    expect(result.current.state).toEqual({ kind: 'denied', canAskAgain: false });
  });
});

describe('retrying', () => {
  // KMO-18 #4/#5 lean on this: a retry that succeeds reaches the confirmed state
  // without the screen being rebuilt.
  it('asks the phone again and updates the card', async () => {
    let fix: LocationFix | null = null;
    const getFix = jest.fn(async () => fix);

    const { result } = await render(sourceWith({ getFix }));
    expect(result.current.state.kind).toBe('noSignal');

    fix = inside;

    await settle(() => result.current.retry());

    expect(getFix).toHaveBeenCalledTimes(2);
    expect(result.current.state.kind).toBe('confirmed');
  });
});

describe('staying out of the background (#10)', () => {
  it('reads the phone from a focus effect, not from a plain mount effect', async () => {
    await render(sourceWith());

    expect(useFocusEffect).toHaveBeenCalled();
  });

  it('does not ask the phone anything again while it sits on screen', async () => {
    const getFix = jest.fn(async () => inside);

    const { rerender } = await render(sourceWith({ getFix }));

    await rerender({});
    await rerender({});

    expect(getFix).toHaveBeenCalledTimes(1);
  });

  // A fix takes up to twelve seconds and an employee can leave the tab in one.
  // The promise cannot be cancelled, so what the cleanup cancels is its right to
  // report — a screen that has been left does not get its state written.
  it('drops a fix that arrives after the screen is gone', async () => {
    let deliver: (fix: LocationFix) => void = () => {};
    const getFix = jest.fn(
      () =>
        new Promise<LocationFix | null>((resolve) => {
          deliver = resolve;
        }),
    );

    // The state is read out of the render callback rather than out of `result`,
    // which the library nulls the moment the screen goes — and the point here is
    // what happens after that.
    const source = sourceWith({ getFix });
    const states: string[] = [];

    const { unmount } = await renderHook(() => {
      const reading = useLocation({ geofence: premise, source });
      states.push(reading.state.kind);

      return reading;
    });

    await settle(() => {});

    expect(states.at(-1)).toBe('acquiring');
    const before = states.length;

    await settle(() => unmount());
    await settle(() => deliver(inside));

    expect(states).toHaveLength(before);
  });
});
