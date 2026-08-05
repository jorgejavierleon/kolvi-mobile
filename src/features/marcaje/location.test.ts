import {
  createLocationSource,
  FIX_TIMEOUT_MS,
  type LocationModule,
  type SettingsOpener,
} from './location';

/** A permission response in the shape `expo-location` answers with. */
function permission(
  status: 'granted' | 'denied' | 'undetermined',
  canAskAgain = true,
): Awaited<ReturnType<LocationModule['getForegroundPermissionsAsync']>> {
  return {
    status,
    granted: status === 'granted',
    canAskAgain,
    expires: 'never',
  } as Awaited<ReturnType<LocationModule['getForegroundPermissionsAsync']>>;
}

function position(accuracy: number | null = 8) {
  return {
    coords: {
      latitude: -33.4569,
      longitude: -70.5975,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: 0,
  } as Awaited<ReturnType<LocationModule['getCurrentPositionAsync']>>;
}

function moduleWith(overrides: Partial<LocationModule> = {}): LocationModule {
  return {
    getForegroundPermissionsAsync: jest.fn(async () => permission('granted')),
    requestForegroundPermissionsAsync: jest.fn(async () => permission('granted')),
    hasServicesEnabledAsync: jest.fn(async () => true),
    getCurrentPositionAsync: jest.fn(async () => position()),
    ...overrides,
  };
}

const settings: SettingsOpener = { openSettings: jest.fn(async () => {}) };

describe('the permission it reports', () => {
  it.each([
    ['granted', permission('granted'), 'granted'],
    ['never asked', permission('undetermined'), 'undetermined'],
    ['refused once', permission('denied', true), 'denied'],
    ['refused for good', permission('denied', false), 'deniedForever'],
  ] as const)('reads %s', async (_case, response, expected) => {
    const source = createLocationSource(
      moduleWith({ getForegroundPermissionsAsync: async () => response }),
      settings,
    );

    expect(await source.getPermission()).toBe(expected);
  });

  // #8 turns on this distinction: `denied` still has the OS prompt behind it,
  // and `deniedForever` has only system settings.
  it('separates a refusal that can be asked again from one that cannot', async () => {
    const source = createLocationSource(
      moduleWith({ requestForegroundPermissionsAsync: async () => permission('denied', false) }),
      settings,
    );

    expect(await source.requestPermission()).toBe('deniedForever');
  });

  it('reads a permission stack that throws as undetermined rather than as a refusal', async () => {
    const source = createLocationSource(
      moduleWith({
        getForegroundPermissionsAsync: async () => {
          throw new Error('no permission service');
        },
      }),
      settings,
    );

    expect(await source.getPermission()).toBe('undetermined');
  });
});

describe('location services', () => {
  it('reports them off when the OS says so', async () => {
    const source = createLocationSource(
      moduleWith({ hasServicesEnabledAsync: async () => false }),
      settings,
    );

    expect(await source.hasServicesEnabled()).toBe(false);
  });

  // A query that merely failed must not become a "no signal" state over a GPS
  // that works — the fix attempt is about to answer the question properly.
  it('assumes they are on when the query itself fails', async () => {
    const source = createLocationSource(
      moduleWith({
        hasServicesEnabledAsync: async () => {
          throw new Error('unavailable');
        },
      }),
      settings,
    );

    expect(await source.hasServicesEnabled()).toBe(true);
  });
});

describe('the fix', () => {
  it('reports the coordinates and the accuracy the OS gave', async () => {
    const source = createLocationSource(moduleWith(), settings);

    expect(await source.getFix()).toEqual({
      latitude: -33.4569,
      longitude: -70.5975,
      accuracyMeters: 8,
    });
  });

  it('reports a missing accuracy as null rather than as zero metres', async () => {
    // Zero would read as a perfect fix and spend no slack in the employee's
    // favour, which is the opposite of what an unknown error bar means.
    const source = createLocationSource(
      moduleWith({ getCurrentPositionAsync: async () => position(null) }),
      settings,
    );

    expect((await source.getFix())?.accuracyMeters).toBeNull();
  });

  it('resolves to no fix when the phone refuses rather than throwing at the screen', async () => {
    const source = createLocationSource(
      moduleWith({
        getCurrentPositionAsync: async () => {
          throw new Error('Location provider is unavailable');
        },
      }),
      settings,
    );

    await expect(source.getFix()).resolves.toBeNull();
  });

  // #9. The failure this exists for is a phone that never answers at all: the
  // promise stays pending, and without the timeout the card acquires for the
  // whole shift.
  describe('when the phone never answers', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('gives up and reports no fix', async () => {
      const source = createLocationSource(
        moduleWith({ getCurrentPositionAsync: () => new Promise(() => {}) }),
        settings,
      );

      const fix = source.getFix();
      jest.advanceTimersByTime(FIX_TIMEOUT_MS);

      await expect(fix).resolves.toBeNull();
    });

    it('is still waiting one tick before the timeout', async () => {
      const source = createLocationSource(
        moduleWith({ getCurrentPositionAsync: () => new Promise(() => {}) }),
        settings,
      );

      const settled = jest.fn();
      void source.getFix().then(settled);

      jest.advanceTimersByTime(FIX_TIMEOUT_MS - 1);
      await Promise.resolve();

      expect(settled).not.toHaveBeenCalled();
    });

    it('takes the caller’s own timeout when it is given one', async () => {
      const source = createLocationSource(
        moduleWith({ getCurrentPositionAsync: () => new Promise(() => {}) }),
        settings,
      );

      const fix = source.getFix({ timeoutMs: 50 });
      jest.advanceTimersByTime(50);

      await expect(fix).resolves.toBeNull();
    });
  });
});

describe('the route to system settings (#8)', () => {
  it('opens them', async () => {
    const opener = { openSettings: jest.fn(async () => {}) };

    await createLocationSource(moduleWith(), opener).openSettings();

    expect(opener.openSettings).toHaveBeenCalledTimes(1);
  });

  it('leaves the employee where they were when the phone has none to open', async () => {
    const opener = {
      openSettings: jest.fn(async () => {
        throw new Error('no settings activity');
      }),
    };

    await expect(
      createLocationSource(moduleWith(), opener).openSettings(),
    ).resolves.toBeUndefined();
  });
});
