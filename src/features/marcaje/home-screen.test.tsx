import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ApiError, type NaiveDate, type NaiveDateTime, type NaiveTime } from '@/api';
import { es } from '@/i18n';
import { tones } from '@/theme';

import type { AuthApi } from '../auth/auth-api';
import { employeePermissions, parsePermissions, type Permission } from '../auth/permissions';
import { SessionProvider } from '../auth/session';
import type { SessionUser } from '../auth/session-user';
import { createMemoryTokenStore } from '../auth/token-store';
import type { ConnectivitySource } from './connectivity';
import { HomeScreen } from './home-screen';
import { CLOCK_TICK_MS } from './now-clock';
import type { LocationFix } from './geofence';
import type { LocationPermission, LocationSource } from './location';
import type { MarksApi } from './marks-api';
import { DuplicateMarkError, type PunchApi, type PunchReceipt } from './punch-api';
import { createPunchQueue, type PunchQueue, type PunchSync } from './punch-queue';
import type { TodayApi, TodaySummary } from './today-api';

/**
 * The screen reads the phone's location from a focus effect (KMO-16 #10), and a
 * hook test cannot supply a navigator. Mount stands in for focus here; the
 * criterion's own coverage is in `use-location.test.ts`.
 */
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');

  return { useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]) };
});

const summary: TodaySummary = {
  date: '2026-08-04' as NaiveDate,
  shift: {
    premise: 'Sucursal Ñuñoa',
    startTime: '08:00:00' as NaiveTime,
    endTime: '17:00:00' as NaiveTime,
    lunch: { startTime: '13:00:00' as NaiveTime, endTime: '14:00:00' as NaiveTime },
    geofence: { latitude: -33.4569, longitude: -70.5975, radiusMeters: 150 },
  },
  punchState: 'before',
  week: { workedHours: 32.5, contractedHours: 44 },
};

const fix: LocationFix = { latitude: -33.4569, longitude: -70.5975, accuracyMeters: 5 };

/** Estación Central, about two kilometres outside the seeded premise (KMO-18). */
const farawayFix: LocationFix = { latitude: -33.4372, longitude: -70.6506, accuracyMeters: 5 };

/**
 * A phone whose radio the test drives (KMO-22 #1).
 *
 * Injected everywhere, like the location source: without it the real
 * `expo-network` is reached for, and the screen's answer to `Sincronizar` would
 * depend on the host running the suite.
 */
function fakeConnectivity(online = true): ConnectivitySource & { report(next: boolean): void } {
  const listeners: ((next: boolean) => void)[] = [];

  return {
    getState: async () => online,
    subscribe: (listener) => {
      listeners.push(listener);

      return () => {};
    },
    report: (next) => {
      for (const listener of listeners) {
        listener(next);
      }
    },
  };
}

/** A phone that has the permission and knows where it is. */
function fakeLocation(overrides: Partial<LocationSource> = {}): LocationSource {
  return {
    getPermission: async (): Promise<LocationPermission> => 'granted',
    requestPermission: async (): Promise<LocationPermission> => 'granted',
    hasServicesEnabled: async () => true,
    getFix: async (): Promise<LocationFix | null> => fix,
    openSettings: async () => {},
    ...overrides,
  };
}

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 5,
    name: 'Camila Rojas',
    firstName: 'Camila',
    email: 'c.rojas@example.com',
    rut: '12345678-9',
    position: null,
    premise: null,
    permissions: parsePermissions(employeePermissions),
    ...overrides,
  };
}

/** A session provider already holding a signed-in employee. */
function sessionWrapper(sessionUser: SessionUser) {
  const authApi: AuthApi = {
    issueToken: async () => 'tok_test',
    fetchSessionUser: async () => sessionUser,
    revokeToken: async () => true,
  };

  const store = createMemoryTokenStore();
  void store.write('tok_test');

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={metrics}>
        <SessionProvider authApi={authApi} tokenStore={store} deviceName={async () => 'Kolvi test'}>
          {children}
        </SessionProvider>
      </SafeAreaProvider>
    );
  };
}

/** The rationale sheet is pinned to the safe area, so the tree needs one. */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

type MountOptions = {
  api?: TodayApi;
  punchApi?: PunchApi;
  marksApi?: MarksApi;
  permissions?: readonly Permission[];
  firstName?: string | null;
  at?: string;
  location?: LocationSource;
  queue?: PunchQueue;
  connectivity?: ConnectivitySource;
  punchSync?: PunchSync;
};

/** A stored mark, as `GET /marks` answers with one (KMO-20). */
function storedMark(overrides: Partial<PunchReceipt> = {}): PunchReceipt {
  return {
    markId: 1502,
    type: 'in',
    datetime: '2026-07-31 08:01:44' as NaiveDateTime,
    hash: 'c3d4e5f60718',
    geoStatus: 'inside',
    folio: '20260731-0003',
    employeeName: 'Camila Rojas',
    employeeRut: '123456789',
    capturedOffline: false,
    ...overrides,
  };
}

/** A register holding whatever the case needs, counting how often it is asked. */
function fakeMarksApi(marks: readonly PunchReceipt[]): MarksApi & { calls: number } {
  const api = {
    calls: 0,
    fetchMarks: async () => {
      api.calls += 1;

      return marks;
    },
  };

  return api;
}

/** A server that records whatever it is handed (KMO-17). */
function fakePunchApi(overrides: Partial<PunchReceipt> = {}): PunchApi & { calls: unknown[] } {
  const calls: unknown[] = [];

  return {
    calls,
    punch: async (request) => {
      calls.push(request);

      return {
        markId: 1841,
        type: request.type,
        datetime: '2026-08-04 14:07:22' as NaiveDateTime,
        hash: '9f2c1b0e5d4a',
        geoStatus: 'inside',
        folio: '20260804-0007',
        employeeName: 'María Fernanda Soto',
        employeeRut: '214375818',
        capturedOffline: false,
        ...overrides,
      };
    },
  };
}

async function mount(options: MountOptions = {}) {
  const api: TodayApi = options.api ?? { fetchToday: async () => summary };
  const sessionUser = user({
    permissions: parsePermissions(options.permissions ?? employeePermissions),
    ...(options.firstName === undefined ? {} : { firstName: options.firstName }),
  });

  const clock = () => new Date(options.at ?? '2026-08-04T14:07:22');

  const rendered = await render(
    <HomeScreen
      onOpenProfile={() => {}}
      api={api}
      punchApi={options.punchApi ?? fakePunchApi()}
      marksApi={options.marksApi ?? fakeMarksApi([storedMark()])}
      clock={clock}
      locationSource={options.location ?? fakeLocation()}
      queue={options.queue ?? createPunchQueue()}
      connectivitySource={options.connectivity ?? fakeConnectivity()}
      punchSync={options.punchSync}
    />,
    { wrapper: sessionWrapper(sessionUser) },
  );

  return rendered;
}

/** Mounted and past the first request, which is where most of these start. */
async function mountLoaded(options: MountOptions = {}) {
  const rendered = await mount(options);
  await waitFor(() => expect(screen.getByTestId('shift-card')).toBeOnTheScreen());

  return rendered;
}

