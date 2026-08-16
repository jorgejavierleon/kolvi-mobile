import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { NaiveDate } from '@/api';
import { es } from '@/i18n';

import { Historial } from './historial';
import type { Workday, WorkdaysApi } from './workdays-api';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

function draw(api: WorkdaysApi) {
  return render(<Historial api={api} />);
}

function workday(overrides: Partial<Workday> = {}): Workday {
  return {
    date: '2026-08-14' as NaiveDate,
    statusLabel: 'A tiempo',
    statusTone: 'success',
    workedTime: '08:00',
    extraTime: '00:00',
    missingTime: '00:00',
    leaveTypeLabel: null,
    ...overrides,
  };
}

function apiFor(workdays: readonly Workday[]): WorkdaysApi {
  return { fetchWorkdays: async () => workdays };
}

describe('Historial', () => {
  it('shows the loading skeleton first', async () => {
    await draw({ fetchWorkdays: () => new Promise(() => {}) });

    expect(screen.getByTestId('historial-skeleton')).toBeOnTheScreen();
  });

  it('shows the loaded days with their status and figures', async () => {
    await draw(apiFor([workday()]));

    expect(await screen.findByText('Vie 14 ago')).toBeOnTheScreen();
    expect(screen.getByText('A tiempo')).toBeOnTheScreen();
    expect(screen.getByText('08:00')).toBeOnTheScreen();
  });

  it('shows an honest empty state for a range with no workdays', async () => {
    await draw(apiFor([]));

    expect(await screen.findByTestId('historial-empty')).toBeOnTheScreen();
    expect(screen.getByText(es.jornada.historial.empty)).toBeOnTheScreen();
  });

  it('shows the leave type in place of the figures for a leave day', async () => {
    await draw(
      apiFor([
        workday({
          leaveTypeLabel: 'Vacaciones',
          workedTime: null,
          extraTime: null,
          missingTime: null,
        }),
      ]),
    );

    expect(await screen.findByText('Vacaciones')).toBeOnTheScreen();
  });

  it('shows a retry when the initial load fails, and recovers on success', async () => {
    let attempt = 0;
    const api: WorkdaysApi = {
      fetchWorkdays: async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('network down');
        }

        return [workday()];
      },
    };

    await draw(api);

    expect(await screen.findByTestId('historial-load-failed')).toBeOnTheScreen();
    expect(screen.getByText(es.jornada.loadFailed)).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('historial-retry'));

    expect(await screen.findByText('Vie 14 ago')).toBeOnTheScreen();
  });

  it('loads and appends an older month without losing what is already on screen', async () => {
    let calls = 0;
    const api: WorkdaysApi = {
      fetchWorkdays: async () => {
        calls += 1;
        return calls === 1
          ? [workday({ date: '2026-08-14' as NaiveDate })]
          : [workday({ date: '2026-07-20' as NaiveDate })];
      },
    };

    await draw(api);

    expect(await screen.findByText('Vie 14 ago')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('historial-load-older'));

    expect(await screen.findByText('Lun 20 jul')).toBeOnTheScreen();
    expect(screen.getByText('Vie 14 ago')).toBeOnTheScreen();
  });

  it('reports a failed page-back without losing the months already loaded', async () => {
    let calls = 0;
    const api: WorkdaysApi = {
      fetchWorkdays: async () => {
        calls += 1;
        if (calls === 1) {
          return [workday({ date: '2026-08-14' as NaiveDate })];
        }

        throw new Error('network down');
      },
    };

    await draw(api);

    expect(await screen.findByText('Vie 14 ago')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('historial-load-older'));

    expect(await screen.findByText(es.jornada.historial.loadOlderMonthFailed)).toBeOnTheScreen();
    expect(screen.getByText('Vie 14 ago')).toBeOnTheScreen();
  });

  it('pushes the day-detail route for the tapped day (KMO-34)', async () => {
    await draw(apiFor([workday({ date: '2026-08-14' as NaiveDate })]));

    fireEvent.press(await screen.findByText('Vie 14 ago'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/jornada/[date]',
      params: { date: '2026-08-14' },
    });
  });
});
