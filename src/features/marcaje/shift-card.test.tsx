import { render, screen } from '@testing-library/react-native';

import type { NaiveTime } from '@/api';
import { es } from '@/i18n';

import { ShiftCard, ShiftCardSkeleton } from './shift-card';
import type { TodayShift } from './today-api';

function shift(overrides: Partial<TodayShift> = {}): TodayShift {
  return {
    premise: 'Sucursal Ñuñoa',
    startTime: '08:00:00' as NaiveTime,
    endTime: '17:00:00' as NaiveTime,
    lunch: { startTime: '13:00:00' as NaiveTime, endTime: '14:00:00' as NaiveTime },
    geofence: null,
    ...overrides,
  };
}

describe('ShiftCard', () => {
  // #2, every element the criterion names.
  it('shows the eyebrow, the premise and the scheduled window', async () => {
    await render(<ShiftCard shift={shift()} />);

    expect(screen.getByText('Turno de hoy')).toBeOnTheScreen();
    expect(screen.getByText('Sucursal Ñuñoa')).toBeOnTheScreen();
    expect(screen.getByText('08:00 – 17:00')).toBeOnTheScreen();
  });

  it('writes the window as start – end with an en dash, not a hyphen', async () => {
    await render(<ShiftCard shift={shift()} />);

    expect(screen.getByText('08:00 – 17:00')).toBeOnTheScreen();
    expect(screen.queryByText('08:00 - 17:00')).not.toBeOnTheScreen();
  });

  it('drops the seconds — this is a window, not a receipt', async () => {
    // Art. 13's `hh:mm:ss` belongs to the comprobante. A shift window with
    // seconds on it reads as a timestamp the employee has to match exactly.
    await render(<ShiftCard shift={shift()} />);

    expect(screen.queryByText('08:00:00 – 17:00:00')).not.toBeOnTheScreen();
  });

  it('shows the wall-clock times exactly as they arrived, with no zone applied', async () => {
    // Res. 38 Art. 8. A window redisplayed an hour off is a different fact with
    // nothing on screen to say it moved.
    await render(
      <ShiftCard
        shift={shift({ startTime: '22:00:00' as NaiveTime, endTime: '06:00:00' as NaiveTime })}
      />,
    );

    expect(screen.getByText('22:00 – 06:00')).toBeOnTheScreen();
  });

  describe('the colación row', () => {
    it('is labelled informativo and carries the scheduled window', async () => {
      await render(<ShiftCard shift={shift()} />);

      expect(screen.getByText('Colación (informativo)')).toBeOnTheScreen();
      expect(screen.getByText('13:00 – 14:00')).toBeOnTheScreen();
    });

    it('offers nothing to punch — colación was dropped as a mark type', async () => {
      // docs/design-decisions.md D-F1-a. The words below are what the rejected
      // option would have put on this card.
      await render(<ShiftCard shift={shift()} />);

      expect(screen.queryByText('Iniciar colación')).not.toBeOnTheScreen();
      expect(screen.queryByText('Terminar colación')).not.toBeOnTheScreen();
      expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    });

    it('is absent when the shift carries no lunch window', async () => {
      await render(<ShiftCard shift={shift({ lunch: null })} />);

      expect(screen.queryByText('Colación (informativo)')).not.toBeOnTheScreen();
      expect(screen.getByText('08:00 – 17:00')).toBeOnTheScreen();
    });
  });

  describe('with nothing scheduled today (#7)', () => {
    it('says so in Spanish rather than showing a blank or zeroed card', async () => {
      await render(<ShiftCard shift={null} />);

      expect(screen.getByText('Hoy no tienes turno programado')).toBeOnTheScreen();
      expect(screen.getByText(es.marcaje.shift.emptyBody)).toBeOnTheScreen();
    });

    it('renders no zeroed window an employee could read as a real shift', async () => {
      await render(<ShiftCard shift={null} />);

      expect(screen.queryByText('00:00 – 00:00')).not.toBeOnTheScreen();
      expect(screen.queryByText('Colación (informativo)')).not.toBeOnTheScreen();
    });

    it('keeps the eyebrow, so the answer is where the answer always is', async () => {
      await render(<ShiftCard shift={null} />);

      expect(screen.getByText('Turno de hoy')).toBeOnTheScreen();
    });
  });
});

describe('ShiftCardSkeleton', () => {
  it('stands in for the card without inventing a shift to show (#9)', async () => {
    await render(<ShiftCardSkeleton testID="shift-skeleton" />);

    expect(screen.getByTestId('shift-skeleton')).toBeOnTheScreen();
    expect(screen.queryByText('Turno de hoy')).not.toBeOnTheScreen();
    expect(screen.queryByText(/–/)).not.toBeOnTheScreen();
  });
});