describe('the header (#1)', () => {
  it('shows the long date with the weekday capitalised, over the greeting', async () => {
    await mountLoaded({ at: '2026-08-05T09:00:00' });

    expect(screen.getByText('Miércoles 5 de agosto')).toBeOnTheScreen();
    expect(screen.getByText('Hola, Camila')).toBeOnTheScreen();
  });

  it('paints before the request lands, so the app opens with the employee’s own name', async () => {
    // The date is the phone's and the name is the session's; neither waits on
    // `/me/today`. An employee opening the app at a gate sees themselves rather
    // than a screenful of grey blocks.
    await mount({ api: { fetchToday: () => new Promise<TodaySummary>(() => {}) } });

    expect(screen.getByText('Hola, Camila')).toBeOnTheScreen();
    expect(screen.getByTestId('home-skeleton')).toBeOnTheScreen();
  });

  it('falls back to the full name when ams has no first name for them', async () => {
    // `first_name` is nullable in `ams`, and `Hola, ` with nothing after the
    // comma is worse than a formal greeting.
    await mountLoaded({ firstName: null });

    expect(screen.getByText('Hola, Camila Rojas')).toBeOnTheScreen();
  });

  it('opens the profile from the avatar', async () => {
    const opened = jest.fn();
    await render(
      <HomeScreen
        onOpenProfile={opened}
        api={{ fetchToday: async () => summary }}
        clock={() => new Date('2026-08-04T14:07:22')}
      />,
      { wrapper: sessionWrapper(user()) },
    );

    await userEvent.press(screen.getByTestId('profile-button'));

    expect(opened).toHaveBeenCalled();
  });
});

describe('the shift card (#2)', () => {
  it('renders from the loaded summary', async () => {
    await mountLoaded();

    expect(screen.getByText('Turno de hoy')).toBeOnTheScreen();
    expect(screen.getByText('Sucursal Ñuñoa')).toBeOnTheScreen();
    expect(screen.getByText('08:00 – 17:00')).toBeOnTheScreen();
    expect(screen.getByText('Colación (informativo)')).toBeOnTheScreen();
    expect(screen.getByText('13:00 – 14:00')).toBeOnTheScreen();
  });

  it('says so explicitly when no shift is scheduled (#7)', async () => {
    await mount({ api: { fetchToday: async () => ({ ...summary, shift: null }) } });

    await waitFor(() => {
      expect(screen.getByText('Hoy no tienes turno programado')).toBeOnTheScreen();
    });
    expect(screen.queryByText('00:00 – 00:00')).not.toBeOnTheScreen();
  });
});

describe('the clock and the status line (#3, #4)', () => {
  it('renders the current time as hh:mm', async () => {
    await mountLoaded({ at: '2026-08-04T14:07:22' });

    expect(screen.getByTestId('clock-time')).toHaveTextContent('14:07');
  });

  it('reads the status line for the punch state the server reported', async () => {
    await mount({
      api: { fetchToday: async () => ({ ...summary, punchState: 'working' }) },
    });

    await waitFor(() => expect(screen.getByTestId('clock-status')).toHaveTextContent('En jornada'));
  });

  it('shows no status line when the response carried no punch state', async () => {
    await mount({ api: { fetchToday: async () => ({ ...summary, punchState: null }) } });

    await waitFor(() => expect(screen.getByTestId('clock-time')).toBeOnTheScreen());
    expect(screen.queryByTestId('clock-status')).not.toBeOnTheScreen();
  });
});

describe('the week summary (#5)', () => {
  it('reads {worked} / {total} hrs esta semana against the contracted total', async () => {
    await mountLoaded();

    expect(screen.getByTestId('week-summary')).toHaveTextContent('32,5 / 44 hrs esta semana');
  });

  it('writes the decimal with a comma, as es-CL does', async () => {
    await mountLoaded();

    expect(screen.queryByText('32.5 / 44 hrs esta semana')).not.toBeOnTheScreen();
  });

  it('is absent when the server sent no week, rather than reading 0 / 0', async () => {
    await mount({ api: { fetchToday: async () => ({ ...summary, week: null }) } });

    await waitFor(() => expect(screen.getByTestId('shift-card')).toBeOnTheScreen());
    expect(screen.queryByTestId('week-summary')).not.toBeOnTheScreen();
  });
});

