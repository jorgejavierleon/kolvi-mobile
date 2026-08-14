import { fireEvent, render, screen } from '@testing-library/react-native';

import type { NaiveDate, NaiveTime } from '@/api';
import { es } from '@/i18n';

import type { ScheduledDay, UpcomingShifts, UpcomingShiftsApi } from './shifts-api';
import { Proximos } from './proximos';

function day(overrides: Partial<ScheduledDay> = {}): ScheduledDay {
  return {
    date: '2026-08-14' as NaiveDate,
    premise: 'Sucursal Ñuñoa',
    startTime: '08:00:00' as NaiveTime,
    endTime: '17:00:00' as NaiveTime,
    lunch: null,
    leaveTypeLabel: null,
    holidayName: null,
    ...overrides,
  };
}

function shifts(overrides: Partial<UpcomingShifts> = {}): UpcomingShifts {
  return {
    date: '2026-08-13' as NaiveDate,
    today: {
      ...day({ date: '2026-08-13' as NaiveDate }),
      punchState: 'before',
    },
    days: [day()],
    ...overrides,
  };
}

function apiFor(shiftsResult: UpcomingShifts): UpcomingShiftsApi {
  return { fetchUpcomingShifts: async () => shiftsResult };
}

describe('Proximos', () => {
  it('shows the loading skeleton first', async () => {
    await render(<Proximos api={{ fetchUpcomingShifts: () => new Promise(() => {}) }} />);

    expect(screen.getByTestId('proximos-skeleton')).toBeOnTheScreen();
  });

  it('shows today’s card and the upcoming rows once loaded', async () => {
    await render(<Proximos api={apiFor(shifts())} />);

    expect(await screen.findByTestId('today-shift-card')).toBeOnTheScreen();
    // 2026-08-14 is one day after 2026-08-13 — the row is literally tomorrow.
    expect(screen.getByText('Mañana · Vie 14 ago')).toBeOnTheScreen();
    expect(screen.getByText('08:00 – 17:00')).toBeOnTheScreen();
  });

  it('does not label a day "Mañana" when it is not literally tomorrow', async () => {
    // A Monday two days after a Friday "today" — a weekend was skipped, so
    // the first row in the list is not tomorrow even though it is first.
    await render(
      <Proximos
        api={apiFor(
          shifts({
            date: '2026-08-14' as NaiveDate, // Friday
            today: null,
            days: [day({ date: '2026-08-17' as NaiveDate })], // Monday
          }),
        )}
      />,
    );

    expect(await screen.findByText('Lun 17 ago')).toBeOnTheScreen();
    expect(screen.queryByText('Mañana', { exact: false })).toBeNull();
  });

  it('shows the leave type in place of the time window for an annotated row', async () => {
    await render(
      <Proximos
        api={apiFor(
          shifts({
            days: [day({ leaveTypeLabel: 'Vacaciones', startTime: null, endTime: null })],
          }),
        )}
      />,
    );

    expect(await screen.findByText('Vacaciones')).toBeOnTheScreen();
  });

  it('shows the holiday name in place of the time window for a holiday row', async () => {
    await render(
      <Proximos
        api={apiFor(
          shifts({
            days: [day({ holidayName: 'Fiestas Patrias', startTime: null, endTime: null })],
          }),
        )}
      />,
    );

    expect(await screen.findByText('Fiestas Patrias')).toBeOnTheScreen();
  });

  it('shows a retry when the load fails, and recovers on success', async () => {
    let attempt = 0;
    const api: UpcomingShiftsApi = {
      fetchUpcomingShifts: async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('network down');
        }

        return shifts();
      },
    };

    await render(<Proximos api={api} />);

    expect(await screen.findByTestId('proximos-load-failed')).toBeOnTheScreen();
    expect(screen.getByText(es.jornada.loadFailed)).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('proximos-retry'));

    expect(await screen.findByTestId('today-shift-card')).toBeOnTheScreen();
  });
});
