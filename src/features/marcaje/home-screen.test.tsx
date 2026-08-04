import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { NaiveDate, NaiveTime } from '@/api';

import type { AuthApi } from '../auth/auth-api';
import { employeePermissions, parsePermissions, type Permission } from '../auth/permissions';
import { SessionProvider } from '../auth/session';
import type { SessionUser } from '../auth/session-user';
import { createMemoryTokenStore } from '../auth/token-store';
import { HomeScreen } from './home-screen';
import { CLOCK_TICK_MS } from './now-clock';
import type { TodayApi, TodaySummary } from './today-api';

const summary: TodaySummary = {
  date: '2026-08-04' as NaiveDate,
  shift: {
    premise: 'Sucursal Ñuñoa',
    startTime: '08:00:00' as NaiveTime,
    endTime: '17:00:00' as NaiveTime,
    lunch: { startTime: '13:00:00' as NaiveTime, endTime: '14:00:00' as NaiveTime },
  },
  punchState: 'before',
  week: { workedHours: 32.5, contractedHours: 44 },
};

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
      <SessionProvider authApi={authApi} tokenStore={store} deviceName={async () => 'Kolvi test'}>
        {children}
      </SessionProvider>
    );
  };
}

type MountOptions = {
  api?: TodayApi;
  permissions?: readonly Permission[];
  firstName?: string | null;
  at?: string;
};

async function mount(options: MountOptions = {}) {
  const api: TodayApi = options.api ?? { fetchToday: async () => summary };
  const sessionUser = user({
    permissions: parsePermissions(options.permissions ?? employeePermissions),
    ...(options.firstName === undefined ? {} : { firstName: options.firstName }),
  });

  const clock = () => new Date(options.at ?? '2026-08-04T14:07:22');

  const rendered = await render(<HomeScreen onOpenProfile={() => {}} api={api} clock={clock} />, {
    wrapper: sessionWrapper(sessionUser),
  });

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