describe('the request (#6)', () => {
  it('draws the whole screen from one GET /me/today', async () => {
    const fetchToday = jest.fn(async () => summary);

    await mountLoaded({ api: { fetchToday } });

    // Every element the criteria name is on screen, and one call paid for all
    // of them.
    expect(screen.getByText('Sucursal Ñuñoa')).toBeOnTheScreen();
    expect(screen.getByTestId('clock-status')).toBeOnTheScreen();
    expect(screen.getByTestId('week-summary')).toBeOnTheScreen();
    expect(fetchToday).toHaveBeenCalledTimes(1);
  });

  it('does not ask again when the clock ticks', async () => {
    // The clock owns its own state precisely so a tick costs nothing else. A
    // tick that re-ran the screen's effect would be one request every thirty
    // seconds for as long as the tab is open.
    jest.useFakeTimers();
    try {
      const fetchToday = jest.fn(async () => summary);
      await mountLoaded({ api: { fetchToday } });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(CLOCK_TICK_MS * 3);
      });

      expect(fetchToday).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('the ClockOwn:Mark gate (#8)', () => {
  it('shows the punch surface to an employee who may punch', async () => {
    await mountLoaded({ permissions: ['ClockOwn:Mark', 'ViewOwn:Workday'] });

    expect(screen.getByTestId('clock-status')).toHaveTextContent('Aún no marcas entrada');
  });

  it('hides it from a user without the permission', async () => {
    await mountLoaded({ permissions: ['ViewOwn:Workday', 'ViewOwn:Document'] });

    expect(screen.queryByTestId('clock-status')).not.toBeOnTheScreen();
    expect(screen.queryByText('Aún no marcas entrada')).not.toBeOnTheScreen();
    // The button is the other half of that surface, and the more important half:
    // an admin who does not punch must not be offered a punch (KMO-17 #2).
    expect(screen.queryByTestId('punch-button')).not.toBeOnTheScreen();
  });

  it('still gives that user a working tab rather than a screenful of nothing', async () => {
    await mountLoaded({ permissions: ['ViewOwn:Workday'] });

    expect(screen.getByText('Hola, Camila')).toBeOnTheScreen();
    expect(screen.getByText('Turno de hoy')).toBeOnTheScreen();
    expect(screen.getByTestId('clock-time')).toBeOnTheScreen();
    expect(screen.getByTestId('week-summary')).toBeOnTheScreen();
  });

  it('gives an admin who only punches a working tab too', async () => {
    // `RoleSeeder` gives such a user `ClockOwn:Mark` and `ViewOwn:Mark` and
    // nothing else. The screen must not need anything it does not carry.
    await mountLoaded({ permissions: ['ClockOwn:Mark', 'ViewOwn:Mark'] });

    expect(screen.getByText('Turno de hoy')).toBeOnTheScreen();
    expect(screen.getByTestId('clock-status')).toBeOnTheScreen();
    expect(screen.getByTestId('week-summary')).toBeOnTheScreen();
  });
});

/** The two cards this criterion is about, in the order they are drawn. */
function testIdsInOrder(): string[] {
  const wanted = new Set(['location-card', 'shift-card']);
  const found: string[] = [];

  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') {
      return;
    }

    const element = node as { props?: { testID?: string }; children?: unknown[] };
    const testID = element.props?.testID;

    if (testID !== undefined && wanted.has(testID)) {
      found.push(testID);
    }

    for (const child of element.children ?? []) {
      walk(child);
    }
  };

  walk(screen.toJSON());

  return found;
}

/**
 * KMO-16, composed. The card's own states are `location-card.test.tsx` and the
 * machine behind them is `use-location.test.ts`; what is asserted here is only
 * what this screen decides — where the card sits, who sees it, and that the
 * premise it names is the one the shift arrived with.
 */
describe('the geolocation card (KMO-16)', () => {
  it('sits above the shift card, naming the premise from the response', async () => {
    await mountLoaded();

    await waitFor(() =>
      expect(screen.getByText('Sucursal Ñuñoa · a 0 m de la marca')).toBeOnTheScreen(),
    );

    expect(testIdsInOrder()).toEqual(['location-card', 'shift-card']);
  });

  // The card is about the phone, not about `/me/today`, so it has something true
  // to say while the request is still going.
  it('is on screen before the request lands', async () => {
    await mount({ api: { fetchToday: () => new Promise<TodaySummary>(() => {}) } });

    expect(screen.getByTestId('location-card')).toBeOnTheScreen();
  });

  // #8's reasoning applied to a permission the app asks the OS for: a user with
  // no punch surface is not shown this card, and their phone is never asked.
  it('is absent for a user who cannot punch, and their location is never read', async () => {
    const getPermission = jest.fn(async (): Promise<LocationPermission> => 'granted');
    const getFix = jest.fn(async (): Promise<LocationFix | null> => fix);

    await mountLoaded({
      permissions: ['ViewOwn:Workday'],
      location: fakeLocation({ getPermission, getFix }),
    });

    expect(screen.queryByTestId('location-card')).not.toBeOnTheScreen();
    expect(getPermission).not.toHaveBeenCalled();
    expect(getFix).not.toHaveBeenCalled();
  });

  // #1, composed: the sheet is what an employee meets first, and the OS prompt
  // is not raised behind it.
  it('offers the rationale before the OS prompt when the permission was never asked', async () => {
    const requestPermission = jest.fn(async (): Promise<LocationPermission> => 'granted');

    await mountLoaded({
      location: fakeLocation({ getPermission: async () => 'undetermined', requestPermission }),
    });

    await waitFor(() =>
      expect(screen.getByText(es.permissions.location.rationale.title)).toBeOnTheScreen(),
    );

    expect(requestPermission).not.toHaveBeenCalled();

    await userEvent.press(screen.getByTestId('location-rationale-accept'));

    await waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1));
  });

  // #7, composed. The card says what happened and offers the way out; nothing on
  // this screen treats it as a reason to stop.
  it('shows the settings route when the permission is refused for good', async () => {
    await mountLoaded({ location: fakeLocation({ getPermission: async () => 'deniedForever' }) });

    await waitFor(() => expect(screen.getByText(es.marcaje.location.denied)).toBeOnTheScreen());

    expect(screen.getByText(es.actions.openSettings)).toBeOnTheScreen();
    expect(screen.getByTestId('shift-card')).toBeOnTheScreen();
  });
});

describe('loading and failing (#9)', () => {
  it('shows skeletons rather than a spinner over an empty screen', async () => {
    await mount({ api: { fetchToday: () => new Promise<TodaySummary>(() => {}) } });

    expect(screen.getByTestId('home-skeleton')).toBeOnTheScreen();
    expect(screen.getByTestId('shift-card-skeleton')).toBeOnTheScreen();
    expect(screen.queryByTestId('shift-card')).not.toBeOnTheScreen();
  });

  it('names the loading state for a screen reader rather than leaving it silent', async () => {
    await mount({ api: { fetchToday: () => new Promise<TodaySummary>(() => {}) } });

    expect(screen.getByTestId('home-skeleton')).toHaveProp('accessibilityLabel', 'Cargando…');
  });

  it('offers a retry in Spanish when the load fails', async () => {
    await mount({
      api: {
        fetchToday: async () => {
          throw new Error('no signal');
        },
      },
    });

    await waitFor(() => expect(screen.getByTestId('home-load-failed')).toBeOnTheScreen());
    expect(screen.getByText('No pudimos cargar tu turno de hoy.')).toBeOnTheScreen();
    expect(screen.getByText('Reintentar')).toBeOnTheScreen();
  });

  it('keeps the tab and the header while the load is failed', async () => {
    // The criterion is "without losing the tab". The employee's place in the app
    // survives, so recovering is one tap rather than a journey back.
    await mount({
      api: {
        fetchToday: async () => {
          throw new Error('no signal');
        },
      },
    });

    await waitFor(() => expect(screen.getByTestId('home-load-failed')).toBeOnTheScreen());
    expect(screen.getByText('Hola, Camila')).toBeOnTheScreen();
    expect(screen.getByText('Martes 4 de agosto')).toBeOnTheScreen();
  });

  it('recovers the screen when the retry succeeds', async () => {
    let attempt = 0;
    const fetchToday = jest.fn(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error('no signal');
      }

      return summary;
    });

    await mount({ api: { fetchToday } });
    await waitFor(() => expect(screen.getByTestId('home-retry')).toBeOnTheScreen());

    await userEvent.press(screen.getByTestId('home-retry'));

    await waitFor(() => expect(screen.getByText('Sucursal Ñuñoa')).toBeOnTheScreen());
    expect(screen.queryByTestId('home-load-failed')).not.toBeOnTheScreen();
    expect(fetchToday).toHaveBeenCalledTimes(2);
  });

  it('shows no server English, whatever the failure was', async () => {
    // Res. 38 Art. 5 has no exception for a sentence that arrived over HTTP.
    await mount({
      api: {
        fetchToday: async () => {
          throw new Error('Server Error');
        },
      },
    });

    await waitFor(() => expect(screen.getByTestId('home-load-failed')).toBeOnTheScreen());
    expect(screen.queryByText(/Server Error/)).not.toBeOnTheScreen();
  });
});

