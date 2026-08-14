import { render, screen } from '@testing-library/react-native';

import type { NaiveDate, NaiveTime } from '@/api';
import { es } from '@/i18n';
import { colors } from '@/theme';

import type { TodayShift } from './shifts-api';
import { TodayShiftCard } from './today-shift-card';

function shift(overrides: Partial<TodayShift> = {}): TodayShift {
  return {
    date: '2026-08-13' as NaiveDate,
    premise: 'Sucursal Ñuñoa',
    startTime: '08:00:00' as NaiveTime,
    endTime: '17:00:00' as NaiveTime,
    lunch: null,
    leaveTypeLabel: null,
    holidayName: null,
    punchState: 'before',
    ...overrides,
  };
}

describe('TodayShiftCard', () => {
  it('shows the eyebrow, the schedule and the punch status', async () => {
    await render(<TodayShiftCard shift={shift()} />);

    expect(screen.getByText(es.jornada.todayEyebrow)).toBeOnTheScreen();
    expect(screen.getByText('08:00 – 17:00 · Sucursal Ñuñoa')).toBeOnTheScreen();
    expect(screen.getByText(es.marcaje.status.before)).toBeOnTheScreen();
  });

  it('shows a different status line for a different punch state', async () => {
    await render(<TodayShiftCard shift={shift({ punchState: 'working' })} />);

    expect(screen.getByText(es.marcaje.status.working)).toBeOnTheScreen();
  });

  it('shows no status line for an employee who does not punch at all', async () => {
    await render(<TodayShiftCard shift={shift({ punchState: null })} />);

    expect(screen.queryByText(es.marcaje.status.before)).toBeNull();
    expect(screen.queryByText(es.marcaje.status.working)).toBeNull();
    expect(screen.queryByText(es.marcaje.status.done)).toBeNull();
  });

  it('shows the leave type instead of the time window when today is a leave', async () => {
    await render(
      <TodayShiftCard
        shift={shift({ leaveTypeLabel: 'Vacaciones', startTime: null, endTime: null })}
      />,
    );

    expect(screen.getByText('Vacaciones · Sucursal Ñuñoa')).toBeOnTheScreen();
  });

  it('shows the honest empty state when nothing is scheduled today', async () => {
    await render(<TodayShiftCard shift={null} />);

    expect(screen.getByText(es.jornada.todayEyebrow)).toBeOnTheScreen();
    expect(screen.getByText(es.marcaje.shift.emptyTitle)).toBeOnTheScreen();
  });

  it('draws the primary-tinted card in both states', async () => {
    await render(<TodayShiftCard shift={shift()} />);
    expect(screen.getByTestId('today-shift-card')).toHaveStyle({ backgroundColor: colors.primary });
  });
});
