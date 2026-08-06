import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ApiError, type NaiveDate, type NaiveDateTime, type NaiveTime } from '@/api';
import { es } from '@/i18n';

import type { AuthApi } from '../auth/auth-api';
import { employeePermissions, parsePermissions, type Permission } from '../auth/permissions';
import { SessionProvider } from '../auth/session';
import type { SessionUser } from '../auth/session-user';
import { createMemoryTokenStore } from '../auth/token-store';
import { HomeScreen } from './home-screen';
import { CLOCK_TICK_MS } from './now-clock';
import type { LocationFix } from './geofence';
import type { LocationPermission, LocationSource } from './location';
import { DuplicateMarkError, type PunchApi, type PunchReceipt } from './punch-api';
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
  permissions?: readonly Permission[];
  firstName?: string | null;
  at?: string;
  location?: LocationSource;
};

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
      clock={clock}
      locationSource={options.location ?? fakeLocation()}
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

  // #8. The failure is a line under a button that still says what it said.
  it('leaves the employee where they were when the punch fails', async () => {
    await mountLoaded({
      punchApi: {
        punch: async () => {
          throw new ApiError({ kind: 'network' });
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