// KMO-17. The screen composes the punch; `use-punch.test.ts` and
// `punch-action.test.tsx` carry the pieces. What is only true here is that the
// two agree — the line under the clock and the label on the button are the same
// state, before and after a punch.
describe('the punch (KMO-17)', () => {
  it('walks the whole day: entrada, then salida, then the success panel', async () => {
    await mountLoaded();

    expect(screen.getByTestId('clock-status')).toHaveTextContent('Aún no marcas entrada');
    expect(screen.getByText('Marcar entrada')).toBeOnTheScreen();

    await userEvent.press(screen.getByTestId('punch-button'));

    await waitFor(() => expect(screen.getByText('Marcar salida')).toBeOnTheScreen());
    expect(screen.getByTestId('clock-status')).toHaveTextContent('En jornada');

    await userEvent.press(screen.getByTestId('punch-button'));

    await waitFor(() => expect(screen.getByTestId('punch-action-done')).toBeOnTheScreen());
    expect(screen.getByTestId('clock-status')).toHaveTextContent('Jornada finalizada');
    expect(screen.getByText('Nos vemos en tu próximo turno')).toBeOnTheScreen();
    expect(screen.queryByTestId('punch-button')).not.toBeOnTheScreen();
  });

  // #5 and #11. The card above has already read the phone by the time the button
  // is pressed, and what it read is what the mark travels with.
  it('sends the fix the location card is showing', async () => {
    const punchApi = fakePunchApi();
    await mountLoaded({ punchApi });

    await waitFor(() =>
      expect(screen.getByTestId('location-card-title')).toHaveTextContent('Ubicación confirmada'),
    );
    await userEvent.press(screen.getByTestId('punch-button'));

    await waitFor(() => expect(punchApi.calls).toHaveLength(1));
    expect(punchApi.calls[0]).toEqual({ type: 'in', fix, geoStatus: 'inside' });
  });

  // #11's whole point. The employee who refused the permission for good is the
  // one an app most easily locks out of their own attendance record.
  it('punches for an employee who refused the location permission', async () => {
    const punchApi = fakePunchApi({ geoStatus: 'unknown' });
    await mountLoaded({
      punchApi,
      location: fakeLocation({
        getPermission: async () => 'deniedForever',
        requestPermission: async () => 'deniedForever',
        getFix: async () => null,
      }),
    });

    await waitFor(() =>
      expect(screen.getByTestId('location-card-title')).toHaveTextContent(
        'Sin permiso de ubicación',
      ),
    );

    await userEvent.press(screen.getByTestId('punch-button'));

    await waitFor(() => expect(punchApi.calls).toHaveLength(1));
    expect(punchApi.calls[0]).toEqual({ type: 'in', fix: null, geoStatus: 'unknown' });
    await waitFor(() => expect(screen.getByText('Marcar salida')).toBeOnTheScreen());
  });

  // #8. The failure is a line under a button that still said what it said.
  //
  // `server`, not `network` — since KMO-23 a request that never reached the
  // server queues rather than fails; see 'a punch made with no connectivity'.
  it('leaves the employee where they were when the punch fails', async () => {
    await mountLoaded({
      punchApi: {
        punch: async () => {
          throw new ApiError({ kind: 'server', status: 500 });
        },
      },
    });

    await userEvent.press(screen.getByTestId('punch-button'));

    await waitFor(() => expect(screen.getByTestId('punch-failed')).toBeOnTheScreen());
    expect(screen.getByText('Marcar entrada')).toBeOnTheScreen();
    expect(screen.getByTestId('clock-status')).toHaveTextContent('Aún no marcas entrada');
  });

  // #7. The register already holds the punch, so the screen catches up with it —
  // in Spanish, in place, with no dialog anywhere.
  it('reconciles with the server when the punch was already recorded', async () => {
    // The day the screen loaded with, and the day the register actually holds:
    // the punch went in on an earlier attempt whose answer this phone lost.
    let asked = 0;
    const fetchToday = jest.fn(async () => {
      asked += 1;

      return asked === 1 ? summary : { ...summary, punchState: 'working' as const };
    });

    await mountLoaded({
      api: { fetchToday },
      punchApi: {
        punch: async () => {
          throw new DuplicateMarkError(
            new ApiError({ kind: 'client', status: 409, serverMessage: 'Ya marcaste entrada.' }),
          );
        },
      },
    });

    await userEvent.press(screen.getByTestId('punch-button'));

    await waitFor(() => expect(screen.getByTestId('punch-duplicate')).toBeOnTheScreen());
    expect(screen.getByText(es.marcaje.punch.alreadyMarked)).toBeOnTheScreen();
    expect(screen.getByText('Marcar salida')).toBeOnTheScreen();
    expect(screen.getByTestId('clock-status')).toHaveTextContent('En jornada');
    // It asked the register what the day actually looks like rather than
    // trusting the step it inferred.
    expect(fetchToday).toHaveBeenCalledTimes(2);
  });
});

/**
 * KMO-19 at the seam KMO-17 left open (its #10): a successful punch opens the
 * comprobante. The sheet's own contents are `receipt-sheet.test.tsx`'s; what
 * only this level can show is that what opens it is the **receipt the server
 * answered with**, and that a punch which did not go through opens nothing.
 */
describe('the comprobante (KMO-19)', () => {
  it('opens the sheet on a punch the server recorded', async () => {
    await mountLoaded();

    expect(screen.queryByText('¡Marca registrada!')).not.toBeOnTheScreen();

    await userEvent.press(screen.getByTestId('punch-button'));

    await waitFor(() => expect(screen.getByText('¡Marca registrada!')).toBeOnTheScreen());
  });

  it('fills it from the 201 and not from the screen underneath', async () => {
    await mountLoaded();

    await userEvent.press(screen.getByTestId('punch-button'));

    // The server's time, its folio and its worker — none of which this screen
    // has any other copy of. The clock above reads 14:32 from the fake device
    // clock; the receipt reads the wall clock `ams` recorded.
    await waitFor(() => expect(screen.getByText('04/08/26')).toBeOnTheScreen());
    expect(screen.getByText('14:07:22')).toBeOnTheScreen();
    expect(screen.getByText('20260804-0007')).toBeOnTheScreen();
    expect(screen.getByText('21.437.581-8')).toBeOnTheScreen();
  });

  it('closes on Listo and stays closed', async () => {
    await mountLoaded();

    await userEvent.press(screen.getByTestId('punch-button'));
    await waitFor(() => expect(screen.getByText('¡Marca registrada!')).toBeOnTheScreen());

    await userEvent.press(screen.getByTestId('receipt-done'));

    // Dismissed for good: the hook still holds the receipt, and a screen that
    // drew from that would put the sheet straight back up on the next render.
    await waitFor(() => expect(screen.queryByText('¡Marca registrada!')).not.toBeOnTheScreen());
    expect(screen.getByText('Marcar salida')).toBeOnTheScreen();
  });

  it('opens no comprobante for a punch that failed', async () => {
    await mountLoaded({
      punchApi: {
        punch: async () => {
          throw new ApiError({ kind: 'server', status: 500 });
        },
      },
    });

    await userEvent.press(screen.getByTestId('punch-button'));

    await waitFor(() => expect(screen.getByTestId('punch-failed')).toBeOnTheScreen());
    expect(screen.queryByText('¡Marca registrada!')).not.toBeOnTheScreen();
  });

  // #7 through the composition: the line on the receipt is the server's verdict
  // about the mark, which is the one KMO-18's override does not change.
  it('carries the out-of-range line when the server flagged the mark', async () => {
    await mountLoaded({ punchApi: fakePunchApi({ geoStatus: 'outside' }) });

    await userEvent.press(screen.getByTestId('punch-button'));

    await waitFor(() =>
      expect(screen.getByTestId('receipt-out-of-range')).toHaveTextContent(
        'Marca fuera de rango — pendiente de revisión',
      ),
    );
  });
});

/**
 * KMO-18, composed. The unit tests prove each half; what only this level can
 * show is that the card above the button and the button itself are reading the
 * same fact — and that a retry which succeeds releases the punch **in place**,
 * with no reload and nothing remounted (#5).
 */
describe('the escape hatches (KMO-18)', () => {
  /** A phone that is somewhere else. */
  const outOfRange = () => fakeLocation({ getFix: async () => farawayFix });

  // #1
  it('holds the button and offers the override when the employee is out of range', async () => {
    await mountLoaded({ location: outOfRange() });

    await waitFor(() =>
      expect(screen.getByTestId('location-card-title')).toHaveTextContent(
        'Fuera del rango permitido',
      ),
    );

    expect(screen.getByTestId('punch-button')).toBeDisabled();
    expect(screen.getByText(es.marcaje.punch.override)).toBeOnTheScreen();
  });

  // #2's client half. The override is not a second kind of request: what goes on
  // the wire is the punch the primary would have sent, carrying the client's own
  // `outside` verdict, and the server evaluates the geofence again for itself.
  it('records a real punch through the override, flagged outside on the wire', async () => {
    const punchApi = fakePunchApi({ geoStatus: 'outside' });
    await mountLoaded({ location: outOfRange(), punchApi });

    await waitFor(() => expect(screen.getByText(es.marcaje.punch.override)).toBeOnTheScreen());

    await userEvent.press(screen.getByTestId('punch-override'));

    await waitFor(() => expect(punchApi.calls).toHaveLength(1));
    expect(punchApi.calls[0]).toEqual({ type: 'in', fix: farawayFix, geoStatus: 'outside' });

    // And it is a punch, not a gesture: the day moved.
    await waitFor(() => expect(screen.getByText('Marcar salida')).toBeOnTheScreen());
    expect(screen.getByTestId('clock-status')).toHaveTextContent('En jornada');
  });

  // #3
  it('holds the button and offers the location retry when there is no signal', async () => {
    await mountLoaded({ location: fakeLocation({ getFix: async () => null }) });

    await waitFor(() =>
      expect(screen.getByTestId('location-card-title')).toHaveTextContent('Sin señal de GPS'),
    );

    expect(screen.getByTestId('punch-button')).toBeDisabled();
    expect(screen.getByText(es.marcaje.location.retry)).toBeOnTheScreen();
  });

  /**
   * #4 and #5 together, which is the sequence the criteria are actually about: a
   * phone that could not answer, then could.
   *
   * The card updates and the button is released **without the screen reloading**
   * — `fetchToday` is asserted to have run once, so nothing here is a remount in
   * disguise, and the employee is standing exactly where they were.
   */
  it('re-acquires on retry and releases the button, with no reload', async () => {
    let answers = false;
    const getFix = jest.fn(async (): Promise<LocationFix | null> => (answers ? fix : null));
    const fetchToday = jest.fn(async () => summary);

    await mountLoaded({ api: { fetchToday }, location: fakeLocation({ getFix }) });

    await waitFor(() =>
      expect(screen.getByTestId('location-card-title')).toHaveTextContent('Sin señal de GPS'),
    );
    expect(getFix).toHaveBeenCalledTimes(1);

    answers = true;
    await userEvent.press(screen.getByTestId('location-retry'));

    await waitFor(() =>
      expect(screen.getByTestId('location-card-title')).toHaveTextContent('Ubicación confirmada'),
    );

    expect(getFix).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('punch-button')).toBeEnabled();
    expect(screen.queryByTestId('location-retry')).not.toBeOnTheScreen();
    expect(fetchToday).toHaveBeenCalledTimes(1);
  });

  // #4's other half: the fix the retry produced is the one the punch then
  // carries. A released button that still sent the stale reading would be the
  // screen and the wire disagreeing about where the employee was standing.
  it('punches with the fix the retry produced', async () => {
    let answers = false;
    const punchApi = fakePunchApi();

    await mountLoaded({
      location: fakeLocation({ getFix: async () => (answers ? fix : null) }),
      punchApi,
    });

    await waitFor(() => expect(screen.getByTestId('location-retry')).toBeOnTheScreen());

    answers = true;
    await userEvent.press(screen.getByTestId('location-retry'));

    await waitFor(() => expect(screen.getByTestId('punch-button')).toBeEnabled());
    await userEvent.press(screen.getByTestId('punch-button'));

    await waitFor(() => expect(punchApi.calls).toHaveLength(1));
    expect(punchApi.calls[0]).toEqual({ type: 'in', fix, geoStatus: 'inside' });
  });

  // #6
  it('offers neither button once the location is confirmed', async () => {
    await mountLoaded();

    await waitFor(() =>
      expect(screen.getByTestId('location-card-title')).toHaveTextContent('Ubicación confirmada'),
    );

    expect(screen.queryByTestId('punch-override')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('location-retry')).not.toBeOnTheScreen();
    expect(screen.getByTestId('punch-button')).toBeEnabled();
  });

  /**
   * The state the design has no frame for, and the one an app most easily locks
   * an employee out of their own attendance with. A refusal is not a hold: no
   * fix is ever coming, so the punch goes with `geo_status: unknown` rather than
   * sitting behind a retry that cannot help (D-F1-c, KMO-17 #11).
   */
  it('does not hold the button for a permission refused for good', async () => {
    await mountLoaded({ location: fakeLocation({ getPermission: async () => 'deniedForever' }) });

    await waitFor(() => expect(screen.getByText(es.marcaje.location.denied)).toBeOnTheScreen());

    expect(screen.getByTestId('punch-button')).toBeEnabled();
    expect(screen.queryByTestId('punch-override')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('location-retry')).not.toBeOnTheScreen();
  });

  // The seconds a cold fix takes are not a hold either. The design's own
  // `primaryDisabled` is out-of-range or no-GPS and nothing else, and a button
  // dimmed for the twelve seconds a warehouse GPS start can run — with nothing
  // under it to press — is goal G1 spent on a dead control.
  it('does not hold the button while the first fix is still arriving', async () => {
    await mountLoaded({
      location: fakeLocation({ getFix: () => new Promise<LocationFix | null>(() => {}) }),
    });

    await waitFor(() =>
      expect(screen.getByTestId('location-card-title')).toHaveTextContent('Buscando tu ubicación'),
    );

    expect(screen.getByTestId('punch-button')).toBeEnabled();
    expect(screen.queryByTestId('location-retry')).not.toBeOnTheScreen();
  });
});

/**
 * KMO-20, composed. `marks-sheet.test.tsx` proves the list draws and `use-marks`
 * proves it loads; what only this level can show is that the list is reachable
 * from the tab without leaving it (#5), and that a row tapped in it opens the
 * comprobante KMO-19 built rather than a second rendering of one (#2, #3).
 */
describe('the punch history (KMO-20)', () => {
  /** Open the list from the link on the tab, and wait for it to have loaded. */
  async function openHistory() {
    await userEvent.press(screen.getByTestId('marks-open'));
    await waitFor(() => expect(screen.getByTestId('marks-list')).toBeOnTheScreen());
  }

  // #5
  it('is reachable from the Marcaje tab', async () => {
    await mountLoaded();

    expect(screen.getByTestId('marks-open')).toBeOnTheScreen();
    expect(screen.getByText('Ver mis últimas marcas')).toBeOnTheScreen();
  });

  // #5. A sheet and not a route: the screen behind it is still Inicio, which is
  // what "without leaving the tab context" means on a tab bar this app draws by
  // hand. A pushed route would land on the root stack and cover it.
  it('opens over the tab rather than navigating away from it', async () => {
    await mountLoaded();

    await openHistory();

    expect(screen.getByText('Mis últimas marcas')).toBeOnTheScreen();
    // The clock and the shift card are still mounted underneath.
    expect(screen.getByTestId('shift-card')).toBeOnTheScreen();
    expect(screen.getByTestId('clock')).toBeOnTheScreen();
  });

  // #1
  it('lists the punches the register answered with', async () => {
    await mountLoaded({
      marksApi: fakeMarksApi([
        storedMark({ markId: 1502, type: 'out', datetime: '2026-07-31 17:58:02' as NaiveDateTime }),
        storedMark({ markId: 1501, type: 'in', datetime: '2026-07-31 08:01:44' as NaiveDateTime }),
      ]),
    });

    await openHistory();

    expect(screen.getByText('Salida')).toBeOnTheScreen();
    expect(screen.getByText('17:58')).toBeOnTheScreen();
    expect(screen.getByText('08:01')).toBeOnTheScreen();
  });

  it('costs the punch screen no request until it is opened', async () => {
    // Goal G1 is time-to-punch, and a list nobody has looked at must not spend
    // a warehouse connection on the screen where the button is.
    const marksApi = fakeMarksApi([storedMark()]);

    await mountLoaded({ marksApi });

    expect(marksApi.calls).toBe(0);

    await openHistory();

    expect(marksApi.calls).toBe(1);
  });

  it('asks the register again when the list is reopened after a punch', async () => {
    const marksApi = fakeMarksApi([storedMark()]);

    await mountLoaded({ marksApi });

    await openHistory();
    await userEvent.press(screen.getByTestId('marks-done'));
    await waitFor(() => expect(screen.queryByTestId('marks-list')).not.toBeOnTheScreen());

    await userEvent.press(screen.getByTestId('punch-button'));
    await waitFor(() => expect(screen.getByText('¡Marca registrada!')).toBeOnTheScreen());
    await userEvent.press(screen.getByTestId('receipt-done'));

    await openHistory();

    // A history that omits the mark the employee made a minute ago is the one
    // wrong answer this list can give.
    expect(marksApi.calls).toBe(2);
  });

  it('does not ask again when a comprobante is opened from a row and dismissed', async () => {
    const marksApi = fakeMarksApi([storedMark()]);

    await mountLoaded({ marksApi });

    await openHistory();
    await userEvent.press(screen.getByTestId('mark-row-1502'));
    await waitFor(() => expect(screen.getByText('¡Marca registrada!')).toBeOnTheScreen());
    await userEvent.press(screen.getByTestId('receipt-done'));
    await waitFor(() => expect(screen.getByTestId('marks-list')).toBeOnTheScreen());

    // Reading one of its rows is not closing the list, and the register did not
    // change while they were doing it.
    expect(marksApi.calls).toBe(1);
  });

  describe('a punch tapped in the list (#2, #3)', () => {
    it('opens the comprobante KMO-19 built, from the stored mark', async () => {
      await mountLoaded();

      await openHistory();
      await userEvent.press(screen.getByTestId('mark-row-1502'));

      await waitFor(() => expect(screen.getByText('¡Marca registrada!')).toBeOnTheScreen());
    });

    // #3. The values are the register's, and the same ones the punch showed:
    // both paths hand `ReceiptSheet` the same `PunchReceipt`.
    it('shows the folio and the hash the register recorded', async () => {
      await mountLoaded();

      await openHistory();
      await userEvent.press(screen.getByTestId('mark-row-1502'));

      await waitFor(() => expect(screen.getByText('20260731-0003')).toBeOnTheScreen());
      expect(screen.getByTestId('receipt-hash')).toHaveTextContent('c3d4e5f60718');
      // Its own recorded time, not today's and not the device clock's.
      expect(screen.getByText('31/07/26')).toBeOnTheScreen();
      expect(screen.getByText('08:01:44')).toBeOnTheScreen();
    });

    it('shows the receipt alone rather than stacked over the list', async () => {
      await mountLoaded();

      await openHistory();
      await userEvent.press(screen.getByTestId('mark-row-1502'));

      // Two React Native `Modal`s over each other is a stack neither platform
      // agrees about, and nothing here needs one.
      await waitFor(() => expect(screen.getByText('¡Marca registrada!')).toBeOnTheScreen());
      expect(screen.queryByTestId('marks-list')).not.toBeOnTheScreen();
    });

    it('returns to the list when the comprobante is dismissed', async () => {
      await mountLoaded();

      await openHistory();
      await userEvent.press(screen.getByTestId('mark-row-1502'));
      await waitFor(() => expect(screen.getByText('¡Marca registrada!')).toBeOnTheScreen());

      await userEvent.press(screen.getByTestId('receipt-done'));

      // Back where they came from, without a second request for a register that
      // did not change while they were reading one of its rows.
      await waitFor(() => expect(screen.getByTestId('marks-list')).toBeOnTheScreen());
      expect(screen.queryByText('¡Marca registrada!')).not.toBeOnTheScreen();
    });
  });

  // #4
  it('shows the Spanish empty state for an employee who has never punched', async () => {
    await mountLoaded({ marksApi: fakeMarksApi([]) });

    await userEvent.press(screen.getByTestId('marks-open'));

    await waitFor(() =>
      expect(screen.getByText('Aún no tienes marcas registradas')).toBeOnTheScreen(),
    );
    expect(
      screen.getByText('Cuando marques entrada o salida, el comprobante quedará aquí.'),
    ).toBeOnTheScreen();
  });

  it('closes on Listo and stays closed', async () => {
    await mountLoaded();

    await openHistory();
    await userEvent.press(screen.getByTestId('marks-done'));

    await waitFor(() => expect(screen.queryByTestId('marks-list')).not.toBeOnTheScreen());
    expect(screen.getByTestId('marks-open')).toBeOnTheScreen();
  });

  describe('the ViewOwn:Mark gate', () => {
    it('offers no history to an employee whose role does not read marks', async () => {
      await mountLoaded({ permissions: ['ClockOwn:Mark'] });

      // Hidden rather than shown and 403ing — the safe direction to be wrong in
      // on a screen about a legal register.
      expect(screen.queryByTestId('marks-open')).not.toBeOnTheScreen();
    });

    it('offers it to one who reads marks without punching them', async () => {
      await mountLoaded({ permissions: ['ViewOwn:Mark'] });

      expect(screen.getByTestId('marks-open')).toBeOnTheScreen();
      expect(screen.queryByTestId('punch-action')).not.toBeOnTheScreen();
    });
  });

  // Art. 22.1 access is not conditional on today's summary having arrived. An
  // employee whose `/me/today` failed can still open their history.
  it('stays reachable when today’s summary failed to load', async () => {
    await mount({
      api: {
        fetchToday: async () => {
          throw new ApiError({ kind: 'server', status: 500 });
        },
      },
    });

    await waitFor(() => expect(screen.getByTestId('home-load-failed')).toBeOnTheScreen());

    await openHistory();

    expect(screen.getByText('Mis últimas marcas')).toBeOnTheScreen();
  });
});

describe('the pending-sync banner (KMO-22)', () => {
  /**
   * Every `testID` on screen, in the order the tree draws them — which is what
   * "above the location card" means when the assertion has no pixels to look at.
   */
  function testIDsInOrder(): string[] {
    const found: string[] = [];

    const walk = (node: unknown): void => {
      if (node === null || typeof node !== 'object') {
        return;
      }

      const element = node as { props?: { testID?: unknown }; children?: unknown };

      if (typeof element.props?.testID === 'string') {
        found.push(element.props.testID);
      }

      if (Array.isArray(element.children)) {
        for (const child of element.children) {
          walk(child);
        }
      }
    };

    walk(screen.toJSON());

    return found;
  }

  /** A queue already holding punches, as `use-punch.ts` fills it (KMO-23). */
  async function queueHolding(count: number): Promise<PunchQueue> {
    const queue = createPunchQueue();

    for (let index = 0; index < count; index += 1) {
      await queue.enqueue({
        id: `q${index}`,
        type: index % 2 === 0 ? 'in' : 'out',
        fix: null,
        geoStatus: 'unknown',
        idempotencyKey: `idem-q${index}`,
        deviceDatetime: '2026-08-04 08:00:00' as NaiveDateTime,
      });
    }

    return queue;
  }

  describe('with an empty queue (#6)', () => {
    it('shows nothing, online', async () => {
      await mountLoaded();

      expect(screen.queryByTestId('pending-sync-banner')).not.toBeOnTheScreen();
      expect(screen.queryByText(es.actions.sync)).not.toBeOnTheScreen();
    });

    it('shows nothing offline either', async () => {
      // Being offline with nothing waiting is not something the employee needs
      // told: nothing of theirs is at risk, and a standing "sin conexión" strip
      // is how somebody learns to read past the one that matters.
      await mountLoaded({ connectivity: fakeConnectivity(false) });

      expect(screen.queryByTestId('pending-sync-banner')).not.toBeOnTheScreen();
    });

    it('shows nothing when connectivity is lost while the screen is open', async () => {
      const connectivity = fakeConnectivity(true);
      await mountLoaded({ connectivity });

      await act(async () => {
        connectivity.report(false);
      });

      expect(screen.queryByTestId('pending-sync-banner')).not.toBeOnTheScreen();
    });
  });

  describe('with punches waiting (#2, #3)', () => {
    it('names the count and says they are not in the attendance book', async () => {
      await mountLoaded({ queue: await queueHolding(2) });

      expect(screen.getByText('2 marcas esperando sincronizar')).toBeOnTheScreen();
      expect(screen.getByText('Aún no forman parte del libro de asistencia')).toBeOnTheScreen();
    });

    it('uses the singular for one', async () => {
      await mountLoaded({ queue: await queueHolding(1) });

      expect(screen.getByText('1 marca esperando sincronizar')).toBeOnTheScreen();
    });

    it('sits above the location card, where the design puts it', async () => {
      await mountLoaded({ queue: await queueHolding(1) });

      const order = testIDsInOrder();

      expect(order.indexOf('pending-sync-banner')).toBeGreaterThanOrEqual(0);
      expect(order.indexOf('pending-sync-banner')).toBeLessThan(order.indexOf('location-card'));
      expect(order.indexOf('pending-sync-banner')).toBeLessThan(order.indexOf('shift-card'));
    });

    it('is on screen before today’s summary has arrived', async () => {
      // An untransmitted punch is a fact about the phone. A `/me/today` that is
      // slow, or never lands, does not make it any less untransmitted.
      await mount({
        api: { fetchToday: () => new Promise<TodaySummary>(() => {}) },
        queue: await queueHolding(1),
      });

      expect(screen.getByTestId('pending-sync-banner')).toBeOnTheScreen();
      expect(screen.getByTestId('home-skeleton')).toBeOnTheScreen();
    });
  });

  describe('Sincronizar (#4, #5)', () => {
    it('flushes the queue and takes the banner away when it empties', async () => {
      const queue = await queueHolding(2);
      const sent: string[] = [];

      await mountLoaded({
        queue,
        punchSync: async (punch) => {
          sent.push(punch.id);
        },
      });

      await userEvent.press(screen.getByTestId('pending-sync-action'));

      await waitFor(() =>
        expect(screen.queryByTestId('pending-sync-banner')).not.toBeOnTheScreen(),
      );
      expect(sent).toEqual(['q0', 'q1']);
    });

    it('reports itself busy while the flush runs', async () => {
      const queue = await queueHolding(1);
      let release: (() => void) | undefined;

      await mountLoaded({
        queue,
        punchSync: () =>
          new Promise((resolve) => {
            release = () => resolve(undefined);
          }),
      });

      await userEvent.press(screen.getByTestId('pending-sync-action'));

      await waitFor(() =>
        expect(screen.getByTestId('pending-sync-action').props.accessibilityState.busy).toBe(true),
      );

      await act(async () => {
        release?.();
      });
    });
  });

  describe('when the flush fails (#7)', () => {
    it('keeps every punch and says why in the server’s Spanish', async () => {
      const queue = await queueHolding(2);

      await mountLoaded({
        queue,
        punchSync: () =>
          Promise.reject(
            new ApiError({ kind: 'server', status: 500, serverMessage: 'El servidor falló.' }),
          ),
      });

      await userEvent.press(screen.getByTestId('pending-sync-action'));

      await waitFor(() =>
        expect(screen.getByTestId('pending-sync-error')).toHaveTextContent('El servidor falló.'),
      );
      expect(screen.getByText('2 marcas esperando sincronizar')).toBeOnTheScreen();
    });

    it('says so immediately with no connectivity, rather than spending a doomed request', async () => {
      // #1, wired to the one thing this screen uses it for. The button is never
      // disabled — Art. 38 b) names a blocked app as non-conforming — so the
      // press lands and produces the reason without the round trip.
      const punchSync = jest.fn();

      await mountLoaded({
        queue: await queueHolding(1),
        connectivity: fakeConnectivity(false),
        punchSync,
      });

      await userEvent.press(screen.getByTestId('pending-sync-action'));

      await waitFor(() =>
        expect(screen.getByTestId('pending-sync-error')).toHaveTextContent(es.errors.network),
      );
      expect(punchSync).not.toHaveBeenCalled();
      expect(screen.getByText('1 marca esperando sincronizar')).toBeOnTheScreen();
    });
  });

  describe('the durable queue, end to end (KMO-23)', () => {
    it('queues a punch that never reached the server, and shows it waiting', async () => {
      const queue = createPunchQueue();

      await mountLoaded({
        queue,
        punchApi: {
          punch: async () => {
            throw new ApiError({ kind: 'network' });
          },
        },
      });

      await userEvent.press(screen.getByTestId('punch-button'));

      // Never Art. 38 b)'s blocked app: the button already reads the next
      // punch, and the queue is what says the register does not have it yet.
      await waitFor(() => expect(screen.getByText('Marcar salida')).toBeOnTheScreen());
      expect(screen.getByTestId('punch-queued')).toBeOnTheScreen();
      expect(screen.getByText('1 marca esperando sincronizar')).toBeOnTheScreen();
      expect(screen.queryByTestId('punch-failed')).not.toBeOnTheScreen();
    });

    it('flushes automatically the instant connectivity returns, with no press on Sincronizar (#4)', async () => {
      const connectivity = fakeConnectivity(false);
      const sent: string[] = [];

      await mountLoaded({
        queue: await queueHolding(1),
        connectivity,
        punchSync: async (punch) => {
          sent.push(punch.id);

          return undefined;
        },
      });

      expect(screen.getByText('1 marca esperando sincronizar')).toBeOnTheScreen();

      await act(async () => {
        connectivity.report(true);
      });

      await waitFor(() =>
        expect(screen.queryByTestId('pending-sync-banner')).not.toBeOnTheScreen(),
      );
      expect(sent).toEqual(['q0']);
    });

    // #12. A settlement is not a stop — the row still leaves the queue — but
    // the employee is told rather than it happening silently.
    //
    // The banner itself only draws while something is waiting (KMO-22 #6), so
    // a notice from a flush that emptied the queue has nowhere to land until
    // the banner is on screen for another reason — the realistic shape of
    // that is a further punch queuing before the employee has looked away,
    // which is what this drives rather than pressing Sincronizar on an
    // already-empty queue.
    it('carries the notice from a settled refusal onto the next punch that queues', async () => {
      const queue = await queueHolding(1);

      await mountLoaded({
        queue,
        punchApi: {
          punch: async () => {
            throw new ApiError({ kind: 'network' });
          },
        },
      });

      await act(async () => {
        await queue.flush({
          sync: async () => ({ message: 'La marca es demasiado antigua para transmitirse.' }),
        });
      });

      await waitFor(() =>
        expect(screen.queryByTestId('pending-sync-banner')).not.toBeOnTheScreen(),
      );

      await userEvent.press(screen.getByTestId('punch-button'));

      await waitFor(() =>
        expect(screen.getByText('1 marca esperando sincronizar')).toBeOnTheScreen(),
      );
      expect(screen.getByTestId('pending-sync-error')).toHaveTextContent(
        'La marca es demasiado antigua para transmitirse.',
      );
    });
  });
});

/**
 * KMO-24: the sheet a queued punch opens, and what a synced one shows
 * afterwards. The sheet's own rendering is `receipt-sheet.test.tsx`'s; what
 * only this level can show is that `usePunch`'s `onQueued` — left in place by
 * KMO-23 for this ticket — actually reaches the sheet, and with which
 * identity.
 */
describe('the offline receipt (KMO-24)', () => {
  it('opens the offline sheet the instant a punch is durably queued, not the confirmed one', async () => {
    await mountLoaded({
      punchApi: {
        punch: async () => {
          throw new ApiError({ kind: 'network' });
        },
      },
    });

    expect(screen.queryByText('Marca guardada en tu teléfono')).not.toBeOnTheScreen();

    await userEvent.press(screen.getByTestId('punch-button'));

    await waitFor(() =>
      expect(screen.getByText('Marca guardada en tu teléfono')).toBeOnTheScreen(),
    );
    expect(screen.queryByText('¡Marca registrada!')).not.toBeOnTheScreen();
    expect(screen.getByTestId('receipt-badge')).toHaveStyle({
      backgroundColor: tones.warning.background,
    });
  });

  // The one source that exists for a punch the register has not seen yet
  // (§4.5) — the signed-in employee's own name and RUT, as `sessionWrapper`
  // sets them up for every test in this file.
  it('names the signed-in employee on the offline draft, with nothing off the register', async () => {
    await mountLoaded({
      punchApi: {
        punch: async () => {
          throw new ApiError({ kind: 'network' });
        },
      },
    });

    await userEvent.press(screen.getByTestId('punch-button'));

    await waitFor(() => expect(screen.getByText('Camila Rojas')).toBeOnTheScreen());
    expect(screen.getByText('12.345.678-9')).toBeOnTheScreen();
    expect(screen.queryByText('N° comprobante')).toBeOnTheScreen();
    expect(screen.getByText('Pendiente de asignación')).toBeOnTheScreen();
    expect(screen.queryByTestId('receipt-copy')).not.toBeOnTheScreen();
  });

  // #6, #8. Once a queued punch syncs it is an ordinary row in `GET /marks`,
  // and its receipt is the confirmed one — but still carries the provenance
  // that it was made offline, which is the fact §4.6 needs kept.
  it('shows the confirmed receipt with its offline provenance once the punch has synced', async () => {
    await mountLoaded({
      marksApi: fakeMarksApi([storedMark({ capturedOffline: true })]),
    });

    await userEvent.press(screen.getByTestId('marks-open'));
    await waitFor(() => expect(screen.getByTestId('marks-list')).toBeOnTheScreen());
    await userEvent.press(screen.getByTestId('mark-row-1502'));

    await waitFor(() => expect(screen.getByText('¡Marca registrada!')).toBeOnTheScreen());
    expect(screen.getByTestId('receipt-badge')).toHaveStyle({
      backgroundColor: tones.success.background,
    });
    // The folio the register allocated, not the offline draft's placeholder.
    expect(screen.getByText('20260731-0003')).toBeOnTheScreen();
    expect(screen.getByTestId('receipt-captured-offline')).toHaveTextContent(
      'Esta marca se registró sin conexión y se sincronizó automáticamente.',
    );
  });

  it('says nothing about offline provenance for an ordinary online mark', async () => {
    await mountLoaded();

    await userEvent.press(screen.getByTestId('marks-open'));
    await waitFor(() => expect(screen.getByTestId('marks-list')).toBeOnTheScreen());
    await userEvent.press(screen.getByTestId('mark-row-1502'));

    await waitFor(() => expect(screen.getByText('¡Marca registrada!')).toBeOnTheScreen());
    expect(screen.queryByTestId('receipt-captured-offline')).not.toBeOnTheScreen();
  });
});
